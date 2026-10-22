import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Category, Member } from "../types";
export default function SettingsPage({
  members,
  categories,
  reload,
}: {
  members: Member[];
  categories: Category[];
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Category | null | undefined>(
    undefined,
  );
  const [member, setMember] = useState<Member | null>(null);
  const archive = async (c: Category) => {
    if (
      !confirm(
        `Arquivar a categoria “${c.name}”? Os movimentos existentes mantêm a categoria.`,
      )
    )
      return;
    const { error } = await supabase
      .from("categories")
      .update({ archived: true })
      .eq("id", c.id);
    if (error) alert(error.message);
    else await reload();
  };
  return (
    <>
      <header className="page-head">
        <div>
          <p>AGREGADO E PERSONALIZAÇÃO</p>
          <h1>Definições</h1>
        </div>
      </header>
      <section className="grid-2">
        <article className="panel">
          <h2>Membros do agregado</h2>
          {members.map((m) => (
            <div className="member" key={m.id}>
              <div>{m.display_name[0]}</div>
              <b>{m.display_name}</b>
              <span>Membro autorizado</span>
              <button
                className="icon"
                aria-label="Editar nome"
                onClick={() => setMember(m)}
              >
                <Pencil />
              </button>
            </div>
          ))}
          <p className="muted">
            O nome pode ser alterado; a associação ao agregado continua
            protegida.
          </p>
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Categorias</h2>
            <button
              className="primary compact"
              onClick={() => setEditing(null)}
            >
              <Plus />
              Nova
            </button>
          </div>
          {categories.map((c) => (
            <div className="category" key={c.id}>
              <i style={{ background: c.color }} />
              <b>{c.name}</b>
              <span>{c.kind === "expense" ? "Despesa" : "Rendimento"}</span>
              <div className="row-actions">
                <button
                  className="icon"
                  aria-label="Editar"
                  onClick={() => setEditing(c)}
                >
                  <Pencil />
                </button>
                <button
                  className="icon danger"
                  aria-label="Arquivar"
                  onClick={() => archive(c)}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </article>
      </section>
      {editing !== undefined && (
        <CategoryModal
          category={editing}
          members={members}
          close={() => setEditing(undefined)}
          reload={reload}
        />
      )}{" "}
      {member && (
        <MemberModal
          member={member}
          close={() => setMember(null)}
          reload={reload}
        />
      )}
    </>
  );
}
function CategoryModal({
  category,
  members,
  close,
  reload,
}: {
  category: Category | null;
  members: Member[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const row = {
      household_id: members[0]?.household_id,
      name: String(fd.get("name")).trim(),
      kind: String(fd.get("kind")),
      color: String(fd.get("color")),
    };
    const result = category
      ? await supabase.from("categories").update(row).eq("id", category.id)
      : await supabase.from("categories").insert(row);
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
        <h2>{category ? "Editar categoria" : "Nova categoria"}</h2>
        <div className="form-grid">
          <label className="wide">
            Nome
            <input name="name" defaultValue={category?.name} required />
          </label>
          <label>
            Tipo
            <select name="kind" defaultValue={category?.kind || "expense"}>
              <option value="expense">Despesa</option>
              <option value="income">Rendimento</option>
            </select>
          </label>
          <label>
            Cor
            <input
              name="color"
              type="color"
              defaultValue={category?.color || "#5b8c85"}
            />
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
function MemberModal({
  member,
  close,
  reload,
}: {
  member: Member;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.rpc("rename_household_member", {
      p_member: member.id,
      p_display_name: String(fd.get("name")).trim(),
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
        <div className="eyebrow">MEMBRO DO AGREGADO</div>
        <h2>Alterar nome</h2>
        <label>
          Nome apresentado
          <input
            name="name"
            defaultValue={member.display_name}
            minLength={1}
            maxLength={80}
            required
            autoFocus
          />
        </label>
        <div className="actions modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "A guardar…" : "Guardar nome"}
          </button>
        </div>
      </form>
    </div>
  );
}
