# Pages

All copy comes from `content/cv.json` unless noted. Bracketed text is a placeholder for Nathan to write. Ship it visibly bracketed or hide it, but don't invent copy.

## `/` — CV (generic)

Order:

1. Header
2. Hero band `#summary`: eyebrow, name, title rule, headline and lede, three metrics, fit CTA
3. Two-column body:
   - **Rail:** Curated for, then On this page
   - **Main:** the sections below, in this order
4. `#career-arc`
5. `#experience`:
   - Intro line, then the filter chips with counts, then an `aria-live` status line ("19 results across 3 roles" / "Highlighting 3 of 19: Scale").
   - Three role blocks (`#exp-anchorage`, `#exp-jaris`, `#exp-mosaic`), each a role header plus a card grid.
   - Then the on-page fit CTA.
6. `#ai-method`: intro (Nathan's exact sentence, including "driving enthusiastic alignment"), then three numbered step cards (placeholders)
7. `#builds`: two tile cards (Job-fit, live; DPR, not built yet) and an "All builds" link
8. `#about`: two paragraphs (placeholders)
9. `#skills` and `#education`, side by side on desktop:
   - **Skills:** Core strengths as a single " · " line, then AI and Technical as chips.
   - **Education:** two entries.
10. `#site-build`: a `--surface-2` panel with a "Stack and decisions" disclosure
11. Footer `#contact`

**Behaviour:**
- **Filter chips:** clicking one fades non-matching cards to `--dim`; clicking it again goes back to All. Without JS, no chips render (or they render inert) and every card is visible.
- **Theme toggle:** see `tokens.css`.

## `/builder/` `/fintech/` `/climate/` — curated CV

This is the same template as `/` with a `view` setting. Differences from `/`:

- The rail's "Curated for" marks the view, and the curated-view banner sits at the top of main.
- **Role order:** builder and fintech use Anchorage, jaris, Mosaic; climate uses Mosaic, Anchorage, jaris.
- **Up-front cards:** cards that fit the view render in the grid; the rest go in a "Show N more from {Company}" `<details>`. The fit rule for each view:
  - **builder:** tag ∈ {Built it myself, AI, 0→1, Platform}
  - **fintech:** tag ∈ {Scale, Automation, Partners, Risk, Platform}
  - **climate:** every Mosaic card; nothing else up front
- **Status line:** "{n} of 19 results up front for {View}. The rest are one click away."
- **Static output:** generate each route as its own static HTML page. All cards stay in the DOM.

## `/views/` — Role views landing

1. Header
2. Hero band: eyebrow "Role views", then the h1 **"My experience, curated to what you're looking for."**, then the title rule, then "Pick the kind of role you're hiring for. It's the same CV, with the most relevant results up front and the rest a click away."
3. Three view-picker cards: Builder, Fintech, Climate (copy and the "Up front" metrics are in `content/cv.json → views`, `pages.md` and the prototype `Role.dc.html`)
4. A row with a dashed card "Not sure? Read the full CV" and a band card "Hiring for one specific role? Am I the right fit for your company?"
5. Slim footer

## `/builds/` — Builds landing

1. Header
2. h1 "Builds", the title rule, then the lede "Things I've built on my own time. The interactive ones come first: you can try them, and each has a write-up on the decisions behind it."
3. "Try it yourself":
   - **Job-fit card:** a large card with a mini preview of the evidence table, Try it (primary) and Read the write-up.
   - **DPR card:** a dashed card with a striped "Preview when it ships" area.
4. "Other things I've built": a ruled list. "This site" links to `/#site-build`, plus one `[Build]` placeholder row.
5. The fit CTA (band variant)
6. Slim footer

## `/tools/job-fit/` — Job-fit assessment (visitor)

1. Breadcrumb, then the h1 **"Am I the right fit for your company?"**, the title rule and the lede.
2. Two columns:
   - **Form:** a Job description textarea, a "Read it against" select (Full CV or one of the three views), and Assess / Clear buttons. Under them: "[Data handling note]" plus a no-JS note.
   - **"The read" (`aria-live`):** an empty state until assessed. Then:
     - the overall read
     - a requirements table (Posting asks for · Evidence on the CV, as a link to an `#exp-*` anchor plus the quoted line · Read: Meets / Partly / Gap)
     - "What the posting doesn't settle"
     - a "How this read was produced" disclosure (model, CV version, prompt link)
     - "Send a correction", a mailto
3. `#write-up`: decisions and trade-offs, and known limits (placeholders)

## `/tools/job-fit/` — admin additions (signed in)

The admin bar is added, plus a `#resume-generator` panel between "The read" and the write-up. Its top border is a 4px `--accent` fill, and it's labelled "Only visible to you". The full spec is in `behaviors/resume-generator.md`.

## `/tools/dpr/` — labelled placeholder

A dashed card with a "Placeholder · not built yet" badge, the h1, one line on what it is, a "What it will do" list (placeholders) and "Expected: [date]". Below the card: "Try the job-fit tool instead" and "Back to the CV". Slim footer.

## `/admin/`

There are three states. The page is noindex and has no header nav, just the name and "Back to the CV".

- **Signed out:**
  - A centred card with a 4px `--accent` top border, a lock icon, the h1 "Admin", and the line **"Confirm you are, in fact, Nathan Potter."**
  - A single dark button: **Continue with GitHub**.
  - Nothing else. Explanations were removed on purpose.
- **Wrong account:**
  - The h1 **"You're not the right Nathan"**.
  - In small `--ink-2` text: "Even if you're a card carrying member of the United Nathans."
  - Then "Your GitHub account info isn't stored anywhere, though, and nothing has changed about your access."
  - Buttons: Back to the CV (primary) and Am I the right fit? (secondary).
- **Signed in:** "Signed in with GitHub as @handle", the h1 "Admin", Sign out, and two tile cards: **Edit the CV** (opens `/` in edit mode) and **Resume generator** (opens `/tools/job-fit/` with the generator). Then "Last published: [date] · Drafts: [count]".

## Edit mode on `/`

See `behaviors/admin-and-edit.md`.
