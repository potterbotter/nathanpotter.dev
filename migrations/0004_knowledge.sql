-- Private knowledge base: context Nathan approves in the test bench that should never be public
-- (the story behind a number, caveats, interview context). Used by the résumé generator; the public
-- job-fit tool never reads it (DESIGN.md: public routes never read private tables).
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  text TEXT NOT NULL,
  source TEXT              -- e.g. the requirement or posting it came from
);
