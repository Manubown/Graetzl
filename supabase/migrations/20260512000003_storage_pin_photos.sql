-- =====================================================================
-- Grätzl — Storage bucket for pin photos
-- Week 2, session 3
--
-- Bucket is PUBLIC (pin photos are public content like the pin itself).
-- Inserts are gated to authenticated users only.
-- File-name discipline: <author_id>/<random>.<ext> so we know whose file
-- it is just by inspecting the path.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pin-photos',
  'pin-photos',
  true,
  6 * 1024 * 1024,   -- 6 MB cap pre-Sharp; we resize/recompress server-side
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Public read of all objects in the bucket.
drop policy if exists "pin_photos_public_read" on storage.objects;
create policy "pin_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'pin-photos');

-- Authed users can insert ONLY under their own UID prefix.
drop policy if exists "pin_photos_owner_insert" on storage.objects;
create policy "pin_photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'pin-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authed users can delete ONLY their own files (for "remove photo" UX).
drop policy if exists "pin_photos_owner_delete" on storage.objects;
create policy "pin_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'pin-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
