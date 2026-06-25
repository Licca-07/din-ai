-- 日記生成の排他制御（OpenAI 呼び出しの重複防止）
create table if not exists public.din_journal_generation_locks (
  journal_date date primary key,
  created_at timestamptz not null default now()
);

create index if not exists din_journal_generation_locks_created_at_idx
  on public.din_journal_generation_locks (created_at);

alter table public.din_journal_generation_locks enable row level security;

create policy "Allow all for single-user din_journal_generation_locks"
  on public.din_journal_generation_locks
  for all
  using (true)
  with check (true);
