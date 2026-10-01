drop policy if exists documents_storage_select_own_business on storage.objects;
drop policy if exists documents_storage_insert_own_business on storage.objects;
drop policy if exists documents_storage_update_own_business on storage.objects;
drop policy if exists documents_storage_delete_own_business on storage.objects;

create policy documents_storage_select_own_business on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = split_part(storage.objects.name, '/', 1)
      and b.owner_id = auth.uid()
  )
);

create policy documents_storage_insert_own_business on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = split_part(storage.objects.name, '/', 1)
      and b.owner_id = auth.uid()
  )
);

create policy documents_storage_update_own_business on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = split_part(storage.objects.name, '/', 1)
      and b.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = split_part(storage.objects.name, '/', 1)
      and b.owner_id = auth.uid()
  )
);

create policy documents_storage_delete_own_business on storage.objects
for delete to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = split_part(storage.objects.name, '/', 1)
      and b.owner_id = auth.uid()
  )
);