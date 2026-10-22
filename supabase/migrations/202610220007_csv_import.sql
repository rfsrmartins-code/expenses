create or replace function public.import_movement_batch(p_account uuid,p_file_name text,p_rows jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; b uuid; uid uuid:=auth.uid(); r jsonb; mid uuid; cents bigint;
begin
 if uid is null then raise exception 'Não autenticado';end if;select household_id into h from public.accounts where id=p_account and public.is_household_member(household_id);if h is null then raise exception 'Conta inválida';end if;
 insert into public.import_batches(household_id,account_id,file_name,created_by) values(h,p_account,left(p_file_name,255),uid) returning id into b;
 for r in select * from jsonb_array_elements(p_rows) loop
  cents:=(r->>'amount_cents')::bigint;if cents=0 then raise exception 'Montante zero na linha %',r->>'row_number';end if;
  if r->>'bank_identifier' is not null and exists(select 1 from public.import_rows where household_id=h and bank_identifier=r->>'bank_identifier') then raise exception 'Identificador bancário já importado na linha %',r->>'row_number';end if;
  insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,status,scope,category_id,expense_owner_id,paid_by_member_id,created_by)
  values(h,p_account,r->>'description',abs(cents),(r->>'date')::date,case when cents<0 then 'expense'::public.movement_type else 'income'::public.movement_type end,'confirmed',case when cents<0 then coalesce((r->>'scope')::public.expense_scope,'shared') end,case when r->>'category_id' is null then null else (r->>'category_id')::uuid end,case when r->>'owner_id' is null then null else (r->>'owner_id')::uuid end,(select owner_member_id from public.accounts where id=p_account),uid) returning id into mid;
  insert into public.import_rows(household_id,batch_id,movement_id,bank_identifier,fingerprint,row_number) values(h,b,mid,r->>'bank_identifier',r->>'fingerprint',(r->>'row_number')::integer);
 end loop;return b;
end$$;
revoke all on function public.import_movement_batch(uuid,text,jsonb) from public;grant execute on function public.import_movement_batch(uuid,text,jsonb) to authenticated;

create or replace function public.undo_import_batch(p_batch uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid; mids uuid[];
begin select household_id into h from public.import_batches where id=p_batch and undone_at is null for update;if h is null or not public.is_household_member(h) then raise exception 'Lote inválido';end if;select array_agg(movement_id) into mids from public.import_rows where batch_id=p_batch;delete from public.import_rows where batch_id=p_batch;delete from public.movements where id=any(coalesce(mids,array[]::uuid[]));update public.import_batches set undone_at=now() where id=p_batch;end$$;
revoke all on function public.undo_import_batch(uuid) from public;grant execute on function public.undo_import_batch(uuid) to authenticated;
notify pgrst, 'reload schema';
