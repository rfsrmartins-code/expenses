-- Elimina movimentos normais e anula de forma segura pagamentos recorrentes.
create or replace function public.delete_movement(p_movement uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
 m public.movements;
 o public.recurrence_occurrences;
begin
 select * into m from public.movements where id=p_movement for update;
 if m.id is null or not public.is_household_member(m.household_id) then
  raise exception 'Movimento não encontrado';
 end if;
 if m.transfer_id is not null then
  raise exception 'Utilize a eliminação de transferência';
 end if;

 select * into o
 from public.recurrence_occurrences
 where movement_id=m.id
 for update;

 if o.id is not null then
  update public.recurrence_occurrences
  set status='planned', movement_id=null
  where id=o.id;
 end if;

 delete from public.movements where id=m.id;
end$$;

revoke all on function public.delete_movement(uuid) from public;
grant execute on function public.delete_movement(uuid) to authenticated;
