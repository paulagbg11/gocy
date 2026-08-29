-- GoCy: políticas RLS.
-- No hay login real (ver "Autenticación y RLS" en el plan): el único filtro
-- posible es "cualquiera que haya pasado por el anonymous sign-in de la app"
-- (rol `authenticated`, incluye sesiones anónimas) frente a "cualquiera de
-- internet sin sesión" (rol `anon`). Es un límite honesto, no una auth real.

alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_days enable row level security;
alter table places enable row level security;
alter table place_day_links enable row level security;
alter table documents enable row level security;
alter table attachments enable row level security;

create policy "authenticated full access" on profiles for all to authenticated using (true) with check (true);
create policy "authenticated full access" on trips for all to authenticated using (true) with check (true);
create policy "authenticated full access" on trip_days for all to authenticated using (true) with check (true);
create policy "authenticated full access" on places for all to authenticated using (true) with check (true);
create policy "authenticated full access" on place_day_links for all to authenticated using (true) with check (true);
create policy "authenticated full access" on documents for all to authenticated using (true) with check (true);
create policy "authenticated full access" on attachments for all to authenticated using (true) with check (true);

-- Storage: portadas de viaje legibles por cualquiera (son solo fotos),
-- escritura solo para sesiones autenticadas (incluye anónimas).
create policy "trip-covers public read" on storage.objects for select
  using (bucket_id = 'trip-covers');
create policy "trip-covers authenticated write" on storage.objects for insert
  to authenticated with check (bucket_id = 'trip-covers');
create policy "trip-covers authenticated update" on storage.objects for update
  to authenticated using (bucket_id = 'trip-covers');
create policy "trip-covers authenticated delete" on storage.objects for delete
  to authenticated using (bucket_id = 'trip-covers');

-- Adjuntos: nunca públicos, solo autenticados (se sirven via URL firmada).
create policy "trip-attachments authenticated access" on storage.objects for all
  to authenticated
  using (bucket_id = 'trip-attachments')
  with check (bucket_id = 'trip-attachments');

-- Pasos manuales obligatorios en el dashboard de Supabase (no son SQL):
-- 1. Authentication -> Providers -> Anonymous sign-ins: activar.
-- 2. Database -> Replication: añadir "places", "place_day_links", "documents",
--    "trip_days" a la publicación supabase_realtime.
--    (equivalente en SQL: alter publication supabase_realtime add table
--     places, place_day_links, documents, trip_days;)
