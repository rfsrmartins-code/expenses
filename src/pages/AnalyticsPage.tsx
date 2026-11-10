import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Landmark,
  RotateCcw,
  Scale,
} from "lucide-react";
import type { Account, Category, Movement } from "../types";
import { accountBalance, eur } from "../lib/money";

type Props = {
  accounts: Account[];
  categories: Category[];
  movements: Movement[];
};

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const currentFinancialCycle = () => {
  const today = new Date();
  const start =
    today.getDate() >= 25
      ? new Date(today.getFullYear(), today.getMonth(), 25)
      : new Date(today.getFullYear(), today.getMonth() - 1, 25);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24);
  return { from: isoDate(start), to: isoDate(end) };
};

const percentageChange = (current: number, previous: number) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export default function AnalyticsPage({
  accounts,
  categories,
  movements,
}: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accountId, setAccountId] = useState("");

  const accountIds = useMemo(
    () =>
      new Set(accountId ? [accountId] : accounts.map((account) => account.id)),
    [accountId, accounts],
  );
  const selectedAccounts = accountId
    ? accounts.filter((account) => account.id === accountId)
    : accounts;
  const confirmed = movements.filter(
    (movement) =>
      movement.status === "confirmed" && accountIds.has(movement.account_id),
  );
  const current = confirmed.filter(
    (movement) =>
      (!dateFrom || movement.movement_date >= dateFrom) &&
      (!dateTo || movement.movement_date <= dateTo),
  );
  const confirmedDates = confirmed
    .map((movement) => movement.movement_date)
    .sort();
  const today = isoDate(new Date());
  const effectiveFrom = dateFrom || confirmedDates[0] || today;
  const effectiveTo = dateTo || confirmedDates.at(-1) || today;
  const periodStart = parseDate(effectiveFrom);
  const periodEnd = parseDate(effectiveTo);
  const periodDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const previousEnd = addDays(periodStart, -1);
  const previousStart = addDays(previousEnd, -(periodDays - 1));
  const previousFrom = isoDate(previousStart);
  const previousTo = isoDate(previousEnd);
  const hasCompleteRange = Boolean(dateFrom && dateTo);
  const previous = hasCompleteRange
    ? confirmed.filter(
        (movement) =>
          movement.movement_date >= previousFrom &&
          movement.movement_date <= previousTo,
      )
    : [];
  const income = current
    .filter((movement) => movement.type === "income")
    .reduce((total, movement) => total + movement.amount_cents, 0);
  const expense = current
    .filter((movement) => movement.type === "expense")
    .reduce((total, movement) => total + movement.amount_cents, 0);
  const previousExpense = previous
    .filter((movement) => movement.type === "expense")
    .reduce((total, movement) => total + movement.amount_cents, 0);
  const transferNet = current.reduce(
    (total, movement) =>
      total +
      (movement.transfer_direction === "in"
        ? movement.amount_cents
        : movement.transfer_direction === "out"
          ? -movement.amount_cents
          : 0),
    0,
  );
  const result = income - expense + transferNet;
  const savingsRate =
    income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const currentBalance = selectedAccounts.reduce(
    (total, account) =>
      total +
      accountBalance(
        account,
        movements.filter((movement) => movement.account_id === account.id),
      ),
    0,
  );
  const expenseChange = percentageChange(expense, previousExpense);

  const categoryData = categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      value: current
        .filter(
          (movement) =>
            movement.type === "expense" && movement.category_id === category.id,
        )
        .reduce((total, movement) => total + movement.amount_cents, 0),
    }))
    .filter((category) => category.value > 0)
    .sort((a, b) => b.value - a.value);
  const maximumCategory = Math.max(
    ...categoryData.map((item) => item.value),
    1,
  );
  const topCategory = categoryData[0];
  const topExpenses = current
    .filter((movement) => movement.type === "expense")
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, 5);

  let cumulative = 0;
  const chartDates = hasCompleteRange
    ? Array.from({ length: periodDays }, (_, index) =>
        isoDate(addDays(periodStart, index)),
      )
    : [...new Set(current.map((movement) => movement.movement_date))].sort();
  if (!chartDates.length) chartDates.push(today);
  const dailyData = chartDates.map((date) => {
    const dateValue = parseDate(date);
    const dailyNet = current
      .filter((movement) => movement.movement_date === date)
      .reduce(
        (total, movement) =>
          total +
          (movement.type === "income"
            ? movement.amount_cents
            : movement.type === "expense"
              ? -movement.amount_cents
              : movement.transfer_direction === "in"
                ? movement.amount_cents
                : movement.transfer_direction === "out"
                  ? -movement.amount_cents
                  : 0),
        0,
      );
    cumulative += dailyNet;
    return {
      day: new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
      }).format(dateValue),
      value: cumulative / 100,
    };
  });

  const formatDate = (value: string, year = false) =>
    new Intl.DateTimeFormat("pt-PT", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
    }).format(parseDate(value));
  const rangeLabel =
    dateFrom && dateTo
      ? `${formatDate(dateFrom)} — ${formatDate(dateTo, true)}`
      : dateFrom
        ? `Desde ${formatDate(dateFrom, true)}`
        : dateTo
          ? `Até ${formatDate(dateTo, true)}`
          : "Todo o histórico";
  const scopeLabel =
    accounts.find((account) => account.id === accountId)?.name ||
    "Todas as contas";

  return (
    <>
      <header className="page-head analytics-head">
        <div>
          <p>DECISÕES FINANCEIRAS</p>
          <h1>Análises</h1>
        </div>
        <div className="analytics-filters">
          <label>
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setDateFrom(value);
                if (value && dateTo && value > dateTo) setDateTo(value);
              }}
            />
          </label>
          <label>
            <span>Até</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setDateTo(value);
                if (value && dateFrom && value < dateFrom) setDateFrom(value);
              }}
            />
          </label>
          <label>
            <span>Conta</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Todas as contas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <div className="analytics-filter-shortcuts">
            <button
              className="cycle-shortcut"
              onClick={() => {
                const cycle = currentFinancialCycle();
                setDateFrom(cycle.from);
                setDateTo(cycle.to);
              }}
            >
              <CalendarRange />
              Ciclo 25–24
            </button>
            {(dateFrom || dateTo) && (
              <button
                className="clear-date-filter"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                aria-label="Limpar filtro de datas"
              >
                <RotateCcw />
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="analytics-context">
        <div>
          <span>{rangeLabel}</span>
          <b>{scopeLabel}</b>
        </div>
        <p>
          {!hasCompleteRange
            ? "Escolhe uma data inicial e final para comparar períodos iguais."
            : expenseChange === 0
              ? "As despesas estão ao nível do período anterior."
              : expenseChange > 0
                ? `As despesas subiram ${expenseChange}% face ao período anterior.`
                : `As despesas desceram ${Math.abs(expenseChange)}% face ao período anterior.`}
        </p>
      </section>

      <section className="analytics-kpis">
        <article>
          <span className="analytics-kpi-icon balance">
            <Landmark />
          </span>
          <div>
            <small>Saldo atual</small>
            <strong>{eur(currentBalance)}</strong>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon income">
            <ArrowUpRight />
          </span>
          <div>
            <small>Rendimentos</small>
            <strong>{eur(income)}</strong>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon expense">
            <ArrowDownRight />
          </span>
          <div>
            <small>Despesas</small>
            <strong>{eur(expense)}</strong>
          </div>
        </article>
        <article>
          <span className="analytics-kpi-icon result">
            <Scale />
          </span>
          <div>
            <small>Resultado do período</small>
            <strong className={result < 0 ? "negative" : "positive"}>
              {eur(result)}
            </strong>
            <em>
              {income > 0
                ? `${savingsRate}% do rendimento preservado`
                : "Sem rendimentos registados"}
            </em>
          </div>
        </article>
      </section>

      <section className="analytics-main-grid">
        <article className="panel analytics-chart-panel">
          <div className="analytics-panel-title">
            <div>
              <small>EVOLUÇÃO</small>
              <h2>Resultado acumulado</h2>
            </div>
            <span>{eur(result)}</span>
          </div>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart
                data={dailyData}
                margin={{ top: 10, right: 4, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cashFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#39705d" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#39705d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e7ece8"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(value) => `${value} €`}
                />
                <Tooltip
                  formatter={(value) => eur(Number(value) * 100)}
                  labelFormatter={(day) => `Dia ${day}`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#39705d"
                  strokeWidth={2.5}
                  fill="url(#cashFlow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel analytics-categories">
          <div className="analytics-panel-title">
            <div>
              <small>ONDE SAI O DINHEIRO</small>
              <h2>Despesas por categoria</h2>
            </div>
          </div>
          {categoryData.length ? (
            <div className="category-bars">
              {categoryData.slice(0, 7).map((category) => (
                <div className="category-bar" key={category.id}>
                  <div>
                    <span>{category.name}</span>
                    <b>{eur(category.value)}</b>
                  </div>
                  <div className="category-track">
                    <i
                      style={{
                        width: `${(category.value / maximumCategory) * 100}%`,
                        background: category.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">Sem despesas neste período.</p>
          )}
        </article>
      </section>

      <section className="analytics-lower-grid">
        <article className="panel decision-panel">
          <div className="analytics-panel-title">
            <div>
              <small>LEITURA RÁPIDA</small>
              <h2>Sinais para decidir</h2>
            </div>
          </div>
          <div className="decision-list">
            <div>
              <span
                className={
                  !hasCompleteRange
                    ? "neutral"
                    : expenseChange > 0
                      ? "warning"
                      : "good"
                }
              >
                {!hasCompleteRange ? "–" : expenseChange > 0 ? "↑" : "↓"}
              </span>
              <p>
                <b>Ritmo de despesa</b>
                <small>
                  {!hasCompleteRange
                    ? "Seleciona as duas datas para comparar com o período anterior."
                    : previousExpense
                      ? `${Math.abs(expenseChange)}% ${expenseChange > 0 ? "acima" : "abaixo"} do período anterior.`
                      : "Ainda sem base de comparação no período anterior."}
                </small>
              </p>
            </div>
            <div>
              <span className="neutral">%</span>
              <p>
                <b>Categoria dominante</b>
                <small>
                  {topCategory
                    ? `${topCategory.name} representa ${Math.round((topCategory.value / expense) * 100)}% das despesas.`
                    : "Ainda sem despesas para analisar."}
                </small>
              </p>
            </div>
            <div>
              <span className={savingsRate >= 20 ? "good" : "warning"}>€</span>
              <p>
                <b>Margem do período</b>
                <small>
                  {income
                    ? `${savingsRate}% do rendimento ficou disponível antes de transferências.`
                    : "Regista os rendimentos para medir a margem real."}
                </small>
              </p>
            </div>
          </div>
        </article>

        <article className="panel top-expenses-panel">
          <div className="analytics-panel-title">
            <div>
              <small>MAIOR IMPACTO</small>
              <h2>Principais despesas</h2>
            </div>
          </div>
          {topExpenses.length ? (
            <div className="top-expenses">
              {topExpenses.map((movement, index) => (
                <div key={movement.id}>
                  <span>{index + 1}</span>
                  <p>
                    <b>{movement.description}</b>
                    <small>
                      {movement.movement_date.split("-").reverse().join("/")} ·{" "}
                      {categories.find(
                        (category) => category.id === movement.category_id,
                      )?.name || "Sem categoria"}
                    </small>
                  </p>
                  <strong>{eur(movement.amount_cents)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">Sem despesas neste período.</p>
          )}
        </article>
      </section>
    </>
  );
}
