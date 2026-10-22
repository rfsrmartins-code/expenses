-- Teste de integração a executar com `supabase test db` num ambiente local.
begin;
select plan(4);
select has_table('public','movements','movements existe');
select row_security_active('public.movements'::regclass,'RLS ativa em movimentos');
select policies_are('public','movements',array['household_members_all'],'política restritiva aplicada');
select function_returns('public','create_transfer',array['uuid','uuid','bigint','date','text'],'uuid','transferência atómica disponível');
select * from finish();rollback;
