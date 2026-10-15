-- =====================================================
-- turnos_equipo.sql
-- Permite que mozo / cocina / cajero / delivery con el permiso "Turnos"
-- (Usuarios > Permisos por rol > Turnos) vean el calendario del mes con los
-- turnos de todos sus compañeros. La RLS de cliente_usuarios solo deja leer la
-- fila propia, por eso se usa una función SECURITY DEFINER que devuelve
-- únicamente lo necesario (sin email ni usuario de login).
-- Solo responde si quien llama es superadmin, dueño del restaurante o staff
-- del mismo restaurante con 'turnos' habilitado para su rol.
-- =====================================================
CREATE OR REPLACE FUNCTION turnos_equipo(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', cu.id,
    'nombre', cu.nombre,
    'rol', cu.rol,
    'activo', cu.activo,
    'horarios', cu.horarios,
    'created_at', cu.created_at
  ) ORDER BY cu.nombre), '[]'::jsonb)
  FROM cliente_usuarios cu
  WHERE cu.cliente_id = p_cliente_id
    AND (
      es_superadmin()
      OR EXISTS (SELECT 1 FROM clientes c WHERE c.id = p_cliente_id AND c.user_id = auth.uid())
      OR EXISTS (
        SELECT 1
        FROM cliente_usuarios yo
        JOIN clientes c ON c.id = yo.cliente_id
        WHERE yo.cliente_id = p_cliente_id
          AND yo.user_id = auth.uid()
          AND coalesce(yo.activo, true)
          AND (c.permisos_roles -> yo.rol) ? 'turnos'
      )
    )
$$;

GRANT EXECUTE ON FUNCTION turnos_equipo(uuid) TO authenticated;
