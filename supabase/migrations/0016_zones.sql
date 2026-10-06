-- GoCy: zonas de "Por decidir".
--
-- "Por zona" agrupa los lugares sin día por cercanía. Aquí van las dos cosas
-- que se pueden ajustar a mano.

-- El radio (en metros) con el que se forman las zonas automáticas. En una
-- ciudad compacta conviene pequeño; en un viaje de pueblos o en coche, mucho
-- mayor. Vacío = el valor por defecto de la app.
alter table trips add column if not exists zone_radius_m integer;

-- Zona puesta a mano. Es solo el nombre: los lugares de un viaje con el mismo
-- nombre forman la zona, sin tabla aparte. Los que no tienen se siguen
-- agrupando solos por cercanía.
alter table places add column if not exists zone text;
