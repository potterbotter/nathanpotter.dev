# nathanpotter.dev — design handoff (Claude Design pass, v1)

This bundle is the output of the design pass that the build plan was waiting on: **tokens, components and the navigation pattern**, plus page specs, behaviour specs and the canonical content. It sits alongside `DESIGN.md`, which still governs. Where something here goes beyond DESIGN.md, it's listed in `open-questions.md`.

## Read in this order

| # | File | What it gives you |
|---|---|---|
| 1 | `open-questions.md` | What's locked, what Claude proposed, what's still open |
| 2 | `tokens/tokens.css` | **Source of truth** for colour (light and dark), type, spacing, radius, shadow, plus base, print and reduced-motion rules. `tokens.json` mirrors it |
| 3 | `navigation.md` | Site map and routes, header, contact menu, mobile menu, rail, curated-view banner, footers, breadcrumbs, admin bar |
| 4 | `components.md` | Every component with its tokens, states and a one-line usage rule |
| 5 | `pages.md` | Section order and behaviour for each route |
| 6 | `behaviors/admin-and-edit.md` | GitHub SSO (one account), edit mode, skill synonyms, drafts and publishing |
| 7 | `behaviors/resume-generator.md` | Inputs, the never-add rule, the match dashboard, output |
| 8 | `content/cv.json` | All CV content: summary, metrics, career arc, 19 result cards, skills with synonyms, education, view rules and landing copy, builds |
| 9 | `reference/prototype/` | The interactive design prototype (`.dc.html` files). **Visual reference only**: inline styles and a canvas runtime, so don't port the code. `Main.dc.html` is the CV; `canvas.json` maps the frames |

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
- Job-fit and generator calls to Workers
- Admin edit mode (admin only, never shipped to visitors)

## Suggested build order

1. `tokens.css`, then the base stylesheet, then the page shell (header, contact menu, mobile menu, slim and band footers).
2. Render `/` statically from `content/cv.json`, including every anchor.
3. Generate `/builder/`, `/fintech/` and `/climate/` from the same template with the view rules, then build `/views/`.
4. `/builds/`, the `/tools/dpr/` placeholder, and the `/tools/job-fit/` visitor UI with a stubbed Worker.
5. `/admin/` with the OAuth Worker, then edit mode, then publishing.
6. The resume generator.
