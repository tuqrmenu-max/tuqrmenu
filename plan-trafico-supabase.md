# Plan: reducir el tráfico web → Supabase

Contexto: Supabase avisó por exceso de tráfico. El problema no es solo "todo necesita estar sincronizado" — hay patrones concretos e ineficientes en el código. Se identificaron 5 problemas, ordenados por impacto.

---

## ✅ Resuelto — Problema 1: Menú público (mayor volumen)

**Causa:** en `useBuilderState.js` (el mismo código que se exporta como HTML de producción para cada restaurante), el polling de "pedido enviado" (6s) y "llamar mozo" (3s) corría sin parar mientras el celular del comensal tuviera la página abierta, sin pausarse aunque la pantalla estuviera bloqueada o la app en segundo plano.

**Solución aplicada:** el fetch se salta si la pestaña está oculta (`document.hidden`) o si pasaron 20 minutos sin que el comensal toque la pantalla (mousedown/keydown/touchstart/scroll). En cuanto vuelve a interactuar o la app vuelve a primer plano, se reanuda solo en el siguiente tick, sin recargar.

---

## ✅ Resuelto — Problema 3: Mesas (patrón N+1)

**Causa:** `fetchMesas()` en `MesasAdmin.jsx` corría cada 5s y hacía **una consulta por mesa** para comensales y otra para pedidos (y otra vez comensales en una segunda función). Con 3 mesas eso eran hasta 10 requests por ciclo, creciendo con cada mesa nueva, multiplicado por cada persona del staff con la pantalla abierta a la vez.

**Solución aplicada:** ahora son **2 consultas totales** por ciclo, sin importar cuántas mesas haya — una trae todos los comensales de todas las mesas con `.in('mesa', numeros)`, la otra todos los pedidos pendientes de esos comensales con `.in('comensal_id', ids)`. Se agrupa en el cliente (JS) por número de mesa.

---

## ✅ Resuelto — UI de Permisos por rol: formato acordeón, empezando por Mesas

Se reorganizó `Usuarios → Permisos por rol` para dejar de mostrar una tabla gigante con todas las secciones (Mesas, Carta, Caja, Cocina, Promos, Suscriptos, Ticket, Horario, Usuarios) de una sola vez. Ahora es un **acordeón, sección por sección**, y se empezó únicamente por **Mesas**:

- Se ve un solo ítem clickeable: **"🍽️ Mesas"**.
- Al hacer click, se despliega debajo la tabla ya existente de acciones puntuales (Agregar mesas, Chat, Descargar todos los QR, Borrar mesa) × rol (Mozo/Cocina/Cajero), tal cual como estaba.
- El resto de las secciones (Carta, Caja, Cocina, Promos, Suscriptos, Ticket, Horario, Usuarios) se ocultó de esta pantalla por ahora — no se borró nada, solo no se muestra todavía. Se van a ir migrando a este mismo formato de acordeón **una por una**, en próximas rondas.

---

## ✅ Resuelto — Problema 2: Horario (latido de 15s + polling de 5s eliminados)

**Causa:** dos mecanismos corrían en paralelo sin hacer falta. `horarioPresencia.js` pedía "registrar entrada" cada 15s para cualquier sesión logueada (mozo/cajero/cocina/admin/superadmin), todo el turno, para mantener vivo un umbral de "conexión reciente" de 120s. Y `HorarioUsuarios.jsx` volvía a traer **todo** el historial completo (paginado sin límite de fecha) cada 5 segundos solo para recalcular ese umbral contra el reloj.

**Solución aplicada:** el verde/negro pasó a depender únicamente de dos eventos reales, no de un vencimiento por tiempo:
- **Login** → lo escribe el trigger de servidor `horario_registrar_sesion_auth` (ya existía). El frontend solo lo intenta **una vez** por sesión como respaldo idempotente (no en un intervalo) — `registrarUnaVez()` en `horarioPresencia.js`.
- **Logout** → lo sigue escribiendo `registrar_salida_horario` al presionar Cerrar sesión, sin cambios.
- La pantalla `HorarioUsuarios.jsx` carga el historial **una sola vez** al abrirse y se suscribe a **Realtime** sobre `horario_usuarios`: cada login/logout llega como evento puntual y actualiza solo esa fila, sin volver a pedir todo.
- Se sacó el umbral de 120s sobre `ultima_actividad_at`: ahora "conectado" = existe una fila sin `salida_at`, punto. No hay más "se puso negro solo porque el latido se atrasó un segundo".

**Acción manual pendiente:** correr `supabase/horario_realtime.sql` (agrega `horario_usuarios` a la publicación de Realtime). Sin este paso el login/logout se sigue guardando bien, pero la pantalla no se actualiza sola hasta recargar.

**Impacto:** de 4 requests/minuto por cada sesión logueada (todo el turno) + 1 consulta pesada cada 5s con la pantalla Horario abierta → prácticamente 0 en reposo, solo tráfico real cuando alguien entra o sale.

---

## 🔧 Pendiente (referencia histórica del diagnóstico original de Horario)

### Diagnóstico

- `horarioPresencia.js` se carga en `main.jsx`, así que corre para **cualquier** sesión (mozo/cajero/cocina/admin/superadmin), cada 15 segundos, para siempre, sin importar la pantalla — 4 requests/minuto por persona conectada, todo el turno.
- Ya existe un trigger en el servidor (`horario_registrar_sesion_auth` sobre `auth.sessions`) que registra el ingreso automáticamente al crear la sesión — sin necesidad de que el frontend pida nada. El latido de 15s es en gran parte redundante para esa parte.
- Ya existe el dato de horario asignado por persona: `cliente_usuarios.horarios` (turnos por día/hora, configurados en Usuarios) — pero hoy nada lo cruza con la conexión en vivo.

### Diseño de la solución

**A) Sacar el tráfico de fondo:**
- Eliminar el llamado de "entrada" del latido de 15s (ya lo cubre el trigger del servidor).
- Reemplazar el chequeo de "¿sigue conectado?" por **Supabase Realtime Presence** (usa el socket ya abierto, no HTTP repetido) o, como alternativa más simple, subir el intervalo a 2-3 minutos + pausar si la pestaña está oculta.

**B) Flujo de avisos por fin de turno (evento, no polling):**

1. Al loguearse, se calcula el fin del turno asignado de hoy y se programa **un único `setTimeout`** para ese momento exacto — cero tráfico hasta que llega la hora.
2. Cuando se cumple el horario, si la persona sigue conectada:
   - Se relee (fresco) el horario asignado de esa persona para hoy, por si el admin agregó un turno extra mientras tanto.
   - **Sin horario extra que cubra ese momento** → aviso simple: *"Tu turno terminó. Apretá Cerrar Sesión para registrar tu salida — no alcanza con cerrar la app."* → botón **Ok** único.
   - **Con horario extra que cubre ese momento** → aviso distinto: *"Tu turno terminó, pero tenés un horario extra hoy de [inicio] a [fin]. ¿Te quedás trabajando ese horario?"* → botones **Sí / No**.
     - **Sí** → se confirma, se registra como turno nuevo de ese día/horario, y se programa un **nuevo timer** para el fin de ese horario extra. Al llegar esa hora, se repite este mismo paso 2 (recursivo, por si hay otro horario extra encima).
     - **No** → mismo mensaje de "recordá Cerrar Sesión".
3. **Registro permanente** de cada aviso mostrado, con 4 campos:
   - **Horario** → a qué turno corresponde (original o extra, con fecha/inicio/fin)
   - **Usuario** → quién
   - **Mensaje** → cuál de los dos textos se mostró
   - **Ok** → la respuesta (Ok / Sí / No) + momento exacto de confirmación

   Este registro también se muestra en la pantalla de Horario del dueño, para que quede auditable quién confirmó y cuándo.

**C) Control desde Superadmin:**
Checkbox nuevo en `Socios.jsx` (lista de restaurantes que ve el superadmin) — *"Activar avisos de horario extra"* — por restaurante. Apagado por defecto: mientras no se active para un cliente, nadie de ese restaurante ve este flujo (todo sigue como hoy). Mismo patrón que el toggle existente "ocultar botón eliminar mesa" (columna en `clientes`, prendida/apagada por el superadmin caso por caso).

### Pendiente de decidir antes de implementar
Si el horario extra no empieza justo pegado al fin del turno original (ej. termina 18:00, el extra arranca 18:30), ¿se considera "hay horario extra" con un margen de tolerancia (ej. 30-60 min), o tiene que ser exactamente consecutivo?

### Mientras tanto: mostrar mientras está dentro del turno
Durante el turno asignado, el usuario se muestra en verde ("conectado") sin ningún aviso — el sistema no interviene hasta que termina el horario.

---

## ⏳ Pendiente — Problema 4: Chat duplicado

Hoy el chat hace polling de 4s **y** mantiene un canal de Realtime en paralelo para lo mismo (doble vía). Además, el aviso de color agregado en el botón "Chat" (cuando está cerrado) también agregó su propio polling de 5s.

Opciones:
- Si Realtime funciona confiable en el proyecto: dejar polling como respaldo a 20-30s, y que Realtime haga el trabajo pesado.
- Si no: sacar el canal de Realtime y quedarse solo con polling, subiendo el intervalo a 6-8s.

---

## ⏳ Pendiente — Problema 5: Pausar todo con la pestaña oculta (regla general)

Crear un hook reutilizable `useIntervalVisible(fn, ms)` que solo corre el interval si `document.visibilityState === 'visible'`, y reemplazar los `setInterval` sueltos de `MesasAdmin`, `ChatEquipo`, `CajaReportes`, `CocinaPanel` por ese hook. Sin tocar frecuencias, esto puede bajar mucho el tráfico si el staff deja pestañas abiertas todo el día sin mirarlas. (`HorarioUsuarios` ya no tiene interval — ver Problema 2, resuelto arriba.)

---

## ✅ Resuelto — Login de staff con contraseña perdida ("Invalid login credentials")

**Caso:** no se podía entrar como `cajero2@caja.qrmenu.com`, Supabase devolvía "Invalid login credentials".

**Diagnóstico:** se revisó en Supabase → Authentication → Users → ese usuario. La cuenta estaba **confirmada** (`Confirmed at` con fecha) y hasta tenía un `Last signed in` reciente, así que no era un tema de confirmación de email — era simplemente que la contraseña tipeada no coincidía con la guardada.

**Por qué no sirve "Send password recovery" / "Send magic link":** esos botones mandan un email real, pero las cuentas de staff (mozo/cajero/cocina) usan emails inventados (`usuario@caja.qrmenu.com`, `@mozo.qrmenu.com`, `@cocina.qrmenu.com` — ver `DOMINIO_POR_ROL` en `UsuariosStaff.jsx`) que no tienen casilla real. El mail nunca llega.

**Solución que funcionó — setear la contraseña directo por SQL:**

```sql
update auth.users
set encrypted_password = crypt('NuevaContrasena123', gen_salt('bf'))
where email = 'cajero2@caja.qrmenu.com';
```

Cambiar `NuevaContrasena123` por la contraseña deseada (mínimo 6 caracteres) y el email por el del usuario afectado. Se corre en el SQL Editor de Supabase. Sirve para cualquier cuenta de mozo/cajero/cocina que quede con la contraseña perdida u olvidada.


---

## ✅ Resuelto — Nuevo ítem "Diseño" (separado de Carta)

Se sacó el bloque "🎨 Diseño del menú" (Builder: portada, controles de íconos, URL de Mesa 0, y el check de superadmin "Ocultar Builder") de adentro de Carta y se lo llevó a su propio ítem de menú, **"Diseño"**, ubicado justo debajo de Carta — en Admin y Superadmin.

- Nuevo componente: `DisenoMenu.jsx` (copia self-contained del bloque, con su propia carga de datos).
- `CartaAdmin.jsx` mantiene su propio botón "💾 Guardar proyecto" (sigue funcionando igual, con su propia copia de la lógica de exportar).
- Nuevo tab `diseno` en `DashSocios/index.jsx` y nuevo link en `Sidebar.jsx` (ownerLinks), con traducción agregada en `i18n.js`.
- Se agregó `diseno` a la lista `SECCIONES` de Usuarios → Permisos por rol, por si más adelante se quiere habilitar ese acordeón para algún rol de staff (por ahora sigue oculto para mozo/cajero/cocina, igual que antes).

---

## ✅ Resuelto — Propina para el mozo en "Mi pedido" (mesas 1+)

En el menú público, dentro de "Mi pedido", para mesas 1 en adelante (no aplica a Mesa 0 / delivery), se agregó una sección "🧑‍🍳 Propina para el mozo":

- Dos modos: **Monto $** (importe fijo) o **% del total** (porcentaje sobre el subtotal antes de delivery).
- Se calcula en vivo y se suma al total que ve el comensal.
- Se guarda en `mesas_operacion.propina_monto` (columna nueva, migración `mesas_propina.sql`), guardado por mesa (no por comensal individual) porque una misma mesa puede recibir varios "envíos" de pedido y la propina es sobre la cuenta completa.

**Importante — falta un paso para que esto sea 100% funcional:** por ahora la propina se ve y se guarda, pero **Caja/Mesas todavía no la suma al momento de cobrar** ni la muestra en el detalle de cobro. Eso es un cambio aparte (tocar el cálculo de cobro en `MesasAdmin.jsx` y los reportes de `CajaReportes.jsx`) que se puede hacer como siguiente paso si se quiere que la propina se cobre automáticamente junto con la cuenta.

Como este bloque vive en `useBuilderState.js` (el mismo código que se exporta como HTML), hay que volver a exportar el menú (botón "🚀 Exportar menú" en Diseño) para que los restaurantes que ya tienen su menú publicado lo vean actualizado.

---

## ✅ Resuelto — Sidebar responsive para celular (sin tocar desktop)

**Problema:** el menú lateral (`Sidebar.jsx`) era un `<aside>` fijo de 256px de ancho, siempre visible, sin ningún comportamiento responsive. En una pantalla de celular angosta, esos 256px fijos ocupaban la gran mayoría del ancho (hasta ~90%), dejando casi sin espacio al contenido real (Mesas, Carta, Diseño, Caja, etc.).

**Solución — solo afecta a pantallas angostas (`md:` breakpoint de Tailwind, celular vs desktop):**
- En **desktop** (`md:` y superior) el sidebar queda **exactamente igual que antes**: fijo, siempre visible, 256px. No se tocó nada de su comportamiento en PC.
- En **celular**: el sidebar arranca cerrado (afuera de la pantalla, deslizado con `-translate-x-full`), aparece un botón ☰ fijo arriba a la izquierda para abrirlo, un fondo oscuro semitransparente atrás cuando está abierto (para cerrar tocando afuera), un botón ✕ para cerrarlo, y se cierra solo al tocar cualquier opción del menú.
- `AdminLayout.jsx` y `ClienteLayout.jsx`: el margen fijo `ml-64` que empujaba el contenido pasó a `md:ml-64` (solo en desktop), para que en celular el contenido use todo el ancho disponible.
- `Header.jsx`: un poco de padding a la izquierda en celular (`pl-16`) para que el título no quede tapado por el botón ☰.

Se probó únicamente compilando (esbuild), no se pudo levantar el proyecto real en este entorno — conviene probarlo en un celular real o el modo responsive de Chrome DevTools antes de dar por cerrado, sobre todo que el desktop haya quedado idéntico a como estaba.


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
