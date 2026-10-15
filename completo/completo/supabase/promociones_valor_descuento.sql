-- =====================================================
-- promociones_valor_descuento.sql
-- Agrega el campo para indicar el porcentaje de descuento
-- de las promociones tipo 'descuento', y lo expone en el
-- RPC mis_promos_activas para que el menu publico lo reciba.
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

ALTER TABLE promociones ADD COLUMN IF NOT EXISTS valor_descuento numeric DEFAULT NULL;

DROP FUNCTION IF EXISTS mis_promos_activas(uuid);

CREATE OR REPLACE FUNCTION mis_promos_activas(p_suscripcion_id uuid)
RETURNS TABLE(codigo text, titulo text, descripcion text, tipo text, categoria text, producto_id text, producto_nombre text, valor_descuento numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.codigo, p.titulo, p.descripcion, p.tipo, p.categoria, p.producto_id, p.producto_nombre, p.valor_descuento
  FROM promociones_cliente pc
  JOIN promociones p ON p.id = pc.promocion_id
  WHERE pc.suscripcion_id = p_suscripcion_id
    AND coalesce(pc.usada::boolean, false) = false
    AND coalesce(pc.activa::boolean, true) = true
    AND (p.fecha_envio IS NULL OR p.fecha_envio <= now())
$$;

GRANT EXECUTE ON FUNCTION mis_promos_activas(uuid) TO anon, authenticated;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'promociones' AND column_name = 'valor_descuento';
