# Caja: items, delivery, propina, mozo y repartidor

## Orden de despliegue
1. Ejecutar `supabase/tickets_caja_mozo_delivery.sql` en Supabase (SQL Editor). Es re-ejecutable.
2. Desplegar el front. **No al revés**: el cobro guarda las columnas nuevas y falla si no existen.
3. Usuarios → 🔒 Permisos por rol → 💰 Caja: tildar "Ver Caja" para los roles que deban consultar movimientos (por defecto solo el cajero la ve).

## Qué se guarda en `tickets_caja` (por cobro)
`items_total`, `delivery_monto`, `propina_monto`, `es_delivery`, `mozo_id/mozo_nombre`, `delivery_user_id/delivery_nombre`.
Los tickets anteriores se completan solos con el SQL (propina desde `items`; `es_delivery` desde `comensales.metodo_entrega`).
El costo de delivery y el repartidor de tickets viejos no existen como dato: quedan en 0 / sin asignar.

## Dónde se carga
Cuadro "Confirmar cobro" de Mesas:
- Mesas 1+: Propina $ (precargada con la que puso el comensal, editable) y Mozo.
- Pedidos Mesa 0 con delivery: Delivery $ (precargado con `clientes.delivery`, editable) y Repartidor. Retiro no lleva delivery.

## Dónde se consulta
Caja → filtros Mozo y Delivery ("Solo pedidos con delivery" o un repartidor). Totales de Items / Delivery / Propina / Total respetan los filtros.

## Rol delivery
Usuarios → Nuevo usuario → 🛵 Delivery (login `usuario@delivery.qrmenu.com` interno, igual que los demás roles). Ve la vista operativa de Mesas (lista Delivery/Retiro, sin precios).

## RPC
- `qr_equipo_operativo(p_cliente_id)`: lista mozos/repartidores. Necesaria porque por RLS un mozo/cajero solo lee su propia fila de `cliente_usuarios`.
- `qr_caja_resumen_v2` ahora recibe `p_mozo`, `p_delivery`, `p_solo_delivery` (con default) y devuelve `tickets_items/tickets_delivery/tickets_propina`.
