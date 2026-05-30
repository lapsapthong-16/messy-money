import { z } from "zod";
import { resolveDate } from "./dates";
import type { Category, Env, NewExpense } from "./types";

const parsedExpenseSchema = z.object({
  date: z.string().nullable().optional(),
  store: z.string().min(1).default("Unknown"),
  item: z.string().default(""),
  amount: z.number().nullable(),
  category: z.string().default("Other"),
  note: z.string().default(""),
  is_estimate: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.5),
  needs_review: z.boolean().default(false)
});

const parsedExpensesSchema = z.array(parsedExpenseSchema).min(1).max(8);

export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;

export async function parseExpenseMessage(
  env: Env,
  message: string,
  categories: Category[],
  now = new Date()
): Promise<NewExpense[]> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You parse Telegram expense notes into JSON only.",
            "Return an object with key expenses, an array of combined store-visit expenses.",
            "Never split multiple items from the same store visit into separate rows.",
            "Allowed categories: " + categories.map((c) => c.name).join(", "),
            "Use null amount only when no amount is present.",
            "Dates must be ISO yyyy-mm-dd when explicit. Use null for missing or relative dates you cannot resolve.",
            "Fields: date, store, item, amount, category, note, is_estimate, confidence, needs_review."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            today: resolveDate("today", now),
            timezone: "Asia/Kuala_Lumpur",
            message
          })
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`Groq parser failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq parser returned no content.");
  return validateParsedExpenses(content, message, categories, now);
}

export function validateParsedExpenses(content: string, rawMessage: string, categories: Category[], now = new Date()): NewExpense[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Parser returned malformed JSON.");
  }
  const candidate = Array.isArray(parsed) ? parsed : (parsed as { expenses?: unknown }).expenses;
  const expenses = parsedExpensesSchema.parse(candidate);
  const categoryNames = new Map(categories.map((c) => [c.normalized_name, c.name]));

  return expenses.map((expense) => {
    const normalized = expense.category.trim().toLowerCase();
    const category = categoryNames.get(normalized) ?? "Other";
    const needsReview = expense.needs_review || expense.amount === null || expense.confidence < 0.75 || category === "Other";
    return {
      date: resolveDate(expense.date, now),
      store: expense.store.trim() || "Unknown",
      item: expense.item.trim(),
      amount: expense.amount,
      category,
      note: expense.note.trim(),
      is_estimate: expense.is_estimate,
      confidence: expense.confidence,
      needs_review: needsReview,
      raw_message: rawMessage
    };
  });
}
