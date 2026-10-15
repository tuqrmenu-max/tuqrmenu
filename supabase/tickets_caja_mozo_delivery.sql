-- =====================================================
-- tickets_caja_mozo_delivery.sql
-- Ejecutar ANTES de desplegar esta versión del front. Es re-ejecutable y
-- no borra ni modifica montos de tickets anteriores.
--
-- Qué agrega:
--   1) Rol "delivery" para cliente_usuarios (Usuarios > Nuevo usuario).
--   2) Columnas en tickets_caja para guardar por separado items, delivery y
--      propina, más el mozo y el repartidor de cada cobro (filtrables).
--   3) RPC qr_equipo_operativo: lista de mozos/repartidores del restaurante.
--      Hace falta porque, por RLS, un mozo/cajero solo puede leer su propia
--      fila de cliente_usuarios y no vería a sus compañeros.
--   4) qr_caja_resumen_v2 con filtros por mozo y delivery (se reemplaza la
--      firma anterior: totales y paginación deben respetar los filtros).
-- Requiere haber ejecutado antes: seguridad_rls_fix.sql (mis_clientes_ids,
-- es_superadmin), tickets_caja_y_codigos.sql y optimizar_trafico_v2.sql.
-- =====================================================
BEGIN;

-- 1) Rol delivery ------------------------------------------------------
-- Mismo enfoque que fix_rol_cocina.sql: se reemplaza el CHECK de "rol".
-- NOT VALID: no revalida filas existentes (no puede fallar por datos viejos)
-- pero sí se aplica a todo alta/cambio de rol nuevo.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'cliente_usuarios'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE cliente_usuarios DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE cliente_usuarios
  ADD CONSTRAINT cliente_usuarios_rol_check
  CHECK (rol IN ('mozo', 'cajero', 'cocina', 'delivery')) NOT VALID;

-- Secciones visibles por defecto para el rol nuevo (Mesas: ve Delivery/Retiro).
ALTER TABLE clientes ALTER COLUMN permisos_roles SET DEFAULT
  '{"mozo": ["mesas"], "cajero": ["mesas", "caja"], "cocina": ["mesas"], "delivery": ["mesas"]}'::jsonb;

UPDATE clientes
SET permisos_roles = COALESCE(permisos_roles, '{}'::jsonb) || jsonb_build_object('delivery', jsonb_build_array('mesas'))
WHERE COALESCE(permisos_roles, '{}'::jsonb)->'delivery' IS NULL;

-- 2) Columnas de tickets_caja ------------------------------------------
ALTER TABLE public.tickets_caja
  ADD COLUMN IF NOT EXISTS items_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_monto numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS propina_monto numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mozo_id uuid,
  ADD COLUMN IF NOT EXISTS mozo_nombre text,
  ADD COLUMN IF NOT EXISTS delivery_user_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_nombre text;

COMMENT ON COLUMN public.tickets_caja.items_total IS 'Subtotal de productos (sin propina ni delivery).';
COMMENT ON COLUMN public.tickets_caja.delivery_monto IS 'Costo de delivery cobrado en el ticket.';
COMMENT ON COLUMN public.tickets_caja.propina_monto IS 'Propina cobrada en el ticket (corresponde al mozo).';
COMMENT ON COLUMN public.tickets_caja.es_delivery IS 'true si es un pedido Mesa 0 despachado por delivery (no retiro).';
COMMENT ON COLUMN public.tickets_caja.mozo_id IS 'user_id (auth) del mozo asignado al cobro. NULL = sin asignar.';
COMMENT ON COLUMN public.tickets_caja.delivery_user_id IS 'user_id (auth) del repartidor asignado. NULL = sin asignar.';

-- Tickets históricos: la propina ya estaba dentro de items (tipo = 'propina').
-- Solo toca filas todavía sin desglosar, así se puede volver a ejecutar.
WITH calc AS (
  SELECT t.id,
         COALESCE(SUM((e.value->>'subtotal')::numeric) FILTER (WHERE e.value->>'tipo' = 'propina'), 0) AS propina
  FROM public.tickets_caja t
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END
  ) e(value) ON true
  WHERE t.items_total = 0 AND t.propina_monto = 0 AND t.delivery_monto = 0
  GROUP BY t.id
)
UPDATE public.tickets_caja t
SET propina_monto = c.propina,
    items_total = GREATEST(t.total - c.propina, 0)
FROM calc c
WHERE c.id = t.id;

-- Tickets históricos de Mesa 0: marcar los que fueron delivery (no retiro).
UPDATE public.tickets_caja t
SET es_delivery = true
FROM public.comensales c
WHERE t.mesa = 0
  AND t.es_delivery = false
  AND c.metodo_entrega = 'delivery'
  AND c.id::text = t.items->0->>'comensal_id';

CREATE INDEX IF NOT EXISTS idx_tickets_caja_mozo
  ON public.tickets_caja (cliente_id, mozo_id, cobrado_at DESC) WHERE mozo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_caja_delivery
  ON public.tickets_caja (cliente_id, delivery_user_id, cobrado_at DESC) WHERE delivery_user_id IS NOT NULL;

-- 3) Mozos y repartidores del restaurante ------------------------------
-- SECURITY DEFINER: devuelve solo lo mínimo (sin email ni horarios) y solo si
-- el llamante pertenece a ese restaurante (dueño o staff) o es superadmin.
CREATE OR REPLACE FUNCTION public.qr_equipo_operativo(p_cliente_id uuid)
RETURNS TABLE (user_id uuid, nombre text, usuario text, rol text, activo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cu.user_id, cu.nombre, cu.usuario, cu.rol, COALESCE(cu.activo, true)
  FROM public.cliente_usuarios cu
  WHERE cu.cliente_id = p_cliente_id
    AND cu.rol IN ('mozo', 'delivery')
    AND (p_cliente_id IN (SELECT public.mis_clientes_ids()) OR public.es_superadmin())
  ORDER BY cu.nombre
$$;
REVOKE ALL ON FUNCTION public.qr_equipo_operativo(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.qr_equipo_operativo(uuid) TO authenticated;

-- 4) Resumen de caja con filtros por mozo / delivery -------------------
-- Se elimina la firma anterior (6 parámetros) para que no queden dos
-- sobrecargas ambiguas. Los parámetros nuevos tienen default: quien no los
-- pase obtiene exactamente el resultado de antes.
DROP FUNCTION IF EXISTS public.qr_caja_resumen_v2(uuid, timestamptz, timestamptz, integer, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.qr_caja_resumen_v2(
  p_cliente_id uuid, p_desde timestamptz DEFAULT NULL, p_hasta timestamptz DEFAULT NULL,
  p_mesa integer DEFAULT NULL, p_cerrados boolean DEFAULT true, p_turnos jsonb DEFAULT NULL,
  p_mozo uuid DEFAULT NULL, p_delivery uuid DEFAULT NULL, p_solo_delivery boolean DEFAULT false
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
with lineas as (
 select q.comensal_id,c.mesa,q.cantidad,coalesce(p.precio,0) as precio,
 coalesce(to_jsonb(q)->>'es_promo','0') in ('1','true') as promo,
 coalesce(k.nombre,'Sin categoría') as categoria
 from public.pedidos_qr q join public.comensales c on c.id=q.comensal_id
 join public.productos p on p.id=q.producto_id left join public.categorias k on k.id=p.categoria_id
 where c.cliente_id=p_cliente_id and (p_mesa is null or c.mesa=p_mesa)
 and (p_cerrados or q.pagado=0)
 and (p_desde is null or q.fecha_hora>=p_desde) and (p_hasta is null or q.fecha_hora<p_hasta)
 and (p_turnos is null or exists(select 1 from jsonb_array_elements(p_turnos) r where q.fecha_hora>=(r->>0)::timestamptz and q.fecha_hora<(r->>1)::timestamptz))
), cats as (
 select categoria,sum(cantidad) cantidad,sum(case when promo then 0 else precio*cantidad end) total from lineas group by categoria
), tickets as (
 select t.total,t.items_total,t.delivery_monto,t.propina_monto from public.tickets_caja t where t.cliente_id=p_cliente_id
 and (p_mesa is null or t.mesa=p_mesa)
 and (p_mozo is null or t.mozo_id=p_mozo)
 and (p_delivery is null or t.delivery_user_id=p_delivery)
 and (not p_solo_delivery or t.es_delivery)
 and (p_desde is null or t.cobrado_at>=p_desde) and (p_hasta is null or t.cobrado_at<p_hasta)
 and (p_turnos is null or exists(select 1 from jsonb_array_elements(p_turnos) r where t.cobrado_at>=(r->>0)::timestamptz and t.cobrado_at<(r->>1)::timestamptz))
)
select jsonb_build_object('totales',(select jsonb_build_object(
 'comensales',count(distinct comensal_id),'mesas_atendidas',count(distinct mesa),'items_vendidos',coalesce(sum(cantidad),0),
 'total_facturado',coalesce(sum(case when promo then 0 else precio*cantidad end),0),
 'items_promo',coalesce(sum(case when promo then cantidad else 0 end),0),
 'descuento_promo',coalesce(sum(case when promo then precio*cantidad else 0 end),0)) from lineas),
 'categorias',coalesce((select jsonb_object_agg(categoria,jsonb_build_object('cantidad',cantidad,'total',total)) from cats),'{}'::jsonb),
 'tickets_count',(select count(*) from tickets),'tickets_total',coalesce((select sum(total) from tickets),0),
 'tickets_items',coalesce((select sum(items_total) from tickets),0),
 'tickets_delivery',coalesce((select sum(delivery_monto) from tickets),0),
 'tickets_propina',coalesce((select sum(propina_monto) from tickets),0));
$$;
REVOKE ALL ON FUNCTION public.qr_caja_resumen_v2(uuid, timestamptz, timestamptz, integer, boolean, jsonb, uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.qr_caja_resumen_v2(uuid, timestamptz, timestamptz, integer, boolean, jsonb, uuid, uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
