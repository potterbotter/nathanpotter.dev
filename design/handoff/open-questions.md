# Decisions and open questions

## Locked (decided by Nathan in the design pass)

- **Hosting:** Cloudflare. The generic CV is `/`, and the role views are `/builder/`, `/fintech/` and `/climate/`.
- **Colours:** teal primary. The secondary is **maroon, used as a fill only in dark mode**; text that's maroon in light mode becomes body ink in dark mode.
- **Experience:** shown as skimmable result cards (metric, tag, headline), with the original bullet under Detail.
- **Role views:** a landing page leading into a curated CV. They're not separate CV pages with different content.
- **Builds:** consolidated under a Builds page in the header. The fit CTA, "Am I the right fit for your company?", stays a direct button to the job-fit tool.
- **PDF download:** only in the Contact menu, not in the hero.
- **Admin:** reached through the footer link, GitHub SSO, Nathan's account only. Edit mode covers cards, About and Skills (including synonyms). The resume generator is admin-only.
- **The resume generator never adds anything.**
- **AI-method sentence:** keeps "driving enthusiastic alignment" verbatim.
- **2024:** nothing is said about it on the site. The career arc simply goes 2023 → 2025.
- **Public contact:** hello@nathanpotter.dev and LinkedIn only, with no phone number anywhere.

## Proposed by Claude, accepted by Nathan for v1 (may change later)

| Item | Proposal |
|---|---|
| New routes | `/views/` (role views landing), `/builds/`, `/admin/`. None of these are in DESIGN.md |
| Extra anchor | `#site-build` ("How this site was built"), which isn't in the permanent list |
| GitHub handle | `@potterbotter`, assumed from the repo owner |
| Auth design | A Worker OAuth flow with a numeric-ID allowlist and a short-lived strict cookie (or Cloudflare Access) |
| Publish path | Commit `content/cv.json` through the GitHub API, then a Pages rebuild |
| Theme | Follow the system setting until the visitor picks; remember the choice in localStorage |
| View curation rules | The tag sets per view in `pages.md` |
| Card headlines | All 19 were condensed from Nathan's bullets by Claude. Review the wording |
| Seeded synonyms | Five skills have example synonyms (`synonymsAreExamples: true` in cv.json). Keep or delete them |
| Career-arc intro | "Three industries, one kind of problem: …" was written by Claude |

## Open

- Whether the generator's summary line may be reworded per job, or only chosen from approved variants.
- Draft storage for edit mode: a repo commit, or KV/D1.
- **Placeholders Nathan still needs to write:**
  - About (two paragraphs)
  - AI method (three steps)
  - Contact "open to" line
  - Site-build paragraph and decisions
  - Job-fit data-handling note and write-up
  - DPR "what it will do"
  - The PDF link
  - The "Last updated" mechanism
- **Contrast:** the maroon title rule against the teal band is 1.8:1 (light) and 2.5:1 (dark). It's decorative, so it's exempt from WCAG 1.4.11, but it looks subtle.
