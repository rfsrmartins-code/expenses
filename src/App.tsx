import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Download,
  Goal,
  Home,
  Landmark,
  LogOut,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { configured, supabase } from "./lib/supabase";
import { accountBalance, eur, parseMoney } from "./lib/money";
import { parseCsv, type CsvMapping, type ParsedRow } from "./lib/csv";
import type { Account, Category, Member, Movement } from "./types";
import RecurringPage from "./pages/RecurringPage";
import BudgetsPage from "./pages/BudgetsPage";
import GoalsPage from "./pages/GoalsPage";
import CategorySettingsPage from "./pages/SettingsPage";
import SettlementsPage from "./pages/SettlementsPage";
import ImportPage from "./pages/ImportPage";

const demoMembers: Member[] = [
  {
    id: "rafael",
    user_id: "rafael",
    display_name: "Rafael",
    household_id: "demo",
  },
  {
    id: "maria",
    user_id: "maria",
    display_name: "Maria",
    household_id: "demo",
  },
];
const demoAccounts: Account[] = [
  {
    id: "joint",
    name: "Conta conjunta",
    owner_kind: "joint",
    owner_member_id: null,
    opening_balance_cents: 0,
    opening_date: "2026-01-01",
    archived: false,
  },
  {
    id: "r1",
    name: "Conta do Rafael",
    owner_kind: "member",
    owner_member_id: "rafael",
    opening_balance_cents: 185000,
    opening_date: "2026-01-01",
    archived: false,
  },
  {
    id: "m1",
    name: "Conta da Maria",
    owner_kind: "member",
    owner_member_id: "maria",
    opening_balance_cents: 142000,
    opening_date: "2026-01-01",
    archived: false,
  },
];
const demoCats: Category[] = [
  { id: "casa", name: "Casa", color: "#5b8c85", kind: "expense" },
  { id: "alimentacao", name: "Alimentação", color: "#d99058", kind: "expense" },
  { id: "salario", name: "Salário", color: "#77935c", kind: "income" },
  { id: "lazer", name: "Lazer", color: "#8b75a8", kind: "expense" },
];
const mk = (
  id: string,
  description: string,
  amount: number,
  date: string,
  type: Movement["type"],
  account = "joint",
  category: string | null = "casa",
  scope: Movement["scope"] = "shared",
): Movement => ({
  id,
  description,
  amount_cents: amount,
  movement_date: date,
  type,
  account_id: account,
  category_id: category,
  scope,
  expense_owner_id: null,
  paid_by_member_id: account === "joint" ? null : "rafael",
  notes: null,
  transfer_id: null,
  transfer_direction: null,
  status: "confirmed",
  created_at: date,
  created_by: "rafael",
});
const demoMovements = [
  mk(
    "1",
    "Salário Rafael",
    245000,
    "2026-10-01",
    "income",
    "r1",
    "salario",
    null,
  ),
  mk("2", "Prestação da casa", 90000, "2026-10-03", "expense"),
  mk(
    "3",
    "Supermercado",
    8634,
    "2026-10-12",
    "expense",
    "joint",
    "alimentacao",
  ),
  mk("4", "Eletricidade", 6780, "2026-10-15", "expense"),
  mk("5", "Cinema", 2850, "2026-10-17", "expense", "r1", "lazer", "personal"),
];

type Data = {
  members: Member[];
  accounts: Account[];
  categories: Category[];
  movements: Movement[];
};
function useData() {
  const empty: Data = {
    members: [],
    accounts: [],
    categories: [],
    movements: [],
  };
  const [data, setData] = useState<Data>(
    configured
      ? empty
      : {
          members: demoMembers,
          accounts: demoAccounts,
          categories: demoCats,
          movements: demoMovements,
        },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    const [m, a, c, v] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.from("accounts").select("*").eq("archived", false),
      supabase.from("categories").select("*").eq("archived", false),
      supabase
        .from("movements")
        .select("*")
        .order("movement_date", { ascending: false }),
    ]);
    const err = m.error || a.error || c.error || v.error;
    if (err) setError(err.message);
    else
      setData({
        members: m.data as Member[],
        accounts: a.data as Account[],
        categories: c.data as Category[],
        movements: v.data as Movement[],
      });
    setLoading(false);
  }, []);
  return { data, setData, reload, loading, error };
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else navigate("/");
  };
  const reset = async () => {
    if (!email) return setMessage("Indique primeiro o seu email.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}?recovery=1`,
    });
    setMessage(
      error ? error.message : "Enviámos as instruções de recuperação.",
    );
  };
  return (
    <div className="login-shell">
      <div className="login-art">
        <div className="brand">
          <span>DOIS</span>
          <small>finanças em conjunto</small>
        </div>
        <blockquote>
          “Clareza nas contas.
          <br />
          Leveza na vida a dois.”
        </blockquote>
      </div>
      <form className="login-card" onSubmit={login}>
        <div className="eyebrow">ÁREA PRIVADA</div>
        <h1>Bem-vindos de volta</h1>
        <p>Entrem para ver a vossa vida financeira num só lugar.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Palavra-passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {message && <div className="notice">{message}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "A entrar…" : "Entrar"}
        </button>
        <button type="button" className="link" onClick={reset}>
          Recuperar palavra-passe
        </button>
        {!configured && (
          <div className="demo-note">
            Modo demonstração — configure o Supabase para ativar o login.
          </div>
        )}
      </form>
    </div>
  );
}

function PasswordReset({ done }: { done: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8)
      return setMessage("A palavra-passe deve ter pelo menos 8 caracteres.");
    if (password !== confirmPassword)
      return setMessage("As palavras-passe não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      history.replaceState({}, "", location.pathname);
      done();
    }
  };
  return (
    <div className="login-shell">
      <div className="login-art">
        <div className="brand">
          <span>DOIS</span>
          <small>finanças em conjunto</small>
        </div>
        <blockquote>
          Uma nova chave.
          <br />A mesma casa.
        </blockquote>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="eyebrow">RECUPERAÇÃO</div>
        <h1>Nova palavra-passe</h1>
        <p>Escolhe uma palavra-passe forte com pelo menos 8 caracteres.</p>
        <label>
          Nova palavra-passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirmar palavra-passe
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {message && <div className="notice">{message}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "A guardar…" : "Guardar nova palavra-passe"}
        </button>
      </form>
    </div>
  );
}

function Shell({
  children,
  memberName,
}: {
  children: React.ReactNode;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const nav = [
    ["/", Home, "Visão geral"],
    ["/movimentos", ArrowLeftRight, "Movimentos"],
    ["/contas", WalletCards, "Contas"],
    ["/acertos", Scale, "Acertos"],
    ["/recorrentes", CalendarClock, "Recorrentes"],
    ["/orcamentos", BarChart3, "Orçamentos"],
    ["/objetivos", Goal, "Objetivos"],
    ["/importar", Upload, "Importar CSV"],
    ["/definicoes", Settings, "Definições"],
  ] as const;
  const mobileNav = nav.filter(([to]) =>
    ["/", "/movimentos", "/recorrentes", "/orcamentos"].includes(to),
  );
  const moreActive = !mobileNav.some(
    ([to]) =>
      location.pathname === to ||
      (to !== "/" && location.pathname.startsWith(`${to}/`)),
  );
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div className="app">
      <button
        className={`drawer-backdrop ${open ? "open" : ""}`}
        aria-label="Fechar menu"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <aside className={open ? "open" : ""} aria-label="Menu principal">
        <div className="side-brand">
          <span>D</span>
          <b>DOIS</b>
          <button aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav className="sidebar-nav">
          {nav.map(([to, I, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <I />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="profile">
          <div>{memberName[0]?.toUpperCase() || "R"}</div>
          <span>
            <b>{memberName}</b>
            <small>Finanças partilhadas</small>
          </span>
          <button
            aria-label="Terminar sessão"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <main>
        <div className="mobile-topbar">
          <div className="mobile-wordmark">
            <span>D</span>
            <b>DOIS</b>
          </div>
          <button
            className="mobile-menu"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu completo"
            aria-expanded={open}
          >
            <Menu />
          </button>
        </div>
        {children}
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal móvel">
        {mobileNav.map(([to, Icon, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon />
            <span>{label === "Visão geral" ? "Início" : label}</span>
          </NavLink>
        ))}
        <button
          className={open || moreActive ? "active" : ""}
          onClick={() => setOpen(true)}
          aria-label="Abrir mais opções"
          aria-expanded={open}
        >
          <Menu />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
const Header = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) => (
  <header className="page-head">
    <div>
      <p>{subtitle}</p>
      <h1>{title}</h1>
    </div>
    {action}
  </header>
);

function Dashboard({ d, memberName }: { d: Data; memberName: string }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const m = d.movements.filter(
    (x) => x.movement_date.startsWith(month) && x.status === "confirmed",
  );
  const income = m
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + x.amount_cents, 0);
  const expense = m
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + x.amount_cents, 0);
  const shared = m
    .filter((x) => x.type === "expense" && x.scope === "shared")
    .reduce((s, x) => s + x.amount_cents, 0);
  const joint = d.accounts
    .filter((a) => a.owner_kind === "joint")
    .reduce(
      (total, a) =>
        total +
        accountBalance(
          a,
          d.movements.filter((x) => x.account_id === a.id),
        ),
      0,
    );
  const totalBalance = d.accounts.reduce(
    (total, account) =>
      total +
      accountBalance(
        account,
        d.movements.filter((movement) => movement.account_id === account.id),
      ),
    0,
  );
  const savingsRate =
    income > 0
      ? Math.max(0, Math.round(((income - expense) / income) * 100))
      : 0;
  const chart = d.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      name: c.name,
      valor: m
        .filter((x) => x.category_id === c.id && x.type === "expense")
        .reduce((s, x) => s + x.amount_cents / 100, 0),
      color: c.color,
    }))
    .filter((x) => x.valor);
  const monthLabel = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  })
    .format(now)
    .toUpperCase();
  return (
    <>
      <Header
        title={memberName ? `Olá, ${memberName}` : "Olá"}
        subtitle={monthLabel}
        action={
          <NavLink to="/movimentos" className="primary">
            <Plus />
            Novo movimento
          </NavLink>
        }
      />
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-label">BALANÇO DE {monthLabel}</span>
          <strong>{eur(income - expense)}</strong>
          <p>
            {income - expense >= 0
              ? "Este mês está com saldo positivo."
              : "As despesas ultrapassaram os rendimentos deste mês."}
          </p>
          <div className="hero-progress">
            <i style={{ width: `${Math.min(100, savingsRate)}%` }} />
          </div>
          <small>
            {savingsRate}% dos rendimentos disponíveis após despesas
          </small>
        </div>
        <div className="hero-balance">
          <span>Património nas contas</span>
          <b>{eur(totalBalance)}</b>
          <small>
            {d.accounts.length}{" "}
            {d.accounts.length === 1 ? "conta ativa" : "contas ativas"}
          </small>
        </div>
      </section>
      <section className="quick-actions" aria-label="Ações rápidas">
        <NavLink to="/movimentos">
          <span>
            <Plus />
          </span>
          <div>
            <b>Registar movimento</b>
            <small>Despesa ou rendimento</small>
          </div>
          <ChevronRight />
        </NavLink>
        <NavLink to="/movimentos">
          <span>
            <ArrowLeftRight />
          </span>
          <div>
            <b>Fazer transferência</b>
            <small>Entre as vossas contas</small>
          </div>
          <ChevronRight />
        </NavLink>
        <NavLink to="/importar">
          <span>
            <Upload />
          </span>
          <div>
            <b>Importar extrato</b>
            <small>Adicionar movimentos CSV</small>
          </div>
          <ChevronRight />
        </NavLink>
      </section>
      <section className="kpis">
        <article>
          <i className="green">
            <ArrowDownRight />
          </i>
          <span>Rendimentos do mês</span>
          <strong>{eur(income)}</strong>
        </article>
        <article>
          <i className="orange">
            <ArrowUpRight />
          </i>
          <span>Despesas do mês</span>
          <strong>{eur(expense)}</strong>
        </article>
        <article>
          <i className="sage">
            <Home />
          </i>
          <span>Despesas partilhadas</span>
          <strong>{eur(shared)}</strong>
        </article>
        <article>
          <i className="purple">
            <Landmark />
          </i>
          <span>Saldo conjunto</span>
          <strong>{eur(joint)}</strong>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel spending-panel">
          <div className="panel-title">
            <div>
              <small>DISTRIBUIÇÃO DO MÊS</small>
              <h2>Despesas por categoria</h2>
            </div>
          </div>
          {chart.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v) => eur(Number(v) * 100)} />
                  <Bar dataKey="valor" fill="#5b8c85" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="empty">Ainda não existem despesas neste mês.</p>
          )}
        </article>
        <article className="panel accounts-panel">
          <div className="panel-title">
            <div>
              <small>POSIÇÃO ATUAL</small>
              <h2>Saldos das contas</h2>
            </div>
            <NavLink className="link" to="/contas">
              Gerir
            </NavLink>
          </div>
          <div className="account-list">
            {d.accounts.slice(0, 4).map((account) => (
              <div className="account-row" key={account.id}>
                <span
                  className={
                    account.owner_kind === "joint" ? "joint" : "personal"
                  }
                >
                  {account.owner_kind === "joint" ? <Home /> : <WalletCards />}
                </span>
                <div>
                  <b>{account.name}</b>
                  <small>
                    {account.owner_kind === "joint"
                      ? "Conta conjunta"
                      : d.members.find(
                          (member) => member.id === account.owner_member_id,
                        )?.display_name || "Conta pessoal"}
                  </small>
                </div>
                <strong>
                  {eur(
                    accountBalance(
                      account,
                      d.movements.filter(
                        (movement) => movement.account_id === account.id,
                      ),
                    ),
                  )}
                </strong>
              </div>
            ))}
          </div>
          {!d.accounts.length && (
            <p className="empty">Ainda não existem contas.</p>
          )}
        </article>
      </section>
      <section className="dashboard-bottom">
        <section className="panel activity-panel">
          <div className="panel-title">
            <div>
              <small>ATIVIDADE</small>
              <h2>Últimos movimentos</h2>
            </div>
            <NavLink className="link" to="/movimentos">
              Ver todos
            </NavLink>
          </div>
          <MovementTable rows={m.slice(0, 5)} d={d} />
        </section>
        <aside className="dashboard-aside">
          <NavLink to="/orcamentos" className="insight-card budget-insight">
            <span>
              <ReceiptText />
            </span>
            <div>
              <small>ORÇAMENTOS</small>
              <b>Controla os limites mensais</b>
              <p>Compara o planeado com as despesas reais.</p>
            </div>
            <ChevronRight />
          </NavLink>
          <NavLink to="/objetivos" className="insight-card goal-insight">
            <span>
              <PiggyBank />
            </span>
            <div>
              <small>POUPANÇA</small>
              <b>Constrói os vossos objetivos</b>
              <p>Reserva dinheiro sem o contar como despesa.</p>
            </div>
            <ChevronRight />
          </NavLink>
        </aside>
      </section>
    </>
  );
}

function MovementTable({
  rows,
  d,
  onDelete,
  onEdit,
}: {
  rows: Movement[];
  d: Data;
  onDelete?: (id: string) => void;
  onEdit?: (m: Movement) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Conta</th>
            <th>Classificação</th>
            <th>Tipo</th>
            <th className="right">Valor</th>
            {(onDelete || onEdit) && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{m.movement_date.split("-").reverse().join("/")}</td>
              <td>
                <b>{m.description}</b>
                {m.notes && <small className="cell-note">{m.notes}</small>}
              </td>
              <td>
                {d.categories.find((c) => c.id === m.category_id)?.name || "—"}
              </td>
              <td>
                {d.accounts.find((a) => a.id === m.account_id)?.name || "—"}
              </td>
              <td>
                {m.scope === "shared"
                  ? "Partilhada"
                  : m.scope === "personal"
                    ? d.members.find((x) => x.id === m.expense_owner_id)
                        ?.display_name || "Pessoal"
                    : "—"}
              </td>
              <td>
                <span className={`pill ${m.type}`}>
                  {m.type === "expense"
                    ? "Despesa"
                    : m.type === "income"
                      ? "Rendimento"
                      : m.type === "transfer"
                        ? "Transferência"
                        : "Acerto"}
                </span>
              </td>
              <td className={`right amount ${m.type}`}>
                {m.type === "expense" || m.transfer_direction === "out"
                  ? "-"
                  : m.type === "income" || m.transfer_direction === "in"
                    ? "+"
                    : ""}
                {eur(m.amount_cents)}
              </td>
              {(onDelete || onEdit) && (
                <td>
                  <div className="row-actions">
                    {onEdit && m.type !== "transfer" && (
                      <button
                        className="icon"
                        aria-label="Editar"
                        onClick={() => onEdit(m)}
                      >
                        <Pencil />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="icon danger"
                        aria-label="Eliminar"
                        onClick={() => onDelete(m.id)}
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                Sem movimentos para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Movements({
  d,
  setData,
  reload,
}: {
  d: Data;
  setData: (f: (x: Data) => Data) => void;
  reload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Movement | null | undefined>(
    undefined,
  );
  const [transfer, setTransfer] = useState(false);
  const rows = d.movements.filter((m) =>
    m.description.toLowerCase().includes(search.toLowerCase()),
  );
  const remove = async (id: string) => {
    const item = d.movements.find((x) => x.id === id);
    if (
      !confirm(
        item?.type === "transfer"
          ? "Eliminar esta transferência e as duas pernas associadas?"
          : "Eliminar este movimento? Esta ação não pode ser anulada.",
      )
    )
      return;
    if (configured) {
      const result = item?.transfer_id
        ? await supabase.rpc("delete_transfer", {
            p_transfer: item.transfer_id,
          })
        : await supabase.rpc("delete_movement", { p_movement: id });
      if (result.error) return alert(result.error.message);
      await reload();
    } else
      setData((x) => ({
        ...x,
        movements: x.movements.filter((m) => m.id !== id),
      }));
  };
  return (
    <>
      <Header
        title="Movimentos"
        subtitle="TODAS AS CONTAS"
        action={
          <div className="head-actions">
            <button className="secondary" onClick={() => setTransfer(true)}>
              <ArrowLeftRight />
              Transferir
            </button>
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus />
              Adicionar
            </button>
          </div>
        }
      />
      <div className="toolbar">
        <input
          type="search"
          placeholder="Pesquisar descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="secondary" onClick={() => exportCsv(rows)}>
          <Download />
          Exportar CSV
        </button>
      </div>
      <section className="panel">
        <MovementTable
          rows={rows}
          d={d}
          onDelete={remove}
          onEdit={setEditing}
        />
      </section>
      {editing !== undefined && (
        <MovementModal
          d={d}
          movement={editing}
          close={() => setEditing(undefined)}
          reload={reload}
          setData={setData}
        />
      )}{" "}
      {transfer && (
        <TransferModal d={d} close={() => setTransfer(false)} reload={reload} />
      )}
    </>
  );
}
function MovementModal({
  d,
  movement,
  close,
  reload,
  setData,
}: {
  d: Data;
  movement: Movement | null;
  close: () => void;
  reload: () => Promise<void>;
  setData: (f: (x: Data) => Data) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<Movement["type"]>(
    movement?.type || "expense",
  );
  const [scope, setScope] = useState<Movement["scope"]>(
    movement?.scope || "shared",
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const memberId = String(fd.get("owner")) || null;
    const row = {
      household_id: d.members[0]?.household_id,
      description: String(fd.get("description")).trim(),
      amount_cents: parseMoney(String(fd.get("amount"))),
      movement_date: String(fd.get("date")),
      type,
      scope: type === "expense" ? scope : null,
      account_id: String(fd.get("account")),
      category_id: String(fd.get("category")) || null,
      expense_owner_id:
        type === "expense" && scope === "personal" ? memberId : null,
      paid_by_member_id:
        type === "expense" ? String(fd.get("payer")) || null : null,
      notes: String(fd.get("notes")).trim() || null,
      status: "confirmed" as const,
    };
    if (configured) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = { ...row, created_by: movement?.created_by || user?.id };
      const { error } = movement
        ? await supabase.from("movements").update(row).eq("id", movement.id)
        : await supabase.from("movements").insert(payload);
      if (error) {
        alert(error.message);
        setBusy(false);
        return;
      }
      await reload();
    } else {
      const local = {
        ...row,
        id: movement?.id || crypto.randomUUID(),
        transfer_id: null,
        transfer_direction: null,
        created_at: movement?.created_at || new Date().toISOString(),
        created_by: "rafael",
      } as Movement;
      setData((x) => ({
        ...x,
        movements: movement
          ? x.movements.map((m) => (m.id === movement.id ? local : m))
          : [local, ...x.movements],
      }));
    }
    close();
  };
  const categories = d.categories.filter(
    (c) => c.kind === (type === "income" ? "income" : "expense"),
  );
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <button type="button" className="modal-close" onClick={close}>
          <X />
        </button>
        <div className="eyebrow">
          {movement ? "EDITAR REGISTO" : "REGISTO RÁPIDO"}
        </div>
        <h2>{movement ? "Editar movimento" : "Novo movimento"}</h2>
        {!d.accounts.length && (
          <div className="notice">Cria primeiro uma conta.</div>
        )}
        <div className="form-grid">
          <label className="wide">
            Descrição
            <input
              name="description"
              defaultValue={movement?.description}
              required
              autoFocus
            />
          </label>
          <label>
            Valor
            <input
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                movement
                  ? (movement.amount_cents / 100).toFixed(2).replace(".", ",")
                  : ""
              }
              required
            />
          </label>
          <label>
            Data
            <input
              name="date"
              type="date"
              defaultValue={
                movement?.movement_date || new Date().toISOString().slice(0, 10)
              }
              required
            />
          </label>
          <label>
            Tipo
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as Movement["type"])}
            >
              <option value="expense">Despesa</option>
              <option value="income">Rendimento</option>
              <option value="settlement">Acerto</option>
            </select>
          </label>
          {type === "expense" && (
            <label>
              Classificação
              <select
                name="scope"
                value={scope || "shared"}
                onChange={(e) => setScope(e.target.value as Movement["scope"])}
              >
                <option value="shared">Partilhada</option>
                <option value="personal">Pessoal</option>
              </select>
            </label>
          )}
          <label>
            Conta
            <select name="account" defaultValue={movement?.account_id} required>
              <option value="">Escolher…</option>
              {d.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select name="category" defaultValue={movement?.category_id || ""}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {type === "expense" && scope === "personal" && (
            <label>
              A quem pertence
              <select
                name="owner"
                defaultValue={movement?.expense_owner_id || d.members[0]?.id}
                required
              >
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {type === "expense" && (
            <label>
              Quem pagou
              <select
                name="payer"
                defaultValue={movement?.paid_by_member_id || ""}
              >
                <option value="">Conta conjunta</option>
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="wide">
            Notas
            <textarea
              name="notes"
              rows={2}
              defaultValue={movement?.notes || ""}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || !d.accounts.length}>
            {busy ? "A guardar…" : "Guardar movimento"}
          </button>
        </div>
      </form>
    </div>
  );
}
function TransferModal({
  d,
  close,
  reload,
}: {
  d: Data;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const source = String(fd.get("source"));
    const destination = String(fd.get("destination"));
    if (source === destination) return alert("Escolhe duas contas diferentes.");
    setBusy(true);
    const { error } = await supabase.rpc("create_transfer", {
      p_source: source,
      p_destination: destination,
      p_amount: parseMoney(String(fd.get("amount"))),
      p_date: String(fd.get("date")),
      p_description: String(fd.get("description")).trim(),
    });
    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }
    await reload();
    close();
  };
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <button type="button" className="modal-close" onClick={close}>
          <X />
        </button>
        <div className="eyebrow">MOVIMENTO INTERNO</div>
        <h2>Transferir entre contas</h2>
        <p className="muted">
          Uma transferência altera os dois saldos, mas não conta como rendimento
          ou despesa.
        </p>
        <div className="form-grid">
          <label>
            Conta de origem
            <select name="source" required>
              <option value="">Escolher…</option>
              {d.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conta de destino
            <select name="destination" required>
              <option value="">Escolher…</option>
              {d.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input name="amount" inputMode="decimal" required />
          </label>
          <label>
            Data
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label className="wide">
            Descrição
            <input
              name="description"
              defaultValue="Transferência entre contas"
              required
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || d.accounts.length < 2}>
            {busy ? "A transferir…" : "Confirmar transferência"}
          </button>
        </div>
      </form>
    </div>
  );
}
function exportCsv(rows: Movement[]) {
  const head = "Data;Descrição;Tipo;Valor EUR\n";
  const body = rows
    .map((x) =>
      [
        x.movement_date,
        `"${x.description.replaceAll('"', '""')}"`,
        x.type,
        (x.amount_cents / 100).toFixed(2).replace(".", ","),
      ].join(";"),
    )
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([head + body], { type: "text/csv;charset=utf-8" }),
  );
  a.download = "movimentos.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function Accounts({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);
  const archive = async (a: Account) => {
    if (
      !confirm(`Arquivar a conta “${a.name}”? Os movimentos ficam preservados.`)
    )
      return;
    const { error } = await supabase
      .from("accounts")
      .update({ archived: true })
      .eq("id", a.id);
    if (error) return alert(error.message);
    await reload();
  };
  return (
    <>
      <Header
        title="Contas"
        subtitle="SALDOS ATUAIS"
        action={
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus />
            Nova conta
          </button>
        }
      />
      {d.accounts.length ? (
        <section className="cards">
          {d.accounts.map((a) => (
            <article className="account" key={a.id}>
              <div className="account-top">
                <div className="account-icon">
                  <WalletCards />
                </div>
                <div className="row-actions">
                  <button
                    className="icon"
                    aria-label="Editar conta"
                    onClick={() => setEditing(a)}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="icon danger"
                    aria-label="Arquivar conta"
                    onClick={() => archive(a)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
              <span>{a.owner_kind === "joint" ? "CONJUNTA" : "PESSOAL"}</span>
              <h2>{a.name}</h2>
              <strong>
                {eur(
                  accountBalance(
                    a,
                    d.movements.filter((m) => m.account_id === a.id),
                  ),
                )}
              </strong>
              <small>Saldo confirmado</small>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <WalletCards />
          <h2>Começa pelas vossas contas</h2>
          <p>
            Cria as contas pessoais e a conta conjunta para poderes registar
            movimentos.
          </p>
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus />
            Criar primeira conta
          </button>
        </section>
      )}
      <section className="panel explainer">
        <h2>Como são calculados os saldos?</h2>
        <p>
          Saldo inicial + movimentos confirmados. Movimentos previstos não
          alteram o saldo e transferências movem dinheiro entre contas sem
          afetar o resultado do casal.
        </p>
      </section>
      {editing !== undefined && (
        <AccountModal
          d={d}
          account={editing}
          close={() => setEditing(undefined)}
          reload={reload}
        />
      )}
    </>
  );
}
function AccountModal({
  d,
  account,
  close,
  reload,
}: {
  d: Data;
  account: Account | null;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [owner, setOwner] = useState<Account["owner_kind"]>(
    account?.owner_kind || "member",
  );
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const row = {
      household_id: d.members[0]?.household_id,
      name: String(fd.get("name")).trim(),
      owner_kind: owner,
      owner_member_id: owner === "member" ? String(fd.get("member")) : null,
      opening_balance_cents: parseMoney(String(fd.get("opening")) || "0"),
      opening_date: String(fd.get("date")),
    };
    const { error } = account
      ? await supabase.from("accounts").update(row).eq("id", account.id)
      : await supabase.from("accounts").insert(row);
    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }
    await reload();
    close();
  };
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <button type="button" className="modal-close" onClick={close}>
          <X />
        </button>
        <div className="eyebrow">{account ? "EDITAR CONTA" : "NOVA CONTA"}</div>
        <h2>{account ? "Editar conta" : "Criar conta"}</h2>
        <div className="form-grid">
          <label className="wide">
            Nome
            <input
              name="name"
              defaultValue={account?.name}
              placeholder="Ex.: Conta conjunta"
              required
              autoFocus
            />
          </label>
          <label>
            Titularidade
            <select
              name="owner_kind"
              value={owner}
              onChange={(e) =>
                setOwner(e.target.value as Account["owner_kind"])
              }
            >
              <option value="member">Pessoal</option>
              <option value="joint">Conjunta</option>
            </select>
          </label>
          {owner === "member" && (
            <label>
              Titular
              <select
                name="member"
                defaultValue={account?.owner_member_id || d.members[0]?.id}
                required
              >
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Saldo inicial
            <input
              name="opening"
              inputMode="decimal"
              defaultValue={
                account
                  ? (account.opening_balance_cents / 100)
                      .toFixed(2)
                      .replace(".", ",")
                  : "0,00"
              }
              required
            />
          </label>
          <label>
            Data inicial
            <input
              name="date"
              type="date"
              defaultValue={
                account?.opening_date || new Date().toISOString().slice(0, 10)
              }
              required
            />
          </label>
        </div>
        <div className="notice">
          O saldo inicial estabelece o ponto de partida; não será contado como
          rendimento.
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "A guardar…" : "Guardar conta"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Recurring({ d }: { d: Data }) {
  return (
    <RecurringPage
      accounts={d.accounts}
      categories={d.categories}
      members={d.members}
    />
  );
}
// Legacy demonstrator retained temporarily for migration compatibility.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ImportCsv({ d }: { d: Data }) {
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState(d.accounts[0]?.id || "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({
    date: "",
    description: "",
    amount: "",
    dateFormat: "dd/MM/yyyy",
  });
  const file = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
    const first = t.split(/\r?\n/)[0];
    setHeaders(
      first
        .split(first.includes(";") ? ";" : ",")
        .map((x) => x.replaceAll('"', "").trim()),
    );
    setStep(3);
  };
  const preview = () => {
    try {
      setRows(parseCsv(text, mapping));
      setStep(4);
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <>
      <Header title="Importar movimentos" subtitle="ASSISTENTE CSV" />
      <ol className="steps">
        {[
          "Conta",
          "Ficheiro",
          "Mapeamento",
          "Pré-visualização",
          "Confirmar",
        ].map((x, i) => (
          <li className={step >= i + 1 ? "active" : ""} key={x}>
            <b>{i + 1}</b>
            {x}
          </li>
        ))}
      </ol>
      <section className="panel wizard">
        {step === 1 && (
          <>
            <h2>Em que conta ocorreram estes movimentos?</h2>
            <div className="account-choice">
              {d.accounts.map((a) => (
                <button
                  className={account === a.id ? "selected" : ""}
                  onClick={() => setAccount(a.id)}
                  key={a.id}
                >
                  <WalletCards />
                  <b>{a.name}</b>
                  <small>
                    {a.owner_kind === "joint"
                      ? "Conta conjunta"
                      : "Conta pessoal"}
                  </small>
                </button>
              ))}
            </div>
            <button className="primary" onClick={() => setStep(2)}>
              Continuar
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Escolha o ficheiro do banco</h2>
            <label className="dropzone">
              <Upload />
              <b>Selecionar ficheiro CSV</b>
              <span>Vírgula ou ponto e vírgula, até 10 MB</span>
              <input type="file" accept=".csv,text/csv" onChange={file} />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Associe as colunas</h2>
            <div className="form-grid">
              <Map
                label="Data"
                value={mapping.date}
                headers={headers}
                onChange={(v) => setMapping({ ...mapping, date: v })}
              />
              <Map
                label="Descrição"
                value={mapping.description}
                headers={headers}
                onChange={(v) => setMapping({ ...mapping, description: v })}
              />
              <Map
                label="Montante com sinal"
                value={mapping.amount || ""}
                headers={headers}
                onChange={(v) => setMapping({ ...mapping, amount: v })}
              />
              <label>
                Formato da data
                <select
                  value={mapping.dateFormat}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      dateFormat: e.target.value as CsvMapping["dateFormat"],
                    })
                  }
                >
                  <option>dd/MM/yyyy</option>
                  <option>MM/dd/yyyy</option>
                  <option>yyyy-MM-dd</option>
                </select>
              </label>
            </div>
            <button
              className="primary"
              disabled={
                !mapping.date || !mapping.description || !mapping.amount
              }
              onClick={preview}
            >
              Pré-visualizar
            </button>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Reveja antes de importar</h2>
            <p>
              {rows.length} linhas válidas. Coincidências são assinaladas, nunca
              eliminadas automaticamente.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Incluir</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={r.row}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!r.excluded}
                          onChange={() =>
                            setRows((x) =>
                              x.map((v, j) =>
                                j === i ? { ...v, excluded: !v.excluded } : v,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>{r.date}</td>
                      <td>{r.description}</td>
                      <td className="right">{eur(Math.abs(r.amountCents))}</td>
                      <td>
                        <select>
                          <option>
                            {r.amountCents < 0
                              ? "Despesa partilhada"
                              : "Rendimento"}
                          </option>
                          <option>Despesa pessoal</option>
                          <option>Transferência</option>
                          <option>Associar recorrência</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="primary" onClick={() => setStep(5)}>
              Confirmar seleção
            </button>
          </>
        )}
        {step === 5 && (
          <div className="success">
            <div>✓</div>
            <h2>Pronto para importar</h2>
            <p>
              Na configuração Supabase, o lote será guardado atomicamente e
              poderá ser desfeito por inteiro.
            </p>
            <button
              className="primary"
              onClick={() =>
                alert("Configure o Supabase para persistir a importação.")
              }
            >
              Importar {rows.filter((r) => !r.excluded).length} movimentos
            </button>
          </div>
        )}
      </section>
    </>
  );
}
function Map({
  label,
  value,
  headers,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (s: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolher coluna…</option>
        {headers.map((h) => (
          <option key={h}>{h}</option>
        ))}
      </select>
    </label>
  );
}
function SettingsPage({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  return (
    <CategorySettingsPage
      members={d.members}
      categories={d.categories}
      reload={reload}
    />
  );
}

export default function App() {
  const { data, setData, reload, loading, error } = useData();
  const [session, setSession] = useState<boolean | null>(
    configured ? null : true,
  );
  const [sessionUserId, setSessionUserId] = useState<string | null>(
    configured ? null : "rafael",
  );
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).get("recovery") === "1",
  );
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await reload();
      setSessionUserId(data.session?.user.id || null);
      setSession(Boolean(data.session));
    });
    const { data: s } = supabase.auth.onAuthStateChange((event, x) => {
      setSession(Boolean(x));
      setSessionUserId(x?.user.id || null);
      if (x) void reload();
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => s.subscription.unsubscribe();
  }, [reload]);
  if (recovery) return <PasswordReset done={() => setRecovery(false)} />;
  if (session === false) return <Login />;
  if (session === null || loading)
    return <div className="loading">A preparar as vossas finanças…</div>;
  const currentMemberName =
    data.members.find((member) => member.user_id === sessionUserId)
      ?.display_name || (configured ? "Utilizador" : "Rafael");
  return (
    <Shell memberName={currentMemberName}>
      {!configured && (
        <div className="demo-banner">
          Modo demonstração — dados fictícios, sem persistência.
        </div>
      )}
      {error && (
        <div className="error">Não foi possível sincronizar: {error}</div>
      )}
      <Routes>
        <Route
          path="/"
          element={<Dashboard d={data} memberName={currentMemberName} />}
        />
        <Route
          path="/movimentos"
          element={<Movements d={data} setData={setData} reload={reload} />}
        />
        <Route path="/contas" element={<Accounts d={data} reload={reload} />} />
        <Route
          path="/acertos"
          element={
            <SettlementsPage
              members={data.members}
              accounts={data.accounts}
              movements={data.movements}
              reload={reload}
            />
          }
        />
        <Route path="/recorrentes" element={<Recurring d={data} />} />
        <Route
          path="/orcamentos"
          element={
            <BudgetsPage
              categories={data.categories}
              members={data.members}
              movements={data.movements}
            />
          }
        />
        <Route
          path="/objetivos"
          element={<GoalsPage members={data.members} />}
        />
        <Route
          path="/importar"
          element={
            <ImportPage
              accounts={data.accounts}
              categories={data.categories}
              members={data.members}
              reload={reload}
            />
          }
        />
        <Route
          path="/definicoes"
          element={<SettingsPage d={data} reload={reload} />}
        />
        <Route
          path="*"
          element={<Dashboard d={data} memberName={currentMemberName} />}
        />
      </Routes>
    </Shell>
  );
}
