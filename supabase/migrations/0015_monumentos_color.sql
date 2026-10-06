-- GoCy: Monumentos pasa de verde a azul.
--
-- El verde de fábrica era el mismo que el de los parques en Google Maps, y en
-- el centro de Londres (St James's Park, Green Park) los pines desaparecían.
-- Es un azul más intenso que el del agua y que el gris azulado de Aeropuerto.
update categories set color = '#2f62d9' where name = 'Monumentos' and color = '#4f7a68';
