import type { FollowUpTopic } from "@/types/follow-up";
import {
  RECALL_MIN_DAYS_BETWEEN_ASKS,
  RECALL_MIN_SCORE,
} from "@/types/follow-up";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, " ").slice(0, 80);
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

/** Recall 選定スコア（高いほど今聞くのに自然） */
export function scoreRecallTopic(topic: FollowUpTopic, now = new Date()): number {
  const daysSinceAsked = topic.lastFollowedUpAt
    ? daysSince(topic.lastFollowedUpAt, now)
    : Number.POSITIVE_INFINITY;

  if (daysSinceAsked < RECALL_MIN_DAYS_BETWEEN_ASKS) {
    return Number.NEGATIVE_INFINITY;
  }

  const daysSinceMention = daysSince(topic.lastMentionedAt, now);
  const askGapBonus =
    daysSinceAsked === Number.POSITIVE_INFINITY
      ? 4
      : Math.min(daysSinceAsked, 14) * 0.7;
  const maturityBonus =
    daysSinceMention >= 0.5 && daysSinceMention <= 21 ? 1.5 : 0;

  return (
    topic.importance * 2 +
    askGapBonus +
    maturityBonus +
    Math.min(topic.mentionCount, 5) * 0.3 -
    topic.askedCount * 1.4
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

  const ranked = topics
    .map((topic) => ({
      topic,
      score: scoreRecallTopic(topic, now),
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
    top.map((_, index) => 3 - index),
  );
}

export function describeRecallTopic(topic: FollowUpTopic): string {
  return `- ${topic.content} [重要度:${topic.importance}, 質問${topic.askedCount}回]`;
}
