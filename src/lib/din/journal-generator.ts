import { getJournalDateJst } from "@/lib/din/journal-date";
import { getChatMessageDayKey } from "@/lib/din/chat-message-time";
import { generateDinDiary } from "@/lib/din/din-diary-generator";
import { fetchMemoryFromSupabase } from "@/lib/supabase/memory-repository";
import {
  fetchJournalContinuity,
  saveJournalContinuity,
} from "@/lib/supabase/journal-continuity-repository";
import {
  clearStaleJournalGenerationLock,
  fetchJournalByDate,
  fetchJournals,
  insertJournal,
  releaseJournalGenerationLock,
  tryAcquireJournalGenerationLock,
  waitForJournalByDate,
} from "@/lib/supabase/journal-repository";
import type { JournalGenerateResponse } from "@/types/journal";

async function waitForExistingJournal(journalDate: string) {
  const journal = await waitForJournalByDate(journalDate);
  if (journal) {
    return { created: false, journal } satisfies JournalGenerateResponse;
  }

  await clearStaleJournalGenerationLock(journalDate);
  throw new Error("日記生成の完了を待機中にタイムアウトしました。");
}

export async function generateDailyJournalIfNeeded(
  journalDate = getJournalDateJst(),
): Promise<JournalGenerateResponse> {
  const existing = await fetchJournalByDate(journalDate);
  if (existing) {
    return { created: false, journal: existing };
  }

  await clearStaleJournalGenerationLock(journalDate);

  const acquired = await tryAcquireJournalGenerationLock(journalDate);
  if (!acquired) {
    return waitForExistingJournal(journalDate);
  }

  try {
    const existingAfterLock = await fetchJournalByDate(journalDate);
    if (existingAfterLock) {
      return { created: false, journal: existingAfterLock };
    }

    const [{ memory }, continuity] = await Promise.all([
      fetchMemoryFromSupabase(),
      fetchJournalContinuity(),
    ]);

    const messagesForDay = memory.chatHistory.filter(
      (message) => getChatMessageDayKey(message.createdAt) === journalDate,
    );
    const recentMessages =
      messagesForDay.length > 0
        ? messagesForDay.slice(-20)
        : memory.chatHistory.slice(-20);

    if (recentMessages.length === 0) {
      return { created: false, skipped: true, reason: "no_chat_history" };
    }

    const diary = await generateDinDiary({
      journalDate,
      profile: memory.profile,
      recentMessages,
      longTermMemories: memory.longTermMemories,
      shortTermMemories: memory.shortTermMemories,
      continuity,
    });

    const journal = await insertJournal({
      journalDate,
      content: diary.conversationContent,
      margin: diary.margin,
    });

    if (diary.margin) {
      await saveJournalContinuity(diary.continuity);
    }

    return { created: true, journal };
  } finally {
    await releaseJournalGenerationLock(journalDate);
  }
}

export async function listJournals() {
  return fetchJournals();
}

export { generateDinDiary } from "@/lib/din/din-diary-generator";
