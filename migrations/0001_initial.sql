CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  store TEXT NOT NULL,
  item TEXT NOT NULL,
  amount REAL,
  category TEXT NOT NULL DEFAULT 'Other',
  note TEXT NOT NULL DEFAULT '',
  is_estimate INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  raw_message TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category) REFERENCES categories(name) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_recent ON expenses(deleted_at, date DESC, id DESC);

INSERT OR IGNORE INTO categories (name, normalized_name, color, is_default) VALUES
  ('Food', 'food', '#D9471E', 1),
  ('Transport', 'transport', '#1769AA', 1),
  ('Groceries', 'groceries', '#248A5A', 1),
  ('Shopping', 'shopping', '#B85C9E', 1),
  ('Bills', 'bills', '#6B5B95', 1),
  ('Entertainment', 'entertainment', '#E0A100', 1),
  ('Health', 'health', '#0F8B8D', 1),
  ('Personal', 'personal', '#8A6F3D', 1),
  ('Other', 'other', '#565A5E', 1);
