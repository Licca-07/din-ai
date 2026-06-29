export type DinJournal = {
  id: string;
  journalDate: string;
  content: string;
  /** Din 自身の生活を描く短い余白（60〜100字）。2〜3日に1回 */
  margin: string | null;
  createdAt: string;
};

/** 余白生成の継続状態（将来: 天気・気分・季節なども拡張可能） */
export type DinJournalContinuityState = {
  lastMarginDate: string | null;
  nextMarginOnOrAfter: string | null;
  ongoingThread: string | null;
  lookingForward: string | null;
  recentMarginTexts: string[];
};

/** generateDinDiary への拡張用コンテキスト */
export type DinDiaryWorldContext = {
  weather?: string;
  mood?: string;
  season?: string;
};

export type JournalListResponse = {
  journals: DinJournal[];
};

export type JournalGenerateResponse = {
  created: boolean;
  skipped?: boolean;
  reason?: string;
  journal?: DinJournal;
};

export type JournalTodayResponse = {
  journalDate: string;
  journal: DinJournal | null;
};
