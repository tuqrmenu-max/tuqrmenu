-- =====================================================
-- chat_equipo.sql
-- Chat interno del equipo (admin, cajero, mozo, cocina) para
-- coordinarse desde la pantalla de Mesas. Un chat por restaurante
-- (cliente_id), con texto e imágenes, y quién participa se elige
-- con un check por usuario.
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- =====================================================

-- 1) Quién participa del chat: se reutiliza cliente_usuarios (mozo,
--    cajero, cocina) y se agrega un flag para sumar/sacar gente sin
--    borrar la cuenta. El dueño (tabla clientes) siempre participa,
--    no necesita flag.
ALTER TABLE cliente_usuarios ADD COLUMN IF NOT EXISTS chat_activo boolean DEFAULT true;

-- 2) Mensajes del chat
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  autor_user_id uuid,
  autor_nombre text NOT NULL,
  autor_rol text NOT NULL,
  texto text,
  imagen_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_mensajes_cliente_idx ON chat_mensajes (cliente_id, created_at);

ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dueno o staff puede leer chat_mensajes" ON chat_mensajes;
DROP POLICY IF EXISTS "Dueno o staff puede escribir chat_mensajes" ON chat_mensajes;
DROP POLICY IF EXISTS "Dueno o staff puede borrar chat_mensajes" ON chat_mensajes;

CREATE POLICY "Dueno o staff puede leer chat_mensajes" ON chat_mensajes
  FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

CREATE POLICY "Dueno o staff puede escribir chat_mensajes" ON chat_mensajes
  FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));

-- Solo el dueño (o quien escribió el mensaje) lo puede borrar.
CREATE POLICY "Dueno o staff puede borrar chat_mensajes" ON chat_mensajes
  FOR DELETE TO authenticated USING (
    cliente_id IN (SELECT mis_clientes_ids())
    AND (autor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM clientes WHERE id = chat_mensajes.cliente_id AND user_id = auth.uid()))
  );

-- 3) (Opcional pero recomendado) Realtime: así los mensajes nuevos
--    aparecen solos sin depender solo del polling del frontend.
--    Si tu proyecto ya tiene la publicacion supabase_realtime, esto
--    solo agrega la tabla; si da error porque ya está agregada, se
--    puede ignorar.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensajes;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 4) Storage: las imágenes del chat se guardan en el bucket
--    "productos" que ya existe (mismo que usa la carta), bajo
--    "<cliente_id>/chat/...", así reutiliza las policies de storage
--    que ya tenga ese bucket para lectura pública / escritura
--    autenticada. No hace falta crear un bucket nuevo.

-- 5) Mensaje dirigido a una persona puntual (o a "Todos" si se deja
--    vacío). OJO: esto es solo una etiqueta visible tipo "Para: Fulano"
--    dentro del mismo chat grupal -- todos los que participan del chat
--    siguen viendo el mensaje igual, no es un chat privado 1 a 1. Si
--    en algún momento se necesita que el mensaje sea invisible para
--    el resto, hay que sumar una policy de SELECT distinta.
ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS destinatario_id uuid;
ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS destinatario_nombre text;
ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS destinatario_rol text;

-- 6) Permisos de tabla. Las policies RLS deciden qué restaurante puede
--    usar cada persona; estos GRANT habilitan la operación para usuarios
--    autenticados. Sin ellos, especialmente el mozo podía abrir el chat
--    pero sus SELECT/INSERT eran rechazados antes de evaluar la policy.
GRANT SELECT, INSERT, DELETE ON TABLE chat_mensajes TO authenticated;
GRANT SELECT ON TABLE cliente_usuarios TO authenticated;

-- Reinstalar las policies al final hace que este archivo sea autocontenido
-- incluso si se ejecutó antes que seguridad_rls_fix.sql.
DROP POLICY IF EXISTS "Dueno o staff puede leer chat_mensajes" ON chat_mensajes;
DROP POLICY IF EXISTS "Dueno o staff puede escribir chat_mensajes" ON chat_mensajes;

CREATE POLICY "Dueno o staff puede leer chat_mensajes" ON chat_mensajes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM clientes c WHERE c.id = chat_mensajes.cliente_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM cliente_usuarios cu WHERE cu.cliente_id = chat_mensajes.cliente_id AND cu.user_id = auth.uid() AND cu.activo IS NOT FALSE AND cu.chat_activo IS NOT FALSE)
    OR es_superadmin()
  );

CREATE POLICY "Dueno o staff puede escribir chat_mensajes" ON chat_mensajes
  FOR INSERT TO authenticated WITH CHECK (
    autor_user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM clientes c WHERE c.id = chat_mensajes.cliente_id AND c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM cliente_usuarios cu WHERE cu.cliente_id = chat_mensajes.cliente_id AND cu.user_id = auth.uid() AND cu.activo IS NOT FALSE AND cu.chat_activo IS NOT FALSE)
      OR es_superadmin()
    )
  );
