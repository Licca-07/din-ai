import type { DinMemory } from "@/types/din-memory";

export const MEMORY_SYNC_TEST_MARKER = "din-ai-sync-test";

export function createMemorySyncTestPayload(runId: string): DinMemory {
  const now = new Date().toISOString();

  return {
    profile: {
      occupation: `${MEMORY_SYNC_TEST_MARKER}:${runId}`,
      hobbies: ["sync-test"],
      favoriteFoods: ["verification"],
    },
    conversationCount: 7,
    lastConversationAt: now,
    chatHistory: [
      {
        id: `test-user-${runId}`,
        role: "user",
        content: `${MEMORY_SYNC_TEST_MARKER} hello ${runId}`,
      },
      {
        id: `test-assistant-${runId}`,
        role: "assistant",
        content: `${MEMORY_SYNC_TEST_MARKER} ack ${runId}`,
      },
    ],
    longTermMemories: [
      {
        id: `test-long-${runId}`,
        kind: "long_term",
        content: `${MEMORY_SYNC_TEST_MARKER} long-term ${runId}`,
        importance: 3,
        lastReferencedAt: now,
        createdAt: now,
        expiresAt: null,
        embedding: null,
        metadata: { test: runId },
        source: "manual",
        category: "general",
      },
    ],
    shortTermMemories: [
      {
        id: `test-short-${runId}`,
        kind: "short_term",
        content: `${MEMORY_SYNC_TEST_MARKER} short-term ${runId}`,
        importance: 2,
        lastReferencedAt: now,
        createdAt: now,
        expiresAt: null,
        embedding: null,
        metadata: { test: runId },
        source: "manual",
        category: "general",
      },
    ],
    followUpTopics: [],
    lastFollowUpTopicId: null,
    lastAppOpenedAt: null,
    lastStartupMessage: null,
  };
}

export type MemorySyncAssertions = {
  runId: string;
  memory: DinMemory;
};

export function assertMemorySyncPayload({
  runId,
  memory,
}: MemorySyncAssertions): string[] {
  const failures: string[] = [];

  if (memory.conversationCount !== 7) {
    failures.push(
      `conversationCount: expected 7, got ${memory.conversationCount}`,
    );
  }

  if (memory.chatHistory.length !== 2) {
    failures.push(
      `chatHistory.length: expected 2, got ${memory.chatHistory.length}`,
    );
  }

  if (memory.longTermMemories.length !== 1) {
    failures.push(
      `longTermMemories.length: expected 1, got ${memory.longTermMemories.length}`,
    );
  }

  if (memory.shortTermMemories.length !== 1) {
    failures.push(
      `shortTermMemories.length: expected 1, got ${memory.shortTermMemories.length}`,
    );
  }

  if (!memory.profile.occupation.includes(runId)) {
    failures.push(`profile.occupation does not include runId (${runId})`);
  }

  if (!memory.chatHistory.some((message) => message.content.includes(runId))) {
    failures.push(`chatHistory does not include runId (${runId})`);
  }

  if (!memory.lastConversationAt) {
    failures.push("lastConversationAt is empty");
  }

  return failures;
}

export function formatMemorySummary(memory: DinMemory): string {
  return [
    `conversationCount=${memory.conversationCount}`,
    `chatHistory=${memory.chatHistory.length}`,
    `longTerm=${memory.longTermMemories.length}`,
    `shortTerm=${memory.shortTermMemories.length}`,
    `occupation=${memory.profile.occupation}`,
    `lastConversationAt=${memory.lastConversationAt ?? "null"}`,
  ].join(", ");
}
