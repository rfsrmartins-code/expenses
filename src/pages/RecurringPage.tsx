import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Ban,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import { eur, parseMoney } from "../lib/money";
import type {
  Account,
  Category,
  Member,
  Occurrence,
  Recurrence,
  Scope,
} from "../types";

type Tab = "planned" | "overdue" | "paid";
type Period = "month" | "30days" | "all";
export default function RecurringPage({
  accounts,
  categories,
  members,
}: {
  accounts: Account[];
  categories: Category[];
  members: Member[];
}) {
  const [rules, setRules] = useState<Recurrence[]>([]);
  const [items, setItems] = useState<Occurrence[]>([]);
  const [tab, setTab] = useState<Tab>("planned");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurrence | null>(null);
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const through = format(addMonths(new Date(), 2), "yyyy-MM-dd");
    const generated = await supabase.rpc("generate_recurrences", {
      p_through: through,
    });
    if (generated.error) setError(generated.error.message);
    const [r, o] = await Promise.all([
      supabase
        .from("recurrences")
        .select("*")
        .eq("active", true)
        .order("description"),
      supabase.from("recurrence_occurrences").select("*").order("due_date"),
    ]);
    if (r.error || o.error)
      setError((r.error || o.error)?.message || "Erro ao carregar");
    else {
      setRules(r.data as Recurrence[]);
      setItems(o.data as Occurrence[]);
    }
    setBusy(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const next30 = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const visible = items.filter((x) => {
    const inTab =
      tab === "paid"
        ? x.status === "paid"
        : tab === "overdue"
          ? x.status === "planned" && x.due_date < today
          : x.status === "planned" && x.due_date >= today;
    const inPeriod =
      period === "all" ||
      (period === "month"
        ? x.due_date >= monthStart && x.due_date <= monthEnd
        : x.due_date >= today && x.due_date <= next30);
    return inTab && inPeriod;
  });
  const groups = visible.reduce<
    { key: string; label: string; total: number; items: Occurrence[] }[]
  >((result, occurrence) => {
    const key = occurrence.due_date.slice(0, 7);
    let group = result.find((item) => item.key === key);
    if (!group) {
      const label = format(parseISO(`${key}-01`), "MMMM yyyy", { locale: pt });
      group = {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        total: 0,
        items: [],
      };
      result.push(group);
    }
    group.total += occurrence.estimated_cents;
    group.items.push(occurrence);
    return result;
  }, []);
  const skip = async (id: string) => {
    if (
      !confirm("Ignorar esta ocorrência? Não será criado qualquer movimento.")
    )
      return;
    const { error } = await supabase.rpc("skip_recurrence_occurrence", {
      p_occurrence: id,
    });
    if (error) alert(error.message);
    else await load();
  };
  const skipAllOverdue = async () => {
    if (
      !confirm(
        "Ignorar todas as ocorrências vencidas? Nenhuma delas afetará os saldos.",
      )
    )
      return;
    const { error } = await supabase.rpc("skip_overdue_recurrence_occurrences");
    if (error) alert(error.message);
    else await load();
  };
  const undoPayment = async (occurrence: Occurrence) => {
    if (
      !occurrence.movement_id ||
      !confirm(
        "Anular este pagamento? O movimento será eliminado e a ocorrência voltará a ficar prevista.",
      )
    )
      return;
    const { error } = await supabase.rpc("delete_movement", {
      p_movement: occurrence.movement_id,
    });
    if (error) alert(error.message);
    else await load();
  };
  const remove = async (id: string) => {
    if (
      !confirm(
        "Desativar esta recorrência? Os pagamentos históricos serão preservados.",
      )
    )
      return;
    const { error } = await supabase
      .from("recurrences")
      .update({ active: false })
      .eq("id", id);
    if (error) alert(error.message);
    else await load();
  };
  return (
    <>
      <header className="page-head">
        <div>
          <p>PREVISÃO E CONTROLO</p>
          <h1>Contas recorrentes</h1>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus />
          Nova recorrência
        </button>
      </header>
      {error && (
        <div className="error">Não foi possível sincronizar: {error}</div>
      )}
      <section className="panel">
        <div className="tabs">
          <button
            className={tab === "planned" ? "active" : ""}
            onClick={() => {
              setTab("planned");
              setPeriod("month");
            }}
          >
            Previstas{" "}
            <b>
              {
                items.filter(
                  (x) => x.status === "planned" && x.due_date >= today,
                ).length
              }
            </b>
          </button>
          <button
            className={tab === "overdue" ? "active" : ""}
            onClick={() => {
              setTab("overdue");
              setPeriod("all");
            }}
          >
            Vencidas{" "}
            <b>
              {
                items.filter(
                  (x) => x.status === "planned" && x.due_date < today,
                ).length
              }
            </b>
          </button>
          <button
            className={tab === "paid" ? "active" : ""}
            onClick={() => {
              setTab("paid");
              setPeriod("month");
            }}
          >
            Pagas <b>{items.filter((x) => x.status === "paid").length}</b>
          </button>
        </div>
        <div className="recurrence-filters">
          <div className="period-switch" aria-label="Filtrar por período">
            <button
              className={period === "month" ? "active" : ""}
              onClick={() => setPeriod("month")}
            >
              Este mês
            </button>
            <button
              className={period === "30days" ? "active" : ""}
              onClick={() => setPeriod("30days")}
            >
              Próximos 30 dias
            </button>
            <button
              className={period === "all" ? "active" : ""}
              onClick={() => setPeriod("all")}
            >
              Todos
            </button>
          </div>
          {tab === "overdue" &&
            items.some(
              (item) => item.status === "planned" && item.due_date < today,
            ) && (
              <button className="link danger" onClick={skipAllOverdue}>
                <Ban /> Ignorar todas as vencidas
              </button>
            )}
        </div>
        {busy ? (
          <p className="empty">A carregar…</p>
        ) : visible.length ? (
          groups.map((group) => (
            <div className="recurrence-month" key={group.key}>
              <div className="recurrence-month-head">
                <h3>{group.label}</h3>
                <span>{eur(group.total)}</span>
              </div>
              {group.items.map((o) => {
                const r = rules.find((x) => x.id === o.recurrence_id);
                const category = categories.find(
                  (c) => c.id === r?.category_id,
                );
                return (
                  <div className="recurring" key={o.id}>
                    <div className="rec-icon">
                      <CalendarClock />
                    </div>
                    <span>
                      <b>{r?.description || "Recorrência arquivada"}</b>
                      <small>
                        {accounts.find((a) => a.id === r?.account_id)?.name ||
                          "Conta"}
                        {category ? ` · ${category.name}` : ""} ·{" "}
                        {r?.scope === "shared" ? "Partilhada" : "Pessoal"}
                      </small>
                    </span>
                    <time>{o.due_date.split("-").reverse().join("/")}</time>
                    <strong>{eur(o.estimated_cents)}</strong>
                    {o.status === "planned" ? (
                      <div className="recurrence-actions">
                        {tab === "overdue" && (
                          <button
                            className="icon"
                            aria-label="Ignorar esta ocorrência"
                            title="Ignorar esta ocorrência"
                            onClick={() => skip(o.id)}
                          >
                            <Ban />
                          </button>
                        )}
                        <button
                          className="secondary"
                          onClick={() => setPaying(o)}
                        >
                          <Check />
                          Confirmar
                        </button>
                      </div>
                    ) : (
                      <div className="recurrence-actions paid-actions">
                        <span className="paid-label">
                          <Check />
                          Pago
                        </span>
                        <button
                          className="secondary danger"
                          onClick={() => undoPayment(o)}
                        >
                          Anular pagamento
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <p className="empty">Sem ocorrências nesta secção.</p>
        )}
      </section>
      <section className="panel rules">
        <div className="panel-title">
          <div>
            <small>CONFIGURAÇÃO</small>
            <h2>Regras ativas</h2>
          </div>
        </div>
        {rules.length ? (
          rules.map((r) => (
            <div className="category" key={r.id}>
              <i
                style={{
                  background:
                    categories.find((c) => c.id === r.category_id)?.color ||
                    "#5b8c85",
                }}
              />
              <b>{r.description}</b>
              <span>
                {r.frequency === "monthly"
                  ? "Mensal"
                  : r.frequency === "quarterly"
                    ? "Trimestral"
                    : r.frequency === "semiannual"
                      ? "Semestral"
                      : "Anual"}{" "}
                · dia {r.due_day} · {eur(r.estimated_cents)}
              </span>
              <button
                className="icon"
                aria-label="Editar recorrência"
                onClick={() => setEditing(r)}
              >
                <Pencil />
              </button>
              <button
                className="icon danger"
                aria-label="Desativar"
                onClick={() => remove(r.id)}
              >
                <Trash2 />
              </button>
            </div>
          ))
        ) : (
          <p className="empty">Ainda não existem regras recorrentes.</p>
        )}
      </section>
      {open && (
        <RuleModal
          rule={null}
          accounts={accounts}
          categories={categories}
          members={members}
          close={() => setOpen(false)}
          reload={load}
        />
      )}{" "}
      {editing && (
        <RuleModal
          rule={editing}
          accounts={accounts}
          categories={categories}
          members={members}
          close={() => setEditing(null)}
          reload={load}
        />
      )}{" "}
      {paying && (
        <PaymentModal
          occurrence={paying}
          rule={rules.find((x) => x.id === paying.recurrence_id)!}
          accounts={accounts}
          close={() => setPaying(null)}
          reload={load}
        />
      )}
    </>
  );
}

function RuleModal({
  rule,
  accounts,
  categories,
  members,
  close,
  reload,
}: {
  rule: Recurrence | null;
  accounts: Account[];
  categories: Category[];
  members: Member[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>(rule?.scope || "shared");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const row = {
      household_id: members[0]?.household_id,
      description: String(fd.get("description")).trim(),
      category_id: String(fd.get("category")) || null,
      account_id: String(fd.get("account")),
      estimated_cents: parseMoney(String(fd.get("amount"))),
      frequency: String(fd.get("frequency")),
      due_day: Number(fd.get("dueDay")),
      start_date: String(fd.get("start")),
      end_date: String(fd.get("end")) || null,
      scope,
      expense_owner_id: scope === "personal" ? String(fd.get("owner")) : null,
      active: true,
    };
    const result = rule
      ? await supabase.rpc("update_recurrence", {
          p_recurrence: rule.id,
          p_description: row.description,
          p_category: row.category_id,
          p_account: row.account_id,
          p_estimated: row.estimated_cents,
          p_frequency: row.frequency,
          p_due_day: row.due_day,
          p_start: row.start_date,
          p_end: row.end_date,
          p_scope: row.scope,
          p_owner: row.expense_owner_id,
        })
      : await supabase.from("recurrences").insert(row);
    const { error } = result;
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
        <div className="eyebrow">PLANEAMENTO</div>
        <h2>{rule ? "Editar recorrência" : "Nova recorrência"}</h2>
        <div className="form-grid">
          <label className="wide">
            Descrição
            <input
              name="description"
              defaultValue={rule?.description}
              required
              autoFocus
            />
          </label>
          <label>
            Valor estimado
            <input
              name="amount"
              defaultValue={
                rule
                  ? (rule.estimated_cents / 100).toFixed(2).replace(".", ",")
                  : ""
              }
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Categoria
            <select name="category" defaultValue={rule?.category_id || ""}>
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Conta habitual
            <select
              name="account"
              defaultValue={rule?.account_id || ""}
              required
            >
              <option value="">Escolher…</option>
              {accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Periodicidade
            <select
              name="frequency"
              defaultValue={rule?.frequency || "monthly"}
            >
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="semiannual">Semestral (de 6 em 6 meses)</option>
              <option value="yearly">Anual</option>
            </select>
          </label>
          <label>
            Dia de vencimento
            <input
              name="dueDay"
              type="number"
              min="1"
              max="31"
              defaultValue={rule?.due_day || 1}
              required
            />
          </label>
          <label>
            Classificação
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              <option value="shared">Partilhada</option>
              <option value="personal">Pessoal</option>
            </select>
          </label>
          {scope === "personal" && (
            <label>
              Titular
              <select name="owner" defaultValue={rule?.expense_owner_id || ""}>
                {members.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Data inicial
            <input
              name="start"
              type="date"
              defaultValue={
                rule?.start_date ||
                format(startOfMonth(new Date()), "yyyy-MM-dd")
              }
              required
            />
          </label>
          <label>
            Data final (opcional)
            <input name="end" type="date" defaultValue={rule?.end_date || ""} />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || !accounts.length}>
            {busy
              ? "A guardar…"
              : rule
                ? "Guardar alterações"
                : "Criar recorrência"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentModal({
  occurrence,
  rule,
  accounts,
  close,
  reload,
}: {
  occurrence: Occurrence;
  rule: Recurrence;
  accounts: Account[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.rpc("confirm_occurrence", {
      p_occurrence: occurrence.id,
      p_amount: parseMoney(String(fd.get("amount"))),
      p_date: String(fd.get("date")),
      p_account: String(fd.get("account")),
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
        <div className="eyebrow">CONFIRMAR PAGAMENTO</div>
        <h2>{rule.description}</h2>
        <p className="muted">
          A ocorrência prevista só afeta o saldo depois desta confirmação.
        </p>
        <div className="form-grid">
          <label>
            Valor real
            <input
              name="amount"
              defaultValue={(occurrence.estimated_cents / 100)
                .toFixed(2)
                .replace(".", ",")}
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Data efetiva
            <input
              name="date"
              type="date"
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </label>
          <label className="wide">
            Conta utilizada
            <select name="account" defaultValue={rule.account_id} required>
              {accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "A confirmar…" : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
