# Admin access and edit mode

## Access (GitHub SSO, one account)

- **Entry:** the Admin link in the footer goes to `/admin/`. It never appears in the header.
- **Sign-in:** "Continue with GitHub" starts a GitHub OAuth flow handled by a Cloudflare Worker (for example under `/api/auth/`).
- **Who gets in:** only one account. The Worker compares GitHub's **numeric user ID** against an allowlist of one, held in a Worker secret or env var. Compare the ID, not the username, because usernames can change. The handle shown in the UI is `@potterbotter`, which is **assumed from the repo owner, so confirm it.**
- **Wrong account:** show the "You're not the right Nathan" state. Store nothing about the visitor's GitHub account and don't log their token; discard it immediately.
- **Session:** a short-lived, `HttpOnly; Secure; SameSite=Strict` cookie.
- **Server-side checks:** every `/api/admin/*` endpoint checks the session on the server.
- **What visitors get:** the public HTML never contains admin markup or scripts. Admin views are served (or hydrated) only after the session checks out.
- **Cloudflare Access:** using it in front of `/admin/` instead of a custom OAuth flow is an acceptable alternative. Pick whichever is simpler, as long as the one-account rule and the copy above hold.

The access design above is Claude's proposal; Nathan specified "GitHub SSO, only my account".

## Edit mode (on `/`)

**Turning it on:** signing in and choosing "Edit the CV" renders `/` with the admin bar and the edit controls. "Preview as visitor" shows the plain page.

**What's editable:**

| Thing | Control | Notes |
|---|---|---|
| Result cards | Edit button, then an inline form (Metric, Theme select, Headline, Detail), then Save draft | "Drag to reorder" grip within a role |
| New result | "+ Add a result to {Company}" tile | Opens the same form, empty |
| Summary headline and lede | Inline editable | Dashed outline when editable |
| About | "Edit About" button, then a textarea | A blank line means a new paragraph |
| Skills | Add (input per group), rename/remove, synonyms | See below |

**Skill synonyms:**
- **Data shape:** each skill is `{ forms: string[], shown: number }`, matching `content/cv.json`.
- **The wordings panel:** clicking a skill chip opens it. It lists every form; the shown form has an "On the site" badge, and each other form has "Show this on the site".
  - × removes a form, but the last remaining one can't be removed.
  - Also in the panel: "Add synonym", "Remove this skill" and Done.
- **Chip badge:** chips show `+N` when synonyms exist.
- **Display:** the public site only ever renders `forms[shown]`.
- **The generator** may use any form (see `resume-generator.md`).

**Drafts and publishing:**
- Edits save to a **draft**, and the admin bar shows "N draft changes".
- **Publish** writes the content and redeploys. The simplest route: the Worker commits an updated `content/cv.json` to the repo through the GitHub API, and Cloudflare Pages rebuilds. A KV- or D1-backed store also works. **Open question:** choose one.
- After publishing, the counter reads "Published · no unsaved changes".

**Hard rule:** edit mode only edits Nathan's own content. Nothing in the system writes CV content automatically.
