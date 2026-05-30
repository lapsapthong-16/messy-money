import { describe, expect, it } from "vitest";
import { buildReportModel, renderHtmlReport, renderXlsxReport } from "../src/reports";
import type { Category, Expense } from "../src/types";

describe("reports", () => {
  it("uses one shared model for html and xlsx outputs", () => {
    const model = buildReportModel("week", expenses(), categories(), new Date("2026-05-30T01:00:00Z"));

    expect(model.summary.totalSpent).toBe(46.7);
    expect(model.summary.expenseCount).toBe(3);
    expect(model.summary.unknownCount).toBe(1);
    expect(model.categoryTotals.map((c) => [c.name, c.total])).toEqual([["Food", 21.7], ["Transport", 15], ["Other", 10]]);

    const html = renderHtmlReport(model);
    expect(html).toContain("Messy Money Ledger");
    expect(html).toContain("RM46.70");
    expect(html).toContain("Category Distribution");

    const xlsx = renderXlsxReport(model);
    expect(xlsx.byteLength).toBeGreaterThan(1000);
  });
});

function categories(): Category[] {
  return [
    { id: 1, name: "Food", normalized_name: "food", color: "#D9471E", is_default: 1, created_at: "", updated_at: "" },
    { id: 2, name: "Transport", normalized_name: "transport", color: "#1769AA", is_default: 1, created_at: "", updated_at: "" },
    { id: 3, name: "Other", normalized_name: "other", color: "#565A5E", is_default: 1, created_at: "", updated_at: "" }
  ];
}

function expenses(): Expense[] {
  return [
    row(1, "2026-05-29", "Village Park", 21.7, "Food", 0, 0.95),
    row(2, "2026-05-29", "Grab", 15, "Transport", 0, 0.9),
    row(3, "2026-05-30", "Unknown", 10, "Other", 1, 0.5)
  ];
}

function row(id: number, date: string, store: string, amount: number, category: string, is_estimate: number, confidence: number): Expense {
  return {
    id,
    date,
    store,
    item: "",
    amount,
    category,
    note: "",
    is_estimate,
    confidence,
    needs_review: is_estimate,
    raw_message: "",
    deleted_at: null,
    created_at: "",
    updated_at: ""
  };
}
