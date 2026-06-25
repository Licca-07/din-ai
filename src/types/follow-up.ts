import type { MemoryImportance } from "@/types/memory-item";

/** Memory Recall 用フォローアップ記憶 */
export type FollowUpTopic = {
  id: string;
  /** 話題の要約（例: Vercel公開） */
  content: string;
  /** Din が判断した重要度（1〜5） */
  importance: MemoryImportance;
  mentionCount: number;
  /** 最後にユーザーが触れた日時 */
  lastMentionedAt: string;
  /** 最後に Din が質問した日時（lastAskedAt） */
  lastFollowedUpAt: string | null;
  /** Din が質問した回数 */
  askedCount: number;
  createdAt: string;
  sourceMemoryIds: string[];
};

export type FollowUpRecallInput = {
  content: string;
  importance?: MemoryImportance;
};

export const FOLLOW_UP_MIN_MENTIONS = 3;
export const FOLLOW_UP_MIN_DAYS = 3;
export const FOLLOW_UP_PROBABILITY = 0.2;

export const RECALL_MIN_DAYS_BETWEEN_ASKS = 1;
export const RECALL_MIN_SCORE = 1;
