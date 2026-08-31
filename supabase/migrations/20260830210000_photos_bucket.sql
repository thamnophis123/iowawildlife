-- Sighting photos. Path convention: {user_id}/{uuid}.ext
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated users can upload own photos" on storage.objects;
create policy "authenticated users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "photos are publicly readable" on storage.objects;
create policy "photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');
