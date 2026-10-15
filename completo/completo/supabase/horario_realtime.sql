-- =====================================================
-- horario_realtime.sql
-- Ejecutar en Supabase Dashboard -> SQL Editor.
--
-- Antes, la pantalla Horario volvía a pedir TODO el historial cada 5
-- segundos para enterarse de un login/logout nuevo. Ahora escucha estos
-- cambios en vivo por Realtime (mismo mecanismo que ya usa el Chat del
-- equipo) y solo actualiza esa fila puntual, sin volver a traer todo.
-- Sin este paso, la tabla queda igual de funcional (login/logout se
-- siguen guardando bien), pero la pantalla Horario no se va a actualizar
-- sola hasta que alguien la recargue a mano.
-- =====================================================

-- 1) Sumar horario_usuarios a la publicacion de Realtime (si tu proyecto
--    ya la tiene agregada, esto no rompe nada, se ignora el error).
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.horario_usuarios;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 2) Realtime necesita poder leer el estado previo de la fila para poder
--    armar el evento de UPDATE/DELETE completo.
ALTER TABLE public.horario_usuarios REPLICA IDENTITY FULL;
