import { NextResponse } from "next/server";

import { getVapidPublicKey, isWebPushConfigured } from "@/lib/push/vapid";

export const runtime = "nodejs";

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web Push が未設定です。" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    publicKey: getVapidPublicKey(),
  });
}
