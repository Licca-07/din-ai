import { generateId } from "@/lib/generate-id";
import type { DinMemory } from "@/types/din-memory";
import {
  FOLLOW_UP_MIN_DAYS,
  FOLLOW_UP_MIN_MENTIONS,
  FOLLOW_UP_PROBABILITY,
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

function upsertTopic(
  topics: FollowUpTopic[],
  content: string,
  now: Date,
  sourceMemoryId?: string,
): FollowUpTopic[] {
  const normalized = normalizeTopicContent(content);
  if (normalized.length < 5) return topics;

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
      mentionCount: 1,
      lastMentionedAt: iso,
      lastFollowedUpAt: null,
      createdAt: iso,
      sourceMemoryIds: sourceMemoryId ? [sourceMemoryId] : [],
    },
  ];
}

export function applyTopicMentions(
  memory: DinMemory,
  contents: string[],
  now = new Date(),
  sourceMemoryId?: string,
): Pick<DinMemory, "followUpTopics"> {
  let followUpTopics = memory.followUpTopics;

  for (const content of contents) {
    followUpTopics = upsertTopic(followUpTopics, content, now, sourceMemoryId);
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
        ? { ...topic, lastFollowedUpAt: iso }
        : topic,
    ),
  };
}

export function describeFollowUpTopic(topic: FollowUpTopic): string {
  return `- 話題: ${topic.content}（言及${topic.mentionCount}回）`;
}
