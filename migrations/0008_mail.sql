-- Job emails read from hello@ (admin only). Only mail that looks job-related is stored, and only the
-- sender, subject, a short excerpt and what was done with it. Kept 180 days (daily cron).
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  message_id TEXT,
  from_addr TEXT,
  from_name TEXT,
  subject TEXT,
  snippet TEXT,                 -- first ~600 characters of the text body
  category TEXT NOT NULL,       -- confirmation, rejection, next_step, offer, outreach, other
  stage TEXT,                   -- screen, interview, offer (next steps only)
  summary TEXT,
  action TEXT,                  -- what Nathan needs to do, if anything
  company TEXT,                 -- as read from the email
  role TEXT,
  application_id INTEGER,
  confidence TEXT,              -- high, medium, low
  method TEXT NOT NULL,         -- ai, rules
  outcome TEXT NOT NULL,        -- auto, suggested, applied, dismissed, undone
  prev_status TEXT,             -- for undo
  new_status TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS emails_message ON emails (message_id);
CREATE INDEX IF NOT EXISTS emails_outcome ON emails (outcome, ts);
CREATE INDEX IF NOT EXISTS emails_app ON emails (application_id, ts);
