-- GoCy: etiqueta "imprescindible" en los lugares.
--
-- Marca opcional para lo que no nos queremos perder. Sirve sobre todo en
-- "Por decidir": lo imprescindible sin día sale arriba, para repartirlo antes
-- que el resto.
alter table places add column if not exists essential boolean not null default false;
