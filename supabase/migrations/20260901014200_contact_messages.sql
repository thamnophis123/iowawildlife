create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
-- No policies: only the service role (used by the contact API) can read or insert.
