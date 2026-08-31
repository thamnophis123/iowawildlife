create table if not exists public.identifications (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id uuid not null references public.species (id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (observation_id, user_id)
);

create index if not exists identifications_observation_idx
  on public.identifications (observation_id);

alter table public.identifications enable row level security;

create policy "identifications are readable"
  on public.identifications for select
  using (true);

create policy "users insert own identifications"
  on public.identifications for insert
  with check (auth.uid() = user_id);

create policy "users update own identifications"
  on public.identifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.apply_community_species(p_observation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner uuid;
  winner_category text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select i.species_id into winner
  from public.identifications i
  where i.observation_id = p_observation_id
  group by i.species_id
  having count(*) >= 2
  order by count(*) desc, min(i.created_at) asc
  limit 1;

  if winner is null then
    return;
  end if;

  select s.category into winner_category
  from public.species s
  where s.id = winner;

  update public.observations
  set
    species_id = winner,
    category = coalesce(winner_category, category)
  where id = p_observation_id;
end;
$$;

revoke all on function public.apply_community_species(uuid) from public;
grant execute on function public.apply_community_species(uuid) to authenticated;
