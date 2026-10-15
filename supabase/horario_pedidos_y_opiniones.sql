-- =====================================================
-- horario_pedidos_y_opiniones.sql
--
-- 1) Agrega a `clientes` el horario de atención para PEDIDOS
--    (distinto del campo `horario` de texto libre que ya existía,
--    que es solo informativo). Este es estructurado (día por día,
--    con franjas horarias) para poder chequearlo en el momento de
--    tocar "Enviar Pedido" en el menú público.
--
-- 2) Crea la tabla `opiniones`: cuando alguien intenta pedir fuera
--    de horario, el menú le muestra el horario configurado y le
--    permite dejar una opinión/consulta. Esa opinión se guarda acá
--    (y también se abre WhatsApp) para que el dueño/staff la vea y
--    responda desde Suscriptos > Opiniones.
--
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- Requiere haber ejecutado antes supabase/seguridad_rls_fix.sql
-- (usa las funciones mis_clientes_ids() y es_superadmin()).
-- =====================================================

-- =====================================================
-- 1) Horario de pedidos en `clientes`
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_pedidos_activo boolean DEFAULT false;

-- Formato de horario_pedidos: un objeto con una clave por día de la
-- semana ("0" = Domingo ... "6" = Sábado). Cada día es un array de
-- franjas {desde,hasta} en formato "HH:MM" (24hs). Array vacío = día
-- cerrado. Se admite más de una franja por día (ej: mediodía y noche).
-- Si "hasta" es menor o igual a "desde" se interpreta que la franja
-- cruza la medianoche (ej: 20:00 a 02:00).
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_pedidos jsonb DEFAULT '{
  "0": [],
  "1": [{"desde":"11:00","hasta":"23:00"}],
  "2": [{"desde":"11:00","hasta":"23:00"}],
  "3": [{"desde":"11:00","hasta":"23:00"}],
  "4": [{"desde":"11:00","hasta":"23:00"}],
  "5": [{"desde":"11:00","hasta":"23:00"}],
  "6": [{"desde":"11:00","hasta":"23:00"}]
}'::jsonb;

-- =====================================================
-- 2) Tabla `opiniones`
-- =====================================================

CREATE TABLE IF NOT EXISTS opiniones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  whatsapp text,
  mensaje text,
  mesa integer,
  respondida boolean DEFAULT false,
  respuesta text,
  respondida_en timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opiniones_cliente_id_idx ON opiniones(cliente_id);

ALTER TABLE opiniones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert opiniones" ON opiniones;
DROP POLICY IF EXISTS "Dueno o staff o superadmin puede leer opiniones" ON opiniones;
DROP POLICY IF EXISTS "Dueno o staff o superadmin puede editar opiniones" ON opiniones;
DROP POLICY IF EXISTS "Dueno o staff o superadmin puede borrar opiniones" ON opiniones;

-- INSERT: anónimo (se manda desde el menú público cuando el pedido
-- está fuera de horario, sin necesidad de haber iniciado sesión)
CREATE POLICY "Anyone can insert opiniones"
  ON opiniones FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT / UPDATE / DELETE: dueño del restaurante, su staff, o superadmin
CREATE POLICY "Dueno o staff o superadmin puede leer opiniones"
  ON opiniones FOR SELECT
  TO authenticated
  USING (cliente_id IN (SELECT mis_clientes_ids()) OR es_superadmin());

CREATE POLICY "Dueno o staff o superadmin puede editar opiniones"
  ON opiniones FOR UPDATE
  TO authenticated
  USING (cliente_id IN (SELECT mis_clientes_ids()) OR es_superadmin())
  WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()) OR es_superadmin());

CREATE POLICY "Dueno o staff o superadmin puede borrar opiniones"
  ON opiniones FOR DELETE
  TO authenticated
  USING (cliente_id IN (SELECT mis_clientes_ids()) OR es_superadmin());

GRANT INSERT ON TABLE opiniones TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE opiniones TO authenticated;
