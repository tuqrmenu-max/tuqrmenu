-- =====================================================
-- alias_column.sql
--
-- Arregla el error al "Guardar datos de contacto" en Carta (admin) y en
-- el Builder:
--
--   PGRST204: Could not find the '<columna>' column of 'clientes' in the
--   schema cache
--
-- El codigo (CartaAdmin.jsx, Builder.jsx) lee/escribe estas columnas de
-- `clientes`: whatsapp, instagram, direccion, horario, alias, delivery.
-- Se fue viendo, una por una, que iban faltando en la tabla real (primero
-- 'alias', despues 'delivery'). Para no repetir el ciclo, este script
-- agrega TODAS de una sola vez, con IF NOT EXISTS: las que ya existen no
-- se tocan ni pierden datos, solo se crean las que faltan.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp   text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS instagram  text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion  text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario    text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS alias      text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS delivery   numeric DEFAULT 0;

-- Fuerza a PostgREST a refrescar su cache de esquema ahora mismo, para
-- no tener que esperar a que lo haga solo (normalmente tarda unos
-- segundos a un par de minutos).
NOTIFY pgrst, 'reload schema';

