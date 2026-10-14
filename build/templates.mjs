// HTML templates for every public page. Structure and class names follow
// design/handoff (components.md, navigation.md, pages.md). All copy comes from content/cv.json.

const SITE = 'https://nathanpotter.dev';

// ---------- helpers ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isPlaceholder = (s) => /\[[^\]]*\]/.test(String(s ?? ''));
// Placeholder copy ([bracketed]) is hidden on the live site unless --show-placeholders.
const visible = (ctx, s) => s && (ctx.flags.showPlaceholders || !isPlaceholder(s));
export const join = (items, fn) => items.map(fn).join('');
// Admin scripts and styles carry a version so browsers fetch fresh copies after each deploy. Set on the first request:
// Workers report time 0 while the code is loading.
let assetVersion = '';
export const assetV = () => (assetVersion ||= Date.now().toString(36));
// Edit-mode hook: marks text as inline-editable at a cv.json path. Renders nothing on public pages.
export const ep = (ctx, path) => (ctx.edit ? ` data-edit-path="${esc(path)}" contenteditable="true" spellcheck="true"` : '');

export const formatDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

export const svg = (d, size = 16, stroke = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  chev: (s = 12) => svg('<path d="M6 9l6 6 6-6"/>', s, 2.25).replace('<svg', '<svg class="chev"'),
  arrow: (s = 16) => svg('<path d="M5 12h14M13 6l6 6-6 6"/>', s, 2.25),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', 18).replace('<svg', '<svg class="i-moon"'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 18).replace('<svg', '<svg class="i-sun"'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 14),
  lockBig: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 28),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', 13, 2.25),
  grip: svg('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>', 14),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 14, 2.5),
};

const linkedinHandle = (url) => url.replace(/^https?:\/\/(www\.)?linkedin\.com\//, '').replace(/\/$/, '');

// ---------- layout ----------
// Applies a saved light/dark choice before first paint. The only inline script on the site: the CSP allows it by hash
// (tests/csp.test.mjs), so every page must use this exact text.
const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();</script>`;

export function layout(ctx, { title, description, path, current, main, footer = 'slim', jsonld = '', noindex = false, admin = '', bare = false, pageType = '', scripts = '' }) {
  const url = SITE + path;
  if (admin) noindex = true;
  return `<!doctype html>
<html lang="en"${pageType ? ` data-page="${esc(pageType)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${url}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0F6E73" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B2F32" media="(prefers-color-scheme: dark)">
${THEME_SCRIPT}
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/site.css">
<script src="/assets/js/site.js" defer></script>
${admin ? '<link rel="stylesheet" href="/admin/assets/admin.css?v=' + assetV() + '">\n' : ''}${scripts}${ctx.edit ? '<script src="/admin/assets/admin.js?v=' + assetV() + '" defer></script>\n' : ''}${jsonld}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${admin}
${bare ? bareHeader(ctx) : header(ctx, path, current)}
${main}
${bare ? '' : footer === 'band' ? bandFooter(ctx) : slimFooter(ctx)}
</body>
</html>
`;
}

function header(ctx, path, current) {
  const { person } = ctx.cv;
  const nav = [
    ['cv', '/', 'CV'],
    ['views', '/views/', 'Role views'],
    ['builds', '/builds/', 'Builds'],
  ];
  const navLinks = join(nav, ([key, href, label]) =>
    `<a class="navlink" href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`);
  const fitRow = ctx.flags.jobFitLive
    ? `<div class="divider"></div><a class="menu-row menu-row--brand" href="/tools/job-fit/">Am I the right fit for your company? ${I.arrow()}</a>`
    : '';
  const pdfRow = ctx.flags.pdfLive ? `<a class="menu-row menu-row--small" href="/nathan-potter-resume.pdf">Download the CV as a PDF</a>` : '';
  return `<header class="site-header noprint">
<div class="wrap">
<div class="header-actions">
<nav class="nav-wide" aria-label="Site">
${navLinks}
<details class="menu">
<summary class="navlink">Contact ${I.chev()}</summary>
<div class="menu-panel" role="group" aria-label="Contact">
<p class="label">Get in touch</p>
<div class="menu-split">
<a class="menu-row menu-row--fill" href="mailto:${esc(person.email)}">${I.mail} ${esc(person.email)}</a>
<button type="button" class="copy-btn" data-copy="${esc(person.email)}" aria-label="Copy email address" hidden>Copy</button>
</div>
<a class="menu-row menu-row--line" href="${esc(person.linkedin)}">${I.external}<span><span>LinkedIn</span><span class="sub">${esc(linkedinHandle(person.linkedin))}</span></span></a>
${fitRow}
${pdfRow}
</div>
</details>
</nav>
<details class="menu nav-compact">
<summary class="menu-btn">Menu ${I.chev(14)}</summary>
<nav class="menu-panel" aria-label="Site">
${join(nav, ([key, href, label]) => `<a class="menu-row" href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`)}
<div class="divider"></div>
<a class="menu-row" href="mailto:${esc(person.email)}">${esc(person.email)}</a>
<a class="menu-row" href="${esc(person.linkedin)}">LinkedIn</a>
${ctx.flags.jobFitLive ? `<a class="menu-row menu-row--brand" href="/tools/job-fit/">Am I the right fit?</a>` : ''}
</nav>
</details>
<button type="button" class="icon-btn theme-toggle" aria-label="Switch theme" hidden>${I.moon}${I.sun}</button>
</div>
</div>
</header>`;
}

function bandFooter(ctx) {
  const { person } = ctx.cv;
  const openTo = ctx.cv.contact?.openTo;
  return `<footer id="contact" class="footer-band" aria-labelledby="h-contact">
<div class="wrap">
<div class="footer-contact">
<h2 id="h-contact">Contact</h2>
${visible(ctx, openTo) ? `<p class="open-to"${ep(ctx, 'contact.openTo')}>${esc(openTo)}</p>` : ''}
<div class="footer-buttons">
<a class="btn btn--on-band" href="mailto:${esc(person.email)}">${esc(person.email)}</a>
<a class="btn btn--outline-band" href="${esc(person.linkedin)}">LinkedIn</a>
</div>
</div>
<nav class="sitemap noprint" aria-label="Site map">
<div><span class="eyebrow">CV</span><a href="/">Full CV</a><a href="/views/">Role views</a>${join(curatedViews(ctx.cv), (k) => `<a href="${ctx.cv.views[k].path}">${esc(ctx.cv.views[k].label)}</a>`)}</div>
<div><span class="eyebrow">Builds</span><a href="/builds/">All builds</a><a href="/tools/job-fit/">Job-fit</a><a href="/tools/dpr/">DPR calculator</a></div>
${ctx.flags.adminLive ? `<div><span class="eyebrow">Site</span><a href="/sign-in/">${I.lock}Admin</a></div>` : ''}
</nav>
<p class="updated">Last updated ${esc(ctx.updated)}</p>
</div>
</footer>`;
}

function slimFooter(ctx) {
  const { person } = ctx.cv;
  return `<footer class="footer-slim noprint">
<div class="wrap">
<a href="/">Back to the CV</a>
<nav aria-label="Contact">
<a href="mailto:${esc(person.email)}">${esc(person.email)}</a>
<a href="${esc(person.linkedin)}">LinkedIn</a>
${ctx.flags.adminLive ? `<a href="/sign-in/">${I.lock}Admin</a>` : ''}
</nav>
</div>
</footer>`;
}

function fitCta(ctx, variant) {
  if (!ctx.flags.jobFitLive) return '';
  if (variant === 'hero') {
    return `<a class="cta cta--hero noprint" href="/tools/job-fit/">
<span class="cta-text"><span class="cta-title">Am I the right fit for your company?</span><span class="cta-sub">Paste a job description or link. Get a fit read that distills my experience into what matters to you.</span></span>
<span class="cta-arrow" aria-hidden="true">${I.arrow(22)}</span>
</a>`;
  }
  return `<a class="cta cta--band noprint" href="/tools/job-fit/">
<span class="cta-text"><span class="eyebrow">Hiring?</span><span class="cta-title">Am I the right fit for your company?</span><span class="cta-sub">Paste the job description and see where I fit, with the evidence.</span></span>
<span class="cta-arrow" aria-hidden="true">${I.arrow(22)}</span>
</a>`;
}

// Curated role views, in cv.json order (keys starting with _ are notes).
export const curatedViews = (cv) => Object.keys(cv.views).filter((k) => k !== 'all' && !k.startsWith('_'));

// ---------- CV page (/ and each role view) ----------
// ctx.edit (admin only) adds edit hooks and controls; ctx.adminBar is the admin strip's HTML.
export function cvPage(ctx, viewKey) {
  const { cv } = ctx;
  const view = cv.views[viewKey];
  const curated = viewKey !== 'all';
  const viewKeys = ['all', ...curatedViews(cv)];
  const aboutParas = ctx.edit ? cv.about : cv.about.filter((p) => visible(ctx, p));
  const steps = cv.aiMethod.steps.map((s, i) => ({ ...s, i })).filter((s) => visible(ctx, s.title) && visible(ctx, s.body));

  const sections = [
    ['summary', 'Summary'],
    ['career-arc', 'Career arc'],
    ['experience', 'Experience'],
    ['ai-method', 'How I work with AI'],
    ['builds', 'Builds'],
    (aboutParas.length || ctx.edit) && ['about', 'About'],
    ['skills', 'Skills'],
    ['education', 'Education'],
    ['site-build', 'How this site was built'],
    ['contact', 'Contact'],
  ].filter(Boolean);

  const viewLinks = (cls) => join(viewKeys, (k) =>
    `<a href="${cv.views[k].path}"${k === viewKey ? ' aria-current="page"' : ''}>${esc(cv.views[k].label)}</a>`);

  const hero = `<section id="summary" class="band hero" aria-labelledby="h-summary">
<div class="wrap">
<p class="eyebrow">${esc(cv.person.title)} · ${esc(cv.person.location)}</p>
<div class="hero-title"><h1 id="h-summary">${esc(cv.person.name)}</h1><div class="rule"></div></div>
<div class="hero-copy">
<p class="hero-headline"${ep(ctx, 'summary.headline')}>${esc(cv.summary.headline)}</p>
<p class="hero-lede"${ep(ctx, 'summary.lede')}>${esc(cv.summary.lede)}</p>
</div>
<ul class="metrics" aria-label="Key numbers">
${join(cv.heroMetrics, (m) => `<li><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></li>`)}
</ul>
${fitCta(ctx, 'hero')}
</div>
</section>`;

  const rail = `<aside class="rail noprint" aria-label="On this page">
<nav aria-label="Views of this CV"><p class="eyebrow muted">Curated for</p><div class="views">${viewLinks()}</div></nav>
<nav aria-label="Sections"><p class="eyebrow muted">On this page</p>
<ol>${join(sections, ([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`)}</ol>
</nav>
</aside>`;

  const compactNav = `<div class="compact-nav noprint">
<nav class="pills" aria-label="Views of this CV">${viewLinks()}</nav>
<details class="jump"><summary>Jump to a section ${I.chev(16)}</summary>
<nav aria-label="Sections">${join(sections.slice(1), ([id, label]) => `<a href="#${id}">${esc(label)}</a>`)}</nav>
</details>
</div>`;

  const banner = curated ? `<section class="view-banner" aria-label="About this view">
<div>
<p class="eyebrow">Curated for ${esc(view.label)} roles</p>
<p class="focus">${esc(view.focus)}</p>
<p class="note">${esc(cv.views._bannerNote)}</p>
</div>
<a class="btn btn--secondary" href="/">Show the full CV</a>
</section>` : '';

  const arc = `<section id="career-arc" class="section" aria-labelledby="h-arc">
<header class="section-head"><h2 id="h-arc">Career arc</h2><p class="section-lede"${ep(ctx, 'careerArc.intro')}>${esc(cv.careerArc.intro)}</p></header>
<ol class="arc">
${join(cv.careerArc.stops, (s) => `<li${s.current ? ' class="current"' : ''}><span class="years">${esc(s.years)}</span><span class="industry">${esc(s.industry)}</span><a href="${esc(s.anchor)}">${esc(s.company)}</a><span class="muted">${esc(s.line)}</span></li>`)}
</ol>
</section>`;

  const builds = buildsSection(ctx);

  const about = (aboutParas.length || ctx.edit) ? `<section id="about" class="section" aria-labelledby="h-about">
<div class="section-head section-head--row"><h2 id="h-about">About</h2>${ctx.edit ? `<button type="button" class="edit-btn" data-edit-about>${I.pencil}Edit About</button>` : ''}</div>
<div class="prose" data-about>${join(aboutParas, (p) => `<p>${esc(p)}</p>`)}</div>
</section>` : '';

  // Public: plain text. Edit mode: every skill is a button that opens its wordings panel.
  const skillItems = (g, gi) => {
    if (!ctx.edit) {
      return g.display === 'line'
        ? `<p>${esc(g.items.map((i) => i.forms[i.shown]).join(' · '))}</p>`
        : `<div class="skill-chips">${join(g.items, (i) => `<span class="skill">${esc(i.forms[i.shown])}</span>`)}</div>`;
    }
    return `<div class="skill-edit" data-skill-group="${gi}">
<div class="skill-chips">${join(g.items, (s, si) => `<button type="button" class="skill skill--edit" data-skill="${gi}.${si}" aria-expanded="false">${esc(s.forms[s.shown])}${s.forms.length > 1 ? `<span class="syn-count">+${s.forms.length - 1}</span>` : ''}</button>`)}</div>
<div class="skill-panel-slot"></div>
<div class="inline-add"><input type="text" placeholder="Add a skill" aria-label="Add a skill to ${esc(g.name)}" data-add-skill-input="${gi}"><button type="button" class="edit-btn" data-add-skill="${gi}">${I.plus}Add</button></div>
</div>`;
  };

  const skills = `<div class="two-col">
<section id="skills" class="section" aria-labelledby="h-skills">
<h2 id="h-skills">Skills</h2>
${ctx.edit ? '<p class="muted edit-hint">Click a skill to add synonyms and pick which wording the site shows. The résumé generator can use any of them.</p>' : ''}
${join(cv.skills.groups, (g, gi) => `<div class="skill-group"><h3>${esc(g.name)}</h3>${skillItems(g, gi)}</div>`)}
</section>
<section id="education" class="section" aria-labelledby="h-edu">
<h2 id="h-edu">Education</h2>
${join(cv.education, (e) => `<div class="edu"><strong>${esc(e.school)}</strong><span class="muted">${esc(e.detail)}</span></div>`)}
</section>
</div>`;

  const sb = cv.siteBuild;
  const siteBuild = `<section id="site-build" class="section site-build" aria-labelledby="h-site">
<h2 id="h-site">How this site was built</h2>
${visible(ctx, sb.intro) ? `<p class="muted measure"${ep(ctx, 'siteBuild.intro')}>${esc(sb.intro)}</p>` : ''}
<details${ctx.edit ? ' open' : ''}><summary>Stack and decisions ${I.chev(14)}</summary>
<ul>${join(sb.stack.map((s, i) => [s, i]).filter(([s]) => visible(ctx, s)), ([s, i]) => `<li${ep(ctx, `siteBuild.stack.${i}`)}>${esc(s)}</li>`)}<li>The code and the decision log are public: <a href="${esc(sb.repo)}">${esc(sb.repo.replace('https://', ''))}</a>.</li></ul>
</details>
</section>`;

  const main = `<div class="wrap cv-body">
${rail}
<main id="main" class="cv-main">
${compactNav}
${banner}
${arc}
${experienceSection(ctx, viewKey)}
<section id="ai-method" class="section" aria-labelledby="h-ai">
<header class="section-head"><h2 id="h-ai">How I work with AI</h2><p class="section-lede"${ep(ctx, 'aiMethod.intro')}>${esc(cv.aiMethod.intro)}</p></header>
${steps.length ? `<ol class="steps">${join(steps, (s) => `<li><span class="n">${esc(s.n)}</span><strong${ep(ctx, `aiMethod.steps.${s.i}.title`)}>${esc(s.title)}</strong><span class="muted"${ep(ctx, `aiMethod.steps.${s.i}.body`)}>${esc(s.body)}</span></li>`)}</ol>` : ''}
</section>
${builds}
${about}
${skills}
${siteBuild}
</main>
</div>`;

  const title = curated ? `${cv.person.name} — CV, curated for ${view.label} roles` : `${cv.person.name} — ${cv.person.title}`;
  const description = curated ? `${view.focus} ${cv.summary.headline}` : `${cv.summary.headline} ${cv.summary.lede}`;
  return layout(ctx, {
    title, description, path: view.path, current: 'cv', footer: 'band', jsonld: ctx.adminBar ? '' : personJsonLd(cv),
    main: `${hero}\n${main}`, admin: ctx.adminBar || '',
  });
}

function experienceSection(ctx, viewKey) {
  const { cv } = ctx;
  const view = cv.views[viewKey];
  const curated = viewKey !== 'all';
  const roles = view.roleOrder.map((a) => cv.experience.roles.find((r) => r.anchor === a));
  const total = cv.experience.roles.reduce((n, r) => n + r.cards.length, 0);
  const upFront = (card, role) => !curated
    || (view.upFrontCards || []).includes(card.id)
    || (view.upFrontTags || []).includes(card.tag)
    || (view.upFrontRoles || []).includes(role.anchor);
  const upFrontCount = roles.reduce((n, r) => n + r.cards.filter((c) => upFront(c, r)).length, 0);

  const counts = Object.fromEntries(cv.experience.tags.map((t) => [t, 0]));
  cv.experience.roles.forEach((r) => r.cards.forEach((c) => counts[c.tag]++));
  const statusText = curated
    ? `${upFrontCount} of ${total} results up front for ${view.label}. The rest are one click away.`
    : `${total} results across ${roles.length} roles`;

  const filters = curated
    ? `<p class="status-line" aria-live="polite">${esc(statusText)}</p>`
    : `<div class="filters noprint" hidden>
<div class="chips" role="group" aria-label="Highlight results by theme">
${join(cv.experience.tags.filter((t) => counts[t]), (t) => `<button type="button" class="chip-btn" aria-pressed="false" data-tag="${esc(t)}">${esc(t)} <span class="count">${counts[t]}</span></button>`)}
</div>
<p class="status-line" aria-live="polite">${esc(statusText)}</p>
</div>`;

  const editFoot = ctx.edit ? `<div class="card__edit noprint">
<span class="grip" title="Drag to reorder">${I.grip}Drag to reorder</span>
<span class="card__edit-actions"><button type="button" class="move-btn" data-move="-1" aria-label="Move earlier">←</button><button type="button" class="move-btn" data-move="1" aria-label="Move later">→</button><button type="button" class="edit-btn" data-edit-card>${I.pencil}Edit</button></span>
</div>` : '';

  const card = (c) => `<li class="card" id="${esc(c.id)}" data-tag="${esc(c.tag)}"${ctx.edit ? ' draggable="true"' : ''}>
<div class="card__top"><span class="card__metric">${esc(c.metric)}</span><span class="tag">${esc(c.tag)}</span></div>
<p class="card__headline">${esc(c.headline)}</p>
<details><summary>Detail ${I.chev()}</summary><p>${esc(c.detail)}</p></details>
${editFoot}
</li>`;

  const roleBlock = (r) => {
    const ri = cv.experience.roles.indexOf(r);
    const shown = r.cards.filter((c) => upFront(c, r));
    const folded = r.cards.filter((c) => !upFront(c, r));
    const moreLabel = shown.length ? `Show ${folded.length} more from ${r.company}` : `Show ${folded.length} results from ${r.company}`;
    const addTile = ctx.edit ? `<li class="add-tile noprint"><button type="button" data-add-card="${esc(r.anchor)}">${I.plus}Add a result to ${esc(r.company)}</button></li>` : '';
    return `<article id="${esc(r.anchor)}" class="role" aria-labelledby="h-${esc(r.anchor)}">
<header class="role-head">
<div><h3 id="h-${esc(r.anchor)}">${esc(r.company)} <span class="kind">· ${esc(r.kind)}</span></h3><span class="title">${esc(r.title)}</span></div>
<span class="dates">${esc(r.dates)}</span>
</header>
${r.note ? `<p class="role-note"${ep(ctx, `experience.roles.${ri}.note`)}>${esc(r.note)}</p>` : ''}
${shown.length || ctx.edit ? `<ul class="cards" data-role="${esc(r.anchor)}">${join(shown, card)}${addTile}</ul>` : ''}
${folded.length ? `<details class="more"><summary>${esc(moreLabel)} ${I.chev()}</summary><ul class="cards">${join(folded, card)}</ul></details>` : ''}
</article>`;
  };

  return `<section id="experience" class="section" aria-labelledby="h-exp">
<header class="section-head"><h2 id="h-exp">Experience</h2>${cv.experience.intro || ctx.edit ? `<p class="section-lede"${ep(ctx, 'experience.intro')}>${esc(cv.experience.intro)}</p>` : ''}
${filters}
</header>
${join(roles, roleBlock)}
${fitCta(ctx, 'band')}
</section>`;
}

function buildTile(ctx, b, { large = false } = {}) {
  const live = b.route === '/tools/job-fit/' ? ctx.flags.jobFitLive : b.status === 'live';
  return `<a class="tile${live ? '' : ' tile--unbuilt'}" href="${esc(b.route)}">
<span class="tile__head"><span class="tile__name">${esc(b.name)}</span><span class="status${live ? '' : ' status--unbuilt'}">${live ? 'Live' : 'Not built yet'}</span></span>
<span class="muted">${esc(b.summary)}</span>
${large && !live ? '<span class="striped">Preview when it ships</span>' : ''}
<span class="tile__action">${live ? 'Try it' : 'See the placeholder'}</span>
</a>`;
}

function buildsSection(ctx) {
  const tools = ctx.cv.builds.filter((b) => b.route.startsWith('/tools/'));
  return `<section id="builds" class="section" aria-labelledby="h-builds">
<header class="section-head section-head--row">
<div class="section-head"><h2 id="h-builds">Builds</h2><p class="section-lede">Interactive things I've built on my own time. Try them.</p></div>
<a class="textlink" href="/builds/">All builds</a>
</header>
<div class="tiles">${join(tools, (b) => buildTile(ctx, b))}</div>
</section>`;
}

function personJsonLd(cv) {
  const current = cv.experience.roles[0];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: cv.person.name,
    jobTitle: cv.person.title,
    url: SITE + '/',
    email: 'mailto:' + cv.person.email,
    sameAs: [cv.person.linkedin],
    address: { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' },
    worksFor: { '@type': 'Organization', name: current.company },
    alumniOf: { '@type': 'CollegeOrUniversity', name: cv.education[0].school },
    knowsAbout: cv.skills.groups.flatMap((g) => g.items.map((i) => i.forms[i.shown])),
    description: cv.summary.headline,
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n`;
}

// ---------- /views/ ----------
export function viewsPage(ctx) {
  const { cv } = ctx;
  const L = cv.viewsLanding;
  const keys = curatedViews(cv);
  const card = (k) => {
    const v = cv.views[k];
    return `<a class="tile view-card" href="${v.path}">
<span class="tile__head"><span class="tile__name">${esc(v.label)}</span><span class="route">${esc(v.path)}</span></span>
<span class="muted">${esc(v.landing.for)}</span>
<span class="label">Up front</span>
<ul class="upfront">${join(v.landing.upFront, (u) => `<li><strong>${esc(u.metric)}</strong><span>${esc(u.text)}</span></li>`)}</ul>
<span class="tile__foot">${esc(v.landing.cta)}<span class="dot-arrow">${I.arrow()}</span></span>
</a>`;
  };
  const main = `<main id="main">
<section class="band hero"><div class="wrap">
<p class="eyebrow">${esc(L.eyebrow)}</p>
<div class="hero-title"><h1>${esc(L.title)}</h1><div class="rule"></div></div>
<p class="hero-lede measure">${esc(L.lede)}</p>
</div></section>
<div class="wrap page-main" style="padding-top: var(--sp-7)">
<section class="carousel" aria-roledescription="carousel" aria-label="Role views">
<div class="carousel__nav noprint" hidden>${join(keys, (k, i) => `<button type="button" class="chip-btn" data-go="${i}">${esc(cv.views[k].label)}</button>`)}</div>
<div class="carousel__stage">
<button type="button" class="carousel__btn carousel__btn--prev noprint" aria-label="Previous view" hidden>${I.arrow(20)}</button>
<ul class="tiles tiles--views carousel__track">${join(keys, (k, i) => `<li class="carousel__slide" aria-roledescription="slide" aria-label="${esc(cv.views[k].label)}, ${i + 1} of ${keys.length}">${card(k)}</li>`)}</ul>
<button type="button" class="carousel__btn carousel__btn--next noprint" aria-label="Next view" hidden>${I.arrow(20)}</button>
</div>
<p class="sr-only" aria-live="polite" data-carousel-status></p>
</section>
<div class="tiles">
<a class="dashed-card" href="/"><strong>Not sure?</strong><span class="tile__action">Read the full CV</span></a>
${ctx.flags.jobFitLive ? `<a class="cta cta--band" href="/tools/job-fit/"><span class="cta-text"><span class="eyebrow">Hiring for one specific role?</span><span class="cta-title">Am I the right fit for your company?</span></span><span class="cta-arrow" aria-hidden="true">${I.arrow(22)}</span></a>` : ''}
</div>
</div>
</main>`;
  return layout(ctx, { title: `Role views — ${cv.person.name}`, description: L.lede, path: L.route, current: 'views', main });
}

// ---------- /builds/ ----------
export function buildsPage(ctx) {
  const { cv } = ctx;
  const tools = cv.builds.filter((b) => b.route.startsWith('/tools/'));
  const others = cv.builds.filter((b) => !b.route.startsWith('/tools/'));
  const main = `<main id="main" class="wrap">
<header class="page-title">
<h1>Builds</h1><div class="rule"></div>
<p class="lede">Things I've built on my own time. The interactive ones come first: you can try them, and each has a write-up on the decisions behind it.</p>
</header>
<div class="page-main">
<section class="section" aria-labelledby="h-try"><h2 id="h-try">Try it yourself</h2>
<div class="tiles">${join(tools, (b) => buildTile(ctx, b, { large: true }))}</div>
</section>
<section class="section" aria-labelledby="h-other"><h2 id="h-other">Other things I've built</h2>
<ul class="ruled">${join(others, (b) => `<li><div><strong>${esc(b.name)}</strong><span class="muted">${esc(b.summary)}</span></div><a class="textlink" href="${esc(b.route)}">Read how</a></li>`)}</ul>
</section>
${fitCta(ctx, 'band')}
</div>
</main>`;
  return layout(ctx, { title: `Builds — ${cv.person.name}`, description: 'Things Nathan Potter has built, with write-ups on the decisions behind them.', path: '/builds/', current: 'builds', main });
}

// ---------- /tools/job-fit/ ----------
// The posting form, shared by the public tool and the admin test bench.
export function fitForm(cv, { bench = false, compare = false, turnstile = '' } = {}) {
  const jf = cv.jobFit;
  return `<form class="fit-form" data-fit-form novalidate>
<div class="fit-link" data-fit-link hidden>
<label for="jd-url">Link to the posting</label>
<div class="fit-link__row"><input id="jd-url" type="url" inputmode="url" autocomplete="off" placeholder="https://jobs.lever.co/…"><button type="button" class="btn btn--secondary" data-fit-fetch>Fetch</button></div>
<p class="muted small" data-fit-fetch-status aria-live="polite">Works best with Greenhouse, Lever and Ashby links. For LinkedIn or Indeed, paste the text below.</p>
<p class="fit-or" aria-hidden="true">or paste it</p>
</div>
<label for="jd">Job description</label>
<textarea id="jd" name="jd" rows="${bench ? 10 : 16}" maxlength="15000" required placeholder="Paste the full posting: responsibilities, requirements, nice-to-haves."></textarea>
<p class="fit-count muted small" data-fit-count aria-live="polite"></p>
${bench ? `<label class="check"><input type="checkbox" data-fit-use-draft checked> Assess against my unpublished draft</label>
${compare ? '<label class="check"><input type="checkbox" data-fit-compare> Compare Opus and Sonnet side by side</label>' : ''}` : ''}
${turnstile ? `<div class="cf-turnstile" data-sitekey="${esc(turnstile)}" data-appearance="interaction-only" data-size="flexible"></div>` : ''}
<div class="row-links">
<button type="submit" class="btn btn--primary" data-fit-submit>Assess</button>
<button type="button" class="btn btn--secondary" data-fit-clear>Clear</button>
</div>
${bench ? '' : `<p class="muted small">${esc(jf.dataNote)}</p>
<noscript><p class="small">This tool needs JavaScript. You can also email the posting to <a href="mailto:${esc(cv.person.email)}">${esc(cv.person.email)}</a>.</p></noscript>`}
</form>`;
}

// Settings for jobfit.js as a JSON data block: it never executes, so the Content-Security-Policy needs no exception.
export const fitScripts = (cv, extra = {}) => `<script type="application/json" id="np-fit-config">${JSON.stringify({ email: cv.person.email, method: cv.jobFit.method, ...extra }).replace(/</g, '\\u003c')}</script>\n<script src="/assets/js/jobfit.js" defer></script>\n`;

// The public job-fit page: the form, the streamed read and the write-up.
export function jobFitPage(ctx) {
  const { cv } = ctx;
  const jf = cv.jobFit;
  const main = `<main id="main" class="wrap">
<header class="page-title">
<p class="crumbs"><a href="/builds/">Builds</a> / Job-fit</p>
<h1>Am I the right fit for your company?</h1><div class="rule"></div>
<p class="lede">${esc(jf.lede)}</p>
</header>
<div class="page-main">
<div class="fit-layout">
${fitForm(cv, { turnstile: ctx.flags.turnstileSiteKey })}
<section class="fit-read" aria-labelledby="h-read">
<h2 id="h-read">The read</h2>
<div data-fit-read aria-live="polite">
<p class="muted">The read appears here: an overall verdict, each requirement with the evidence quoted from my CV, and anything the posting leaves open.</p>
</div>
</section>
</div>
</div>
</main>`;
  return layout(ctx, {
    title: `Job-fit assessment — ${cv.person.name}`, description: jf.lede, path: '/tools/job-fit/', current: 'builds', main,
    noindex: !ctx.flags.jobFitLive,
    scripts: fitScripts(cv) + (ctx.flags.turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>\n' : ''),
  });
}

// ---------- labelled placeholders for unbuilt tools ----------
export function placeholderPage(ctx, kind) {
  const { cv } = ctx;
  const b = cv.builds.find((x) => x.route === `/tools/${kind}/`);
  const h1 = kind === 'job-fit' ? 'Am I the right fit for your company?' : b.name;
  const crumb = kind === 'job-fit' ? 'Job-fit' : 'DPR calculator';
  const main = `<main id="main" class="wrap">
<header class="page-title">
<p class="crumbs"><a href="/builds/">Builds</a> / ${esc(crumb)}</p>
</header>
<div class="page-main">
<section class="placeholder-card">
<span class="badge">Placeholder · not built yet</span>
<h1>${esc(h1)}</h1>
<p class="muted measure">${esc(b.summary)}</p>
</section>
<div class="row-links">
${kind === 'dpr' && ctx.flags.jobFitLive ? '<a class="btn btn--primary" href="/tools/job-fit/">Try the job-fit tool instead</a>' : ''}
<a class="btn btn--secondary" href="/">Back to the CV</a>
</div>
</div>
</main>`;
  return layout(ctx, { title: `${h1} — ${cv.person.name}`, description: b.summary, path: b.route, current: 'builds', main, noindex: true });
}

// ---------- sign-in (admin pages live in the private admin repo and reuse layout, esc, join and I from here) ----------
function bareHeader(ctx) {
  return `<header class="site-header noprint"><div class="wrap">
<a class="brand-link" href="/"><strong>${esc(ctx.cv.person.name)}</strong><span>nathanpotter.dev</span></a>
<a class="textlink" href="/">Back to the CV</a>
</div></header>`;
}

// Public page. The button enters /admin/, where Cloudflare Access asks GitHub who you are.
export function signInPage(ctx) {
  const main = `<main id="main" class="wrap admin-center">
<section class="gate-card">
<span class="gate-icon">${I.lockBig}</span>
<h1>Admin</h1>
<p class="muted">Confirm you are, in fact, ${esc(ctx.cv.person.name)}.</p>
<a class="btn btn--dark" href="/admin/">Continue with GitHub</a>
</section>
</main>`;
  return layout(ctx, { title: `Admin — ${ctx.cv.person.name}`, description: 'Admin sign-in.', path: '/sign-in/', current: null, main, noindex: true, bare: true });
}

export function notFoundPage(ctx) {
  const main = `<main id="main" class="wrap">
<header class="page-title"><h1>Nothing here.</h1><div class="rule"></div><p class="lede">That page doesn't exist, or it moved.</p></header>
<div class="page-main"><div class="row-links"><a class="btn btn--primary" href="/">Back to the CV</a><a class="btn btn--secondary" href="/builds/">See the builds</a></div></div>
</main>`;
  return layout(ctx, { title: `Not found — ${ctx.cv.person.name}`, description: 'Page not found.', path: '/404', current: null, main, noindex: true, pageType: '404' });
}

// ---------- /tools/dpr/ ----------
// The landing page stays in the site's own style; the calculator itself is a separate, fully themed page.
export function dprPage(ctx) {
  const { cv } = ctx;
  const b = cv.builds.find((x) => x.route === '/tools/dpr/');
  const main = `<main id="main" class="wrap">
<header class="page-title">
<p class="crumbs"><a href="/builds/">Builds</a> / DPR calculator</p>
<h1>${esc(b.name)}</h1><div class="rule"></div>
<p class="lede">${esc(b.summary)}</p>
</header>
<div class="page-main">
<div class="row-links">
<a class="btn btn--primary" href="/tools/dpr/app/">Open the calculator ${I.arrow()}</a>
<a class="btn btn--secondary" href="/builds/">All builds</a>
</div>
<section class="section" aria-labelledby="h-does">
<h2 id="h-does">What it does</h2>
<ul class="fit-list measure">
<li>Compares up to four fighters, each with up to six kinds of attack.</li>
<li>Works out hit, crit and miss chances, average damage, a typical round and a big round, for every armour class in the range you pick.</li>
<li>Shows who out-damages whom, round by round, when two fighters are on the page.</li>
<li>Starts from six level 5 example builds, or from presets other visitors have saved. You can save your own too. Saved presets are public: anyone who uses the calculator can see and load them.</li>
<li>Downloads the full results as a CSV.</li>
</ul>
</section>
<section class="section" id="how" aria-labelledby="h-how">
<h2 id="h-how">How it's built</h2>
<div class="measure stack">
<p>I first built this as a Python app to compare characters from my own game. That version simulated 100,000 rounds for each armour class. This one works out the exact chance of every possible damage total instead, so the same build always gets the same answer, and it's fast enough to recalculate as you type. I checked it against the old simulation: hit chances match exactly, and average damage lands within the simulation's own margin of error.</p>
<p>The original also supported exploding dice and bigger dice against Large targets. Both were house rules from my table, so I left them out here and kept to standard 5e mechanics.</p>
<p>The lettering is Sanguine Eye, a blackletter typeface I made. I used ChatGPT to generate alternate versions of several letters, so repeated letters don't look stamped. It has no numerals, so I kept it to the titles. Everything else is in Fondamento, a quill hand by Brian J. Bonislawsky, released under the SIL Open Font License.</p>
<p>Shared presets are the one part with a server behind it. Saves go through a bot check and per-visitor limits, and only numbers and short names are ever stored. I can hide a preset if something inappropriate gets through.</p>
<p>What it doesn't do yet: once-per-turn damage like Sneak Attack, and effects that only trigger when another attack hits. Both need the engine to treat a round's attacks as linked rather than independent, which is the next thing I'd add.</p>
</div>
</section>
</div>
</main>`;
  return layout(ctx, { title: `${b.name} — ${cv.person.name}`, description: b.summary, path: b.route, current: 'builds', main });
}

// The calculator: a standalone page in the "Scribe's sketch" style (design: the DPR canvas, Sketch boards). It doesn't
// use the site layout, but keeps the same theme script, icons and analytics. dpr.js renders the fighters and results.
export function dprAppPage(ctx) {
  const { cv } = ctx;
  const config = JSON.stringify({ turnstileSiteKey: ctx.flags.turnstileSiteKey || '' }).replace(/</g, '\\u003c');
  const description = 'Compare damage per round for 5e-compatible builds across a range of armour classes. Exact odds, not a simulation.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Damage per round calculator — ${esc(cv.person.name)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/tools/dpr/app/">
<meta property="og:type" content="website">
<meta property="og:title" content="Damage per round calculator">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}/tools/dpr/app/">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#D6C094" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1E160F" media="(prefers-color-scheme: dark)">
${THEME_SCRIPT}
<link rel="preload" href="/assets/fonts/fondamento.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/assets/fonts/sanguine-eye-v9.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/assets/css/dpr.css">
<script type="application/json" id="np-dpr-config">${config}</script>
<script type="module" src="/assets/js/dpr.js"></script>
<script src="/assets/js/site.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to the calculator</a>
<div class="desk">
<svg class="desk__texture" aria-hidden="true" focusable="false">
<filter id="sk-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.16  0 0 0 0.5 0"/></filter>
<filter id="sk-mottle"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="4" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.15  0 0 0 0.9 -0.32"/></filter>
<rect width="100%" height="100%" filter="url(#sk-mottle)"/>
<rect width="100%" height="100%" filter="url(#sk-grain)" opacity=".55"/>
</svg>
<div class="sheet-wrap">
<main id="main" class="sheet">

<header class="head">
<a class="back" href="/tools/dpr/">About this calculator</a>
<h1 class="title">Damage per Round</h1>
<svg class="underline" width="360" height="10" viewBox="0 0 360 10" aria-hidden="true"><path d="M1 5.2 L40 4.3 L130 3.5 L260 3.9 L359 4.8 L359 5.6 L260 6.3 L130 6.9 L40 6.1 Z"/></svg>
<p class="lede">Notes on who hits harder, for 5e-compatible games. Set the fighters down below, pick a range of armour, and the sums come out exact.</p>
</header>

<section class="section" aria-labelledby="h-terms">
<h2 id="h-terms" class="h2">The terms</h2>
<div class="terms">
<label>Lowest AC<input id="ac-min" type="number" inputmode="numeric" min="1" max="40" step="1"></label>
<label>Highest AC<input id="ac-max" type="number" inputmode="numeric" min="1" max="40" step="1"></label>
<label>Look closely at AC<input id="ac-focus" type="number" inputmode="numeric" min="1" max="40" step="1"></label>
</div>
<div class="checks">
<label class="check"><input id="nat1" type="checkbox">A natural 1 always misses</label>
<label class="check"><input id="nat20" type="checkbox">A natural 20 always hits</label>
</div>
<p class="error" id="terms-error" role="alert"></p>
</section>

<section class="section" aria-labelledby="h-fighters">
<h2 id="h-fighters" class="h2">The fighters</h2>
<div class="add-row">
<label>Add a fighter, starting from<select id="preset-pick"></select></label>
<button type="button" class="btn" id="add-fighter">+ add a fighter</button>
</div>
<p class="status" id="preset-status" aria-live="polite"></p>
<div class="fighters" id="fighters"></div>
</section>

<section class="section" aria-labelledby="h-sums">
<h2 id="h-sums" class="h2">The sums</h2>
<div id="results" class="section"></div>
<div><button type="button" class="btn" id="csv">Download the numbers (CSV)</button></div>
</section>

<footer class="foot">
<span>5e-compatible. Not an official product.</span>
<a href="/tools/dpr/#how">How the numbers are worked out</a>
</footer>
<noscript><p class="error">The calculator needs JavaScript to run. Everything happens in your browser.</p></noscript>
</main>
</div>
</div>

<dialog id="save-dialog" aria-labelledby="save-title">
<form method="dialog" class="dialog">
<h2 id="save-title" class="h3">Save for everyone</h2>
<p class="public-note"><strong>Saved presets are public.</strong> Anyone who uses this calculator will be able to see and load <span id="save-name"></span>. You can't edit or delete it after saving. Don't put personal information in any name.</p>
<div id="dpr-turnstile"></div>
<p class="error" id="save-error" role="alert"></p>
<div class="dialog__actions">
<button type="submit" value="cancel" class="btn">Cancel</button>
<button type="button" class="btn btn--solid" id="save-confirm">Save for everyone</button>
</div>
</form>
</dialog>
</body>
</html>
`;
}
