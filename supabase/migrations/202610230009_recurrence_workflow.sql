-- Permite ignorar ocorrências e editar regras sem alterar pagamentos históricos.
alter type public.occurrence_status add value if not exists 'skipped';

alter table public.recurrence_occurrences
 drop constraint if exists recurrence_occurrences_check;

alter table public.recurrence_occurrences
 add constraint recurrence_occurrences_status_movement_check
 check (
  (status = 'paid' and movement_id is not null)
  or (status::text in ('planned', 'skipped') and movement_id is null)
 );

create or replace function public.skip_recurrence_occurrence(p_occurrence uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.recurrence_occurrences;
begin
 select * into o
 from public.recurrence_occurrences
 where id = p_occurrence
 for update;

 if o.id is null or not public.is_household_member(o.household_id) then
  raise exception 'Ocorrência não encontrada';
 end if;
 if o.status <> 'planned' then
  raise exception 'Apenas ocorrências previstas podem ser ignoradas';
 end if;

 update public.recurrence_occurrences
 set status = 'skipped'
 where id = o.id;
end$$;

revoke all on function public.skip_recurrence_occurrence(uuid) from public;
grant execute on function public.skip_recurrence_occurrence(uuid) to authenticated;

create or replace function public.skip_overdue_recurrence_occurrences()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare n integer;
begin
 update public.recurrence_occurrences
 set status='skipped'
 where status='planned'
   and due_date<current_date
   and public.is_household_member(household_id);
 get diagnostics n=row_count;
 return n;
end$$;

revoke all on function public.skip_overdue_recurrence_occurrences() from public;
grant execute on function public.skip_overdue_recurrence_occurrences() to authenticated;

create or replace function public.update_recurrence(
 p_recurrence uuid,
 p_description text,
 p_category uuid,
 p_account uuid,
 p_estimated bigint,
 p_frequency public.recurrence_frequency,
 p_due_day smallint,
 p_start date,
 p_end date,
 p_scope public.expense_scope,
 p_owner uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare r public.recurrences;
begin
 select * into r from public.recurrences where id = p_recurrence for update;
 if r.id is null or not public.is_household_member(r.household_id) then
  raise exception 'Recorrência não encontrada';
 end if;
 if length(trim(p_description)) = 0 or p_estimated <= 0 or p_due_day not between 1 and 31 then
  raise exception 'Dados da recorrência inválidos';
 end if;
 if not exists(select 1 from public.accounts where id=p_account and household_id=r.household_id) then
  raise exception 'Conta fora do agregado';
 end if;
 if p_category is not null and not exists(select 1 from public.categories where id=p_category and household_id=r.household_id) then
  raise exception 'Categoria fora do agregado';
 end if;
 if p_scope = 'personal' and (p_owner is null or not exists(select 1 from public.members where id=p_owner and household_id=r.household_id)) then
  raise exception 'Titular inválido';
 end if;

 update public.recurrences
 set description=trim(p_description), category_id=p_category, account_id=p_account,
     estimated_cents=p_estimated, frequency=p_frequency, due_day=p_due_day,
     start_date=p_start, end_date=p_end, scope=p_scope,
     expense_owner_id=case when p_scope='personal' then p_owner else null end
 where id=p_recurrence;

 -- Só recalcula previsões de hoje em diante; pagos, ignorados e vencidos ficam intactos.
 delete from public.recurrence_occurrences
 where recurrence_id=p_recurrence and status='planned' and due_date>=current_date;
end$$;

revoke all on function public.update_recurrence(uuid,text,uuid,uuid,bigint,public.recurrence_frequency,smallint,date,date,public.expense_scope,uuid) from public;
grant execute on function public.update_recurrence(uuid,text,uuid,uuid,bigint,public.recurrence_frequency,smallint,date,date,public.expense_scope,uuid) to authenticated;
