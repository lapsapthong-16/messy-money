# Messy Money

Telegram-only personal money tracker on Cloudflare Workers + D1. Send ordinary spending notes to a Telegram bot; the Worker parses them with Groq, stores expenses in D1, and returns summaries or paired `.xlsx` and `.html` reports.

## Stack

- Cloudflare Workers with TypeScript
- Cloudflare D1 SQLite
- Telegram Bot API webhook
- Groq `llama-3.1-8b-instant`
- Fixed timezone: `Asia/Kuala_Lumpur`

## Setup

1. Install dependencies:

   ```bash
   npm i
   ```

2. Create the D1 database:

   ```bash
   npx wrangler d1 create messy-money
   ```

   Copy the returned `database_id` into `wrangler.toml`.

3. Apply migrations:

   ```bash
   npm run db:migrate:local
   npm run db:migrate:remote
   ```

4. Configure secrets:

   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_ALLOWED_CHAT_ID
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```

   `TELEGRAM_WEBHOOK_SECRET` is optional but recommended.

5. Run locally:

   ```bash
   npm run dev
   ```

6. Deploy:

   ```bash
   npm run deploy
   ```

7. Register the Telegram webhook:

   ```bash
   TELEGRAM_BOT_TOKEN=... WORKER_URL=https://<worker-host>/telegram TELEGRAM_WEBHOOK_SECRET=... npm run webhook:set
   ```

## Environment

- `DB`: D1 binding configured in `wrangler.toml`
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_ALLOWED_CHAT_ID`: the only Telegram chat ID allowed to use the bot
- `GROQ_API_KEY`: Groq API key
- `TELEGRAM_WEBHOOK_SECRET`: optional Telegram secret-token check
- `APP_TIMEZONE`: defaults to `Asia/Kuala_Lumpur`; v1 assumes this fixed timezone

## Telegram Usage

Send plain text expenses:

```text
today village park nasi lemak ayam and drink 21.70, queue was crazy
last monday mcdonalds rm19, ordered too much
grab to office 15 and jaya grocer 52.40
```

Commands:

```text
/help
/today
/yesterday
/week
/month
/recent
/unknown
/fix <id> <amount|date|note|item|store|category> <value>
/delete <id>
/restore <id>
/report week
/report month
/report lastmonth
/report all
/categories
/category add Subscriptions
/category rename Personal Self-care
/category delete Shopping
```

Reports are delivered as both `expenses-<period>.xlsx` and `expenses-<period>.html`. The HTML report is self-contained, responsive, printable, and uses an editorial finance ledger design with strong category color markers.

## Reminders

The Worker sends Telegram expense reminders at 12:00 PM and 8:00 PM Malaysia time. Cloudflare cron triggers are configured in UTC in `wrangler.toml`:

```toml
[triggers]
crons = ["0 4 * * *", "0 12 * * *"]
```

## Smoke Test

After deployment:

1. Send `/help`; expect the command list.
2. Send one expense, such as `today coffee 8.50`; expect a saved ID and parsed fields.
3. Send `/recent`; expect that expense in the last 10 rows.
4. Send `/report week`; expect both `.xlsx` and `.html` Telegram documents.

## Verification

```bash
npm run typecheck
npm run test
```
