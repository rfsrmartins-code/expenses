import type { Movement } from "../types";
export const eur = (cents: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const parseMoney = (value: string) => {
  const clean = value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Indica um valor superior a zero.");
  }
  return Math.round(n * 100);
};
export const splitEqual = (cents: number): [number, number] => [
  Math.ceil(cents / 2),
  Math.floor(cents / 2),
];
export const accountBalance = (
  account: { opening_balance_cents: number },
  movements: Movement[],
) =>
  account.opening_balance_cents +
  movements
    .filter((m) => m.status === "confirmed")
    .reduce(
      (s, m) =>
        s +
        (m.type === "income"
          ? m.amount_cents
          : m.type === "expense"
            ? -m.amount_cents
            : m.transfer_direction === "in"
              ? m.amount_cents
              : m.transfer_direction === "out"
                ? -m.amount_cents
                : 0),
      0,
    );
export const reportTotals = (movements: Movement[]) =>
  movements
    .filter((m) => m.status === "confirmed")
    .reduce(
      (a, m) => {
        if (m.type === "income") a.income += m.amount_cents;
        if (m.type === "expense") a.expense += m.amount_cents;
        return a;
      },
      { income: 0, expense: 0 },
    );
export const settlement = (
  members: [string, string],
  movements: Movement[],
) => {
  const paid = Object.fromEntries(members.map((id) => [id, 0]));
  const owed = Object.fromEntries(members.map((id) => [id, 0]));
  for (const m of movements.filter(
    (x) => x.type === "expense" && x.status === "confirmed",
  )) {
    if (m.scope === "shared") {
      const [a, b] = splitEqual(m.amount_cents);
      owed[members[0]] += a;
      owed[members[1]] += b;
      if (m.paid_by_member_id) paid[m.paid_by_member_id] += m.amount_cents;
    } else if (m.expense_owner_id) owed[m.expense_owner_id] += m.amount_cents;
  }
  return members.map((id) => ({
    memberId: id,
    paid: paid[id],
    owed: owed[id],
    net: paid[id] - owed[id],
  }));
};
