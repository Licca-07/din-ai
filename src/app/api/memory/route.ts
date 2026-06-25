import { NextResponse } from "next/server";

import { parseMemory } from "@/lib/din/memory-schema";
import {
  deleteMemoryFromSupabase,
  fetchMemoryFromSupabase,
  upsertMemoryToSupabase,
} from "@/lib/supabase/memory-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    {
      error:
        "Supabase が未設定です。SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に追加してください。",
    },
    { status: 503 },
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const result = await fetchMemoryFromSupabase();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "記憶の取得に失敗しました。";
    console.error("[GET /api/memory]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const body = (await request.json()) as { memory?: unknown };
    const parsed = parseMemory(body.memory);

    if (!parsed) {
      return NextResponse.json(
        { error: "memory の形式が正しくありません。" },
        { status: 400 },
      );
    }

    const memory = await upsertMemoryToSupabase(parsed);
    return NextResponse.json({ memory });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "記憶の保存に失敗しました。";
    console.error("[PUT /api/memory]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const memory = await deleteMemoryFromSupabase();
    return NextResponse.json({ memory });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "記憶の削除に失敗しました。";
    console.error("[DELETE /api/memory]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
