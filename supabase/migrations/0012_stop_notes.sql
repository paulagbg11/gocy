-- GoCy: notas de cada parada del día, aparte de las notas del lugar.
--
-- Hasta ahora la nota de una parada era la del lugar, así que la del hotel
-- ("check-in a las 15:00") salía en todos los días en que aparecía el hotel.
-- Ahora cada parada lleva la suya; las notas del lugar siguen existiendo y se
-- ven en su ficha del mapa.
alter table place_day_links add column if not exists notes text;

-- Para no perder lo ya escrito: la nota de cada lugar se copia a su primera
-- aparición en el viaje (el día más temprano). Las notas del lugar no se
-- tocan. Solo rellena paradas sin nota, así que se puede ejecutar dos veces.
update place_day_links l
set notes = p.notes
from places p, trip_days d
where l.place_id = p.id
  and l.day_id = d.id
  and l.notes is null
  and nullif(btrim(p.notes), '') is not null
  and d.day_index = (
    select min(d2.day_index)
    from place_day_links l2
    join trip_days d2 on d2.id = l2.day_id
    where l2.place_id = l.place_id
  );
