-- GoCy: colores de categoría que se perdían sobre el mapa de Google.
--
-- Los pines van en pastel, y algunos colores coincidían con los del propio
-- mapa. Se pueden ejecutar las veces que haga falta.

-- Lugar: se creó sin elegir color y se quedó con el gris por defecto, que no
-- se distinguía del gris y el beige del mapa. Pasa a fucsia.
update categories set color = '#d6408f' where lower(name) = 'lugar';

-- Ocio: el ocre de fábrica se confundía con el amarillo de las carreteras.
-- Pasa a violeta.
update categories set color = '#8a5cc2' where name = 'Ocio' and color = '#b98f3a';
