-- Preparación de archivos públicos de menú. Ejecutar antes de optimizar imágenes.
-- No cambia tablas, pedidos ni políticas existentes. Escritura solo dueño / superadmin.
begin;
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists qrmenu_images_owner_insert on storage.objects;
create policy qrmenu_images_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'productos' and (
    exists (select 1 from public.clientes c where c.id::text = (storage.foldername(name))[1] and c.user_id = auth.uid())
    or exists (select 1 from public.superadmins s where s.user_id = auth.uid())
  )
);
drop policy if exists qrmenu_images_owner_read on storage.objects;
create policy qrmenu_images_owner_read on storage.objects for select to authenticated
using (
  bucket_id = 'productos' and (
    exists (select 1 from public.clientes c where c.id::text = (storage.foldername(name))[1] and c.user_id = auth.uid())
    or exists (select 1 from public.superadmins s where s.user_id = auth.uid())
  )
);
commit;
