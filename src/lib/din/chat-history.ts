export {
  loadChatHistory,
  saveChatHistory,
} from "@/lib/din/memory";

export type { StoredChatMessage } from "@/types/din-memory";

/** @deprecated Use MEMORY_KEY from memory.ts */
export const CHAT_HISTORY_KEY = "din-ai-chat-history";
