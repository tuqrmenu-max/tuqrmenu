-- =====================================================
-- Cambiar columna producto_id de uuid a text (soporta JSON array)
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Cambiar tipo de columna para soportar JSON array de IDs
ALTER TABLE promociones
  ALTER COLUMN producto_id TYPE text;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'promociones' AND column_name = 'producto_id';
