import type { StoredPushSubscription } from "@/types/push-subscription";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  subscription: StoredPushSubscription;
  user_agent: string | null;
  updated_at: string;
};

export async function upsertPushSubscription(
  subscription: StoredPushSubscription,
  userAgent?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      subscription,
      user_agent: userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(
    (row) => (row as Pick<PushSubscriptionRow, "subscription">).subscription,
  );
}
