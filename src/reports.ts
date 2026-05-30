import { format, parseISO, startOfWeek } from "date-fns";
import * as XLSX from "xlsx";
import { periodRange } from "./dates";
import type { Category, Expense, ReportPeriod } from "./types";

export interface ReportModel {
  period: ReportPeriod;
  label: string;
  start: string | null;
  end: string | null;
  generatedAt: string;
  summary: {
    totalSpent: number;
    expenseCount: number;
    averagePerDay: number;
    largestExpense: Expense | null;
    unknownCount: number;
  };
  categoryTotals: Array<{ name: string; color: string; total: number; count: number; percent: number }>;
  dailyTotals: Array<{ date: string; total: number; count: number }>;
  weeklyTotals: Array<{ week: string; total: number; count: number }>;
  expenses: Expense[];
}

export function buildReportModel(period: ReportPeriod, expenses: Expense[], categories: Category[], now = new Date()): ReportModel {
  const range = periodRange(period, now);
  const totalSpent = roundMoney(expenses.reduce((sum, row) => sum + (row.amount ?? 0), 0));
  const knownDates = new Set(expenses.map((e) => e.date));
  const dayCount = Math.max(knownDates.size, 1);
  const largestExpense = expenses.reduce<Expense | null>((largest, row) => {
    if (row.amount === null) return largest;
    if (!largest || (largest.amount ?? 0) < row.amount) return row;
    return largest;
  }, null);
  const colorByCategory = new Map(categories.map((c) => [c.name, c.color]));
  const categoryMap = new Map<string, { name: string; color: string; total: number; count: number; percent: number }>();
  const dailyMap = new Map<string, { date: string; total: number; count: number }>();
  const weeklyMap = new Map<string, { week: string; total: number; count: number }>();

  for (const row of expenses) {
    const amount = row.amount ?? 0;
    const cat = categoryMap.get(row.category) ?? { name: row.category, color: colorByCategory.get(row.category) ?? "#565A5E", total: 0, count: 0, percent: 0 };
    cat.total = roundMoney(cat.total + amount);
    cat.count += 1;
    categoryMap.set(row.category, cat);

    const daily = dailyMap.get(row.date) ?? { date: row.date, total: 0, count: 0 };
    daily.total = roundMoney(daily.total + amount);
    daily.count += 1;
    dailyMap.set(row.date, daily);

    const week = format(startOfWeek(parseISO(row.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekly = weeklyMap.get(week) ?? { week, total: 0, count: 0 };
    weekly.total = roundMoney(weekly.total + amount);
    weekly.count += 1;
    weeklyMap.set(week, weekly);
  }

  const categoryTotals = [...categoryMap.values()]
    .map((cat) => ({ ...cat, percent: totalSpent ? roundMoney((cat.total / totalSpent) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  return {
    period,
    label: range.label,
    start: range.start,
    end: range.end,
    generatedAt: new Date(now).toISOString(),
    summary: {
      totalSpent,
      expenseCount: expenses.length,
      averagePerDay: roundMoney(totalSpent / dayCount),
      largestExpense,
      unknownCount: expenses.filter((e) => e.amount === null || e.is_estimate || e.confidence < 0.75 || e.needs_review).length
    },
    categoryTotals,
    dailyTotals: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    weeklyTotals: [...weeklyMap.values()].sort((a, b) => a.week.localeCompare(b.week)),
    expenses
  };
}

export function renderHtmlReport(model: ReportModel): string {
  const maxDaily = Math.max(...model.dailyTotals.map((d) => d.total), 1);
  const rows = model.expenses.map((expense) => `
    <tr>
      <td>${escape(expense.id.toString())}</td>
      <td>${escape(expense.date)}</td>
      <td>${escape(expense.store)}</td>
      <td>${escape(expense.item || "-")}</td>
      <td><span class="chip" style="--chip:${categoryColor(model, expense.category)}">${escape(expense.category)}</span></td>
      <td class="money">${formatMoney(expense.amount)}</td>
      <td>${escape(expense.note || "")}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Messy Money - ${escape(model.label)}</title>
<style>
:root{--paper:#f7f1e6;--ink:#171513;--muted:#6e665d;--rule:#2b2926;--wash:#ebe0cf;--accent:#b83218}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;line-height:1.45}
.page{max-width:1180px;margin:0 auto;padding:42px 28px 56px}.mast{display:grid;grid-template-columns:1.4fr .8fr;gap:24px;border-bottom:3px solid var(--rule);padding-bottom:22px}
.kicker{font:700 12px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(42px,8vw,96px);line-height:.9;margin:10px 0 0;letter-spacing:0}.period{align-self:end;text-align:right;font:600 15px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}
.metrics{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid var(--rule);border-left:1px solid var(--rule);margin:26px 0}
.metric{min-height:116px;padding:16px;border-top:1px solid var(--rule);border-right:1px solid var(--rule);background:rgba(255,255,255,.22)}
.metric b{display:block;font-size:clamp(24px,4vw,42px);line-height:1}.metric span{display:block;margin-top:12px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;color:var(--muted)}
.grid{display:grid;grid-template-columns:360px 1fr;gap:32px}.panel{border-top:2px solid var(--rule);padding-top:14px}h2{font-size:24px;margin:0 0 14px}
.category{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(43,41,38,.2)}
.bar{grid-column:1/-1;height:8px;background:var(--wash);position:relative}.bar i{display:block;height:100%;background:var(--c);width:var(--w)}
.trend{display:grid;gap:8px}.trend-row{display:grid;grid-template-columns:92px 1fr 86px;gap:12px;align-items:center;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}.trend-line{height:12px;background:var(--wash)}.trend-line i{display:block;height:100%;background:var(--ink);width:var(--w)}
.table-wrap{overflow:auto;border-top:2px solid var(--rule)}table{width:100%;border-collapse:collapse;min-width:920px;font-size:14px}th{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;text-align:left;color:var(--muted)}th,td{border-bottom:1px solid rgba(43,41,38,.2);padding:10px 8px;vertical-align:top}.money{text-align:right;font-variant-numeric:tabular-nums}.chip{display:inline-block;border-left:8px solid var(--chip);padding-left:8px;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace}
@media(max-width:820px){.mast,.grid{grid-template-columns:1fr}.period{text-align:left}.metrics{grid-template-columns:1fr 1fr}.page{padding:28px 16px}.metric{min-height:92px}}
@media print{body{background:white}.page{max-width:none;padding:18mm}.metrics{break-inside:avoid}.panel{break-inside:avoid}a{color:inherit}}
</style>
</head>
<body><main class="page">
<section class="mast"><div><div class="kicker">Messy Money Ledger</div><h1>${escape(model.label)}</h1></div><div class="period">${escape(model.start ?? "First record")} - ${escape(model.end ?? "Latest record")}<br>Generated ${escape(model.generatedAt.slice(0, 10))}</div></section>
<section class="metrics">
  <div class="metric"><b>${formatMoney(model.summary.totalSpent)}</b><span>Total spent</span></div>
  <div class="metric"><b>${model.summary.expenseCount}</b><span>Expenses</span></div>
  <div class="metric"><b>${formatMoney(model.summary.averagePerDay)}</b><span>Avg / active day</span></div>
  <div class="metric"><b>${model.summary.largestExpense ? formatMoney(model.summary.largestExpense.amount) : "RM0.00"}</b><span>Largest expense</span></div>
  <div class="metric"><b>${model.summary.unknownCount}</b><span>Need review</span></div>
</section>
<section class="grid">
  <div class="panel"><h2>Category Distribution</h2>${model.categoryTotals.map((cat) => `<div class="category" style="--c:${cat.color}"><strong>${escape(cat.name)}</strong><span>${formatMoney(cat.total)} (${cat.percent}%)</span><div class="bar"><i style="--w:${cat.percent}%"></i></div></div>`).join("") || "No expenses in this period."}</div>
  <div class="panel"><h2>${model.period === "week" ? "Daily Trend" : "Weekly Trend"}</h2><div class="trend">${(model.period === "week" ? model.dailyTotals.map((d) => ({ label: d.date, total: d.total })) : model.weeklyTotals.map((w) => ({ label: `Week ${w.week}`, total: w.total }))).map((p) => `<div class="trend-row"><span>${escape(p.label)}</span><div class="trend-line"><i style="--w:${Math.max(2, (p.total / maxDaily) * 100)}%"></i></div><strong>${formatMoney(p.total)}</strong></div>`).join("") || "No trend data."}</div></div>
</section>
<section class="panel" style="margin-top:34px"><h2>Expense Table</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Store</th><th>Item</th><th>Category</th><th class="money">Amount</th><th>Note</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No expenses in this period.</td></tr>`}</tbody></table></div></section>
</main></body></html>`;
}

export function renderXlsxReport(model: ReportModel): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const summary = [
    ["Messy Money", model.label],
    ["Generated", model.generatedAt],
    ["Total spent", model.summary.totalSpent],
    ["Expense count", model.summary.expenseCount],
    ["Average per active day", model.summary.averagePerDay],
    ["Largest expense", model.summary.largestExpense ? `${model.summary.largestExpense.store} ${formatMoney(model.summary.largestExpense.amount)}` : ""],
    ["Need review", model.summary.unknownCount]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.categoryTotals), "Categories");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.dailyTotals), "Daily");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.weeklyTotals), "Weekly");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.expenses.map((e) => ({
    id: e.id,
    date: e.date,
    store: e.store,
    item: e.item,
    amount: e.amount,
    category: e.category,
    note: e.note,
    estimate: Boolean(e.is_estimate),
    confidence: e.confidence
  }))), "Expenses");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function categoryColor(model: ReportModel, category: string): string {
  return model.categoryTotals.find((cat) => cat.name === category)?.color ?? "#565A5E";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number | null): string {
  if (value === null) return "Unknown";
  return `RM${value.toFixed(2)}`;
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
