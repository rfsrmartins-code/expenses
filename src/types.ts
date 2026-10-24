export type OwnerKind = "member" | "joint";
export type MovementType = "income" | "expense" | "transfer" | "settlement";
export type Scope = "personal" | "shared";
export interface Member {
  id: string;
  user_id: string;
  display_name: string;
  household_id: string;
}
export interface Account {
  id: string;
  name: string;
  owner_kind: OwnerKind;
  owner_member_id: string | null;
  opening_balance_cents: number;
  opening_date: string;
  archived: boolean;
}
export interface Category {
  id: string;
  name: string;
  color: string;
  kind: "income" | "expense";
}
export interface Movement {
  id: string;
  description: string;
  amount_cents: number;
  movement_date: string;
  type: MovementType;
  scope: Scope | null;
  account_id: string;
  category_id: string | null;
  expense_owner_id: string | null;
  paid_by_member_id: string | null;
  notes: string | null;
  transfer_id: string | null;
  transfer_direction?: "in" | "out" | null;
  status: "confirmed" | "planned";
  created_at: string;
  created_by: string;
}
export interface Recurrence {
  id: string;
  description: string;
  estimated_cents: number;
  frequency: "monthly" | "quarterly" | "semiannual" | "yearly";
  due_day: number;
  start_date: string;
  end_date: string | null;
  scope: Scope;
  account_id: string;
  category_id: string | null;
  expense_owner_id: string | null;
  active: boolean;
}
export interface Occurrence {
  id: string;
  recurrence_id: string;
  period_date: string;
  due_date: string;
  estimated_cents: number;
  status: "planned" | "paid" | "skipped";
  movement_id: string | null;
}
export interface Budget {
  id: string;
  month: string;
  category_id: string;
  scope: Scope;
  member_id: string | null;
  limit_cents: number;
}
export interface Goal {
  id: string;
  name: string;
  target_cents: number;
  target_date: string | null;
  reserved_cents: number;
}
