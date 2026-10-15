# Buscar producto + Mesa 00

## Despliegue
1. (Recomendado, re-ejecutable) correr `supabase/mesa_00.sql` en el SQL Editor de Supabase. Solo actúa si alguna tabla tiene un CHECK que prohíbe mesa negativa.
2. Desplegar el front. No hace falta re-exportar los menús: el link Mesa 00 funciona con los menús ya publicados.

## Buscar producto (Mesas, arriba de todo; visible para superadmin, admin y cajero)
- Escribís el nombre (sin importar tildes/mayúsculas) y elegís el producto de la Carta (la cargada con el Excel). Enter elige el primero. El botón ↻ recarga Carta y promos.
- Cada producto muestra su precio, un check (incluir / no incluir) y la cantidad; el importe = precio × cantidad.
- Promos: aparecen las vigentes (día, horario, cupo y fecha de envío) que aplican al producto. 2x1: la cantidad pasa a ser "promos" (llevás 2, pagás 1 por cada una), igual que el menú QR.
- Destino: Mesa 1..N o "Mesa 00 · Para llevar" (con nombre opcional). Mesa 00 no ocupa ninguna mesa.
- Mesas 1+: se suma a un comensal "Pedido del local" de esa mesa; se cobra como siempre.

## Mesa 00
- Link `https://<tu-dominio>/menu/<token>?mesa=00` (en Mesas: "🥡 Mesa 00 · Para llevar" → Copiar link / QR; también sale en "Descargar todos QR").
- Mismo menú que Mesa 0 (nombre, teléfono, delivery/retiro, promos), pero NO abre WhatsApp: guarda el pedido y muestra "¡Pedido enviado!". Si falla, devuelve el carrito.
- Los pedidos (del link o de Buscar producto) aparecen en la sección "🥡 Mesa 00" (no hay cuadradito), con las mismas acciones que Delivery/Retiro: derivar a Mozo/Cocina, checklist, Cobrar.
- Al cobrar, el ticket queda en Caja como Mesa 00 (código DDMMYYYY-NN-M00). En el filtro Mesa de Caja se escribe `00`.

## Archivos
Nuevos: `src/lib/mesa00.js`, `src/lib/mesa00Menu.js`, `src/pages/admin/DashSocios/components/BuscarProductoMesa.jsx`, `supabase/mesa_00.sql`, `tests/mesa00.test.mjs`.
Retoques mínimos: `MesasAdmin.jsx`, `MenuView.jsx`, `CajaReportes.jsx` (etiqueta/filtro 00), `CocinaPanel.jsx` (también lee Mesa 00), `ChecklistEstados.jsx` (1 línea: Mesa 00 se comporta como Mesa 0).

## Limitación conocida (ya existía)
Las promos de descuento % no se descuentan en Mesas/Caja ni para pedidos del QR (el sistema solo calcula 2x1). Por eso en Buscar producto aparecen deshabilitadas, para no mostrar un importe que luego no se cobra.
