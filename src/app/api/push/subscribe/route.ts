import { NextResponse } from "next/server";
import type { StoredPushSubscription } from "@/types/push-subscription";

import { upsertPushSubscription } from "@/lib/supabase/push-subscription-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isWebPushConfigured } from "@/lib/push/vapid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Push 通知のサーバー設定が未完了です。" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      subscription?: StoredPushSubscription;
    };
    const subscription = body.subscription;

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { error: "subscription が不正です。" },
        { status: 400 },
      );
    }

    await upsertPushSubscription(
      subscription,
      request.headers.get("user-agent"),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Push 登録に失敗しました。";
    console.error("[POST /api/push/subscribe]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
