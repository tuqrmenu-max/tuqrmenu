-- Promos con imágenes y videos (etapa 1: base de datos + bucket).
-- Ejecutar en Supabase > SQL Editor. No toca promos existentes: todo es opcional.

-- 1) Configuración de la animación (textos, tipo de animación, posición, duración por foto)
alter table public.promociones
  add column if not exists media_config jsonb;

-- 2) Archivos de cada promo (orden = orden en que se muestran)
create table if not exists public.promocion_media (
  id           uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references public.promociones(id) on delete cascade,
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  orden        int  not null default 0,
  tipo         text not null check (tipo in ('imagen','video')),
  url          text not null,
  path         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists promocion_media_promo_idx on public.promocion_media (promocion_id, orden);

alter table public.promocion_media enable row level security;

-- ¿El usuario actual es superadmin o dueño del cliente?
create or replace function public.puede_editar_promos(p_cliente_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.es_superadmin()
      or exists (select 1 from public.clientes c where c.id = p_cliente_id and c.user_id = auth.uid());
$$;
revoke all on function public.puede_editar_promos(uuid) from public;
grant execute on function public.puede_editar_promos(uuid) to authenticated;

drop policy if exists promocion_media_lectura on public.promocion_media;
create policy promocion_media_lectura on public.promocion_media
  for select using (true);   -- el menú del cliente las muestra sin login

drop policy if exists promocion_media_escritura on public.promocion_media;
create policy promocion_media_escritura on public.promocion_media
  for all to authenticated
  using (public.puede_editar_promos(cliente_id))
  with check (public.puede_editar_promos(cliente_id));

-- 3) Bucket público 'promos' (plan gratis: imágenes ≤ 2 MB, videos ≤ 8 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promos', 'promos', true, 8388608,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
      allowed_mime_types = excluded.allowed_mime_types;

-- Carpeta = id del cliente: promos/<cliente_id>/<archivo>
drop policy if exists promos_storage_lectura on storage.objects;
create policy promos_storage_lectura on storage.objects
  for select using (bucket_id = 'promos');

drop policy if exists promos_storage_escritura on storage.objects;
create policy promos_storage_escritura on storage.objects
  for all to authenticated
  using (bucket_id = 'promos' and public.puede_editar_promos(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'promos' and public.puede_editar_promos(((storage.foldername(name))[1])::uuid));
