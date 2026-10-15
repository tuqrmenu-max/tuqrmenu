> Actualización 15/09/2026: esta entrega incluye optimización v2. Seguí primero `LEER-OPTIMIZACION-V2.md` y su SQL nuevo. Los pasos de imágenes de este documento siguen vigentes.

# QRMenu — instalación de mejoras de tráfico

1. Conservá el ZIP anterior como respaldo. Este ZIP contiene el proyecto completo, no solo un parche.
2. En Supabase SQL Editor ejecutá `supabase/optimizar_imagenes_storage.sql`. Prepara el bucket público `productos` y permisos de inserción/lectura para el dueño y superadmin. No toca productos, pedidos, tickets ni usuarios. El SQL es transaccional. Si falla, no sigas con conversión de imágenes hasta resolver el error.
3. Reemplazá el código y desplegalo con tus variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY habituales. No uses claves service_role en el frontend.
4. Cuando Supabase vuelva a aceptar solicitudes (renovación o mejora del plan), entrá como dueño/superadmin. Cerrá otras pestañas de Carta/Diseño antes de convertir imágenes.
5. En Carta pulsá **Reducir peso de imágenes** y esperá. Usa la misma cuota de red de tu organización: conviene hacerlo una vez restablecido el servicio. Cada archivo se sube y comprueba antes de reemplazar su referencia. Si algo falla, se detiene, muestra el error y podés repetir; lo ya convertido queda válido. No borra imágenes originales ni pedidos. No editar simultáneamente el restaurante durante este proceso.
6. Cerrá y reabrí Diseño y pulsá **Guardar proyecto**. Esto publica un HTML nuevo con las imágenes como URL. Los QR existentes conservan su dirección /menu/... y usan el menú nuevo.
7. Probá una mesa, Mesa 0 (retiro/delivery), chat entre dos usuarios, cobro y tickets, turno partido/nocturno y cierre de sesión. Compará Usage en días de uso similar.

## Requisitos y límites
- No se aplicó ningún cambio a Supabase ni a Vercel desde esta sesión.
- La optimización no devuelve tráfico ya usado ni levanta el bloqueo de cuota.
- La conversión funciona con permisos existentes de actualización de clientes/productos/categorías y el bucket productos público. Si faltan, el error queda visible; no se amplían permisos de esas tablas.
- Las imágenes de menú del bucket productos son públicas por diseño. No debe contener documentación privada.
- Se conservan archivos HTML anteriores; no se ejecuta limpieza automática para no romper enlaces anteriores. Cada Guardar proyecto produce una versión nueva.
- Caja carga hoy por defecto; se puede ampliar o limpiar el rango para ver históricos. Los rangos muy grandes siguen descargando su detalle completo en páginas para conservar totales exactos.
- Respaldo de Chat: hasta 15 s; aviso de chat cerrado: hasta 30 s cuando Realtime no está disponible. Mesas/Cocina mantienen 5/4 s más tiempo de respuesta, visibles.
- El ahorro depende del peso de las imágenes y del uso real. No se garantiza que todo el negocio quepa en 5 GB.

## Validación realizada
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run build` aprobado (avisos de tamaño de bundle y mezcla de importación estática/dinámica preexistentes).
- `node --test tests/traffic.test.mjs`: 6 pruebas aprobadas: guardado serial y reintentos; paginación ante límite de servidor; fechas/turnos; pausa y no superposición; imágenes/deduplicación/error; autenticación y cambio de usuario.
- Falta la validación de SQL, permisos Storage y flujos con Supabase real.
