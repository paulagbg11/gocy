-- GoCy: "migas de pan" de ubicación para el recuerdo del viaje (Estravel).
--
-- Una PWA no puede registrar la ubicación en segundo plano (el navegador
-- suspende el JS al minimizar y los service workers no tienen acceso a la
-- geolocalización), así que en vez de una traza continua se guarda un punto
-- cada vez que la app está abierta durante los días del viaje.
create table track_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index track_points_trip_idx on track_points (trip_id, recorded_at);

alter table track_points enable row level security;
create policy "authenticated full access" on track_points
  for all to authenticated using (true) with check (true);

-- A propósito NO se añade a la publicación supabase_realtime: nadie necesita
-- ver estos puntos al instante en el otro móvil, y así evitamos tráfico de
-- websocket continuo durante el viaje.
