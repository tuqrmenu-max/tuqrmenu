# TODO.md - Pendientes del Proyecto QR Menu

## Completado en esta sesion

### 1. Dos Builders separados (Admin vs Socio)
- Creado src/pages/socio/Builder.jsx
- Ruta /socio/builder?clienteId=xxx
- forceSupabaseOrders=true, showDelivery=false
- DashSocios "Crear Menu" abre /socio/builder

### 2. Desenfoque individual por fondo
- categoriesBlur, productsBlur, cartBlur en useBuilderState
- Sliders 0-100% en CategoriesEditor por cada fondo
- Se guarda en builder_config y se aplica en preview + export

### 3. Ticket de impresion (TicketConfig)
- Pestana "Ticket" en DashSocios
- Configuracion: encabezado, informacion, pie de pagina, formato
- Vista previa en tiempo real
- SQL: ALTER TABLE clientes ADD COLUMN ticket_config jsonb

### 4. MesasAdmin - Detalle de mesa
- Click en mesa abre modal con detalle completo
- Lista de clientes activos con boton cerrar
- Tabla: Cant | Producto | P.U. | Subtotal
- Botones: Imprimir, Cobrar, Cerrar Mesa

### 5. Imprimir ticket
- Carga ticket_config desde Supabase
- Respeta configuracion de campos
- Fallback: window.open + print(), luego clipboard
- Tamano de letra configurable

### 6. HTML exportado - Productos
- Layout apilado (card-top + qtybox)
- Botones - 0 + de 80x80px, separacion 24px
- Check vacio al inicio, verde con tilde al agregar
- +/- solo cambia draftQty, check agrega al carrito
- Barra inferior fija: logo, campana, salir
- Campana llama al mozo (estado Pendiente en Supabase)
- Salir vuelve a portada
- Boton "Enviar Pedido" (no "Enviar por WhatsApp")

### 7. Icono Promocion -> Hacete Socio
- Formulario: Nombre, WhatsApp, Instagram
- Guarda en tabla socios_solicitud
- Mensaje de confirmacion

### 8. SmallLogo fix en HTML exportado
- Cambiado de img a div wrapper con img interno
- Permite posicionamiento con inline styles

### 9. Colores de mesa actualizados
- Libre: azul, Ocupada: verde, Pendiente: rojo

### 10. Portada limpia - Ocultar Mesa Badge y Carrito
- mesa-badge oculto en pantalla cover (solo texto "Mesa X", sin carrito)
- Boton carrito flotante separado (.floatingCart) sin borde ni fondo
- Badge cambia de rojo (vacio) a verde (con items)
- setView() controla visibilidad por vista

### 11. Barra inferior en Categorias -> movida al Top Bar
- La bottom bar de categorias fue ELIMINADA
- Campana (callMozoCats) y Salir (exitMenuCats) ahora estan en el top bar junto a IG
- Posicionados con topTransforms.bell y topTransforms.exit
- Se aplica tanto en PhonePreview como en HTML exportado

### 12. Diseno de Productos actualizado
- Layout inline: imagen + nombre/precio + controles + check en fila
- Botones - y + verdes (#166534), tamano 32x32px, separacion 6px
- Check: borde azul (#3b82f6) vacio, relleno verde (#22c55e) con tilde blanca al activar
- Check al costado del + (mismo grupo de controles)
- Badge del carrito: amarillo (#f59e0b) cuando vacio, verde (#22c55e) con items
- Carrito flotante: sin borde, sin fondo, transparente

### 13. Controles independientes del boton
- buttonFontSize (8-30px): tamano de letra del boton
- buttonPadding (5-40px): espacio interno del marco
- buttonWidth (30-100%): ancho/largo del boton
- Sliders en CoverEditor.jsx
- Se guardan en builder_config
- TransformControls del boton calcula maxW dinamicamente segun buttonWidth

### 14. Guardar proyecto exporta HTML automaticamente
- handleSave() en ambos builders ahora incluye exportHtml() + uploadMenuHtml()
- No es necesario exportar por separado
- Al hacer click "Guardar proyecto" se actualiza el menu publico

### 15. PhonePreview a escala real
- Canvas de 1080x1920px (mismo que HTML exportado)
- Escalado con CSS transform: scale(0.22) para caber en el panel
- Sin factores manuales de escala (eliminados 0.2, 0.5)
- Mismos inline styles que el HTML exportado
- Vista previa identica al menu real

### 16. Campana amarillo -> rojo con polling
- Click campana: amarillo (#f59e0b) -> rojo (#ef4444) con animacion pulse
- HTML exportado: CSS .bellBtn.active con pulse-bell keyframe
- React OrderOverlay: colores actualizados amarillo default, rojo .called
- Polling cada 3s a mesas_operacion para detectar cuando admin dismiss
- Al detectar estado != 'Pendiente': campana vuelve a amarillo
- Check inicial al cargar: si mesa ya esta Pendiente, muestra roja
- Aplica a ambas campanas: callMozo (productos) y callMozoCats (categorias)

### 17. Click en card de mesa dismiss Pendiente
- Click en cualquier parte de la card de mesa en DashSocios/MesasAdmin
- Si mesa esta en Pendiente, la atiende automaticamente (estado -> Ocupada)
- Card sigue abriendo modal de detalle

### 18. Fix sbUpsert 409 Conflict
- sbUpsert original usaba on_conflict en header Prefer (incorrecto para PostgREST)
- PostgREST requiere on_conflict como query parameter en la URL
- Corregido: POST /mesas_operacion?on_conflict=cliente_id,numero
- Header Prefer ahora solo: resolution=merge-duplicates,return=representation

### 19. Fix logoTransform null en config
- loadBuilderConfig no sobrescribe campos con null (solo undefined)
- TransformControls tiene fallback si transform es null/undefined
- PhonePreview tiene fallback si logoTransform es null/undefined

### 20. Fix error de build Vercel - PhonePreview JSX
- Error: extra `</div>` en linea 304 cerraba prematuramente el wrapper div
- Bottom bar quedaba fuera del return (error JSX multiples root elements)
- Fix: eliminar `</div>` extra + agregar `)` para cerrar `return (`
- Archivos: src/components/Builder/PhonePreview.jsx y vercel/src/

### 21. Fix categorias desalineadas entre Builder y menu real
- Posiciones por defecto diferentes: Builder usaba 350px spacing, export usaba 96px
- Fix: unificar defaults a `x:60+(idx%3)*350, y:350+Math.floor(idx/3)*420`
- Agregado `position:relative` a `.categories` para posicionamiento correcto

### 22. Campana y Salir movidos al top bar de categorias
- Bottom bar de categorias eliminada del PhonePreview
- Botones campana y salir agregados al top bar del HTML exportado
- renderTopIcons() actualizado para posicionar bell y exit en top bar
- Eliminada referencia a logoBottomCats

### 23. Fix error 406 al crear vendedor
- Error: tabla vendedores no tenia política RLS de INSERT
- Auth.signUp creaba usuario pero el insert en vendedores fallaba con 406
- Solución: agregar policy "Admin can insert vendedores" en rls_policies.sql
- SQL ejecutar en Supabase Dashboard → SQL Editor

### 24. Fix imágenes categorías no se asignaban al cargar masivo
- Error: handleBulkImages no eliminaba extensión del archivo al crear key
- Archivo "bebidas.jpg" generaba key `bebidasjpg` en vez de `bebidas`
- findCategoryImage buscaba `__cat_bebidas` → no encontraba coincidencia
- Solución: strip extensión antes de slugificar (`file.name.replace(/\.[^/.]+$/, '')`)
- Archivo: CategoriesEditor.jsx

### 25. Script generar-imagenes actualizado
- Antes: leía todo del Excel y generaba imágenes genéricas
- Ahora: lee solo productos faltantes desde missing-products.json
- Botón "Exportar productos faltantes" en Builder descarga el JSON
- Script usa el nombre exacto del producto (con espacios, no guiones)
- Botón "Cargar imágenes generadas" ahora usa selector de archivos (no fetch)
- Así funciona tanto en local como en Vercel
- Flujo: Exportar JSON → Guardar en raíz → Ejecutar script → Seleccionar images-map.json
- Archivos: CategoriesEditor.jsx, scripts/generar-imagenes.cjs

### 26. Fix errores 406 - Faltaban RLS policies
- Error: tablas categorias, productos, mesas_operacion sin políticas RLS
- Solución: agregar SELECT, INSERT, UPDATE, DELETE para cada tabla
- Archivo: rls_policies.sql (ejecutar en Supabase SQL Editor)

### 27. Fix error 406 en múltiples tablas
- Error: comensales, pedidos_qr, pedidos, suscripciones, promociones, promociones_cliente sin políticas RLS
- Solución: agregar políticas completas (SELECT, INSERT, UPDATE, DELETE) para cada tabla
- También: policy INSERT para vendedores, UPDATE para mesas, INSERT/UPDATE para cliente_usuarios
- Archivo: rls_policies.sql

### 28. Agregado icono Salir y quitada campana en Builder mesa=0
- Agregado icono "exit" (✕ Salir) a la lista de iconos posicionables
- Controles en ProductsEditor para posicionar el botón salir
- PhonePreview ahora renderiza el botón salir en top bar de categorías
- Auto-ordenar incluye el nuevo icono
- Campana (🔔) ahora es condicional: solo se muestra si forceSupabaseOrders=true
- Builder mesa=0 (admin): sin campana
- Builder mesa=1 (socio): con campana
- Archivos: ProductsEditor.jsx, PhonePreview.jsx

### 29. Menu URL visible siempre en ambos Builders
- loadSocioData ahora carga menuUrl desde la DB (antes solo se mostraba al guardar)
- Ambos builders regeneran la URL correcta al abrir (no solo al guardar)
- Admin Builder: URL con mesa=0
- Socio Builder: URL con mesa=1
- Fallback a socioId si state.userId es null
- Archivos: pages/admin/Builder.jsx, pages/socio/Builder.jsx

### 30. Boton "Buscar imagenes" eliminado de CategoriesEditor
- Botón "🔍 Buscar imágenes en Storage" eliminado del panel de imágenes
- Solo queda "Cargar imágenes generadas" con file picker
- Botón "Exportar productos faltantes" para descargar missing-products.json

### 31. Fix error SQL tabla socios_solicitud no existe
- rls_policies.sql incluía policy para tabla socios_solicitud
- La tabla NO existe en Supabase (causaba error al ejecutar SQL)
- Policy eliminada del script
- La tabla se crea solo si se necesita (ver NOTA en AGENTS.md)

### 32. Envio de promos por WhatsApp a clientes del formulario (PromocionesAdmin)
- Nueva seccion "Enviar Promos por WhatsApp" en pestana Promos de DashSocios
- Lista de clientes del formulario con checkbox individual + "Seleccionar todos"
- Selector de promo + boton "Enviar Promos" -> abre wa.me/{whatsapp}?text={promo} por cliente (delay 500ms)
- Campo fecha_envio en "+ Nueva Promo" para agendar: badge "Agendada" amarillo + envio bloqueado hasta la hora (re-render cada 30s)
- normalizarWhatsapp(): 10 digitos asume Argentina, agrega prefijo 54

### 33. Formulario "Hacete Socio" ahora guarda en suscripciones
- ANTES: insertaba en socios_solicitud (tabla legada, ya NO se usa)
- AHORA: inserta directo en suscripciones (cliente_id, nombre, whatsapp, instagram)
- Los clientes aparecen en pestana Suscriptos y en la lista de envio de Promos
- SQL: supabase/suscripciones_form.sql (columna instagram + policy "Anyone can insert suscripciones" TO public + GRANT INSERT TO anon)

### 34. Fix guardado silencioso del formulario
- ANTES: mostraba "Gracias!" aunque el INSERT fallara (ej: error 42501 RLS)
- AHORA: si falla muestra "Error al enviar, intenta de nuevo" + console.error

### 35. Letras del banner "Hacete Socio" +50%
- Titulo 15->22px, subtitulo 12->18px, inputs 13->20px, boton 14->21px, success 14->21px
- En useBuilderState.js (HTML exportado)

### 36. RLS habilitado en todas las tablas
- supabase/enable_rls.sql: ALTER TABLE ENABLE ROW LEVEL SECURITY con DO block que omite tablas inexistentes (ej: pedidos_items)
- Recordar: crear policies NO activa RLS, hace falta el ENABLE

### 37. productsBottom eliminada -> cluster superior derecho (#topActions)
- La barra negra inferior de productos fue ELIMINADA (logo, campana, salir)
- Nuevo cluster DENTRO de la barra de titulo (productsTop), alineado con el nombre de la categoria: Promo (#promoProducts) | Campana (#callMozoTop) | Carrito (#floatingCart) | Salir (#exitTop)
- Orden: promo antes del carrito, salir despues del carrito (pedido del cliente)
- Promo usa el mismo handler que el icono promo de portada (formulario Hacete Socio) y DATA.promoIcon si existe
- Popover #pop movido a nivel phone para funcionar desde cualquier vista
- Popover con boton ✕ (promoClose) arriba a la derecha para cerrarlo
- Campana solo visible si forceSupabaseOrders=true y mesa>0 (igual que antes)
- Aplica en HTML exportado (useBuilderState.js) y PhonePreview.jsx

### 38. Fix espacio negro debajo del menu en moviles
- Causa: .phone tenia aspect-ratio fijo 9/16 -> en pantallas alargadas (19.5:9) quedaba espacio negro debajo
- Fix: @media(max-width:520px) .phone usa width:100vw x height:100dvh sin aspect-ratio (menu fullscreen)

### 39. Iconos del cluster sin marcos individuales
- Quitados los fondos rgba(0,0,0,.45) de promo, carrito y salir en productsTop
- Los iconos quedan directos sobre la barra negra del titulo (igual que "← Cafeteria")
- drop-shadow para legibilidad sobre cualquier fondo; carrito reducido a 40x40px

### 40. Fix promo de "Mi pedido" no abria el banner
- El boton #cartPromo (pantalla carrito) no tenia handler asignado
- Ahora promoHandler esta compartido por 3 botones: #promo, #promoProducts y #cartPromo

### 41. Seguridad RLS - Vulnerabilidad corregida
- **Vulnerabilidad**: policy `Authenticated users can update own subscriptions` usaba `auth.uid() = user_id` pero `auth.uid()` retorna el ID del auth, NO el id de la tabla suscripciones
- Un usuario autenticado podia modificar cualquier registro de suscripciones
- **Solucion**: `supabase/seguridad_rls_fix.sql` con owner-scoped policies (solo supabase_admin puede INSERT/UPDATE/DELETE)
- RPC functions creadas: `mis_suscriptores`, `mis_promos_activas`, `insertar_suscripcion`, `asignar_promos_nuevos`
- `mis_promos_activas` necesita `DROP FUNCTION` antes de `CREATE` al cambiar tipo de retorno
- Archivo: supabase/seguridad_rls_fix.sql

### 42. Tabla promociones - Columnas agregadas
- Columnas nuevas: tipo, asignacion, categoria, producto_id, fecha_envio, para_nuevos, created_at, descuento_porcent, descuento_monto, imagen, fecha_inicio, fecha_fin
- Valores por defecto: tipo='descuento', asignacion='todos', activa=true, para_nuevos=false
- Archivo: supabase/promociones_fix_completo.sql

### 43. Funcion asignar_promos_nuevos (RPC)
- Busca promos con `para_nuevos=true` para el `cliente_id` dado
- Las inserta automaticamente en `promociones_cliente` cuando un cliente se suscribe
- Se llama desde el frontend despues del INSERT en suscripciones
- Archivo: supabase/asignar_promos_nuevos.sql

### 44. Columnas canje en promociones_cliente
- `codigo` (text): codigo unico para canjear la promo
- `usada` (boolean, default false): si ya fue canjeada
- `activa` (boolean, default true): si esta activa
- `fecha_uso` (timestamptz): cuando se canjeo
- Archivo: supabase/promociones_canje.sql

### 45. Limpieza de archivos SQL redundantes
- Eliminados: policy_vendedores_fix.sql, fix_admin_vendedores.sql, fix_suscripciones_policy.sql, suscripciones_form_v2.sql
- Conservados: builder_config.sql, enable_rls.sql, promociones_canje.sql, rls_policies.sql, seguridad_rls_fix.sql, storage_menus.sql, suscripciones_form.sql, ticket_config.sql
- Creado supabase/README.sql con indice de ejecucion

### 46. PromocionesAdmin - Error handling en crearPromo
- ANTES: el INSERT no tenia try/catch, si fallaba no mostraba error
- AHORA: try/catch con console.error y alert("Error al crear promo")

### 47. PromocionesAdmin - Checkbox para_nuevos
- Nuevo checkbox "Asignar automaticamente a nuevos suscriptos" en formulario de promo
- Badge visual: `🎨 Asignación automática` en la lista de promos

### 48. Selector de producto rediseñado en PromocionesAdmin
- Tipo "2x1 Categoria": lista simple con radio, nombre y conteo de productos
- Tipo "2x1 Mismo Producto": dos columnas lado a lado
  - Izquierda: boton dropdown "Categorias ▾" con chevron, expande/collapse lista
  - Derecha: lista de productos de la categoria seleccionada con radio, nombre, precio
- Campo `_showCats` en form state controla visibilidad del dropdown
- Ambos selectores usan imagenes de Supabase con fallback 🍟

### 49. Selector de pais en formulario "Hacete Socio"
- Dropdown con 12 codigos de pais: 🇦🇷+54, 🇺🇾+598, 🇨🇱+56, 🇨🇴+57, 🇵🇪+51, 🇧🇷+55, 🇲🇽+52, 🇸🇻+503, 🇭🇳+504, 🇳🇮+505, 🇨🇷+506, 🇵🇦+507
- Default: Argentina (+54)
- Placeholder transparente: countryCode no ocupa espacio cuando no hay seleccion
- Layout flex: dropdown pais (izq) + input WhatsApp (der)

### 50. Badge verde en icono 🎁 (promoDot)
- 3 botones 🎁: categorias (#promo), productos (#promoProducts), carrito (#cartPromo)
- Badge verde (#22c55e) 20x20px con borde negro, posicion absoluta top-right
- Variable global `_promoCount` con persistencia en localStorage
- `applyPromoDots()`: centraliza logica de mostrar/ocultar dots basado en `_promoCount > _seen`
- `updatePromoBadge(suscId)`: fetch async, actualiza count + localStorage + aplica dots
- `markPromosSeen(suscId)`: guarda count en localStorage, oculta dots
- `renderTopIcons()` preserva dots existentes al recrear innerHTML

### 51. Boton "Obtener promo ahora" en menu publico
- Boton verde debajo de cada promo en popup "Tus promociones"
- `usarPromo(promo)` busca productos coincidentes en DATA.rows
  - 2x1_mismo: agrega 2 unidades del producto al cart
  - 2x1_categoria: agrega 2 unidades de cada producto de la categoria
- Cierra popup, abre pantalla carrito
- Banner verde en carrito con nombre promo + codigo + boton ✕ para quitar
- `state.activePromo` almacena la promo activa (se limpia al enviar o quitar)

### 52. SQL para mis_promos_activas - retorno con tipo/categoria/producto_id
- ANTES: retornaba solo id, titulo, descripcion
- AHORA: retorna id, titulo, descripcion, tipo, categoria, producto_id
- Necesario para que "Obtener promo ahora" sepa que tipo de promo es
- IMPORTANTE: ejecutar DROP FUNCTION antes de CREATE en Supabase SQL Editor
- Incluido en: supabase/seguridad_rls_fix.sql

### 53. Paleta de colores corregida en PromocionesAdmin
- Fondo de badges: verde (#166534) para "Automática", azul (#1e40af) para "Hoy"
- Botones: verde (#16a34a), hover (#15803d)
- Headers: gradient verde
- Antes usaba colores inconsistentes (púrpura, amarillo, rosa)

### 54. Sync Builder→Tablas Supabase (Builder→CartaAdmin)
- **Problema**: Builder guardaba productos en `clientes.builder_products` (JSONB), CartaAdmin leía de tablas `categorias`/`productos`. Estaban desincronizados.
- **Solución**: `syncBuilderToTables()` en `storage.js` se ejecuta al guardar (handleSave)
- Flujo: lee builder_products → UPSERT categorías → UPSERT productos → nunca DELETE (solo insert/update)
- CartaAdmin ahora lee categorías de DB (no del state que quedaba stale tras importar Excel)
- Archivos: `src/lib/storage.js`, `src/pages/admin/DashSocios/components/CartaAdmin.jsx`

### 55. Limpieza de categorías duplicadas
- **Problema**: Builder sync creaba categorías duplicadas (misma key, IDs distintos)
- **Solución**: SQL `supabase/cleanup_categorias_duplicadas.sql`:
  - Migra productos de categorías duplicadas a la más antigua
  - Elimina categorías duplicadas (conserva la más antigua)
- CartaAdmin: lectura de categorías desde DB fresca (no state缓存)

### 56. PromocionesAdmin - Multi-select productos (checkboxes)
- **ANTES**: radio buttons (solo 1 producto seleccionable)
- **AHORA**: checkboxes + "Seleccionar todos" (múltiples productos)
- `selectedProducts` es array de IDs (JSON array en `producto_id`)
- Botones "Limpiar" y "Seleccionar todos" debajo del selector
- Auto-selecciona si solo hay 1 producto (compatibilidad)
- Archivo: `src/pages/admin/DashSocios/components/PromocionesAdmin.jsx`

### 57. Columna `producto_id` cambiada de uuid a text
- **Problema**: `producto_id` era `uuid` y ahora almacena JSON arrays (IDs de Builder)
- **Solución**: `ALTER TABLE promociones ALTER COLUMN producto_id TYPE text`
- SQL: `supabase/promociones_producto_ids.sql`
- Permite guardar: `"producto_id": "[\"0\",\"1\"]"` (JSON array de strings)

### 58. Columna `producto_nombre` en tabla promociones
- **Problema**: `producto_id` de Builder son strings ("0","1"), no UUIDs de DB. El menú público no puede buscar por ID para saber el nombre.
- **Solución**: nueva columna `producto_nombre` (text) que almacena los nombres junto con los IDs
- RPC `mis_promos_activas` actualizada para retornar `producto_nombre`
- SQL: `supabase/promociones_producto_nombre.sql`
- PromocionesAdmin: `selectedProducts` ahora guarda `[{id, nombre}]` (array de objetos)

### 59. Fix RPC mis_promos_activas - tipo text para producto_id
- **ANTES**: retornaba `producto_id uuid`
- **AHORA**: retorna `producto_id text` (por el cambio de tipo en la tabla)
- Necesario: `DROP FUNCTION` antes de `CREATE` al cambiar tipo de retorno
- Incluido en: `supabase/promociones_producto_nombre.sql`

### 60. Promo matching mejorado en menú público
- **ANTES**: solo buscaba por `producto_id` exacto (fallaba con IDs de Builder)
- **AHORA**: busca por:
  1. ID exacto en DATA.rows (match numérico)
  2. Nombre exacto en DATA.rows
  3. Nombre case-insensitive
  4. Fallback: busca en tabla `productos` de Supabase por nombre
- Archivo: `src/components/Builder/useBuilderState.js` (función `usarPromo`)

### 61. Promo checkboxes en carrito - productos empiezan deseleccionados
- **ANTES**: `state.promoProducts[idx]` se inicializaba con `true`
- **AHORA**: empiezan en `false`, el cliente selecciona cuáles quiere
- `applyPromoButton()` actualiza badge del carrito según selección
- Scroll container: `max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch`
- Archivo: `src/components/Builder/useBuilderState.js`

### 62. Fix descuento 2x1 agrupado por producto
- **ANTES**: `Math.floor(count/2)` mezclaba todos los productos seleccionados
  - Ej: 2 Café ($1400) + 1 Té ($800) → 1 gratis = -$1400 (correcto en este caso, pero equivocado en otros)
- **AHORA**: agrupa por nombre de producto, aplica 2x1 por cada par del mismo producto
  - Ej: 2 Café ($1400) + 4 Submarino ($1300) → 1 par Café gratis + 2 pares Submarino gratis
  - `promoSubtotal` = precio completo de todos los seleccionados
  - `promoDiscount` = `Math.floor(group.count/2) * group.price` por cada grupo
- Corregido en: `renderCart()`, `orderMessage()`, y banner "🎉 Nx1 aplicado"
- Archivo: `src/components/Builder/useBuilderState.js`

### 63. Fix total negativo en carrito
- **Problema**: subtotal solo sumaba `cartItems()` (state.cart), no incluía productos promo
- **Solución**: `total = Math.max(0, cartSubtotal + promoSubtotal - promoDiscount + delivery)`
- `promoSubtotal` = precio completo de productos promo seleccionados
- El total nunca puede ser negativo (Math.max(0,...))
- Archivo: `src/components/Builder/useBuilderState.js`

### 64. Flag `es_promo` en pedidos Supabase
- `sendSupabaseOrder()` envía `es_promo: 1` cuando hay `state.activePromo`
- Permite identificar pedidos que usaron promoción en la DB
- Archivo: `src/components/Builder/useBuilderState.js`

### 65. SQL archivados ejecutados
| SQL | Descripción | Estado |
|-----|-------------|--------|
| `supabase/promociones_producto_ids.sql` | Cambiar `producto_id` de uuid a text | Ejecutado |
| `supabase/promociones_producto_nombre.sql` | Agregar `producto_nombre` + actualizar RPC | Ejecutado |
| `supabase/cleanup_categorias_duplicadas.sql` | Limpiar categorías duplicadas | Ejecutado |

## Completado en esta sesion (66-68)

### 66. Fix scroll bloqueado en "Mi pedido" al usar promo
- **Problema**: `#promoProdList` (lista de productos de la promo dentro del carrito) tenia su propio `max-height:55vh;overflow-y:auto`, anidado dentro de `#cartList` que YA es scrolleable (`flex:1 1 auto;overflow-y:auto`)
- Ese doble scroll anidado hacia que el swipe quedara "atrapado" en la lista interna y no se pudiera bajar para ver direccion/delivery/subtotal/total/Enviar Pedido
- **Solucion**: se elimino el scroll propio de `#promoProdList` (ahora es un div normal, sin `max-height`/`overflow-y`); el scroll lo maneja unicamente `#cartList`, que ya envuelve todo el contenido del carrito (banner promo + items + productos de la promo)
- Archivo: `src/components/Builder/useBuilderState.js` (funcion `renderCart`)

### 67. CartaAdmin - Checkbox "Seleccionar todos los productos" (global)
- Ya existia seleccion individual (checkbox por producto) y "seleccionar todos" por categoria, mas el panel de actualizacion masiva con % (Aumentar %/Disminuir %/Precio fijo)
- Se agrego un checkbox global "Seleccionar todos los productos (N)" arriba de la tabla (al lado del buscador) que selecciona/deselecciona TODOS los productos filtrados de una sola vez, sin tener que ir categoria por categoria
- Archivo: `src/pages/admin/DashSocios/components/CartaAdmin.jsx`

### 68. Un solo Builder (reemplaza Admin Builder + Socio Builder)
- **Antes**: dos componentes casi identicos (`pages/admin/Builder.jsx` y `pages/socio/Builder.jsx`) que forzaban `forceSupabaseOrders` true/false y exportaban el HTML distinto segun cual se usara, generando inconsistencias porque ambos escriben al mismo `clientes.menu_url`
- **Ahora**: un unico componente `src/pages/admin/Builder.jsx`, montado en ambas rutas (`/admin/builder/:socioId` y `/socio/builder?clienteId=xxx`, resolviendo el socioId segun parametro de ruta, query param o el propio usuario logueado)
- Un solo export/guardado sube un unico HTML; ese HTML ya se adapta solo en tiempo real segun `?mesa=` (ver seccion "Builder unico" en AGENTS.md):
  - mesa=0 -> delivery + retiro + WhatsApp
  - mesa=1+ -> campana + pedido directo a Supabase
- El Builder muestra ambas URLs finales (Mesa 0 y Mesa 1+) con boton de copiar cada una
- Se agrego un toggle "Vista previa: Mesa 0 / Mesa 1+" arriba del PhonePreview para revisar cada variante sin afectar el export (reutiliza el campo `forceSupabaseOrders` solo como flag de UI/preview)
- Eliminado: `src/pages/socio/Builder.jsx` (ya no existe, todo vive en `src/pages/admin/Builder.jsx`)
- Archivos: `src/pages/admin/Builder.jsx`, `src/App.jsx`, `src/components/Builder/useBuilderState.js`

## Completado en esta sesion (69-70)

### 69. Tarjeta de producto - marco ajustado a la imagen + bordes redondeados
- Padding de `.product-card` bajado de 8px a 6px, imagen de 90x90 a 78x78 con `border-radius:14px` propio (antes 12px)
- El marco queda pegado a la imagen (menos espacio "muerto") y la imagen se ve como una miniatura redondeada, ya no depende solo del `overflow:hidden` del padre
- Archivo: `src/components/Builder/useBuilderState.js`

### 70. Fix: WhatsApp/Instagram/Direccion/Horario/Promo/Alias/Delivery no se guardaban
- **Problema real**: estos campos SI se editaban en el Builder (pestaña Productos) y SI se usaban en el popup ℹ️ Información del menu exportado (Instagram y horario ya estaban soportados ahi), pero `saveBuilderFieldsToCliente()` solo mandaba `fondo_menu` y `logo_url` a la tabla `clientes`
- Resultado: al recargar el Builder, `loadSocioData()` volvia a leer esos campos vacios desde la DB (nunca se habian guardado), perdiendo lo cargado - por eso el popup de info en el menu real solo mostraba WhatsApp/Ubicacion y nunca Instagram/Horario
- **Solucion**: `saveBuilderFieldsToCliente()` ahora tambien guarda `bienvenido, whatsapp, instagram, direccion, horario, promociones, alias, delivery` (en auto-save, Guardar y Exportar). Se agregaron esos campos al array de dependencias del auto-save para que tipear en esos inputs dispare el guardado
- Archivo: `src/pages/admin/Builder.jsx`

## Completado en esta sesion (71 - SEGURIDAD)

### 71. FIX CRITICO: escalada de privilegios via "superadmin por descarte"
- **Vulnerabilidad**: tanto `es_superadmin()` (funcion SQL usada por casi todas las RLS policies de `seguridad_rls_fix.sql`) como `src/hooks/useAuth.js` definian "superadmin" como *"cualquier usuario autenticado que no tenga fila en vendedores/clientes/cliente_usuarios"*. Cualquiera que se registrara con la anon key (Supabase Auth permite sign-up publico salvo que lo hayas deshabilitado a mano) y no tuviera perfil todavia quedaba tratado como superadmin **tanto en la UI como en las policies reales de la base**, pudiendo leer/editar/borrar `clientes`, `cliente_usuarios`, `vendedores`, `solicitudes_cliente` de cualquier restaurante
- **Fix**: `supabase/fix_superadmin_privesc.sql` (NUEVO, correrlo en el SQL Editor de Supabase) crea una tabla explicita `superadmins` (nadie puede leerla/escribirla desde el cliente, solo vos a mano) y redefine `es_superadmin()` para que chequee esa tabla en vez de "no tener perfil". `src/hooks/useAuth.js` ahora consulta esa misma tabla y, si el usuario no aparece en NINGUNA tabla de perfiles, lo desloguea en vez de asumir superadmin
- **Accion manual pendiente** (no lo puedo hacer yo, necesita tu SQL Editor): correr `fix_superadmin_privesc.sql` y despues `insert into superadmins (user_id) values ('tu-user-id');` con el UUID de tu cuenta real (Authentication → Users en el dashboard de Supabase)

### 72. Fix XSS reflejado en "Hacete socio"
- El nombre que el cliente tipea en el formulario publico "Hacete socio" se insertaba sin escapar en `innerHTML` del mensaje de éxito (`¡Gracias <nombre>!`). Alguien podia poner `<img src=x onerror=...>` como nombre y ejecutar JS en su propio navegador
- Fix: se envuelve con la funcion `escapeHtml()` que ya existia en el archivo (usada para `DATA.hours`)
- Archivo: `src/components/Builder/useBuilderState.js`

### Pendiente de revisar manualmente (no editable desde el codigo)
- **Storage bucket policies**: verificar en el dashboard de Supabase (Storage → menus/logos/productos) que solo SELECT sea publico; INSERT/UPDATE/DELETE deberian requerir estar autenticado y ser dueño, para que nadie pueda pisar el `menu.html` de otro restaurante conociendo su UUID
- **Supabase Auth → Providers → Email**: confirmar si "Allow new users to sign up" esta habilitado; si no lo necesitan, conviene deshabilitarlo (reduce la superficie de ataque de raiz)
- **Tablas abiertas a anon sin scoping por sesion** (`mesas_operacion`, `comensales`, `pedidos_qr` con `SELECT ... TO anon USING (true)`): ya documentado como riesgo aceptado en `seguridad_rls_fix.sql` (necesario para que el pedido por mesa funcione sin login). Hoy expone pedidos/mesas de TODOS los restaurantes a cualquiera con la anon key, no solo al que esta en esa mesa. Si mas adelante quieren cerrarlo, la solucion prolija seria un token de sesion por mesa (ej. columna random en `mesas_operacion` que el QR incluya en la URL y las policies exijan)
- **Rotar `.env.local`**: tenia un `VERCEL_OIDC_TOKEN` real (token de corta duracion de Vercel CLI). No se incluye mas en el zip entregado. Ya esta en `.gitignore`, pero si en algun momento se subio a un repo publico o se comparte el zip, conviene regenerarlo (`vercel env pull` genera uno nuevo)

## Completado en esta sesion (73)

### 73. Barra superior unificada (categorías/productos/carrito) + fix scroll carrito
- **Bug "Mesa 1" en pantalla Bienvenidos**: al cargar la pagina se forzaba `mesaBadge.style.display='flex'` sin importar la pantalla activa, así que aparecía tambien en la portada. Ahora arranca oculto y solo se muestra al entrar a categorías/productos/carrito (ya existía esa regla en `setView`, solo faltaba no pisarla en el arranque)
- **Campana y Nº de mesa ahora se pueden reposicionar** desde "📍 Posición iconos superiores" (pestaña Productos del Builder): se agregaron las filas "🔔 Campana" y "🏷️ Nº de mesa" a la lista. Antes la campana de Productos (`callMozoTop`) se movía sola con flexbox y no se podia editar su posición; la de Categorías (`callMozoCats`) sí tenia soporte en el codigo pero no aparecía en el panel; el numero de mesa no tenia ningun control
- **Campana agregada a la pantalla Carrito** (`callMozoCart`, antes el carrito no tenia forma de llamar al mozo). Las 3 campanas (categorías/productos/carrito) ahora comparten la misma posicion X/Y/escala (`topTransforms.bell`), y el numero de mesa (`topTransforms.mesa`) tambien es unico y consistente en las 3 pantallas porque es un solo elemento flotante (`#mesaBadge`) reposicionado una vez
- **Barra negra unificada**: categorías y el header del carrito ahora tienen el mismo fondo oscuro en degrade que ya tenia Productos (`linear-gradient(180deg,rgba(0,0,0,.58),rgba(0,0,0,.08))`), para que las 3 pantallas se vean iguales
- **Fix scroll "no se ve el alias/copiar alias"**: `#cart` dejo de depender de un `#cartList` con scroll propio (`flex:1 1 auto`) mientras el resto de los elementos (delivery, totales, boton enviar, alias) quedaban fijos fuera del área que scrollea. Ahora `#cart` entero es una sola región con scroll (`overflow-y:auto`), con el header (`.cartTop`) `sticky` arriba; así siempre se puede bajar hasta el alias y "Copiar alias" sin importar cuánto contenido haya arriba
- Archivos: `src/components/Builder/useBuilderState.js`, `src/components/Builder/ProductsEditor.jsx`
- **Importante para este restaurante puntual**: como ya tenían posiciones guardadas (Volver/Logo/WhatsApp/Promo/Ubicación/Instagram/Salir), "Campana" y "Nº de mesa" van a arrancar en 0,0 hasta que entren al Builder y las acomoden a mano (o usen "✨ Auto-ordenar", que ahora también las incluye)

## Completado en esta sesion (74 - Panel del dueño rediseñado)

### 74. Sidebar propio para el dueño del restaurante (rol "admin")
- **Causa raíz encontrada**: `Sidebar.jsx` mostraba el mismo menú a `rol==='superadmin'` Y `rol==='admin'` (dueño de un restaurante) — por eso "Cliente 2" veía Panel/Vendedores/Crear Socios/Nuevos Clientes/Dash Socios, que son herramientas de plataforma, no de su restaurante
- Se agregó `ownerLinks` (nuevo) para `rol==='admin'`: Mesas, Carta, Caja, Promos, Suscriptos, Ticket, Usuarios — como links directos, no como pestañas dentro de "Dash Socios". `adminLinks` (Panel/Vendedores/Crear Socios/Nuevos Clientes/Dash Socios) quedó reservado solo para `rol==='superadmin'`
- `DashSocios/index.jsx` ahora soporta `/admin/dash-socios/:tab` (ej. `/admin/dash-socios/carta`) para que cada link del sidebar abra esa sección directamente; para el dueño se oculta el header + la barra de pestañas horizontal (ya no hace falta, es redundante con el sidebar) y el contenido usa todo el ancho disponible
- Se eliminó la pestaña "Crear Menú" (redundante) y se agregó "Usuarios" (nuevo)
- Archivos: `src/components/Layout/Sidebar.jsx`, `src/pages/admin/DashSocios/index.jsx`, `src/App.jsx`

### 75. Botones Guardar/Exportar movidos a Carta
- `CartaAdmin.jsx` ahora tiene un bloque "🎨 Diseño del menú" arriba de la carta con los botones "💾 Guardar proyecto" y "🚀 Exportar menú" (abren el Builder de ese restaurante en una pestaña nueva, con `clienteId` ya resuelto)

### 76. Ticket: número de ticket + configuración de impresora
- Nuevo toggle "Número de ticket" con contador inicial configurable (se ve en la vista previa como `Ticket N° 0001`)
- Nuevo bloque "🖨️ Impresora": elegir entre impresora del sistema (usa el diálogo de impresión del navegador/tablet), impresora de red por IP:puerto (ESC/POS térmica), o compartir como imagen/WhatsApp. Guarda `printMethod`, `printerIp`, `printerPort` en `clientes.ticket_config`
- Nota honesta: un navegador no puede hablarle directo a una impresora de red (socket TCP) por seguridad; esto guarda la configuración pero la impresión real por red necesitaría un puente (app/servicio local o Edge Function) — lo dejo marcado para una proxima vuelta si lo necesitan
- Archivo: `src/pages/admin/DashSocios/components/TicketConfig.jsx`

### 77. NUEVO: Usuarios y Horarios (mozo/cocina/cajero)
- Pantalla nueva completa (`UsuariosStaff.jsx`) para que el dueño cree cuentas de mozo/cocina/cajero con **usuario + contraseña** (no hace falta email real) y las pueda loguear en `/login`
- **Detalle técnico importante que se corrigió**: crear un usuario nuevo con `supabase.auth.signUp()` desde el mismo cliente de Supabase que usa el dueño logueado **reemplaza la sesión activa por la del usuario recién creado** (bug real que tenía el `Usuarios.jsx` viejo en `src/pages/cliente/`, sin usar). Se solucionó con `createIsolatedClient()` (`src/lib/supabase.js`): un cliente Supabase separate, sin persistir sesión, que crea la cuenta en el backend sin tocar la sesión del dueño en el navegador
- El "usuario" que carga el dueño se traduce a un email interno invisible (`usuario.<idcliente>@staff.tuqrmenu.app`) solo para Supabase Auth. El staff jamás ve ni necesita ese email: en `/login` ahora se puede escribir el "Usuario o Email" indistintamente — si lo que se escribe no tiene "@", se resuelve primero via la funcion SQL `resolver_login_usuario()` antes de intentar el login (`src/hooks/useAuth.js`)
- **Horarios**: definir uno o más turnos (desde/hasta + días de la semana), agrupar empleados por rol con "seleccionar todos" o uno por uno, y aplicar los turnos elegidos a los seleccionados de una sola vez (se guardan en `cliente_usuarios.horarios`, jsonb)
- **Accion manual pendiente**: correr `supabase/staff_usuarios_horarios.sql` en el SQL Editor de Supabase (agrega las columnas `usuario`, `activo`, `horarios` a `cliente_usuarios` y la función `resolver_login_usuario`). Sin este paso, crear usuarios o loguearlos con "usuario" en vez de email no va a funcionar
- Archivos nuevos: `src/pages/admin/DashSocios/components/UsuariosStaff.jsx`, `supabase/staff_usuarios_horarios.sql`. Modificados: `src/lib/supabase.js`, `src/hooks/useAuth.js`, `src/pages/auth/Login.jsx`

### Pendiente para una proxima vuelta (fuera de alcance de esta sesion)
- Las pantallas donde mozo/cocina/cajero aterrizan al loguearse (`/cliente/*`) son las viejas y quedaron sin tocar — si quieren que el staff realmente opere (ver mesas, tomar pedidos, cobrar) desde su rol, hay que construir esas pantallas o adaptar las de `DashSocios/components` para ese rol tambien
- Impresión real por red/bluetooth necesita un puente fuera del navegador

## Completado en esta sesion (78)

### 78a. Vendedores: Desactivar (sin borrar)
- Botón "Desactivar"/"Activar" en la tabla de Vendedores. Un vendedor desactivado no puede iniciar sesión (se lo desloguea automáticamente con un aviso) pero sus datos, clientes traídos y comisiones quedan intactos
- **Acción manual**: correr `supabase/vendedores_activo.sql` (agrega la columna `activo`)
- Archivos: `src/pages/admin/Vendedores.jsx`, `src/hooks/useAuth.js`

### 78b. Badge rojo en "Nuevos Clientes" con solicitudes pendientes
- Círculo rojo con la cantidad de solicitudes en estado `pendiente`, al lado del link "Nuevos Clientes" en el sidebar del superadmin. Se actualiza en vivo (suscripción realtime a `solicitudes_cliente`): baja solo a medida que se van aprobando/rechazando, sin recargar la página
- Archivo: `src/components/Layout/Sidebar.jsx`

### 78c. Imágenes del Builder también aparecen en Carta
- Al subir una imagen de producto o categoría en el Builder, si existe un producto/categoría con el mismo nombre en la tabla real (`productos`/`categorias`, la que usa la pantalla Carta), se le copia la misma imagen automáticamente (comparación por nombre, ignorando mayúsculas/acentos)
- Es "mejor esfuerzo": si no encuentra un nombre igual, no rompe nada, simplemente no sincroniza esa imagen puntual
- Archivos: `src/components/Builder/useBuilderState.js` (nuevas acciones `syncProductImageToDB`/`syncCategoryImageToDB`), `src/components/Builder/ProductsEditor.jsx`, `src/components/Builder/CategoriesEditor.jsx`

### 78d. Ticket: horario de atención
- Faltaba el horario de atención del local en el ticket (ya estaba nombre, dirección, teléfono, detalle de productos, total y la config de impresora agregados en la sesión anterior). Se agregó el toggle + campo de texto libre
- Archivo: `src/pages/admin/DashSocios/components/TicketConfig.jsx`

### Nota sobre pedidos repetidos de features ya hechas
Varias cosas pedidas en este mensaje (número de ticket, dirección/detalle en el ticket, % de aumento masivo en Carta) ya estaban implementadas en sesiones anteriores y se verificaron intactas en el código. Si en producción "no aparece nada" en Ticket o el % masivo en Carta, es el mismo problema de siempre: hace falta desplegar el zip actualizado (los cambios de código no aparecen solos en Vercel).

## Completado en esta sesion (79)

### 79a. FIX real: pantalla Ticket vacía/colgada
- **Causa encontrada**: `TicketConfig.jsx` lee y escribe `clientes.ticket_config`, pero esa columna nunca se creó con una migración — la venía usando desde que se armó la pantalla. La consulta a una columna inexistente fallaba silenciosamente (el código no revisaba `error`), así que quedaba con el spinner de carga para siempre
- **Fix**: `supabase/ticket_config_column.sql` (nuevo, correrlo en el SQL Editor) agrega la columna. Además `TicketConfig.jsx` ahora muestra un toast si falla la carga, para que la próxima vez que pase algo así se vea el error en vez de quedar vacío en silencio

### 79b. URL del panel del dueño: por qué no lleva UID (y no se puede mezclar)
- No es un bug: `/admin/dash-socios/carta` es la misma URL para cualquier dueño a propósito. El restaurante que ve cada uno se resuelve del lado del servidor según la sesión logueada (`auth.uid()` → busca en `clientes` el que tiene ese `user_id`), no según nada que venga en la URL. Por eso no se pueden mezclar: dos dueños logueados en dos sesiones distintas siempre resuelven su propio `clienteId`, aunque la URL que ven en la barra de direcciones sea idéntica (es el mismo patrón que usa Gmail: la URL es igual para todos, el contenido depende de quién está logueado)

### 79c. Nuevo: ocultar Builder / IA por restaurante (checks de superadmin)
- En Carta, si el usuario logueado es superadmin, aparece una franja "Superadmin" con 2 checks: "Ocultar Builder (Guardar/Exportar)" y "Ocultar Generar imágenes con IA", por restaurante
- Cuando están tildados, el dueño de ESE restaurante deja de ver esos botones en su Carta (el superadmin los sigue viendo siempre, para poder destildarlos después)
- **Acción manual**: correr `supabase/carta_feature_toggles.sql`
- Archivo: `src/pages/admin/DashSocios/components/CartaAdmin.jsx`

### Cómo agregar una página nueva a este proyecto (respuesta, no requiere código todavía)
Dos caminos, según qué necesites:
- **Una pantalla más dentro de la app** (ej. otra sección del panel): se crea un archivo `.jsx` en `src/pages/...` y se agrega una `<Route>` en `src/App.jsx`. Se despliega solo, es parte del mismo proyecto de Vercel — no hace falta configurar nada extra.
- **Una página estática completamente aparte** (ej. una landing en HTML puro): un archivo `.html` colocado en la carpeta `public/` de este proyecto queda servido tal cual en esa ruta (ej. `public/promo.html` → `tuqrmenu.vercel.app/promo.html`), sin pasar por React.
- **Un sitio totalmente distinto** (dominio o subdominio propio): eso va como otro proyecto de Vercel aparte, no dentro de este.
Si me contás qué página querés agregar, la construyo directamente.

## Completado en esta sesion (80 - fix real de la pantalla en blanco)

### 80a. LA causa real de "Ticket vacío y se tilda"
No era la columna `ticket_config` (esa migración también hacía falta, pero no era la causa de fondo). El archivo tenía una variable **corrompida por un problema de codificación de caracteres**: `const现在 = new Date()` en vez de `const ahora = new Date()` — el identificador tenía caracteres chinos pegados directo después de `const`, sin espacio. Eso es JavaScript válido para el compilador (`vite build` no lo detecta, por eso pasaba sin errores), pero **al ejecutarse explota en tiempo real** ("ReferenceError") apenas React intenta dibujar la vista previa del ticket — y como no hay un Error Boundary en la app, React no muestra un error lindo, directamente desmonta toda la pantalla y queda en blanco. Esto explica por qué se veía vacía y "tildada": no era que no cargaba datos, es que se rompía apenas intentaba renderizar
- Se corrigió la variable y se hizo un barrido con un script en todo `src/` buscando cualquier otro caracter fuera de lugar (CJK) de este tipo — no apareció ningún otro caso
- Archivo: `src/pages/admin/DashSocios/components/TicketConfig.jsx`

### 80b. Panel de % en Carta: ahora siempre visible
- El panel de "Aumentar/Disminuir % o precio fijo" existía, pero estaba oculto hasta tildar al menos un producto — por eso costaba encontrarlo. Ahora el panel siempre está a la vista (con el botón "Aplicar" deshabilitado hasta que se seleccione algo), con un texto que indica qué hacer
- Archivo: `src/pages/admin/DashSocios/components/CartaAdmin.jsx`

## Completado en esta sesion (81 - Roles de staff: Mesas, permisos)

### 81a. Cajero: ve Mesas, sin poder borrar
- `MesasAdmin.jsx` ahora oculta el botón 🗑️ (eliminar mesa) cuando el rol logueado es `cajero`. El dueño/superadmin lo siguen viendo normal
- Para que el cajero llegue a "Mesas" hacía falta que pudiera entrar al panel: ver el punto siguiente

### 81b. NUEVO: mozo/cajero/cocina ahora usan el panel real (no las pantallas viejas de `/cliente`)
- Antes, mozo y cajero (cocina ni siquiera estaba contemplado) quedaban mapeados a `/cliente/*`, pantallas viejas y prácticamente vacías. Ahora los tres roles entran al mismo panel que usa el dueño (`/admin/dash-socios/...`), resolviendo su restaurante a través de su propia fila en `cliente_usuarios` (antes esa resolución solo existía para el dueño vía `clientes.user_id`)
- El sidebar para estos tres roles muestra únicamente las secciones que el dueño les habilitó (ver siguiente punto) — no ven Vendedores, Crear Socios, Nuevos Clientes ni Dash Socios (eso sigue siendo solo de superadmin)
- Archivos: `src/App.jsx` (el `/admin` ahora también acepta mozo/cajero/cocina), `src/hooks/useAuth.js` (a dónde redirige cada rol al loguearse), `src/pages/admin/DashSocios/index.jsx`, `src/components/Layout/Sidebar.jsx`

### 81c. NUEVO: el dueño elige qué ve cada rol (pestaña "Usuarios")
- Tabla de checks arriba de todo en "Usuarios": filas = Mesas/Carta/Caja/Promos/Suscriptos/Ticket/Usuarios, columnas = Mozo/Cocina/Cajero. Lo que no está tildado no aparece en el sidebar de ese rol, y si entran por URL directa a una sección no habilitada, la pantalla se los avisa en vez de mostrar el contenido
- Default de fábrica (para restaurantes que todavía no lo configuraron): mozo y cocina ven Mesas; cajero ve Mesas y Caja
- El Builder (Guardar/Exportar en Carta) nunca se le muestra a mozo/cajero/cocina, tengan o no permiso para entrar a Carta — es una herramienta de diseño, no de operación diaria
- **Acción manual**: correr `supabase/permisos_roles_staff.sql`
- Archivo: `src/pages/admin/DashSocios/components/UsuariosStaff.jsx`

## Completado en esta sesion (82-84)

### 82. Fila duplicada "desde/hasta" en Definir turnos
- Cada tarjeta de turno ahora tiene **dos filas** "desde/hasta" (horarios duplicados lado a lado)
- Se duplico el bloque `<div className="flex items-center gap-2 mb-2 text-xs">` con inputs `desde` y `hasta`
- Ancho de la tarjeta ajustado de `w-52` a `w-64` para acomodar ambos pares
- Archivo: `src/pages/admin/DashSocios/components/UsuariosStaff.jsx`

### 83. NUEVO: Seccion "3. Calendario"
- **Anio** visible arriba a la derecha (clickable)
- **12 meses** como botones toggleable (Ene-Dic)
- Al expandir un mes: semanas (lunes a domingo) apiladas verticalmente
- Cada fila semana: checkbox izquierdo (con soporte `indeterminate` para parcial) + 7 celdas de dia
- **Encabezado de dias de la semana** (Lun, Mar, Mié, Jue, Vie, Sáb, Dom) debajo del nombre del mes
- Click en un dia: toggle de seleccion con colores de rol
- Dentro de cada dia seleccionado: nombre del empleado + horario (desde-hasta) con color de su rol
- Celdas grandes (`w-28 h-28`) para mostrar nombre + horario
- **Leyenda** debajo del calendario: por cada rol, lista de empleados con su color (se acumula, no se borra)
- Boton "📅 Guardar y aplicar calendario" al final
- `guardarCalendario()` convierte dias seleccionados a indices de dia de semana y guarda en `cliente_usuarios.horarios` (jsonb)
- Dias de la semana removidos del panel "Definir turnos" (se repiten en el calendario)
- ID de turno con contador secuencial (`t1`, `t2`...) en lugar de `Date.now()` para preservar turnos existentes
- Archivo: `src/pages/admin/DashSocios/components/UsuariosStaff.jsx`

### 84. Fix ID de turno con contador
- **Problema**: `addTurno()` usaba `Date.now()` como id, lo que podia causar conflictos al crear multiples turnos rapidamente
- **Solucion**: Contador secuencial (`turnoCounter` state, empieza en 2) genera ids `t2`, `t3`, etc.
- El `addTurno` usa `const newId = 't' + turnoCounter` y luego `setTurnoCounter(prev => prev + 1)`
- Cada turno se preserva correctamente al agregar nuevos
- Archivo: `src/pages/admin/DashSocios/components/UsuariosStaff.jsx`

## Pendiente / Ideas

### Pendiente
- [ ] Ejecutar supabase/seguridad_rls_fix.sql en Supabase SQL Owner (DROP + CREATE policies + RPC functions)
- [ ] Ejecutar supabase/asignar_promos_nuevos.sql en Supabase SQL Editor
- [ ] Ejecutar supabase/promociones_canje.sql en Supabase SQL Editor
- [ ] Ejecutar supabase/promociones_fix_completo.sql en Supabase SQL Editor
- [ ] Probar flujo completo: crear promo con para_nuevos → suscribir → ver badge verde → clic promo → Obtener promo ahora → carrito
- [ ] Verificar que la contraseña de supabase_admin no se exponga en logs
- [ ] Probar impresion en impresora real

### Bugs conocidos
- [ ] Badge verde en categorias no se muestra siempre (race condition con _promoCount al inicio)
- [ ] Selector de producto en PromocionesAdmin puede no mostrar productos si la categoria no tiene imagen

### Mejoras futuras
- [ ] Agregar notificaciones push para llamadas del mozo
- [ ] Historial de pedidos por mesa
- [ ] Reportes de ventas por fecha
- [ ] Exportar pedidos a Excel
- [ ] Modo oscuro/claro para el menu publico
- [ ] Multi-idioma en el menu publico
# Cambios completados - Mesas 1+ (2026-09-09)

- [x] Ocultar y saltear Delivery en Mesa 0 cuando el pedido se retira en el local.
- [x] Permitir pasar directamente de Cocina/Mozo a Pedido entregado en pedidos de retiro.
- [x] Ocultar el teléfono/WhatsApp de Mesa 0 únicamente a cocina y mozo, sin modificar Retiro/Delivery.
- [x] Ocultar nuevamente precios y totales a los usuarios mozo y cocina en todas las mesas.
- [x] Usar `DDMMYYYY-01-M0` en Mesa 0 y sustituir códigos aleatorios activos en la cabecera de la tarjeta.
- [x] Reemplazar códigos aleatorios tipo PHCG091 por fecha y correlativo diario desde 01.
- [x] Agregar el número de mesa al código de pedidos de mesas 1 en adelante.
- [x] Mostrar código de pedido y número de mesa en cada ticket cobrado de Caja.
- [x] Mostrar los tickets cobrados uno debajo de otro y a todo el ancho.
- [x] Restaurar el detalle completo: código, mesa, fecha, hora, productos, cantidades, precios, subtotales y total.
- [x] Persistir automáticamente cada ticket antes de confirmar el cobro.
- [x] Mostrar tickets cobrados dentro de Caja.
- [x] Impedir el cobro si el ticket no pudo guardarse.
- [x] Generar códigos de Mesa 0 por fecha y correlativo diario desde 01.
- [x] Recuperar en Caja tickets históricos que ya habían sido cobrados.
- [x] Agregar Cobrar a cada pedido individual de Mesa 0.
- [x] Reutilizar en Mesa 0 el cuadro Imprimir/Cobrar/X.
- [x] Cerrar el pedido Mesa 0 solamente al cobrar o imprimir.
- [x] Corregir únicamente Mesa 0 sin alterar mesas 1+.
- [x] Hacer funcionar Pedido entregado en Mesa 0 sin cerrar caja.
- [x] Mostrar Mozo o Cocina según el área derivada.
- [x] Insertar Delivery entre Cocina/Mozo y Pedido entregado.
- [x] Agregar ocultar checklist individual a cada pedido de Mesa 0.
- [x] Mover el control de ocultar checklist desde la cabecera a cada Cliente Mesa N.
- [x] Guardar la visibilidad individual por comensal/sesión.
- [x] Sincronizar el control individual con el QR del cliente.
- [x] Quitar el botón redundante **Cerrar Mesa** del detalle.
- [x] Dejar **Cobrar** como única acción visible de cierre/cobro.
- [x] Crear vista operativa idéntica para mozo y cocina con productos y checklist.
- [x] Impedir que mozo/cocina entren al detalle interno de la mesa.
- [x] Ocultar cobro, impresión, QR y gestión de mesas a mozo/cocina.
- [x] Permitir a cada rol marcar solo el segundo check de su área derivada.
- [x] Quitar la etapa **Delivery** únicamente del checklist de mesas físicas.
- [x] Mostrar `✓ OK` en los productos entregados dentro de la tarjeta de mesa.
- [x] Mostrar `✓ OK · Entregado a la mesa` en el bloque del cliente.
- [x] Separar el check **Pedido entregado** del cierre de caja en mesas físicas.
- [x] Mantener la caja abierta hasta pulsar **Cobrar** o **Imprimir**.
- [x] Hacer que **Imprimir** imprima y luego confirme el cobro.
- [x] Mantener **Cancelar** sin cambios sobre pedidos o caja.
- [x] Agregar hover visible a los botones **A Mozo** y **A Cocina**.
- [x] Mantener colores individuales para varios clientes de una misma mesa.
- [x] Conservar mesa 0 sin cambios.
## Barra negra superior adaptable (2026-09-09)

- [x] Mantener flecha, logo, promoción, campana (Mesa 1+), carrito y salir dentro de la barra negra.
- [x] Ordenar automáticamente los controles sin superposición en Builder y QR final.
- [x] Mostrar el nombre de la categoría arriba y la flecha de volver debajo.
- [x] Agregar el botón `✓ Orden automático` en el Builder.
- [x] Aplicar el comportamiento tanto a Mesa 0 como a Mesa 1 en adelante.
## Ajuste final de barra superior (2026-09-09)

- [x] Mostrar el título de categoría en la primera fila con tipografía reducida.
- [x] Mostrar debajo flecha, logo, promoción, carrito y salir en Mesa 0.
- [x] Agregar campana y número de mesa dentro de la barra para Mesa 1 en adelante.
- [x] Agregar el carrito a los controles de posición y al orden automático del Builder.
- [x] Impedir que los elementos salgan de la barra o se superpongan.
## Controles seguros de iconos (2026-09-10)

- [x] Reparar el zoom real de Logo y Promoción en Builder y QR final.
- [x] Limitar el zoom entre 25% y 125% para conservar los iconos dentro de la barra.
- [x] Habilitar X/Y seguro para Volver, Logo, Promo, Carrito y Salir de Mesa 0.
- [x] Habilitar X/Y seguro adicional para Campana y Nº de mesa en Mesa 1+.
- [x] Mantener la distribución automática sin superposiciones.

## Controles en Carta / Diseño del menú
- X/Y (0–100% del espacio disponible) y zoom (25–200%) para logo, promoción, carrito, salir, campana y número de mesa.
- Configuración headerControls persistida en builder_config; Guardar y aplicar regenera el menú público.
- Aplicado en Categorías, Productos y Mi pedido; título y flecha conservados.
- Cada icono tiene un espacio independiente con límites adaptables al ancho de pantalla. El zoom máximo real depende del espacio disponible.

## Confirmación del cliente en Mesa 0
- Solo Pedido entregado es interactivo en el QR. Habilitado desde preparado para retiro, o en_delivery para delivery.
- Guarda entregado y entregado_at en el mismo comensal de Mesas, filtrando cliente, mesa, sesión, ID y estado anterior.
- Evita doble envío; errores visibles sin marcar éxito. No cobra ni cierra caja.

## Caja por usuarios y turnos
- Caja lee cliente_usuarios del restaurante (incluye altas nuevas mediante refresco cada 15 segundos y al recuperar foco).
- Selección usuario, fecha y horario guardado; respeta fechas específicas, días semanales, turnos partidos y nocturnos.
- Reporte por intervalo local: tickets por cobrado_at, pedidos por fecha_hora. No atribuye cobros al empleado ni crea aperturas/cierres de caja.
- Los intervalos incluyen inicio y excluyen final, evitando duplicados entre turnos consecutivos.

## Corrección puntual de Agregar producto (2026-09-11)
- CartaAdmin, compartido por Admin/Superadmin: si el alta devuelve PGRST204 por productos.detalle ausente, reintenta con descripcion conservando el texto.
- Bases con detalle mantienen el guardado original. Otros errores se muestran sin reintentar; no se modifica SQL, diseño, Excel ni otras funciones.

## Horario: entradas y salidas de usuarios (2026-09-11)
- Nuevo ítem Horario en menú del restaurante y pestañas de Superadmin. Admin/Superadmin consultan el restaurante; permiso configurable para que staff consulte solo sus propios registros (RLS).
- Login exitoso registra entrada mediante RPC con auth.uid y session_id del JWT; timestamps de servidor. Restricción única evita duplicados por sesión. Recargar o renovar token no crea entradas.
- Cerrar sesión registra la salida de las sesiones abiertas del usuario, coherente con signOut global existente. Fallos de registro se notifican y no bloquean la salida de la aplicación. Una salida fallida puede quedar sin registrar; si signOut falla después del registro, se informa sin navegar.
- Cerrar pestaña, apagar dispositivo, caducar sesión o desconectarse no inventa salida. La tabla muestra Sin salida registrada y no calcula duración de registros incompletos.
- Se registran dueños y usuarios activos de cliente_usuarios. Superadmin y vendedores sin restaurante propio no generan fichajes globales atribuidos a un restaurante.
- Tabla con nombre, usuario, rol, entrada, salida y duración; filtro por fecha local de entrada y búsqueda, refresco cada 30 s y paginación interna.
- Ejecutar supabase/horario_usuarios.sql antes de desplegar. No genera historial retroactivo. Usuarios deben volver a iniciar sesión para registrar su primera entrada.
- Se conservan las correcciones anteriores de Caja, producto y checklist.

## Correcciones previas conservadas: Caja y checklist
- Caja/cajero puede ver y accionar Ocultar checklist en este QR en Mesa 0 y mesas físicas. No cambian los demás permisos.
- Tickets cobrados en columnas, productos agrupados por ticket, conservando toda la información e impresión. Detalle de pedidos eliminado; resúmenes existentes conservados.
- Cobrar e Imprimir guardan cobrado_por del usuario autenticado; históricos muestran Sin registrar. Ejecutar supabase/tickets_caja_usuario.sql si todavía no se aplicó.

## Monitoreo Horario y totales Desde/Hasta
- Lista fija desde cliente_usuarios: nombre, usuario, rol y horarios; nuevas altas se incorporan en refresco de 30 s. Permisos existentes conservados.
- Presencia por latido autenticado cada 30 s, columna ultima_actividad_at; verde caduca a los 120 s sin actividad. Cerrar sesión retira verde; cerrar pestaña no inventa una salida.
- Desde/Hasta incluye ambos días locales. Totales reales de sesiones cerradas, programados y diferencia; suma milisegundos y convierte al final a horas/minutos (60 min/h). Recorta al rango y une solapamientos por persona; incompletos fuera del total confirmado.
- Turnos actuales de Usuarios: fechas explícitas o días semanales, partidos y nocturnos incluidos; no es snapshot histórico de programaciones anteriores. Expandir Turnos/Historial para ver intervalos.
- Reejecutar supabase/horario_usuarios.sql antes de desplegar: agrega presencia y RPC sin eliminar registros.
- Pruebas aisladas aprobadas para sumas, solapamientos, incompletos, turnos partidos/nocturnos y límites de fechas. Compilación y Supabase real pendientes.

## Corrección de turnos visibles y borde de conexión
- Horario muestra directamente todos los turnos guardados en cliente_usuarios.horarios con horas, fechas/días e inactividad, aunque no coincidan con el filtro. Los totales siguen limitados a Desde/Hasta.
- Borde verde y fondo suave para conexión reciente, además del nombre verde.
- Presencia inmediata en evento Auth (fuera del callback), al recuperar conexión/foco y cada 15 s. Registrar entrada es idempotente por sesión y recupera registros faltantes a la hora de detección, sin inventar hora de login anterior. Errores de RPC visibles.
- Consultas de usuarios/turnos, historial y conexión independientes: un fallo del historial no borra la lista de usuarios ni sus turnos. Error visible y resumen no disponible cuando la carga es parcial.
- Monitor refresca cada 10 s; ausencia de conexión caduca a los 120 s. SQL compatible con rol enum/text.

## Horario simplificado (sustituye monitoreo de turnos anterior)
- Solo nombre, usuario, estado actual, ingreso y salida; se retiran filtros, turnos, comparaciones y totales de Horario. Usuarios y sus turnos no cambian.
- RPC autenticada registra ingreso desde auth.sessions.created_at (sesión y usuario verificados por JWT); no usa hora del navegador ni hora de recuperación. UNIQUE por sesión evita duplicados; histórico sin cambios.
- Conserva borde/nombre verde por presencia, salida explícita y entradas históricas. Refresco cada 5 s. Desconexión no inventa salida.
- Reejecutar supabase/horario_usuarios.sql antes del despliegue. Compilación completa y SQL real pendientes.

## Optimización de tráfico - Horario (2026-09-14)
- Se sacó el "latido" de presencia de 15s (`horarioPresencia.js`): ahora se registra la entrada una sola vez por sesión (respaldo idempotente del trigger de servidor), no en un intervalo. Corría antes para cualquier sesión logueada (mozo/cajero/cocina/admin/superadmin), todo el turno, aunque no tuvieran la pantalla Horario abierta.
- Se sacó el polling de 5s de `HorarioUsuarios.jsx` (volvía a traer TODO el historial paginado cada 5s). Ahora carga una sola vez al abrir la pantalla y se suscribe a Realtime sobre `horario_usuarios`: cada login/logout llega como evento puntual y actualiza solo esa fila.
- El verde/negro dejó de depender de un umbral de 120s sobre `ultima_actividad_at` (podía "apagar" a alguien que seguía conectado si el latido se atrasaba). Ahora es puro evento: verde = existe un registro sin salida (login), negro = ya tiene salida guardada (logout). Coincide con el comportamiento pedido: sin preguntar nada entre medio, solo cambia al loguearse y al presionar Cerrar sesión.
- Acción manual pendiente: correr `supabase/horario_realtime.sql` en el SQL Editor (agrega `horario_usuarios` a la publicación de Realtime). Sin este paso, el login/logout se sigue guardando bien, pero la pantalla Horario no se actualiza sola hasta recargar.
- Archivos: `src/lib/horarioPresencia.js`, `src/pages/admin/DashSocios/components/HorarioUsuarios.jsx`, `supabase/horario_realtime.sql`.

## Horario de personal y separación por socio
- Trigger horario_sesion_creada sobre auth.sessions registra cada login de dueño o personal activo según clientes.user_id / cliente_usuarios.user_id. Usa cliente_id del registro de personal, nunca un nombre ni un socio enviado por el navegador.
- Conserva RPC de login/presencia como respaldo idempotente: UNIQUE(cliente_id,sesion_id) evita duplicar entradas entre trigger y frontend.
- RPC horario_personal solo devuelve personal del cliente solicitado si el usuario es dueño, Superadmin autorizado o ese mismo empleado. No expone otros campos de cliente_usuarios.
- RLS de horario_usuarios restringe dueño a su cliente y staff a sus registros del cliente asociado. Superadmin conserva acceso de gestión.
- Reejecutar supabase/horario_usuarios.sql; luego cerrar sesión y volver a ingresar con cada empleado. No se inventan fichajes de empleados que no iniciaron sesión.
- Validación SQL por revisión y comprobaciones estáticas; falta ejecutar en Supabase real y compilar.


## Optimización de tráfico — 14/09/2026 (estado vigente)
Esta sección sustituye las descripciones históricas de polling y almacenamiento anteriores.
- Autenticación: un observador compartido, carga mínima de clientes (id, user_id, nombre_restaurante), actualización ante cambio de usuario/token y protección frente a respuestas de sesiones anteriores. Configuración carga sus campos al abrirse.
- Mesas: eliminada la consulta y el estado de Cerrados hoy. No se borran pedidos. Rondas visibles cada 5 s después de finalizar la anterior; Cocina cada 4 s. No se cambia la lógica de cobro/checklists.
- Chat: últimos 200 mensajes, Realtime y respaldo visible cada 15 s. Aviso de Mesas cada 30 s más Realtime. Sin Realtime, la recepción puede demorar hasta esos intervalos.
- Caja: abre en el día actual; filtros de tickets/turnos se envían al servidor, intervalo final exclusivo en hora local. Lecturas paginadas y lotes de comensales de 100 para no truncar totales ni generar URLs enormes. Error visible si falla cualquier lote. Usuarios/turnos refrescan visibles cada 60 s.
- Imágenes: nuevas cargas de Carta y persistencia del Builder guardan archivos en bucket productos con nombre SHA-256 y URLs. Se comprueba acceso público antes de cambiar referencias. Se conserva compatibilidad de lectura con base64 anterior. Ejecutar primero supabase/optimizar_imagenes_storage.sql.
- Carta incluye Reducir peso de imágenes para convertir las imágenes antiguas y los JSON del restaurante. Operación progresiva y repetible; no elimina archivos ni registros. No editar simultáneamente desde otra pestaña mientras se convierte. Al terminar reabrir Diseño y Guardar proyecto para publicar el HTML optimizado.
- HTML publicado con nombre de versión nuevo y caché; MenuView valida la versión con no-cache y solo obtiene los campos visuales utilizados de builder_config.
- Autoguardado: evita repetir bloques idénticos confirmados, serializa por bloque y no escribe precios iguales. Guardados manuales conservados.
- Validación: npm run build y 6 pruebas en tests/traffic.test.mjs aprobadas. No se ejecutó SQL ni se accedió a la base real. No se cuantificó el ahorro real. El consumo usado y el bloqueo actual no se revierten con este ZIP.
- Este ZIP no contiene carpeta vercel/: src es la única fuente del proyecto recibido. No se creó una segunda copia que pudiera quedar desactualizada.


## Optimización de tráfico v2 — 15/09/2026 (estado vigente)

Esta sección sustituye las descripciones anteriores de lecturas y polling. Instalación y límites: `LEER-OPTIMIZACION-V2.md`.

- SQL requerido: `supabase/optimizar_trafico_v2.sql`, antes del nuevo frontend. No aplicado en la base real. Reejecutable/transaccional; agrega versiones y RPC invoker, sin cambiar RLS ni borrar datos.
- Mesas/Cocina conservan 5/4 s, pero leen solo versión si no hubo cambios. Con cambios refrescan el conjunto operativo del restaurante. No es todavía un parche por tarjeta. Comensales cerrados fuera de tarjetas físicas. Errores visibles y versión confirmada solo después de una carga completa exitosa.
- QR: estado/versiones pequeños cada 6 s; productos solo al cambiar o tras acción explícita. No se superponen lecturas. Entregado no vacía consumos; cerrado detiene el seguimiento. Nuevo envío de Mesa 0/Mesa 1+ lo reactiva. Campana sin superposición.
- Catálogo: RPC con proyección mínima, compatible detalle/descripcion; caché pública por backend/restaurante/versión. Triggers invalidan automáticamente desde Carta, también eliminaciones. HTML versionado usa caché normal y libera sus Blob URLs al cambiar de ruta. Imágenes de catálogo con carga diferida.
- Chat: 50 mensajes iniciales, incremental por secuencia transaccional y 50 anteriores bajo demanda. Realtime más respaldo visible de 15 s. Aviso de Mesas ordenado por secuencia.
- Caja: 25 tickets por página y resúmenes exactos en servidor para todo el rango; ya no descarga todos los comensales/líneas. Mantiene fórmulas de promociones y filtros/turnos anteriores.
- Horario: hoy por defecto, filtros en servidor, 50 registros por página, totales de todo el rango. Estado abierto independiente de fecha. Realtime y comprobación ligera cada 30 s como respaldo; recarga solo ante versión nueva.
- Socios y Configuración: campos concretos en vez de clientes completos.
- Reexportar Diseño una vez por restaurante después de desplegar para actualizar el código de seguimiento del HTML. Los cambios posteriores de Carta no requieren reexportación manual.
- Conservados permisos de interfaz, checklists, cobros, códigos, usuarios, diseño e imágenes anteriores.
- Validación: build y 14 pruebas Node aprobados; SQL probado en PGlite con esquema representativo, reejecución, rollback, agregados y RLS. Supabase real, políticas instaladas y ahorro real siguen pendientes.
