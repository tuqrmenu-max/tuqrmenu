-- =====================================================
-- mesas_propina_sesion.sql
-- Complementa mesas_propina.sql: además del monto, guarda de qué sesión
-- (mesa_<n>_sesion en localStorage del QR del comensal) vino la propina.
-- Con esto, Mesas/Caja pueden identificar con qué comensal (y por lo tanto
-- con qué color, mismo criterio que ya se usa para pintar sus pedidos) se
-- corresponde la propina cargada, para mostrarla en el ticket y en Caja.
-- Ejecutar en Supabase Dashboard -> SQL Editor (después de mesas_propina.sql).
-- =====================================================

ALTER TABLE mesas_operacion ADD COLUMN IF NOT EXISTS propina_sesion_id text;

NOTIFY pgrst, 'reload schema';
