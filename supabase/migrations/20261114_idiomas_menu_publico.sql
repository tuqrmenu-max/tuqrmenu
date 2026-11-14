-- Idiomas que ofrece el menú del cliente (QR) de un local.
-- El menú lo abre un visitante sin sesión y no puede leer la tabla clientes, así que se
-- expone SOLO esta lista (nada más) mediante una función segura.
create or replace function public.qr_idiomas_menu(p_cliente_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.idiomas_menu from public.clientes c where c.id = p_cliente_id),
    array['es']::text[]
  );
$$;

revoke all on function public.qr_idiomas_menu(uuid) from public;
grant execute on function public.qr_idiomas_menu(uuid) to anon, authenticated;
