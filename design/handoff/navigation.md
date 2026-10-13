# Navigation pattern

## Site map and routes

| Route | Page | Status | Notes |
|---|---|---|---|
| `/` | Generic CV (homepage) | Build | Permanent anchors below |
| `/views/` | Role views landing | Build | **New route, not in DESIGN.md.** Rename if you prefer |
| `/builder/` `/fintech/` `/climate/` | The CV, curated | Build | Same template as `/`, different `view` |
| `/builds/` | Builds landing | Build | **New route, not in DESIGN.md** |
| `/tools/job-fit/` | Job-fit assessment | Build | Visitor tool; admin unlocks the resume generator in place |
| `/tools/dpr/` | DPR calculator | Labelled placeholder | Per DESIGN.md |
| `/admin/` | Admin sign-in / home | Build | GitHub OAuth, one allowed account. Not linked from the header |

Permanent anchors on the CV (unchanged from DESIGN.md): `#summary #career-arc #experience #exp-anchorage #exp-jaris #exp-mosaic #ai-method #builds #about #skills #education #contact`. The prototype also uses `#site-build`, which is not in the permanent list. Anchors must also resolve on the curated views.

## Header (every public page)

```
[Nathan Potter / nathanpotter.dev{path}]          CV · Role views · Builds · Contact ▾   [theme]
```

- Left: name plus a mono line showing the current URL path (`nathanpotter.dev/fintech/`). Links to `/`.
- Nav items: **CV** (`/`), **Role views** (`/views/`), **Builds** (`/builds/`), **Contact** (a disclosure menu, not a page).
- Current section gets `aria-current="page"` (or `"true"` on child pages) and the filled state: `background: var(--surface-2); color: var(--ink); font-weight: 600`.
  - `/builder/` `/fintech/` `/climate/` mark **CV** current; the `/views/` landing marks **Role views**.
  - `/tools/*` mark **Builds** current.
- Theme toggle: a 44×44 icon button at the far right. Its `aria-label` reads "Switch to dark theme" or "Switch to light theme". It shows a moon in light mode and a sun in dark mode.
- Header sits above page content (`position: relative; z-index: 20`) so the contact menu overlaps the hero. **Not sticky.**

### Contact menu (`<details>` in the nav)

The summary reads "Contact" with a chevron. The panel is `--raised` with `--shadow-2`, 340px wide, right-aligned, 50px below the summary:

1. Eyebrow "Get in touch"
2. Row: `mailto:hello@nathanpotter.dev` (envelope icon, on `--surface-2`) plus a **Copy** button (JS; label changes to "Copied")
3. LinkedIn row (external-link icon, mono sub-line `in/nathan-j-potter`)
4. Divider
5. Brand-filled row: **Am I the right fit for your company?** with an arrow, linking to `/tools/job-fit/`
6. Small `--ink-2` link: "Download the CV as a PDF" (the PDF lives only here, not in the hero)

It works without JS (native `details`). Close it on outside click or Esc with a few lines of JS.

### Under 640px (phones)

- The nav collapses into a **Menu** `<details>` button. Its panel lists CV, Role views and Builds, then a divider, then the email, LinkedIn and a brand-filled "Am I the right fit?".
- The theme toggle stays visible next to Menu.

## CV page furniture

- **Left rail (desktop only, ≥ ~900px):** `flex: 1 1 200px; max-width: 220px`. Not sticky. Two blocks:
  1. **Curated for:** Full CV · Builder · Fintech · Climate. These are links to `/`, `/builder/`, `/fintech/` and `/climate/`. The current one is brand-filled with `aria-current="page"`.
  2. **On this page:** an ordered list of section anchors with a 2px `--line` left border. The active section has a 2px `--brand` left border. A scroll-spy is optional; without JS, highlight nothing.
- **Phones:** the rail is replaced by a horizontally scrolling row of view pills (same four links, 44px tall) and a "Jump to a section" `<details>`.
- **Curated-view banner:** shown only on `/builder/` `/fintech/` `/climate/`, at the top of main. It's a `--surface` card with a 4px `--brand` top border, the eyebrow "Curated for {View} roles", a focus line and a short note, plus a **Show the full CV** button linking to `/`.

## Footer

- **Homepage `/`:** a `--band` footer with `id="contact"` containing:
  - Contact: email and LinkedIn buttons, plus a "[what I'm open to]" line.
  - Site map in three columns:
    - **CV:** Full CV, Role views, Builder, Fintech, Climate
    - **Builds:** All builds, Job-fit, DPR
    - **Site:** a lock icon plus **Admin**, linking to `/admin/`
  - A "Last updated" line.
- **Every other page:** a slim `--surface` footer with "Back to the CV" on the left, and email · LinkedIn · Admin (lock icon) on the right.

## Breadcrumbs

Tool pages show a small breadcrumb above the H1: `Builds / Job-fit` and `Builds / DPR calculator`, linking to `/builds/`.

## Admin chrome (signed in only)

The admin bar is a full-width strip above the header: `--admin-bg`, `--admin-ink`, with a 3px `--accent` bottom border.

- **Left:** the badge "Edit mode" (on the CV) or "Admin" (on the job-fit page), then "Signed in with GitHub as **@handle**", then an `aria-live` draft counter.
- **Right:**
  - On the CV: Resume generator, Preview as visitor, **Publish** (brand-light fill), Sign out.
  - On the job-fit page: Edit the CV, Preview as visitor, Sign out.

None of this markup ships to visitors. Serve it only after the Worker validates the session.
