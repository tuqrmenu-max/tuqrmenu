-- Login del personal por local: usuario@local
--
-- Antes el "usuario" (mozo/cajero/cocina/delivery) era único en toda la plataforma.
-- Ahora cada local tiene un identificador corto y fijo (clientes.slug) y el usuario
-- es único DENTRO de cada local. El personal nuevo entra con "usuario@local".
-- Las cuentas que ya existen siguen entrando con su usuario de siempre.

-- 1) Identificador corto del local (solo a-z y 0-9, sin acentos) -----------------
alter table public.clientes add column if not exists slug text;

create or replace function public.slugify_local(p text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      lower(translate(coalesce(p, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9]+', '', 'g'),
    '')
$$;

-- Genera el slug al crear el local (con sufijo numérico si ya existe) y
-- impide cambiarlo después, porque los emails internos del personal dependen de él.
create or replace function public.clientes_slug_guard()
returns trigger
language plpgsql
as $$
declare
  base text;
  cand text;
  n int := 1;
begin
  if tg_op = 'UPDATE' and old.slug is not null and new.slug is distinct from old.slug then
    raise exception 'El identificador del local (slug) no se puede cambiar';
  end if;

  if new.slug is null or new.slug = '' then
    base := left(coalesce(public.slugify_local(new.nombre_restaurante), 'local'), 30);
    cand := base;
    while exists (select 1 from public.clientes c where c.slug = cand and c.id is distinct from new.id) loop
      n := n + 1;
      cand := base || n::text;
    end loop;
    new.slug := cand;
  elsif new.slug !~ '^[a-z0-9]{1,40}$' then
    raise exception 'slug invalido: solo letras minusculas y numeros';
  end if;
  return new;
end
$$;

drop trigger if exists clientes_slug_guard on public.clientes;
create trigger clientes_slug_guard
  before insert or update on public.clientes
  for each row execute function public.clientes_slug_guard();

-- Completa el slug de los locales que ya existen (el trigger lo genera).
do $$
declare r record;
begin
  for r in select id from public.clientes where slug is null or slug = '' order by created_at, id loop
    update public.clientes set slug = '' where id = r.id;
  end loop;
end
$$;

alter table public.clientes alter column slug set not null;
create unique index if not exists clientes_slug_unq on public.clientes (slug);

-- 2) Usuario único por local (en vez de único en toda la plataforma) ------------
drop index if exists public.cliente_usuarios_usuario_unq;
create unique index if not exists cliente_usuarios_usuario_cliente_unq
  on public.cliente_usuarios (cliente_id, lower(usuario))
  where usuario is not null;

-- 3) Login viejo (solo "usuario", sin @local) -----------------------------------
-- Solo resuelve cuentas anteriores (las nuevas terminan en .staff.tuqrmenu.app y
-- entran con usuario@local). Si por algún motivo hubiera más de una coincidencia,
-- devuelve null en vez de elegir una cuenta al azar.
create or replace function public.resolver_login_usuario(p_usuario text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when count(*) = 1 then min(email) end
  from cliente_usuarios
  where lower(usuario) = lower(trim(p_usuario))
    and coalesce(activo, true) = true
    and email not like '%.staff.tuqrmenu.app'
$$;
