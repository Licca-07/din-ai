import type { StoredChatMessage } from "@/types/din-memory";
import type { DinMemory, DinMemoryProfile } from "@/types/din-memory";
import type {
  MemoryImportance,
  MemoryItem,
  MemoryItemKind,
} from "@/types/memory-item";
import type { FollowUpTopic } from "@/types/follow-up";
import type { UserProfile } from "@/types/user-profile";

export const SAMPLE_USER_PROFILE: UserProfile = {
  occupation: "専門記者",
  hobbies: ["音楽", "映画", "読書", "料理"],
  favoriteFoods: ["寿司", "ドーナツ"],
};

export const DEFAULT_MEMORY: DinMemory = {
  profile: SAMPLE_USER_PROFILE,
  conversationCount: 0,
  lastConversationAt: null,
  chatHistory: [],
  longTermMemories: [],
  shortTermMemories: [],
  followUpTopics: [],
  lastFollowUpTopicId: null,
};

function isValidImportance(value: unknown): value is MemoryImportance {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isValidMemoryItemKind(value: unknown): value is MemoryItemKind {
  return value === "long_term" || value === "short_term";
}

function isValidFollowUpTopic(value: unknown): value is FollowUpTopic {
  if (!value || typeof value !== "object") return false;

  const topic = value as Record<string, unknown>;

  return (
    typeof topic.id === "string" &&
    typeof topic.content === "string" &&
    topic.content.trim().length > 0 &&
    typeof topic.mentionCount === "number" &&
    Number.isFinite(topic.mentionCount) &&
    topic.mentionCount >= 0 &&
    typeof topic.lastMentionedAt === "string" &&
    typeof topic.createdAt === "string" &&
    (topic.lastFollowedUpAt === null ||
      typeof topic.lastFollowedUpAt === "string") &&
    Array.isArray(topic.sourceMemoryIds) &&
    topic.sourceMemoryIds.every((id) => typeof id === "string")
  );
}

export function isValidMemoryItem(value: unknown): value is MemoryItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    isValidMemoryItemKind(item.kind) &&
    typeof item.content === "string" &&
    item.content.trim().length > 0 &&
    isValidImportance(item.importance) &&
    typeof item.lastReferencedAt === "string" &&
    typeof item.createdAt === "string" &&
    (item.expiresAt === null || typeof item.expiresAt === "string") &&
    (item.embedding === null ||
      (Array.isArray(item.embedding) &&
        item.embedding.every((entry) => typeof entry === "number"))) &&
    typeof item.metadata === "object" &&
    item.metadata !== null &&
    (item.source === "profile" ||
      item.source === "conversation" ||
      item.source === "manual") &&
    typeof item.category === "string"
  );
}

export function isValidStoredMessage(value: unknown): value is StoredChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    (message.remembered === undefined || typeof message.remembered === "boolean")
  );
}

export function isValidProfile(value: unknown): value is DinMemoryProfile {
  if (!value || typeof value !== "object") return false;

  const profile = value as Record<string, unknown>;

  return (
    typeof profile.occupation === "string" &&
    Array.isArray(profile.hobbies) &&
    profile.hobbies.every((item) => typeof item === "string") &&
    Array.isArray(profile.favoriteFoods) &&
    profile.favoriteFoods.every((item) => typeof item === "string")
  );
}

export function normalizeMemory(value: Partial<DinMemory>): DinMemory {
  return {
    profile: value.profile ?? DEFAULT_MEMORY.profile,
    conversationCount: value.conversationCount ?? 0,
    lastConversationAt: value.lastConversationAt ?? null,
    chatHistory: value.chatHistory ?? [],
    longTermMemories: value.longTermMemories ?? [],
    shortTermMemories: value.shortTermMemories ?? [],
    followUpTopics: value.followUpTopics ?? [],
    lastFollowUpTopicId: value.lastFollowUpTopicId ?? null,
  };
}

export function isValidMemory(value: unknown): value is DinMemory {
  if (!value || typeof value !== "object") return false;

  const memory = value as Record<string, unknown>;

  return (
    isValidProfile(memory.profile) &&
    typeof memory.conversationCount === "number" &&
    Number.isFinite(memory.conversationCount) &&
    memory.conversationCount >= 0 &&
    (memory.lastConversationAt === null ||
      typeof memory.lastConversationAt === "string") &&
    Array.isArray(memory.chatHistory) &&
    memory.chatHistory.every(isValidStoredMessage) &&
    Array.isArray(memory.longTermMemories) &&
    memory.longTermMemories.every(isValidMemoryItem) &&
    Array.isArray(memory.shortTermMemories) &&
    memory.shortTermMemories.every(isValidMemoryItem) &&
    Array.isArray(memory.followUpTopics) &&
    memory.followUpTopics.every(isValidFollowUpTopic) &&
    (memory.lastFollowUpTopicId === null ||
      typeof memory.lastFollowUpTopicId === "string")
  );
}

export function normalizePartialMemory(value: unknown): DinMemory | null {
  if (!value || typeof value !== "object") return null;

  const memory = value as Partial<DinMemory>;
  if (!isValidProfile(memory.profile)) return null;

  return normalizeMemory({
    profile: memory.profile,
    conversationCount:
      typeof memory.conversationCount === "number" &&
      Number.isFinite(memory.conversationCount)
        ? Math.max(0, memory.conversationCount)
        : 0,
    lastConversationAt:
      memory.lastConversationAt === null ||
      typeof memory.lastConversationAt === "string"
        ? (memory.lastConversationAt ?? null)
        : null,
    chatHistory: Array.isArray(memory.chatHistory)
      ? memory.chatHistory.filter(isValidStoredMessage)
      : [],
    longTermMemories: Array.isArray(memory.longTermMemories)
      ? memory.longTermMemories.filter(isValidMemoryItem)
      : [],
    shortTermMemories: Array.isArray(memory.shortTermMemories)
      ? memory.shortTermMemories.filter(isValidMemoryItem)
      : [],
    followUpTopics: Array.isArray(memory.followUpTopics)
      ? memory.followUpTopics.filter(isValidFollowUpTopic)
      : [],
    lastFollowUpTopicId:
      memory.lastFollowUpTopicId === null ||
      typeof memory.lastFollowUpTopicId === "string"
        ? (memory.lastFollowUpTopicId ?? null)
        : null,
  });
}

export function parseMemory(value: unknown): DinMemory | null {
  if (isValidMemory(value)) {
    return value;
  }

  return normalizePartialMemory(value);
}

export function hasStoredMemoryData(memory: DinMemory): boolean {
  return (
    memory.chatHistory.length > 0 ||
    memory.longTermMemories.length > 0 ||
    memory.shortTermMemories.length > 0 ||
    memory.conversationCount > 0 ||
    memory.lastConversationAt !== null ||
    memory.followUpTopics.length > 0 ||
    memory.profile.occupation.trim().length > 0 ||
    memory.profile.hobbies.length > 0 ||
    memory.profile.favoriteFoods.length > 0
  );
}
