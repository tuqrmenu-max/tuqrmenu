-- Permite que admin/superadmin oculten el checklist en el QR menu y en Mesas.
-- Seguro para ejecutar varias veces; no elimina ni modifica pedidos existentes.
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS ocultar_checklist boolean NOT NULL DEFAULT false;

ALTER TABLE comensales
  ADD COLUMN IF NOT EXISTS ocultar_checklist boolean NOT NULL DEFAULT false;
