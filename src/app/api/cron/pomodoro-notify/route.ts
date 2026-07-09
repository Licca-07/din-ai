import { NextResponse } from "next/server";

import { sendWebPushNotification } from "@/lib/push/web-push-server";
import { isWebPushConfigured } from "@/lib/push/vapid";
import {
  fetchDuePomodoroNotifications,
  markPomodoroNotificationSent,
} from "@/lib/supabase/pomodoro-schedule-repository";
import { fetchPushSubscriptions } from "@/lib/supabase/push-subscription-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Push 通知のサーバー設定が未完了です。" },
      { status: 503 },
    );
  }

  try {
    const dueNotifications = await fetchDuePomodoroNotifications();
    const subscriptions = await fetchPushSubscriptions();

    if (dueNotifications.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, due: 0 });
    }

    let sentCount = 0;

    for (const notification of dueNotifications) {
      if (subscriptions.length === 0) {
        await markPomodoroNotificationSent(notification.id);
        continue;
      }

      let delivered = false;

      for (const subscription of subscriptions) {
        try {
          await sendWebPushNotification(subscription, {
            title: notification.title,
            body: notification.body,
            url: "/",
            tag: "din-pomodoro",
          });
          delivered = true;
        } catch (error) {
          console.error("[cron/pomodoro-notify] push failed", error);
        }
      }

      if (delivered) {
        sentCount += 1;
      }

      await markPomodoroNotificationSent(notification.id);
    }

    return NextResponse.json({
      ok: true,
      due: dueNotifications.length,
      sent: sentCount,
      subscriptions: subscriptions.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron 通知の送信に失敗しました。";
    console.error("[GET /api/cron/pomodoro-notify]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
