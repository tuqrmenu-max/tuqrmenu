-- =====================================================
-- promociones_canje.sql
-- Agrega codigo de canje unico + estado de uso a
-- promociones_cliente, para poder validar en el local
-- que el cliente efectivamente usa la promo (y una sola vez).
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

-- Columnas nuevas (usa 'usada' para ser consistente con SuscripcionesAdmin.jsx,
-- que ya filtraba por promociones_cliente.usada/activa)
ALTER TABLE promociones_cliente ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE promociones_cliente ADD COLUMN IF NOT EXISTS usada boolean DEFAULT false;
ALTER TABLE promociones_cliente ADD COLUMN IF NOT EXISTS activa boolean DEFAULT true;
ALTER TABLE promociones_cliente ADD COLUMN IF NOT EXISTS fecha_uso timestamptz;

-- Generar codigo para filas que ya existan y no lo tengan
UPDATE promociones_cliente
SET codigo = 'PR-' || upper(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 6))
WHERE codigo IS NULL;

-- Default para que toda fila nueva (insertada desde la app) reciba
-- un codigo automaticamente, sin tener que tocar el codigo JS que inserta
ALTER TABLE promociones_cliente
  ALTER COLUMN codigo SET DEFAULT ('PR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)));

-- Codigo unico (colision practicamente imposible: ~16 millones de combinaciones)
CREATE UNIQUE INDEX IF NOT EXISTS promociones_cliente_codigo_key ON promociones_cliente (codigo);

-- Faltaba policy de UPDATE en promociones_cliente (se necesita para marcar
-- una promo como "usada" al validarla desde el dashboard del socio)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update promociones_cliente' AND tablename = 'promociones_cliente') THEN
    CREATE POLICY "Admin can update promociones_cliente" ON promociones_cliente FOR UPDATE USING (true);
  END IF;
END $$;
