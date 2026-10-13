-- First-party, cookieless analytics (DESIGN.md, "Analytics").
-- No IP addresses are stored. `visitor` is a one-way hash of (daily salt + IP + user agent);
-- salts are deleted after two days, so a hash can't be recomputed or linked across days.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,          -- epoch ms
  day TEXT NOT NULL,            -- YYYY-MM-DD, America/Los_Angeles
  visitor TEXT NOT NULL,        -- daily anonymous id
  type TEXT NOT NULL,           -- pageview, engage, section, detail, more, filter, contact, theme, print, outbound, notfound
  path TEXT,
  label TEXT,
  value REAL,
  ref TEXT,                     -- ?ref= code
  referrer TEXT,                -- referring host only
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  org TEXT,                     -- network organization (ASN owner)
  asn INTEGER,
  device TEXT,
  browser TEXT,
  os TEXT,
  screen TEXT,
  lang TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS events_type_ts ON events (type, ts);
CREATE INDEX IF NOT EXISTS events_day_visitor ON events (day, visitor);

CREATE TABLE IF NOT EXISTS salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);
