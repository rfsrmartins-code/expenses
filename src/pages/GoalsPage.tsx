import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Goal, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { eur, parseMoney } from "../lib/money";
import type { Goal as GoalType, Member } from "../types";
type Entry = {
  id: string;
  goal_id: string;
  amount_cents: number;
  entry_date: string;
  notes: string | null;
};
export default function GoalsPage({ members }: { members: Member[] }) {
  const [goals, setGoals] = useState<GoalType[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [entryGoal, setEntryGoal] = useState<GoalType | null>(null);
  const load = useCallback(async () => {
    const [g, e] = await Promise.all([
      supabase
        .from("savings_goals")
        .select("*")
        .eq("archived", false)
        .order("created_at"),
      supabase.from("goal_entries").select("*").order("entry_date"),
    ]);
    if (g.error || e.error) alert((g.error || e.error)?.message);
    else {
      setGoals(
        (g.data as Omit<GoalType, "reserved_cents">[]).map((x) => ({
          ...x,
          reserved_cents: 0,
        })),
      );
      setEntries(e.data as Entry[]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="page-head">
        <div>
          <p>PLANEAR O FUTURO</p>
          <h1>Objetivos de poupança</h1>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus />
          Novo objetivo
        </button>
      </header>
      {goals.length ? (
        <section className="goal-grid">
          {goals.map((g) => {
            const saved = entries
              .filter((e) => e.goal_id === g.id)
              .reduce((s, e) => s + e.amount_cents, 0);
            const pct = Math.max(
              0,
              Math.min(100, Math.round((saved / g.target_cents) * 100)),
            );
            return (
              <article className="panel goal-item" key={g.id}>
                <div className="goal-icon">
                  <Goal />
                </div>
                <small>OBJETIVO</small>
                <h2>{g.name}</h2>
                <p>
                  {g.target_date
                    ? `Meta: ${g.target_date.split("-").reverse().join("/")}`
                    : "Sem data-alvo"}
                </p>
                <strong>
                  {eur(saved)} <em>de {eur(g.target_cents)}</em>
                </strong>
                <div className="progress">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <footer>
                  <span>{pct}% concluído</span>
                  <button className="secondary" onClick={() => setEntryGoal(g)}>
                    <Plus />
                    Movimento
                  </button>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel empty-state">
          <Goal />
          <h2>Sem objetivos</h2>
          <p>Cria um objetivo e regista reservas ou levantamentos.</p>
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus />
            Criar objetivo
          </button>
        </section>
      )}
      <section className="panel explainer">
        <h2>Dinheiro reservado</h2>
        <p>
          Estas entradas são reservas contabilísticas e não são despesas. Cada
          contribuição pertence a um único objetivo.
        </p>
      </section>
      {open && (
        <GoalModal
          members={members}
          close={() => setOpen(false)}
          reload={load}
        />
      )}{" "}
      {entryGoal && (
        <EntryModal
          goal={entryGoal}
          members={members}
          close={() => setEntryGoal(null)}
          reload={load}
        />
      )}
    </>
  );
}
function GoalModal({
  members,
  close,
  reload,
}: {
  members: Member[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("savings_goals")
      .insert({
        household_id: members[0]?.household_id,
        name: String(fd.get("name")).trim(),
        target_cents: parseMoney(String(fd.get("target"))),
        target_date: String(fd.get("date")) || null,
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
        <div className="eyebrow">NOVO OBJETIVO</div>
        <h2>O que querem alcançar?</h2>
        <div className="form-grid">
          <label className="wide">
            Nome
            <input name="name" required autoFocus />
          </label>
          <label>
            Valor pretendido
            <input name="target" inputMode="decimal" required />
          </label>
          <label>
            Data-alvo (opcional)
            <input name="date" type="date" />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            Criar objetivo
          </button>
        </div>
      </form>
    </div>
  );
}
function EntryModal({
  goal,
  members,
  close,
  reload,
}: {
  goal: GoalType;
  members: Member[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let cents = parseMoney(String(fd.get("amount")));
    if (kind === "withdrawal") cents = -cents;
    const { error } = await supabase
      .from("goal_entries")
      .insert({
        household_id: members[0]?.household_id,
        goal_id: goal.id,
        amount_cents: cents,
        entry_date: String(fd.get("date")),
        notes: String(fd.get("notes")).trim() || null,
        created_by: user?.id,
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
        <div className="eyebrow">{goal.name.toUpperCase()}</div>
        <h2>Registar reserva</h2>
        <div className="choice-row">
          <button
            type="button"
            className={kind === "deposit" ? "selected" : ""}
            onClick={() => setKind("deposit")}
          >
            <ArrowDownRight />
            Contribuição
          </button>
          <button
            type="button"
            className={kind === "withdrawal" ? "selected" : ""}
            onClick={() => setKind("withdrawal")}
          >
            <ArrowUpRight />
            Levantamento
          </button>
        </div>
        <div className="form-grid">
          <label>
            Valor
            <input name="amount" inputMode="decimal" required />
          </label>
          <label>
            Data
            <input
              name="date"
              type="date"
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </label>
          <label className="wide">
            Notas
            <input name="notes" />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
