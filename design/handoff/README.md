# nathanpotter.dev — design handoff (Claude Design pass, v1)

This bundle is the output of the design pass that the build plan was waiting on: **tokens, components and the navigation pattern**, plus page specs, behaviour specs and the canonical content. It sits alongside `DESIGN.md`, which still governs. Specs for the private admin tools, the open-questions list and the prototype files live with the admin code, in a private repo.

## Read in this order

| # | File | What it gives you |
|---|---|---|
| 1 | `tokens/tokens.css` | **Source of truth** for colour (light and dark), type, spacing, radius, shadow, plus base, print and reduced-motion rules. `tokens.json` mirrors it |
| 2 | `navigation.md` | Site map and routes, header, contact menu, mobile menu, rail, curated-view banner, footers, breadcrumbs, admin bar |
| 3 | `components.md` | Every component with its tokens, states and a one-line usage rule |
| 4 | `pages.md` | Section order and behaviour for each route |
| 5 | `content/cv.json` (now `/content/cv.json`) | All CV content: summary, metrics, career arc, 19 result cards, skills with synonyms, education, view rules and landing copy, builds |

## Constraints that still apply (from DESIGN.md)

- **Code and content:** plain HTML and CSS with minimal JS. Content reads without JS, and collapsed content stays in the DOM.
- **Mobile and accessibility:** mobile first at 375px. WCAG AA in both themes, `prefers-reduced-motion`, and a clean single-column print.
- **Fonts:** system fonts only.
- **Contact:** public contact is email and LinkedIn only.
- **Voice:** first person, headline first, facts flat, no hype words, no exclamation points.

## JavaScript budget (everything works without it)

- Theme toggle and remembering the choice
- Experience filter chips (dimming only)
- Copy-email button
- Closing open menus on outside click or Esc
- Opening every `details` before print
- Job-fit calls to the Worker
- Admin edit mode (admin only, never shipped to visitors)

## Suggested build order

1. `tokens.css`, then the base stylesheet, then the page shell (header, contact menu, mobile menu, slim and band footers).
2. Render `/` statically from `content/cv.json`, including every anchor.
3. Generate `/builder/`, `/fintech/` and `/climate/` from the same template with the view rules, then build `/views/`.
4. `/builds/`, the `/tools/dpr/` placeholder, and the `/tools/job-fit/` visitor UI with a stubbed Worker.
5. `/admin/` sign-in, then the private tools (specified in the admin repo).
