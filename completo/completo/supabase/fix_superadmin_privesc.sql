-- =====================================================
-- fix_superadmin_privesc.sql
--
-- VULNERABILIDAD CRITICA que corrige este archivo:
-- La funcion es_superadmin() (usada por casi TODAS las policies de
-- seguridad_rls_fix.sql) definia "superadmin" como:
--
--   "cualquier usuario autenticado que NO tenga fila en
--    vendedores, clientes ni cliente_usuarios"
--
-- Eso significa que CUALQUIER PERSONA que se registre con la anon key
-- (Supabase Auth permite sign-up publico por defecto, salvo que lo
-- hayas deshabilitado a mano en el dashboard) y no tenga perfil
-- creado todavia, pasa a ser tratada como superadmin por la base de
-- datos. Con eso podia, por ejemplo:
--   - Modificar o borrar la fila de CUALQUIER restaurante en `clientes`
--     (incluido el whatsapp -> redirigir pedidos a otro numero)
--   - Crear/editar/borrar `cliente_usuarios` de cualquier restaurante
--   - Leer/crear/borrar `vendedores` y `solicitudes_cliente`
-- El mismo defecto estaba duplicado en el frontend (src/hooks/useAuth.js
-- hacia setRol('superadmin') con la misma logica de "no tiene perfil").
--
-- Este archivo reemplaza esa logica por una lista explicita
-- (tabla `superadmins`), que es el patron correcto: nadie es
-- superadmin "por descarte", solo quien esta admitido a mano.
-- =====================================================

-- 1) Tabla explicita de superadmins
CREATE TABLE IF NOT EXISTS superadmins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- Un usuario logueado puede consultar UNICAMENTE su propia fila (lo
-- que useAuth.js necesita para saber "¿soy superadmin?"), pero no puede
-- ver la lista completa de superadmins ni insertar/editar/borrar nada:
-- eso sigue bloqueado para todos desde el cliente, solo se toca a mano
-- desde el SQL Editor de Supabase (service role, no pasa por RLS).
DROP POLICY IF EXISTS "Nadie puede leer superadmins desde el cliente" ON superadmins;
DROP POLICY IF EXISTS "Uno mismo puede verificar si es superadmin" ON superadmins;
CREATE POLICY "Uno mismo puede verificar si es superadmin" ON superadmins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2) Redefinir es_superadmin() para que chequee la tabla explicita
--    en vez de "no tener perfil en otras tablas"
CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM superadmins WHERE user_id = auth.uid())
$$;

-- =====================================================
-- PASO MANUAL OBLIGATORIO (correlo una sola vez, con TU usuario real):
--
--   insert into superadmins (user_id)
--   values ('PEGA-ACA-TU-USER-ID-DE-AUTH');
--
-- Para conseguir tu user_id: Supabase Dashboard -> Authentication ->
-- Users -> copia el UUID de tu cuenta de superadmin (la que usás
-- para entrar a /admin hoy).
--
-- Si tenes mas de una persona que debe ser superadmin, repeti el
-- insert con cada user_id.
-- =====================================================
