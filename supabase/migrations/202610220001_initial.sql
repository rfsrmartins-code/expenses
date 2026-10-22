-- Finanças a Dois — modelo, segurança e operações atómicas
create extension if not exists pgcrypto;
create type public.account_owner as enum ('member','joint');
create type public.movement_type as enum ('income','expense','transfer','settlement');
create type public.expense_scope as enum ('personal','shared');
create type public.movement_status as enum ('planned','confirmed');
create type public.occurrence_status as enum ('planned','paid');
create type public.recurrence_frequency as enum ('monthly','quarterly','yearly');

create table public.households(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.members(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,user_id uuid not null unique references auth.users on delete cascade,display_name text not null check(length(trim(display_name)) between 1 and 80),created_at timestamptz not null default now(),unique(household_id,user_id));
create table public.categories(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,name text not null,color text not null default '#5b8c85' check(color ~ '^#[0-9a-fA-F]{6}$'),kind text not null check(kind in('income','expense')),archived boolean not null default false,unique(household_id,name,kind));
create table public.accounts(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,name text not null,owner_kind public.account_owner not null,owner_member_id uuid references public.members on delete restrict,opening_balance_cents bigint not null default 0,opening_date date not null,archived boolean not null default false,created_at timestamptz not null default now(),check((owner_kind='joint' and owner_member_id is null) or (owner_kind='member' and owner_member_id is not null)),unique(household_id,name));
create table public.transfers(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,source_account_id uuid not null references public.accounts on delete restrict,destination_account_id uuid not null references public.accounts on delete restrict,amount_cents bigint not null check(amount_cents>0),transfer_date date not null,description text not null,created_by uuid not null references auth.users,created_at timestamptz not null default now(),check(source_account_id<>destination_account_id));
create table public.movements(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,account_id uuid not null references public.accounts on delete restrict,description text not null check(length(trim(description))>0),amount_cents bigint not null check(amount_cents>0),movement_date date not null,type public.movement_type not null,status public.movement_status not null default 'confirmed',scope public.expense_scope,category_id uuid references public.categories on delete restrict,expense_owner_id uuid references public.members on delete restrict,paid_by_member_id uuid references public.members on delete restrict,transfer_id uuid references public.transfers on delete cascade,transfer_direction text check(transfer_direction in('out','in')),notes text,created_by uuid not null references auth.users,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((type='expense' and scope is not null) or (type<>'expense' and scope is null)),check((scope='personal' and expense_owner_id is not null) or scope is distinct from 'personal'),check((type='transfer' and transfer_id is not null and transfer_direction is not null) or (type<>'transfer' and transfer_id is null and transfer_direction is null)));
create unique index transfer_legs_unique on public.movements(transfer_id,account_id) where transfer_id is not null;
create index movements_household_date on public.movements(household_id,movement_date desc);create index movements_account_date on public.movements(account_id,movement_date desc);create index movements_category on public.movements(category_id);
create table public.recurrences(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,description text not null,category_id uuid references public.categories on delete restrict,account_id uuid not null references public.accounts on delete restrict,estimated_cents bigint not null check(estimated_cents>0),frequency public.recurrence_frequency not null,due_day smallint not null check(due_day between 1 and 31),start_date date not null,end_date date,scope public.expense_scope not null,expense_owner_id uuid references public.members on delete restrict,active boolean not null default true,created_at timestamptz not null default now(),check(end_date is null or end_date>=start_date),check((scope='personal' and expense_owner_id is not null) or scope='shared'));
create table public.recurrence_occurrences(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,recurrence_id uuid not null references public.recurrences on delete restrict,period_date date not null,due_date date not null,estimated_cents bigint not null check(estimated_cents>0),status public.occurrence_status not null default 'planned',movement_id uuid unique references public.movements on delete restrict,created_at timestamptz not null default now(),unique(recurrence_id,period_date),check((status='paid' and movement_id is not null) or (status='planned' and movement_id is null)));
create table public.budgets(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,month date not null check(month=date_trunc('month',month)::date),category_id uuid not null references public.categories on delete cascade,scope public.expense_scope not null,member_id uuid references public.members on delete cascade,limit_cents bigint not null check(limit_cents>0),check((scope='personal' and member_id is not null) or (scope='shared' and member_id is null)),unique(household_id,month,category_id,scope,member_id));
create table public.savings_goals(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,name text not null,target_cents bigint not null check(target_cents>0),target_date date,archived boolean not null default false,created_at timestamptz not null default now());
create table public.goal_entries(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,goal_id uuid not null references public.savings_goals on delete cascade,amount_cents bigint not null check(amount_cents<>0),entry_date date not null,notes text,created_by uuid not null references auth.users,created_at timestamptz not null default now());
create table public.import_profiles(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,name text not null,mapping jsonb not null,created_by uuid not null references auth.users,unique(household_id,name));
create table public.import_batches(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,account_id uuid not null references public.accounts on delete restrict,file_name text,created_by uuid not null references auth.users,created_at timestamptz not null default now(),undone_at timestamptz);
create table public.import_rows(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,batch_id uuid not null references public.import_batches on delete cascade,movement_id uuid references public.movements on delete restrict,bank_identifier text,fingerprint text not null,row_number integer not null,unique(batch_id,row_number));
create unique index imported_bank_id_unique on public.import_rows(household_id,bank_identifier) where bank_identifier is not null;

create or replace function public.is_household_member(h uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.members where household_id=h and user_id=auth.uid())$$;
revoke all on function public.is_household_member(uuid) from public;grant execute on function public.is_household_member(uuid) to authenticated;

-- Cross-table tenant checks cannot be expressed by foreign keys alone.
create or replace function public.validate_household_relations() returns trigger language plpgsql set search_path='' as $$
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
create trigger accounts_relations before insert or update on public.accounts for each row execute function public.validate_household_relations();
create trigger movements_relations before insert or update on public.movements for each row execute function public.validate_household_relations();
create trigger transfers_relations before insert or update on public.transfers for each row execute function public.validate_household_relations();
create trigger recurrences_relations before insert or update on public.recurrences for each row execute function public.validate_household_relations();

create or replace function public.create_transfer(p_source uuid,p_destination uuid,p_amount bigint,p_date date,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; t uuid; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Não autenticado'; end if;if p_amount<=0 or p_source=p_destination then raise exception 'Transferência inválida';end if;
 select household_id into h from public.accounts where id=p_source and public.is_household_member(household_id);if h is null or not exists(select 1 from public.accounts where id=p_destination and household_id=h) then raise exception 'Contas inválidas';end if;
 insert into public.transfers(household_id,source_account_id,destination_account_id,amount_cents,transfer_date,description,created_by) values(h,p_source,p_destination,p_amount,p_date,p_description,uid) returning id into t;
 insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,transfer_id,transfer_direction,created_by) values(h,p_source,p_description,p_amount,p_date,'transfer',t,'out',uid),(h,p_destination,p_description,p_amount,p_date,'transfer',t,'in',uid);return t;
end$$;
revoke all on function public.create_transfer(uuid,uuid,bigint,date,text) from public;grant execute on function public.create_transfer(uuid,uuid,bigint,date,text) to authenticated;

create or replace function public.generate_recurrences(p_through date default current_date) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.recurrence_occurrences(household_id,recurrence_id,period_date,due_date,estimated_cents)
 select r.household_id,r.id,s::date,(s+(least(r.due_day,extract(day from(date_trunc('month',s)+interval '1 month - 1 day'))::int)-1)*interval '1 day')::date,r.estimated_cents
 from public.recurrences r cross join lateral generate_series(date_trunc('month',r.start_date)::date,date_trunc('month',least(p_through,coalesce(r.end_date,p_through)))::date,case r.frequency when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' else interval '1 year' end)s
 where r.active and public.is_household_member(r.household_id) on conflict(recurrence_id,period_date) do nothing;get diagnostics n=row_count;return n;
end$$;grant execute on function public.generate_recurrences(date) to authenticated;

create or replace function public.confirm_occurrence(p_occurrence uuid,p_amount bigint,p_date date,p_account uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.recurrence_occurrences; r public.recurrences; mid uuid;
begin select * into o from public.recurrence_occurrences where id=p_occurrence for update;if o.status='paid' then return o.movement_id;end if;if not public.is_household_member(o.household_id) then raise exception 'Sem acesso';end if;select * into r from public.recurrences where id=o.recurrence_id;if p_amount<=0 or not exists(select 1 from public.accounts where id=p_account and household_id=o.household_id) then raise exception 'Pagamento inválido';end if;
 insert into public.movements(household_id,account_id,description,amount_cents,movement_date,type,status,scope,category_id,expense_owner_id,created_by) values(o.household_id,p_account,r.description,p_amount,p_date,'expense','confirmed',r.scope,r.category_id,r.expense_owner_id,auth.uid()) returning id into mid;update public.recurrence_occurrences set status='paid',movement_id=mid where id=o.id;return mid;end$$;grant execute on function public.confirm_occurrence(uuid,bigint,date,uuid) to authenticated;

-- RLS: toda a API exposta é limitada aos dois membros do agregado.
alter table public.households enable row level security;
create policy household_members_all on public.households for all to authenticated using(public.is_household_member(id)) with check(public.is_household_member(id));
do $$declare t text;begin foreach t in array array['members','categories','accounts','transfers','movements','recurrences','recurrence_occurrences','budgets','savings_goals','goal_entries','import_profiles','import_batches','import_rows'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy household_members_all on public.%I for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',t);end loop;end$$;
-- Clientes nunca criam ou mudam membros/agregados. O bootstrap é feito pelo SQL administrativo abaixo.
revoke insert,update,delete on public.households,public.members from authenticated;
grant select on all tables in schema public to authenticated;grant insert,update,delete on public.categories,public.accounts,public.movements,public.recurrences,public.recurrence_occurrences,public.budgets,public.savings_goals,public.goal_entries,public.import_profiles,public.import_batches,public.import_rows to authenticated;

create view public.account_balances with(security_invoker=true) as select a.id,a.household_id,a.name,a.opening_balance_cents+coalesce(sum(case when m.status='confirmed' and m.type='income' then m.amount_cents when m.status='confirmed' and m.type='expense' then -m.amount_cents when m.status='confirmed' and m.type in('transfer','settlement') and m.transfer_direction='in' then m.amount_cents when m.status='confirmed' and m.type in('transfer','settlement') and m.transfer_direction='out' then -m.amount_cents else 0 end),0) balance_cents from public.accounts a left join public.movements m on m.account_id=a.id group by a.id;
grant select on public.account_balances to authenticated;
