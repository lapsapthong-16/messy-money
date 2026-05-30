import { periodRange, resolveDate } from "./dates";
import { parseExpenseMessage } from "./parser";
import { buildReportModel, formatMoney, renderHtmlReport, renderXlsxReport } from "./reports";
import { MoneyRepository } from "./repository";
import { escapeHtml, sendTelegramDocument, sendTelegramMessage } from "./telegram";
import type { Env, Expense, ReportPeriod } from "./types";

export async function handleTextMessage(env: Env, chatId: number, text: string, now = new Date()): Promise<void> {
  const repo = new MoneyRepository(env.DB);
  if (text.trim().startsWith("/")) {
    await handleCommand(env, repo, chatId, text.trim(), now);
    return;
  }

  const categories = await repo.listCategories();
  let parsed;
  try {
    parsed = await parseExpenseMessage(env, text, categories, now);
  } catch (error) {
    await sendTelegramMessage(env, chatId, `Could not parse that expense safely. ${escapeHtml(errorMessage(error))}`);
    return;
  }

  const saved = [];
  for (const expense of parsed) {
    saved.push(await repo.insertExpense(expense));
  }
  await sendTelegramMessage(env, chatId, [
    `Saved ${saved.length} expense${saved.length === 1 ? "" : "s"}:`,
    ...saved.map((row) => formatExpenseLine(row))
  ].join("\n"));
}

async function handleCommand(env: Env, repo: MoneyRepository, chatId: number, text: string, now: Date): Promise<void> {
  const [commandWithBot, ...args] = text.split(/\s+/);
  const command = commandWithBot!.split("@")[0]!.toLowerCase();

  if (command === "/help") {
    await sendTelegramMessage(env, chatId, helpText());
    return;
  }
  if (["/today", "/yesterday", "/week", "/month"].includes(command)) {
    await sendTelegramMessage(env, chatId, await periodSummary(repo, command.slice(1) as "today" | "yesterday" | "week" | "month", now));
    return;
  }
  if (command === "/recent") {
    await sendTelegramMessage(env, chatId, formatExpenseList("Recent expenses", await repo.listRecent(10)));
    return;
  }
  if (command === "/unknown") {
    await sendTelegramMessage(env, chatId, formatExpenseList("Expenses needing review", await repo.listUnknown()));
    return;
  }
  if (command === "/categories") {
    const categories = await repo.listCategories();
    await sendTelegramMessage(env, chatId, `Categories:\n${categories.map((c) => `- ${escapeHtml(c.name)}`).join("\n")}`);
    return;
  }
  if (command === "/category") {
    await handleCategoryCommand(env, repo, chatId, args);
    return;
  }
  if (command === "/fix") {
    const [idRaw, fieldRaw, ...valueParts] = args;
    const value = valueParts.join(" ");
    if (!idRaw || !fieldRaw || !value) {
      await sendTelegramMessage(env, chatId, "Usage: /fix <id> <amount|date|note|item|store|category> <value>");
      return;
    }
    const field = fieldRaw!.toLowerCase();
    const finalValue = field === "date" ? resolveDate(value, now) : value;
    await repo.fixExpense(Number(idRaw), field, finalValue);
    await sendTelegramMessage(env, chatId, `Updated #${Number(idRaw)} ${escapeHtml(field)}.`);
    return;
  }
  if (command === "/delete" || command === "/restore") {
    const id = Number(args[0]);
    if (!id) {
      await sendTelegramMessage(env, chatId, `Usage: ${command} <id>`);
      return;
    }
    if (command === "/delete") await repo.softDelete(id);
    else await repo.restore(id);
    await sendTelegramMessage(env, chatId, `${command === "/delete" ? "Deleted" : "Restored"} #${id}.`);
    return;
  }
  if (command === "/report") {
    const period = parseReportPeriod(args[0]);
    const range = periodRange(period, now);
    const [expenses, categories] = await Promise.all([repo.listForPeriod(range.start, range.end), repo.listCategories()]);
    const model = buildReportModel(period, expenses, categories, now);
    await sendTelegramDocument(env, chatId, `expenses-${period}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", renderXlsxReport(model));
    await sendTelegramDocument(env, chatId, `expenses-${period}.html`, "text/html;charset=utf-8", renderHtmlReport(model));
    return;
  }

  await sendTelegramMessage(env, chatId, "Unknown command. Send /help for available commands.");
}

async function handleCategoryCommand(env: Env, repo: MoneyRepository, chatId: number, args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  try {
    if (action === "add") {
      const category = await repo.addCategory(args.slice(1).join(" "));
      await sendTelegramMessage(env, chatId, `Added category ${escapeHtml(category.name)}.`);
      return;
    }
    if (action === "rename") {
      const oldName = args[1];
      const newName = args.slice(2).join(" ");
      if (!oldName || !newName) throw new Error("Usage: /category rename <old> <new>");
      await repo.renameCategory(oldName, newName);
      await sendTelegramMessage(env, chatId, `Renamed ${escapeHtml(oldName)} to ${escapeHtml(newName)}.`);
      return;
    }
    if (action === "delete") {
      const name = args.slice(1).join(" ");
      if (!name) throw new Error("Usage: /category delete <name>");
      await repo.deleteCategory(name);
      await sendTelegramMessage(env, chatId, `Deleted category ${escapeHtml(name)} and reassigned expenses to Other.`);
      return;
    }
    throw new Error("Usage: /category add <name>, /category rename <old> <new>, or /category delete <name>");
  } catch (error) {
    await sendTelegramMessage(env, chatId, escapeHtml(errorMessage(error)));
  }
}

async function periodSummary(repo: MoneyRepository, period: "today" | "yesterday" | "week" | "month", now: Date): Promise<string> {
  const range = period === "today"
    ? { start: resolveDate("today", now), end: resolveDate("today", now), label: "Today" }
    : period === "yesterday"
      ? { start: resolveDate("yesterday", now), end: resolveDate("yesterday", now), label: "Yesterday" }
      : periodRange(period, now);
  const [expenses, categories] = await Promise.all([repo.listForPeriod(range.start, range.end), repo.listCategories()]);
  const model = buildReportModel(period === "today" || period === "yesterday" ? "week" : period, expenses, categories, now);
  return [
    `${range.label}: ${formatMoney(model.summary.totalSpent)} across ${model.summary.expenseCount} expense${model.summary.expenseCount === 1 ? "" : "s"}.`,
    ...model.categoryTotals.map((cat) => `${cat.name}: ${formatMoney(cat.total)}`)
  ].join("\n");
}

function parseReportPeriod(value: string | undefined): ReportPeriod {
  if (value === "week" || value === "month" || value === "lastmonth" || value === "all") return value;
  return "week";
}

function formatExpenseList(title: string, expenses: Expense[]): string {
  if (!expenses.length) return `${title}: none.`;
  return `${title}:\n${expenses.map(formatExpenseLine).join("\n")}`;
}

function formatExpenseLine(row: Expense): string {
  return `#${row.id} ${escapeHtml(row.date)} ${escapeHtml(row.store)} ${formatMoney(row.amount)} ${escapeHtml(row.category)}`;
}

function helpText(): string {
  return [
    "Messy Money commands:",
    "/today /yesterday /week /month",
    "/recent",
    "/unknown",
    "/fix <id> <amount|date|note|item|store|category> <value>",
    "/delete <id>",
    "/restore <id>",
    "/report week|month|lastmonth|all",
    "/categories",
    "/category add|rename|delete"
  ].join("\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
