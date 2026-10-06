-- GoCy: repetir un lugar en el mismo día y paradas "a elegir".

-- Hasta ahora un lugar solo podía salir una vez por día. El alojamiento (salir
-- por la mañana, volver por la noche) o una estación por la que se pasa dos
-- veces necesitan repetirse, así que se quita esa restricción. La app avisa
-- antes de repetir.
alter table place_day_links drop constraint if exists place_day_links_place_id_day_id_key;

-- Paradas entre las que hay que elegir (tres sitios para cenar): las del mismo
-- día que comparten este identificador son alternativas, no van una detrás de
-- otra. No hay tabla aparte: el grupo es solo ese identificador repetido.
alter table place_day_links add column if not exists choice_group uuid;
