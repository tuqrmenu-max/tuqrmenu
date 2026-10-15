-- =====================================================
-- vendedores_activo.sql
-- Permite desactivar un vendedor sin borrarlo: no puede loguearse
-- pero sus datos (clientes que trajo, comisiones, historial) quedan intactos.
-- =====================================================

ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
