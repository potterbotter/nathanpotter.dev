# nathanpotter.dev — Design principles

**Status: principles locked 2026-10-05. Visual system and voice pending.** This file is the source of truth for how the site works. The CV chat, Claude Design and every coding session should follow it. When something changes, update it here and log the change in the README.

## Purpose

The site is the human-readable version of Nathan's résumé, and it proves the claim the résumé makes. Nathan is an AI-native generalist product manager, so the site itself is the evidence: fast, honest, well judged. Tools demonstrate AI fluency, and the write-ups show process and judgment, not just output.

**Primary visitor:** a recruiter or hiring manager, often on a phone, who skims for about 10 seconds and may never scroll.

## Principles

1. **The site is the evidence.** Every page should demonstrate judgment. Nothing is decorative unless it carries meaning.
2. **Skim first, depth on demand.** The first screen stands on its own. Detail opens on click or tap (expanders, tabs, drawers) rather than through a long scroll. This applies to tools too: a result leads with the verdict, with the evidence expandable.
3. **AI output is inspectable and correctable.** AI does the legwork and the user makes the call, so nothing the AI produces is applied silently. Fit reports cite CV evidence and state gaps plainly. Parsed inputs appear in an editable preview. "Show the math" is always available.
4. **One visual system.** Colours, type, spacing and components are defined once as CSS custom properties, and every page uses them, including the standalone CV file (which carries a copy of the token block).
5. **Lightweight by default.** Plain HTML/CSS, with small vanilla JavaScript only where something is interactive. A tool's libraries load only on that tool's page. Content is readable without JavaScript, and the hero renders instantly on a phone.
6. **Mobile first, accessible, printable.** Designed at 375px wide first. Semantic HTML, keyboard-navigable, WCAG AA contrast, respects `prefers-reduced-motion`, and supports light and dark themes. The CV prints as a clean single-column résumé, with navigation and toggles hidden and collapsed content printed expanded.
7. **Real text and stable URLs.** Name in the `<h1>`, plain section headings, no key content in images or canvas. Collapsed content stays in the DOM (hidden visually, never lazy-loaded). Every CV section and role has a permanent anchor ID, so tools and links can point to it. Tool state is shareable in the URL.
8. **Every build ships with its write-up**: what was tried, what failed, what changed. Decisions keep going into the README log.
9. **Private by default.** No cookies, and no third-party trackers beyond cookieless analytics. Public contact is `hello@nathanpotter.dev` plus LinkedIn; the phone number stays on the PDF only. API keys live server-side only.

## Structure

The generic CV is the homepage. Navigation makes the CV's role views and the tools reachable in one tap. Anything not built yet ships as a clearly labelled placeholder.

```
/                     Interactive CV, generic view (default)
/builder/  /fintech/  /climate/
                      Role views of the same CV: same facts, different order and emphasis.
                      Paths, so a tailored link is easy to send: nathanpotter.dev/fintech/?ref=acme
/tools/job-fit/       Job-fit tool, then its write-up and published test results
/tools/dpr/           Damage-per-round calculator (5e-compatible, SRD content only), then its write-up
/how-i-built-this/    Long-form site write-up
/api/…                Worker endpoints (keys, rate limits, spend caps)
```

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
- From any page, one tap reaches: the CV (home), each role view, each tool, and email.
- On the CV, a visitor can jump to any section, and the role-view switcher is visible near the hero.
- Works at 375px, by keyboard, and with JavaScript off (links still work).
- Hidden in print.

### Stable anchor IDs (CV)
`#summary` · `#career-arc` · `#experience` · `#exp-anchorage` · `#exp-jaris` · `#exp-mosaic` · `#ai-method` · `#builds` · `#about` · `#skills` · `#education` · `#contact`

## Open questions
- **Voice:** a "Nathan voice" guide or skill, so the copy, the write-ups and the tools' output sound like Nathan. Source file pending.
- **Analytics for `?ref=`:** Cloudflare Web Analytics (free) if it reports query strings, otherwise log `ref` in the Worker. Plausible is the paid fallback.
- **Grounding source for the AI tools:** a plain-text or Markdown copy of the CV kept in the repo, in sync with the page.
- **DPR calculator:** where the existing code lives and how it's brought in.

## Visual system (to come from Claude Design)

Not decided yet. The hand-off brief for Claude Design:
- **Style reference:** Nathan's prior stylized CV (use it for style only, not content).
- **Also decide:** the navigation pattern (see the requirements under Navigation).
- **Output wanted:** a token set (colour, type scale, spacing, radius, shadow) as CSS custom properties, with light and dark variants. Plus components: header/nav, segmented control (role switcher), stat block (headline numbers), role card with expander, timeline, tool panel (input → result), callout, button, link, footer.
- **Constraints:** principles 4–6 above. System fonts or at most one self-hosted font family. AA contrast in both themes. Works at 375px. No content baked into images.
