-- =====================================================
-- suscripciones_form.sql
-- El formulario "Hacete Socio" del menu publico ahora
-- inserta directamente en la tabla suscripciones
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

-- Columna instagram (suscripciones no la tenia)
ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS instagram text;

-- El formulario inserta como anonimo desde el HTML del menu publico
DROP POLICY IF EXISTS "Anyone can insert suscripciones" ON suscripciones;
CREATE POLICY "Anyone can insert suscripciones"
  ON suscripciones FOR INSERT
  TO public
  WITH CHECK (true);

GRANT INSERT ON TABLE suscripciones TO anon, authenticated;

-- =====================================================
-- OPCIONAL: migrar solicitudes previas de socios_solicitud
-- Descomentar para ejecutar una sola vez:
-- =====================================================
-- INSERT INTO suscripciones (cliente_id, nombre, whatsapp, instagram)
-- SELECT cliente_id, nombre, whatsapp, instagram
-- FROM socios_solicitud
-- WHERE cliente_id IS NOT NULL;
