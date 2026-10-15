-- =====================================================
-- permisos_roles_staff.sql
-- Permite que el dueño de un restaurante elija, para mozo/cajero/cocina,
-- que secciones del panel puede ver cada rol (Mesas, Carta, Caja,
-- Promociones, Suscriptos, Ticket, Usuarios).
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS permisos_roles jsonb DEFAULT
  '{"mozo": ["mesas"], "cajero": ["mesas", "caja"], "cocina": ["mesas"]}'::jsonb;
