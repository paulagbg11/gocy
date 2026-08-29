-- GoCy: esquema inicial
create extension if not exists "moddatetime" schema extensions;
create extension if not exists "pgcrypto" schema extensions;

create type place_category as enum (
  'airport','lodging','restaurant','cafe','landmark','activity','shopping','other'
);
create type document_type as enum ('flight','lodging','reservation','note');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#8a8578',
  created_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  cover_image_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_index int not null,
  date date not null,
  label text,
  unique (trip_id, day_index)
);

create table places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  category place_category not null default 'other',
  lat double precision not null,
  lng double precision not null,
  address text,
  google_place_id text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index places_trip_id_idx on places (trip_id);

-- un lugar puede asignarse a varios días (ej. se repite la visita) — relación N:M, no una FK única.
-- "por decidir" = un place_id sin ninguna fila en esta tabla.
create table place_day_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  day_id uuid not null references trip_days(id) on delete cascade,
  order_in_day double precision,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (place_id, day_id)
);
create index place_day_links_trip_id_idx on place_day_links (trip_id);
create index place_day_links_day_id_idx on place_day_links (day_id);
create index place_day_links_place_id_idx on place_day_links (place_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  day_id uuid references trip_days(id) on delete set null,
  type document_type not null,
  title text not null,
  details jsonb not null default '{}',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_trip_id_idx on documents (trip_id);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index attachments_document_id_idx on attachments (document_id);

create trigger trips_set_updated_at before update on trips
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger places_set_updated_at before update on places
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger documents_set_updated_at before update on documents
  for each row execute procedure extensions.moddatetime(updated_at);

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('trip-covers', 'trip-covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('trip-attachments', 'trip-attachments', false)
on conflict (id) do nothing;
