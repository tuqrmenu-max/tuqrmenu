-- =====================================================
-- mesas_propina.sql
-- Agrega la columna donde el menú público guarda la propina que el
-- comensal eligió (monto fijo o % del subtotal) para la mesa en la que
-- está sentado. Se guarda por mesa (no por comensal individual) porque
-- una misma mesa puede recibir varios "envíos" de pedido y la propina es
-- sobre la cuenta completa, no sobre un envío puntual.
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- =====================================================

ALTER TABLE mesas_operacion ADD COLUMN IF NOT EXISTS propina_monto numeric DEFAULT 0;

NOTIFY pgrst, 'reload schema';
