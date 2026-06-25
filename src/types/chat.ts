import type { ProactiveOpener } from "@/lib/din/proactive-opener";
import type { DinSessionContext } from "@/lib/din/session-context";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequestBody = {
  messages: ChatMessage[];
  sessionContext?: DinSessionContext;
  userProfile?: UserProfile;
  longTermMemories?: MemoryItem[];
  shortTermMemories?: MemoryItem[];
  requestGreeting?: boolean;
  followUpTopic?: string;
  followUpTopicId?: string;
  proactiveOpener?: ProactiveOpener;
};

export type ChatResponseBody = {
  message: ChatMessage;
  remembered?: boolean;
  userProfile?: UserProfile;
  newMemoryItems?: MemoryItem[];
  referencedMemoryIds?: string[];
  followUpTopicId?: string;
};

export type ChatErrorResponse = {
  error: string;
};
