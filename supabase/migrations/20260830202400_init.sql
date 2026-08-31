-- Basic profiles (optional display name)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.species (
  id uuid primary key default gen_random_uuid(),
  inat_taxon_id integer unique,
  common_name text not null,
  scientific_name text,
  category text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  species_id uuid references public.species (id) on delete set null,
  photo_path text,
  notes text,
  category text,
  is_anonymous boolean not null default false,
  geoprivacy text not null default 'precise'
    check (geoprivacy in ('precise', 'fuzzy')),
  location_source text
    check (location_source in ('exif', 'map', 'search', 'county')),
  lat_precise double precision,
  lng_precise double precision,
  lat_public double precision not null,
  lng_public double precision not null,
  observed_at date,
  suggested_taxon_id integer,
  suggested_name text,
  suggestion_confidence real,
  suggestion_source text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists observations_public_coords_idx
  on public.observations (lat_public, lng_public);
create index if not exists observations_category_idx
  on public.observations (category);
create index if not exists observations_species_idx
  on public.observations (species_id);
create index if not exists comments_observation_idx
  on public.comments (observation_id);

alter table public.profiles enable row level security;
alter table public.species enable row level security;
alter table public.observations enable row level security;
alter table public.comments enable row level security;

-- Public can read species and public observation fields
create policy "species are readable"
  on public.species for select
  using (true);

create policy "observations are readable"
  on public.observations for select
  using (true);

create policy "comments are readable"
  on public.comments for select
  using (true);

create policy "profiles are readable"
  on public.profiles for select
  using (true);

-- Logged-in users can insert their own rows
create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users insert observations"
  on public.observations for insert
  with check (auth.uid() is not null);

create policy "owners update observations"
  on public.observations for update
  using (auth.uid() = user_id);

create policy "users insert comments"
  on public.comments for insert
  with check (auth.uid() is not null);

create policy "owners update comments"
  on public.comments for update
  using (auth.uid() = user_id);
