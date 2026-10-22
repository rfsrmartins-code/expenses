import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import type { Recurrence } from "../types";
export const occurrenceKeys = (rule: Recurrence, through: string) => {
  const out: string[] = [];
  let d = startOfMonth(parseISO(rule.start_date));
  const end = startOfMonth(parseISO(through));
  const step =
    rule.frequency === "monthly" ? 1 : rule.frequency === "quarterly" ? 3 : 12;
  while (d <= end && (!rule.end_date || d <= parseISO(rule.end_date))) {
    out.push(`${rule.id}:${format(d, "yyyy-MM-01")}`);
    d = addMonths(d, step);
  }
  return out;
};
