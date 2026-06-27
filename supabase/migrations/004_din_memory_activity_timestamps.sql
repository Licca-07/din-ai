-- Cross-device startup greeting: track last app open and last proactive line
alter table public.din_memory
  add column if not exists last_app_opened_at timestamptz,
  add column if not exists last_startup_message text;
