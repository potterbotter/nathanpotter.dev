-- Review queue: résumé-block proposals Nathan approves, edits or rejects one at a time (admin only).
-- status: pending → approved | rejected | skipped (skipped items come back after the pending ones).
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  batch INTEGER NOT NULL,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  why TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_ts INTEGER,
  final_json TEXT
);
CREATE INDEX IF NOT EXISTS proposals_queue ON proposals (status, id);
CREATE INDEX IF NOT EXISTS proposals_key ON proposals (dedupe_key);
