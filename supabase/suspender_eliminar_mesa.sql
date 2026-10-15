-- =====================================================
-- suspender_eliminar_mesa.sql
-- Permite que el superadmin oculte, por restaurante (socio), el botón
-- "Eliminar mesa" (tanto el − de la barra superior como el 🗑️ de cada
-- tarjeta de mesa) dentro de DashSocios > Mesas.
-- El superadmin siempre conserva el botón, sin importar este check;
-- el check solo afecta lo que ve el socio (rol 'admin').
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ocultar_eliminar_mesa boolean DEFAULT false;
