# nathanpotter.dev — Design principles

**Status: principles locked 2026-10-05. Voice (public register) drafted. Visual system delivered (Claude Design handoff v1).** This file is the source of truth for principles, data and privacy. The design handoff in [`design/handoff/`](design/handoff/README.md) is the source of truth for tokens, components, navigation and page specs. Where they conflict, the "Design handoff reconciliation" section below decides. When something changes, update it here and log the change in the README.

## Purpose

nathanpotter.dev is the human-readable version of Nathan's résumé, and proof of the claim it makes. Nathan is an AI-native generalist product manager, so the site itself is the evidence: fast, honest, well judged. Tools demonstrate AI fluency, and the write-ups show process and judgment, not just output.

Nathan's own tools (CV edit mode, the analytics dashboard, a résumé generator) live at `/admin`, in a separate private repository. They share this repo's templates, content and validation, and the public site never depends on them.

**Primary public visitor:** a recruiter or hiring manager, often on a phone, who skims for about 10 seconds and may never scroll.

## Principles

1. **The site is the evidence.** Every page should demonstrate judgment. Nothing is decorative unless it carries meaning.
2. **Skim first, depth on demand.** The first screen stands on its own. Detail opens on click or tap (expanders, tabs, drawers) rather than through a long scroll. This applies to tools too: a result leads with the verdict, with the evidence expandable.
3. **AI output is inspectable and correctable.** AI does the legwork and the user makes the call, so nothing the AI produces is applied silently. Fit reports cite CV evidence and state gaps plainly. Parsed inputs appear in an editable preview. "Show the math" is always available.
4. **One visual system.** Colours, type, spacing and components are defined once as CSS custom properties, and every page uses them, private pages included.
5. **Lightweight by default.** Plain HTML/CSS, with small vanilla JavaScript only where something is interactive. A tool's libraries load only on that tool's page. Content is readable without JavaScript, and the hero renders instantly on a phone.
6. **Mobile first, accessible, printable.** Designed at 375px wide first. Semantic HTML, keyboard-navigable, WCAG AA contrast, respects `prefers-reduced-motion`, and supports light and dark themes. The CV prints as a clean single-column résumé, with navigation and toggles hidden and collapsed content printed expanded.
7. **Real text and stable URLs.** Name in the `<h1>`, plain section headings, no key content in images or canvas. Collapsed content stays in the DOM (hidden visually, never lazy-loaded). Every CV section, role and outcome has a permanent ID, so tools and links can point to it. Tool state is shareable in the URL.
8. **Every build ships with its write-up**: what was tried, what failed, what changed. Decisions keep going into the README log.
9. **Private by default.** No cookies, and no third-party trackers; the site's own analytics are cookieless and hold no personal data. Public contact is `hello@nathanpotter.dev` plus LinkedIn. API keys live in Cloudflare secrets. Personal data never enters the repo (see Data and privacy).

## Voice

Site copy is written in Nathan's voice, public register:

- **First person, headline first.** Lead with the result, then the detail.
- **Facts flat, opinions hedged.** Outcomes and numbers stated plainly. Judgments as "I think" / "I'd".
- **Flag what isn't resolved.** Write-ups say what failed, what's still rough and what would change. Frame honestly ("hardening in progress", not "solved").
- **Show the trade-off.** For a decision: what was chosen, the real counter-argument, and why it lost this time.
- **Candid write-ups, facts never inflated.** Every number and scope claim must hold up, because the job-fit tool cites them.
- **Personality in proportion.** Dry humor fits About and the DPR calculator. CV bullets and the job-fit tool stay straight. No slang or profanity. Complete punctuation, no exclamation points.
- **Tool output is not Nathan's voice.** AI tools that assess Nathan (e.g. the job-fit report) speak as a neutral third-person analyst. Interface copy around the tool is in Nathan's voice.

## Data and privacy

**Public code, private data.** The site's code lives in this public repo. Personal data lives in Cloudflare, which only Nathan's Workers and Nathan's Cloudflare account can reach.

| What | Where | Visible to |
|---|---|---|
| Site code, templates, public CV facts (`content/cv.json`) | GitHub (public) | Everyone |
| Analytics events, job-fit runs and anything Nathan's private tools store | Cloudflare **D1** (SQL database) | Nathan, via `/admin` |
| AI API key, other credentials | Cloudflare secrets | Nobody (the Workers only) |

**Guardrails**
- **Personal data never goes in the repo.** That includes test fixtures with real job descriptions and exports. Test sets for the public job-fit tool use job descriptions Nathan has chosen to publish.
- **A pre-commit hook** (`.githooks/pre-commit`) blocks data-looking files: documents, database files, exports, emails.
- **Two locks on every private route.** Cloudflare Access (GitHub login, Nathan's account only) guards `/admin/*` and `/api/admin/*`. The private Worker also verifies the Access token on every request (`src/access.js`, tested for forged, tampered, expired and wrong-audience tokens) and rejects anything else, so a misconfigured Access rule can't expose data. That Worker has no public route of its own: this Worker passes private paths to it through a service binding.
- **Public routes never read private tables.** The public job-fit tool reads `cv.json` only.

## Structure

The generic CV is the homepage. Navigation makes the CV's role views and the tools reachable in one tap. Anything not built yet ships as a clearly labelled placeholder.

```
/                     Interactive CV, generic view (default)
/builder/  /fintech/  /crypto/  /onboarding/  /climate/
                      Role views of the same CV: same facts, different order and emphasis.
                      Paths, so a tailored link is easy to send: nathanpotter.dev/fintech/
/views/               Role views landing (pick a view)
/builds/              Builds landing
/tools/job-fit/       Job-fit tool, then its write-up
/tools/dpr/           Damage-per-round calculator (5e-compatible, SRD content only), then its write-up
/how-i-built-this/    Long-form site write-up
/api/job-fit, /api/job-fit/fetch, /api/collect
                      Public endpoints (rate limits, spend caps)
/sign-in/, /admin/…   Private tools (Cloudflare Access + token check), served by the private Worker
```

Page-by-page specs: [`design/handoff/pages.md`](design/handoff/pages.md).

### Content backbone
CV content lives in one structured file, [`content/cv.json`](content/cv.json), in the shape defined by the design handoff. A small build script (no framework, no dependencies) combines it with templates into static HTML pages for `/`, each role view and the landings, so the public site stays plain HTML that scrapers can read. The same file grounds the job-fit tool.

### Data model
- **Result card:** `id`, `metric`, `tag` (one of the experience tags), `headline` (under 12 words), `detail` (the original CV bullet).
- **Card IDs are permanent.** Existing IDs (`anchorage-0` …) are frozen: never renumbered or reused. Display order is array order, so reordering changes order, not IDs. New cards get new IDs.
- **Skills:** `{ forms: [...], shown: n }`. The site renders only `forms[shown]`; other forms are approved alternate wordings.
- **Facts:** a short curated list the job-fit tool can cite as evidence. They are never rendered on the page.
- **Role views:** tag rules per view (`views` in `cv.json`), plus hand-picked cards where tags alone would pull in the wrong results.

## Job-fit tool

`/tools/job-fit/`, `src/jobfit.js`, `src/jobfit-api.js`.

- **Model:** Claude Opus 5.5 (adaptive thinking, effort medium, structured JSON output, server-side refusal fallback) reads a pasted posting, or one fetched from a link, against `cv.json`.
- **Stance:** an honest advocate, and the page says so. Each requirement is graded Exceeds, Meets, Close, Stretch or Gap, and every Close, Stretch or Gap gets a grounded line on how Nathan would close it. The overall verdict is Strong, Good, Stretch or Limited fit, so the tool can say no.
- **Untrusted input:** the posting is data, never instructions. The prompt flags embedded instructions (`manipulation_detected`).
- **Honesty enforced in code:** citations must be real card IDs, the quotes shown are the CV's own text, and Exceeds, Meets or Close without a verified citation falls to Stretch. Tenure is computed from role dates, never inferred.
- **Limits, in order:** Turnstile; 3 requests per minute per IP (Cloudflare rate limiter); 5 per day per IP (daily-salted hash, IP never stored); 20 per day site-wide; a $10 monthly budget computed from visitors' per-run token costs, which switches the tool off, with email alerts at 80% and 100% (Nathan's own runs count toward a separate $20 admin budget, so his use can't switch the tool off for visitors); and the Anthropic Console spend limit as a hard backstop. Nathan, signed in through Access, is exempt from the per-IP and daily limits.
- **Storage:** runs, costs and pasted postings are stored in D1, which the page discloses. `JOBFIT_ENABLED` is the kill switch.

## Résumé generator (private tool, described here)

The code is private; the approach is the interesting part.

- **It assembles, it never writes.** A tailored résumé is built only from building blocks Nathan approved: result cards and their approved wordings, skill wordings, titles and summaries. Claude returns a plan of block IDs and the posting's keywords. Code assembles the page, drops any ID that doesn't exist, keeps every role, company and date as-is, fits the page budget, and scores keyword coverage against the untailored CV.
- **New wordings come through review, one at a time.** Claude proposes blocks in batches; code screens out anything that adds a claim or repeats an earlier decision; Nathan approves, edits or rejects each one.
- **Output:** PDF, plain text, and Word (`src/docx.js`, in this repo: a dependency-free zip and OOXML writer that produces one-column, ATS-safe documents with real bullet lists and no tables or text boxes).
- **Contact on a résumé:** `hello@nathanpotter.dev`, LinkedIn and the plain site address `nathanpotter.dev`, with no tracking code.

## Analytics

First-party and cookieless (`src/analytics.js`).

- **What is sent:** `site.js` sends events to `/api/collect`: page views, engaged time and scroll depth, sections seen, card expands, filter chips, contact actions, theme switches, prints, outbound links and 404s.
- **What the Worker adds:** Cloudflare's coarse location, the network owner (ASN organization) and device details from the user agent.
- **No IPs, no cross-day IDs.** IP addresses are never stored. Visitors are grouped per day by a hash of a daily random salt plus IP and user agent; salts are deleted after two days, so IDs can't be linked across days.
- **Retention and filtering:** raw events are kept 13 months (daily cron). Bots, foreign-origin posts, unknown event types and `/admin` paths are dropped, and `/api/collect` is rate-limited per IP.
- **Refs:** `?ref=` is kept only for channel tags on links Nathan controls (`?ref=linkedin`, `?ref=github`), and the site's privacy note says so.

### Navigation
Defined in [`design/handoff/navigation.md`](design/handoff/navigation.md): header (CV · Role views · Builds · Contact menu · theme toggle), a phone menu under 640px, the CV rail (Curated for · On this page), the curated-view banner, the band and slim footers, and breadcrumbs. The **Admin** link lives only in the footer (lock icon). Admin markup never ships in public pages.

### Stable anchor IDs (CV)
`#summary` · `#career-arc` · `#experience` · `#exp-anchorage` · `#exp-jaris` · `#exp-mosaic` · `#ai-method` · `#builds` · `#about` · `#skills` · `#education` · `#site-build` · `#contact`. They resolve on every role view too.

## Visual system
Delivered by the Claude Design pass: [`design/handoff/`](design/handoff/README.md). Tokens in `design/handoff/tokens/tokens.css` (teal primary; maroon secondary, fill-only in dark mode; system fonts), components in `components.md`.

## Design handoff reconciliation (2026-10-05)
Where the handoff and this file disagreed:
- **Sign-in:** Cloudflare Access (this file) rather than the handoff's custom OAuth. Keeps the designed sign-in card.
- **Admin UI location:** under `/admin/` using the same templates, rather than in place on `/` and `/tools/job-fit/`. Public pages stay static with zero admin code.
- **Card IDs:** frozen, since the handoff's IDs are position-based and reordering would break them.
- **`anchorage-6` / `anchorage-7`:** the shared detail text was split into two bullets using Nathan's own words, so a résumé can't repeat it.
- **Generator:** the handoff's "never adds anything" replaces this file's earlier "rephrase where true".
- **Accepted from the handoff:** `/views/`, `/builds/`, `#site-build`, the footer Admin link, hero metrics, the tag-based role-view rules.

## Open questions
- **Placeholders Nathan writes:** About (two paragraphs), AI-method steps, Contact "open to" line, site-build paragraph and decisions, job-fit write-up, DPR "what it will do" list.
- **DPR calculator:** where the existing code lives and how it's brought in.
