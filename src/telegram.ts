import type { Env } from "./types";

export async function sendTelegramMessage(env: Env, chatId: number | string, text: string): Promise<Response> {
  return fetch(telegramUrl(env, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
}

export async function sendTelegramDocument(
  env: Env,
  chatId: number | string,
  filename: string,
  contentType: string,
  body: string | ArrayBuffer
): Promise<Response> {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("document", new Blob([body], { type: contentType }), filename);
  return fetch(telegramUrl(env, "sendDocument"), {
    method: "POST",
    body: form
  });
}

export function telegramUrl(env: Env, method: string): string {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
