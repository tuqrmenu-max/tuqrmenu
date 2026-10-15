-- =====================================================
-- fix_rol_cocina.sql
-- La tabla cliente_usuarios tiene un CHECK constraint en la columna
-- "rol" que quedó definido antes de agregar el rol "cocina" a la UI
-- (UsuariosStaff.jsx). Por eso el INSERT devuelve 400 al crear un
-- usuario de cocina, aunque mozo/cajero funcionan bien.
-- Este script busca ese constraint (sea cual sea su nombre) y lo
-- reemplaza por uno que permita mozo, cajero y cocina.
-- =====================================================

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
  CHECK (rol IN ('mozo', 'cajero', 'cocina'));
