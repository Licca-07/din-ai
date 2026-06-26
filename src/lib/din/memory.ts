import {
  applyFollowUpRecalls,
  applyTopicMentions,
  bumpFollowUpMentionsFromMessage,
  extractTopicsFromMemoryItem,
  extractTopicsFromMessage,
  markFollowUpAsked,
  resolveFollowUpTopic,
} from "@/lib/din/follow-up";
import { recordProactiveSeed } from "@/lib/din/proactive-opener";
import {
  clampImportance,
  createMemoryItem as createMemoryItemInternal,
} from "@/lib/din/memory-priority";
import { recordSessionVisit } from "@/lib/din/session-context";
import {
  DEFAULT_MEMORY,
  normalizeMemory,
  parseMemory,
} from "@/lib/din/memory-schema";
import {
  backupLocalStorageSnapshot,
  clearMigratedLocalStorageKeys,
  isMeaningfulMemory,
  MEMORY_BACKUP_KEY,
  MEMORY_KEY,
  pickPreferredMemory,
  readLocalStorageForMigration,
  scoreMemoryRichness,
} from "@/lib/din/memory-migration";
import type { DinMemory, StoredChatMessage } from "@/types/din-memory";
import type { MemoryItem } from "@/types/memory-item";
import type { FollowUpRecallInput } from "@/types/follow-up";
import type { UserProfile } from "@/types/user-profile";

export {
  DEFAULT_MEMORY,
  SAMPLE_USER_PROFILE,
} from "@/lib/din/memory-schema";

export { MEMORY_BACKUP_KEY, MEMORY_KEY } from "@/lib/din/memory-migration";

const SYNC_DEBOUNCE_MS = 400;

let memoryCache: DinMemory | null = null;
let initPromise: Promise<DinMemory> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;
let lastSyncError: string | null = null;

async function fetchRemoteMemory(): Promise<{
  exists: boolean;
  memory: DinMemory;
}> {
  const response = await fetch("/api/memory", { cache: "no-store" });
  const data = (await response.json()) as
    | { exists: boolean; memory: unknown; error?: string }
    | { error: string };

  if (!response.ok) {
    const message = "error" in data ? data.error : "記憶の取得に失敗しました。";
    throw new Error(message);
  }

  const memory = parseMemory("memory" in data ? data.memory : null);
  if (!memory) {
    throw new Error("サーバーから返された記憶データの形式が不正です。");
  }

  return {
    exists: "exists" in data ? data.exists === true : false,
    memory,
  };
}

async function persistRemoteMemory(memory: DinMemory): Promise<DinMemory> {
  const response = await fetch("/api/memory", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memory }),
  });

  const data = (await response.json()) as
    | { memory: unknown; error?: string }
    | { error: string };

  if (!response.ok) {
    const message = "error" in data ? data.error : "記憶の保存に失敗しました。";
    throw new Error(message);
  }

  const saved = parseMemory("memory" in data ? data.memory : null);
  if (!saved) {
    throw new Error("サーバーへの保存後の記憶データ形式が不正です。");
  }

  return saved;
}

async function deleteRemoteMemory(): Promise<DinMemory> {
  const response = await fetch("/api/memory", { method: "DELETE" });
  const data = (await response.json()) as
    | { memory: unknown; error?: string }
    | { error: string };

  if (!response.ok) {
    const message = "error" in data ? data.error : "記憶の削除に失敗しました。";
    throw new Error(message);
  }

  const saved = parseMemory("memory" in data ? data.memory : null);
  return saved ?? DEFAULT_MEMORY;
}

async function syncMemoryNow(memory: DinMemory): Promise<void> {
  if (syncInFlight) {
    await syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      const saved = await persistRemoteMemory(memory);
      memoryCache = saved;
      lastSyncError = null;
    } catch (error) {
      lastSyncError =
        error instanceof Error ? error.message : "記憶の同期に失敗しました。";
      throw error;
    } finally {
      syncInFlight = null;
    }
  })();

  await syncInFlight;
}

function scheduleMemorySync(memory: DinMemory): void {
  if (typeof window === "undefined") return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    void syncMemoryNow(memory).catch((error) => {
      console.error("[memory sync]", error);
    });
  }, SYNC_DEBOUNCE_MS);
}

export function isMemoryReady(): boolean {
  return memoryCache !== null;
}

export function getLastMemorySyncError(): string | null {
  return lastSyncError;
}

export async function initMemory(): Promise<DinMemory> {
  if (memoryCache) return memoryCache;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const local = readLocalStorageForMigration();
    let remote: Awaited<ReturnType<typeof fetchRemoteMemory>> | null = null;
    let remoteError: string | null = null;

    try {
      remote = await fetchRemoteMemory();
    } catch (error) {
      remoteError =
        error instanceof Error ? error.message : "記憶の取得に失敗しました。";
      lastSyncError = remoteError;
    }

    const preferred = pickPreferredMemory(
      local,
      remote?.memory ?? null,
    );

    if (preferred && isMeaningfulMemory(preferred)) {
      if (local && scoreMemoryRichness(local) >= scoreMemoryRichness(preferred)) {
        backupLocalStorageSnapshot(local);
      }

      try {
        const saved = await persistRemoteMemory(preferred);
        memoryCache = saved;
        lastSyncError = null;

        if (
          local &&
          scoreMemoryRichness(local) <= scoreMemoryRichness(saved) &&
          scoreMemoryRichness(saved) > 0
        ) {
          clearMigratedLocalStorageKeys();
        }

        return memoryCache;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "記憶の保存に失敗しました。";
        lastSyncError = message;
        console.error("[memory init sync]", error);

        memoryCache = preferred;
        if (local) {
          backupLocalStorageSnapshot(local);
        }
        return memoryCache;
      }
    }

    if (remote) {
      memoryCache = remote.memory;

      if (!remote.exists && !isMeaningfulMemory(remote.memory)) {
        try {
          memoryCache = await persistRemoteMemory(DEFAULT_MEMORY);
          lastSyncError = null;
        } catch (error) {
          lastSyncError =
            error instanceof Error ? error.message : "記憶の保存に失敗しました。";
        }
      }

      return memoryCache;
    }

    if (local) {
      memoryCache = local;
      backupLocalStorageSnapshot(local);
      return memoryCache;
    }

    memoryCache = DEFAULT_MEMORY;

    if (!remoteError) {
      try {
        memoryCache = await persistRemoteMemory(DEFAULT_MEMORY);
        lastSyncError = null;
      } catch (error) {
        lastSyncError =
          error instanceof Error ? error.message : "記憶の保存に失敗しました。";
      }
    }

    return memoryCache;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function loadMemory(): DinMemory {
  return memoryCache ?? DEFAULT_MEMORY;
}

export function saveMemory(memory: DinMemory): void {
  memoryCache = memory;
  scheduleMemorySync(memory);
}

export async function flushMemorySync(): Promise<void> {
  if (!memoryCache) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  await syncMemoryNow(memoryCache);
}

export function ensureMemory(): DinMemory {
  return loadMemory();
}

export async function clearAllMemory(): Promise<void> {
  memoryCache = { ...DEFAULT_MEMORY };
  await deleteRemoteMemory();
  memoryCache = { ...DEFAULT_MEMORY };
  lastSyncError = null;
}

export function updateMemory(
  updater: (memory: DinMemory) => DinMemory,
): DinMemory {
  const next = updater(loadMemory());
  saveMemory(next);
  return next;
}

export function addMemoryItems(items: MemoryItem[]): void {
  if (items.length === 0) return;

  updateMemory((memory) => ({
    ...memory,
    longTermMemories: [
      ...memory.longTermMemories,
      ...items.filter((item) => item.kind === "long_term"),
    ],
    shortTermMemories: [
      ...memory.shortTermMemories,
      ...items.filter((item) => item.kind === "short_term"),
    ],
  }));
}

export function markMemoryItemsReferenced(ids: string[], now = new Date()): void {
  if (ids.length === 0) return;

  const iso = now.toISOString();
  const idSet = new Set(ids);

  updateMemory((memory) => ({
    ...memory,
    longTermMemories: memory.longTermMemories.map((item) =>
      idSet.has(item.id) ? { ...item, lastReferencedAt: iso } : item,
    ),
    shortTermMemories: memory.shortTermMemories.map((item) =>
      idSet.has(item.id) ? { ...item, lastReferencedAt: iso } : item,
    ),
  }));
}

export function removeMemoryItem(id: string): void {
  updateMemory((memory) => ({
    ...memory,
    longTermMemories: memory.longTermMemories.filter((item) => item.id !== id),
    shortTermMemories: memory.shortTermMemories.filter((item) => item.id !== id),
  }));
}

export function loadUserProfile(): UserProfile {
  return loadMemory().profile;
}

export function saveUserProfile(profile: UserProfile): void {
  updateMemory((memory) => ({
    ...memory,
    profile,
  }));
}

export function ensureUserProfile(): UserProfile {
  return ensureMemory().profile;
}

export function loadChatHistory(): StoredChatMessage[] {
  return loadMemory().chatHistory;
}

export function saveChatHistory(messages: StoredChatMessage[]): void {
  updateMemory((memory) => ({
    ...memory,
    chatHistory: messages,
  }));
}

export function loadConversationCount(): number {
  return loadMemory().conversationCount;
}

export function saveConversationCount(count: number): void {
  updateMemory((memory) => ({
    ...memory,
    conversationCount: Math.max(0, count),
  }));
}

export function incrementConversationCount(): number {
  let next = 0;

  updateMemory((memory) => {
    next = memory.conversationCount + 1;
    return {
      ...memory,
      conversationCount: next,
      lastConversationAt: new Date().toISOString(),
    };
  });

  return next;
}

export function syncConversationCountFromHistory(userMessageCount: number): void {
  updateMemory((memory) => {
    if (userMessageCount <= memory.conversationCount) {
      return memory;
    }

    return {
      ...memory,
      conversationCount: userMessageCount,
    };
  });
}

export function recordLastConversation(now = new Date()): void {
  updateMemory((memory) => ({
    ...memory,
    lastConversationAt: now.toISOString(),
  }));
}

export function formatLastConversation(iso: string | null): string {
  if (!iso) return "未記録";

  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function describeUserProfile(profile: UserProfile): string {
  const occupation = profile.occupation.trim() || "未設定";
  const hobbies =
    profile.hobbies.length > 0 ? profile.hobbies.join("、") : "未設定";
  const favoriteFoods =
    profile.favoriteFoods.length > 0
      ? profile.favoriteFoods.join("、")
      : "未設定";

  return [
    `- 職業: ${occupation}`,
    `- 趣味: ${hobbies}`,
    `- 好きなもの: ${favoriteFoods}`,
  ].join("\n");
}

export { clampImportance, createMemoryItemInternal as createMemoryItem };

export {
  applyFollowUpRecalls,
  applyTopicMentions,
  bumpFollowUpMentionsFromMessage,
  extractTopicsFromMemoryItem,
  extractTopicsFromMessage,
  markFollowUpAsked,
  resolveFollowUpTopic,
};

export function addFollowUpRecalls(recalls: FollowUpRecallInput[]): void {
  if (recalls.length === 0) return;

  updateMemory((memory) => ({
    ...memory,
    ...applyFollowUpRecalls(memory, recalls),
  }));
}

export function removeFollowUpTopic(id: string): void {
  updateMemory((memory) => ({
    ...memory,
    followUpTopics: memory.followUpTopics.filter((topic) => topic.id !== id),
    lastFollowUpTopicId:
      memory.lastFollowUpTopicId === id ? null : memory.lastFollowUpTopicId,
  }));
}

export function recordTopicMentionsFromMessage(message: string): void {
  updateMemory((memory) => ({
    ...memory,
    ...bumpFollowUpMentionsFromMessage(memory, message),
  }));
}

export function recordTopicsFromMemoryItems(_items: MemoryItem[]): void {
  // Recall 候補は Din マーカーの followUp のみで追加する
}

export function resolveSessionFollowUp() {
  return resolveFollowUpTopic(loadMemory());
}

export {
  recordProactiveOpenerUsed,
} from "@/lib/din/proactive-opener";

export { resolveStartupGreeting } from "@/lib/din/startup-greeting";

export function recordAppOpened(now = new Date()): void {
  updateMemory((memory) => ({
    ...memory,
    lastAppOpenedAt: now.toISOString(),
  }));
  recordSessionVisit(now);
}

export function recordStartupGreetingShown(content: string): void {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) return;

  updateMemory((memory) => ({
    ...memory,
    lastStartupMessage: normalized,
  }));
  recordProactiveSeed(normalized);
}

export function recordFollowUpTopicAsked(topicId: string): void {
  updateMemory((memory) => ({
    ...memory,
    ...markFollowUpAsked(memory, topicId),
  }));
}
