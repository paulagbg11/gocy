-- Perfiles iniciales. Los nombres se pueden editar luego desde la Pantalla 0
-- (botón "editar nombre") o desde Ajustes del viaje.
insert into profiles (name, color)
values
  ('Paula', '#b0637c'),
  ('Novio', '#6f7fc4')
on conflict do nothing;
