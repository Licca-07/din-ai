/** フォローアップ（過去の話題を自然に尋ねる）用の話題 */
export type FollowUpTopic = {
  id: string;
  /** 話題の要約（例: Din AIを開発している） */
  content: string;
  mentionCount: number;
  lastMentionedAt: string;
  lastFollowedUpAt: string | null;
  createdAt: string;
  /** 将来: 関連 MemoryItem の id */
  sourceMemoryIds: string[];
};

export const FOLLOW_UP_MIN_MENTIONS = 3;
export const FOLLOW_UP_MIN_DAYS = 3;
export const FOLLOW_UP_PROBABILITY = 0.2;
