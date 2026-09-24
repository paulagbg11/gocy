-- GoCy: un mismo sitio, una sola vez por viaje.
--
-- Hasta ahora nada impedía guardar dos veces el mismo lugar, y buscando algo
-- ya añadido salía otra ficha igual. La app ya avisa antes de crearlo, pero
-- eso no cubre que dos móviles lo añadan a la vez, así que el límite de verdad
-- se pone aquí.
--
-- Antes del índice hay que limpiar lo que ya está duplicado, porque si no la
-- creación del índice falla. De cada grupo se conserva el ejemplar más
-- antiguo, y lo que colgaba de los otros se reasigna a él: nada se pierde por
-- el camino. Ojo con el orden — place_day_links tiene borrado en cascada desde
-- places, así que borrar primero el lugar se llevaría por delante sus días.

-- 1. Días duplicados: si el que se conserva ya está en ese mismo día, la fila
--    del otro sobra (y chocaría con unique (place_id, day_id) al moverla).
with dupes as (
  select
    id as loser_id,
    first_value(id) over (
      partition by trip_id, google_place_id
      order by created_at, id
    ) as keeper_id
  from places
  where google_place_id is not null
)
delete from place_day_links l
using dupes d
where l.place_id = d.loser_id
  and d.loser_id <> d.keeper_id
  and exists (
    select 1 from place_day_links k
    where k.place_id = d.keeper_id and k.day_id = l.day_id
  );

-- 2. Los días que sí aportan algo se mueven al ejemplar que se conserva.
with dupes as (
  select
    id as loser_id,
    first_value(id) over (
      partition by trip_id, google_place_id
      order by created_at, id
    ) as keeper_id
  from places
  where google_place_id is not null
)
update place_day_links l
set place_id = d.keeper_id
from dupes d
where l.place_id = d.loser_id
  and d.loser_id <> d.keeper_id;

-- 3. Lo mismo con los documentos que apuntasen al duplicado.
with dupes as (
  select
    id as loser_id,
    first_value(id) over (
      partition by trip_id, google_place_id
      order by created_at, id
    ) as keeper_id
  from places
  where google_place_id is not null
)
update documents doc
set place_id = d.keeper_id
from dupes d
where doc.place_id = d.loser_id
  and d.loser_id <> d.keeper_id;

-- 4. Ya se pueden borrar los sobrantes.
with dupes as (
  select
    id as loser_id,
    first_value(id) over (
      partition by trip_id, google_place_id
      order by created_at, id
    ) as keeper_id
  from places
  where google_place_id is not null
)
delete from places p
using dupes d
where p.id = d.loser_id
  and d.loser_id <> d.keeper_id;

-- 5. Y el límite, para que no vuelva a pasar.
--    Parcial: los lugares añadidos a mano no tienen identificador de Google y
--    no hay forma fiable de decir que dos son el mismo, así que ahí no se
--    impone nada y la comprobación por nombre y cercanía de la app es lo que
--    aplica.
create unique index if not exists places_trip_google_place_idx
  on places (trip_id, google_place_id)
  where google_place_id is not null;
