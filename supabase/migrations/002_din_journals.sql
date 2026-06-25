create table if not exists public.din_journals (
  id uuid primary key default gen_random_uuid(),
  journal_date date not null,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint din_journals_journal_date_key unique (journal_date)
);

create index if not exists din_journals_journal_date_idx
  on public.din_journals (journal_date desc);

alter table public.din_journals enable row level security;

create policy "Allow all for single-user din_journals"
  on public.din_journals
  for all
  using (true)
  with check (true);
