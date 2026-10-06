-- Generated résumés (admin only, private). Each run stores the posting, the block plan and the
-- assembled text, so any résumé can be reproduced from its plan and the CV version.
-- `ref` is the tracking code in the résumé's site link (nathanpotter.dev/?ref=...).
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  company TEXT,
  role_title TEXT,
  ref TEXT,
  length TEXT,
  jd_text TEXT,
  keywords_json TEXT,
  plan_json TEXT,
  resume_text TEXT,
  rate REAL,
  baseline_rate REAL,
  exported INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS resumes_ts ON resumes (ts);
