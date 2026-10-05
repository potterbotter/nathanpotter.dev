# nathanpotter.dev

Personal site of Nathan Potter: an interactive HTML CV plus a portfolio of projects built with AI-assisted workflows.

**Live:** https://nathanpotter.dev · **Host:** Cloudflare Workers (static assets) · **Stack:** plain HTML/CSS, no build step

Design principles and site structure: see [DESIGN.md](DESIGN.md).

## Structure

```
public/                 ← everything in here is deployed, as-is
  index.html            ← landing page (currently "coming soon")
  cv/index.html         ← placeholder → replace with the standalone interactive CV (/cv/)
  404.html              ← served for unknown paths
  assets/css/site.css   ← shared styles for site pages
  _headers              ← response headers (security; noindex on workers.dev URLs)
  favicon.svg, robots.txt
wrangler.jsonc          ← Cloudflare config: project name, assets directory
src/worker.js           ← (future) server-side code, e.g. /api/ask for the CV chat
```

Adding a page: create `public/<name>/index.html`. It's served at `/<name>/`.

Dropping in the CV: replace `public/cv/index.html` with the CV file (keep the name), remove its `noindex` meta tag, commit and push.

## Privacy guardrail (run once per clone)

This repo is public, and personal data lives in Cloudflare D1/R2 (see DESIGN.md, "Data and privacy"). Enable the pre-commit hook that blocks data-looking files:

```
git config core.hooksPath .githooks
```

## Local preview

Any static server works, for example (with Python installed):

```
python -m http.server 8000 --directory public
```

Then open http://localhost:8000. With Node installed, `npx wrangler dev` runs it the same way Cloudflare does.

## Deployment

Cloudflare Workers Builds is connected to this GitHub repo (Workers project `nathanpotter-dev`):

- Push to `main` → production deploy to https://nathanpotter.dev (about a minute). Cloudflare runs `npx wrangler deploy`, which uploads `public/` as described in `wrangler.jsonc`.
- Push to any other branch → preview build with its own `*.workers.dev` preview URL. Those URLs send `noindex` headers.
- Build command: *(empty)*. Deploy command: `npx wrangler deploy`.
- Secrets for future server code (e.g. an AI API key) go in **Workers project → Settings → Variables and Secrets** as encrypted secrets, never in the repo. For local development they go in `.dev.vars` (git-ignored).

DNS and email are on Cloudflare too:

- `nathanpotter.dev` is attached to the Worker as a **Custom Domain**. Cloudflare creates the DNS record and certificate itself.
- `www.nathanpotter.dev` → proxied `AAAA 100::` placeholder record, plus a Redirect Rule (`https://www.*` → `https://${1}`, 301, query string preserved) sending it to the root domain.
- HTTPS: `.dev` is on the browser HSTS preload list, so HTTPS is mandatory. Cloudflare issues the certificate automatically. SSL/TLS mode is **Full (strict)** and **Always Use HTTPS** is on.
- Email: Cloudflare Email Routing forwards `hello@nathanpotter.dev` to a personal inbox (receive only).

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-10-05 | Plain HTML/CSS, no framework or build step | The CV is a self-contained HTML file and the site is a few pages. Nothing to compile means nothing to break, and a framework can be added later if it's needed. |
| 2026-10-05 | Cloudflare over Vercel | Domain and DNS are already at Cloudflare, so custom domain and TLS take one click. Cloudflare can run the planned "ask me about my CV" endpoint with encrypted secrets, which removes Vercel's main advantage. |
| 2026-10-05 | Public GitHub repo `nathanpotter.dev` | The source and commit history are part of the portfolio, showing the workflow. No secrets live in the repo. |
| 2026-10-05 | Site lives in `public/` | Keeps the README and config out of the deployed site. |
| 2026-10-05 | Installed Git and the GitHub CLI via winget | Standard tooling, so the repo is created and pushed from the command line. |
| 2026-10-05 | Workers (static assets) instead of Pages | Cloudflare's dashboard routed Git imports to Workers, its recommended path for new projects. Same free static hosting, plus server-side code later goes in one Worker script. Required adding `wrangler.jsonc`. |
| 2026-10-05 | Root domain is canonical; `www` 301-redirects to it | One address to share and for search engines. `www` is handled by a Redirect Rule at Cloudflare's edge, not by the Worker. |
| 2026-10-05 | Always Use HTTPS on; Cloudflare-managed HSTS left off | `.dev` is already HSTS-preloaded in browsers. Always Use HTTPS covers non-browser clients, and Cloudflare's own HSTS setting adds risk for no gain. |
| 2026-10-05 | Design principles locked in `DESIGN.md` | One source of truth for the CV chat, Claude Design and coding sessions. Key ideas: skim first with depth on demand; AI output is always inspectable and correctable. |
| 2026-10-05 | Generic CV is the homepage; tools on their own pages | The PDF résumé links to the root domain, and recruiters skim for about 10 seconds. Tools are apps, not résumé content. |
| 2026-10-05 | Role views at paths (`/fintech/`, `/builder/`, `/climate/`) | Optimised for sending tailored links to recruiters, combined with `?ref=`. |
| 2026-10-05 | Public contact is `hello@` plus LinkedIn, no phone | Keeps personal details away from scrapers. The phone number stays on the PDF. |
| 2026-10-05 | Visual system and navigation pattern go to Claude Design | Visual iteration against a style reference (a prior stylized CV) suits a design tool better. Tokens come back here as CSS custom properties. |
| 2026-10-05 | Site voice derived from a private "Nathan voice" skill | The skill was built from real Slack writing and stays private because its examples name colleagues and internal projects. A new public register was added for the site, and only those rules live here. |
| 2026-10-05 | AI tools that assess Nathan speak in a neutral third person | A first-person self-assessment reads as self-promotion and undercuts the job-fit tool's honesty. |
| 2026-10-05 | Confident CV copy, candid write-ups | Résumé language needs some self-promotion to compete. Honesty is enforced at the level of facts (no inflated numbers or scope) rather than tone. |
| 2026-10-05 | CV content in `content/cv.json` plus a small build step (reverses "no build step") | Edit mode needs to know where each piece of text lives, and the AI tools need the same facts as data. A tiny script, with no framework, keeps the output plain static HTML. |
| 2026-10-05 | Private `/admin/` tools behind Cloudflare Access | Edit mode and the résumé generator are for Nathan only. Access handles login at Cloudflare's edge, so there's no auth code or password to maintain. |
| 2026-10-05 | Edit mode commits to GitHub | Git stays the source of truth and history serves as undo. Edits deploy through the same pipeline as code. |
| 2026-10-05 | Backbone is public-only to start; job descriptions and generated résumés never committed | The repo is public. Committing applications would reveal where Nathan is applying. Private facts get a private store if they're ever needed. |
| 2026-10-05 | Access login via GitHub (1-month session), not email codes or custom authenticator-app codes | One click when already signed in, and GitHub's authenticator-app 2FA provides the second factor. Home-built authenticator-code auth would mean maintaining sessions, brute-force protection and recovery for the page that can rewrite the CV. |
| 2026-10-05 | Scope grows: the site becomes the CV plus a private job-search system (analytics, tracker, résumé generator, automation) | One backbone of facts serves both the public showcase and Nathan's own job search, and the system itself is portfolio evidence. |
| 2026-10-05 | One public repo; all personal data in Cloudflare D1/R2 | Repo choice doesn't change storage cost (data lives in Cloudflare either way; 1,000 applications is about 100 MB). One repo avoids duplicating the engine, `cv.json` and the design system. The risk of accidental leaks is handled by a written rule plus a pre-commit hook. |
| 2026-10-05 | Two locks on private routes: Cloudflare Access plus the Worker verifying the Access token | The code is public, so a single misconfigured rule shouldn't be enough to expose data. |
| 2026-10-05 | Only notes / number provenance is a private outcome field | Everything else about an outcome is fine to show. Private fields use the same IDs in D1. |
| 2026-10-05 | Nathan always submits applications for now; built for auto-submit later | Duplicate detection, source adapters with capability flags, quality evidence per application, and safety rails exist from the start, so automation becomes a setting rather than a rebuild. No ToS or CAPTCHA workarounds. |
| 2026-10-05 | Build order puts the job-fit engine, tracker and generator before edit mode | Nathan is job searching now. CV edits can go through Claude Code until edit mode exists. |
| 2026-10-05 | Built with Claude Code (AI-assisted) | Scaffolding, README and deploy steps were produced in a Claude Code session, with dashboard steps done by hand. |
