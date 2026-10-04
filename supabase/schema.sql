-- CampusMapper Collector: database schema, security rules and storage setup
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------

create table if not exists public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  center_lat  double precision not null,
  center_lng  double precision not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  icon        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.places (
  id           uuid primary key default gen_random_uuid(),
  campus_id    uuid not null references public.campuses(id) on delete cascade,
  name         text not null,
  category     text,
  description  text,
  latitude     double precision not null,
  longitude    double precision not null,
  gps_accuracy double precision,
  field_notes  text,
  cover_image  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists places_campus_idx  on public.places (campus_id);
create index if not exists places_created_idx on public.places (created_at desc);

create table if not exists public.place_photos (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  image_url  text not null,
  photo_type text not null
             check (photo_type in ('front', 'entrance', 'surroundings', 'sign', 'other')),
  caption    text,
  is_cover   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (place_id, photo_type)
);

create index if not exists place_photos_place_idx on public.place_photos (place_id);

-- Keep places.updated_at fresh on every edit
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ---------------------------------------------------------------
-- VERSION 1 HAS NO LOGIN. These policies let anyone holding your app's
-- anon key read and write places and photos. That is fine while you are
-- testing with a small team. Before sharing the app widely, add
-- authentication and tighten these policies (for example, require
-- auth.uid() is not null).

alter table public.campuses     enable row level security;
alter table public.categories   enable row level security;
alter table public.places       enable row level security;
alter table public.place_photos enable row level security;

-- Campuses and categories: read only from the app (manage them in SQL / dashboard)
drop policy if exists "v1 read campuses" on public.campuses;
create policy "v1 read campuses" on public.campuses
  for select to anon, authenticated using (true);

drop policy if exists "v1 read categories" on public.categories;
create policy "v1 read categories" on public.categories
  for select to anon, authenticated using (true);

-- Places: full access
drop policy if exists "v1 read places" on public.places;
create policy "v1 read places" on public.places
  for select to anon, authenticated using (true);

drop policy if exists "v1 insert places" on public.places;
create policy "v1 insert places" on public.places
  for insert to anon, authenticated with check (true);

drop policy if exists "v1 update places" on public.places;
create policy "v1 update places" on public.places
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "v1 delete places" on public.places;
create policy "v1 delete places" on public.places
  for delete to anon, authenticated using (true);

-- Place photos: full access
drop policy if exists "v1 read place_photos" on public.place_photos;
create policy "v1 read place_photos" on public.place_photos
  for select to anon, authenticated using (true);

drop policy if exists "v1 insert place_photos" on public.place_photos;
create policy "v1 insert place_photos" on public.place_photos
  for insert to anon, authenticated with check (true);

drop policy if exists "v1 update place_photos" on public.place_photos;
create policy "v1 update place_photos" on public.place_photos
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "v1 delete place_photos" on public.place_photos;
create policy "v1 delete place_photos" on public.place_photos
  for delete to anon, authenticated using (true);

-- ---------------------------------------------------------------
-- 3. STORAGE BUCKET: campus-photos
-- ---------------------------------------------------------------
-- Public bucket so photo URLs can be shown in the app and on the map.

insert into storage.buckets (id, name, public)
values ('campus-photos', 'campus-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "v1 read campus photos" on storage.objects;
create policy "v1 read campus photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'campus-photos');

drop policy if exists "v1 upload campus photos" on storage.objects;
create policy "v1 upload campus photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'campus-photos');

drop policy if exists "v1 replace campus photos" on storage.objects;
create policy "v1 replace campus photos" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'campus-photos') with check (bucket_id = 'campus-photos');

drop policy if exists "v1 delete campus photos" on storage.objects;
create policy "v1 delete campus photos" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'campus-photos');

-- ---------------------------------------------------------------
-- 4. STARTER DATA
-- ---------------------------------------------------------------

insert into public.categories (name, icon) values
  ('Faculty / Department', '🏛️'),
  ('Lecture Hall', '🎓'),
  ('Library', '📚'),
  ('Laboratory', '🔬'),
  ('Administration', '🗂️'),
  ('Hostel', '🛏️'),
  ('Cafeteria / Food', '🍽️'),
  ('Sports Facility', '⚽'),
  ('Gate / Entrance', '🚪'),
  ('Health Centre', '🏥'),
  ('Worship Centre', '🕌'),
  ('Bank / ATM', '🏧'),
  ('Parking', '🅿️'),
  ('Other', '📍')
on conflict (name) do nothing;

-- EDIT THIS: put your real campus name and its approximate centre.
-- To get coordinates, long-press the middle of campus in Google Maps.
-- The centre only decides where the map opens when you have no places yet.
insert into public.campuses (name, description, center_lat, center_lng)
select 'My University', 'Main campus', 5.0000, 7.9000
where not exists (select 1 from public.campuses);
