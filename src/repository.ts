import type { Category, Expense, NewExpense } from "./types";

export const DEFAULT_COLORS: Record<string, string> = {
  Food: "#D9471E",
  Transport: "#1769AA",
  Groceries: "#248A5A",
  Shopping: "#B85C9E",
  Bills: "#6B5B95",
  Entertainment: "#E0A100",
  Health: "#0F8B8D",
  Personal: "#8A6F3D",
  Other: "#565A5E"
};

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function titleCategory(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export class MoneyRepository {
  constructor(private readonly db: D1Database) {}

  listCategories(): Promise<Category[]> {
    return this.db.prepare("SELECT * FROM categories ORDER BY name").all<Category>().then((r) => r.results ?? []);
  }

  async categoryExists(name: string): Promise<boolean> {
    const row = await this.db.prepare("SELECT 1 FROM categories WHERE normalized_name = ?").bind(normalizeCategoryName(name)).first();
    return Boolean(row);
  }

  async coerceCategory(name: string, categories?: Category[]): Promise<string> {
    const all = categories ?? await this.listCategories();
    const found = all.find((c) => c.normalized_name === normalizeCategoryName(name));
    return found?.name ?? "Other";
  }

  async addCategory(name: string): Promise<Category> {
    const clean = titleCategory(name);
    if (!clean) throw new Error("Category name is required.");
    const normalized = normalizeCategoryName(clean);
    if (await this.categoryExists(clean)) throw new Error(`Category already exists: ${clean}`);
    const color = DEFAULT_COLORS[clean] ?? colorFromName(clean);
    await this.db.prepare(
      "INSERT INTO categories (name, normalized_name, color, is_default) VALUES (?, ?, ?, 0)"
    ).bind(clean, normalized, color).run();
    const row = await this.db.prepare("SELECT * FROM categories WHERE normalized_name = ?").bind(normalized).first<Category>();
    if (!row) throw new Error("Failed to create category.");
    return row;
  }

  async renameCategory(oldName: string, newName: string): Promise<void> {
    if (normalizeCategoryName(oldName) === "other") throw new Error("Other cannot be renamed.");
    const clean = titleCategory(newName);
    if (!clean) throw new Error("New category name is required.");
    if (await this.categoryExists(clean)) throw new Error(`Category already exists: ${clean}`);
    const old = await this.coerceCategory(oldName);
    if (old === "Other" && normalizeCategoryName(oldName) !== "other") throw new Error(`Category not found: ${oldName}`);
    const color = DEFAULT_COLORS[clean] ?? colorFromName(clean);
    await this.db.batch([
      this.db.prepare("UPDATE categories SET name = ?, normalized_name = ?, color = ?, updated_at = datetime('now') WHERE normalized_name = ?")
        .bind(clean, normalizeCategoryName(clean), color, normalizeCategoryName(oldName)),
      this.db.prepare("UPDATE expenses SET category = ?, updated_at = datetime('now') WHERE category = ?").bind(clean, old)
    ]);
  }

  async deleteCategory(name: string): Promise<void> {
    if (normalizeCategoryName(name) === "other") throw new Error("Other cannot be deleted.");
    const actual = await this.coerceCategory(name);
    if (actual === "Other") throw new Error(`Category not found: ${name}`);
    await this.db.batch([
      this.db.prepare("UPDATE expenses SET category = 'Other', updated_at = datetime('now') WHERE category = ?").bind(actual),
      this.db.prepare("DELETE FROM categories WHERE normalized_name = ?").bind(normalizeCategoryName(name))
    ]);
  }

  async insertExpense(input: NewExpense): Promise<Expense> {
    await this.db.prepare(
      `INSERT INTO expenses (date, store, item, amount, category, note, is_estimate, confidence, needs_review, raw_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      input.date,
      input.store,
      input.item,
      input.amount,
      input.category,
      input.note,
      input.is_estimate ? 1 : 0,
      input.confidence,
      input.needs_review ? 1 : 0,
      input.raw_message
    ).run();
    const row = await this.db.prepare("SELECT * FROM expenses WHERE id = last_insert_rowid()").first<Expense>();
    if (!row) throw new Error("Failed to insert expense.");
    return row;
  }

  listRecent(limit = 10): Promise<Expense[]> {
    return this.db.prepare("SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT ?")
      .bind(limit).all<Expense>().then((r) => r.results ?? []);
  }

  latestActiveExpense(): Promise<Expense | null> {
    return this.db.prepare("SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1").first<Expense>();
  }

  listUnknown(): Promise<Expense[]> {
    return this.db.prepare(
      "SELECT * FROM expenses WHERE deleted_at IS NULL AND (amount IS NULL OR confidence < 0.75 OR is_estimate = 1 OR needs_review = 1) ORDER BY date DESC, id DESC LIMIT 25"
    ).all<Expense>().then((r) => r.results ?? []);
  }

  async fixExpense(id: number, field: string, value: string): Promise<void> {
    const allowed = new Set(["amount", "date", "note", "item", "store", "category"]);
    if (!allowed.has(field)) throw new Error(`Unsupported field: ${field}`);
    const finalValue: string | number | null = field === "amount" ? (value.toLowerCase() === "unknown" ? null : Number(value)) : value;
    if (field === "amount" && typeof finalValue === "number" && Number.isNaN(finalValue)) throw new Error("Amount must be a number or unknown.");
    if (field === "category" && !(await this.categoryExists(value))) throw new Error(`Category not found: ${value}`);
    await this.db.prepare(`UPDATE expenses SET ${field} = ?, needs_review = 0, updated_at = datetime('now') WHERE id = ?`)
      .bind(finalValue, id).run();
  }

  softDelete(id: number): Promise<D1Result> {
    return this.db.prepare("UPDATE expenses SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();
  }

  restore(id: number): Promise<D1Result> {
    return this.db.prepare("UPDATE expenses SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").bind(id).run();
  }

  listForPeriod(start: string | null, end: string | null): Promise<Expense[]> {
    if (!start || !end) {
      return this.db.prepare("SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date ASC, id ASC").all<Expense>().then((r) => r.results ?? []);
    }
    return this.db.prepare("SELECT * FROM expenses WHERE deleted_at IS NULL AND date BETWEEN ? AND ? ORDER BY date ASC, id ASC")
      .bind(start, end).all<Expense>().then((r) => r.results ?? []);
  }
}

function colorFromName(name: string): string {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 52, 42);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(255 * x).toString(16).padStart(2, "0")).join("")}`;
}
