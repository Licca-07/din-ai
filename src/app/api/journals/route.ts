import { NextResponse } from "next/server";

import { listJournals } from "@/lib/din/journal-generator";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { JournalListResponse } from "@/types/journal";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase が未設定です。" },
      { status: 503 },
    );
  }

  try {
    const journals = await listJournals();
    return NextResponse.json<JournalListResponse>({ journals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "日記の取得に失敗しました。";
    console.error("[GET /api/journals]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
