import { NextResponse } from "next/server";

import { generateDailyJournalIfNeeded } from "@/lib/din/journal-generator";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { JournalGenerateResponse } from "@/types/journal";

export const runtime = "nodejs";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase が未設定です。" },
      { status: 503 },
    );
  }

  try {
    const result = await generateDailyJournalIfNeeded();
    return NextResponse.json<JournalGenerateResponse>(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "日記の生成に失敗しました。";
    console.error("[POST /api/journals/generate]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
