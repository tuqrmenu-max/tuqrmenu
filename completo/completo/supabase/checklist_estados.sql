-- ============================================================================
-- Checklist de estados para pedidos delivery/retiro (mesa 0)
-- ============================================================================
-- Flujo nuevo de checks visuales en MesasAdmin / CocinaPanel:
--   🟡 Amarillo: derivado a mozo/cocina  (en_preparacion)
--   🔵 Azul:     mozo/cocina terminó     (preparado)
--   🟣 Morado:   cajero despachó         (entregado)
--   🟢 Verde:    cliente recibió + comentario (cerrado)
--
-- Estados en comensales.estado_pedido:
--   'nuevo'           cliente envió, sin derivar
--   'en_preparacion'  derivado a mozo o cocina
--   'preparado'       mozo/cocina marcó listo
--   'entregado'       cajero despachó (delivery o retiro)
--   'cerrado'         cliente recibió + comentario guardado
-- ============================================================================

ALTER TABLE comensales
  ADD COLUMN IF NOT EXISTS preparado_at timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cerrado_at timestamptz,
  ADD COLUMN IF NOT EXISTS comentario_cliente text;

COMMENT ON COLUMN comensales.preparado_at        IS 'Timestamp cuando mozo/cocina marcó como preparado (check azul)';
COMMENT ON COLUMN comensales.entregado_at        IS 'Timestamp cuando cajero despachó el pedido (check morado)';
COMMENT ON COLUMN comensales.cerrado_at           IS 'Timestamp cuando se confirmó la recepción por el cliente (check verde)';
COMMENT ON COLUMN comensales.comentario_cliente  IS 'Comentario libre dejado por el cliente al confirmar recepción';
