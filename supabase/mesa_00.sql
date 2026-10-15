-- =====================================================
-- mesa_00.sql  (re-ejecutable, no borra ni modifica datos)
-- Mesa 00 = clientes que no se quedan en el local. En la base se guarda como mesa = -1
-- (comensales.mesa, tickets_caja.mesa, mesas_operacion.mesa son integer y "00" no se distingue de "0").
--
-- Si alguna de esas tablas tiene un CHECK que obliga a mesa >= 0, rechazaría la Mesa 00.
-- Este script reemplaza solo ese tipo de CHECK por "mesa >= -1". Si no hay ninguno, no hace nada.
-- =====================================================
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT rel.relname AS tabla, con.conname AS nombre
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname IN ('comensales', 'tickets_caja', 'mesas_operacion')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* '\(*\s*"?mesa"?\s*>=?\s*\(?0\)?\s*\)*$'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.tabla, c.nombre);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (mesa >= -1) NOT VALID', c.tabla, c.nombre);
    RAISE NOTICE 'CHECK % de % ahora permite Mesa 00', c.nombre, c.tabla;
  END LOOP;
END $$;
