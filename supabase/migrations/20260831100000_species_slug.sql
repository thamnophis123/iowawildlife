alter table public.species
  add column if not exists slug text,
  add column if not exists short_summary text;

create unique index if not exists species_slug_key
  on public.species (slug)
  where slug is not null;
