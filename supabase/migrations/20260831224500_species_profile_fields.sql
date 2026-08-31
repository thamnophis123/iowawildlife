alter table public.species
  add column if not exists status text,
  add column if not exists id_tips text,
  add column if not exists habitat text,
  add column if not exists similar_species text,
  add column if not exists source_urls text[] not null default '{}';
