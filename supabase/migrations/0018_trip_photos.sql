-- GoCy: fotos propias del viaje, hechas en el momento o sacadas de la galería.
--
-- Se llaman trip_photos y no place_photos porque lib/place-photos.ts ya son las
-- fotos de Wikimedia que ilustran un lugar; estas son las nuestras.
--
-- Cuelgan del lugar (place_id) y, si se hicieron desde una parada, también del
-- día (day_id), porque un mismo lugar puede salir en varios días. Ninguno de
-- los dos borra en cascada: si se borra el lugar o el día, la foto se queda en
-- el viaje sin sitio en vez de desaparecer en silencio. Solo se van con el
-- viaje entero.
create table trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  day_id uuid references trip_days(id) on delete set null,
  -- Rutas dentro del bucket trip-photos: la foto reducida (~2048 px) y la
  -- miniatura (~400 px) que usan las cuadrículas y, más adelante, los pines.
  storage_path text not null,
  thumb_path text not null,
  width int,
  height int,
  -- Del EXIF de la foto original, si lo trae. Nunca se rellena a ojo: una foto
  -- sin fecha se ordena por created_at.
  taken_at timestamptz,
  lat double precision,
  lng double precision,
  caption text,
  favorite boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index trip_photos_trip_idx on trip_photos (trip_id, created_at);
create index trip_photos_place_idx on trip_photos (place_id);

alter table trip_photos enable row level security;
create policy "authenticated full access" on trip_photos
  for all to authenticated using (true) with check (true);

-- Bucket privado, como los adjuntos: las fotos se ven con URL firmada.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

create policy "trip-photos authenticated access" on storage.objects for all
  to authenticated
  using (bucket_id = 'trip-photos')
  with check (bucket_id = 'trip-photos');

-- Si Manu sube una foto, tiene que aparecer en el otro móvil sin recargar.
alter publication supabase_realtime add table trip_photos;
