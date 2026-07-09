-- Web Push subscriptions and server-scheduled Pomodoro notifications

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_updated_at_idx
  on public.push_subscriptions (updated_at desc);

alter table public.push_subscriptions enable row level security;

create policy "Allow all for single-user push_subscriptions"
  on public.push_subscriptions
  for all
  using (true)
  with check (true);

create table if not exists public.pomodoro_scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  notify_at timestamptz not null,
  title text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists pomodoro_scheduled_notifications_pending_idx
  on public.pomodoro_scheduled_notifications (notify_at)
  where status = 'pending';

alter table public.pomodoro_scheduled_notifications enable row level security;

create policy "Allow all for single-user pomodoro_scheduled_notifications"
  on public.pomodoro_scheduled_notifications
  for all
  using (true)
  with check (true);
