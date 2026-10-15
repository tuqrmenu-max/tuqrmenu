# AGENTS.md - Reglas del Proyecto QR Menu

## Descripcion del Proyecto
Sistema de menu digital para bares/restaurantes donde:
- Clientes escanean QR y ven menu
- Piden por WhatsApp
- El dueno gestiona desde su dashboard
- Cada mesa tiene su propio QR que abre el mismo menu

## Stack Tecnico
- React 19 + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage)
- Zustand (state management)
- React Router v7
- jszip (descarga de imagenes)
- qrcode.react (generacion de QR)
- Deploy: Vercel

## Estructura de Carpetas
```
src/
├── components/
│   ├── Layout/
│   │   ├── AdminLayout.jsx
│   │   ├── ClienteLayout.jsx
│   │   ├── VendedorLayout.jsx
│   │   ├── Sidebar.jsx
│   │   └── Header.jsx
│   └── Builder/
│       ├── CoverEditor.jsx
│       ├── CategoriesEditor.jsx
│       ├── ProductsEditor.jsx
│       ├── PhonePreview.jsx
│       └── useBuilderState.js
├── hooks/
│   └── useAuth.js
├── lib/
│   ├── supabase.js
│   ├── storage.js
│   ├── store.js
│   └── i18n.js
├── scripts/
│   └── generar-imagenes.cjs
└── pages/
    ├── auth/
    │   └── Login.jsx
    ├── admin/
    │   ├── Dashboard.jsx
    │   ├── Builder.jsx
    │   ├── Vendedores.jsx
    │   ├── NuevosClientes.jsx
    │   ├── Socios.jsx
    │   └── DashSocios/
    │       ├── index.jsx
    │       └── components/
    │           ├── MesasAdmin.jsx
    │           ├── CartaAdmin.jsx
    │           ├── CajaReportes.jsx
    │           ├── PromocionesAdmin.jsx
    │           ├── SuscripcionesAdmin.jsx
    │           └── TicketConfig.jsx
    ├── vendedor/
    │   ├── Dashboard.jsx
    │   └── FormularioCliente.jsx
    ├── cliente/
    │   ├── Dashboard.jsx
    │   ├── Configuracion.jsx
    │   ├── Carta.jsx
    │   ├── Mesas.jsx
    │   ├── Usuarios.jsx
    │   ├── Caja.jsx
    │   ├── Reportes.jsx
    │   └── Promociones.jsx
    └── menu-publico/
        ├── MenuView.jsx
        ├── OrderOverlay.jsx
        ├── useOrderState.js
        └── styles.css
```

## Autenticacion y Roles
- **superadmin**: Primer usuario, acceso total
- **admin**: Dueno del sistema, gestiona vendedores y clientes
- **vendedor**: Crea solicitudes de clientes (formato movil)
- **socio**: Dueno de restaurante (login: nombre@socio.qrmenu.com)
- **mozo**: Mesero del restaurante
- **cajero**: Cajero del restaurante

## Builder unico (reemplaza a los antiguos Admin Builder y Socio Builder)

- Un solo componente: `src/pages/admin/Builder.jsx`, usado en dos rutas:
  - `/admin/builder/:socioId` (entra por parametro de ruta, disponible para superadmin/admin, viene de Socios.jsx)
  - `/socio/builder?clienteId=xxx` (entra por query param desde DashSocios "Crear Menu", o resuelve el cliente_id del propio usuario logueado como socio si no hay query param)
- `exportHtml()` genera **un unico HTML** que se sube una sola vez (`uploadMenuHtml` + `saveMenuUrlToCliente`, un solo `menu_url` en `clientes`)
- Ese HTML se adapta **en tiempo real, leyendo `?mesa=` de la URL** (no hace falta exportar dos veces):
  - `mesa=0`: seccion delivery + "Retirar en el local" visibles, sin campana, pedido enviado por WhatsApp (`wa.me`)
  - `mesa=1` en adelante: sin seccion delivery, con campana para llamar al mozo, pedido enviado directo a Supabase (mesas_operacion / pedidos)
  - La logica vive en el script del HTML exportado (`useBuilderState.js` -> `exportHtml`), condicionada por `mesaNumero` leido de `window.location.search`, no por ningun flag fijado al exportar
- Como resultado hay **dos URLs finales que comparten el mismo menu**:
  - `{origin}/menu/{user_id}?mesa=0` -> delivery / retiro / WhatsApp
  - `{origin}/menu/{user_id}?mesa=1` -> campana / pedido a la mesa via Supabase
  - Ambas se muestran en la pantalla del Builder despues de guardar/exportar
  - Los QR de `MesasAdmin` ya generaban `{origin}/menu/{user_id}?mesa={numero}` por mesa, asi que siguen funcionando sin cambios
- El campo `forceSupabaseOrders` del state quedo **solo como toggle de vista previa** dentro del Builder (botones "Vista previa: Mesa 0" / "Vista previa: Mesa 1+" sobre el PhonePreview), para poder revisar como se ve cada variante sin afectar el HTML exportado
- `MenuView.jsx` sigue haciendo fetch de un unico `clientes.menu_url`, reescribe `mesaNumero` en el HTML segun el query param de la URL de la app, e inyecta un CSS que oculta las campanas en mesa 0 (redundante con la logica JS del export, pero inofensivo)

## Guardar Proyecto (handleSave)
- Ambos builders (admin y socio) exportan HTML automaticamente al guardar
- handleSave() ejecuta: saveBuilderConfig + saveBuilderFieldsToCliente + saveBuilderProducts + exportHtml + uploadMenuHtml + saveMenuUrlToCliente
- No es necesario exportar por separado
- El menu publico se actualiza al guardar

## Dashboard Socios (DashSocios)

### Pestanas disponibles
| Pestana | Componente | Funcion |
|---------|-----------|---------|
| Mesas | MesasAdmin | Gestion de mesas, QR, detalle, imprimir |
| Carta | CartaAdmin | Productos, categorias, imagenes, Excel |
| Caja | CajaReportes | Reportes y caja |
| Promos | PromocionesAdmin | Promociones + envio por WhatsApp a clientes del formulario |
| Suscriptos | SuscripcionesAdmin | Gestion de suscriptos |
| Ticket | TicketConfig | Configurar ticket de impresion |
| Crear Menu | Builder | Abre Socio Builder en nueva ventana |

## Promos - Envio de promociones a clientes del formulario

### Flujo
1. Cliente llena formulario "Hacete Socio" desde icono promo del menu -> INSERT en tabla suscripciones
2. Dashboard socio (Promos y Suscriptos) lista los clientes de suscripciones filtrados por cliente_id
3. Se crea promo con "+ Nueva Promo" (campo opcional fecha_envio para agendar)
4. Seleccionar clientes con checkbox individual o "Seleccionar todos"
5. Boton "Enviar Promos" abre wa.me/{whatsapp}?text={promo} por cada cliente seleccionado

### Detalles tecnicos
- El formulario "Hacete Socio" inserta directamente en tabla suscripciones (cliente_id, nombre, whatsapp, instagram) - NO usa socios_solicitud
- Los clientes aparecen en pestana Suscriptos (SuscripcionesAdmin) y en la lista de envio de Promos (PromocionesAdmin), ambas leen suscripciones
- Columna suscripciones.instagram (text): agregada via supabase/suscripciones_form.sql
- Policy "Anyone can insert suscripciones" TO public + GRANT INSERT TO anon (el formulario inserta sin login)
- Columna promociones.fecha_envio (timestamptz nullable): promo agendada si fecha futura -> badge "Agendada" amarillo + envio bloqueado hasta la hora (re-render cada 30s)
- normalizarWhatsapp(): quita no-digitos; si tiene 10 digitos asume Argentina y agrega prefijo 54
- Envio masivo: window.open con delay de 500ms entre clientes (limitacion: WhatsApp no permite envio automatico sin API Business pagada, solo abre las conversaciones redactadas)
- SQL: supabase/suscripciones_form.sql

### Promociones - Columnas de tabla promociones
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | uuid | auto | PK |
| cliente_id | uuid | - | FK a clientes |
| titulo | text | - | Nombre de la promo |
| descripcion | text | - | Descripcion |
| tipo | text | 'descuento' | 2x1_mismo, 2x1_categoria, descuento |
| categoria | text | null | Categoria asociada |
| producto_id | text | null | JSON array de IDs: `["0","1"]` (strings de Builder) |
| producto_nombre | text | null | JSON array de nombres: `["Café","Té"]` |
| asignacion | text | 'todos' | todos o manual |
| fecha_envio | timestamptz | null | Fecha agendada para envio |
| para_nuevos | boolean | false | Auto-asignar a nuevos suscriptos |
| activa | boolean | true | Si esta activa |
| created_at | timestamptz | now() | Fecha de creacion |
| descuento_porcent | double precision | null | % de descuento |
| descuento_monto | double precision | null | Monto fijo de descuento |
| imagen | text | null | Imagen de la promo |
| fecha_inicio | date | null | Inicio de vigencia |
| fecha_fin | date | null | Fin de vigencia |

### Promos para nuevos suscriptos (para_nuevos)
- Columna `para_nuevos` en tabla `promociones` (boolean, default false)
- Cuando un cliente se suscribe via formulario "Hacete Socio", se llama a la funcion RPC `asignar_promos_nuevos`
- La funcion busca promos con `para_nuevos=true` para ese `cliente_id` y las inserta en `promociones_cliente`
- El suscriptor ve la promo automaticamente en el icono 🎁 del menu
- SQL: supabase/asignar_promos_nuevos.sql

### Badge verde en icono 🎁 (promoDot)
- 3 botones 🎁 en el menu: categorias (#promo), productos (#promoProducts), carrito (#cartPromo)
- Cada uno tiene `<span class="promoDot">` con posicion absoluta top-right
- Badge verde (#22c55e) de 20x20px con borde negro, muestra numero de promos
- Variable `_promoCount` (global, synchrona): se actualiza con localStorage persistence
- `applyPromoDots()`: muestra/oculta dots basado en `_promoCount > _seen`
- `updatePromoBadge(suscId)`: fetch async, actualiza `_promoCount` + localStorage + llama `applyPromoDots()`
- `markPromosSeen(suscId)`: guarda count en localStorage, oculta dots
- `renderTopIcons()` llama `applyPromoDots()` al final para restaurar dots despues de recrear elementos
- `renderTopIcons()` preserva dot existente al recrear innerHTML del boton #promo
- Clave: `promoSeenKey` y `promoCountKey` usan `DATA.socioId` como sufijo

### Selector de producto en PromocionesAdmin
- Tipo "2x1 Categoria": lista de categorias con radio button, nombre y conteo
- Tipo "2x1 Mismo Producto": dos columnas lado a lado
  - Izquierda: boton dropdown "Categorias ▾" con chevron, expande lista de categorias
  - Derecha: lista de productos de la categoria seleccionada con radio, nombre, precio
- Campo `_showCats` en form state controla visibilidad del dropdown de categorias
- Ambos selectores usan imagenes de Supabase (cat.imagen, prod.imagen) con fallback 🍟
- **Multi-select (checkboxes)**: puede seleccionar multiples productos para la promo
- Botones "Limpiar" y "Seleccionar todos" debajo del selector
- `selectedProducts` es array de objetos `[{id, nombre}]` (guardado como JSON array en `producto_id` y `producto_nombre`)

### Obtener promo ahora (en menu publico)
- Boton verde "🎁 Obtener promo ahora" debajo de cada promo en popup "Tus promociones"
- Al hacer clic: `usarPromo(promo)` busca productos coincidentes en `DATA.rows`
  - 2x1_mismo: busca por `producto_id`, agrega 2 unidades al cart
  - 2x1_categoria: busca por `categoria`, agrega 2 unidades de cada producto al cart
- Cierra popup, abre pantalla carrito
- Banner verde en carrito con nombre promo + codigo + boton ✕ para quitar
- Toggle delivery/retiro ya existente funciona con la promo activa
- `state.activePromo` almacena la promo activa (se limpia al enviar pedido o al quitar del carrito)

### Carrito con Promo - Logica de descuento 2x1
- Los productos de promo empiezan **deseleccionados** (checkboxes vacios)
- El cliente selecciona cuales productos quiere aplicar la promo
- El descuento 2x1 se calcula **por producto** (agrupado por nombre):
  - Cada par del mismo producto = 1 gratis
  - Ej: 2 Café ($1400) + 4 Submarino ($1300) → 1 par Café + 2 pares Submarino
- `promoSubtotal` = precio completo de todos los seleccionados
- `promoDiscount` = `Math.floor(count/2) * price` por cada grupo
- `total = Math.max(0, cartSubtotal + promoSubtotal - promoDiscount + delivery)` (nunca negativo)
- Banner "🎉 Nx1 aplicado" muestra total de gratis y descuento
- `es_promo: 1` se envia en pedidos Supabase cuando hay promo activa
- Matching de productos: ID exacto → nombre exacto → case-insensitive → fallback DB

### Ruta
- Admin: /admin/dash-socios
- Builder (unico, ver seccion "Builder unico" arriba): /socio/builder?clienteId=xxx (desde DashSocios) o /admin/builder/:socioId (desde Socios.jsx)

## Builder (MenuQR)

### Desenfoque Individual por Fondo
- blur: Desenfoque de portada (CoverEditor)
- categoriesBlur: Desenfoque de fondo de categorias (CategoriesEditor)
- productsBlur: Desenfoque de fondo de productos (CategoriesEditor)
- cartBlur: Desenfoque de fondo de carrito (CategoriesEditor)
- Cada uno tiene su propio slider 0-100%
- Se guardan en builder_config y se aplican en preview + HTML exportado

### Persistencia del Builder (builder_config)
- Columna builder_config (jsonb) en tabla clientes: guarda config visual + iconos
- Columna builder_products (jsonb) en tabla clientes: guarda productos/filas
- Auto-save: 2 segundos despues de cada cambio (useEffect debounce)
- Guardado doble: Supabase builder_config + localStorage (fallback si falla)
- Carga: Al abrir Builder, lee de Supabase -> fallback a localStorage
- Campos guardados en builder_config: categoriesBg, productsBg, cartBg, blur, categoriesBlur, productsBlur, cartBlur, welcomeColor, welcomeBg, welcomeBgNone, welcomeSize, buttonText, buttonBg, buttonBorder, buttonColor, buttonFontSize, buttonPadding, buttonWidth, logoTransform, welcomeTransform, buttonTransform, topTransforms, categoryTransforms, waIcon, igIcon, mapIcon, promoIcon
- SQL: supabase/builder_config.sql

### Controles del Boton (CoverEditor)
- buttonFontSize (8-30px): tamano de letra del boton
- buttonPadding (5-40px): espacio interno del marco
- buttonWidth (30-100%): ancho/largo del boton
- TransformControls calcula maxW dinamicamente segun buttonWidth

### Iconos Personalizados (Top Bar)
- 4 iconos: WhatsApp, Instagram, Promocion, Direccion
- Logo como icono: div#smallLogo wrapper con img interno, posicionado igual que otros iconos
- En Builder (PhonePreview): renderiza img si state tiene el icono, sino emoji fallback
- En HTML exportado: renderTopIcons() reemplaza emojis por img usando DATA.waIcon etc.
- En menu publico (MenuView): Inyecta iconos desde builder_config al HTML dinamicamente

### Posicionamiento de Elementos
- Canvas virtual: 1080x1920px (9:16)
- PhonePreview: Renderiza a 1080x1920 y escala con CSS transform: scale(0.22)
- Transform controls: X, Y, Escala, Rotacion

## PhonePreview (Vista Previa)

### Escala Real
- Canvas de 1080x1920px (mismo tamano que el HTML exportado)
- Se escala con CSS transform para caber en el panel del Builder (~420px alto)
- Sin factores manuales de escala
- Mismos inline styles que el HTML exportado
- Vista previa identica al menu real del cliente

### Elementos renderizados
- Cover: welcome text, logo, boton VER MENU
- Categories: top bar con iconos + campana + salir, grid de categorias (sin bottom bar)
- Products: top bar, cards con imagen/nombre/precio/controles inline, bottom bar
- Cart: items, subtotal/delivery/total, boton enviar

## Barra Inferior (Bottom Bar)

### productsBottom (Pantalla Productos)
- ELIMINADA: La bottom bar de productos fue removida (logo, campana y salir)
- Reemplazada por cluster superior derecho (#topActions) DENTRO de la barra de titulo (productsTop): Promo | Campana | Carrito | Salir
- Alineado con el nombre de la categoria (margin-left:auto en la barra, no usa position:fixed)
- Visible solo en vista products (esta dentro de la seccion products)
- SIN marcos individuales: los botones del cluster son transparentes (sobre la barra negra del titulo), con drop-shadow para legibilidad
- Promo (#promoProducts): mismo handler (promoHandler) que icono promo de portada, usa DATA.promoIcon si existe
- Campana (#callMozoTop): llama al mozo -> actualiza mesas_operacion estado "Pendiente" (solo si forceSupabaseOrders y mesa>0)
- Carrito (#floatingCart): position:relative dentro del cluster, 40x40px
- Salir (#exitTop): vuelve a portada setView('cover')
- El popover #pop (formulario Hacete Socio) esta a nivel phone (fuera de la seccion cats) para funcionar desde cualquier vista
- El popover tiene boton ✕ (promoClose) arriba a la derecha para cerrarlo; click en promo cuando esta abierto tambien lo cierra
- promoHandler compartido por 3 botones: #promo (portada/cats), #promoProducts (pantalla productos), #cartPromo (pantalla carrito "Mi pedido")
- Pantalla completa en movil: @media(max-width:520px) .phone usa 100vw x 100dvh sin aspect-ratio (elimina el espacio negro debajo del menu en pantallas alargadas)

### catsBottom (Pantalla Categorias)
- ELIMINADO: La bottom bar de categorias fue removida
- Campana (#callMozoCats) y Salir (#exitMenuCats) ahora estan en el top bar
- Se posicionan con topTransforms.bell y topTransforms.exit

### Campana - Comportamiento Amarillo/Rojo
- Default: amarillo (#f59e0b) con borde amarillo
- Al click: cambia a rojo (#ef4444) con animacion pulse-bell (scale 1 -> 1.12)
- Guarda estado en Supabase: mesa_operacion.estado = 'Pendiente'
- Admin: card con borde rojo + vibracion animate-shake-vibrate
- Polling cada 3s: consulta mesas_operacion para detectar si admin dismiss
- Cuando admin hace click en card de mesa (estado -> Ocupada): campana vuelve a amarillo
- Check inicial al cargar pagina: si mesa ya esta Pendiente, muestra roja + arranca polling
- Ambas campanas (callMozoTop y callMozoCats) comparten el mismo estado via clases .active
- Para dismiss desde admin: click en cualquier parte de la card de mesa (no solo el icono campana)

## HTML Exportado - Portada

### Elementos
- Welcome text: posicion absolute con transform (X, Y, escala, rotacion)
- Logo: posicion absolute, width 48.3871%, transform (X, Y, escala, rotacion)
- Boton VER MENU: posicion absolute, width dinamico (buttonWidth%), padding (buttonPadding), font-size (buttonFontSize)
- Badge Mesa (#mesaBadge): position fixed, top-right, oculto en cover, visible en otras vistas
- Carrito flotante (#floatingCart): position fixed, top-right, sin borde ni fondo, badge amarillo/v Verde

### Visibilidad por Vista
- Cover: mesa-badge oculto, floatingCart oculto
- Categories: mesa-badge visible, floatingCart oculto
- Products: mesa-badge visible, floatingCart visible
- Cart: mesa-badge visible, floatingCart visible

## HTML Exportado - Pantalla de Productos

### Layout (card inline)
- .product-card: Layout flex row con imagen, nombre/precio, controles, check en fila
- Imagen 64x64px a la izquierda
- Nombre y precio al medio
- Controles [-][0][+] y check al costado derecho

### Controles de Cantidad
- Botones 32x32px, fondo verde #166534
- Separacion 6px entre controles
- Numeros medianos (16px fuente, cantidad centrada)
- +/- solo cambia draftQty (cantidad temporal)
- Check al costado del + agrega al carrito

### Comportamiento del Check
- Sin cantidad -> cuadrado vacio (borde azul #3b82f6, fondo transparente, sin tilde)
- Click -> relleno verde (#22c55e) con tilde blanca, agrega al carrito con draftQty
- En carrito -> verde con tilde, click lo quita del carrito

### Badge Carrito Flotante
- Amarillo (#f59e0b) cuando vacio
- Verde (#22c55e) con cantidad cuando tiene items

### Barra Inferior Fija (productsBottom)
- position: fixed; bottom: 0; z-index: 99
- Fondo: rgba(0,0,0,.9) con backdrop-filter: blur(12px)
- Contenido: Logo (izq) | Campana (centro) | Salir (der)

### Estado draftQty
- state.draftQty: objeto con cantidades temporales por producto
- +/- modifican draftQty, NO cart
- Check transfiere draftQty a cart y limpia draftQty
- Al enviar pedido, se limpia cart y draftQty

## Pantalla Carrito (HTML exportado)
- Boton "Enviar Pedido" (no "Enviar por WhatsApp")
- Si forceSupabaseOrders: envia a Supabase DB
- Si mesa 0 o sin Supabase: envia por WhatsApp
- Si mesa > 0 con Supabase: envia a Supabase DB

## Icono Promocion -> Formulario "Hacete Socio"
- Click en regalo icono abre popover con formulario
- Campos: Nombre, WhatsApp, Instagram
- Boton "Enviar" -> guarda en tabla suscripciones (con manejo de error: si falla muestra "Error al enviar" en vez de confirmacion falsa)
- Mensaje de confirmacion con nombre del usuario
- Letras agrandadas 50%: titulo 22px, subtitulo 18px, inputs 20px, boton 21px, success 21px

## Checklist de Estados (Delivery / Retiro)

### Flujo visual con 4 checks de colores
El pedido Mesa 0 (delivery/retiro) avanza a traves de 4 checks circulares que aparecen en la card del pedido tanto en `MesasAdmin` como en `CocinaPanel`:

| Check | Color | Estado que activa | Quien lo marca |
|-------|-------|-------------------|----------------|
| 🟡 Amarillo | `#f59e0b` | `en_preparacion` (derivado) | Cajero/Admin (via botones "A Mozo" / "A Cocina") |
| 🔵 Azul | `#3b82f6` | `preparado` | Mozo o Cocina (segun `derivado_area`) |
| 🟣 Morado | `#a855f7` | `entregado` | Cajero/Admin (despachar delivery/retiro) |
| 🟢 Verde | `#22c55e` | `cerrado` | Cajero/Admin + comentario del cliente |

### Transicion de estados
```
nuevo → en_preparacion → preparado → entregado → cerrado
        🟡 A Mozo/Cocina  🔵 Listo    🟣 Despachar  🟣 Recibido + comentario
```

### Separacion de seguimiento y caja en mesas 1+
- En mesas fisicas (`mesa >= 1`) el checklist muestra solo: **Ingresa menú → Cocina → Pedido entregado**. La etapa **Delivery** no se renderiza.
- Al marcar **Pedido entregado**, cada producto del comensal muestra `✓ OK` y su bloque muestra `✓ OK · Entregado a la mesa`.
- El check verde **Pedido entregado** solo actualiza `comensales.estado_pedido='entregado'`; nunca modifica `pedidos_qr.pagado`, el total ni el estado de caja.
- La cuenta permanece abierta aunque todos los pasos visuales tengan check.
- Solamente **Cobrar** marca los pedidos seleccionados como pagados y cierra el comensal cuando ya no tiene consumos pendientes.
- **Imprimir** imprime el ticket y luego ejecuta el mismo cobro/cierre; **Cancelar** no modifica datos.
- Mesa 0 conserva sin cambios su flujo anterior de delivery/retiro y cierre mediante el check verde.
- En las tarjetas de mesas 1+, los botones **A Mozo** y **A Cocina** tienen efecto hover de color, escala y resplandor.
- Los clientes concurrentes conservan un color individual consistente en productos, checklist y la lista **Clientes activos**.

### Vista de mesas para mozo y cocina
- Los roles `mozo` y `cocina` ven las tarjetas de mesas 1+ con número de mesa, clientes, nombres de productos y checklist.
- No pueden abrir el modal interno de la mesa.
- No ven Cobrar, Imprimir, Eliminar mesa, Descargar QR ni controles para agregar/quitar mesas.
- Ambos conservan acceso al Chat del equipo.
- En el checklist solamente pueden accionar el segundo check (**Cocina/Preparado**) cuando `estado_pedido='en_preparacion'` y `derivado_area` coincide con su login.
- Un mozo no puede completar pedidos derivados a cocina y un usuario cocina no puede completar pedidos derivados a mozo.
- Los demás checks se muestran como información de avance, sin interacción para esos roles.

### Cierre de mesas
- El botón independiente **Cerrar Mesa** fue retirado del modal de detalle.
- **Cobrar** es la única acción visible para confirmar el cobro; admite selección parcial o total y libera la mesa cuando no quedan pedidos pendientes.
- **Imprimir** continúa imprimiendo y ejecutando el mismo cobro.

### Visibilidad individual del checklist
- El check global de la parte superior de Mesas fue eliminado.
- Cada bloque **Cliente Mesa N** tiene su propio check **Ocultar checklist en este QR**, visible para admin y superadmin.
- La preferencia se guarda en `comensales.ocultar_checklist`, por lo que afecta solo a ese cliente/sesión.
- Cuando está marcado, se oculta el checklist en la tarjeta de mesa y en el QR de ese cliente; el control permanece visible para poder volver a mostrarlo.
- SQL: `supabase/checklist_visibilidad_por_cliente.sql`.

### Checklist de Mesa 0
- Este ajuste es exclusivo de `mesa=0`; la implementación estable de mesas 1+ no se modifica.
- Flujo visible: **Ingresa menú → Cocina/Mozo → Delivery → Pedido entregado**.
- El segundo texto cambia a **Mozo** cuando `derivado_area='mozo'`; en caso contrario muestra **Cocina**.
- `Delivery` usa el estado intermedio `en_delivery` y aparece después de Cocina/Mozo y antes de Pedido entregado.
- El check verde actualiza a `estado_pedido='entregado'` y nunca modifica `pedidos_qr.pagado`, totales ni caja.
- Cada tarjeta de pedido de mesa 0 incluye **Ocultar checklist en este QR**, persistido en `comensales.ocultar_checklist`.
- Cada pedido de mesa 0 incluye el botón **Cobrar**.
- **Cobrar** abre el mismo cuadro de mesas 1+ con **Imprimir**, **Cobrar** y cierre por **X**, pero contiene únicamente los productos del pedido mesa 0 seleccionado.
- **Imprimir** imprime y cobra; **Cobrar** cobra sin imprimir; la **X** cierra el cuadro sin cambios.

### Persistencia de tickets en Caja
- Todo cobro guarda primero un snapshot en `tickets_caja` con cliente, mesa, código, total, productos, fecha y si fue impreso.
- Si el INSERT del ticket falla, el sistema no marca los pedidos como pagados y muestra el error; así ninguna venta desaparece antes de llegar a Caja.
- Caja muestra una sección **Tickets cobrados** con los registros persistentes y respeta sus filtros de fecha y mesa.
- Los tickets cobrados se muestran uno debajo de otro, cada uno a todo el ancho disponible.
- Cada ticket muestra código, mesa, fecha, hora, estado de impresión, cantidades, productos, precios unitarios, subtotales y total final.
- Todos los pedidos usan el correlativo diario atómico `generar_codigo_pedido`: Mesa 0 usa `DDMMYYYY-01-M0`; mesas 1+ usan el mismo formato más la mesa, por ejemplo `DDMMYYYY-02-M1`. El contador vuelve a `01` al cambiar la fecha.
- Los códigos aleatorios heredados de pedidos activos de Mesa 0 se reemplazan y persisten automáticamente con el formato nuevo en la misma ubicación de la tarjeta.
- Los usuarios mozo y cocina nunca ven precios ni totales en la pantalla Mesas, incluida la sección Mesa 0.
- Los usuarios mozo y cocina tampoco ven el teléfono/WhatsApp del cliente en los pedidos de Mesa 0.
- Esta restricción no modifica la visualización de Retira en el local ni Delivery.
- En Mesa 0, si el método es **Retira en el local**, el checklist oculta y saltea Delivery: después de Cocina/Mozo permite marcar directamente **Pedido entregado**.
- Los pedidos Mesa 0 con método Delivery conservan los cuatro pasos completos.
- Caja identifica explícitamente cada ticket con su código de pedido y número de mesa.
- SQL requerido: `supabase/tickets_caja_y_codigos.sql`.
- El SQL recupera cobros históricos ya marcados `pagado=1`, incluido cualquier ticket anterior que no hubiese aparecido en Caja.

### Componente reutilizable
Archivo: `src/pages/admin/DashSocios/components/ChecklistEstados.jsx`
- Renderiza los 4 checks circulares con su color correspondiente.
- Cada check es clickeable solo si:
  1. El rol del usuario logueado tiene permiso para esa transicion.
  2. El estado del pedido es el esperado.
- El check verde dispara un `window.prompt()` para pedir el comentario del cliente.
- Si el usuario cancela el prompt, no se ejecuta el UPDATE.
- Helper `cerrarPedido(comensalId, comentario)` se pasa como prop `onCerrar` y debe ejecutar:
  1. UPDATE `pedidos_qr SET pagado=1 WHERE comensal_id=X AND pagado=0`
  2. UPDATE `comensales SET estado_pedido='cerrado', cerrado_at=now(), comentario_cliente=X WHERE id=X`

### Permisos por check y rol
| Check | admin | cajero | mozo | cocina |
|-------|-------|--------|------|--------|
| 🟡 Amarillo | ✅ solo si estado=nuevo | ✅ solo si estado=nuevo | ❌ | ❌ |
| 🔵 Azul (area=mozo) | ✅ | ✅ | ✅ | ❌ |
| 🔵 Azul (area=cocina) | ✅ | ✅ | ❌ | ✅ |
| 🟣 Morado | ✅ solo si preparado | ✅ solo si preparado | ❌ | ❌ |
| 🟢 Verde | ✅ solo si entregado | ✅ solo si entregado | ❌ | ❌ |

### Columnas DB nuevas (supabase/checklist_estados.sql)
```sql
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS preparado_at timestamptz;
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS entregado_at timestamptz;
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS cerrado_at timestamptz;
ALTER TABLE comensales ADD COLUMN IF NOT EXISTS comentario_cliente text;
```

### Seccion "Cerrados hoy" en MesasAdmin
- Lista colapsable al final de MesasAdmin (visible para cajero/admin, oculta para cocina).
- Filtra `comensales` con `estado_pedido='cerrado'` Y `cerrado_at >= inicio_del_dia`.
- Cada card muestra codigo, hora de cierre, total y el comentario del cliente.
- Refresca cada 5s junto con el resto.

### CocinaPanel actualizado
- Ademas de pedidos `en_preparacion` con `derivado_area='cocina'`, ahora muestra tambien los que ya estan en `preparado` (para que el cocinero vea su propio avance).
- Boton verde unico reemplazado por el `ChecklistEstados` completo.

### CajaReportes actualizado
- Toggle nuevo "Incluir cerrados (caja diaria)" - prendido por default.
- Tabla de detalle agrega columnas: Estado (badge de color) + Comentario del cliente.

### Polling
- MesasAdmin: 5s (antes 5s)
- CocinaPanel: 4s (sin cambios)
- CajaReportes: solo al cambiar filtros (sin cambios)

## Mesas y QR Codes

### Estados de Mesa
- Libre: borde azul, sin pedidos
- Ocupada/Con pedidos: borde verde, con items
- Pendiente: borde amarillo + vibracion (llamada mozo)

### URL del QR
{origin}/menu/{user_id}?mesa={numero}
Siempre usa la ruta de la app, nunca la URL de Supabase Storage

### Descarga QR Masiva
- Genera una sola imagen PNG con todos los QR
- Layout: grilla de 3 columnas x N filas
- Titulo: "QR Codes - {nombre_restaurante}"

## MesasAdmin - Detalle de Mesa

### Modal Detalle (al click en mesa)
- Header: Mesa N + cantidad de clientes
- Lista de clientes activos con boton X para cerrar cada uno
- Tabla: Cant | Producto | P.U. | Subtotal (solo items no pagados)
- Footer: Total + 3 botones de accion

### Funcionalidades del Modal
- Imprimir -> Genera ticket con config del TicketConfig
- Cobrar -> Marca pedidos como pagados + mesa libre
- Cerrar Mesa -> Marca todo como pagado + mesa libre
- Cerrar Cliente -> Marca pedidos del comensal como pagados + desactiva comensal

### Total por Mesa
- Calculado con precios reales de productos (no solo cantidad)
- Se muestra en la card de cada mesa
- Se actualiza automaticamente cada 5 segundos

## TicketConfig (Impresion)

### Pestana "Ticket" en DashSocios
- Componente: TicketConfig.jsx
- Guarda config en columna ticket_config (jsonb) en tabla clientes

### Parametros configurables
| Seccion | Campos |
|---------|--------|
| Encabezado | showLogo, showName, showAddress, showPhone, showCuit, cuit |
| Informacion | showMesa, showFecha, showHora, showDetalle, showSubtotal, showTotal |
| Pie de pagina | showFooter, footerText, footerText2, showQr |
| Formato | fontSize (pequeno/normal/grande) |

### Impresion (MesasAdmin.imprimirTicket)
- Carga ticket_config desde Supabase
- Genera texto con separadores ---
- Respeta configuracion: que campos mostrar/ocultar
- Usa tamano de letra configurado
- Fallback: window.open + print(), luego clipboard

### SQL necesario
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ticket_config jsonb DEFAULT NULL;
Ver: supabase/ticket_config.sql

## Storage (Supabase)

### Buckets
| Bucket | Uso | Publico |
|--------|-----|---------|
| menus | HTML de menus exportados | Si |
| productos | Imagenes de productos/categorias | Si |
| clientes-logos | Logos de restaurantes | Si |

### storage.js
- uploadMenuHtml(): Sube HTML a bucket menus
- saveBuilderConfig(): Guarda config visual + iconos en Supabase + localStorage
- loadBuilderConfig(): Carga config desde Supabase -> fallback a localStorage
- saveBuilderProducts(): Guarda productos/filas en Supabase + localStorage
- loadBuilderProducts(): Carga productos desde Supabase -> fallback a localStorage
- syncBuilderToTables(): Sincroniza builder_products → tablas categorias/productos de Supabase (UPSERT, nunca DELETE)

### Sync Builder → Tablas Supabase
- Ejecutada al guardar (handleSave) via `syncBuilderToTables()` en storage.js
- Lee `clientes.builder_products` (JSONB) y sincroniza con tablas `categorias`/`productos`
- UPSERT por key: si la categoría/producto ya existe (misma key), actualiza; si no, crea
- **Nunca DELETE**: si un producto se eliminó del Builder, no se borra de la tabla (preserva historial)
- CartaAdmin ahora lee categorías de DB fresca (no del state缓存) después de importar Excel
-解决冲突: si Builder crea duplicados, ejecutar `supabase/cleanup_categorias_duplicadas.sql`

### Known Issues
- listBuckets() requiere service_role, no funciona con anon key
- Supabase Storage sirve .html con Content-Type: text/plain -> solucionado con blob URL
- El catch {} sin variable de error puede fallar en esbuild, usar catch(e) {}

## Carpeta vercel/ (Deploy)
Siempre sincronizar cambios desde src/ a vercel/src/ despues de modificar archivos.
Uso el comando: `Copy-Item -Path "E:\vercel\src\{path}" -Destination "c:\Users\caned\OneDrive\Desktop\qrmenu\claude\2\src\{path}" -Force`

## Archivos SQL
| Archivo | Descripcion | Estado |
|---------|-------------|--------|
| supabase/builder_config.sql | Columna builder_config en clientes | Ejecutado |
| supabase/storage_menus.sql | Bucket menus publico | Ejecutado |
| supabase/ticket_config.sql | Columna ticket_config en clientes | Ejecutado |
| supabase/suscripciones_form.sql | Columna instagram + policy INSERT anon + grants | Ejecutado |
| supabase/enable_rls.sql | Habilita RLS en todas las tablas del proyecto | Ejecutado |
| supabase/rls_policies.sql | Policies para tablas de usuario (vendedores, clientes, etc.) | Ejecutado |
| supabase/seguridad_rls_fix.sql | RPC functions + owner-scoped policies + GRANTs | PENDIENTE |
| supabase/asignar_promos_nuevos.sql | RPC para auto-asignar promos a nuevos suscriptos | PENDIENTE |
| supabase/promociones_fix_completo.sql | Columnas adicionales en tabla promociones | PENDIENTE |
| supabase/promociones_canje.sql | Columnas codigo/usada/activa/fecha_uso en promociones_cliente | PENDIENTE |
| supabase/promociones_producto_ids.sql | Cambiar producto_id de uuid a text | Ejecutado |
| supabase/promociones_producto_nombre.sql | Agregar producto_nombre + actualizar RPC | Ejecutado |
| supabase/cleanup_categorias_duplicadas.sql | Limpiar categorías duplicadas | Ejecutado |
| supabase/checklist_estados.sql | Columnas preparado_at, entregado_at, cerrado_at, comentario_cliente en comensales | Pendiente |
| supabase/horario_realtime.sql | Realtime en horario_usuarios (reemplaza el polling de 5s de la pantalla Horario) | PENDIENTE |
| supabase/README.sql | Indice de ejecucion de todos los SQL | Referencia |
| supabase/socios_solicitud.sql | Tabla legada, ya NO se usa | Legacy |

### Orden de ejecucion sugerido
1. supabase/enable_rls.sql (si no se ejecuto antes)
2. supabase/rls_policies.sql (si no se ejecuto antes)
3. supabase/seguridad_rls_fix.sql (DROP + CREATE policies y RPC functions)
4. supabase/asignar_promos_nuevos.sql (DROP + CREATE function)
5. supabase/promociones_fix_completo.sql (columnas nuevas)
6. supabase/promociones_canje.sql (columnas en promociones_cliente)

## RLS Policies (rls_policies.sql)
Tablas con políticas RLS configuradas:
| Tabla | Politicas |
|-------|-----------|
| vendedores | SELECT, INSERT |
| clientes | SELECT |
| solicitudes_cliente | SELECT |
| mesas | SELECT, INSERT, UPDATE |
| categorias | SELECT, INSERT, UPDATE, DELETE |
| productos | SELECT, INSERT, UPDATE, DELETE |
| mesas_operacion | SELECT, INSERT, UPDATE, DELETE |
| comensales | SELECT, INSERT, UPDATE, DELETE |
| pedidos_qr | SELECT, INSERT, UPDATE, DELETE |
| pedidos | SELECT, INSERT, UPDATE, DELETE |
| suscripciones | SELECT, INSERT, UPDATE, DELETE |
| promociones | SELECT, INSERT, UPDATE, DELETE |
| promociones_cliente | SELECT, INSERT, UPDATE, DELETE |
| cliente_usuarios | INSERT, UPDATE |

### NOTA: tabla socios_solicitud (LEGADA - ya NO se usa)
- El formulario "Hacete Socio" ahora inserta en suscripciones (ver supabase/suscripciones_form.sql)
- La tabla puede quedar en Supabase sin uso, no molesta
- Estructura: id, cliente_id, nombre, whatsapp, instagram, fecha

## Conocido
- Error 422 en Supabase = email ya existe
- Error 406 = falta RLS policy en la tabla (ej: INSERT en vendedores faltaba policy)
- Error 42501 = violacion de RLS: la policy no existe o no cubre el rol (ej: INSERT anon sin policy TO public + GRANT)
- Badge UNRESTRICTED en Supabase Table Editor = RLS deshabilitado en esa tabla (ejecutar supabase/enable_rls.sql)
- Crear policies NO activa RLS: hace falta ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- smallLogo en HTML exportado es un div wrapper (no img) para que inline styles lo posicionen correctamente
- QR codes siempre deben usar /menu/{user_id}?mesa={X}
- MenuView inyecta iconos desde builder_config al HTML dinamicamente
- El catch {} sin variable puede causar error de build en Vercel
- TransformControls acepta maxW como funcion para calculo dinamico (ej: boton con ancho variable)

## Seguridad - RLS (Row Level Security)

### Vulnerabilidad encontrada y corregida
- **Problema**: tabla `suscripciones` tenia policy `Authenticated users can update own subscriptions` que usaba `auth.uid() = user_id`
  - `auth.uid()` retorna el ID del usuario autenticado, NO el `id` de la tabla suscripciones
  - Un usuario autenticado podia modificar cualquier registro de suscripciones
- **Solucion**: `supabase/seguridad_rls_fix.sql` con owner-scoped policies

### Owner-scoped policies (tabla suscripciones)
```sql
-- Solo el owner de la tabla puede INSERT/UPDATE/DELETE
-- authenticated y anon no pueden modificar datos de suscripciones
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suscriptions_owner_full_access" ON suscripciones
  USING (current_setting('role') = 'supabase_admin')
  WITH CHECK (current_setting('role') = 'supabase_admin');
```

### RPC functions (seguridad_rls_fix.sql)
| Funcion | Parametros | Retorno | Uso |
|---------|-----------|---------|-----|
| `mis_suscriptores` | p_cliente_id uuid | SETOF suscripciones | Listar suscriptos del socio |
| `mis_promos_activas` | p_cliente_id uuid | SETOF promociones | Listar promos activas para el socio |
| `insertar_suscripcion` | p_cliente_id, p_nombre, p_whatsapp, p_instagram | void | Formulario "Hacete Socio" |
| `asignar_promos_nuevos` | p_cliente_id uuid | void | Auto-asignar promos para_nuevos a nuevos suscriptos |

### Importante
- `mis_promos_activas` necesita `DROP FUNCTION` antes de `CREATE` al cambiar tipo de retorno
- `asignar_promos_nuevos` se llama desde el frontend despues del INSERT en suscripciones

### SQL files de seguridad
- `supabase/seguridad_rls_fix.sql`: RPC functions + owner-scoped policies + GRANTs
- `supabase/enable_rls.sql`: Habilita RLS en TODAS las tablas del proyecto
- `supabase/rls_policies.sql`: Policies para tablas de usuario (vendedores, clientes, etc.)
- `supabase/promociones_canje.sql`: Columnas codigo, usada, activa, fecha_uso en promociones_cliente

## Horarios de Usuarios (UsuariosStaff.jsx)

### Estructura general
Pantalla completa en `src/pages/admin/DashSocios/components/UsuariosStaff.jsx` accesible desde la pestana "Usuarios" del dashboard del dueño. Contiene 3 secciones:

#### 1. Definir turnos
- Array `turnos` con objetos `{ id, activo, desde, hasta, dias }`
- Cada turno tiene **dos filas** "desde/hasta" (horarios duplicados lado a lado)
- Botones de dias de la semana removidos (se repiten en el calendario)
- IDs de turno generados con contador secuencial (`t1`, `t2`...) para preservar el estado al agregar nuevos turnos

#### 2. Asignar a empleados
- Checkboxes por rol (mozo, cocina, cajero) para seleccionar empleados
- Seleccionar todos por rol
- Empleados leidos de `cliente_usuarios`

#### 3. Calendario
- **Anio** mostrado arriba a la derecha (clickable)
- **12 meses** como botones toggleable (Ene-Dic) debajo del anio
- Al expandir un mes: muestra semanas (lunes a domingo) apiladas verticalmente
- Cada fila semana: checkbox izquierdo (selecciona toda la semana con soporte `indeterminate`) + 7 celdas de dia
- **Encabezado de dias de la semana** (Lun, Mar, Mié, Jue, Vie, Sáb, Dom) debajo del nombre del mes y arriba de las semanas
- Click en un dia: toggle de seleccion (se colorea con fondo primario)
- Dentro de cada dia seleccionado: nombre del empleado + horario (desde-hasta) con color de su rol
- **Leyenda** debajo del calendario: por cada rol, lista de todos los empleados con su color (no se borran al agregar nuevos)
- **2 botones de guardar**: "Guardar y aplicar horarios" (turnos) y "Guardar y aplicar calendario" (calendario)
- `guardarCalendario()` convierte los dias seleccionados a indices de dia de semana y los guarda en `cliente_usuarios.horarios` (jsonb)

### SQL
- `supabase/staff_usuarios_horarios.sql`: agrega `usuario`, `activo`, `horarios` a `cliente_usuarios` + funcion `resolver_login_usuario`
- `supabase/permisos_roles_staff.sql`: agrega `permisos_roles` a `clientes`
- `supabase/fix_rol_cocina.sql`: agrega rol `cocina` al constraint de `cliente_usuarios`

### Colores por rol
- Mozo: `bg-blue-500`
- Cocina: `bg-green-500`
- Cajero: `bg-purple-500`
- Admin: `bg-amber-500`
## Regla de barra superior del menú (2026-09-09)

- La barra negra superior usa distribución flexible y adaptable; ningún botón puede posicionarse fuera de ella ni superponerse con otro.
- El primer bloque muestra el título de la vista/categoría arriba y la flecha de volver debajo.
- A continuación se muestran logo/información, promoción, campana solo cuando corresponde a mesas 1+, carrito y salir.
- Las coordenadas históricas de `topTransforms` se conservan por compatibilidad de datos, pero no gobiernan la posición visual de los controles internos de la barra.
- El Builder ofrece `✓ Orden automático` para restablecer una configuración superior compatible.
## Barra superior definitiva (2026-09-09)

- El título usa una primera fila completa dentro de la barra negra.
- La segunda fila de Mesa 0 sigue: volver, logo, promoción, carrito y salir.
- La segunda fila de Mesa 1+ agrega campana y número de mesa.
- `topTransforms.cart` forma parte de la configuración persistente del Builder.
- La distribución automática limita todos los controles al interior de la barra y evita superposiciones.
## Controles superiores seguros (2026-09-10)

- Logo y Promoción aplican su porcentaje como zoom interno del recurso, con rango seguro de 25% a 125%.
- X/Y se traduce a un desplazamiento limitado dentro del espacio reservado para cada control; nunca vuelve a posición absoluta.
- Mesa 0 controla Volver, Logo, Promo, Carrito y Salir.
- Mesa 1+ suma Campana y Nº de mesa.
- El orden automático restablece posiciones y zoom compatibles con la barra.

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
