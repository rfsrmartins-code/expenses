import { describe, expect, it } from "vitest";
import { accountBalance, reportTotals, settlement, splitEqual } from "./money";
import { fingerprint, parseCsv } from "./csv";
import { occurrenceKeys } from "./recurrence";
import type { Movement, Recurrence } from "../types";
const movement = (x: Partial<Movement>): Movement => ({
  id: crypto.randomUUID(),
  description: "x",
  amount_cents: 100,
  movement_date: "2026-10-01",
  type: "expense",
  scope: "shared",
  account_id: "joint",
  category_id: null,
  expense_owner_id: null,
  paid_by_member_id: null,
  notes: null,
  transfer_id: null,
  status: "confirmed",
  created_at: "",
  created_by: "r",
  ...x,
});
describe("contabilidade exata", () => {
  it("divide cêntimos ímpares de forma determinística", () => {
    expect(splitEqual(101)).toEqual([51, 50]);
    expect(splitEqual(101).reduce((a, b) => a + b)).toBe(101);
  });
  it("ignora transferências nos relatórios e saldos iniciais nos rendimentos", () => {
    const ms = [
      movement({ type: "transfer", amount_cents: 120000, scope: null }),
      movement({ type: "income", amount_cents: 200000, scope: null }),
      movement({ type: "expense", amount_cents: 100000 }),
    ];
    expect(reportTotals(ms)).toEqual({ income: 200000, expense: 100000 });
    expect(accountBalance({ opening_balance_cents: 50000 }, ms)).toBe(150000);
  });
  it("não cria dívida no exemplo obrigatório", () => {
    const ms = [
      movement({ amount_cents: 90000 }),
      movement({ amount_cents: 10000 }),
    ];
    expect(settlement(["r", "n"], ms)).toEqual([
      { memberId: "r", paid: 0, owed: 50000, net: -50000 },
      { memberId: "n", paid: 0, owed: 50000, net: -50000 },
    ]);
    expect(
      reportTotals([
        movement({ type: "transfer", amount_cents: 60000, scope: null }),
        movement({ type: "transfer", amount_cents: 60000, scope: null }),
        ...ms,
      ]).expense,
    ).toBe(100000);
  });
  it("separa despesa pessoal da partilhada", () => {
    const ms = [
      movement({
        scope: "personal",
        expense_owner_id: "r",
        paid_by_member_id: "r",
        amount_cents: 999,
      }),
      movement({ scope: "shared", paid_by_member_id: "r", amount_cents: 1001 }),
    ];
    const r = settlement(["r", "n"], ms);
    expect(r[0].owed).toBe(1500);
    expect(r[1].owed).toBe(500);
    expect(r[0].paid).toBe(1001);
  });
});
describe("recorrências", () => {
  const rule: Recurrence = {
    id: "rent",
    description: "Renda",
    estimated_cents: 90000,
    frequency: "monthly",
    due_day: 1,
    start_date: "2026-01-01",
    end_date: null,
    scope: "shared",
    account_id: "j",
    category_id: null,
    expense_owner_id: null,
    active: true,
  };
  it("gera chaves únicas e recupera meses em falta", () => {
    const keys = occurrenceKeys(rule, "2026-03-20");
    expect(keys).toEqual([
      "rent:2026-01-01",
      "rent:2026-02-01",
      "rent:2026-03-01",
    ]);
    expect(new Set([...keys, ...keys]).size).toBe(3);
  });
});
describe("CSV", () => {
  it("lê ponto e vírgula, aspas, data PT e vírgula decimal", () => {
    const rows = parseCsv(
      'Data;Descrição;Montante\n22/10/2026;"Café, almoço";-12,34',
      {
        date: "Data",
        description: "Descrição",
        amount: "Montante",
        dateFormat: "dd/MM/yyyy",
      },
    );
    expect(rows[0]).toMatchObject({
      date: "2026-10-22",
      description: "Café, almoço",
      amountCents: -1234,
    });
  });
  it("deteta por impressão mas não elimina coincidências", () => {
    const row = {
      date: "2026-10-22",
      description: "  Café  Central ",
      amountCents: -250,
    };
    expect(fingerprint("a", row)).toBe(
      fingerprint("a", { ...row, description: "café central" }),
    );
  });
});
