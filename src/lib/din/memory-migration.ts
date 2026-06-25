import {
  DEFAULT_MEMORY,
  hasStoredMemoryData,
  isValidProfile,
  isValidStoredMessage,
  normalizeMemory,
  parseMemory,
  SAMPLE_USER_PROFILE,
} from "@/lib/din/memory-schema";
import type { StoredChatMessage } from "@/types/din-memory";
import type { DinMemory } from "@/types/din-memory";

export const MEMORY_KEY = "din-ai-memory";
export const MEMORY_BACKUP_KEY = "din-ai-memory-backup";

const LEGACY_PROFILE_KEY = "din-ai-user-profile";
const LEGACY_COUNT_KEY = "din-ai-conversation-count";
const LEGACY_HISTORY_KEY = "din-ai-chat-history";

const MIGRATION_STORAGE_KEYS = [
  MEMORY_KEY,
  MEMORY_BACKUP_KEY,
  LEGACY_PROFILE_KEY,
  LEGACY_COUNT_KEY,
  LEGACY_HISTORY_KEY,
] as const;

function isDefaultSampleProfile(profile: DinMemory["profile"]): boolean {
  return (
    profile.occupation === SAMPLE_USER_PROFILE.occupation &&
    JSON.stringify(profile.hobbies) ===
      JSON.stringify(SAMPLE_USER_PROFILE.hobbies) &&
    JSON.stringify(profile.favoriteFoods) ===
      JSON.stringify(SAMPLE_USER_PROFILE.favoriteFoods)
  );
}

/** 実データの量を数値化（DEFAULT のサンプルプロフィールは除外） */
export function scoreMemoryRichness(memory: DinMemory): number {
  let score = 0;

  score += memory.chatHistory.length * 100;
  score += memory.conversationCount * 10;
  score += memory.longTermMemories.length * 50;
  score += memory.shortTermMemories.length * 20;
  score += memory.followUpTopics.length * 5;

  if (memory.lastConversationAt) {
    score += 5;
  }

  if (!isDefaultSampleProfile(memory.profile)) {
    score += 10;
  }

  return score;
}

export function isMeaningfulMemory(memory: DinMemory): boolean {
  return scoreMemoryRichness(memory) > 0;
}

function readUnifiedLocalBlob(): DinMemory | null {
  if (typeof window === "undefined") return null;

  for (const key of [MEMORY_KEY, MEMORY_BACKUP_KEY]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = parseMemory(JSON.parse(raw));
      if (parsed) return parsed;
    } catch {
      // try next key
    }
  }

  return null;
}

function readLegacySplitKeys(): DinMemory | null {
  if (typeof window === "undefined") return null;

  const hasLegacy =
    localStorage.getItem(LEGACY_PROFILE_KEY) ||
    localStorage.getItem(LEGACY_COUNT_KEY) ||
    localStorage.getItem(LEGACY_HISTORY_KEY);

  if (!hasLegacy) return null;

  let profile = DEFAULT_MEMORY.profile;

  try {
    const rawProfile = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (rawProfile) {
      const parsed: unknown = JSON.parse(rawProfile);
      if (isValidProfile(parsed)) {
        profile = parsed;
      }
    }
  } catch {
    // ignore invalid legacy profile
  }

  let conversationCount = 0;

  try {
    const rawCount = localStorage.getItem(LEGACY_COUNT_KEY);
    if (rawCount) {
      const parsed = Number.parseInt(rawCount, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        conversationCount = parsed;
      }
    }
  } catch {
    // ignore invalid legacy count
  }

  let chatHistory: StoredChatMessage[] = [];

  try {
    const rawHistory = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (rawHistory) {
      const parsed: unknown = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) {
        chatHistory = parsed.filter(isValidStoredMessage);
      }
    }
  } catch {
    // ignore invalid legacy history
  }

  return normalizeMemory({
    profile,
    conversationCount,
    chatHistory,
  });
}

/** localStorage から移行候補を読む（セッション用 din-ai-last-visit は対象外） */
export function readLocalStorageForMigration(): DinMemory | null {
  const unified = readUnifiedLocalBlob();
  if (unified) return unified;

  return readLegacySplitKeys();
}

export function backupLocalStorageSnapshot(memory: DinMemory): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MEMORY_BACKUP_KEY, JSON.stringify(memory));
  } catch (error) {
    console.error("[memory backup]", error);
  }
}

/** 移行済みの記憶キーのみ削除（セッションキーは残す） */
export function clearMigratedLocalStorageKeys(): void {
  if (typeof window === "undefined") return;

  for (const key of MIGRATION_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

export function hasLocalMigrationSource(): boolean {
  if (typeof window === "undefined") return false;

  return MIGRATION_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

export function pickPreferredMemory(
  local: DinMemory | null,
  remote: DinMemory | null,
): DinMemory | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;

  const localScore = scoreMemoryRichness(local);
  const remoteScore = scoreMemoryRichness(remote);

  if (localScore > remoteScore) return local;
  if (remoteScore > localScore) return remote;

  if (hasStoredMemoryData(remote) && !hasStoredMemoryData(local)) {
    return remote;
  }

  return local;
}
