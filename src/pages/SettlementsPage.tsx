import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { eur, parseMoney, settlement } from "../lib/money";
import type { Account, ExpenseSplit, Member, Movement } from "../types";
type Transfer = {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount_cents: number;
  transfer_date: string;
  purpose: "normal" | "contribution" | "settlement";
};
export default function SettlementsPage({
  members,
  accounts,
  movements,
  expenseSplits,
  reload,
}: {
  members: Member[];
  accounts: Account[];
  movements: Movement[];
  expenseSplits: ExpenseSplit[];
  reload: () => Promise<void>;
}) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("transfers")
      .select("*")
      .order("transfer_date", { ascending: false });
    if (error) alert(error.message);
    else setTransfers(data as Transfer[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const stats = useMemo(() => {
    const memberIds = members.slice(0, 2).map((member) => member.id) as [
      string,
      string,
    ];
    const ledger =
      memberIds.length === 2
        ? settlement(
            memberIds,
            movements.filter((movement) => movement.paid_by_member_id),
            expenseSplits,
          )
        : [];
    return members.map((member) => {
      const owned = accounts
        .filter((a) => a.owner_member_id === member.id)
        .map((a) => a.id);
      const contributions = transfers
        .filter(
          (t) =>
            t.purpose === "contribution" && owned.includes(t.source_account_id),
        )
        .reduce((s, t) => s + t.amount_cents, 0);
      const ownLedger = ledger.find((item) => item.memberId === member.id);
      let settlements = 0;
      for (const t of transfers.filter((t) => t.purpose === "settlement")) {
        if (owned.includes(t.destination_account_id))
          settlements += t.amount_cents;
        if (owned.includes(t.source_account_id)) settlements -= t.amount_cents;
      }
      return {
        member,
        contributions,
        paid: ownLedger?.paid || 0,
        share: ownLedger?.owed || 0,
        settlements,
        net: (ownLedger?.net || 0) - settlements,
      };
    });
  }, [members, accounts, movements, expenseSplits, transfers]);
  const jointBalance = accounts
    .filter((a) => a.owner_kind === "joint")
    .reduce(
      (sum, a) =>
        sum +
        a.opening_balance_cents +
        movements
          .filter((m) => m.account_id === a.id && m.status === "confirmed")
          .reduce(
            (s, m) =>
              s +
              (m.type === "income" || m.transfer_direction === "in"
                ? m.amount_cents
                : m.type === "expense" || m.transfer_direction === "out"
                  ? -m.amount_cents
                  : 0),
            0,
          ),
      0,
    );
  return (
    <>
      <header className="page-head">
        <div>
          <p>QUEM PAGOU E QUANTO FALTA ACERTAR</p>
          <h1>Contribuições e acertos</h1>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <ArrowLeftRight />
          Registar acerto
        </button>
      </header>
      <section className="settlement-summary">
        <article className="panel">
          <small>SALDO NA CONTA CONJUNTA</small>
          <strong>{eur(jointBalance)}</strong>
          <p>
            Dinheiro disponível; não representa uma dívida entre os membros.
          </p>
        </article>
        <article className="panel">
          <small>DESPESAS PARTILHADAS</small>
          <strong>
            {eur(
              movements
                .filter((m) => m.type === "expense" && m.scope === "shared")
                .reduce((s, m) => s + m.amount_cents, 0),
            )}
          </strong>
          <p>O total da casa não muda quando fazem um acerto.</p>
        </article>
      </section>
      <section className="member-ledger">
        {stats.map((s) => (
          <article className="panel" key={s.member.id}>
            <div className="ledger-head">
              <div className="avatar">{s.member.display_name[0]}</div>
              <h2>{s.member.display_name}</h2>
            </div>
            <dl>
              <div>
                <dt>Contribuições para a conta conjunta</dt>
                <dd>{eur(s.contributions)}</dd>
              </div>
              <div>
                <dt>Pago diretamente por {s.member.display_name}</dt>
                <dd>{eur(s.paid)}</dd>
              </div>
              <div>
                <dt>Parte que lhe cabia</dt>
                <dd>{eur(s.share)}</dd>
              </div>
              <div>
                <dt>Acertos líquidos já recebidos</dt>
                <dd>{eur(s.settlements)}</dd>
              </div>
              <div className="ledger-total">
                <dt>
                  {s.net > 0
                    ? "Tem a receber"
                    : s.net < 0
                      ? "Tem a pagar"
                      : "Tudo acertado"}
                </dt>
                <dd>{eur(Math.abs(s.net))}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
      <section className="panel explainer">
        <h2>Regra contabilística</h2>
        <p>
          Contribuições para a conta conjunta ficam separadas das dívidas.
          Apenas despesas partilhadas pagas diretamente por uma pessoa geram um
          adiantamento a recuperar. Um acerto movimenta dinheiro entre contas
          pessoais sem voltar a contar como despesa ou rendimento.
        </p>
      </section>
      {open && (
        <SettlementModal
          members={members}
          accounts={accounts}
          close={() => setOpen(false)}
          reload={async () => {
            await Promise.all([load(), reload()]);
          }}
        />
      )}
    </>
  );
}
function SettlementModal({
  members,
  accounts,
  close,
  reload,
}: {
  members: Member[];
  accounts: Account[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const personal = accounts.filter((a) => a.owner_kind === "member");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const source = String(fd.get("source")),
      destination = String(fd.get("destination"));
    if (source === destination) return alert("Escolhe contas diferentes.");
    setBusy(true);
    const { error } = await supabase.rpc("create_member_settlement", {
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
        <div className="eyebrow">ACERTO ENTRE MEMBROS</div>
        <h2>Registar transferência</h2>
        <div className="form-grid">
          <label>
            Quem paga / conta de origem
            <select name="source" required>
              <option value="">Escolher…</option>
              {personal.map((a) => (
                <option value={a.id} key={a.id}>
                  {
                    members.find((m) => m.id === a.owner_member_id)
                      ?.display_name
                  }{" "}
                  · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quem recebe / conta de destino
            <select name="destination" required>
              <option value="">Escolher…</option>
              {personal.map((a) => (
                <option value={a.id} key={a.id}>
                  {
                    members.find((m) => m.id === a.owner_member_id)
                      ?.display_name
                  }{" "}
                  · {a.name}
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
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </label>
          <label className="wide">
            Descrição
            <input
              name="description"
              defaultValue="Acerto entre membros"
              required
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || personal.length < 2}>
            {busy ? "A guardar…" : "Guardar acerto"}
          </button>
        </div>
      </form>
    </div>
  );
}
