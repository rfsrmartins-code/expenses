import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "../lib/supabase";
import { eur, parseMoney } from "../lib/money";
import type { Budget, Category, Member, Movement, Scope } from "../types";

export default function BudgetsPage({
  categories,
  members,
  movements,
}: {
  categories: Category[];
  members: Member[];
  movements: Movement[];
}) {
  const [items, setItems] = useState<Budget[]>([]);
  const [month, setMonth] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-01"),
  );
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("month", month);
    if (error) alert(error.message);
    else setItems(data as Budget[]);
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async (b: Budget) => {
    if (!confirm("Eliminar este orçamento mensal?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", b.id);
    if (error) alert(error.message);
    else await load();
  };
  const label = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  })
    .format(new Date(`${month}T12:00:00`))
    .toUpperCase();
  return (
    <>
      <header className="page-head">
        <div>
          <p>{label}</p>
          <h1>Orçamentos</h1>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus />
          Definir orçamento
        </button>
      </header>
      <div className="toolbar">
        <label>
          Mês{" "}
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(`${e.target.value}-01`)}
          />
        </label>
      </div>
      {items.length ? (
        <section className="budget-grid">
          {items.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            const used = movements
              .filter(
                (m) =>
                  m.type === "expense" &&
                  m.status === "confirmed" &&
                  m.category_id === b.category_id &&
                  m.movement_date.startsWith(month.slice(0, 7)) &&
                  m.scope === b.scope &&
                  (b.scope === "shared" || m.expense_owner_id === b.member_id),
              )
              .reduce((s, m) => s + m.amount_cents, 0);
            return (
              <article className="panel budget" key={b.id}>
                <div className="budget-actions">
                  <button
                    className="icon"
                    aria-label="Editar"
                    onClick={() => setEditing(b)}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="icon danger"
                    aria-label="Eliminar"
                    onClick={() => remove(b)}
                  >
                    <Trash2 />
                  </button>
                </div>
                <span style={{ background: cat?.color }} />
                <div>
                  <small>
                    {cat?.name.toUpperCase() || "CATEGORIA"} ·{" "}
                    {b.scope === "shared"
                      ? "PARTILHADO"
                      : members
                          .find((m) => m.id === b.member_id)
                          ?.display_name.toUpperCase()}
                  </small>
                  <strong>
                    {eur(used)} <em>de {eur(b.limit_cents)}</em>
                  </strong>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${Math.min(100, (used / b.limit_cents) * 100)}%`,
                      background: cat?.color,
                    }}
                  />
                </div>
                <p>
                  {eur(Math.max(0, b.limit_cents - used))} disponíveis ·{" "}
                  {Math.round((used / b.limit_cents) * 100)}% utilizado
                </p>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>Sem orçamentos neste mês</h2>
          <p>
            Define limites por categoria para despesas pessoais ou partilhadas.
          </p>
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus />
            Definir primeiro orçamento
          </button>
        </section>
      )}
      {editing !== undefined && (
        <BudgetModal
          budget={editing}
          month={month}
          categories={categories}
          members={members}
          close={() => setEditing(undefined)}
          reload={load}
        />
      )}
    </>
  );
}

function BudgetModal({
  budget,
  month,
  categories,
  members,
  close,
  reload,
}: {
  budget: Budget | null;
  month: string;
  categories: Category[];
  members: Member[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>(budget?.scope || "shared");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const row = {
      household_id: members[0]?.household_id,
      month,
      category_id: String(fd.get("category")),
      scope,
      member_id: scope === "personal" ? String(fd.get("member")) : null,
      limit_cents: parseMoney(String(fd.get("limit"))),
    };
    const result = budget
      ? await supabase.from("budgets").update(row).eq("id", budget.id)
      : await supabase.from("budgets").insert(row);
    if (result.error) {
      alert(result.error.message);
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
        <div className="eyebrow">LIMITE MENSAL</div>
        <h2>{budget ? "Editar orçamento" : "Definir orçamento"}</h2>
        <div className="form-grid">
          <label>
            Categoria
            <select name="category" defaultValue={budget?.category_id} required>
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Limite
            <input
              name="limit"
              inputMode="decimal"
              defaultValue={
                budget
                  ? (budget.limit_cents / 100).toFixed(2).replace(".", ",")
                  : ""
              }
              required
            />
          </label>
          <label>
            Âmbito
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              <option value="shared">Partilhado</option>
              <option value="personal">Pessoal</option>
            </select>
          </label>
          {scope === "personal" && (
            <label>
              Pessoa
              <select
                name="member"
                defaultValue={budget?.member_id || members[0]?.id}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "A guardar…" : "Guardar orçamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
