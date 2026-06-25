import { buildSessionContext, type DinAbsence, type DinSessionContext } from "@/lib/din/session-context";
import { extractTopicsFromMessage } from "@/lib/din/follow-up";
import { selectRecallTopic } from "@/lib/din/memory-recall";
import {
  sortLongTermMemories,
  sortShortTermMemories,
} from "@/lib/din/memory-priority";
import { USER_DISPLAY_NAME } from "@/lib/din/user-display-name";
import type { DinMemory, StoredChatMessage } from "@/types/din-memory";

export type ProactiveOpenerSource =
  | "memory_recall"
  | "memory"
  | "recent_chat"
  | "session";

export type ProactiveOpener = {
  source: ProactiveOpenerSource;
  seedTopic: string;
  recentConversation: string;
  userDisplayName: string;
  followUpTopicId?: string;
};

const LAST_PROACTIVE_SEEDS_KEY = "din-ai-last-proactive-seeds";
const PENDING_CONTINUATION_KEY = "din-ai-pending-continuation-for";
const MAX_STORED_SEEDS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

const PENDING_CONTINUATION_MESSAGES = [
  "どうしたんだ。",
  "まだ起きていたのか。",
  "さっきの続きだ。",
];

const SESSION_OPENERS: Record<DinAbsence, string[]> = {
  normal: ["今日は何をしていた？", "調子はどうだ。", "何かあったか。"],
  one_day: ["昨日は忙しかったのか。", "今日は何をしていた？", "一日ぶりだな。"],
  three_days: ["久しぶりだ。調子はどうだ。", "この間は何をしていた？", "姿を見せないから気になっていた。"],
  one_week: ["随分久しぶりだな。", "この一週間、何かあったか。", "また会えて何よりだ。調子はどうだ。"],
};

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, " ").slice(0, 80);
}

function readRecentSeeds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LAST_PROACTIVE_SEEDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function recordProactiveSeed(seed: string): void {
  if (typeof window === "undefined") return;

  const normalized = normalizeSeed(seed);
  if (!normalized) return;

  const next = [
    normalized,
    ...readRecentSeeds().filter((value) => value !== normalized),
  ].slice(0, MAX_STORED_SEEDS);

  localStorage.setItem(LAST_PROACTIVE_SEEDS_KEY, JSON.stringify(next));
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function formatRecentConversation(messages: StoredChatMessage[], limit = 8): string {
  if (messages.length === 0) return "（なし）";

  return messages
    .slice(-limit)
    .map((message) => {
      const speaker = message.role === "user" ? USER_DISPLAY_NAME : "Din";
      return `${speaker}: ${message.content}`;
    })
    .join("\n");
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** 最後のメッセージが assistant で、ユーザー返信待ちか */
export function isAwaitingUserReply(messages: StoredChatMessage[]): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "assistant";
}

export function pickPendingContinuationMessage(): string {
  return (
    pickRandom(PENDING_CONTINUATION_MESSAGES) ?? PENDING_CONTINUATION_MESSAGES[0]
  );
}

export function shouldShowPendingContinuation(assistantMessageId: string): boolean {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(PENDING_CONTINUATION_KEY) !== assistantMessageId;
}

export function markPendingContinuationShown(assistantMessageId: string): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(PENDING_CONTINUATION_KEY, assistantMessageId);
}

function selectMemorySeed(memory: DinMemory, excludeSeeds: Set<string>): string | null {
  const candidates = sortLongTermMemories(memory.longTermMemories)
    .filter((item) => item.importance >= 3)
    .filter((item) => !excludeSeeds.has(normalizeSeed(item.content)))
    .slice(0, 8);

  const picked = pickRandom(candidates);
  return picked?.content ?? null;
}

function selectShortTermSeed(memory: DinMemory, excludeSeeds: Set<string>, now: Date): string | null {
  const candidates = sortShortTermMemories(memory.shortTermMemories, now)
    .filter((item) => !excludeSeeds.has(normalizeSeed(item.content)))
    .slice(0, 5);

  const picked = pickRandom(candidates);
  return picked?.content ?? null;
}

function selectRecentChatSeed(
  messages: StoredChatMessage[],
  excludeSeeds: Set<string>,
): string | null {
  const userMessages = messages.filter((message) => message.role === "user").slice(-6);

  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const topics = extractTopicsFromMessage(userMessages[index].content);

    for (const topic of topics) {
      if (!excludeSeeds.has(normalizeSeed(topic))) {
        return topic;
      }
    }
  }

  return null;
}

function selectSessionSeed(
  context: DinSessionContext,
  excludeSeeds: Set<string>,
): string {
  const pool = SESSION_OPENERS[context.absence].filter(
    (seed) => !excludeSeeds.has(normalizeSeed(seed)),
  );

  return pickRandom(pool.length > 0 ? pool : SESSION_OPENERS[context.absence]) ?? "調子はどうだ。";
}

/** 起動時に Din から話しかけるための材料を選ぶ（履歴がある場合のみ） */
export function resolveStartupProactiveOpener(
  memory: DinMemory,
  now = new Date(),
): ProactiveOpener | null {
  if (memory.chatHistory.length === 0) return null;

  const excludeSeeds = new Set(readRecentSeeds());
  const recentConversation = formatRecentConversation(memory.chatHistory);
  const base = {
    recentConversation,
    userDisplayName: USER_DISPLAY_NAME,
  };

  const recall = selectRecallTopic(memory.followUpTopics, {
    lastTopicId: memory.lastFollowUpTopicId,
    excludeSeeds,
    now,
  });
  if (recall) {
    return {
      ...base,
      source: "memory_recall",
      seedTopic: recall.content,
      followUpTopicId: recall.id,
    };
  }

  const memorySeed = selectMemorySeed(memory, excludeSeeds);
  if (memorySeed) {
    return {
      ...base,
      source: "memory",
      seedTopic: memorySeed,
    };
  }

  const shortTermSeed = selectShortTermSeed(memory, excludeSeeds, now);
  if (shortTermSeed) {
    return {
      ...base,
      source: "memory",
      seedTopic: shortTermSeed,
    };
  }

  const chatSeed = selectRecentChatSeed(memory.chatHistory, excludeSeeds);
  if (chatSeed) {
    return {
      ...base,
      source: "recent_chat",
      seedTopic: chatSeed,
    };
  }

  const sessionContext = buildSessionContext({
    now,
    conversationCount: memory.conversationCount,
  });

  return {
    ...base,
    source: "session",
    seedTopic: selectSessionSeed(sessionContext, excludeSeeds),
  };
}

export function recordProactiveOpenerUsed(opener: ProactiveOpener): void {
  recordProactiveSeed(opener.seedTopic);
}
