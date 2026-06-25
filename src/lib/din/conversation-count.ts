export {
  incrementConversationCount,
  loadConversationCount,
  saveConversationCount,
  syncConversationCountFromHistory,
} from "@/lib/din/memory";

/** @deprecated Use MEMORY_KEY from memory.ts */
export const CONVERSATION_COUNT_KEY = "din-ai-conversation-count";
