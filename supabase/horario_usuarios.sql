-- Ejecutar antes de desplegar. Registro por sesión, horas del servidor y RLS.
BEGIN;
CREATE TABLE IF NOT EXISTS public.horario_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sesion_id uuid NOT NULL,
  nombre text NOT NULL,
  usuario text NOT NULL,
  rol text NOT NULL,
  entrada_at timestamptz NOT NULL DEFAULT now(),
  salida_at timestamptz,
  UNIQUE (cliente_id, sesion_id),
  CHECK (salida_at IS NULL OR salida_at >= entrada_at)
);
ALTER TABLE public.horario_usuarios ADD COLUMN IF NOT EXISTS ultima_actividad_at timestamptz;
CREATE INDEX IF NOT EXISTS horario_usuarios_cliente_fecha ON public.horario_usuarios(cliente_id, entrada_at DESC);
ALTER TABLE public.horario_usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horario_usuarios FROM anon, authenticated;
GRANT SELECT ON public.horario_usuarios TO authenticated;
DROP POLICY IF EXISTS horario_usuarios_lectura ON public.horario_usuarios;
CREATE POLICY horario_usuarios_lectura ON public.horario_usuarios FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = horario_usuarios.cliente_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.superadmins s WHERE s.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.registrar_entrada_horario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sesion uuid := NULLIF(auth.jwt()->>'session_id', '')::uuid;
  v_ingreso timestamptz;
BEGIN
  IF v_user IS NULL OR v_sesion IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión autenticada' USING ERRCODE = '42501';
  END IF;
  -- Hora real en que Supabase creó esta sesión, incluso tras una recarga.
  SELECT created_at INTO v_ingreso FROM auth.sessions
  WHERE id = v_sesion AND user_id = v_user;
  IF v_ingreso IS NULL THEN
    RAISE EXCEPTION 'No se encontró la sesión de Supabase' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.horario_usuarios(cliente_id, user_id, sesion_id, nombre, usuario, rol, entrada_at)
  SELECT c.id, v_user, v_sesion,
    COALESCE(NULLIF(to_jsonb(c)->>'nombre', ''), auth.jwt()->>'email', 'Administrador'),
    COALESCE(auth.jwt()->>'email', ''), 'admin', v_ingreso
  FROM public.clientes c WHERE c.user_id = v_user
  UNION ALL
  SELECT cu.cliente_id, v_user, v_sesion,
    COALESCE(NULLIF(cu.nombre, ''), NULLIF(cu.usuario, ''), auth.jwt()->>'email', 'Usuario'),
    COALESCE(NULLIF(cu.usuario, ''), auth.jwt()->>'email', ''), cu.rol::text, v_ingreso
  FROM public.cliente_usuarios cu
  WHERE cu.user_id = v_user AND cu.activo IS DISTINCT FROM false
  ON CONFLICT (cliente_id, sesion_id) DO NOTHING;
  UPDATE public.horario_usuarios SET ultima_actividad_at = now()
  WHERE user_id = v_user AND sesion_id = v_sesion AND salida_at IS NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.registrar_salida_horario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión autenticada' USING ERRCODE = '42501';
  END IF;
  -- signOut global cierra las sesiones del usuario en todos sus dispositivos.
  UPDATE public.horario_usuarios SET salida_at = now()
  WHERE user_id = auth.uid() AND salida_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_entrada_horario() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_salida_horario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_horario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_salida_horario() TO authenticated;
CREATE OR REPLACE FUNCTION public.actualizar_presencia_horario()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.horario_usuarios SET ultima_actividad_at = now()
  WHERE user_id = auth.uid()
    AND sesion_id = NULLIF(auth.jwt()->>'session_id', '')::uuid
    AND salida_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.actualizar_presencia_horario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_presencia_horario() TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Registro desde Supabase Auth para dueños y personal, incluso sin frontend actualizado.
CREATE OR REPLACE FUNCTION public.horario_registrar_sesion_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  INSERT INTO public.horario_usuarios
    (cliente_id,user_id,sesion_id,nombre,usuario,rol,entrada_at,ultima_actividad_at)
  SELECT c.id,NEW.user_id,NEW.id,
    COALESCE(NULLIF(to_jsonb(c)->>'nombre',''),v_email,'Administrador'),
    COALESCE(v_email,''),'admin',COALESCE(NEW.created_at,now()),now()
  FROM public.clientes c WHERE c.user_id=NEW.user_id
  UNION ALL
  SELECT cu.cliente_id,NEW.user_id,NEW.id,
    COALESCE(NULLIF(cu.nombre,''),NULLIF(cu.usuario,''),v_email,'Usuario'),
    COALESCE(NULLIF(cu.usuario,''),v_email,''),cu.rol::text,
    COALESCE(NEW.created_at,now()),now()
  FROM public.cliente_usuarios cu
  WHERE cu.user_id=NEW.user_id AND cu.activo IS DISTINCT FROM false
  ON CONFLICT(cliente_id,sesion_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.horario_registrar_sesion_auth() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS horario_sesion_creada ON auth.sessions;
CREATE TRIGGER horario_sesion_creada AFTER INSERT ON auth.sessions
FOR EACH ROW EXECUTE FUNCTION public.horario_registrar_sesion_auth();

-- Lista cerrada: dueño ve su personal, staff solo su propio registro.
CREATE OR REPLACE FUNCTION public.horario_personal(p_cliente_id uuid)
RETURNS TABLE(id uuid,user_id uuid,nombre text,usuario text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cu.id,cu.user_id,cu.nombre::text,cu.usuario::text
  FROM public.cliente_usuarios cu
  WHERE cu.cliente_id=p_cliente_id AND auth.uid() IS NOT NULL
    AND (
      cu.user_id=auth.uid()
      OR EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=p_cliente_id AND c.user_id=auth.uid())
      OR EXISTS(SELECT 1 FROM public.superadmins s WHERE s.user_id=auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.horario_personal(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.horario_personal(uuid) TO authenticated;

DROP POLICY IF EXISTS horario_usuarios_lectura ON public.horario_usuarios;
CREATE POLICY horario_usuarios_lectura ON public.horario_usuarios FOR SELECT TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=horario_usuarios.cliente_id AND c.user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.superadmins s WHERE s.user_id=auth.uid())
  OR (user_id=auth.uid() AND EXISTS(
    SELECT 1 FROM public.cliente_usuarios cu
    WHERE cu.cliente_id=horario_usuarios.cliente_id AND cu.user_id=auth.uid()
  ))
);
NOTIFY pgrst,'reload schema';
COMMIT;
