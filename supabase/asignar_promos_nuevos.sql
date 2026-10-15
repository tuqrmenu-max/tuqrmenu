-- =====================================================
-- asignar_promos_nuevos.sql
-- Funcion RPC que asigna automaticamente las promos
-- marcadas como "para_nuevos" a un suscriptor nuevo.
-- Llamada desde el menu publico despues de insertar
-- en suscripciones.
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

-- 1. Agregar columna para_nuevos (si no existe)
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS para_nuevos boolean DEFAULT false;

-- 2. Funcion que asigna promos a nuevos suscriptos
CREATE OR REPLACE FUNCTION asignar_promos_nuevos(p_cliente_id uuid, p_suscripcion_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_promo record;
BEGIN
  FOR v_promo IN
    SELECT p.id FROM promociones p
    WHERE p.cliente_id = p_cliente_id
      AND coalesce(p.para_nuevos, false) = true
      AND NOT EXISTS (
        SELECT 1 FROM promociones_cliente pc
        WHERE pc.promocion_id = p.id
          AND pc.suscripcion_id = p_suscripcion_id
      )
  LOOP
    INSERT INTO promociones_cliente (promocion_id, suscripcion_id)
    VALUES (v_promo.id, p_suscripcion_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 3. Permisos para que el menu publico (anon) pueda llamarla
GRANT EXECUTE ON FUNCTION asignar_promos_nuevos(uuid, uuid) TO anon, authenticated;
