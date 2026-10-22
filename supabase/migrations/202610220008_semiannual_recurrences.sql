-- Permite recorrências com periodicidade de seis em seis meses.
alter type public.recurrence_frequency add value if not exists 'semiannual';

create or replace function public.generate_recurrences(p_through date default current_date)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare n integer;
begin
 insert into public.recurrence_occurrences(household_id,recurrence_id,period_date,due_date,estimated_cents)
 select r.household_id,r.id,s::date,(s+(least(r.due_day,extract(day from(date_trunc('month',s)+interval '1 month - 1 day'))::int)-1)*interval '1 day')::date,r.estimated_cents
 from public.recurrences r
 cross join lateral generate_series(
  date_trunc('month',r.start_date)::date,
  date_trunc('month',least(p_through,coalesce(r.end_date,p_through)))::date,
  case r.frequency::text
   when 'monthly' then interval '1 month'
   when 'quarterly' then interval '3 months'
   when 'semiannual' then interval '6 months'
   else interval '1 year'
  end
 ) s
 where r.active and public.is_household_member(r.household_id)
 on conflict(recurrence_id,period_date) do nothing;
 get diagnostics n=row_count;
 return n;
end$$;

grant execute on function public.generate_recurrences(date) to authenticated;
