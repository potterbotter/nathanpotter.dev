# nathanpotter.dev

Personal site of Nathan Potter: an interactive HTML CV plus a portfolio of projects built with AI-assisted workflows.

**Live:** https://nathanpotter.dev · **Host:** Cloudflare Workers (static assets) · **Stack:** plain HTML/CSS, no build step

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
| 2026-10-05 | Built with Claude Code (AI-assisted) | Scaffolding, README and deploy steps were produced in a Claude Code session, with dashboard steps done by hand. |
