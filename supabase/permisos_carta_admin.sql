-- =====================================================
-- permisos_carta_admin.sql
-- Superadmin > Usuarios > Permisos por rol > Carta:
-- qué botones de la solapa Carta ve el admin del restaurante.
-- Formato: { "importar_excel": true, "descargar_imagenes": true,
--   "imagenes_categorias": true, "imagenes_productos": true,
--   "eliminar_categorias": true, "eliminar_productos": true }
-- Sin valor guardado, se mantiene el comportamiento anterior.
-- =====================================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS permisos_carta_admin jsonb DEFAULT '{}'::jsonb;
