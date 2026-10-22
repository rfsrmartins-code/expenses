-- Reforço de relações, orçamentos partilhados únicos e pagador de recorrências.
alter table public.budgets drop constraint if exists budgets_household_id_month_category_id_scope_member_id_key;
alter table public.budgets add constraint budgets_unique_scope unique nulls not distinct(household_id,month,category_id,scope,member_id);

create or replace function public.validate_extended_relations() returns trigger
language plpgsql set search_path=''
as $$
declare p jsonb:=to_jsonb(new); h uuid:=(p->>'household_id')::uuid;
begin
 if tg_table_name='recurrence_occurrences' and not exists(select 1 from public.recurrences where id=(p->>'recurrence_id')::uuid and household_id=h) then raise exception 'Recorrência fora do agregado'; end if;
 if tg_table_name='budgets' then
  if not exists(select 1 from public.categories where id=(p->>'category_id')::uuid and household_id=h and kind='expense') then raise exception 'Categoria fora do agregado'; end if;
  if p->>'member_id' is not null and not exists(select 1 from public.members where id=(p->>'member_id')::uuid and household_id=h) then raise exception 'Membro fora do agregado'; end if;
 end if;
 if tg_table_name='goal_entries' and not exists(select 1 from public.savings_goals where id=(p->>'goal_id')::uuid and household_id=h) then raise exception 'Objetivo fora do agregado'; end if;
 return new;
end$$;
create trigger occurrences_relations before insert or update on public.recurrence_occurrences for each row execute function public.validate_extended_relations();
create trigger budgets_relations before insert or update on public.budgets for each row execute function public.validate_extended_relations();
create trigger goal_entries_relations before insert or update on public.goal_entries for each row execute function public.validate_extended_relations();

create or replace function public.confirm_occurrence(p_occurrence uuid,p_amount bigint,p_date date,p_account uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.recurrence_occurrences; r public.recurrences; mid uuid; payer uuid;
begin select * into o from public.recurrence_occurrences where id=p_occurrence for update;if o.status='paid' then return o.movement_id;end if;if not public.is_household_member(o.household_id) then raise exception 'Sem acesso';end if;select * into r from public.recurrences where id=o.recurrence_id;if p_amount<=0 or not exists(select 1 from public.accounts where id=p_account and household_id=o.household_id) then raise exception 'Pagamento inválido';end if;
 select owner_member_id into payer from public.accounts where id=p_account and owner_kind='member';
 insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,status,scope,category_id,expense_owner_id,paid_by_member_id,created_by) values(o.household_id,p_account,r.description,p_amount,p_date,'expense','confirmed',r.scope,r.category_id,r.expense_owner_id,payer,auth.uid()) returning id into mid;update public.recurrence_occurrences set status='paid',movement_id=mid where id=o.id;return mid;end$$;
