-- =====================================================
-- carta_feature_toggles.sql
-- Permite que el superadmin oculte, por restaurante, el acceso al
-- Builder (botones Guardar proyecto / Exportar menú) y/o el botón
-- de generar imágenes con IA, dentro de la pantalla Carta.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ocultar_builder boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ocultar_ia_imagenes boolean DEFAULT false;

-- Oculta, para este restaurante, el botón "Importar Excel" y "Descargar
-- imágenes", y además bloquea poder subir/cambiar/borrar las imágenes de
-- categorías y productos (deja solo al superadmin hacerlo).
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ocultar_excel_imagenes boolean DEFAULT false;
