-- GoCy: categorías editables (emoji propio, categorías personalizadas,
-- ocultar por viaje) en vez del enum fijo place_category.

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📍',
  color text not null default '#78766e',
  is_builtin boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Categorías por defecto (editables luego: nombre, emoji y color se pueden
-- cambiar desde Ajustes del viaje; is_builtin solo evita que se puedan borrar
-- del todo, no impide ocultarlas).
insert into categories (name, emoji, color, is_builtin, sort_order) values
  ('Aeropuerto', '✈️', '#5b7a91', true, 1),
  ('Alojamiento', '🛏️', '#c18a4e', true, 2),
  ('Restaurantes', '🍽️', '#bd6248', true, 3),
  ('Cafeterías', '☕', '#8a6a4f', true, 4),
  ('Monumentos', '🏛️', '#4f7a68', true, 5),
  ('Ocio', '🧭', '#b98f3a', true, 6),
  ('Compras', '🛍️', '#a5715f', true, 7);

-- Qué categorías están ocultas en un viaje concreto (por defecto, todas
-- visibles; solo se guarda una fila cuando se oculta una).
create table trip_hidden_categories (
  trip_id uuid not null references trips(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (trip_id, category_id)
);

-- Migrar places del enum antiguo a category_id.
alter table places add column category_id uuid references categories(id);

update places p
set category_id = c.id
from categories c
where c.name = case p.category::text
    when 'airport' then 'Aeropuerto'
    when 'lodging' then 'Alojamiento'
    when 'restaurant' then 'Restaurantes'
    when 'cafe' then 'Cafeterías'
    when 'landmark' then 'Monumentos'
    when 'activity' then 'Ocio'
    when 'shopping' then 'Compras'
    else null
  end;

-- Los que eran 'other' (o quedaron sin migrar) van a la primera categoría
-- por defecto para no dejar places sin categoría.
update places set category_id = (select id from categories order by sort_order limit 1)
where category_id is null;

alter table places alter column category_id set not null;
alter table places drop column category;
drop type if exists place_category;

create index places_category_id_idx on places (category_id);

alter table categories enable row level security;
alter table trip_hidden_categories enable row level security;
create policy "authenticated full access" on categories for all to authenticated using (true) with check (true);
create policy "authenticated full access" on trip_hidden_categories for all to authenticated using (true) with check (true);

-- Añadir a la publicación de Realtime (dashboard, o SQL):
-- alter publication supabase_realtime add table categories, trip_hidden_categories;
