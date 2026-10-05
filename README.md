# nathanpotter.dev

Personal site of Nathan Potter: an interactive HTML CV plus a portfolio of projects built with AI-assisted workflows.

**Live:** https://nathanpotter.dev · **Host:** Cloudflare Pages · **Stack:** plain HTML/CSS, no build step

## Structure

```
public/                 ← everything in here is deployed, as-is
  index.html            ← landing page (currently "coming soon")
  cv/index.html         ← placeholder → replace with the standalone interactive CV (/cv/)
  404.html              ← served for unknown paths
  assets/css/site.css   ← shared styles for site pages
  _headers              ← Cloudflare Pages response headers
  favicon.svg, robots.txt
functions/              ← (future) Cloudflare Pages Functions, e.g. functions/api/ask.js → /api/ask
```

Adding a page: create `public/<name>/index.html`. It's served at `/<name>/`.

Dropping in the CV: replace `public/cv/index.html` with the CV file (keep the name), remove its `noindex` meta tag, commit and push.

## Local preview

Any static server works, for example (with Python installed):

```
python -m http.server 8000 --directory public
```

Then open http://localhost:8000.

## Deployment

Cloudflare Pages is connected to this GitHub repo:

- Push to `main` → production deploy to https://nathanpotter.dev (about a minute).
- Push to any other branch → preview deploy at `https://<branch>.nathanpotter-dev.pages.dev`. Previews send `noindex` headers.
- Build settings: framework preset **None**, build command **(empty)**, output directory **`public`**.
- Secrets for future Functions (e.g. an AI API key) go in **Pages project → Settings → Variables and Secrets** as encrypted secrets, never in the repo. For local development they go in `.dev.vars` (git-ignored).

DNS and email are on Cloudflare too:

- `nathanpotter.dev` → CNAME to `nathanpotter-dev.pages.dev` (proxied). Created automatically when the custom domain is added in Pages.
- `www.nathanpotter.dev` → also a Pages custom domain, with a Redirect Rule sending it to the root domain.
- HTTPS: `.dev` is on the browser HSTS preload list, so HTTPS is mandatory. Cloudflare issues the certificate automatically. SSL/TLS mode is **Full (strict)** and **Always Use HTTPS** is on.
- Email: Cloudflare Email Routing forwards `hello@nathanpotter.dev` to a personal inbox (receive only).

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-10-05 | Plain HTML/CSS, no framework or build step | The CV is a self-contained HTML file and the site is a few pages. Nothing to compile means nothing to break, and a framework can be added later if it's needed. |
| 2026-10-05 | Cloudflare Pages over Vercel | Domain and DNS are already at Cloudflare, so custom domain and TLS take one click. Pages Functions cover the planned serverless "ask me about my CV" endpoint with encrypted secrets, which removes Vercel's main advantage. |
| 2026-10-05 | Public GitHub repo `nathanpotter.dev` | The source and commit history are part of the portfolio, showing the workflow. No secrets live in the repo. |
| 2026-10-05 | Site lives in `public/`, Functions will live in `functions/` | Keeps the README and config out of the deployed site. This is Cloudflare Pages' expected layout for adding serverless code later. |
| 2026-10-05 | Installed Git and the GitHub CLI via winget | Standard tooling, so the repo is created and pushed from the command line. |
| 2026-10-05 | Built with Claude Code (AI-assisted) | Scaffolding, README and deploy steps were produced in a Claude Code session, with dashboard steps done by hand. |
