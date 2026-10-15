-- =====================================================
-- mesas_mozo_asignado.sql
-- Guarda qué mozo está a cargo de cada mesa (se elige directamente desde
-- la tarjeta de la mesa en Mesas). Al confirmar el cobro de esa mesa, el
-- campo "Mozo" del cuadro de cobro se precarga con este valor en vez de
-- quedar vacío, así el cajero no tiene que volver a elegirlo.
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- =====================================================

ALTER TABLE mesas_operacion ADD COLUMN IF NOT EXISTS mozo_asignado_id uuid;

NOTIFY pgrst, 'reload schema';
