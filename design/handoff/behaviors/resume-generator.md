# Resume generator (admin only)

It lives on `/tools/job-fit/` as `#resume-generator`, rendered only for the signed-in admin and labelled "Only visible to you".

## Non-negotiable

**The generator never adds anything.** It may only:

- **select** which result cards (their `detail` text) and skills to include
- **order** them by relevance to the posting
- **trim**: drop cards, and shorten a detail by cutting clauses but never rewording claims (see the open question below)
- **choose wordings**: for each skill, pick whichever of Nathan's own `forms` best matches the posting

It must not invent results, numbers, employers, keywords, skills or synonyms. A posting keyword the CV can't back stays **missing** and is reported as missing.

## Flow

1. **The posting:** a segmented switch with three sources.
   - **Paste text:** a textarea.
   - **Link to posting:** a URL input and **Fetch**. A Worker fetches the page and strips it to text, which is shown for review before generating. If the job board blocks fetching, the UI says to paste the text instead.
   - **Use the posting above:** reuses the visitor-side job description and its fit read.
2. **Options:**
   - Company and Role title (auto-detected from the posting, editable)
   - Start from: Best match (auto) / Builder / Fintech / Climate / Full CV
   - Length: One page / Two pages
   - "Choose results by hand": a disclosure with checkboxes over every card, pre-ticked from the evidence
3. **Generate tailored resume.** After the first run the button reads "Regenerate".

## Output: the match dashboard

Four metric tiles:

| Tile | Value | Detail lines |
|---|---|---|
| Keyword match rate | % of posting keywords present in the tailored resume | "18 of 25 posting keywords"; a bar with a tick at the **untailored full CV** baseline; "N matched through your synonyms" |
| Experience fit | Strong / Partial / Weak | Breakdown rows: Years in product (7+ vs asked), Domain, Level, People leadership |
| Must-haves covered | "5 of 6" | Names the uncovered must-have; nice-to-haves count |
| Evidence used | "9 cards" | Roles drawn from, page fit, how many cards were left out |

Below the tiles:

- **Matched keywords:** chips.
- **Missing keywords:** dashed chips, with the line "These stay out unless the CV can back them. If one is true, add a result card for it in edit mode, then regenerate." and a link to edit mode.
- **Synonyms used:** a table with the columns On the site · In this resume · Why. For example: JavaScript/React · React · "The posting says 'React'". "Where none fits better, the site's wording stays." Link: Manage synonyms, going to `/#skills` in edit mode.

All numbers in the prototype are **sample values**. The real ones are computed.

## Output: the resume

- A paper-white preview that stays light in dark mode.
  - Header: name in brand teal, a 3px maroon rule, then "[Role] · tailored for [Company]" and contact (email, LinkedIn, location; **no phone number**).
  - Then the summary, roles and bullets, skills and education.
- Each bullet carries a small mono **source tag** (for example `anchorage-0`) linking it to its card id in `content/cv.json`. It shows in the preview and is left out of exports.
- **Actions:** Download PDF, Download .docx, Copy as text.

## Implementation notes

- **Keyword extraction and matching:** an LLM call through a Worker is fine. The matching should be explainable, and every number on the dashboard should be reproducible from the stored posting text plus the CV version.
- **Synonyms:** synonym choice is a lookup over Nathan's `forms`, not free generation.
- **What to log for each run:** posting text or URL, CV commit, model, prompt version and output. Keep it admin-only.

## Open question (shown in the UI)

> Not resolved: whether the summary line may be reworded per job, or only chosen from approved variants.

Until decided, use the summary verbatim.
