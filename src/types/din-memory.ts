import type { ChatRole } from "@/types/chat";
import type { FollowUpTopic } from "@/types/follow-up";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

export type StoredChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  remembered?: boolean;
};

export type DinMemoryProfile = UserProfile;

export type DinMemory = {
  profile: DinMemoryProfile;
  conversationCount: number;
  lastConversationAt: string | null;
  chatHistory: StoredChatMessage[];
  longTermMemories: MemoryItem[];
  shortTermMemories: MemoryItem[];
  followUpTopics: FollowUpTopic[];
  lastFollowUpTopicId: string | null;
  lastAppOpenedAt: string | null;
  lastStartupMessage: string | null;
};

export type DinMemoryTab = "chat" | "memory";
