import { buildPromptMemorySection } from "@/lib/din/memory-priority";
import { describeUserProfile } from "@/lib/din/memory";
import {
  getRelationshipFromCount,
  getRelationshipLabel,
  type DinRelationship,
} from "@/lib/din/session-context";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

export type MemoryBookContext = {
  profile: UserProfile;
  conversationCount: number;
  relationship: DinRelationship;
  longTermMemories: MemoryItem[];
  shortTermMemories: MemoryItem[];
};

export type MemoryPromptResult = {
  text: string;
  referencedMemoryIds: string[];
};

export function buildMemoryBookContext(
  profile: UserProfile,
  conversationCount: number,
  longTermMemories: MemoryItem[] = [],
  shortTermMemories: MemoryItem[] = [],
): MemoryBookContext {
  return {
    profile,
    conversationCount,
    relationship: getRelationshipFromCount(conversationCount),
    longTermMemories,
    shortTermMemories,
  };
}

function describeRelationshipSection(
  conversationCount: number,
  relationship: DinRelationship,
): string {
  return [
    `- 会話回数: ${conversationCount}回`,
    `- 現在の関係性: ${getRelationshipLabel(relationship)}`,
  ].join("\n");
}

function buildPromptSelection(
  context: MemoryBookContext,
  now?: Date,
): MemoryPromptResult {
  return buildPromptMemorySection({
    profileSection: describeUserProfile(context.profile),
    relationshipSection: describeRelationshipSection(
      context.conversationCount,
      context.relationship,
    ),
    longTermMemories: context.longTermMemories,
    shortTermMemories: context.shortTermMemories,
    now,
  });
}

export function buildMemoryPrompt(context: MemoryBookContext, now?: Date) {
  const selection = buildPromptSelection(context, now);

  return {
    context,
    text: selection.text,
    referencedMemoryIds: selection.referencedMemoryIds,
  };
}

export function describeMemoryBook(context: MemoryBookContext): string {
  return buildPromptSelection(context).text;
}
