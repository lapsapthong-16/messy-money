export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ALLOWED_CHAT_ID: string;
  GROQ_API_KEY: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  APP_TIMEZONE?: string;
}

export const APP_TIMEZONE = "Asia/Kuala_Lumpur";

export interface Category {
  id: number;
  name: string;
  normalized_name: string;
  color: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: number;
  date: string;
  store: string;
  item: string;
  amount: number | null;
  category: string;
  note: string;
  is_estimate: number;
  confidence: number;
  needs_review: number;
  raw_message: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewExpense {
  date: string;
  store: string;
  item: string;
  amount: number | null;
  category: string;
  note: string;
  is_estimate: boolean;
  confidence: number;
  needs_review: boolean;
  raw_message: string;
}

export type ReportPeriod = "week" | "month" | "lastmonth" | "all";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    date: number;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
    };
  };
}
