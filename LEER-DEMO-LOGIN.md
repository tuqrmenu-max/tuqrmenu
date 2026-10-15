# Login demo: usuario `demo` / contraseña `demo`

Solo cambia la cuenta del cajero demo (`cajerobardemo@caja.qrmenu.com`).
No se modificó ningún archivo de la app.

## Pasos
1. Supabase -> SQL Editor -> pegar y ejecutar `supabase/demo_login.sql`.
2. Al final deben aparecer dos resultados: el email interno
   (`cajerobardemo@caja.qrmenu.com`) y la fila del usuario `demo`.
3. En `/login` escribir usuario `demo` y contraseña `demo`.

## Notas
- Si `demo` ya lo usa otra cuenta, el script se detiene con un mensaje y no cambia nada.
- La contraseña se guarda directo en `auth.users` porque Auth exige 6+ caracteres
  al cambiarla por API; el login con 4 caracteres funciona igual.
- El dominio `@caja.qrmenu.com` no hace falta cambiarlo (hay un bloque opcional,
  comentado, al final del SQL).
- Para volver atrás: `UPDATE cliente_usuarios SET usuario='cajerobardemo' WHERE usuario='demo';`
  y volver a poner la contraseña anterior.
