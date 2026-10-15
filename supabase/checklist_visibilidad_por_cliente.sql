-- Visibilidad individual del checklist para cada cliente/comensal de una mesa.
-- Seguro para ejecutar varias veces; no elimina ni modifica pedidos existentes.
ALTER TABLE comensales
  ADD COLUMN IF NOT EXISTS ocultar_checklist boolean NOT NULL DEFAULT false;
