import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

describe("worker routes", () => {
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
});

function env(): Env {
  return {
    DB: {} as D1Database,
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_ALLOWED_CHAT_ID: "42",
    GROQ_API_KEY: "groq"
  };
}
