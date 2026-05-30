const token = process.env.TELEGRAM_BOT_TOKEN;
const workerUrl = process.env.WORKER_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !workerUrl) {
  console.error("Set TELEGRAM_BOT_TOKEN and WORKER_URL=https://<worker>/telegram");
  process.exit(1);
}

const body: Record<string, string> = { url: workerUrl };
if (secret) body.secret_token = secret;

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

console.log(await response.text());

export {};
