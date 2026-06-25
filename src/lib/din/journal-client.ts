import { getJournalDateJst } from "@/lib/din/journal-date";
import type { DinJournal } from "@/types/journal";

export type TodayJournalSnapshot = {
  journalDate: string;
  journal: DinJournal | null;
};

let todaySnapshot: TodayJournalSnapshot | null = null;
let allJournals: DinJournal[] | null = null;

let todayRequest: Promise<TodayJournalSnapshot> | null = null;
let allRequest: Promise<DinJournal[]> | null = null;
let generateRequest: Promise<TodayJournalSnapshot> | null = null;
let generateRequestDate: string | null = null;

function syncTodayFromAll(journalDate: string): void {
  if (!allJournals) return;

  todaySnapshot = {
    journalDate,
    journal:
      allJournals.find((journal) => journal.journalDate === journalDate) ?? null,
  };
}

function syncAllFromToday(snapshot: TodayJournalSnapshot): void {
  if (!snapshot.journal) return;
  if (!allJournals) {
    allJournals = [snapshot.journal];
    return;
  }

  const index = allJournals.findIndex(
    (journal) => journal.journalDate === snapshot.journalDate,
  );

  if (index === -1) {
    allJournals = [snapshot.journal, ...allJournals];
    return;
  }

  allJournals = allJournals.map((journal, currentIndex) =>
    currentIndex === index ? snapshot.journal! : journal,
  );
}

export function invalidateJournalCache(): void {
  todaySnapshot = null;
  allJournals = null;
}

export async function fetchTodayJournal(options?: {
  force?: boolean;
}): Promise<TodayJournalSnapshot> {
  const journalDate = getJournalDateJst();

  if (
    !options?.force &&
    todaySnapshot &&
    todaySnapshot.journalDate === journalDate
  ) {
    return todaySnapshot;
  }

  if (todayRequest) {
    return todayRequest;
  }

  todayRequest = (async () => {
    try {
      const response = await fetch("/api/journals/today", { cache: "no-store" });
      const data = (await response.json()) as
        | TodayJournalSnapshot
        | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in data ? data.error : "日記の取得に失敗しました。",
        );
      }

      if (!("journalDate" in data)) {
        throw new Error("日記の形式が正しくありません。");
      }

      todaySnapshot = {
        journalDate: data.journalDate,
        journal: data.journal,
      };
      syncAllFromToday(todaySnapshot);

      return todaySnapshot;
    } finally {
      todayRequest = null;
    }
  })();

  return todayRequest;
}

export async function fetchAllJournals(options?: {
  force?: boolean;
}): Promise<DinJournal[]> {
  if (!options?.force && allJournals) {
    return allJournals;
  }

  if (allRequest) {
    return allRequest;
  }

  allRequest = (async () => {
    try {
      const response = await fetch("/api/journals", { cache: "no-store" });
      const data = (await response.json()) as
        | { journals: DinJournal[] }
        | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in data ? data.error : "日記の取得に失敗しました。",
        );
      }

      allJournals = "journals" in data ? data.journals : [];
      syncTodayFromAll(getJournalDateJst());

      return allJournals;
    } finally {
      allRequest = null;
    }
  })();

  return allRequest;
}

/** 起動時に1日1回だけ生成し、当日日記を1回だけ取得する */
export async function ensureDailyJournal(
  onUpdated?: () => void,
): Promise<TodayJournalSnapshot> {
  const journalDate = getJournalDateJst();

  if (generateRequest && generateRequestDate === journalDate) {
    return generateRequest;
  }

  generateRequest = (async () => {
    try {
      await fetch("/api/journals/generate", { method: "POST" });
      invalidateJournalCache();
      onUpdated?.();
      return fetchTodayJournal({ force: true });
    } catch {
      invalidateJournalCache();
      return fetchTodayJournal({ force: true });
    } finally {
      generateRequest = null;
    }
  })();

  generateRequestDate = journalDate;
  return generateRequest;
}
