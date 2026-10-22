# DOIS — finanças em conjunto

Aplicação React/TypeScript para gerir as finanças de um agregado com dois membros. O frontend é totalmente estático; autenticação, PostgreSQL, funções atómicas e Row Level Security ficam no Supabase.

## Arquitetura e pressupostos

- **React + Vite + HashRouter**: funciona no GitHub Pages e suporta atualização direta sem regras de servidor.
- **Supabase**: email/palavra-passe, PostgreSQL e RLS. O bundle usa apenas `VITE_SUPABASE_URL` e a chave publicável — nunca uma `service_role`.
- **Dinheiro em cêntimos (`bigint`)** e datas financeiras em `date`, evitando erros binários e mudanças de dia por fuso horário.
- **Transferências** têm duas pernas ligadas e são criadas na função SQL `create_transfer`; não entram nos rendimentos/despesas. Os saldos iniciais também não entram no resultado.
- **Recorrências** são materializadas ao abrir/consultar a aplicação através de `generate_recurrences`. A restrição única `(recurrence_id, period_date)` torna a recuperação de períodos em falta idempotente nos dois dispositivos. Pagamentos históricos ficam desacoplados da regra.
- O modo demonstração usa dados fictícios em memória quando não há `.env`. Não persiste alterações.

### Regra de acerto

Para cada despesa partilhada, a primeira pessoa recebe `ceil(cêntimos/2)` e a segunda `floor(cêntimos/2)`; assim a soma é sempre exata. O acerto compara apenas **despesas partilhadas já pagas pessoalmente** com a parcela atribuída. Dinheiro transferido para a conta conjunta é mostrado à parte como contribuição e o saldo ainda disponível na conta conjunta não gera dívida. Uma despesa paga pela conta conjunta não é atribuída ao criador. Acertos movimentam dinheiro, mas não voltam a ser despesa ou rendimento.

## Execução local

Requer Node.js 22+.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Sem variáveis válidas, a aplicação abre em modo demonstração. Com Supabase configurado, exige login.

## Configurar o Supabase

1. Crie um projeto em [Supabase](https://supabase.com/dashboard). Não crie recursos automaticamente a partir deste repositório.
2. Em **SQL Editor**, execute por ordem os ficheiros de `supabase/migrations/`.
3. Em **Authentication → Users**, crie manualmente os dois utilizadores (Rafael e a segunda pessoa). Não guarde as palavras-passe no repositório.
4. Edite os dois emails e o nome em `supabase/bootstrap.sql`, execute-o uma vez e volte a guardar o ficheiro sem dados reais.
5. Em **Authentication → Providers → Email**, mantenha email/palavra-passe ativo e desative **Allow new users to sign up**. A documentação confirma que esta opção impede novos registos, mantendo o login de contas existentes: [configuração geral de Auth](https://supabase.com/docs/guides/auth/general-configuration).
6. Desative sign-in anónimo. Configure em **URL Configuration**:
   - Site URL: `https://UTILIZADOR.github.io/REPOSITORIO/`
   - Redirect URL: `https://UTILIZADOR.github.io/REPOSITORIO/#/nova-palavra-passe`
   - Para desenvolvimento: `http://localhost:5173/**`
7. Copie o **Project URL** e a **Publishable key** para `.env.local`. Nunca use a chave secreta ou `service_role`.

O frontend não oferece registo. A pertença ao agregado não tem permissões de escrita para `authenticated`; só o bootstrap administrativo a cria. Todas as tabelas expostas têm RLS e triggers validam que relações pertencem ao mesmo agregado.

## Testes e validação

```bash
npm test
npm run lint
npm run build
```

Os testes unitários cobrem divisão 50/50, cêntimos ímpares, transferências fora dos relatórios, saldos iniciais, despesas pessoais/partilhadas, recorrências idempotentes e CSV. `tests/security.sql` contém verificações pgTAP para executar com Supabase local (`supabase test db`); exige Docker e Supabase CLI.

## GitHub Pages

1. Envie o projeto para um repositório GitHub.
2. Em **Settings → Secrets and variables → Actions**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
4. Faça push para `main`. O workflow testa, valida TypeScript/lint, compila com o caminho base `/<repositório>/` e publica `dist`.

## Importação, exportação e cópias

O assistente aceita CSV com vírgula/ponto e vírgula, aspas, decimal português, datas configuráveis e montante com sinal. Coincidências são apenas assinaladas. O modelo guarda lote e linhas importadas, não o ficheiro original. Para cópia completa use **Database → Backups** ou `pg_dump`; a exportação CSV na lista exporta os movimentos filtrados.

## Limitações conhecidas

- A interface entregue cobre o fluxo completo de navegação, registo manual, consulta/exportação e preparação CSV. A persistência de transferências, recorrências e importações deve chamar as RPCs/tabelas fornecidas; integrações de UI mais avançadas (edição inline de todas as entidades e conciliação visual das duas pontas) podem ser evoluídas sem alterar o modelo.
- A geração de recorrências acontece quando um cliente chama `generate_recurrences`; recupera os meses em falta, mas não envia notificações enquanto ninguém abrir a aplicação.
- Não existe integração bancária direta nem armazenamento do CSV original.
- A recuperação de palavra-passe depende de email. O SMTP padrão do Supabase é apenas para experimentação e tem limites baixos; para produção configure SMTP próprio: [password auth](https://supabase.com/docs/guides/auth/passwords).

## Limites gratuitos verificados em 22/10/2026

O plano Free do Supabase indica 2 projetos ativos, 500 MB de base de dados por projeto, 50 000 MAU, 5 GB de egress e 1 GB de storage; projetos gratuitos podem pausar após uma semana sem atividade. Confirme sempre a [página oficial de preços](https://supabase.com/pricing) antes de publicar.

No GitHub Pages, o repositório e o site publicado têm limite recomendado/máximo de 1 GB, a publicação expira após 10 minutos e existe um limite suave de 100 GB/mês de largura de banda: [limites oficiais do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

> Esta aplicação lida com informação financeira pessoal. Use palavras-passe fortes, proteja as contas GitHub/Supabase com MFA, reveja as políticas RLS antes de inserir dados reais e mantenha exportações de segurança.
