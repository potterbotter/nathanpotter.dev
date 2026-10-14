-- DPR calculator: fighter presets visitors save for everyone to use. Public by design; the page says so before saving.
-- `ipkey` is the same one-way daily hash the job-fit tool uses, kept only to enforce the per-visitor daily limit.
-- `hash` is the SHA-256 of the normalized fighter, so saving an identical preset returns the existing one.
-- Nathan hides a preset with: UPDATE dpr_presets SET hidden = 1 WHERE id = ?;
CREATE TABLE IF NOT EXISTS dpr_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,           -- YYYY-MM-DD, America/Los_Angeles
  ipkey TEXT NOT NULL,
  name TEXT NOT NULL,
  fighter_json TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dpr_presets_day_ip ON dpr_presets (day, ipkey);
CREATE INDEX IF NOT EXISTS dpr_presets_visible ON dpr_presets (hidden, ts);
