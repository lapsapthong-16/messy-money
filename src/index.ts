import { handleTextMessage } from "./commands";
import { sendTelegramMessage } from "./telegram";
import type { Env, TelegramUpdate } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({ ok: true, service: "messy-money" });
    }
    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }
    const missing = requiredEnvMissing(env);
    if (missing.length) {
      return Response.json({ ok: false, error: `Missing required config: ${missing.join(", ")}` }, { status: 500 });
    }
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
    }

    const update = await request.json<TelegramUpdate>();
    const message = update.message;
    if (!message?.text) return Response.json({ ok: true, ignored: true });
    if (String(message.chat.id) !== String(env.TELEGRAM_ALLOWED_CHAT_ID)) {
      return Response.json({ ok: true, ignored: true });
    }

    await handleTextMessage(env, message.chat.id, message.text);
    return Response.json({ ok: true });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const missing = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_CHAT_ID"].filter((key) => !env[key as keyof Env]);
    if (missing.length) {
      console.warn(`Skipping expense reminder. Missing required config: ${missing.join(", ")}`);
      return;
    }

    await sendTelegramMessage(
      env,
      env.TELEGRAM_ALLOWED_CHAT_ID,
      `<a href="tg://user?id=${env.TELEGRAM_ALLOWED_CHAT_ID}">Ed</a>, any expenses to record?`
    );
  }
};

function requiredEnvMissing(env: Env): string[] {
  return ["DB", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_CHAT_ID", "GROQ_API_KEY"].filter((key) => !env[key as keyof Env]);
}
