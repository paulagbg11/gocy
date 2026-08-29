-- GoCy: dos tipos nuevos de documento.
--   transport = trenes y autobuses
--   ticket    = entradas (conciertos, parques de atracciones, museos...)
--
-- Nota: si Supabase se queja de "ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block", ejecuta cada línea por separado.
alter type document_type add value if not exists 'transport';
alter type document_type add value if not exists 'ticket';
