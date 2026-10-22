alter table public.transfers add column if not exists purpose text not null default 'normal' check(purpose in('normal','contribution','settlement'));
update public.transfers t set purpose='contribution' where exists(select 1 from public.accounts s join public.accounts d on d.id=t.destination_account_id where s.id=t.source_account_id and s.owner_kind='member' and d.owner_kind='joint');

create or replace function public.create_transfer(p_source uuid,p_destination uuid,p_amount bigint,p_date date,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; t uuid; uid uuid:=auth.uid(); transfer_purpose text:='normal';
begin
 if uid is null then raise exception 'Não autenticado'; end if;if p_amount<=0 or p_source=p_destination then raise exception 'Transferência inválida';end if;
 select household_id into h from public.accounts where id=p_source and public.is_household_member(household_id);if h is null or not exists(select 1 from public.accounts where id=p_destination and household_id=h) then raise exception 'Contas inválidas';end if;
 if exists(select 1 from public.accounts s join public.accounts d on d.id=p_destination where s.id=p_source and s.owner_kind='member' and d.owner_kind='joint') then transfer_purpose:='contribution';end if;
 insert into public.transfers(household_id,source_account_id,destination_account_id,amount_cents,transfer_date,description,created_by,purpose) values(h,p_source,p_destination,p_amount,p_date,p_description,uid,transfer_purpose) returning id into t;
 insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,transfer_id,transfer_direction,created_by) values(h,p_source,p_description,p_amount,p_date,'transfer',t,'out',uid),(h,p_destination,p_description,p_amount,p_date,'transfer',t,'in',uid);return t;
end$$;

create or replace function public.create_member_settlement(p_source uuid,p_destination uuid,p_amount bigint,p_date date,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; t uuid; uid uuid:=auth.uid(); source_owner uuid; destination_owner uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;if p_amount<=0 or p_source=p_destination then raise exception 'Acerto inválido';end if;
 select household_id,owner_member_id into h,source_owner from public.accounts where id=p_source and owner_kind='member' and public.is_household_member(household_id);
 select owner_member_id into destination_owner from public.accounts where id=p_destination and household_id=h and owner_kind='member';
 if h is null or source_owner is null or destination_owner is null or source_owner=destination_owner then raise exception 'Escolha contas pessoais de membros diferentes';end if;
 insert into public.transfers(household_id,source_account_id,destination_account_id,amount_cents,transfer_date,description,created_by,purpose) values(h,p_source,p_destination,p_amount,p_date,p_description,uid,'settlement') returning id into t;
 insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,transfer_id,transfer_direction,created_by) values(h,p_source,p_description,p_amount,p_date,'transfer',t,'out',uid),(h,p_destination,p_description,p_amount,p_date,'transfer',t,'in',uid);return t;
end$$;
revoke all on function public.create_member_settlement(uuid,uuid,bigint,date,text) from public;grant execute on function public.create_member_settlement(uuid,uuid,bigint,date,text) to authenticated;

create or replace function public.mark_transfer_contribution(p_transfer uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid;
begin select household_id into h from public.transfers where id=p_transfer;if h is null or not public.is_household_member(h) then raise exception 'Sem acesso';end if;update public.transfers set purpose='contribution' where id=p_transfer;end$$;
grant execute on function public.mark_transfer_contribution(uuid) to authenticated;
notify pgrst, 'reload schema';
