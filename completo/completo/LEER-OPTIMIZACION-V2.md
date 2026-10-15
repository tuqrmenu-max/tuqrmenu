# QRMenu — optimización de tráfico v2 (15/09/2026)

Esta entrega parte de `qrmenu-optimizado(1).zip`. Incluye el proyecto completo y conserva las mejoras anteriores. El SQL y el despliegue de esta entrega todavía deben aplicarse en tu Supabase/Vercel.

## Aplicación

1. Conservá un respaldo de tu proyecto y base actuales.
2. Cuando Supabase permita operar, ejecutá completo **`supabase/optimizar_trafico_v2.sql`** en SQL Editor. Es una transacción reejecutable; si falla, no despliegues este frontend y compartí el error. Necesita las tablas del proyecto anterior, incluidas Horario, Chat y Tickets. No ejecutes todos los SQL históricos de la carpeta.
3. Desplegá este proyecto con las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca uses service_role en el navegador.
4. Entrá a **Diseño → Guardar proyecto** en cada restaurante para regenerar el HTML del QR con el seguimiento nuevo. Las direcciones de los QR no cambian. Las pestañas de clientes que ya estaban abiertas necesitan recargarse para usar la nueva versión.
5. Si todavía hay imágenes base64 antiguas, mantené el procedimiento anterior de `LEER-OPTIMIZACION.md`: preparar Storage, **Carta → Reducir peso de imágenes**, reabrir Diseño y guardar. Esta conversión es separada del SQL v2.
6. Probá los recorridos de la sección de validación antes de utilizarlo con clientes reales.

## Qué cambia

| Área | Comportamiento nuevo |
|---|---|
| Mesas | Cada 5 segundos más el tiempo de respuesta consulta una versión pequeña. Recarga su conjunto operativo solo si cambió. Omite comensales cerrados en tarjetas de mesas físicas; conserva entregados pendientes de cobro. |
| Cocina | El mismo mecanismo, con intervalos de 4 segundos. |
| QR | Cada 6 segundos consulta el estado y la versión de los productos del comensal. Vuelve a leer productos solo al cambiar la versión o tras una acción explícita del cliente. Al cerrar el pedido deja de consultar; un envío nuevo o abrir Mi pedido reactiva la lectura. |
| Campana | Conserva 3 segundos cuando espera atención, evitando consultas superpuestas. |
| Catálogo | Una versión transaccional invalida la caché al insertar, modificar o eliminar productos/categorías. La primera visita obtiene el catálogo; visitas siguientes en el mismo navegador lo reutilizan si no cambió. |
| Imágenes | Se mantienen WebP y URLs anteriores; categorías/productos del HTML usan carga diferida. La conversión de imágenes antiguas no las recomprime. |
| Chat | Últimos 50 mensajes al abrir; después solo mensajes nuevos. Botón para cargar 50 anteriores. Realtime se conserva y el respaldo visible sigue cada 15 segundos. |
| Caja | Tickets en páginas de 25. Totales, número de tickets, importe del turno y categorías se calculan en servidor sobre todo el rango. Ya no descarga todos los comensales ni todas las líneas para sumar. |
| Horario | Abre en hoy, con páginas de 50 registros. Totales completos por usuario en servidor. El verde considera sesiones abiertas de cualquier fecha, aunque el filtro muestre otro día. Limpiar filtro permite consultar todo el historial. |
| Socios/Configuración | Lecturas de campos concretos, sin descargar los JSON completos del Builder cuando no hacen falta. |

La implementación de Mesas/Cocina invalida el **conjunto operativo del restaurante**, no cada tarjeta por separado. Si hay cambios continuos, ese conjunto puede recargarse con frecuencia. Esta entrega prioriza consistencia sin depender de que Realtime esté habilitado para pedidos. Un parche por tarjeta sería un paso posterior si la medición lo justifica.

## Versiones y permisos

El SQL agrega cuatro contadores en clientes (`qr_catalog_version`, `qr_operations_version`, `qr_horario_version`, `qr_chat_version`), `qr_order_version` en comensales y `qr_sequence` en chat_mensajes. Los triggers avanzan contadores en la misma transacción que la modificación original; una transacción fallida no publica cambios de versión.

Las RPC de lectura son **SECURITY INVOKER**: usan los permisos/RLS existentes del llamante. No se amplían políticas, no se desactiva RLS ni se borran registros. Los triggers tienen SECURITY DEFINER y search_path fijo para poder invalidar versiones tras escrituras autorizadas. Se revoca su ejecución directa para public/anon/authenticated.

La secuencia del chat se asigna bajo bloqueo de la fila del restaurante. Evita que un mensaje se pierda por tener una fecha anterior a otro que terminó de guardarse primero. Los mensajes anteriores quedan con secuencia 0 y conservan su orden por fecha e ID. El chat existente no ofrece edición/borrado de mensajes; la lectura incremental cubre altas, no sincronización de ediciones externas de mensajes antiguos.

No se envían precios, pedidos o totales privados a la caché persistente: solo el catálogo público. Su clave incluye backend y restaurante. Si el navegador no permite guardar o la copia supera el límite local, se lee online. Una descarga fallida no reemplaza una copia válida ni se presenta como actualización exitosa.

## Comportamientos conservados

- Entregado no cobra: solo Cobrar/Imprimir mantienen el cierre de caja.
- Retiro de Mesa 0 omite Delivery. Delivery conserva sus pasos.
- Checklist individual, campana, códigos de pedido, usuarios de caja y turnos partidos/nocturnos.
- Diseño, barra superior, controles X/Y/zoom y direcciones de QR.
- Totales de Caja mantienen la fórmula anterior: las líneas `es_promo` aportan a descuento/promoción. No se redefinió el significado contable de esos indicadores.
- Horario suma duraciones positivas de sesiones cerradas cuya entrada corresponde al rango, igual que antes. No inventa salidas ni atribuye horas a sesiones abiertas.
- Los roles y las RLS reales siguen siendo la autoridad. La prueba local de aislamiento no sustituye verificar la configuración real de Supabase.

## Verificación realizada

- Compilación de producción aprobada; permanecen avisos de bundle grande/importación mixta preexistentes.
- 14 pruebas Node aprobadas: versiones, concurrencia/reintentos, caché, cursores, fechas, seguimiento QR, HTML exportado, autenticación, imágenes, guardado y paginación del lector previo.
- SQL ejecutado dos veces en PostgreSQL embebido PGlite con esquema representativo: reejecución, rollback de versiones, compatibilidad detalle/descripcion, cambios de productos/pedidos, cierre, 70 tickets con totales completos, turnos partidos/nocturnos, sesiones abiertas fuera del filtro y RLS de lectura.
- Prueba visual: no ejecutada; Chromium no estaba instalado y su descarga no estuvo disponible en este entorno. Se incluye `tests/browser-v2-check.mjs` con respuestas simuladas, pendiente de ejecución en un equipo con Playwright/Chromium.
- Pendiente: ejecutar el SQL contra el esquema real, verificar cada rol, habilitación de Realtime existente, medir tráfico y probar concurrencia real entre dispositivos.

Para repetir pruebas básicas: `npm ci`, `npm run build`, `node --test tests/*.test.mjs`.
La prueba SQL adicional está en `tests/sql-v2-check.mjs`; requiere PGlite instalado por separado y puede recibir su ruta con `QRMENU_PGLITE_MODULE`. No se agregó una dependencia de base de datos al frontend.

## Prueba funcional al instalar

1. Abrir Mesas en dos usuarios del mismo restaurante y un restaurante diferente. Confirmar separación.
2. Mantener una mesa sin cambios y revisar Network: las rondas deben pedir solo `qr_operations_version`, además del aviso de chat independiente.
3. Enviar y modificar pedidos, marcar preparación/entrega y hacer un cobro parcial y otro total. Comprobar tarjetas, QR y ticket persistido.
4. Crear un producto en Carta; abrir de nuevo el QR sin guardar Diseño: debe verse el producto por la nueva versión del catálogo.
5. Reabrir ese QR sin editar Carta: no debe descargarse nuevamente `qr_catalogo_v2` si la caché pudo guardarse.
6. Probar Mesa 0 con retiro y delivery, confirmar entrega desde el cliente y enviar otro pedido después de un cierre.
7. Abrir/cerrar Chat, desconectar y reconectar; comprobar mensajes nuevos y cargar anteriores.
8. En Caja recorrer páginas y comparar el total del turno: debe permanecer igual entre páginas. Verificar fin exclusivo y turnos nocturnos.
9. En Horario cambiar Desde/Hasta y recorrer páginas; comprobar totales completos y verde independiente del rango.

## Medición y límites

Comparar períodos con la misma cantidad de dispositivos, pedidos y horas de uso. Medir por separado Mesas, Cocina, QR abierto, aperturas del catálogo, Chat y reportes. En Network registrar solicitudes y bytes; en Usage comparar los GB de PostgREST/Storage/Realtime. No sumar tráfico de caché local como si hubiese salido de Supabase.

No se midió un porcentaje real de ahorro ni se garantiza permanecer dentro de 5 GB. La caché del catálogo ayuda en visitas repetidas del mismo navegador; cada dispositivo nuevo necesita su primera descarga. El HTML aún contiene su snapshot de publicación y puede duplicar parte del catálogo en la primera visita. Los índices mejoran consultas, pero no reducen por sí solos los bytes de respuesta.

Los contadores añaden escrituras pequeñas y los resúmenes trasladan cálculo al servidor. Para grandes volúmenes deberá medirse también CPU/contención. No se borran históricos, imágenes ni versiones de HTML. La mejora no devuelve tráfico ya consumido ni levanta el bloqueo de cuota.

## Reversión

Se puede volver al frontend/HTML del ZIP anterior. Las columnas y funciones v2 son aditivas y pueden permanecer; no hace falta borrar tablas ni datos. Restaurar un frontend antiguo pierde estas optimizaciones, pero no requiere revertir pedidos o tickets.
