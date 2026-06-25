-- Single-user Din AI memory (no auth; one logical row)
create table if not exists public.din_memory (
  id text primary key default 'single' check (id = 'single'),
  profile jsonb not null default '{}'::jsonb,
  conversation_count integer not null default 0 check (conversation_count >= 0),
  last_conversation_at timestamptz,
  chat_history jsonb not null default '[]'::jsonb,
  long_term_memories jsonb not null default '[]'::jsonb,
  short_term_memories jsonb not null default '[]'::jsonb,
  follow_up_topics jsonb not null default '[]'::jsonb,
  last_follow_up_topic_id text,
  updated_at timestamptz not null default now()
);

create index if not exists din_memory_updated_at_idx on public.din_memory (updated_at desc);

-- Single-user app: allow anon access when RLS is enabled (optional hardening later)
alter table public.din_memory enable row level security;

create policy "Allow all for single-user din_memory"
  on public.din_memory
  for all
  using (true)
  with check (true);
