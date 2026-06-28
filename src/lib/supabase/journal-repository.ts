import type { DinJournal } from "@/types/journal";
import { normalizeJournalDate } from "@/lib/din/journal-date";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type DinJournalRow = {
  id: string;
  journal_date: string;
  content: string;
  created_at: string;
};

const STALE_LOCK_MS = 5 * 60 * 1000;
const DEFAULT_WAIT_TIMEOUT_MS = 120_000;
const DEFAULT_WAIT_INTERVAL_MS = 500;

function rowToJournal(row: DinJournalRow): DinJournal {
  return {
    id: row.id,
    journalDate: normalizeJournalDate(row.journal_date),
    content: row.content,
    createdAt: row.created_at,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchJournalByDate(
  journalDate: string,
): Promise<DinJournal | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_journals")
    .select("*")
    .eq("journal_date", journalDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? rowToJournal(data as DinJournalRow) : null;
}

export async function fetchJournals(): Promise<DinJournal[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_journals")
    .select("*")
    .order("journal_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => rowToJournal(row as DinJournalRow));
}

export async function clearStaleJournalGenerationLock(
  journalDate: string,
  maxAgeMs = STALE_LOCK_MS,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

  const { error } = await supabase
    .from("din_journal_generation_locks")
    .delete()
    .eq("journal_date", journalDate)
    .lt("created_at", cutoff);

  if (error) {
    throw new Error(error.message);
  }
}

/** journal_date 単位の生成権を原子的に取得する */
export async function tryAcquireJournalGenerationLock(
  journalDate: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("din_journal_generation_locks").insert({
    journal_date: journalDate,
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return false;
  }

  throw new Error(error.message);
}

export async function releaseJournalGenerationLock(
  journalDate: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("din_journal_generation_locks")
    .delete()
    .eq("journal_date", journalDate);

  if (error) {
    throw new Error(error.message);
  }
}

export async function waitForJournalByDate(
  journalDate: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
  },
): Promise<DinJournal | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_WAIT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const journal = await fetchJournalByDate(journalDate);
    if (journal) {
      return journal;
    }

    await sleep(intervalMs);
  }

  return null;
}

export async function insertJournal(input: {
  journalDate: string;
  content: string;
}): Promise<DinJournal> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_journals")
    .insert({
      journal_date: input.journalDate,
      content: input.content.trim(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await fetchJournalByDate(input.journalDate);
      if (existing) return existing;
    }

    throw new Error(error.message);
  }

  return rowToJournal(data as DinJournalRow);
}
