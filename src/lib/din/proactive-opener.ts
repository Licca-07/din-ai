import {
  buildSessionContext,
  EARLY_MORNING_WAKE_OPENERS,
  getBusyCheckGreeting,
  isEarlyMorningWakeWindow,
  type DinAbsence,
  type DinSessionContext,
} from "@/lib/din/session-context";
import { selectRecallTopic } from "@/lib/din/memory-recall";
import { USER_DISPLAY_NAME } from "@/lib/din/user-display-name";
import type { DinMemory, StoredChatMessage } from "@/types/din-memory";
import type { FollowUpTopic } from "@/types/follow-up";

export type ProactiveOpenerSource =
  | "memory_recall"
  | "short_return"
  | "mild_care"
  | "session";

export type ProactiveOpener = {
  source: ProactiveOpenerSource;
  seedTopic: string;
  recentConversation: string;
  userDisplayName: string;
  followUpTopicId?: string;
};

const LAST_PROACTIVE_SEEDS_KEY = "din-ai-last-proactive-seeds";
const MAX_STORED_SEEDS = 8;

const SESSION_OPENERS: Record<DinAbsence, string[]> = {
  normal: ["久しぶりだな。", "調子はどうだ。", "この間、何かあったか。"],
  one_day: ["一日ぶりだ。", "少し顔を見ない間に何かあったか。"],
  three_days: [
    "久しぶりだ。",
    "この間は何をしていた？",
    "姿を見せないから、少し気になっていた。",
  ],
  one_week: [
    "随分久しぶりだな。",
    "この一週間、何かあったか。",
    "また会えて何よりだ。",
  ],
};

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function readRecentProactiveSeeds(): string[] {
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
    ...readRecentProactiveSeeds().filter((value) => value !== normalized),
  ].slice(0, MAX_STORED_SEEDS);

  localStorage.setItem(LAST_PROACTIVE_SEEDS_KEY, JSON.stringify(next));
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

function selectSessionSeed(
  context: DinSessionContext,
  excludeSeeds: Set<string>,
  now = new Date(),
): string {
  if (isEarlyMorningWakeWindow(now)) {
    const filtered = EARLY_MORNING_WAKE_OPENERS.filter(
      (seed) => !excludeSeeds.has(normalizeSeed(seed)),
    );
    return (
      pickRandom(filtered.length > 0 ? [...filtered] : [...EARLY_MORNING_WAKE_OPENERS]) ??
      EARLY_MORNING_WAKE_OPENERS[0]
    );
  }

  const pool = [...SESSION_OPENERS[context.absence]];
  if (context.absence === "one_day") {
    pool.unshift(getBusyCheckGreeting(now));
  }

  const filtered = pool.filter((seed) => !excludeSeeds.has(normalizeSeed(seed)));

  return (
    pickRandom(filtered.length > 0 ? filtered : pool) ?? "久しぶりだな。"
  );
}

function buildBaseOpener(memory: DinMemory): Pick<
  ProactiveOpener,
  "recentConversation" | "userDisplayName"
> {
  return {
    recentConversation: formatRecentConversation(memory.chatHistory),
    userDisplayName: USER_DISPLAY_NAME,
  };
}

export function buildRecallOpener(
  memory: DinMemory,
  now = new Date(),
  excludeSeeds: Set<string> = new Set(readRecentProactiveSeeds()),
): ProactiveOpener | null {
  const recall = selectRecallTopic(memory.followUpTopics, {
    lastTopicId: memory.lastFollowUpTopicId,
    excludeSeeds,
    now,
  });

  if (!recall) return null;

  return buildRecallOpenerFromTopic(memory, recall);
}

export function buildRecallOpenerFromTopic(
  memory: DinMemory,
  recall: FollowUpTopic,
): ProactiveOpener {
  return {
    ...buildBaseOpener(memory),
    source: "memory_recall",
    seedTopic: recall.content,
    followUpTopicId: recall.id,
  };
}

export function buildSessionOpener(
  memory: DinMemory,
  excludeSeeds: Set<string>,
  now = new Date(),
): ProactiveOpener {
  const sessionContext = buildSessionContext({
    now,
    conversationCount: memory.conversationCount,
  });

  return {
    ...buildBaseOpener(memory),
    source: "session",
    seedTopic: selectSessionSeed(sessionContext, excludeSeeds, now),
  };
}

export function recordProactiveOpenerUsed(opener: ProactiveOpener): void {
  recordProactiveSeed(opener.seedTopic);
}
