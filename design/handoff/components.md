# Components

Every component uses tokens from `tokens/tokens.css` only, with no raw hex outside that file. The exceptions are the generated-resume preview (always light, like paper) and the admin bar tokens. Each component lists one **Rule** for when to use it. Markup is the semantic shape I expect; class names are suggestions.

---

## Buttons

| Variant | Style | Rule |
|---|---|---|
| Primary | `--brand` fill, `--brand-ink` text, 700, `--r-1`, min-height 44, padding 0 24 | One per region |
| Secondary | `--surface` fill, 1px `--line`, `--ink`, 600 | Beside a primary, never alone as the main action |
| Text link | `--brand`, 600, min-height 44 | Low-weight navigation ("All builds") |
| Icon button | 44×44, 1px `--line`, `--r-1`, `--surface` | Must have `aria-label` |

Use real `<a>` for navigation and `<button type="button">` for actions.

## Fit CTA ("Am I the right fit for your company?")

**Rule:** it always links to `/tools/job-fit/` and never to anything else. It appears in three places: the hero, after Experience, and at the bottom of `/builds/`.

- **On the band (hero):** a `--cta-bg` card with `--r-2` and a heavier shadow (`0 6px 18px rgba(0,0,0,.22)`), max-width 560.
  - Title: "Am I the right fit for your company?", `--fs-4`, 800, `--cta-ink`.
  - Sub-line: "Paste a job description. Get a fit read that cites my CV, on its own page.", `--fs-1`, `--cta-sub`.
  - Right: a 48px round arrow, `--cta-dot` fill, `--cta-dot-ink` icon.
- **On the page (after Experience):** a `--band` card with a 1px `--line` border and `--shadow-2`.
  - Mono eyebrow "Hiring?", then the title and a sub-line.
  - The arrow dot uses `--cta-bg` fill and `--cta-ink`.
- **Hover:** `translateY(-2px)` and the arrow slides 3px. Both are off under `prefers-reduced-motion`.

## Chips

| Kind | Element | Style | Rule |
|---|---|---|---|
| Filter chip | `<button aria-pressed>` | 36px tall, pill. **Off:** `--surface` with a 1px `--line` border. **On:** `--brand` fill and `--brand-ink` text. A mono count follows the label | Clickable, always carries a count |
| Tag | `<span>` | Mono 11px uppercase, `--chip` fill, pill, padding 3px 8px | A label, never clickable |
| Status | `<span>` | Mono 13px. "Live" uses a `--chip` fill. "Not built yet" is outlined with `--line` and `--ink-2` text | A label |
| Skill | `<span>` | 13px, `--chip`, pill, padding 4px 10px | Display only |

## Result card (Experience)

**Rule:** one result per card. Metric first, a headline under 12 words, and the original CV bullet under Detail.

```html
<li class="card" data-tag="Scale">
  <div class="card__top"><span class="card__metric">4×</span><span class="tag">Scale</span></div>
  <p class="card__headline">Client onboarding throughput, ~265 → 1,000+ a quarter, in a year</p>
  <details><summary>Detail <svg class="chev"/></summary><p>…original bullet…</p></details>
</li>
```

- **Container:** `--surface` background, 1px `--line` border, `--r-2`, `--shadow-1`, padding 16, gap 8.
- **Metric:** `--fs-5`, 800, `--brand`, line-height 1.05, letter-spacing -.02em.
- **Headline:** 600, line-height 1.35.
- **Detail summary:** 13px, 600, `--brand`. The detail body is 13px `--ink-2`.
- **Grid:** `repeat(auto-fill, minmax(min(240px,100%),1fr))` with a 12px gap.
- **Filtered-out state:** `opacity: var(--dim)` with a .2s transition. The card stays in the DOM and in print.

## Role header

**Rule:** this heads each employer's block of cards.

- **Left:** an h3 with the company name (`--fs-4`, 700) followed by a 400-weight `--ink-2` "· kind" (for example "· federally chartered bank").
- **Under it:** the job title, 600, in `--accent-text`.
- **Right:** the dates, mono 13px `--ink-2`.
- **Bottom:** a 2px `--ink` rule closes the header.
- **Optional:** a note line under the header (for example "Moved from Client Insights…"), `--ink-2`.

## "Show N more" disclosure (curated views)

Use a `<details>` whose summary is a pill with a 1px dashed `--line` border, min-height 44, 13px 600 `--ink-2`. The label reads "Show 4 more from Anchorage Digital", or "Show 8 results from jaris" when nothing from that employer is shown up front. The folded cards use the same card component without a shadow.

## Disclosure (generic)

**Rule:** always native `<details>/<summary>`, so it works without JS. The chevron rotates 180° when open. Before printing, set `open` on every `details` (a `beforeprint` listener), because CSS alone cannot reliably reveal closed details content.

## Section heading

An h2 in `--fs-5`, 700, letter-spacing -.015em, `--brand`, with an optional `--ink-2` lede under it. Sections are separated by `--sp-8` (72px).

## Page title (sub-pages)

- An h1 in `clamp(2rem,5vw,2.75–3.5rem)`, 800, letter-spacing -.02em.
- Then the **title rule**: a `--accent` fill 96–120px wide and 5–6px tall. It's decorative, so it doesn't need 3:1 contrast.
- Then a lede in `--fs-3` `--ink-2`.

## Hero band (homepage and `/views/`)

- A full-bleed `--band` section with `--band-ink` text and a 1px `--line` bottom border (that border matters in dark mode).
- Inner container max 1200, padding 72/24/48.
- Content in order:
  1. Mono uppercase eyebrow
  2. h1 at `--fs-6`, 800
  3. The title rule in `--accent`
  4. Headline (`--fs-4`) and lede (`--fs-3`, .92 opacity)
  5. Metrics row: grid auto-fit min 200, each with a 1px `--band-line` top border, value at `--fs-5` 700 and label at 13px
  6. The fit CTA

## Career arc

An `<ol>` grid (auto-fit min 200), with one stop per industry:

- A 3px top border: `--line` normally, `--brand` for the current stop.
- Mono years, the industry name (700, `--fs-3`), the company as an anchor link to its `#exp-*`, then one `--ink-2` line.

## Tile card (builds, view picker)

- A whole-card `<a>` on `--surface` with a `--line` border, `--r-2` and `--shadow-1`. Inner layout is a column with a 12–16px gap.
- A status chip sits top right.
- The footer action is brand text or a 40px round brand arrow.
- **Hover:** lift 3px and the border turns `--brand`.
- **Unbuilt items:** a dashed border, plus a striped preview area labelled "Preview when it ships".

## View-picker card (`/views/`)

- Header: the view name (`--fs-5`, 800) on the left, the mono route on the right.
- A "For…" line in `--ink-2`.
- An "Up front" block: three rows, each with the metric in `--brand` 800 and its text at 13px. The metrics come from `content/cv.json`.
- A footer CTA: "See the fintech view" plus a round arrow.

## Menu panel

Used for the contact menu and the phone menu: a `--raised` panel with a 1px `--line` border, `--r-2`, `--shadow-2`, padding 16, gap 8. Rows are at least 44px tall.

## Curated-view banner

See `navigation.md`. It's a `--surface` card with a 4px `--brand` top border, the eyebrow in `--brand` mono uppercase, and a secondary button "Show the full CV".

## Form fields

- A visible `<label>` above every field. The field background is `--bg`, so fields read as wells inside `--surface` panels.
- Fields have a 1px `--line` border, `--r-1`, min-height 44 and `font: inherit`.
- A segmented source switch (Paste text / Link to posting / Use the posting above) is a `role="group"` of `aria-pressed` buttons on a `--surface-2` track. The selected button is `--surface` with `--shadow-1`.

## Metric tile (resume-generator dashboard)

- A `--bg` tile with a 1px `--line` border, `--r-2` and padding 16.
- Contents: a mono 11px uppercase label, the value at 2.25rem 800 in `--brand`, then 13px detail lines.
- The keyword tile adds an 8px progress track: `--surface-2` with a `--brand` fill, plus a 2px `--ink` tick marking the untailored-CV baseline.

## Edit-mode controls (admin only)

- **Card footer:** a dashed `--line` divider, a "Drag to reorder" grip label, and an outlined brand **Edit** button.
- **Card edit form:** Metric, Theme (select of the tags), Headline and Detail, with **Cancel** and **Save draft** buttons. It replaces the card's content in place.
- **Add tile:** a 2px dashed `--line` border, min-height 160, a brand "+ Add a result to {Company}".
- **About:** an "Edit About" outline button opens a textarea. A blank line separates paragraphs.
- **Skills:** each group sits in a 1px dashed `--brand` box.
  - Clicking a chip opens the **wordings panel** (a menu panel). It lists every wording; the one shown on the site has a brand "On the site" badge, and the others have a "Show this on the site" button. Each wording can be removed with × as long as one remains.
  - The panel also has "Add synonym", a "Remove this skill" text button and **Done**.
  - Chips that have synonyms show a mono `+N`.
  - Each group ends with an "Add a skill" input and button.
- **Admin bar:** see `navigation.md`.

## Icons

Inline stroke SVG at a 2–2.25 stroke width with `currentColor`: chevron, arrow, moon, sun, envelope, external link, lock, pencil, grip, ×, +. Don't use icon fonts, emoji or brand logos. The GitHub button is text only: "Continue with GitHub".
