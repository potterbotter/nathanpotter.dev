-- Small key-value settings. The job-fit tool uses it to send each budget alert once.
-- (Created earlier alongside admin tables; declared here so this repo's schema stands on its own.)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
