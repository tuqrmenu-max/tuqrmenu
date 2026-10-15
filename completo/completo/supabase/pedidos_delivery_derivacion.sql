-- =====================================================
-- pedidos_delivery_derivacion.sql
-- Soporta pedidos de delivery/retiro (Mesa 0, sin QR de mesa física,
-- pedidos por WhatsApp) y el flujo de derivación caja -> mozo/cocina ->
-- caja -> delivery/retiro, siempre bajo el mismo código de pedido.
-- =====================================================

-- Datos del cliente que hace el pedido por WhatsApp (mesa 0), ya que no
-- hay número de mesa que lo identifique.
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS direccion text;

-- Código corto que identifica al pedido durante todo su recorrido
-- (caja -> mozo/cocina -> caja -> delivery/retiro). Se genera una sola
-- vez, al crear el pedido, y no cambia.
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS codigo_pedido text;

-- Estado del pedido dentro del flujo de preparación:
--   nuevo            -> recién llegó, caja todavía no lo derivó
--   en_preparacion   -> caja lo derivó a mozo o cocina (ver derivado_area)
--   listo            -> quien lo preparó ya lo marcó listo, vuelve a caja
--   completado       -> caja ya lo despachó (delivery o retiro) y se cobró
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS estado_pedido text DEFAULT 'nuevo';

-- A quién derivó caja/admin la preparación de este pedido.
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS derivado_area text; -- 'mozo' | 'cocina'

-- Cómo se despacha finalmente: delivery o retiro por el local.
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS metodo_entrega text; -- 'delivery' | 'retiro'

CREATE INDEX IF NOT EXISTS idx_comensales_estado_pedido ON comensales(cliente_id, mesa, estado_pedido);
