// HTML templates for every public page. Structure and class names follow
// design/handoff (components.md, navigation.md, pages.md). All copy comes from content/cv.json.

const SITE = 'https://nathanpotter.dev';

// ---------- helpers ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isPlaceholder = (s) => /\[[^\]]*\]/.test(String(s ?? ''));
// Placeholder copy ([bracketed]) is hidden on the live site unless --show-placeholders.
const visible = (ctx, s) => s && (ctx.flags.showPlaceholders || !isPlaceholder(s));
const join = (items, fn) => items.map(fn).join('');
// Edit-mode hook: marks text as inline-editable at a cv.json path. Renders nothing on public pages.
const ep = (ctx, path) => (ctx.edit ? ` data-edit-path="${esc(path)}" contenteditable="true" spellcheck="true"` : '');

export const formatDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

const svg = (d, size = 16, stroke = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
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
function layout(ctx, { title, description, path, current, main, footer = 'slim', jsonld = '', noindex = false, admin = '', bare = false, pageType = '', scripts = '' }) {
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
<script>(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();</script>
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/site.css">
<script src="/assets/js/site.js" defer></script>
${admin ? '<link rel="stylesheet" href="/admin/assets/admin.css">\n' : ''}${scripts}${ctx.edit ? '<script src="/admin/assets/admin.js" defer></script>\n' : ''}${jsonld}</head>
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
<div><span class="eyebrow">CV</span><a href="/">Full CV</a><a href="/views/">Role views</a><a href="/builder/">Builder</a><a href="/fintech/">Fintech</a><a href="/climate/">Climate</a></div>
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
<span class="cta-text"><span class="cta-title">Am I the right fit for your company?</span><span class="cta-sub">Paste a job description. Get a fit read that cites my CV, on its own page.</span></span>
<span class="cta-arrow" aria-hidden="true">${I.arrow(22)}</span>
</a>`;
  }
  return `<a class="cta cta--band noprint" href="/tools/job-fit/">
<span class="cta-text"><span class="eyebrow">Hiring?</span><span class="cta-title">Am I the right fit for your company?</span><span class="cta-sub">Paste the job description and see where I fit, with the evidence.</span></span>
<span class="cta-arrow" aria-hidden="true">${I.arrow(22)}</span>
</a>`;
}

// ---------- CV page (/, /builder/, /fintech/, /climate/) ----------
// ctx.edit (admin only) adds edit hooks and controls; ctx.adminBar is the admin strip's HTML.
export function cvPage(ctx, viewKey) {
  const { cv } = ctx;
  const view = cv.views[viewKey];
  const curated = viewKey !== 'all';
  const viewKeys = ['all', 'builder', 'fintech', 'climate'];
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
<header class="section-head"><h2 id="h-exp">Experience</h2><p class="section-lede"${ep(ctx, 'experience.intro')}>${esc(cv.experience.intro)}</p>
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
<div class="tiles">${join(['builder', 'fintech', 'climate'], card)}</div>
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
function fitForm(cv, { bench = false, compare = false } = {}) {
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
<div class="row-links">
<button type="submit" class="btn btn--primary" data-fit-submit>Assess</button>
<button type="button" class="btn btn--secondary" data-fit-clear>Clear</button>
</div>
${bench ? '' : `<p class="muted small">${esc(jf.dataNote)}</p>
<noscript><p class="small">This tool needs JavaScript. You can also email the posting to <a href="mailto:${esc(cv.person.email)}">${esc(cv.person.email)}</a>.</p></noscript>`}
</form>`;
}

const fitScripts = (cv, extra = {}) => `<script>window.NP_FIT = ${JSON.stringify({ email: cv.person.email, method: cv.jobFit.method, ...extra }).replace(/</g, '\\u003c')};</script>\n<script src="/assets/js/jobfit.js" defer></script>\n`;

// Admin test bench: run reads, discuss the feedback with Claude, approve knowledge-base changes.
export function testBenchPage(ctx, { drafts, notes, compare }) {
  const main = `<main id="main" class="wrap bench">
<header class="page-title" style="padding-top: var(--sp-5)">
<h1>Job-fit test bench</h1><div class="rule"></div>
<p class="lede">Run a read, then answer its feedback in the chat. Claude asks for specifics and proposes changes; nothing is saved until you approve it. Public changes go to your draft (<a href="/admin/edit/">${drafts} change${drafts === 1 ? '' : 's'} so far</a>); publish them from edit mode.</p>
</header>
<div class="bench-grid">
<div class="bench-left">
${fitForm(ctx.cv, { bench: true, compare })}
<section class="fit-read" aria-labelledby="h-read"><h2 id="h-read">The read</h2>
<div data-fit-read aria-live="polite"><p class="muted">Run a read to start. Each requirement gets a Discuss button.</p></div>
</section>
</div>
<section class="bench-chat" aria-labelledby="h-chat" data-kb-chat>
<header class="bench-chat__head"><h2 id="h-chat">Chat with Claude</h2><button type="button" class="btn-quiet" data-kb-clear>Clear chat</button></header>
<ol class="bench-chat__log" data-kb-log aria-live="polite"><li class="muted small">Tell Claude what the read missed, or click Discuss on a row. Example: "I ran A/B tests with LaunchDarkly at Anchorage."</li></ol>
<form class="bench-chat__form" data-kb-form>
<label for="kb-input" class="visually-hidden">Message</label>
<textarea id="kb-input" rows="3" placeholder="What should Claude know?"></textarea>
<div class="row-links"><button type="submit" class="btn btn--primary" data-kb-send>Send</button><span class="muted small" data-kb-status aria-live="polite"></span></div>
</form>
<details class="bench-notes" data-kb-notes><summary>Private notes (<span data-kb-notes-count>${notes}</span>)</summary><ul data-kb-notes-list><li class="muted small">Loading…</li></ul></details>
</section>
</div>
</main>`;
  return layout(ctx, {
    title: `Test bench — ${ctx.cv.person.name}`, description: 'Admin test bench.', path: '/admin/job-fit/', current: null, main, bare: true,
    admin: adminBar(ctx, { mode: 'bench', drafts }),
    scripts: fitScripts(ctx.cv, { endpoint: '/api/admin/job-fit', discuss: true }) + '<script src="/admin/assets/testbench.js" defer></script>\n',
  });
}

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
${fitForm(cv)}
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
    scripts: fitScripts(cv),
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

// ---------- sign-in and admin (admin pages are rendered by the Worker, after Access) ----------
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

export function adminBar(ctx, { mode, drafts }) {
  const handle = esc(ctx.cv.person.github);
  const label = drafts ? `${drafts} draft change${drafts === 1 ? '' : 's'}` : 'Published · no unsaved changes';
  const right = mode === 'edit'
    ? `<a class="admin-link" href="/admin/">Admin home</a>
<a class="admin-link" href="/admin/job-fit/">Test bench</a>
<a class="admin-link admin-link--outline" href="/admin/edit/?preview=1">Preview as visitor</a>
<button type="button" class="admin-link" data-discard${drafts ? '' : ' hidden'}>Discard draft</button>
<button type="button" class="admin-publish" data-publish${drafts ? '' : ' disabled'}>Publish</button>`
    : mode === 'preview'
      ? `<a class="admin-link admin-link--outline" href="/admin/edit/">Back to editing</a>`
      : mode === 'dashboard' || mode === 'bench'
        ? `<a class="admin-link" href="/admin/">Admin home</a>
<a class="admin-link" href="${mode === 'bench' ? '/admin/dashboard/">Dashboard' : '/admin/job-fit/">Test bench'}</a>
<a class="admin-link" href="/admin/edit/">Edit the CV</a>`
        : `<a class="admin-link" href="/admin/dashboard/">Dashboard</a>
<a class="admin-link" href="/admin/edit/">Edit the CV</a>`;
  return `<div class="admin-bar noprint" role="region" aria-label="Admin">
<div class="wrap">
<div class="admin-bar__left">
<span class="admin-badge">${mode === 'edit' ? 'Edit mode' : mode === 'preview' ? 'Preview' : mode === 'dashboard' ? 'Dashboard' : mode === 'bench' ? 'Test bench' : 'Admin'}</span>
<span>Signed in with GitHub as <strong>${handle}</strong></span>
<span class="admin-drafts" aria-live="polite" data-draft-label>${esc(label)}</span>
</div>
<div class="admin-bar__right">
${right}
<a class="admin-link admin-link--quiet" href="/cdn-cgi/access/logout">Sign out</a>
</div>
</div>
<p class="admin-msg" role="status" data-admin-msg hidden></p>
</div>`;
}

export function adminHomePage(ctx, { drafts, lastPublished }) {
  const main = `<main id="main" class="wrap page-main" style="padding-top: var(--sp-7)">
<header class="page-title" style="padding-top:0">
<p class="muted">Signed in with GitHub as ${esc(ctx.cv.person.github)}</p>
<h1>Admin</h1><div class="rule"></div>
</header>
<div class="tiles">
<a class="tile" href="/admin/edit/">
<span class="tile__head"><span class="tile__name">Edit the CV</span><span class="status">Ready</span></span>
<span class="muted">Edit results, About, skills and wordings in place. Changes save as drafts until you publish.</span>
<span class="tile__action">Open edit mode</span>
</a>
<a class="tile" href="/admin/dashboard/">
<span class="tile__head"><span class="tile__name">Dashboard</span><span class="status">Ready</span></span>
<span class="muted">Who visits, from where, what they read and click. Cookieless; no IP addresses stored.</span>
<span class="tile__action">Open the dashboard</span>
</a>
<a class="tile" href="/admin/job-fit/">
<span class="tile__head"><span class="tile__name">Job-fit test bench</span><span class="status">Ready</span></span>
<span class="muted">Run reads on real postings, answer the feedback in a chat with Claude, and approve changes to your CV and private notes.</span>
<span class="tile__action">Open the test bench</span>
</a>
<div class="tile tile--unbuilt" aria-disabled="true">
<span class="tile__head"><span class="tile__name">Résumé generator</span><span class="status status--unbuilt">Not built yet</span></span>
<span class="muted">Tailored, ATS-safe résumés from the same facts. Comes with the job-fit engine.</span>
</div>
</div>
<p class="mono muted">Last published: ${esc(lastPublished || '—')} · Drafts: ${drafts}</p>
</main>`;
  return layout(ctx, { title: `Admin — ${ctx.cv.person.name}`, description: 'Admin.', path: '/admin/', current: null, main, admin: adminBar(ctx, { mode: 'home', drafts }), bare: true });
}

// ---------- analytics dashboard (admin) ----------
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDur = (s) => { s = Math.round(s || 0); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const fmtTime = (ms) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let regionNames;
const countryName = (code) => {
  if (!code || code === '(none)') return code;
  try { regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' }); return regionNames.of(code) || code; } catch { return code; }
};

function barList(title, rows, { label = (r) => r.k, note = '', empty = 'Nothing yet.', measure = (r) => r.n, valueText = (r) => fmtNum(r.n), sub = (r) => `${fmtNum(r.v)} visitor${r.v === 1 ? '' : 's'}` } = {}) {
  const max = Math.max(1, ...rows.map(measure));
  return `<section class="dash-card">
<header><h2>${esc(title)}</h2>${note ? `<p class="muted small">${esc(note)}</p>` : ''}</header>
${rows.length ? `<table class="bar-list"><tbody>
${join(rows, (r) => `<tr><th scope="row"><span class="bar" style="width:${Math.max(2, Math.round((measure(r) / max) * 100))}%"></span><span class="bar-label">${esc(label(r))}</span></th><td><strong>${esc(valueText(r))}</strong>${sub ? `<span>${esc(sub(r))}</span>` : ''}</td></tr>`)}
</tbody></table>` : `<p class="muted small">${esc(empty)}</p>`}
</section>`;
}

function dailyChart(series, rangeKey) {
  // Fill gaps so every day in the range has a bar.
  const byDay = Object.fromEntries(series.map((r) => [r.d, r]));
  const days = [];
  const span = { '24h': 2, '7d': 7, '30d': 30, '90d': 90 }[rangeKey];
  if (span) {
    for (let i = span - 1; i >= 0; i--) {
      days.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - i * 86400000)));
    }
  } else days.push(...series.map((r) => r.d));
  const data = days.map((d) => ({ d, views: byDay[d]?.views || 0, visitors: byDay[d]?.visitors || 0 }));
  const max = Math.max(1, ...data.map((r) => r.views));
  const W = 720, H = 180, top = 12, bottom = 24, left = 32;
  const plotW = W - left, plotH = H - top - bottom;
  const step = plotW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(28, step - 4)); // thin marks, centred in their slot
  const y = (v) => top + plotH - (v / max) * plotH;
  const gridVals = [0, Math.ceil(max / 2), max];
  const label = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const every = Math.ceil(data.length / 6);
  return `<section class="dash-card dash-card--wide">
<header><h2>Page views per day</h2><p class="muted small">Pacific time. Hover or focus a bar for the day's numbers.</p></header>
<div class="chart" data-chart>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Page views per day">
${join(gridVals, (v) => `<line class="grid" x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`)}
${join(data, (r, i) => {
    const h = Math.max(r.views ? 2 : 0, (r.views / max) * plotH);
    const x = left + i * step + (step - barW) / 2;
    return `<g class="bar-g" tabindex="0" data-tip="${esc(label(r.d))}: ${r.views} view${r.views === 1 ? '' : 's'}, ${r.visitors} visitor${r.visitors === 1 ? '' : 's'}">
<rect class="hit" x="${left + i * step}" y="${top}" width="${step}" height="${plotH}"/>
${h ? `<path class="mark" d="M${x},${top + plotH} V${top + plotH - h + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, barW / 2)},-${Math.min(4, h)} H${x + barW - Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)} V${top + plotH} Z"/>` : ''}
${i % every === 0 ? `<text class="axis" x="${x + barW / 2}" y="${H - 6}" text-anchor="middle">${esc(label(r.d))}</text>` : ''}
</g>`;
  })}
</svg>
<div class="chart-tip" role="status" hidden></div>
</div>
<details class="table-view"><summary>Show as table</summary>
<table class="data-table"><thead><tr><th scope="col">Day</th><th scope="col">Views</th><th scope="col">Visitors</th></tr></thead>
<tbody>${join([...data].reverse(), (r) => `<tr><td>${esc(r.d)}</td><td>${r.views}</td><td>${r.visitors}</td></tr>`)}</tbody></table>
</details>
</section>`;
}

function jobFitPanel(j) {
  const pct = j.budget ? Math.min(100, Math.round((j.spent / j.budget) * 100)) : 0;
  return `<h2 class="dash-section">Job-fit tool</h2>
<div class="stats">
<div class="stat"><span class="label">Spent this month</span><strong>$${j.spent.toFixed(2)}</strong><span class="muted small">${pct}% of the $${j.budget} budget. The tool pauses at 100%; you're emailed at 80% and 100%.</span></div>
<div class="stat"><span class="label">Assessments this month</span><strong>${fmtNum(j.runs)}</strong><span class="muted small">including yours</span></div>
</div>
<section class="dash-card dash-card--wide"><header><h2>Recent assessments</h2><p class="muted small">Latest 15. The pasted postings and full reads are stored in the database.</p></header>
${j.recent.length ? `<table class="data-table"><thead><tr><th scope="col">When</th><th scope="col">Role</th><th scope="col">Model</th><th scope="col">Read</th><th scope="col">Status</th><th scope="col">Time</th><th scope="col">Cost</th></tr></thead><tbody>
${join(j.recent, (r) => `<tr><td>${esc(fmtTime(r.ts))}</td><td>${esc([r.role_title, r.company].filter(Boolean).join(' · ') || '—')}${r.admin ? ' <span class="muted">(you)</span>' : ''}</td><td>${esc(String(r.model || '—').replace('claude-', ''))}</td><td>${esc(r.fit || '—')}</td><td>${esc(r.status)}</td><td>${r.duration_ms ? (r.duration_ms / 1000).toFixed(0) + 's' : '—'}</td><td>${Number(r.cost_usd || 0).toFixed(3)}</td></tr>`)}
</tbody></table>` : '<p class="muted small">No assessments yet.</p>'}
</section>`;
}

const EVENT_TEXT = {
  pageview: (e) => `Viewed ${e.path}`,
  notfound: (e) => `Hit a missing page: ${e.path}`,
  section: (e) => `Saw section “${e.label}”`,
  detail: (e, cards) => `Expanded card: ${cards[e.label] || e.label}`,
  more: (e) => `Opened the folded results for ${String(e.label || '').replace('exp-', '')}`,
  filter: (e) => `Filtered by ${e.label}`,
  contact: (e) => `Contact: ${e.label}`,
  theme: (e) => `Switched to ${e.label} theme`,
  print: () => 'Printed or saved as PDF',
  outbound: (e) => `Left for ${e.label}`,
  engage: (e) => `Spent ${fmtDur(e.value)} on ${e.path} (${e.label})`,
};

export function dashboardPage(ctx, d) {
  const cards = {};
  ctx.cv.experience.roles.forEach((r) => r.cards.forEach((c) => { cards[c.id] = `${r.company}: ${c.headline}`; }));
  const sectionNames = { 'career-arc': 'Career arc', experience: 'Experience', 'ai-method': 'How I work with AI', builds: 'Builds', about: 'About', skills: 'Skills', education: 'Education', 'site-build': 'How this site was built', contact: 'Contact (footer)' };
  const ranges = [['24h', 'Last 24 hours'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']];
  const t = d.totals;
  const tile = (label, value, detail) => `<div class="stat"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong>${detail ? `<span class="muted small">${esc(detail)}</span>` : ''}</div>`;
  const where = (r) => [r.city, r.region, countryName(r.country)].filter(Boolean).join(', ') || 'Unknown location';

  const main = `<main id="main" class="wrap dash">
<header class="dash-head">
<div><h1>Dashboard</h1><p class="muted">Visits to the public site. Cookieless; IP addresses are never stored; visitors are grouped per day with an anonymous ID.</p></div>
<button type="button" class="btn-quiet" data-exclude hidden>Exclude this browser</button>
</header>
<nav class="range" aria-label="Date range">${join(ranges, ([k, l]) => `<a href="?range=${k}"${d.rangeKey === k ? ' aria-current="true"' : ''}>${l}</a>`)}</nav>

<div class="stats">
${tile('Visitors', fmtNum(t.visitors), 'one per person per day')}
${tile('Page views', fmtNum(t.views))}
${tile('Avg. engaged time', fmtDur(t.engaged), 'per page, tab visible')}
${tile('Contact actions', fmtNum(t.contacts), 'email, copy, LinkedIn')}
${tile('Printed / saved PDF', fmtNum(t.prints))}
</div>

${dailyChart(d.series, d.rangeKey)}

${d.jobfit ? jobFitPanel(d.jobfit) : ''}

<h2 class="dash-section">Where they came from</h2>
<div class="dash-grid">
${barList('Ref codes', d.refs.filter((r) => r.k !== '(none)'), { note: 'From tailored links like ?ref=acme. The reliable way to know a company looked.', empty: 'No ref links used yet.' })}
${barList('Networks', d.orgs, { note: 'Who owns the visitor’s network. Often an ISP or carrier; sometimes the employer.' })}
${barList('Referrers', d.referrers, { label: (r) => (r.k === '(none)' ? 'Direct / unknown' : r.k) })}
${barList('Pages', d.pages)}
</div>

<h2 class="dash-section">Where they are</h2>
<div class="dash-grid">
${barList('Cities', d.cities)}
${barList('Regions', d.regions, { label: (r) => r.k.replace(/, ([A-Z]{2})$/, (m, c) => `, ${countryName(c)}`) })}
${barList('Countries', d.countries, { label: (r) => countryName(r.k) })}
</div>

<h2 class="dash-section">What they read and did</h2>
<div class="dash-grid">
${barList('Sections reached', d.sections, {
    label: (r) => sectionNames[r.k] || r.k,
    note: `Share of CV visitors (${fmtNum(d.cvVisitors)}) who scrolled each section into view.`,
    measure: (r) => r.v,
    valueText: (r) => `${d.cvVisitors ? Math.round((r.v / d.cvVisitors) * 100) : 0}%`,
    sub: (r) => `${fmtNum(r.v)} visitor${r.v === 1 ? '' : 's'}`,
  })}
${barList('Cards expanded', d.details, { label: (r) => cards[r.k] || r.k, note: 'Which results people opened for the full line.' })}
${barList('Contact actions', d.contacts)}
${barList('Filter chips', d.filters)}
${barList('Folded results opened', d.mores, { label: (r) => String(r.k).replace('exp-', '') })}
${barList('Outbound links', d.outbound)}
${barList('Missing pages (404)', d.notfound)}
${barList('Theme switches', d.themes)}
</div>

<h2 class="dash-section">Devices</h2>
<div class="dash-grid">
${barList('Device', d.devices)}
${barList('Browser', d.browsers)}
${barList('Operating system', d.oses)}
${barList('Screen size', d.screens)}
</div>

<h2 class="dash-section">Recent visits</h2>
<p class="muted small">The latest 25 visitor-days, newest first. Open one for its timeline.</p>
<ol class="visits">
${d.recent.length ? join(d.recent, (v) => `<li><details>
<summary><span class="visit-when mono">${esc(fmtTime(v.last))}</span>
<span class="visit-who"><strong>${esc(where(v))}</strong>${v.org ? ` · ${esc(v.org)}` : ''}</span>
<span class="visit-meta muted small">${esc([v.device, v.browser].filter(Boolean).join(' · '))}${v.ref ? ` · ref=${esc(v.ref)}` : ''}${v.referrer ? ` · from ${esc(v.referrer)}` : ''}${v.contacts ? ' · contacted' : ''}${v.prints ? ' · printed' : ''}</span></summary>
<ol class="timeline">${join(v.events, (e) => `<li><span class="mono muted">${esc(new Date(e.ts).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', second: '2-digit' }))}</span> ${esc((EVENT_TEXT[e.type] || ((x) => x.type))(e, cards))}</li>`)}</ol>
</details></li>`) : '<li class="muted">No visits recorded yet.</li>'}
</ol>
</main>`;
  return layout(ctx, {
    title: `Dashboard — ${ctx.cv.person.name}`, description: 'Site analytics.', path: '/admin/dashboard/', current: null, main, bare: true,
    admin: adminBar(ctx, { mode: 'dashboard', drafts: 0 }).replace(/<span class="admin-drafts"[^>]*>[^<]*<\/span>/, ''),
    scripts: '<script src="/admin/assets/dashboard.js" defer></script>\n',
  });
}

export function notFoundPage(ctx) {
  const main = `<main id="main" class="wrap">
<header class="page-title"><h1>Nothing here.</h1><div class="rule"></div><p class="lede">That page doesn't exist, or it moved.</p></header>
<div class="page-main"><div class="row-links"><a class="btn btn--primary" href="/">Back to the CV</a><a class="btn btn--secondary" href="/builds/">See the builds</a></div></div>
</main>`;
  return layout(ctx, { title: `Not found — ${ctx.cv.person.name}`, description: 'Page not found.', path: '/404', current: null, main, noindex: true, pageType: '404' });
}
