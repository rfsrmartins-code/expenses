import Papa from "papaparse";
import { parse, format, isValid } from "date-fns";
import { parseMoney } from "./money";
export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export interface CsvMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  bankId?: string;
  dateFormat: DateFormat;
}
export interface ParsedRow {
  row: number;
  date: string;
  description: string;
  amountCents: number;
  bankId?: string;
  excluded: boolean;
  duplicate: "none" | "possible" | "exact";
}
export const parseCsv = (text: string, m: CsvMapping): ParsedRow[] => {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length) throw new Error(result.errors[0].message);
  return result.data.map((r, i) => {
    const d = parse(r[m.date], m.dateFormat, new Date());
    if (!isValid(d)) throw new Error(`Data inválida na linha ${i + 2}`);
    const credit = m.credit ? r[m.credit] : "0";
    const debit = m.debit ? r[m.debit] : "0";
    const amount = m.amount
      ? parseMoney(r[m.amount])
      : parseMoney(credit || "0") - parseMoney(debit || "0");
    return {
      row: i + 2,
      date: format(d, "yyyy-MM-dd"),
      description: r[m.description]?.trim() || "",
      amountCents: amount,
      bankId: m.bankId ? r[m.bankId] : undefined,
      excluded: false,
      duplicate: "none" as const,
    };
  });
};
export const fingerprint = (
  accountId: string,
  row: Pick<ParsedRow, "date" | "description" | "amountCents">,
) =>
  `${accountId}|${row.date}|${row.amountCents}|${row.description.trim().toLocaleLowerCase("pt-PT").replace(/\s+/g, " ")}`;
