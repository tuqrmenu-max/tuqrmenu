-- =====================================================
-- mesas_acciones_permisos.sql
-- Permisos más finos DENTRO de la sección "Mesas": además de decidir
-- qué secciones ve cada rol (permisos_roles), esto controla qué
-- botones concretos ve dentro de Mesas: agregar mesas (crear mesas),
-- chat, descargar todos los QR y borrar mesa.
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS permisos_mesas_acciones jsonb DEFAULT
  '{"mozo": ["chat"], "cajero": ["agregar_mesa", "chat", "descargar_qr"], "cocina": ["chat"]}'::jsonb;

NOTIFY pgrst, 'reload schema';
