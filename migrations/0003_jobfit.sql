-- Job-fit tool runs: rate limiting, monthly budget and the admin view.
-- `ipkey` is a one-way hash of (daily salt + IP), used only to count runs per day; the IP is never stored.
-- `jd_text` is the job posting the visitor pasted (a business document; disclosed on the page).
CREATE TABLE IF NOT EXISTS jobfit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,          -- YYYY-MM-DD, America/Los_Angeles
  month TEXT NOT NULL,        -- YYYY-MM
  ipkey TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,       -- ok, refused, error, limited
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read INTEGER,
  cache_write INTEGER,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  fit TEXT,
  role_title TEXT,
  company TEXT,
  jd_chars INTEGER,
  jd_text TEXT,
  result_json TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS jobfit_month ON jobfit_runs (month);
CREATE INDEX IF NOT EXISTS jobfit_day_ip ON jobfit_runs (day, ipkey);
