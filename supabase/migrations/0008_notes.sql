-- GoCy: notas del viaje, en plan tablón de post-its.
--
-- Cada nota es un papel independiente: puede llevar un texto suelto ("los
-- enchufes son tipo G"), un enlace, y/o una lista de cosas que marcar
-- ("sacar el ETA"). La lista va en su propia tabla en vez de en un jsonb
-- porque marcar una casilla desde el otro móvil tiene que llegar por Realtime
-- como una fila que cambia, no reescribiendo la nota entera (que pisaría lo
-- que la otra persona estuviera editando en ese momento).
create table notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null default '',
  body text,
  url text,
  -- Identificador del color del papel; la paleta vive en lib/notes.ts.
  color text not null default 'yellow',
  pinned boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table note_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  -- Redundante con notes.trip_id, pero necesario: los filtros de Realtime son
  -- por columna propia de la tabla, y la app se suscribe por trip_id.
  trip_id uuid not null references trips(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index notes_trip_idx on notes (trip_id, created_at desc);
create index note_items_note_idx on note_items (note_id, sort_order);

create trigger notes_set_updated_at before update on notes
  for each row execute procedure extensions.moddatetime(updated_at);

alter table notes enable row level security;
alter table note_items enable row level security;
create policy "authenticated full access" on notes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on note_items
  for all to authenticated using (true) with check (true);

-- Estas sí van a Realtime: la gracia es que si Manu apunta algo o marca una
-- casilla, aparezca en el otro móvil sin recargar.
alter publication supabase_realtime add table notes, note_items;
