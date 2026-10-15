-- =====================================================
-- promociones_fix_completo.sql
-- Agrega TODAS las columnas que necesita PromocionesAdmin.
-- Tabla original solo tenia: id, cliente_id, titulo, descripcion, created_at
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

ALTER TABLE promociones ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'descuento';
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS categoria text DEFAULT NULL;
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS producto_id uuid DEFAULT NULL;
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS asignacion text DEFAULT 'todos';
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS fecha_envio timestamptz DEFAULT NULL;

-- Verificar que todas las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'promociones'
ORDER BY ordinal_position;
