-- =====================================================
-- Limpieza de categorías duplicadas
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Ver duplicados actuales
SELECT cliente_id, nombre, COUNT(*) as repeticiones
FROM categorias
GROUP BY cliente_id, nombre
HAVING COUNT(*) > 1;

-- 2. Ver productos huérfanos (categoria_id apunta a categoría duplicada)
SELECT p.id, p.nombre, p.categoria_id, c.nombre as categoria_nombre
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE c.id IS NULL;

-- 3. Para cada grupo de duplicados, actualizar productos para apuntar a la categoría que se conserva
-- y eliminar las categorías duplicadas
DO $$
DECLARE
  rec RECORD;
  keep_id uuid;
  dup_id uuid;
BEGIN
  FOR rec IN
    SELECT cliente_id, nombre, array_agg(id ORDER BY id) as ids
    FROM categorias
    GROUP BY cliente_id, nombre
    HAVING COUNT(*) > 1
  LOOP
    -- Conservar la primera (id más bajo)
    keep_id := rec.ids[1];

    -- Actualizar productos de las categorías duplicadas para apuntar a la que se conserva
    FOR dup_id IN SELECT unnest(rec.ids[2:]) LOOP
      UPDATE productos
      SET categoria_id = keep_id
      WHERE categoria_id = dup_id;

      -- Eliminar la categoría duplicada
      DELETE FROM categorias WHERE id = dup_id;

      RAISE NOTICE 'Eliminada categoría duplicada %, productos migrados a %', dup_id, keep_id;
    END LOOP;
  END LOOP;
END $$;

-- 4. Verificar resultado
SELECT cliente_id, nombre, COUNT(*) as repeticiones
FROM categorias
GROUP BY cliente_id, nombre
HAVING COUNT(*) > 1;

-- 5. Contar productos por categoría
SELECT c.nombre, COUNT(p.id) as productos
FROM categorias c
LEFT JOIN productos p ON p.categoria_id = c.id
GROUP BY c.nombre
ORDER BY c.nombre;
