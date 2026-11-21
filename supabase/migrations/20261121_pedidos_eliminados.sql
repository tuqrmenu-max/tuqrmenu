-- Pedidos eliminados de Mesa 0 / Mesa 00 (el cliente mandó el pedido dos veces, se equivocó, etc.).
--
-- Cuando el socio elimina un pedido desde Mesas (botón X en la tarjeta), el pedido se borra de la
-- lista activa y se guarda acá UNA COPIA para control. Esta tabla NO es tickets_caja: Caja arma
-- sus totales (Total caja, Total cobrado, Tickets, etc.) solo con tickets_caja, así que lo
-- eliminado nunca se suma a la caja diaria; solo se muestra en la sección "Pedidos eliminados".
--
-- Es compatible hacia atrás: solo agrega una tabla nueva. Se puede aplicar ANTES de mergear el código.
-- Es un registro de control: se puede leer e insertar, pero no editar ni borrar desde la app.

create table if not exists public.pedidos_eliminados (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  mesa             integer not null,               -- 0 = Mesa 0 (delivery/retiro), -1 = Mesa 00 (para llevar)
  codigo_pedido    text,
  comensal_nombre  text,
  telefono         text,
  metodo_entrega   text,
  estado_pedido    text,                           -- en qué estado estaba al eliminarlo
  items            jsonb not null default '[]'::jsonb,
  total            numeric(12,2) not null default 0,
  eliminado_por    jsonb,                          -- { user_id, nombre, usuario }
  eliminado_at     timestamptz not null default now()
);

create index if not exists pedidos_eliminados_cliente_fecha_idx
  on public.pedidos_eliminados (cliente_id, eliminado_at desc);

alter table public.pedidos_eliminados enable row level security;

drop policy if exists "Dueno o staff puede leer pedidos_eliminados" on public.pedidos_eliminados;
create policy "Dueno o staff puede leer pedidos_eliminados"
  on public.pedidos_eliminados for select to authenticated
  using (cliente_id in (select mis_clientes_ids()) or es_superadmin());

drop policy if exists "Dueno o staff puede crear pedidos_eliminados" on public.pedidos_eliminados;
create policy "Dueno o staff puede crear pedidos_eliminados"
  on public.pedidos_eliminados for insert to authenticated
  with check (cliente_id in (select mis_clientes_ids()) or es_superadmin());
