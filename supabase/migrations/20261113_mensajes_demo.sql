-- Mensajes de "Pedir una demo" de la landing -> super admin > Nuevos mensajes
create table if not exists public.mensajes_demo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 80),
  whatsapp text not null check (whatsapp ~ '^[0-9+ ()-]{6,24}$'),
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mensajes_demo_created_idx on public.mensajes_demo (created_at desc);

alter table public.mensajes_demo enable row level security;

drop policy if exists "Superadmin gestiona mensajes_demo" on public.mensajes_demo;
create policy "Superadmin gestiona mensajes_demo"
  on public.mensajes_demo for all to authenticated
  using (es_superadmin()) with check (es_superadmin());

-- La landing (visitante sin sesion) solo puede ENVIAR, y unicamente por esta funcion:
-- valida los datos, ignora repetidos del mismo numero (10 min) y limita el total por hora.
create or replace function public.enviar_demo(p_nombre text, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := btrim(coalesce(p_nombre, ''));
  w text := btrim(coalesce(p_whatsapp, ''));
begin
  if char_length(n) < 1 or char_length(n) > 80 then
    raise exception 'Nombre invalido';
  end if;
  if w !~ '^[0-9+ ()-]{6,24}$' then
    raise exception 'WhatsApp invalido';
  end if;
  if exists (select 1 from mensajes_demo where whatsapp = w and created_at > now() - interval '10 minutes') then
    return;
  end if;
  if (select count(*) from mensajes_demo where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Demasiados envios, proba mas tarde';
  end if;
  insert into mensajes_demo (nombre, whatsapp) values (n, w);
end;
$$;

revoke all on function public.enviar_demo(text, text) from public;
grant execute on function public.enviar_demo(text, text) to anon, authenticated;

-- Para el contador y el aviso en vivo del super admin
alter publication supabase_realtime add table public.mensajes_demo;
