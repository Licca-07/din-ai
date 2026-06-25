import { generateId } from "@/lib/generate-id";
import { clampImportance } from "@/lib/din/memory-priority";
import type { DinMemory } from "@/types/din-memory";
import {
  FOLLOW_UP_MIN_DAYS,
  FOLLOW_UP_MIN_MENTIONS,
  FOLLOW_UP_PROBABILITY,
  type FollowUpRecallInput,
  type FollowUpTopic,
} from "@/types/follow-up";
import type { MemoryItem } from "@/types/memory-item";

const DAY_MS = 24 * 60 * 60 * 1000;

const SKIP_TOPIC_PATTERN =
  /^(こんにちは|おはよう|こんばんは|ありがとう|お疲れ|よろしく|はい|いいえ|うん|ok|OK)[。!！]?$/i;

function normalizeTopicContent(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function getLastTouchedAt(topic: FollowUpTopic): string {
  if (!topic.lastFollowedUpAt) return topic.lastMentionedAt;

  return new Date(topic.lastFollowedUpAt).getTime() >
    new Date(topic.lastMentionedAt).getTime()
    ? topic.lastFollowedUpAt
    : topic.lastMentionedAt;
}

export function normalizeFollowUpTopic(value: unknown): FollowUpTopic | null {
  if (!value || typeof value !== "object") return null;

  const topic = value as Record<string, unknown>;
  const content = typeof topic.content === "string" ? topic.content.trim() : "";

  if (!content || typeof topic.id !== "string") return null;

  const createdAt =
    typeof topic.createdAt === "string" ? topic.createdAt : new Date().toISOString();
  const lastMentionedAt =
    typeof topic.lastMentionedAt === "string" ? topic.lastMentionedAt : createdAt;

  return {
    id: topic.id,
    content,
    importance: clampImportance(
      typeof topic.importance === "number" ? topic.importance : 3,
    ),
    mentionCount:
      typeof topic.mentionCount === "number" && Number.isFinite(topic.mentionCount)
        ? Math.max(0, topic.mentionCount)
        : 1,
    lastMentionedAt,
    lastFollowedUpAt:
      topic.lastFollowedUpAt === null || typeof topic.lastFollowedUpAt === "string"
        ? (topic.lastFollowedUpAt ?? null)
        : null,
    askedCount:
      typeof topic.askedCount === "number" && Number.isFinite(topic.askedCount)
        ? Math.max(0, topic.askedCount)
        : 0,
    createdAt,
    sourceMemoryIds: Array.isArray(topic.sourceMemoryIds)
      ? topic.sourceMemoryIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function extractTopicsFromMessage(message: string): string[] {
  const trimmed = normalizeTopicContent(message);
  if (trimmed.length < 5 || SKIP_TOPIC_PATTERN.test(trimmed)) {
    return [];
  }

  const sentences = trimmed
    .split(/[。！？!?\n]+/)
    .map((sentence) => normalizeTopicContent(sentence))
    .filter((sentence) => sentence.length >= 5 && !SKIP_TOPIC_PATTERN.test(sentence));

  if (sentences.length > 0) {
    return [...new Set(sentences)].slice(0, 3);
  }

  return [trimmed.slice(0, 80)];
}

export function extractTopicsFromMemoryItem(item: MemoryItem): string[] {
  const content = normalizeTopicContent(item.content);
  if (content.length < 5) return [];

  return [content.slice(0, 80)];
}

function upsertRecallTopic(
  topics: FollowUpTopic[],
  input: FollowUpRecallInput,
  now: Date,
  sourceMemoryId?: string,
): FollowUpTopic[] {
  const normalized = normalizeTopicContent(input.content);
  if (normalized.length < 3) return topics;

  const iso = now.toISOString();
  const existing = topics.find(
    (topic) => normalizeTopicContent(topic.content) === normalized,
  );

  if (existing) {
    return topics.map((topic) =>
      topic.id === existing.id
        ? {
            ...topic,
            mentionCount: topic.mentionCount + 1,
            lastMentionedAt: iso,
            sourceMemoryIds: sourceMemoryId
              ? [...new Set([...topic.sourceMemoryIds, sourceMemoryId])]
              : topic.sourceMemoryIds,
          }
        : topic,
    );
  }

  return [
    ...topics,
    {
      id: generateId(),
      content: normalized,
      importance: clampImportance(input.importance ?? 3),
      mentionCount: 1,
      lastMentionedAt: iso,
      lastFollowedUpAt: null,
      askedCount: 0,
      createdAt: iso,
      sourceMemoryIds: sourceMemoryId ? [sourceMemoryId] : [],
    },
  ];
}

export function applyFollowUpRecalls(
  memory: DinMemory,
  entries: FollowUpRecallInput[],
  now = new Date(),
  sourceMemoryId?: string,
): Pick<DinMemory, "followUpTopics"> {
  let followUpTopics = memory.followUpTopics;

  for (const entry of entries) {
    followUpTopics = upsertRecallTopic(
      followUpTopics,
      entry,
      now,
      sourceMemoryId,
    );
  }

  return { followUpTopics };
}

/** 既存 Recall 話題への言及のみカウント（新規話題は Din マーカー経由） */
export function bumpFollowUpMentionsFromMessage(
  memory: DinMemory,
  message: string,
  now = new Date(),
): Pick<DinMemory, "followUpTopics"> {
  if (memory.followUpTopics.length === 0) {
    return { followUpTopics: memory.followUpTopics };
  }

  const normalizedMessage = normalizeTopicContent(message);
  const extracted = extractTopicsFromMessage(message);
  const iso = now.toISOString();

  const followUpTopics = memory.followUpTopics.map((topic) => {
    const normalizedTopic = normalizeTopicContent(topic.content);
    const mentionedByExtract = extracted.some(
      (fragment) =>
        normalizedTopic.includes(normalizeTopicContent(fragment)) ||
        normalizeTopicContent(fragment).includes(normalizedTopic),
    );
    const mentionedDirectly =
      normalizedMessage.includes(normalizedTopic) ||
      normalizedTopic.includes(normalizedMessage);

    if (!mentionedByExtract && !mentionedDirectly) {
      return topic;
    }

    return {
      ...topic,
      mentionCount: topic.mentionCount + 1,
      lastMentionedAt: iso,
    };
  });

  return { followUpTopics };
}

/** @deprecated 新規 Recall は Din マーカーの followUp のみ */
export function applyTopicMentions(
  memory: DinMemory,
  contents: string[],
  now = new Date(),
  sourceMemoryId?: string,
): Pick<DinMemory, "followUpTopics"> {
  let followUpTopics = memory.followUpTopics;

  for (const content of contents) {
    followUpTopics = upsertRecallTopic(
      followUpTopics,
      { content, importance: 3 },
      now,
      sourceMemoryId,
    );
  }

  return { followUpTopics };
}

export function isFollowUpCandidate(
  topic: FollowUpTopic,
  now = new Date(),
): boolean {
  if (topic.mentionCount < FOLLOW_UP_MIN_MENTIONS) return false;
  return daysSince(getLastTouchedAt(topic), now) >= FOLLOW_UP_MIN_DAYS;
}

export function getFollowUpCandidates(
  topics: FollowUpTopic[],
  now = new Date(),
): FollowUpTopic[] {
  return topics.filter((topic) => isFollowUpCandidate(topic, now));
}

export function selectFollowUpTopic(
  candidates: FollowUpTopic[],
  lastFollowUpTopicId: string | null,
): FollowUpTopic | null {
  if (candidates.length === 0) return null;

  const withoutLast = lastFollowUpTopicId
    ? candidates.filter((topic) => topic.id !== lastFollowUpTopicId)
    : candidates;

  const pool = withoutLast.length > 0 ? withoutLast : candidates;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export function shouldAskFollowUp(): boolean {
  return Math.random() < FOLLOW_UP_PROBABILITY;
}

export function resolveFollowUpTopic(memory: DinMemory, now = new Date()) {
  if (!shouldAskFollowUp()) {
    return null;
  }

  const candidates = getFollowUpCandidates(memory.followUpTopics, now);
  return selectFollowUpTopic(candidates, memory.lastFollowUpTopicId);
}

export function markFollowUpAsked(
  memory: DinMemory,
  topicId: string,
  now = new Date(),
): Pick<DinMemory, "followUpTopics" | "lastFollowUpTopicId"> {
  const iso = now.toISOString();

  return {
    lastFollowUpTopicId: topicId,
    followUpTopics: memory.followUpTopics.map((topic) =>
      topic.id === topicId
        ? {
            ...topic,
            lastFollowedUpAt: iso,
            askedCount: topic.askedCount + 1,
          }
        : topic,
    ),
  };
}

export function describeFollowUpTopic(topic: FollowUpTopic): string {
  return `- 話題: ${topic.content}（重要度${topic.importance}, 言及${topic.mentionCount}回, 質問${topic.askedCount}回）`;
}
