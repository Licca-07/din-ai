import { NextResponse } from "next/server";

import { isWebPushConfigured } from "@/lib/push/vapid";
import { schedulePomodoroNotification } from "@/lib/supabase/pomodoro-schedule-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isWebPushConfigured()) {
    return NextResponse.json(
      { error: "サーバー通知が未設定です。" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      endsAt?: number;
      title?: string;
      body?: string;
    };

    if (
      typeof body.endsAt !== "number" ||
      typeof body.title !== "string" ||
      typeof body.body !== "string"
    ) {
      return NextResponse.json(
        { error: "endsAt, title, body が必要です。" },
        { status: 400 },
      );
    }

    const scheduled = await schedulePomodoroNotification({
      notifyAt: new Date(body.endsAt).toISOString(),
      title: body.title,
      body: body.body,
    });

    return NextResponse.json({ ok: true, scheduled });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "通知の予約に失敗しました。";
    console.error("[POST /api/pomodoro/schedule]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
