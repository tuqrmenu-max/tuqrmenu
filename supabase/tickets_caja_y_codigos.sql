-- Tickets persistentes de Caja + correlativo diario de pedidos Mesa 0.
-- Seguro para ejecutar varias veces.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tickets_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  mesa integer NOT NULL DEFAULT 0,
  codigo_pedido text,
  referencia_cobro text UNIQUE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  impreso boolean NOT NULL DEFAULT false,
  cobrado_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tickets_caja
  ADD COLUMN IF NOT EXISTS referencia_cobro text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_caja_referencia
  ON tickets_caja(referencia_cobro);

CREATE INDEX IF NOT EXISTS idx_tickets_caja_cliente_fecha
  ON tickets_caja(cliente_id, cobrado_at DESC);

ALTER TABLE tickets_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select_tickets_caja" ON tickets_caja;
DROP POLICY IF EXISTS "authenticated_insert_tickets_caja" ON tickets_caja;
CREATE POLICY "authenticated_select_tickets_caja" ON tickets_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tickets_caja" ON tickets_caja FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT ON tickets_caja TO authenticated;

-- Recupera cobros históricos que ya estaban marcados pagados antes de crear
-- tickets_caja. Agrupa cada comensal como un ticket y evita duplicados.
INSERT INTO tickets_caja(cliente_id, mesa, codigo_pedido, referencia_cobro, total, items, impreso, cobrado_at)
SELECT
  c.cliente_id,
  c.mesa,
  c.codigo_pedido,
  'historico:' || c.id::text,
  SUM(COALESCE(pr.precio, 0) * pq.cantidad),
  jsonb_agg(jsonb_build_object(
    'pedido_id', pq.id,
    'comensal_id', pq.comensal_id,
    'nombre', pr.nombre,
    'cantidad', pq.cantidad,
    'precio', COALESCE(pr.precio, 0),
    'subtotal', COALESCE(pr.precio, 0) * pq.cantidad
  )),
  false,
  MAX(pq.fecha_hora)
FROM comensales c
JOIN pedidos_qr pq ON pq.comensal_id = c.id AND pq.pagado = 1
LEFT JOIN productos pr ON pr.id = pq.producto_id
WHERE NOT EXISTS (
  SELECT 1 FROM tickets_caja tc WHERE tc.referencia_cobro = 'historico:' || c.id::text
)
GROUP BY c.id, c.cliente_id, c.mesa, c.codigo_pedido;

CREATE TABLE IF NOT EXISTS contadores_pedido_mesa0 (
  cliente_id uuid NOT NULL,
  fecha date NOT NULL,
  ultimo integer NOT NULL DEFAULT 0,
  PRIMARY KEY (cliente_id, fecha)
);

CREATE OR REPLACE FUNCTION generar_codigo_pedido_mesa0(p_cliente_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO contadores_pedido_mesa0(cliente_id, fecha, ultimo)
  VALUES (p_cliente_id, CURRENT_DATE, 1)
  ON CONFLICT (cliente_id, fecha)
  DO UPDATE SET ultimo = contadores_pedido_mesa0.ultimo + 1
  RETURNING ultimo INTO v_numero;

  RETURN to_char(CURRENT_DATE, 'DDMMYYYY') || '-' || lpad(v_numero::text, 2, '0') || '-M0';
END;
$$;

REVOKE ALL ON FUNCTION generar_codigo_pedido_mesa0(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generar_codigo_pedido_mesa0(uuid) TO anon, authenticated;

-- Código diario para cualquier mesa. Mesa 0: DDMMYYYY-01-M0.
-- Mesas 1+: DDMMYYYY-02-M1, DDMMYYYY-03-M2, etc.
CREATE OR REPLACE FUNCTION generar_codigo_pedido(p_cliente_id uuid, p_mesa integer DEFAULT 0)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
  v_codigo text;
BEGIN
  INSERT INTO contadores_pedido_mesa0(cliente_id, fecha, ultimo)
  VALUES (p_cliente_id, CURRENT_DATE, 1)
  ON CONFLICT (cliente_id, fecha)
  DO UPDATE SET ultimo = contadores_pedido_mesa0.ultimo + 1
  RETURNING ultimo INTO v_numero;

  v_codigo := to_char(CURRENT_DATE, 'DDMMYYYY') || '-' || lpad(v_numero::text, 2, '0') || '-M' || COALESCE(p_mesa, 0)::text;
  RETURN v_codigo;
END;
$$;

REVOKE ALL ON FUNCTION generar_codigo_pedido(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generar_codigo_pedido(uuid, integer) TO anon, authenticated;
