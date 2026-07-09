import { getSupabaseAdmin } from "@/lib/supabase/server";

export type PomodoroScheduledNotification = {
  id: string;
  notify_at: string;
  title: string;
  body: string;
  status: "pending" | "sent" | "cancelled";
};

export async function cancelPendingPomodoroNotifications(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("pomodoro_scheduled_notifications")
    .update({ status: "cancelled" })
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

export async function schedulePomodoroNotification(input: {
  notifyAt: string;
  title: string;
  body: string;
}): Promise<PomodoroScheduledNotification> {
  await cancelPendingPomodoroNotifications();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pomodoro_scheduled_notifications")
    .insert({
      notify_at: input.notifyAt,
      title: input.title,
      body: input.body,
      status: "pending",
    })
    .select("id, notify_at, title, body, status")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "通知の予約に失敗しました。");
  }

  return data as PomodoroScheduledNotification;
}

export async function fetchDuePomodoroNotifications(
  now = new Date(),
): Promise<PomodoroScheduledNotification[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pomodoro_scheduled_notifications")
    .select("id, notify_at, title, body, status")
    .eq("status", "pending")
    .lte("notify_at", now.toISOString())
    .order("notify_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PomodoroScheduledNotification[];
}

export async function markPomodoroNotificationSent(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("pomodoro_scheduled_notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
