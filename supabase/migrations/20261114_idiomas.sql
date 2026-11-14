-- Idiomas por socio (etapa 1): qué idiomas ofrece el menú del cliente y cuáles la app.
-- El español es siempre el idioma base y va siempre incluido.
-- Idiomas permitidos: en, pt, fr, it, de, ru, zh, ja.

alter table public.clientes
  add column if not exists idiomas_menu text[] not null default array['es']::text[],
  add column if not exists idiomas_app  text[] not null default array['es']::text[];

alter table public.clientes drop constraint if exists clientes_idiomas_menu_chk;
alter table public.clientes add constraint clientes_idiomas_menu_chk
  check (idiomas_menu @> array['es']::text[]
         and idiomas_menu <@ array['es','en','pt','fr','it','de','ru','zh','ja']::text[]);

alter table public.clientes drop constraint if exists clientes_idiomas_app_chk;
alter table public.clientes add constraint clientes_idiomas_app_chk
  check (idiomas_app @> array['es']::text[]
         and idiomas_app <@ array['es','en','pt','fr','it','de','ru','zh','ja']::text[]);

-- Solo el super admin decide los idiomas de cada socio: aunque el dueño pueda actualizar
-- su propia fila de clientes, estas dos columnas quedan protegidas.
create or replace function public.proteger_idiomas_clientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.idiomas_menu is distinct from old.idiomas_menu
      or new.idiomas_app is distinct from old.idiomas_app)
     and not es_superadmin() then
    raise exception 'Solo el super admin puede cambiar los idiomas';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_idiomas_clientes on public.clientes;
create trigger trg_proteger_idiomas_clientes
  before update on public.clientes
  for each row execute function public.proteger_idiomas_clientes();

-- Traducciones de la carta (se usan en las etapas siguientes).
-- Formato: {"en": {"nombre": "...", "detalle": "..."}, "pt": {...}}
alter table public.productos  add column if not exists traducciones jsonb not null default '{}'::jsonb;
alter table public.categorias add column if not exists traducciones jsonb not null default '{}'::jsonb;
