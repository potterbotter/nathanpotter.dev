-- Application tracker (admin only). Jobs and applications are separate records: a job is a posting
-- (deduplicated by fingerprint, link, requisition ID and text similarity); an application is Nathan's pursuit
-- of one job, with its own ?ref= code so site visits can be tied to it.
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  url TEXT,
  url_key TEXT,                 -- the link normalized for duplicate checks
  source TEXT,                  -- Greenhouse, Lever, Ashby, LinkedIn, referral, other
  req_id TEXT,
  jd_text TEXT,
  fp TEXT NOT NULL              -- normalized company | title | location
);
CREATE INDEX IF NOT EXISTS jobs_fp ON jobs (fp);
CREATE INDEX IF NOT EXISTS jobs_url_key ON jobs (url_key);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs (id),
  status TEXT NOT NULL,         -- saved, applied, screen, interview, offer, rejected, withdrawn, ghosted
  ref TEXT,
  resume_id INTEGER,
  method TEXT NOT NULL DEFAULT 'manual',   -- manual today; automatic later (DESIGN.md, "Automation")
  applied_on TEXT,              -- YYYY-MM-DD
  next_step TEXT,
  next_on TEXT,                 -- YYYY-MM-DD
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_ref ON applications (ref);
CREATE INDEX IF NOT EXISTS applications_status ON applications (status);

CREATE TABLE IF NOT EXISTS app_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,           -- created, status, note, edit
  detail TEXT
);
CREATE INDEX IF NOT EXISTS app_events_app ON app_events (application_id, ts);

-- Visits are looked up by ref code.
CREATE INDEX IF NOT EXISTS events_ref ON events (ref);
