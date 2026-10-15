-- Ejecutar antes de desplegar esta versión. No borra ni modifica tickets anteriores.
BEGIN;
ALTER TABLE public.tickets_caja ADD COLUMN IF NOT EXISTS cobrado_por jsonb;
COMMENT ON COLUMN public.tickets_caja.cobrado_por IS
  'Snapshot del usuario que confirmó el cobro: user_id, nombre y usuario. NULL en tickets históricos sin autor registrado.';
NOTIFY pgrst, 'reload schema';
COMMIT;
