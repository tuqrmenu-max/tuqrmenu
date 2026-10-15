-- =====================================================
-- socios_solicitud.sql
-- Tabla para el formulario "Hacete Socio" del menu publico
-- y envio de promociones desde DashSocios > Promos
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

-- Tabla de solicitudes del formulario del menu
CREATE TABLE IF NOT EXISTS socios_solicitud (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  nombre text,
  whatsapp text,
  instagram text,
  fecha timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE socios_solicitud ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert socios_solicitud" ON socios_solicitud;
DROP POLICY IF EXISTS "Authenticated can read socios_solicitud" ON socios_solicitud;
DROP POLICY IF EXISTS "Authenticated can delete socios_solicitud" ON socios_solicitud;

-- INSERT: anonimo (formulario desde el HTML del menu publico)
CREATE POLICY "Anyone can insert socios_solicitud"
  ON socios_solicitud FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: authenticated (dashboard del socio/admin)
CREATE POLICY "Authenticated can read socios_solicitud"
  ON socios_solicitud FOR SELECT
  TO authenticated
  USING (true);

-- DELETE: authenticated (limpiar solicitudes viejas)
CREATE POLICY "Authenticated can delete socios_solicitud"
  ON socios_solicitud FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- Columna para agendar envio de promociones
-- =====================================================
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS fecha_envio timestamptz DEFAULT NULL;
