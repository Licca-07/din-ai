import { getJournalDateJst } from "@/lib/din/journal-date";
import {
  buildJournalUserPrompt,
  JOURNAL_SYSTEM_PROMPT,
} from "@/lib/prompts/din-journal-prompt";
import { fetchMemoryFromSupabase } from "@/lib/supabase/memory-repository";
import {
  clearStaleJournalGenerationLock,
  fetchJournalByDate,
  fetchJournals,
  insertJournal,
  releaseJournalGenerationLock,
  tryAcquireJournalGenerationLock,
  waitForJournalByDate,
} from "@/lib/supabase/journal-repository";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
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

    const { memory } = await fetchMemoryFromSupabase();
    const recentMessages = memory.chatHistory.slice(-20);

    if (recentMessages.length === 0) {
      return { created: false, skipped: true, reason: "no_chat_history" };
    }

    const openai = getOpenAIClient();
    const model = getOpenAIModel();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: JOURNAL_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildJournalUserPrompt({
            journalDate,
            profile: memory.profile,
            recentMessages,
            longTermMemories: memory.longTermMemories,
            shortTermMemories: memory.shortTermMemories,
          }),
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("日記本文を生成できませんでした。");
    }

    const journal = await insertJournal({ journalDate, content });

    return { created: true, journal };
  } finally {
    await releaseJournalGenerationLock(journalDate);
  }
}

export async function listJournals() {
  return fetchJournals();
}
