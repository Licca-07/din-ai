export type DinJournal = {
  id: string;
  journalDate: string;
  content: string;
  createdAt: string;
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
