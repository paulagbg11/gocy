-- GoCy: marcar días como completados.
-- La pantalla "Días" abre por defecto en el primer día sin completar, así que
-- según vais marcando días la app va avanzando sola al siguiente.
alter table trip_days add column completed boolean not null default false;
