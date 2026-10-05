-- Edit-mode drafts (one working draft of content/cv.json) and small admin metadata.
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  changes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
