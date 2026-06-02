import { describe, expect, it } from "vitest";
import { validateParsedExpenses } from "../src/parser";
import type { Category } from "../src/types";

const categories: Category[] = [
  category("Food", "food"),
  category("Transport", "transport"),
  category("Other", "other")
];

describe("parser validation", () => {
  it("accepts a single store visit", () => {
    const result = validateParsedExpenses(JSON.stringify({
      expenses: [{
        date: null,
        store: "Village Park",
        item: "nasi lemak ayam and drink",
        amount: 21.7,
        category: "Food",
        note: "queue was crazy",
        is_estimate: false,
        confidence: 0.94,
        needs_review: false
      }]
    }), "today village park nasi lemak ayam and drink 21.70", categories, new Date("2026-05-30T01:00:00Z"));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ date: "2026-05-30", category: "Food", amount: 21.7, needs_review: false });
  });

  it("coerces unknown and low-confidence categories to review", () => {
    const result = validateParsedExpenses(JSON.stringify({
      expenses: [{
        date: "2026-05-20",
        store: "Mystery",
        item: "",
        amount: null,
        category: "Subscriptions",
        note: "",
        is_estimate: true,
        confidence: 0.4,
        needs_review: false
      }]
    }), "mystery", categories);

    expect(result[0]).toMatchObject({ category: "Other", amount: null, is_estimate: true, needs_review: true });
  });

  it("accepts null optional fields from the parser", () => {
    const result = validateParsedExpenses(JSON.stringify({
      expenses: [{
        date: null,
        store: null,
        item: "coffee",
        amount: 8.5,
        category: null,
        note: null,
        is_estimate: false,
        confidence: null,
        needs_review: false
      }]
    }), "coffee 8.50", categories, new Date("2026-05-30T01:00:00Z"));

    expect(result[0]).toMatchObject({
      date: "2026-05-30",
      store: "Unknown",
      item: "coffee",
      amount: 8.5,
      category: "Other",
      note: "",
      confidence: 0.5,
      needs_review: true
    });
  });

  it("rejects malformed parser output", () => {
    expect(() => validateParsedExpenses("{nope", "raw", categories)).toThrow("malformed JSON");
  });
});

function category(name: string, normalized_name: string): Category {
  return {
    id: 1,
    name,
    normalized_name,
    color: "#000000",
    is_default: 1,
    created_at: "",
    updated_at: ""
  };
}
