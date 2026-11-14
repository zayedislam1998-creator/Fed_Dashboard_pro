BEGIN;
CREATE TABLE IF NOT EXISTS workspace_mail_automation (
  id TEXT PRIMARY KEY,
  account_id TEXT
);
CREATE TABLE IF NOT EXISTS workspace_mail_deliveries (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP(3),
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS workspace_mail_deliveries_status_next_at_idx
  ON workspace_mail_deliveries (status, next_at);
COMMIT;
