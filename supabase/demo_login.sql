-- =====================================================
-- demo_login.sql
-- Cambia SOLO el login del cajero demo:
--   antes:  cajerobardemo  (cajerobardemo@caja.qrmenu.com)
--   ahora:  usuario "demo" / contraseña "demo"
--
-- Ejecutar en Supabase -> SQL Editor. Es idempotente (se puede correr
-- mas de una vez) y no toca user_id, cliente_id, rol, turnos, caja ni mesas.
-- No hace falta cambiar codigo de la app: el login ya resuelve "usuario"
-- (sin @) via resolver_login_usuario().
-- =====================================================

DO $$
DECLARE
  v_email_actual text := 'cajerobardemo@caja.qrmenu.com';
  v_usuario_nuevo text := 'demo';
  v_password_nueva text := 'demo';
  v_user_id uuid;
  v_filas int;
BEGIN
  -- 1) La cuenta tiene que existir en Auth y en cliente_usuarios
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email_actual;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe % en auth.users. No se cambio nada.', v_email_actual;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cliente_usuarios WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'No hay fila en cliente_usuarios para %. No se cambio nada.', v_email_actual;
  END IF;

  -- 2) "usuario" es unico en toda la plataforma: que no lo use otra cuenta
  IF EXISTS (
    SELECT 1 FROM cliente_usuarios
    WHERE lower(usuario) = lower(v_usuario_nuevo) AND user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya lo usa otra cuenta. No se cambio nada.', v_usuario_nuevo;
  END IF;

  -- 3) Nuevo nombre de login
  UPDATE cliente_usuarios
     SET usuario = v_usuario_nuevo
   WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RAISE NOTICE 'cliente_usuarios actualizado (% fila/s)', v_filas;

  -- 4) Nueva contraseña. Se escribe directo el hash bcrypt porque la API de
  --    Auth rechaza contraseñas de menos de 6 caracteres ("demo" tiene 4);
  --    al iniciar sesion ese minimo no se valida, asi que entra igual.
  UPDATE auth.users
     SET encrypted_password = extensions.crypt(v_password_nueva, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = v_user_id;
  RAISE NOTICE 'Contraseña actualizada';
END $$;

-- Verificacion: debe devolver el email interno de la cuenta demo
SELECT resolver_login_usuario('demo') AS email_interno;

-- Verificacion: la fila del cajero demo
SELECT cu.usuario, cu.email, cu.rol, cu.activo, cu.cliente_id
FROM cliente_usuarios cu
WHERE lower(cu.usuario) = 'demo';

-- =====================================================
-- OPCIONAL (NO necesario): cambiar el dominio @caja.qrmenu.com.
-- El email nunca se ve en el login. Si igual lo queres, hay que cambiar
-- los DOS lugares a la vez, o el login se rompe. Descomentar y ajustar:
--
-- BEGIN;
--   UPDATE auth.users
--      SET email = 'demo@TU-DOMINIO.com', updated_at = now()
--    WHERE email = 'cajerobardemo@caja.qrmenu.com';
--   UPDATE auth.identities
--      SET identity_data = jsonb_set(identity_data, '{email}', '"demo@TU-DOMINIO.com"'),
--          updated_at = now()
--    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@TU-DOMINIO.com');
--   UPDATE cliente_usuarios
--      SET email = 'demo@TU-DOMINIO.com'
--    WHERE email = 'cajerobardemo@caja.qrmenu.com';
-- COMMIT;
-- =====================================================
