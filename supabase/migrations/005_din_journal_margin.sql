-- Din's fictional daily margin (余白) appended to conversation journals
alter table public.din_journals
  add column if not exists margin text;

-- Cross-day continuity for margin threads (ongoing hobbies, looking forward)
create table if not exists public.din_journal_continuity (
  id text primary key default 'single' check (id = 'single'),
  last_margin_date date,
  next_margin_on_or_after date,
  ongoing_thread text,
  looking_forward text,
  recent_margin_texts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.din_journal_continuity enable row level security;

create policy "Allow all for single-user din_journal_continuity"
  on public.din_journal_continuity
  for all
  using (true)
  with check (true);

insert into public.din_journal_continuity (id)
values ('single')
on conflict (id) do nothing;
