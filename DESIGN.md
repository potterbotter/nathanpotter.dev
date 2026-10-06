# nathanpotter.dev — Design principles

**Status: principles locked 2026-10-05. Voice (public register) drafted. Visual system delivered (Claude Design handoff v1).** This file is the source of truth for principles, data, privacy and the private system. The design handoff in [`design/handoff/`](design/handoff/README.md) is the source of truth for tokens, components, navigation and page specs. Where they conflict, the "Design handoff reconciliation" section below decides. Every coding session should follow both. When something changes, update it here and log the change in the README.

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
/builder/  /fintech/  /crypto/  /onboarding/  /climate/
                      Role views of the same CV: same facts, different order and emphasis.
                      Paths, so a tailored link is easy to send: nathanpotter.dev/fintech/?ref=acme
/views/               Role views landing (pick a view)
/builds/              Builds landing
/tools/job-fit/       Job-fit tool, then its write-up and published test results
/tools/dpr/           Damage-per-round calculator (5e-compatible, SRD content only), then its write-up
/how-i-built-this/    Long-form site write-up
/api/…                Public endpoints (rate limits, spend caps)

PRIVATE (Cloudflare Access + Worker token check)
/admin/               Sign-in card (public shell) → admin home once signed in
/admin/edit/          Edit mode: the CV template rendered with edit controls
/admin/resume/        Résumé generator: the job-fit page template plus the generator panel
/admin/applications/  Tracker: jobs, applications, statuses, email events
/admin/dashboard/     Analytics and application pipeline
/admin/settings/      Scan targets, search terms, automation thresholds, off switch
/api/admin/…          Private endpoints
```

Page-by-page specs: [`design/handoff/pages.md`](design/handoff/pages.md). Private pages not covered by the handoff (tracker, dashboard, settings) reuse its components.

### Content backbone
CV content lives in one structured file, [`content/cv.json`](content/cv.json), in the shape defined by the design handoff. A small build script (no framework) combines it with templates into static HTML pages for `/`, each role view and the landings, so the public site stays plain HTML that scrapers can read. The same file grounds the job-fit engine, the résumé generator and the future chat. Private fields live in D1 under the same IDs.

### Data model (v1)
- **Result card:** `id`, `metric`, `tag` (one of the experience tags), `headline` (under 12 words), `detail` (the original CV bullet).
- **Card IDs are permanent.** Existing IDs (`anchorage-0` …) are frozen: never renumbered or reused. Display order is array order, so drag-to-reorder changes order, not IDs. New cards get new IDs.
- **Skills:** `{ forms: [...], shown: n }`. The site renders only `forms[shown]`; the generator may pick any form.
- **Role views:** tag rules per view (`views` in `cv.json`), not per-card weights.
- **Planned card fields**, added with edit mode once Nathan sets the values (never inferred): `ownership` (Built solo · Led · Co-led · Contributed) and `status` (Shipped · Underway), so tools can't overstate a role. Also approved alternate phrasings if the generator needs them.
- **Private (D1):** notes / number provenance per card, Nathan's phone number (used only on downloaded résumés), and approved summary variants if Nathan wants them private.

## Private job-search system

**Access:** Cloudflare Access with GitHub login, restricted to `@potterbotter`, with a 1-month session and its login-method chooser skipped. `/admin/` shows the designed sign-in card ("Confirm you are, in fact, Nathan Potter." with **Continue with GitHub**), and the button enters Access. The designed "You're not the right Nathan" page is used if Access can redirect blocked users to a custom page; otherwise Cloudflare's block page shows.

**Edit mode** (`/admin/edit/`): the CV template rendered with the edit controls from [`design/handoff/behaviors/admin-and-edit.md`](design/handoff/behaviors/admin-and-edit.md). Edits save as **drafts in D1** (never visible on GitHub). **Publish** commits `content/cv.json` through a repo-scoped GitHub token, and the push redeploys the site. Publishing is refused if `cv.json` changed since the editor opened, never silently overwritten. Git history is the undo. Nothing writes CV content automatically.

**Job-fit engine:** one engine, used privately first. It powers the résumé generator and job scoring, and later the public job-fit tool once its test set shows it can be trusted.

**Job-fit tool** (`/tools/job-fit/`, `src/jobfit.js`, `src/jobfit-api.js`): Claude Opus 5.5 (adaptive thinking, effort medium, structured JSON output, server-side refusal fallback) reads a pasted posting against `cv.json`. The prompt treats the posting as untrusted data and flags embedded instructions. Code then enforces honesty: citations must be real card IDs, the quotes shown are the CV's own text, and an unsupported "meets" is downgraded. Limits, in order: Turnstile (when configured), 3 requests per minute per IP (Cloudflare rate limiter), 5 per day per IP (daily-salted hash, IP never stored), 100 per day site-wide, a monthly budget ($10, from per-run token costs) that switches the tool off, with email alerts at 80% and 100%, and the Anthropic Console spend limit as a hard backstop. Nathan, signed in through Access, is exempt from the per-IP and daily limits. Runs, costs and pasted postings are stored in D1 (disclosed on the page). Requires the `ANTHROPIC_API_KEY` secret; `JOBFIT_ENABLED` is the kill switch.

**Test bench** (`/admin/job-fit/`, `src/kb.js`, `admin/testbench.js`): Nathan runs reads (optionally against his unpublished draft) and answers the feedback in a chat with Claude Opus 5.5. Claude asks for specifics and proposes changes as cards: public (new or edited result card, fact, skill wording), which go to the edit-mode draft, or private notes, which go to the D1 `knowledge` table. Nothing is written until Nathan approves a card, and he can edit it first. The public tool never reads private notes. Chat turns spend from the job-fit budget. `JOBFIT_COMPARE` turns the Opus vs Sonnet side-by-side back on.

**Résumé generator** (the Résumé tab of the test bench, `/admin/job-fit/#resume`; `src/resume.js`, `src/resume-api.js`, `admin/resume.js`), spec in [`design/handoff/behaviors/resume-generator.md`](design/handoff/behaviors/resume-generator.md).
- **It assembles, it never writes.** The résumé is built from approved building blocks in `cv.json`: titles and summaries (`resume.titles`, `resume.summaries`), result cards and their approved wordings (`variants`), and skill wordings (`forms`). Claude Opus 5.5 returns only a block plan (IDs, order, the posting's keywords). Code assembles the page, drops any ID that doesn't exist, and keeps every role, company and date as-is. New blocks come only through the test-bench chat, approved by Nathan. Approved blocks only for now; this may loosen later.
- **Page budget in code:** one page by default (about 54 lines, 13 bullets), two pages optional. Over budget, the last (least relevant) bullet of the longest role is trimmed, and every role keeps at least one. The editor works on the plan as applied, so trimmed bullets don't silently return.
- **Match dashboard:** keyword coverage against the untailored CV (the baseline), must-haves covered, and length. Missing keywords are chips that open the chat to ask whether Nathan has that experience.
- **Manual edits without AI:** switch the title or summary, change a bullet's wording, remove or add bullets, remove skills. Each change re-assembles and re-scores at no cost.
- **Contact:** `hello@nathanpotter.dev` (the same address as the site) plus the phone number from private D1 settings (never on the public site or in the repo), LinkedIn, and `nathanpotter.dev/?ref=<code>` so analytics can tie a visit to the application.
- **Output:** PDF (print-ready page), Word `.docx` and copy as text. The Word file is built on the server from the plan (`src/docx.js`, no dependencies): one column, Arial, real bullet lists, contact details in the body, no tables or text boxes, so applicant-tracking systems parse it cleanly. Both PDF and Word were measured to fit one page in Word and at letter size in the browser. Each run is stored in the D1 `resumes` table (posting, keywords, plan, text, scores, exported flag) and costs about 5 cents from the job-fit budget.

**Review queue** (`/admin/review/`, `src/review.js`, `admin/review.js`): the fastest way to grow the approved blocks. Claude Opus 5.5 proposes about 20 at a time (titles, summary variants, bullet rewordings, skill wordings), using the role views, keywords from postings he has tailored for, and everything already approved, rejected or waiting. Code drops anything that adds a claim or repeats an earlier decision. Nathan sees one proposal at a time with what exists now and one line of why, and decides with a button or a key (A approve, E edit, R reject, S skip). Approved items go to the draft; rejected ones are listed in later prompts so they are not proposed again. A batch costs about 15 cents from the job-fit budget.

**Application tracker** (`/admin/applications/`, `src/tracker.js`, `admin/tracker.js`, built 2026-10-06)
- **Jobs and applications are separate records.** A job can be seen on several sources and links to at most one application.
- **Every application gets its own `?ref=` code**, so site analytics can tie a company's visit to the application ("opened the Fintech view 2 days after applying").
- **Built:** add from a link (Greenhouse, Lever, Ashby or page text), by hand, or from the Résumé tab ("Track this application" carries the company, role, posting, résumé and ref code). Statuses: Saved, Applied, Recruiter screen, Interviewing, Offer; closed as Rejected, Withdrawn or No response. Each application has a next step with a date (due ones sort first), notes and a timeline, the résumé that was sent (downloadable again), and every site visit through its ref link: when, network and city, device, pages, time and what was read.
- **Duplicate check** before saving: same link (tracking parameters ignored), same requisition ID, same company + normalized title + location, posting text at least 60% the same at the same company, or a résumé already tracked. Strong matches block the save with "Open it" or "save anyway"; the same title at another location is only a hint.
- **Email reading** (`src/mail.js`, built 2026-10-06): the hello@ Email Routing rule sends mail to the Worker, which forwards it to Nathan first (and bounces rather than drops it if forwarding fails), then reads it in the background. Rules decide what is job-related (applicant-tracking senders, tracked company domains or names, ref codes); personal mail is never stored or sent anywhere. Claude Haiku 4.5 classifies and matches job mail (rules alone if the budget is used up). Confident matches apply automatically: confirmations (Saved → Applied), rejections (→ Rejected) and next steps or offers (status forward only, a due next step, and an attention email). Everything else waits in the tracker inbox to confirm, link or dismiss, and every automatic update can be undone for 14 days. Stored per job email: sender, subject, a 600-character excerpt and the outcome, deleted after 180 days.

**Analytics** (`/admin/dashboard/`): first-party and cookieless. `site.js` sends events to `/api/collect`: page views, engaged time and scroll depth, sections seen, card expands, folded results opened, filter chips, contact actions, theme switches, prints, outbound links and 404s. The Worker adds Cloudflare's location (city, region, country, timezone), the network owner (ASN organization) and device details from the user agent. **IP addresses are never stored.** Visitors are grouped per day by a hash of a daily random salt plus IP and user agent; salts are deleted after two days, so IDs can't be linked across days. Raw events are kept 13 months (daily cron). Bots, foreign-origin posts, unknown event types and `/admin` paths are dropped. Nathan's own browser can opt out from the dashboard. Network owner is a hint, not identification (usually an ISP); `?ref=` codes are the reliable company signal and will join to the tracker.

**Automation (built to grow into auto-submit)**
- **Today, Nathan always submits.** The loop: scan → dedupe → score → tailor → notify → Nathan reviews and submits → tracked automatically.
- **Source adapters.** Each job source (Greenhouse, Lever and Ashby public job boards first) is an adapter that declares its capabilities: `scan` now, `submit` later where a sanctioned route exists. Adding a source means adding an adapter. Nothing scrapes sites that prohibit it or works around CAPTCHAs or bot detection.
- **Duplicate detection from day one.** Each job gets a fingerprint: company, normalized title and location, requisition ID if listed, and a similarity check on the description text. Before tailoring or submitting, the system checks whether the role has already been applied to, from any source or by manual entry.
- **Evidence for auto-submit.** Every application records its submission method (manual / automatic), the engine's scores, how much Nathan edited the generated résumé, and the outcome. That shows when quality is good enough to automate.
- **Safety rails.** Confidence thresholds, a daily cap, an audit log of every automated action, and an off switch. Auto-submit, when it comes, is a per-source, per-confidence setting, not a new system.
- **Notifications:** a scheduled Worker (cron) sends strong matches with the listing link, fit summary and tailored résumé. Channel to be decided (Telegram bot, email digest or ntfy).

## Build order
1. Visual system ✓ (Claude Design handoff) → shared stylesheet and page shell
2. CV live at `/`, already split into `cv.json`, templates and build script. Event logging on from day one
3. Job-fit engine and its test set (used privately first)
4. Access, D1/R2, tracker and résumé generator: usable for real applications from here
5. Edit mode (until then, CV edits go through Claude Code)
6. Application email ingestion (matched by sender)
7. Analytics dashboard
8. Job scanning, scoring, duplicate detection and notifications
9. Public job-fit tool (same engine), DPR calculator, `/how-i-built-this/`, "ask me about my experience" chat, role-view polish
10. Auto-submit, per source, once the quality evidence supports it

### Navigation
Defined in [`design/handoff/navigation.md`](design/handoff/navigation.md): header (CV · Role views · Builds · Contact menu · theme toggle), a phone menu under 640px, the CV rail (Curated for · On this page), the curated-view banner, the band and slim footers, breadcrumbs and the admin bar. The **Admin** link lives only in the footer (lock icon). Admin markup never ships in public pages.

### Stable anchor IDs (CV)
`#summary` · `#career-arc` · `#experience` · `#exp-anchorage` · `#exp-jaris` · `#exp-mosaic` · `#ai-method` · `#builds` · `#about` · `#skills` · `#education` · `#site-build` · `#contact`. They resolve on every role view too.

## Visual system
Delivered by the Claude Design pass: [`design/handoff/`](design/handoff/README.md). Tokens in `design/handoff/tokens/tokens.css` (teal primary; maroon secondary, fill-only in dark mode; system fonts), components in `components.md`. The prototype `.dc.html` files are visual reference only, not code to port.

## Design handoff reconciliation (2026-10-05)
Where the handoff and this file disagreed:
- **Sign-in:** Cloudflare Access (this file) rather than the handoff's custom OAuth. Keeps the designed sign-in card.
- **Admin UI location:** under `/admin/` using the same templates, rather than in place on `/` and `/tools/job-fit/`. Public pages stay static with zero admin code.
- **Edit-mode drafts:** D1 (settles the handoff's open question).
- **Card IDs:** frozen, since the handoff's IDs are position-based and edit mode reorders.
- **`anchorage-6` / `anchorage-7`:** the shared detail text was split into two bullets using Nathan's own words, so a résumé can't repeat it.
- **Generator:** the handoff's "never adds anything" replaces this file's earlier "rephrase where true". The summary uses approved variants only.
- **Phone:** the handoff says no phone anywhere. It stays off the site and out of the repo, but tailored résumés include it from private storage.
- **Voice:** the handoff README's "no hype words" is superseded by the Voice section above (confident CV copy is fine).
- **Accepted from the handoff:** `/views/`, `/builds/`, `#site-build`, the footer Admin link, hero metrics (4×, $70MM+, 90%), the tag-based role-view rules.

## Open questions
- **Placeholders Nathan writes:**
  - About (two paragraphs)
  - AI-method steps
  - Contact "open to" line
  - Site-build paragraph and decisions
  - Job-fit data-handling note and write-up
  - DPR "what it will do" list
  - PDF résumé file
  - Summary variants for the generator
- **To review:** the 19 card headlines Claude condensed, and the five skills with seeded synonyms (`synonymsAreExamples`).
- **Notification channel:** Telegram bot, email digest or ntfy. Needed by build step 8.
- **DPR calculator:** where the existing code lives and how it's brought in.
