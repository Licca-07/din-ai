import { NextResponse } from "next/server";

import { getJournalDateJst } from "@/lib/din/journal-date";
import { fetchJournalByDate } from "@/lib/supabase/journal-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { JournalTodayResponse } from "@/types/journal";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase が未設定です。" },
      { status: 503 },
    );
  }

  try {
    const journalDate = getJournalDateJst();
    const journal = await fetchJournalByDate(journalDate);

    return NextResponse.json<JournalTodayResponse>({
      journalDate,
      journal,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "日記の取得に失敗しました。";
    console.error("[GET /api/journals/today]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
