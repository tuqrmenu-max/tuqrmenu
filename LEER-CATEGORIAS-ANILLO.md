# Categorías: Fijo o Anillo

## Dónde se elige
Diseño → editor de categorías → bloque **🎡 Forma de las categorías**: dos checks, **Fijo** (como estaba, con las posiciones que se arman en el Builder) y **Anillo** (se marca uno u otro). Por defecto queda en Fijo, así que ningún cliente cambia hasta que lo active.

## Qué ve el cliente con Anillo (mesa 0, 00 y mesas 1 en adelante)
- Las categorías en un anillo 3D: se desliza con el dedo o el mouse y al soltar se acomoda en la más cercana.
- La del centro muestra su nombre y la cantidad de productos. Tocarla entra a sus productos (igual que antes). Tocar una de los costados la lleva al centro.
- Al volver de los productos, el anillo queda donde estaba.

## Imágenes y categorías
- Usa las mismas imágenes de categoría que ya carga el Builder (por nombre de archivo o por la carga manual). Con fondo transparente (webp/png) se ve mejor; las que no tienen fondo transparente se muestran como tarjeta.
- Una categoría sin imagen muestra 🍽️.
- Se adapta a cualquier cantidad: 1 a 4 categorías van en un arco corto sin dar la vuelta; 5 o más forman el anillo completo (con más de 12 los puntitos se reemplazan por "3 / 15").
- Las posiciones de cada categoría solo se usan en modo Fijo.

## Para que se vea
Después de elegir Anillo hay que guardar/publicar el diseño para regenerar el menú del cliente (los menús ya publicados no cambian solos). La vista previa del Builder muestra el anillo de forma estática.

## Archivos
`src/components/Builder/useBuilderState.js` (ajuste + anillo del menú), `CategoriesEditor.jsx` (checks), `PhonePreview.jsx` (vista previa), `tests/categorias-anillo.test.mjs`.
