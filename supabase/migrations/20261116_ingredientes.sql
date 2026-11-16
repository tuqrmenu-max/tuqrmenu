-- Ingredientes por producto y opción "permitir personalizar" (etapa 1).
--
-- Solo agrega columnas con valores por defecto: no cambia ninguna función ni política
-- existente, así que el menú actual de los locales sigue funcionando igual.
--
--  productos.ingredientes            lista de ingredientes del producto (se carga desde el
--                                    Excel de la carta o a mano desde Carta, por admin o super admin)
--  productos.permitir_personalizar   el cliente puede destildar ingredientes de este producto
--  categorias.permitir_personalizar  idem para todos los productos de la categoría
--
-- Un producto se puede personalizar si tiene el check propio O su categoría lo tiene.

alter table public.productos
  add column if not exists ingredientes text[] not null default '{}',
  add column if not exists permitir_personalizar boolean not null default false;

alter table public.categorias
  add column if not exists permitir_personalizar boolean not null default false;
