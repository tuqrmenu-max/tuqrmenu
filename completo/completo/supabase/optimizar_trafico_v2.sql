-- QRMenu: versiones transaccionales y lecturas pequeñas. Ejecutar completo UNA VEZ.
-- Reejecutable. No elimina datos ni cambia políticas RLS existentes.
begin;
alter table public.clientes add column if not exists qr_catalog_version bigint not null default 0;
alter table public.clientes add column if not exists qr_operations_version bigint not null default 0;
alter table public.clientes add column if not exists qr_horario_version bigint not null default 0;
alter table public.clientes add column if not exists qr_chat_version bigint not null default 0;
alter table public.chat_mensajes add column if not exists qr_sequence bigint not null default 0;
alter table public.comensales add column if not exists qr_order_version bigint not null default 0;

-- Solo se invocan como triggers. SECURITY DEFINER permite invalidar la caché
-- tras escrituras autorizadas por las RLS existentes, también pedidos anónimos.
create or replace function public.qr_touch_cliente_v2() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare old_id uuid; new_id uuid; target uuid;
begin
  if TG_OP = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then return NEW; end if;
  if TG_OP <> 'INSERT' then old_id := OLD.cliente_id; end if;
  if TG_OP <> 'DELETE' then new_id := NEW.cliente_id; end if;
  for target in select distinct x from unnest(array[old_id,new_id]) x where x is not null order by x loop
    if TG_ARGV[0] = 'catalog' then
      update public.clientes set qr_catalog_version = qr_catalog_version + 1,
        qr_operations_version = qr_operations_version + 1 where id = target;
    elsif TG_ARGV[0] = 'horario' then
      update public.clientes set qr_horario_version = qr_horario_version + 1 where id = target;
    else
      update public.clientes set qr_operations_version = qr_operations_version + 1 where id = target;
    end if;
  end loop;
  return null;
end $$;
create or replace function public.qr_touch_order_v2() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if TG_OP = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then return NEW; end if;
  if TG_OP <> 'INSERT' then
    update public.comensales set qr_order_version = qr_order_version + 1 where id = OLD.comensal_id;
  end if;
  if TG_OP <> 'DELETE' and (TG_OP = 'INSERT' or NEW.comensal_id is distinct from OLD.comensal_id) then
    update public.comensales set qr_order_version = qr_order_version + 1 where id = NEW.comensal_id;
  end if;
  return null;
end $$;
revoke all on function public.qr_touch_cliente_v2() from public, anon, authenticated;
revoke all on function public.qr_touch_order_v2() from public, anon, authenticated;

drop trigger if exists qr_catalog_v2 on public.productos;
create trigger qr_catalog_v2 after insert or update or delete on public.productos for each row execute function public.qr_touch_cliente_v2('catalog');
drop trigger if exists qr_catalog_v2 on public.categorias;
create trigger qr_catalog_v2 after insert or update or delete on public.categorias for each row execute function public.qr_touch_cliente_v2('catalog');
drop trigger if exists qr_operations_v2 on public.mesas_operacion;
create trigger qr_operations_v2 after insert or update or delete on public.mesas_operacion for each row execute function public.qr_touch_cliente_v2('operations');
drop trigger if exists qr_operations_v2 on public.comensales;
create trigger qr_operations_v2 after insert or update or delete on public.comensales for each row execute function public.qr_touch_cliente_v2('operations');
drop trigger if exists qr_order_v2 on public.pedidos_qr;
create trigger qr_order_v2 after insert or update or delete on public.pedidos_qr for each row execute function public.qr_touch_order_v2();
drop trigger if exists qr_horario_v2 on public.horario_usuarios;
create trigger qr_horario_v2 after insert or update or delete on public.horario_usuarios for each row execute function public.qr_touch_cliente_v2('horario');
drop trigger if exists qr_staff_v2 on public.cliente_usuarios;
create trigger qr_staff_v2 after insert or update or delete on public.cliente_usuarios for each row execute function public.qr_touch_cliente_v2('horario');

-- Orden de confirmación del chat: la fila del restaurante serializa los INSERT.
-- Evita perder un mensaje cuya fecha sea anterior pero su transacción termine después.
create or replace function public.qr_chat_sequence_v2() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.clientes set qr_chat_version=qr_chat_version+1 where id=NEW.cliente_id
    returning qr_chat_version into NEW.qr_sequence;
  if not found then raise exception 'Restaurante no encontrado'; end if;
  return NEW;
end $$;
revoke all on function public.qr_chat_sequence_v2() from public,anon,authenticated;
drop trigger if exists qr_chat_sequence_v2 on public.chat_mensajes;
create trigger qr_chat_sequence_v2 before insert on public.chat_mensajes for each row execute function public.qr_chat_sequence_v2();

-- Las RPC de lectura son SECURITY INVOKER: aplican las RLS y permisos del llamante.
-- to_jsonb mantiene compatibilidad con detalle/descripcion sin exigir ambas columnas.
create or replace function public.qr_catalogo_v2(p_cliente_id uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
select jsonb_build_object('version', c.qr_catalog_version::text,
 'categories', coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'nombre',k.nombre,'imagen',k.imagen,'orden',k.orden) order by k.orden,k.id) from public.categorias k where k.cliente_id=c.id),'[]'::jsonb),
 'products', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'categoria_id',p.categoria_id,'nombre',p.nombre,'precio',p.precio,'imagen',p.imagen,'detalle',coalesce(nullif(to_jsonb(p)->>'detalle',''),to_jsonb(p)->>'descripcion','')) order by p.categoria_id,p.nombre,p.id) from public.productos p where p.cliente_id=c.id),'[]'::jsonb))
from public.clientes c where c.id=p_cliente_id;
$$;
create or replace function public.qr_pedido_estado_v2(p_cliente_id uuid,p_mesa integer,p_sesion text) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
select jsonb_build_object('id',c.id,'estado_pedido',c.estado_pedido,'derivado_area',c.derivado_area,
 'metodo_entrega',c.metodo_entrega,'ocultar_checklist',c.ocultar_checklist,
 'items_version',c.qr_order_version::text || ':' || r.qr_catalog_version::text)
from public.comensales c join public.clientes r on r.id=c.cliente_id
where c.cliente_id=p_cliente_id and c.mesa=p_mesa and c.sesion_id::text=p_sesion order by c.id desc limit 1;
$$;

create or replace function public.qr_caja_resumen_v2(
 p_cliente_id uuid,p_desde timestamptz default null,p_hasta timestamptz default null,
 p_mesa integer default null,p_cerrados boolean default true,p_turnos jsonb default null
) returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
with lineas as (
 select q.comensal_id,c.mesa,q.cantidad,coalesce(p.precio,0) as precio,
 coalesce(to_jsonb(q)->>'es_promo','0') in ('1','true') as promo,
 coalesce(k.nombre,'Sin categoría') as categoria
 from public.pedidos_qr q join public.comensales c on c.id=q.comensal_id
 join public.productos p on p.id=q.producto_id left join public.categorias k on k.id=p.categoria_id
 where c.cliente_id=p_cliente_id and (p_mesa is null or c.mesa=p_mesa)
 and (p_cerrados or q.pagado=0)
 and (p_desde is null or q.fecha_hora>=p_desde) and (p_hasta is null or q.fecha_hora<p_hasta)
 and (p_turnos is null or exists(select 1 from jsonb_array_elements(p_turnos) r where q.fecha_hora>=(r->>0)::timestamptz and q.fecha_hora<(r->>1)::timestamptz))
), cats as (
 select categoria,sum(cantidad) cantidad,sum(case when promo then 0 else precio*cantidad end) total from lineas group by categoria
), tickets as (
 select t.total from public.tickets_caja t where t.cliente_id=p_cliente_id
 and (p_mesa is null or t.mesa=p_mesa)
 and (p_desde is null or t.cobrado_at>=p_desde) and (p_hasta is null or t.cobrado_at<p_hasta)
 and (p_turnos is null or exists(select 1 from jsonb_array_elements(p_turnos) r where t.cobrado_at>=(r->>0)::timestamptz and t.cobrado_at<(r->>1)::timestamptz))
)
select jsonb_build_object('totales',(select jsonb_build_object(
 'comensales',count(distinct comensal_id),'mesas_atendidas',count(distinct mesa),'items_vendidos',coalesce(sum(cantidad),0),
 'total_facturado',coalesce(sum(case when promo then 0 else precio*cantidad end),0),
 'items_promo',coalesce(sum(case when promo then cantidad else 0 end),0),
 'descuento_promo',coalesce(sum(case when promo then precio*cantidad else 0 end),0)) from lineas),
 'categorias',coalesce((select jsonb_object_agg(categoria,jsonb_build_object('cantidad',cantidad,'total',total)) from cats),'{}'::jsonb),
 'tickets_count',(select count(*) from tickets),'tickets_total',coalesce((select sum(total) from tickets),0));
$$;

create or replace function public.qr_horario_resumen_v2(p_cliente_id uuid,p_desde timestamptz default null,p_hasta timestamptz default null)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
select coalesce(jsonb_agg(x),'[]'::jsonb) from (
 select user_id, max(nombre) nombre,max(usuario) usuario,bool_or(salida_at is null) conectado,count(*) registros_total,
 count(*) filter(where (p_desde is null or entrada_at>=p_desde) and (p_hasta is null or entrada_at<p_hasta)) as registros,
 coalesce(sum(greatest(0,extract(epoch from (salida_at-entrada_at))*1000)) filter(where salida_at is not null and (p_desde is null or entrada_at>=p_desde) and (p_hasta is null or entrada_at<p_hasta)),0) as total_ms
 from public.horario_usuarios where cliente_id=p_cliente_id group by user_id
) x;
$$;
revoke all on function public.qr_catalogo_v2(uuid), public.qr_pedido_estado_v2(uuid,integer,text), public.qr_caja_resumen_v2(uuid,timestamptz,timestamptz,integer,boolean,jsonb), public.qr_horario_resumen_v2(uuid,timestamptz,timestamptz) from public;
grant execute on function public.qr_catalogo_v2(uuid), public.qr_pedido_estado_v2(uuid,integer,text) to anon,authenticated;
grant execute on function public.qr_caja_resumen_v2(uuid,timestamptz,timestamptz,integer,boolean,jsonb), public.qr_horario_resumen_v2(uuid,timestamptz,timestamptz) to authenticated;
create index if not exists qr_comensal_session_v2 on public.comensales(cliente_id,mesa,sesion_id);
create index if not exists qr_pending_items_v2 on public.pedidos_qr(comensal_id,pagado);
create index if not exists qr_horario_range_v2 on public.horario_usuarios(cliente_id,entrada_at desc,id);
create index if not exists qr_chat_cursor_v2 on public.chat_mensajes(cliente_id,qr_sequence,created_at,id);
create index if not exists qr_pedidos_range_v2 on public.pedidos_qr(fecha_hora,comensal_id);
notify pgrst,'reload schema';
commit;
