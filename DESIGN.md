# nathanpotter.dev — Design principles

**Status: principles locked 2026-10-05. Voice (public register) drafted. Visual system pending.** This file is the source of truth for how the site works. The CV chat, Claude Design and every coding session should follow it. When something changes, update it here and log the change in the README.

## Purpose

nathanpotter.dev is two products on one backbone:

1. **The public site.** The human-readable version of Nathan's résumé, and proof of the claim it makes. Nathan is an AI-native generalist product manager, so the site itself is the evidence: fast, honest, well judged. Tools demonstrate AI fluency, and the write-ups show process and judgment, not just output.
2. **A private job-search system** at `/admin`. Analytics on the public site, an application tracker, a tailored-résumé generator, and job-search automation. It's Nathan's own tool, built with the same methodology: the system does the legwork, Nathan makes the call.

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
9. **Private by default.** No cookies, and no third-party trackers; the site's own analytics are cookieless and hold no personal data. Public contact is `hello@nathanpotter.dev` plus LinkedIn; the phone number stays on the PDF only. API keys live in Cloudflare secrets. Personal data never enters the repo (see Data and privacy).

## Voice

Site copy is written in Nathan's voice, public register. The full guide is Nathan's private `nathan-voice` skill (register 6). The site rules:

- **First person, headline first.** Lead with the result, then the detail.
- **Facts flat, opinions hedged.** Outcomes and numbers stated plainly. Judgments as "I think" / "I'd".
- **Flag what isn't resolved.** Write-ups say what failed, what's still rough and what would change. Frame honestly ("hardening in progress", not "solved").
- **Show the trade-off.** For a decision: what was chosen, the real counter-argument, and why it lost this time.
- **Confident on the CV, candid in the write-ups.** CV and hero copy sell, in the confident register a résumé needs ("leverage" is in-voice). Write-ups and tool pages are candid about what failed. In both, the facts are never inflated: every number and scope claim must hold up, because the job-fit tool cites them.
- **Personality in proportion.** Dry humor fits About and the DPR calculator. CV bullets and the job-fit tool stay straight. No slang or profanity. Complete punctuation, no exclamation points.
- **Tool output is not Nathan's voice.** AI tools that assess Nathan (e.g. the job-fit report) speak as a neutral third-person analyst, because first-person self-assessment reads as self-promotion. Interface copy around the tool is in Nathan's voice.

## Data and privacy

**Public code, private data.** All code lives in this public repo as portfolio evidence. All personal data lives in Cloudflare, which only Nathan's Worker and Nathan's Cloudflare account can reach.

| What | Where | Visible to |
|---|---|---|
| Site code, templates, public CV facts (`content/cv.json`) | GitHub (public) | Everyone |
| Private outcome fields, jobs, applications, job descriptions, email events, analytics events, scan targets and search terms | Cloudflare **D1** (SQL database) | Nathan, via `/admin` |
| Generated résumés (`.docx` / PDF) | Cloudflare **R2** (file storage) | Nathan, via `/admin` |
| AI API key, GitHub token, other credentials | Cloudflare secrets | Nobody (the Worker only) |

**Guardrails**
- **Personal data and targeting config never go in the repo.** That includes test fixtures with real job descriptions, hard-coded company lists, and exports. Targets and search terms are configured in `/admin` and stored in D1. Test sets for the public job-fit tool use job descriptions Nathan has chosen to publish.
- **A pre-commit hook** (`.githooks/pre-commit`) blocks data-looking files: documents, database files, exports, emails.
- **Two locks on every private route.** Cloudflare Access (GitHub login, Nathan's account only, 1-month session) guards `/admin/*` and `/api/admin/*`. The Worker also verifies the Access token on every private request and rejects anything else, so a misconfigured Access rule can't expose data.
- **Public routes never read private tables.** The public job-fit tool and future chat read `cv.json` only.

## Structure

The generic CV is the homepage. Navigation makes the CV's role views and the tools reachable in one tap. Anything not built yet ships as a clearly labelled placeholder.

```
PUBLIC
/                     Interactive CV, generic view (default)
/builder/  /fintech/  /climate/
                      Role views of the same CV: same facts, different order and emphasis.
                      Paths, so a tailored link is easy to send: nathanpotter.dev/fintech/?ref=acme
/tools/job-fit/       Job-fit tool, then its write-up and published test results
/tools/dpr/           Damage-per-round calculator (5e-compatible, SRD content only), then its write-up
/how-i-built-this/    Long-form site write-up
/api/…                Public endpoints (rate limits, spend caps)

PRIVATE (Cloudflare Access + Worker token check)
/admin/               Dashboard: analytics, application pipeline, alerts
/admin/applications/  Tracker: jobs, applications, statuses, email events
/admin/resume/        Tailored résumé generator (creates the application record)
/admin/edit/          Edit mode for CV content
/admin/settings/      Scan targets, search terms, automation thresholds, off switch
/api/admin/…          Private endpoints
```

### Content backbone
CV content lives in one structured file, `content/cv.json`. Every role, outcome, number and skill has a stable ID. A small build script (no framework) combines it with templates into the static HTML pages, so the public site stays plain HTML that scrapers can read. The same file grounds the job-fit engine, the résumé generator and the future chat. The CV chat's HTML is split into `cv.json` plus a template when it arrives. Private fields live in D1 under the same IDs.

### Outcome data model
Each outcome (a result under a role):

| Field | Store | Notes |
|---|---|---|
| ID | public | Automatic and permanent, e.g. `anchorage-onboarding-throughput` |
| Text | public | The CV bullet. Required |
| Short version | public | ≤ ~90 characters, for collapsed cards and the hero |
| Metrics | public | Structured: value, unit, label, before → after, timeframe |
| Status | public | Shipped · In progress · Ongoing (drives tense) |
| Ownership | public | Built solo · Led · Co-led · Contributed (tools may never inflate it) |
| Featured rank | public | Order within the role; the top 2–3 show collapsed |
| Skills | public | Tags from the controlled skills list |
| Keywords | public | True alternate terms for ATS matching |
| Role-view weight | public | Per view: Hide · Normal · Lead with |
| Hero eligible | public | A metric may be a headline number |
| Context | public | The "how", in 1–2 sentences, for the expanded view and AI grounding |
| Approved alternate phrasings | public | Vetted rewordings the generator prefers over new wording |
| Team / scope, timeframe, links | public | Optional |
| State | public | Published · Draft (a draft is hidden on the site but visible on GitHub) |
| **Notes / number provenance** | **private (D1)** | How each figure is known. Shown with a 🔒 in the editor |

**The edit modal** shows the essentials first, with Targeting and Advanced collapsed. It warns when a number in the text isn't in Metrics (or the other way round), and previews the card, expanded and print renderings. Save commits public fields to Git and writes private fields to D1. Role-level fields (company, title, dates, company descriptor, context line) use a simpler role modal.

## Private job-search system

**Edit mode** (`/admin/edit/`): the real page with every content field editable in place, using the modal above. Public fields commit to GitHub through a repo-scoped token, and the push redeploys the site. A save is refused if the file changed since the editor opened, never silently overwritten. Git history is the undo.

**Job-fit engine:** one engine, used privately first. It powers the résumé generator and job scoring, and later the public job-fit tool once its test set shows it can be trusted.

**Résumé generator** (`/admin/resume/`): paste a job description or open a scanned job. The engine produces requirements, matched facts and gaps. The generator then selects, orders and rephrases facts in the job's own terms where they're true. Output is an editable preview where every bullet traces back to its fact. Missing keywords are listed as gaps and never inserted. Export as an ATS-safe `.docx` and PDF (single column, standard headings, no tables or graphics), stored in R2. Generating creates the application record. Confident wording is fine; invented or inflated facts are not.

**Application tracker** (`/admin/applications/`)
- **Jobs and applications are separate records.** A job can be seen on several sources and links to at most one application.
- **Every application gets its own `?ref=` code**, so site analytics can tie a company's visit to the application ("opened the Fintech view 2 days after applying").
- **Email ingestion:** applications use `jobs@nathanpotter.dev`. An Email Worker receives each message, matches it to an application, classifies it (confirmation · rejection · interview request · recruiter outreach), then forwards it to Gmail. Routine updates apply automatically; anything uncertain or important appears as a suggestion to confirm.

**Analytics:** the Worker logs its own cookieless events (page view, role view, `ref`, tool runs, CTA clicks, PDF downloads) to D1, starting the day the CV goes live. The dashboard joins them with the tracker.

**Automation (built to grow into auto-submit)**
- **Today, Nathan always submits.** The loop: scan → dedupe → score → tailor → notify → Nathan reviews and submits → tracked automatically.
- **Source adapters.** Each job source (Greenhouse, Lever and Ashby public job boards first) is an adapter that declares its capabilities: `scan` now, `submit` later where a sanctioned route exists. Adding a source means adding an adapter. Nothing scrapes sites that prohibit it or works around CAPTCHAs or bot detection.
- **Duplicate detection from day one.** Each job gets a fingerprint: company, normalized title and location, requisition ID if listed, and a similarity check on the description text. Before tailoring or submitting, the system checks whether the role has already been applied to, from any source or by manual entry.
- **Evidence for auto-submit.** Every application records its submission method (manual / automatic), the engine's scores, how much Nathan edited the generated résumé, and the outcome. That shows when quality is good enough to automate.
- **Safety rails.** Confidence thresholds, a daily cap, an audit log of every automated action, and an off switch. Auto-submit, when it comes, is a per-source, per-confidence setting, not a new system.
- **Notifications:** a scheduled Worker (cron) sends strong matches with the listing link, fit summary and tailored résumé. Channel to be decided (Telegram bot, email digest or ntfy).

## Build order
1. Visual system (Claude Design) → shared stylesheet and page shell
2. CV live at `/`, already split into `cv.json`, templates and build script. Event logging on from day one
3. Job-fit engine and its test set (used privately first)
4. Access, D1/R2, tracker and résumé generator: usable for real applications from here
5. Edit mode (until then, CV edits go through Claude Code)
6. `jobs@` email ingestion
7. Analytics dashboard
8. Job scanning, scoring, duplicate detection and notifications
9. Public job-fit tool (same engine), DPR calculator, `/how-i-built-this/`, "ask me about my experience" chat, role-view polish
10. Auto-submit, per source, once the quality evidence supports it

### CV section order (from the brief)
1. Hero: name, title line, one-sentence positioning, 3–4 headline numbers, actions (PDF · LinkedIn · Email), plus a call to action for the job-fit tool
2. Career arc (three-industry timeline)
3. Experience (one card per role, top 2–3 results, expand for the full list)
4. How I work with AI
5. Builds (internal builds described; public tools linked)
6. About
7. How I built this site (short, linking to the long form)
8. Contact / footer

### Navigation
The pattern is decided in the Claude Design pass. Requirements it must meet:
- From any public page, one tap reaches: the CV (home), each role view, each tool, and email.
- On the CV, a visitor can jump to any section, and the role-view switcher is visible near the hero.
- Works at 375px, by keyboard, and with JavaScript off (links still work).
- Hidden in print.
- Private pages have their own navigation (dashboard, applications, résumé, edit, settings). Nothing on public pages links to `/admin`.

### Stable anchor IDs (CV)
`#summary` · `#career-arc` · `#experience` · `#exp-anchorage` · `#exp-jaris` · `#exp-mosaic` · `#ai-method` · `#builds` · `#about` · `#skills` · `#education` · `#contact`

## Open questions
- **Notification channel:** Telegram bot, email digest or ntfy. Needed by build step 8.
- **DPR calculator:** where the existing code lives and how it's brought in.

## Visual system (to come from Claude Design)

Not decided yet. The hand-off brief for Claude Design:
- **Style reference:** Nathan's prior stylized CV (use it for style only, not content).
- **Also decide:** the navigation pattern (see the requirements under Navigation).
- **Output wanted:** a token set (colour, type scale, spacing, radius, shadow) as CSS custom properties, with light and dark variants. Public components: header/nav, segmented control (role switcher), stat block (headline numbers), role card with expander, timeline, tool panel (input → result), callout, button, link, footer. Private components: dashboard stat tiles and simple charts, data table (applications), status badge, edit modal (with collapsed sections and 🔒 private fields), save bar and conflict message, document preview, suggestion card ("confirm this update?").
- **Constraints:** principles 4–6 above. System fonts or at most one self-hosted font family. AA contrast in both themes. Works at 375px. No content baked into images.
