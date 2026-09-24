-- GoCy: dar una nota por resuelta sin perderla.
--
-- Tachar no es borrar: la nota sigue ahí, con lo que puso cada uno, pero baja
-- al final del tablón y deja de pedir atención.
alter table notes add column if not exists done boolean not null default false;
