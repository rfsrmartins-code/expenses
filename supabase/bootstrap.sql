-- Executar APÓS criar os dois utilizadores no painel Authentication > Users.
-- Substituir emails e o nome da segunda pessoa. Executar uma única vez.
do $$
declare h uuid; u1 uuid; u2 uuid;
begin
 select id into u1 from auth.users where email='rafael@example.com';
 select id into u2 from auth.users where email='namorada@example.com';
 if u1 is null or u2 is null then raise exception 'Crie primeiro os dois utilizadores'; end if;
 insert into public.households(name) values('Casa do Rafael') returning id into h;
 insert into public.members(household_id,user_id,display_name) values(h,u1,'Rafael'),(h,u2,'Nome configurável');
 insert into public.categories(household_id,name,color,kind) values(h,'Casa','#5b8c85','expense'),(h,'Alimentação','#d99058','expense'),(h,'Transportes','#6f8aa5','expense'),(h,'Saúde','#b26f6f','expense'),(h,'Lazer','#8b75a8','expense'),(h,'Salário','#77935c','income'),(h,'Outros rendimentos','#6a9b87','income');
end$$;
