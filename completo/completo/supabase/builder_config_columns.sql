-- =====================================================
-- builder_config_columns.sql
-- El Builder (Carta > Diseño del menú) guarda el diseño completo
-- (colores, textos, posiciones de íconos, productos, imágenes de
-- categorías/productos, etc.) en dos columnas jsonb de "clientes":
-- builder_config y builder_products.
--
-- Si estas columnas no existen, el guardado (automático y el botón
-- "Guardar proyecto") falla en el paso de escribir a Supabase, y solo
-- queda una copia en el localStorage del navegador que se pierde al
-- cambiar de dispositivo o limpiar el caché — por eso los cambios
-- "se borraban" al volver a entrar. Este script las crea si faltan
-- (es seguro correrlo aunque ya existan, no borra nada).
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS builder_config jsonb;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS builder_products jsonb;
