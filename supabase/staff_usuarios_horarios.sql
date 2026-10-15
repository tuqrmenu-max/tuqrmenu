-- =====================================================
-- staff_usuarios_horarios.sql
-- Agrega lo necesario para que el dueño de un restaurante pueda crear
-- cuentas de mozo/cocina/cajero con usuario+contraseña (no email) y
-- asignarles turnos de trabajo.
-- =====================================================

-- 1) Columnas nuevas en cliente_usuarios
ALTER TABLE cliente_usuarios ADD COLUMN IF NOT EXISTS usuario text;
ALTER TABLE cliente_usuarios ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
ALTER TABLE cliente_usuarios ADD COLUMN IF NOT EXISTS horarios jsonb DEFAULT '[]'::jsonb;

-- El "usuario" (nombre de login corto) tiene que ser unico en toda la
-- plataforma, porque lo usamos para resolverlo a un email interno.
CREATE UNIQUE INDEX IF NOT EXISTS cliente_usuarios_usuario_unq
  ON cliente_usuarios (lower(usuario)) WHERE usuario IS NOT NULL;

-- 2) RPC para el login: el staff escribe su "usuario" (ej. "juan"), el
--    login primero resuelve a que email interno corresponde (creado como
--    usuario+"@staff.<random>.tuqrmenu.local" al momento de crearlo) y
--    recien ahi se llama signInWithPassword con ese email.
--    SECURITY DEFINER porque cliente_usuarios tiene RLS y un anon no
--    logueado no puede leerla directo; esta funcion es de solo lectura,
--    no expone nada mas que el email que ya conoce como propio.
CREATE OR REPLACE FUNCTION resolver_login_usuario(p_usuario text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM cliente_usuarios
  WHERE lower(usuario) = lower(trim(p_usuario))
    AND coalesce(activo, true) = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION resolver_login_usuario(text) TO anon, authenticated;
