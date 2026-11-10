-- Divisões explícitas de despesas partilhadas e histórico de alterações.
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  movement_id uuid not null references public.movements(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  share_cents bigint not null check (share_cents >= 0),
  created_at timestamptz not null default now(),
  unique (movement_id, member_id)
);

create index if not exists expense_splits_household_idx on public.expense_splits(household_id);
create index if not exists expense_splits_movement_idx on public.expense_splits(movement_id);

alter table public.expense_splits enable row level security;
drop policy if exists expense_splits_household_access on public.expense_splits;
create policy expense_splits_household_access on public.expense_splits
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
grant select, insert, update, delete on public.expense_splits to authenticated;

alter table public.movements add column if not exists updated_at timestamptz;
alter table public.movements add column if not exists updated_by uuid references auth.users(id);

-- Preserva as despesas existentes: reparte os cêntimos pela ordem estável dos membros.
insert into public.expense_splits(household_id, movement_id, member_id, share_cents)
select m.household_id, m.id, member.id,
  (m.amount_cents / count(*) over (partition by m.id))
  + case when row_number() over (partition by m.id order by member.id)
      <= (m.amount_cents % count(*) over (partition by m.id)) then 1 else 0 end
from public.movements m
join public.members member on member.household_id=m.household_id
where m.type='expense' and m.scope='shared'
on conflict (movement_id, member_id) do nothing;

create or replace function public.save_expense_with_splits(
  p_movement uuid,
  p_account uuid,
  p_description text,
  p_amount bigint,
  p_date date,
  p_scope text,
  p_category uuid,
  p_owner uuid,
  p_payer uuid,
  p_notes text,
  p_splits jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  h uuid;
  uid uuid:=auth.uid();
  mid uuid;
  split_total bigint;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_amount<=0 or btrim(coalesce(p_description,''))='' then raise exception 'Despesa inválida'; end if;
  if p_scope not in ('personal','shared') then raise exception 'Classificação inválida'; end if;

  select household_id into h from public.accounts
  where id=p_account and public.is_household_member(household_id);
  if h is null then raise exception 'Conta inválida'; end if;
  if p_category is not null and not exists(select 1 from public.categories where id=p_category and household_id=h and kind='expense') then raise exception 'Categoria inválida'; end if;
  if p_owner is not null and not exists(select 1 from public.members where id=p_owner and household_id=h) then raise exception 'Titular inválido'; end if;
  if p_payer is not null and not exists(select 1 from public.members where id=p_payer and household_id=h) then raise exception 'Pagador inválido'; end if;

  if p_scope='shared' then
    if jsonb_typeof(p_splits)<>'array' or jsonb_array_length(p_splits)<2 then raise exception 'Indique a parte de cada pessoa'; end if;
    if exists(
      select 1 from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents bigint)
      where x.share_cents<0 or not exists(select 1 from public.members where id=x.member_id and household_id=h)
    ) then raise exception 'Divisão inválida'; end if;
    select sum(x.share_cents) into split_total from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents bigint);
    if split_total<>p_amount then raise exception 'As partes têm de somar o valor da despesa'; end if;
  end if;

  if p_movement is null then
    insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,scope,category_id,expense_owner_id,paid_by_member_id,notes,status,created_by)
    values(h,p_account,btrim(p_description),p_amount,p_date,'expense',p_scope,p_category,case when p_scope='personal' then p_owner end,p_payer,nullif(btrim(coalesce(p_notes,'')),''),'confirmed',uid)
    returning id into mid;
  else
    if not exists(select 1 from public.movements where id=p_movement and household_id=h and transfer_id is null) then raise exception 'Movimento inválido'; end if;
    update public.movements set account_id=p_account,description=btrim(p_description),amount_cents=p_amount,movement_date=p_date,type='expense',scope=p_scope,category_id=p_category,expense_owner_id=case when p_scope='personal' then p_owner end,paid_by_member_id=p_payer,notes=nullif(btrim(coalesce(p_notes,'')),''),updated_at=now(),updated_by=uid where id=p_movement;
    mid:=p_movement;
    delete from public.expense_splits where movement_id=mid;
  end if;

  if p_scope='shared' then
    insert into public.expense_splits(household_id,movement_id,member_id,share_cents)
    select h,mid,x.member_id,x.share_cents from jsonb_to_recordset(p_splits) as x(member_id uuid, share_cents bigint);
  end if;
  return mid;
end$$;

revoke all on function public.save_expense_with_splits(uuid,uuid,text,bigint,date,text,uuid,uuid,uuid,text,jsonb) from public;
grant execute on function public.save_expense_with_splits(uuid,uuid,text,bigint,date,text,uuid,uuid,uuid,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
