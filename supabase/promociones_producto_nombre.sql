-- =====================================================
-- Agregar columna producto_nombre a promociones
-- y actualizar RPC mis_promos_activas
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna para nombres de productos
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS producto_nombre text DEFAULT NULL;

-- 2. Actualizar RPC para retornar producto_nombre
DROP FUNCTION IF EXISTS mis_promos_activas(uuid);

CREATE OR REPLACE FUNCTION mis_promos_activas(p_suscripcion_id uuid)
RETURNS TABLE(codigo text, titulo text, descripcion text, tipo text, categoria text, producto_id text, producto_nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.codigo, p.titulo, p.descripcion, p.tipo, p.categoria, p.producto_id, p.producto_nombre
  FROM promociones_cliente pc
  JOIN promociones p ON p.id = pc.promocion_id
  WHERE pc.suscripcion_id = p_suscripcion_id
    AND coalesce(pc.usada::boolean, false) = false
    AND coalesce(pc.activa::boolean, true) = true
    AND (p.fecha_envio IS NULL OR p.fecha_envio <= now())
$$;

GRANT EXECUTE ON FUNCTION mis_promos_activas(uuid) TO anon, authenticated;
