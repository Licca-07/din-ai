import type { ProactiveOpener } from "@/lib/din/proactive-opener";
import type { ConversationStance } from "@/lib/din/conversation-stance";
import type { DinSessionContext } from "@/lib/din/session-context";
import type { FollowUpRecallInput } from "@/types/follow-up";
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
  newFollowUpRecalls?: FollowUpRecallInput[];
  referencedMemoryIds?: string[];
  followUpTopicId?: string;
  /** サーバー側 intent 判定（挙動確認用） */
  conversationIntent?: ConversationStance["intent"];
};

export type ChatErrorResponse = {
  error: string;
};
