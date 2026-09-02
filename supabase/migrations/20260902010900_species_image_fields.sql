alter table public.species
  add column if not exists image_url text,
  add column if not exists image_attribution text,
  add column if not exists image_license text,
  add column if not exists image_source_url text;
