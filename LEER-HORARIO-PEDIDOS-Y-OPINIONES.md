# Horario de pedidos + Opiniones (fuera de horario)

## Qué se agregó

1. **Horario para recibir pedidos** (admin y superadmin, panel Carta):
   Nueva sección "🕐 Horario para recibir pedidos" debajo de "📞 Datos de
   contacto y delivery". Es distinta del campo "Horario" de texto libre que
   ya existía ahí (ese sigue siendo solo informativo, se muestra en el menú).
   Esta nueva es estructurada: un checkbox para activar la restricción, y
   por cada día de la semana un checkbox "abierto/cerrado" + horario
   desde/hasta.

2. **Chequeo automático al tocar "Enviar Pedido"** en el menú público (QR):
   si el horario está activado y el momento actual no está dentro de
   ninguna franja configurada para ese día, no se envía el pedido. En su
   lugar aparece un cartel "⏰ Fuera de horario" con el horario configurado
   y un campo para dejar una opinión/consulta + WhatsApp. Al enviarlo:
   - se abre WhatsApp con el mensaje, al número configurado del restaurante
   - se guarda en la nueva tabla `opiniones`

3. **Opiniones** (admin y superadmin, dentro de la pestaña "Suscriptos"):
   ahora "Suscriptos" tiene dos sub-pestañas: "👥 Suscriptos" (lo que ya
   existía) y "💬 Opiniones" (nuevo). Ahí se listan los mensajes recibidos
   (WhatsApp, mesa si corresponde, mensaje, fecha, estado pendiente/
   respondida). El botón "Responder" abre un diálogo para escribir la
   respuesta; al enviarla se guarda y se abre WhatsApp hacia ese número.

## Pasos para dejarlo funcionando

1. **Correr el SQL** `supabase/horario_pedidos_y_opiniones.sql` en el SQL
   Editor de Supabase (requiere haber corrido antes
   `supabase/seguridad_rls_fix.sql`, que es el que define las funciones
   `mis_clientes_ids()` y `es_superadmin()` que usan las políticas nuevas).

2. **Configurar el horario** desde el panel: Admin (o Superadmin eligiendo
   el restaurante) → pestaña "Carta" → sección "🕐 Horario para recibir
   pedidos" → activar y cargar los horarios → Guardar.

3. **Volver a exportar el menú**: por cómo está armado el proyecto, el
   menú público (QR) es un HTML que se genera una vez y se guarda; el
   horario en sí se actualiza al instante sin reexportar, pero el código
   nuevo que hace el chequeo y muestra el cartel solo lo van a tener los
   menús que se exporten/guarden de nuevo después de este cambio. Por eso,
   para cada restaurante que ya tenía su menú publicado, hay que entrar a
   Diseño (Builder) y volver a tocar "💾 Guardar proyecto" una vez, para que
   quede embebida la nueva lógica del botón "Enviar Pedido".

## Notas técnicas

- Formato guardado en `clientes.horario_pedidos`: objeto con claves "0" a
  "6" (0 = domingo), cada una un array de franjas `{"desde":"11:00","hasta":"23:00"}`.
  Array vacío = día cerrado. Se admite más de una franja por día (por
  ejemplo, mediodía y noche) aunque el editor visual de Carta solo carga
  una franja por día; si se necesita partir un día en dos turnos, se puede
  cargar el array completo directamente en Supabase.
- Si una franja tiene "hasta" menor o igual a "desde", se interpreta que
  cruza la medianoche (ej. 20:00 a 02:00).
- El chequeo de horario usa la hora del dispositivo de quien está pidiendo
  (no del servidor), igual que cualquier reloj de un celular o computadora.
- La tabla `opiniones` tiene RLS: cualquiera puede insertar (necesario para
  que un cliente sin sesión pueda dejar su opinión desde el menú público),
  pero solo el dueño del restaurante, su staff, o superadmin pueden leer,
  responder o borrar esas opiniones.
