import type { FollowUpTopic } from "@/types/follow-up";
import {
  RECALL_MIN_DAYS_BETWEEN_ASKS,
  RECALL_MIN_SCORE,
} from "@/types/follow-up";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecallScoreContext = {
  themeRecurrence: Map<string, number>;
};

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeTheme(content: string): string {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function extractThemeTokens(content: string): string[] {
  const tokens = new Set<string>();

  for (const match of content.toLowerCase().matchAll(/[a-z0-9]{2,}/g)) {
    tokens.add(match[0]);
  }

  for (const match of content.matchAll(/[ァ-ヴー]{2,}|[一-龯]{2,}/g)) {
    tokens.add(match[0]);
  }

  for (const part of content.split(/[\s、。！？!?,.]/)) {
    const trimmed = part.trim();
    if (trimmed.length >= 2) {
      tokens.add(trimmed.toLowerCase());
    }
  }

  return [...tokens];
}

function areThemesRelated(left: string, right: string): boolean {
  const normalizedLeft = normalizeTheme(left);
  const normalizedRight = normalizeTheme(right);

  if (normalizedLeft === normalizedRight) return true;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const rightTokens = new Set(extractThemeTokens(right));
  let sharedCount = 0;

  for (const token of extractThemeTokens(left)) {
    if (rightTokens.has(token)) {
      sharedCount += 1;
    }
  }

  return sharedCount >= 1;
}

/** 同系統トピックがいくつあるか（継続関心の指標） */
export function computeThemeRecurrenceScores(
  topics: FollowUpTopic[],
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const topic of topics) {
    let relatedCount = 0;

    for (const other of topics) {
      if (topic.id === other.id) continue;
      if (areThemesRelated(topic.content, other.content)) {
        relatedCount += 1;
      }
    }

    scores.set(topic.id, relatedCount);
  }

  return scores;
}

export function buildRecallScoreContext(
  topics: FollowUpTopic[],
): RecallScoreContext {
  return {
    themeRecurrence: computeThemeRecurrenceScores(topics),
  };
}

function getReferenceCount(topic: FollowUpTopic): number {
  return topic.mentionCount + topic.sourceMemoryIds.length;
}

function isUnresolvedTopic(topic: FollowUpTopic): boolean {
  if (!topic.lastFollowedUpAt) return true;

  return (
    new Date(topic.lastMentionedAt).getTime() >
    new Date(topic.lastFollowedUpAt).getTime()
  );
}

function scoreReferenceCount(referenceCount: number): number {
  if (referenceCount <= 1) return 0.5;
  return Math.min(referenceCount, 8) * 1.4;
}

function scoreRecency(daysSinceMention: number): number {
  if (daysSinceMention <= 1) return 4;
  if (daysSinceMention <= 3) return 3.2;
  if (daysSinceMention <= 7) return 2.2;
  if (daysSinceMention <= 14) return 1;
  if (daysSinceMention <= 30) return 0.3;
  return 0;
}

function scoreUnresolved(topic: FollowUpTopic): number {
  if (!isUnresolvedTopic(topic)) return 0;

  const pendingMentions = Math.max(0, topic.mentionCount - topic.askedCount);
  return 2.5 + Math.min(pendingMentions, 4) * 0.9;
}

function scoreThemeRecurrence(
  topic: FollowUpTopic,
  themeRecurrence: number,
): number {
  const isOngoingTheme = topic.mentionCount >= 2 || themeRecurrence >= 1;
  const recurrenceBonus = themeRecurrence * 2.8;
  const ongoingBonus = isOngoingTheme ? 2.5 : 0;

  return recurrenceBonus + ongoingBonus;
}

/** importance は補助重みのみ（±0.6 程度） */
function scoreImportanceSecondary(importance: FollowUpTopic["importance"]): number {
  return (importance - 3) * 0.3;
}

/** Recall 選定スコア（高いほど今聞くのに自然） */
export function scoreRecallTopic(
  topic: FollowUpTopic,
  context: RecallScoreContext,
  now = new Date(),
): number {
  const daysSinceAsked = topic.lastFollowedUpAt
    ? daysSince(topic.lastFollowedUpAt, now)
    : Number.POSITIVE_INFINITY;

  if (daysSinceAsked < RECALL_MIN_DAYS_BETWEEN_ASKS) {
    return Number.NEGATIVE_INFINITY;
  }

  const referenceCount = getReferenceCount(topic);
  const daysSinceMention = daysSince(topic.lastMentionedAt, now);
  const themeRecurrence = context.themeRecurrence.get(topic.id) ?? 0;
  const askGapBonus =
    daysSinceAsked === Number.POSITIVE_INFINITY
      ? 1.2
      : Math.min(daysSinceAsked, 10) * 0.25;
  const askFatigue = topic.askedCount * 1.1;

  return (
    scoreReferenceCount(referenceCount) +
    scoreRecency(daysSinceMention) +
    scoreUnresolved(topic) +
    scoreThemeRecurrence(topic, themeRecurrence) +
    scoreImportanceSecondary(topic.importance) +
    askGapBonus -
    askFatigue
  );
}

function weightedPick<T>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null;

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[0] ?? null;

  let roll = Math.random() * total;

  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) {
      return items[index] ?? null;
    }
  }

  return items[items.length - 1] ?? null;
}

/** 最も自然な Recall 話題を1件選ぶ */
export function selectRecallTopic(
  topics: FollowUpTopic[],
  options: {
    lastTopicId: string | null;
    excludeSeeds?: Set<string>;
    now?: Date;
  },
): FollowUpTopic | null {
  const now = options.now ?? new Date();
  const excludeSeeds = options.excludeSeeds ?? new Set<string>();
  const context = buildRecallScoreContext(topics);

  const ranked = topics
    .map((topic) => ({
      topic,
      score: scoreRecallTopic(topic, context, now),
    }))
    .filter(
      ({ topic, score }) =>
        score >= RECALL_MIN_SCORE &&
        !excludeSeeds.has(normalizeSeed(topic.content)),
    )
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) return null;

  const withoutLast = options.lastTopicId
    ? ranked.filter(({ topic }) => topic.id !== options.lastTopicId)
    : ranked;
  const pool = withoutLast.length > 0 ? withoutLast : ranked;
  const top = pool.slice(0, 3);

  return weightedPick(
    top.map((entry) => entry.topic),
    top.map((entry) => Math.max(entry.score, 0.1)),
  );
}

export function describeRecallTopic(
  topic: FollowUpTopic,
  context?: RecallScoreContext,
): string {
  const scoreContext = context ?? buildRecallScoreContext([topic]);
  const themeRecurrence = scoreContext.themeRecurrence.get(topic.id) ?? 0;
  const unresolved = isUnresolvedTopic(topic) ? "未解決" : "確認済";

  return `- ${topic.content} [言及${topic.mentionCount}回, 関連${themeRecurrence}件, ${unresolved}]`;
}
