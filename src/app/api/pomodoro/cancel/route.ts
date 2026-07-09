import { NextResponse } from "next/server";

import { cancelPendingPomodoroNotifications } from "@/lib/supabase/pomodoro-schedule-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase が未設定です。" },
      { status: 503 },
    );
  }

  try {
    await cancelPendingPomodoroNotifications();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "通知の取消に失敗しました。";
    console.error("[POST /api/pomodoro/cancel]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
