# Horario simplificado
1. Ejecutar nuevamente supabase/horario_usuarios.sql en Supabase SQL Editor.
2. Desplegar y volver a iniciar sesión.
3. Horario muestra Nombre, Usuario, Estado actual, Ingreso y Salida. Sin turnos, filtros, comparaciones ni totales.
El ingreso utiliza la fecha de creación de la sesión autenticada en Supabase. El registro se solicita al completar login y se recupera al reconectar, sin duplicarlo.
Cerrar sesión registra salida. Cerrar la pestaña o perder Internet no inventa salida: el verde caduca en aproximadamente 2 minutos. La pantalla refresca cada 5 segundos.
El historial anterior se conserva. Los turnos de Usuarios no se modifican.
Pruebas aisladas y ZIP verificados; compilación completa y ejecución SQL con tu Supabase pendientes.

## Personal del socio
Ejecutar completo supabase/horario_usuarios.sql desde SQL Editor como administrador del proyecto. Agrega un trigger sobre auth.sessions para registrar login de cajeros, cocina y mozos desde Supabase. Luego desplegar y volver a iniciar sesión con cada empleado. La consulta usa el socio asociado por user_id; nunca mezcla personal de otros socios. Superadmin conserva su acceso de administración.


## Actualización v2 (15/09/2026)

Ejecutar `supabase/optimizar_trafico_v2.sql` después de los SQL de Horario ya instalados. Horario abre en hoy; Desde/Hasta se envían al servidor. Se muestran 50 registros por página con totales de todo el rango. Limpiar filtro consulta el histórico. El estado verde procede de sesiones sin salida de cualquier fecha, independiente de la página. Realtime se conserva y hay comprobación de versión cada 30 s visible. No se agregan latidos de presencia ni se inventan salidas. Los permisos RLS existentes siguen aplicándose a las RPC de lectura.
