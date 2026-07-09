import webpush from "web-push";

import { getVapidPublicKey, isWebPushConfigured } from "@/lib/push/vapid";
import type { StoredPushSubscription } from "@/types/push-subscription";

let configured = false;

function ensureWebPushConfigured(): void {
  if (configured) return;

  if (!isWebPushConfigured()) {
    throw new Error(
      "Web Push が未設定です。VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を設定してください。",
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    getVapidPublicKey()!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendWebPushNotification(
  subscription: StoredPushSubscription,
  payload: PushPayload,
): Promise<void> {
  ensureWebPushConfigured();

  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      tag: payload.tag ?? "din-pomodoro",
    }),
  );
}
