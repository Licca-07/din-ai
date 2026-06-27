import {
  DEFAULT_MEMORY,
  normalizeMemory,
  parseMemory,
} from "@/lib/din/memory-schema";
import type { DinMemory } from "@/types/din-memory";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const SINGLETON_MEMORY_ID = "single";

type DinMemoryRow = {
  id: string;
  profile: DinMemory["profile"];
  conversation_count: number;
  last_conversation_at: string | null;
  last_app_opened_at: string | null;
  last_startup_message: string | null;
  chat_history: DinMemory["chatHistory"];
  long_term_memories: DinMemory["longTermMemories"];
  short_term_memories: DinMemory["shortTermMemories"];
  follow_up_topics: DinMemory["followUpTopics"];
  last_follow_up_topic_id: string | null;
  updated_at: string;
};

function rowToMemory(row: DinMemoryRow): DinMemory | null {
  return parseMemory({
    profile: row.profile,
    conversationCount: row.conversation_count,
    lastConversationAt: row.last_conversation_at,
    chatHistory: row.chat_history,
    longTermMemories: row.long_term_memories,
    shortTermMemories: row.short_term_memories,
    followUpTopics: row.follow_up_topics,
    lastFollowUpTopicId: row.last_follow_up_topic_id,
    lastAppOpenedAt: row.last_app_opened_at ?? null,
    lastStartupMessage: row.last_startup_message ?? null,
  });
}

function memoryToRow(memory: DinMemory): Omit<DinMemoryRow, "updated_at"> {
  return {
    id: SINGLETON_MEMORY_ID,
    profile: memory.profile,
    conversation_count: memory.conversationCount,
    last_conversation_at: memory.lastConversationAt,
    chat_history: memory.chatHistory,
    long_term_memories: memory.longTermMemories,
    short_term_memories: memory.shortTermMemories,
    follow_up_topics: memory.followUpTopics,
    last_follow_up_topic_id: memory.lastFollowUpTopicId,
    last_app_opened_at: memory.lastAppOpenedAt,
    last_startup_message: memory.lastStartupMessage,
  };
}

export type FetchMemoryResult = {
  exists: boolean;
  memory: DinMemory;
};

export async function fetchMemoryFromSupabase(): Promise<FetchMemoryResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_memory")
    .select("*")
    .eq("id", SINGLETON_MEMORY_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { exists: false, memory: DEFAULT_MEMORY };
  }

  const memory = rowToMemory(data as DinMemoryRow);
  if (!memory) {
    throw new Error("Supabase の記憶データ形式が不正です。");
  }

  return { exists: true, memory };
}

export async function upsertMemoryToSupabase(memory: DinMemory): Promise<DinMemory> {
  const normalized = parseMemory(memory) ?? normalizeMemory(memory);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_memory")
    .upsert({
      ...memoryToRow(normalized),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const saved = rowToMemory(data as DinMemoryRow);
  if (!saved) {
    throw new Error("Supabase への保存後のデータ形式が不正です。");
  }

  return saved;
}

export async function deleteMemoryFromSupabase(): Promise<DinMemory> {
  return upsertMemoryToSupabase(normalizeMemory(DEFAULT_MEMORY));
}
