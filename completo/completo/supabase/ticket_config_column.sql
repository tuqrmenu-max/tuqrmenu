-- =====================================================
-- ticket_config_column.sql
-- La pantalla "Ticket" (TicketConfig.jsx) lee y escribe
-- clientes.ticket_config, pero esa columna nunca se creo con una
-- migracion -- por eso la pantalla queda vacia/colgada: la consulta
-- a una columna que no existe falla.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ticket_config jsonb DEFAULT '{}'::jsonb;
