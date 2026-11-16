-- Personalizar ingredientes en el pedido (etapa 2).
-- Requiere antes 20261116_ingredientes.sql (columnas productos.ingredientes y permitir_personalizar).
--
-- Todo es compatible hacia atrás: los menús ya publicados y la app siguen funcionando igual,
-- porque solo se agregan columnas con valor por defecto y campos nuevos en lo que devuelven
-- las funciones. Se puede aplicar ANTES de mergear el código.
--
--  pedidos_qr.sin_ingredientes  ingredientes que el cliente pidió quitar ("sin lechuga")
--  pedidos_qr.comentario        comentario libre del cliente para ese producto
--
-- El cliente (menú público) no tiene acceso directo a las tablas: todo pasa por estas funciones.
-- qr_agregar_items valida en el servidor: solo guarda "sin" y comentario si el producto (o su
-- categoría) tiene el check de personalizar, y solo acepta ingredientes que el producto realmente tiene.

alter table public.pedidos_qr
  add column if not exists sin_ingredientes text[] not null default '{}',
  add column if not exists comentario text;

-- 1) Catálogo público: agrega ingredientes y si el producto se puede personalizar
create or replace function public.qr_catalogo_v2(p_cliente_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
select jsonb_build_object('version', c.qr_catalog_version::text,
 'categories', coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'nombre',k.nombre,'imagen',k.imagen,'orden',k.orden) order by k.orden,k.id) from public.categorias k where k.cliente_id=c.id and coalesce(k.activa,true) and coalesce(k.activo,true)),'[]'::jsonb),
 'products', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'categoria_id',p.categoria_id,'nombre',p.nombre,'precio',p.precio,'imagen',p.imagen,'detalle',coalesce(nullif(to_jsonb(p)->>'detalle',''),to_jsonb(p)->>'descripcion',''),
   'ingredientes', to_jsonb(coalesce(p.ingredientes,'{}'::text[])),
   'personalizable', (coalesce(p.permitir_personalizar,false) or coalesce((select k2.permitir_personalizar from public.categorias k2 where k2.id=p.categoria_id),false))
 ) order by p.categoria_id,p.nombre,p.id) from public.productos p where p.cliente_id=c.id and coalesce(p.activo,true)),'[]'::jsonb))
from public.clientes c where c.id=p_cliente_id;
$function$;

-- 2) Agregar ítems al pedido: guarda "sin" y comentario (validados)
create or replace function public.qr_agregar_items(p_comensal_id uuid, p_sesion text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
DECLARE v_cliente uuid; v_item jsonb; v_prod uuid; v_cant integer; v_n integer := 0;
  v_pers boolean; v_ing text[]; v_sin text[]; v_com text;
BEGIN
  SELECT cliente_id INTO v_cliente FROM public.comensales WHERE id = p_comensal_id AND sesion_id = p_sesion;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'comensal_invalido' USING ERRCODE='22023'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 60 THEN RAISE EXCEPTION 'items_invalidos' USING ERRCODE='22023'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := (v_item->>'cantidad')::integer;
    IF v_cant IS NULL OR v_cant < 1 OR v_cant > 99 THEN RAISE EXCEPTION 'cantidad_invalida' USING ERRCODE='22023'; END IF;
    v_prod := NULL;
    IF v_item->>'producto_id' IS NOT NULL THEN
      SELECT id INTO v_prod FROM public.productos WHERE id = (v_item->>'producto_id')::uuid AND cliente_id = v_cliente AND activo = true;
    END IF;
    IF v_prod IS NULL AND v_item->>'producto' IS NOT NULL THEN
      SELECT id INTO v_prod FROM public.productos WHERE cliente_id = v_cliente AND activo = true AND lower(nombre) = lower(v_item->>'producto') ORDER BY created_at LIMIT 1;
    END IF;
    IF v_prod IS NULL THEN RAISE EXCEPTION 'producto_invalido' USING ERRCODE='22023'; END IF;

    -- Personalización: solo si el producto (o su categoría) lo permite.
    v_sin := '{}'::text[]; v_com := NULL;
    SELECT (coalesce(p.permitir_personalizar,false) OR coalesce(k.permitir_personalizar,false)), coalesce(p.ingredientes,'{}'::text[])
      INTO v_pers, v_ing
      FROM public.productos p LEFT JOIN public.categorias k ON k.id = p.categoria_id
     WHERE p.id = v_prod;
    IF coalesce(v_pers,false) THEN
      IF jsonb_typeof(v_item->'sin') = 'array' AND jsonb_array_length(v_item->'sin') <= 60 THEN
        SELECT coalesce(array_agg(g.ing ORDER BY g.ord), '{}'::text[]) INTO v_sin
          FROM unnest(v_ing) WITH ORDINALITY AS g(ing, ord)
         WHERE lower(btrim(g.ing)) IN (SELECT lower(btrim(t.e)) FROM jsonb_array_elements_text(v_item->'sin') AS t(e));
      END IF;
      v_com := nullif(left(btrim(regexp_replace(coalesce(v_item->>'comentario',''), '[[:cntrl:]]+', ' ', 'g')), 200), '');
    END IF;

    INSERT INTO public.pedidos_qr (comensal_id, producto_id, cantidad, pagado, es_promo, fecha_hora, sin_ingredientes, comentario)
    VALUES (p_comensal_id, v_prod, v_cant, 0, CASE WHEN coalesce((v_item->>'es_promo')::integer,0) = 1 THEN 1 ELSE 0 END, now(), v_sin, v_com);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $function$;

-- 3) Ítems ya pedidos por el comensal: agrega "sin" y comentario
create or replace function public.qr_items_comensal(p_comensal_id uuid, p_sesion text)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
 SELECT coalesce(jsonb_agg(jsonb_build_object('producto_id', q.producto_id, 'cantidad', q.cantidad,
   'sin', to_jsonb(q.sin_ingredientes), 'comentario', q.comentario,
   'productos', jsonb_build_object('nombre', p.nombre, 'precio', p.precio))), '[]'::jsonb)
 FROM public.pedidos_qr q JOIN public.comensales c ON c.id = q.comensal_id JOIN public.productos p ON p.id = q.producto_id
 WHERE c.id = p_comensal_id AND c.sesion_id = p_sesion AND q.pagado = 0
$function$;

-- 4) Que los menús que ya tienen el catálogo en caché lo vuelvan a pedir (traerá los ingredientes).
update public.clientes set qr_catalog_version = qr_catalog_version + 1;
