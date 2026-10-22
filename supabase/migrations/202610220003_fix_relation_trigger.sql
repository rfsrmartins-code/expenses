-- Corrige o trigger polimórfico: NEW tem uma estrutura diferente em cada tabela.
create or replace function public.validate_household_relations() returns trigger
language plpgsql set search_path=''
as $$
declare p jsonb:=to_jsonb(new); h uuid:=(p->>'household_id')::uuid;
begin
 if tg_table_name='accounts' and p->>'owner_member_id' is not null and not exists(select 1 from public.members where id=(p->>'owner_member_id')::uuid and household_id=h) then raise exception 'Membro fora do agregado'; end if;
 if tg_table_name='movements' then
  if not exists(select 1 from public.accounts where id=(p->>'account_id')::uuid and household_id=h) then raise exception 'Conta fora do agregado'; end if;
  if p->>'category_id' is not null and not exists(select 1 from public.categories where id=(p->>'category_id')::uuid and household_id=h) then raise exception 'Categoria fora do agregado'; end if;
  if p->>'expense_owner_id' is not null and not exists(select 1 from public.members where id=(p->>'expense_owner_id')::uuid and household_id=h) then raise exception 'Titular fora do agregado'; end if;
  if p->>'paid_by_member_id' is not null and not exists(select 1 from public.members where id=(p->>'paid_by_member_id')::uuid and household_id=h) then raise exception 'Pagador fora do agregado'; end if;
 end if;
 if tg_table_name='transfers' and (not exists(select 1 from public.accounts where id=(p->>'source_account_id')::uuid and household_id=h) or not exists(select 1 from public.accounts where id=(p->>'destination_account_id')::uuid and household_id=h)) then raise exception 'Conta fora do agregado'; end if;
 if tg_table_name='recurrences' and not exists(select 1 from public.accounts where id=(p->>'account_id')::uuid and household_id=h) then raise exception 'Conta fora do agregado'; end if;
 return new;
end$$;
