-- Permite editar apenas o nome apresentado, sem expor a associação ao agregado.
create or replace function public.rename_household_member(p_member uuid,p_display_name text) returns void
language plpgsql security definer set search_path=''
as $$
declare h uuid;
begin
 select household_id into h from public.members where id=p_member;
 if h is null or not public.is_household_member(h) then raise exception 'Sem acesso ao membro'; end if;
 if length(trim(p_display_name)) not between 1 and 80 then raise exception 'Nome inválido'; end if;
 update public.members set display_name=trim(p_display_name) where id=p_member;
end$$;
revoke all on function public.rename_household_member(uuid,text) from public;
grant execute on function public.rename_household_member(uuid,text) to authenticated;
notify pgrst, 'reload schema';
