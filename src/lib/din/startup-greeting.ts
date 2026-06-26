import {
  buildRecallOpener,
  buildSessionOpener,
  readRecentProactiveSeeds,
  type ProactiveOpener,
} from "@/lib/din/proactive-opener";
import { getLastVisitIso } from "@/lib/din/session-context";
import type { DinMemory } from "@/types/din-memory";

export const STARTUP_SILENT_MAX_MS = 4 * 60 * 60 * 1000;
export const STARTUP_SHORT_MAX_MS = 12 * 60 * 60 * 1000;
export const STARTUP_CARING_MAX_MS = 24 * 60 * 60 * 1000;

export type StartupGreetingBand = "silent" | "short" | "caring" | "recall";

export type StartupGreetingDecision =
  | { mode: "none"; band: "silent" }
  | { mode: "fixed"; band: StartupGreetingBand; message: string }
  | { mode: "llm"; band: StartupGreetingBand; opener: ProactiveOpener };

const SHORT_RETURN_MESSAGES = [
  "戻ったか。",
  "どうした。",
  "少し静かだったな。",
  "まだ起きていたのか。",
];

const MILD_CARE_MESSAGES = [
  "今日は忙しかったのか。",
  "少し顔を見ない間に何かあったか。",
];

const RECALL_PROBABILITY_24H_PLUS = 0.5;

function normalizeMessage(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** テスト用: 乱数を差し替え可能にする */
let randomFn = Math.random;

export function setStartupGreetingRandom(random: () => number): void {
  randomFn = random;
}

export function resetStartupGreetingRandom(): void {
  randomFn = Math.random;
}

export function getEffectiveLastAppOpenedAt(memory: DinMemory): string | null {
  if (memory.lastAppOpenedAt) return memory.lastAppOpenedAt;

  const localVisit = getLastVisitIso();
  if (localVisit) return localVisit;

  return null;
}

export function getElapsedMsSinceLastOpen(
  memory: DinMemory,
  now = new Date(),
): number | null {
  const lastOpen = getEffectiveLastAppOpenedAt(memory);
  if (!lastOpen) return null;

  return now.getTime() - new Date(lastOpen).getTime();
}

export function getStartupGreetingBand(
  elapsedMs: number | null,
): StartupGreetingBand {
  if (elapsedMs === null || elapsedMs < STARTUP_SILENT_MAX_MS) {
    return "silent";
  }
  if (elapsedMs < STARTUP_SHORT_MAX_MS) return "short";
  if (elapsedMs < STARTUP_CARING_MAX_MS) return "caring";
  return "recall";
}

export function buildStartupMessageExclusions(memory: DinMemory): Set<string> {
  const exclude = new Set<string>();

  if (memory.lastStartupMessage) {
    exclude.add(normalizeMessage(memory.lastStartupMessage));
  }

  const lastMessage = memory.chatHistory[memory.chatHistory.length - 1];
  if (lastMessage?.role === "assistant") {
    exclude.add(normalizeMessage(lastMessage.content));
  }

  return exclude;
}

export function pickStartupFixedMessage(
  pool: readonly string[],
  exclude: Set<string>,
): string | null {
  const candidates = pool.filter(
    (message) => !exclude.has(normalizeMessage(message)),
  );

  if (candidates.length > 0) {
    return pickRandom(candidates);
  }

  return pickRandom([...pool]);
}

function buildExcludeSeeds(memory: DinMemory): Set<string> {
  const exclude = buildStartupMessageExclusions(memory);

  for (const seed of readRecentProactiveSeeds()) {
    exclude.add(normalizeMessage(seed));
  }

  for (const message of memory.chatHistory.slice(-4)) {
    if (message.role === "assistant") {
      exclude.add(normalizeMessage(message.content));
    }
  }

  return exclude;
}

function resolveShortBandGreeting(
  memory: DinMemory,
  exclude: Set<string>,
  now: Date,
): StartupGreetingDecision {
  const roll = randomFn();

  if (roll < 0.7) {
    const message =
      pickStartupFixedMessage(SHORT_RETURN_MESSAGES, exclude) ??
      SHORT_RETURN_MESSAGES[0];
    return { mode: "fixed", band: "short", message };
  }

  if (roll < 0.9) {
    const message =
      pickStartupFixedMessage(MILD_CARE_MESSAGES, exclude) ??
      MILD_CARE_MESSAGES[0];
    return { mode: "fixed", band: "caring", message };
  }

  const recallOpener = buildRecallOpener(memory, now, exclude);
  if (recallOpener) {
    return { mode: "llm", band: "recall", opener: recallOpener };
  }

  const message =
    pickStartupFixedMessage(SHORT_RETURN_MESSAGES, exclude) ??
    SHORT_RETURN_MESSAGES[0];
  return { mode: "fixed", band: "short", message };
}

function resolveCaringBandGreeting(
  exclude: Set<string>,
): StartupGreetingDecision {
  const message =
    pickStartupFixedMessage(MILD_CARE_MESSAGES, exclude) ??
    MILD_CARE_MESSAGES[0];
  return { mode: "fixed", band: "caring", message };
}

function resolveRecallBandGreeting(
  memory: DinMemory,
  exclude: Set<string>,
  now: Date,
): StartupGreetingDecision {
  if (randomFn() < RECALL_PROBABILITY_24H_PLUS) {
    const recallOpener = buildRecallOpener(memory, now, exclude);
    if (recallOpener) {
      return { mode: "llm", band: "recall", opener: recallOpener };
    }
  }

  const fixed =
    pickStartupFixedMessage(MILD_CARE_MESSAGES, exclude) ??
    pickStartupFixedMessage(SHORT_RETURN_MESSAGES, exclude);

  if (fixed) {
    return { mode: "fixed", band: "caring", message: fixed };
  }

  return {
    mode: "llm",
    band: "recall",
    opener: buildSessionOpener(memory, exclude, now),
  };
}

/**
 * 起動時に Din が話しかけるかどうかを決める。
 * chatHistory が空のときは null（初回挨拶は別フロー）。
 */
export function resolveStartupGreeting(
  memory: DinMemory,
  now = new Date(),
): StartupGreetingDecision | null {
  if (memory.chatHistory.length === 0) return null;

  const elapsedMs = getElapsedMsSinceLastOpen(memory, now);
  const band = getStartupGreetingBand(elapsedMs);

  if (band === "silent") {
    return { mode: "none", band: "silent" };
  }

  const exclude = buildExcludeSeeds(memory);

  if (band === "short") {
    return resolveShortBandGreeting(memory, exclude, now);
  }

  if (band === "caring") {
    return resolveCaringBandGreeting(exclude);
  }

  return resolveRecallBandGreeting(memory, exclude, now);
}
