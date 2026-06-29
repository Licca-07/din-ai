import {
  DEFAULT_JOURNAL_CONTINUITY,
  normalizeContinuityState,
} from "@/lib/din/journal-continuity";
import type { DinJournalContinuityState } from "@/types/journal";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ContinuityRow = {
  id: string;
  last_margin_date: string | null;
  next_margin_on_or_after: string | null;
  ongoing_thread: string | null;
  looking_forward: string | null;
  recent_margin_texts: unknown;
  updated_at: string;
};

function rowToState(row: ContinuityRow): DinJournalContinuityState {
  const recentRaw = row.recent_margin_texts;
  const recentMarginTexts = Array.isArray(recentRaw)
    ? recentRaw.filter((value): value is string => typeof value === "string")
    : [];

  return normalizeContinuityState({
    lastMarginDate: row.last_margin_date,
    nextMarginOnOrAfter: row.next_margin_on_or_after,
    ongoingThread: row.ongoing_thread,
    lookingForward: row.looking_forward,
    recentMarginTexts,
  });
}

export async function fetchJournalContinuity(): Promise<DinJournalContinuityState> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("din_journal_continuity")
    .select("*")
    .eq("id", "single")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { ...DEFAULT_JOURNAL_CONTINUITY };
  }

  return rowToState(data as ContinuityRow);
}

export async function saveJournalContinuity(
  state: DinJournalContinuityState,
): Promise<DinJournalContinuityState> {
  const normalized = normalizeContinuityState(state);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("din_journal_continuity")
    .upsert({
      id: "single",
      last_margin_date: normalized.lastMarginDate,
      next_margin_on_or_after: normalized.nextMarginOnOrAfter,
      ongoing_thread: normalized.ongoingThread,
      looking_forward: normalized.lookingForward,
      recent_margin_texts: normalized.recentMarginTexts,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToState(data as ContinuityRow);
}
