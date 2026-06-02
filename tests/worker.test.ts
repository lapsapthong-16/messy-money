import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

describe("worker routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a non-secret health response", async () => {
    const response = await worker.fetch(new Request("https://example.test/health"), env());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "messy-money" });
  });

  it("ignores unauthorized Telegram updates without external calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await worker.fetch(new Request("https://example.test/telegram", {
      method: "POST",
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, date: 1, text: "/help", chat: { id: 99, type: "private" } }
      })
    }), env());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends escaped help text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    const response = await worker.fetch(new Request("https://example.test/telegram", {
      method: "POST",
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, date: 1, text: "/help", chat: { id: 42, type: "private" } }
      })
    }), env());

    expect(response.status).toBe(200);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.text).toContain("/fix &lt;id&gt;");
    expect(body.text).toContain("/undo");
  });

  it("undoes the latest active expense", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const db = undoDb();

    const response = await worker.fetch(new Request("https://example.test/telegram", {
      method: "POST",
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, date: 1, text: "/undo", chat: { id: 42, type: "private" } }
      })
    }), env(db));

    expect(response.status).toBe(200);
    expect(db.deletedId).toBe(11);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.text).toContain("Undid latest expense:");
    expect(body.text).toContain("Use /restore 11");
  });

  it("sends Telegram reminder on scheduled events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await worker.scheduled({} as ScheduledEvent, env());

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottoken/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "42",
          text: `<a href="tg://user?id=42">Ed</a>, any expenses to record?`,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      })
    );
  });
});

function env(db: D1Database = {} as D1Database): Env {
  return {
    DB: db,
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_ALLOWED_CHAT_ID: "42",
    GROQ_API_KEY: "groq"
  };
}

function undoDb(): D1Database & { deletedId?: number } {
  const db = {
    deletedId: undefined as number | undefined,
    prepare(sql: string) {
      if (sql.includes("ORDER BY id DESC LIMIT 1")) {
        return {
          first: async () => ({
            id: 11,
            date: "2026-06-02",
            store: "Wrong Store",
            item: "wrong item",
            amount: 12,
            category: "Other",
            note: "",
            is_estimate: 0,
            confidence: 0.5,
            needs_review: 1,
            raw_message: "wrong",
            deleted_at: null,
            created_at: "",
            updated_at: ""
          })
        };
      }
      if (sql.includes("SET deleted_at")) {
        return {
          bind(id: number) {
            db.deletedId = id;
            return { run: async () => ({ success: true }) };
          }
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return db as unknown as D1Database & { deletedId?: number };
}
