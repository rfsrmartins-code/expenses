import { useState } from "react";
import { Upload, WalletCards } from "lucide-react";
import { supabase } from "../lib/supabase";
import { eur } from "../lib/money";
import {
  fingerprint,
  parseCsv,
  type CsvMapping,
  type ParsedRow,
} from "../lib/csv";
import type { Account, Category, Member, Scope } from "../types";
type ImportRow = ParsedRow & {
  categoryId: string;
  scope: Scope;
  ownerId: string | null;
};
export default function ImportPage({
  accounts,
  categories,
  members,
  reload,
}: {
  accounts: Account[];
  categories: Category[];
  members: Member[];
  reload: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState(accounts[0]?.id || "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState<CsvMapping>({
    date: "",
    description: "",
    amount: "",
    dateFormat: "dd/MM/yyyy",
  });
  const file = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10_000_000) return alert("O ficheiro excede 10 MB.");
    const t = await f.text();
    setText(t);
    setFileName(f.name);
    const first = t.split(/\r?\n/)[0];
    setHeaders(
      first
        .split(first.includes(";") ? ";" : ",")
        .map((x) => x.replaceAll('"', "").trim()),
    );
    setStep(3);
  };
  const preview = async () => {
    try {
      const parsed = parseCsv(text, mapping);
      const { data: existing, error } = await supabase
        .from("import_rows")
        .select("bank_identifier,fingerprint");
      if (error) console.warn(error.message);
      const defaultCat = categories.find((c) => c.kind === "expense")?.id || "";
      setRows(
        parsed.map((r) => ({
          ...r,
          categoryId: defaultCat,
          scope: "shared",
          ownerId: null,
          duplicate: existing?.some(
            (x) => r.bankId && x.bank_identifier === r.bankId,
          )
            ? "exact"
            : existing?.some((x) => x.fingerprint === fingerprint(account, r))
              ? "possible"
              : "none",
        })),
      );
      setStep(4);
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const confirmImport = async () => {
    const selected = rows.filter((r) => !r.excluded && r.duplicate !== "exact");
    if (!selected.length) return alert("Não existem linhas para importar.");
    setBusy(true);
    const payload = selected.map((r) => ({
      row_number: r.row,
      date: r.date,
      description: r.description,
      amount_cents: r.amountCents,
      category_id: r.categoryId || null,
      scope: r.amountCents < 0 ? r.scope : null,
      owner_id: r.amountCents < 0 && r.scope === "personal" ? r.ownerId : null,
      bank_identifier: r.bankId || null,
      fingerprint: fingerprint(account, r),
    }));
    const { error } = await supabase.rpc("import_movement_batch", {
      p_account: account,
      p_file_name: fileName,
      p_rows: payload,
    });
    setBusy(false);
    if (error) return alert(error.message);
    await reload();
    setStep(5);
  };
  return (
    <>
      <header className="page-head">
        <div>
          <p>ASSISTENTE CSV</p>
          <h1>Importar movimentos</h1>
        </div>
      </header>
      <ol className="steps">
        {[
          "Conta",
          "Ficheiro",
          "Mapeamento",
          "Pré-visualização",
          "Concluído",
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
              {accounts.map((a) => (
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
            <button
              className="primary"
              disabled={!account}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Escolhe o ficheiro do banco</h2>
            <label className="dropzone">
              <Upload />
              <b>Selecionar ficheiro CSV</b>
              <span>O original não será guardado · máximo 10 MB</span>
              <input type="file" accept=".csv,text/csv" onChange={file} />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Associa as colunas</h2>
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
              <Map
                label="Débito (alternativa)"
                value={mapping.debit || ""}
                headers={headers}
                onChange={(v) =>
                  setMapping({ ...mapping, amount: undefined, debit: v })
                }
              />
              <Map
                label="Crédito (alternativa)"
                value={mapping.credit || ""}
                headers={headers}
                onChange={(v) =>
                  setMapping({ ...mapping, amount: undefined, credit: v })
                }
              />
              <Map
                label="Identificador bancário"
                value={mapping.bankId || ""}
                headers={headers}
                onChange={(v) => setMapping({ ...mapping, bankId: v })}
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
                !mapping.date ||
                !mapping.description ||
                (!mapping.amount && !mapping.debit && !mapping.credit)
              }
              onClick={preview}
            >
              Pré-visualizar
            </button>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Rever antes de importar</h2>
            <p>
              Coincidências são assinaladas; só identificadores bancários iguais
              são excluídos automaticamente.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Incluir</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Categoria</th>
                    <th>Classificação</th>
                    <th>Duplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.row}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!r.excluded && r.duplicate !== "exact"}
                          disabled={r.duplicate === "exact"}
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
                      <td className="right">{eur(r.amountCents)}</td>
                      <td>
                        {r.amountCents < 0 ? (
                          <select
                            value={r.categoryId}
                            onChange={(e) =>
                              setRows((x) =>
                                x.map((v, j) =>
                                  j === i
                                    ? { ...v, categoryId: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          >
                            {categories
                              .filter((c) => c.kind === "expense")
                              .map((c) => (
                                <option value={c.id} key={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          "Rendimento"
                        )}
                      </td>
                      <td>
                        {r.amountCents < 0 ? (
                          <select
                            value={r.scope}
                            onChange={(e) =>
                              setRows((x) =>
                                x.map((v, j) =>
                                  j === i
                                    ? {
                                        ...v,
                                        scope: e.target.value as Scope,
                                        ownerId:
                                          e.target.value === "personal"
                                            ? members[0]?.id
                                            : null,
                                      }
                                    : v,
                                ),
                              )
                            }
                          >
                            <option value="shared">Partilhada</option>
                            <option value="personal">Pessoal</option>
                          </select>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className={`duplicate ${r.duplicate}`}>
                          {r.duplicate === "exact"
                            ? "Já importado"
                            : r.duplicate === "possible"
                              ? "Possível"
                              : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="primary" disabled={busy} onClick={confirmImport}>
              {busy
                ? "A importar…"
                : `Importar ${rows.filter((r) => !r.excluded && r.duplicate !== "exact").length} movimentos`}
            </button>
          </>
        )}
        {step === 5 && (
          <div className="success">
            <div>✓</div>
            <h2>Importação concluída</h2>
            <p>
              O lote foi guardado atomicamente. O ficheiro original não foi
              conservado.
            </p>
            <button
              className="primary"
              onClick={() => {
                setStep(1);
                setRows([]);
                setText("");
              }}
            >
              Importar outro ficheiro
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
        <option value="">Não utilizar</option>
        {headers.map((h) => (
          <option key={h}>{h}</option>
        ))}
      </select>
    </label>
  );
}
