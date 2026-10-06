// Fetch a job posting from a link and return clean text for the visitor to review.
// Greenhouse, Lever and Ashby have public job-board APIs; other pages are read via
// schema.org JobPosting data or stripped to text. Sites that forbid automated access
// (LinkedIn, Indeed, Glassdoor) are refused with a request to paste the text instead.

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 15000;
const TIMEOUT_MS = 8000;
const BLOCKED = /(^|\.)(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com)$/i;

export class FetchError extends Error {}

// Only ordinary public https pages: no IP literals, no localhost, no credentials, default port.
export function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { throw new FetchError("That doesn't look like a link. Paste the full address, starting with https://"); }
  if (u.protocol !== 'https:') throw new FetchError('Only https:// links are supported.');
  if (u.username || u.password || u.port) throw new FetchError("That link can't be fetched.");
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
    || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) throw new FetchError("That link can't be fetched.");
  if (BLOCKED.test(host)) throw new FetchError("This site doesn't allow automated reading. Open the posting, copy the description, and paste it in the box.");
  return u;
}

// Recognize the common applicant-tracking systems and return their public API URL.
export function atsSource(u) {
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const i = parts.indexOf('jobs');
    if (i > 0 && parts[i + 1]) return { kind: 'greenhouse', api: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parts[i - 1])}/jobs/${encodeURIComponent(parts[i + 1])}` };
    const gh = u.searchParams.get('gh_jid'), board = u.searchParams.get('for');
    if (gh && board) return { kind: 'greenhouse', api: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(gh)}` };
  }
  if (host === 'jobs.lever.co' && parts.length >= 2) {
    return { kind: 'lever', api: `https://api.lever.co/v0/postings/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}` };
  }
  if (host === 'jobs.ashbyhq.com' && parts.length >= 2) {
    return { kind: 'ashby', api: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(parts[0])}`, id: parts[1] };
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·' };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|button|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// schema.org JobPosting, which many career sites embed for Google Jobs.
export function jsonLdPosting(html) {
  const blocks = String(html || '').match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')); } catch { continue; }
    const nodes = [].concat(data, data?.['@graph'] || []).flat();
    const job = nodes.find((n) => n && (n['@type'] === 'JobPosting' || (Array.isArray(n['@type']) && n['@type'].includes('JobPosting'))));
    if (job?.description) {
      return { title: decodeEntities(job.title || ''), company: decodeEntities(job.hiringOrganization?.name || ''), text: htmlToText(decodeEntities(job.description)) };
    }
  }
  return null;
}

async function get(url, accept, maxBytes = MAX_BYTES) {
  // Follow up to 3 redirects by hand so every hop is re-checked.
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(target, {
      redirect: 'manual',
      headers: { Accept: accept, 'User-Agent': 'nathanpotter.dev job-fit (reads one posting a visitor asked for)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('Location')) {
      target = checkUrl(new URL(res.headers.get('Location'), target)).toString();
      continue;
    }
    if (!res.ok) throw new FetchError(res.status === 404 ? 'That posting could not be found. It may have closed.' : "The site didn't return the posting. Paste the text instead.");
    const len = Number(res.headers.get('Content-Length') || 0);
    if (len > maxBytes) throw new FetchError('That page is too large to read. Paste the text instead.');
    const body = await res.text();
    if (body.length > maxBytes) throw new FetchError('That page is too large to read. Paste the text instead.');
    return body;
  }
  throw new FetchError('Too many redirects. Paste the text instead.');
}

const finish = (input, source) => {
  let r = input;
  r = { ...r, title: String(r.title || '').trim(), company: String(r.company || '').trim(), text: String(r.text || '').trim() };
  const header = [r.title, r.company].filter(Boolean).join(' · ');
  const text = (header ? `${header}\n\n` : '') + r.text;
  if (r.text.length < 200) throw new FetchError("Couldn't read a full posting from that page (it may load with scripts). Open it, copy the description, and paste it in the box.");
  return { title: r.title || '', company: r.company || '', text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT, source };
};

export async function fetchPosting(rawUrl) {
  const u = checkUrl(rawUrl);
  const ats = atsSource(u);
  try {
    if (ats?.kind === 'greenhouse') {
      const j = JSON.parse(await get(ats.api, 'application/json'));
      return finish({ title: j.title, company: j.company_name || '', text: htmlToText(decodeEntities(j.content)) + (j.location?.name ? `\n\nLocation: ${j.location.name}` : '') }, 'Greenhouse');
    }
    if (ats?.kind === 'lever') {
      const j = JSON.parse(await get(ats.api, 'application/json'));
      const lists = (j.lists || []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
      return finish({ title: j.text, company: '', text: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join('\n\n') + (j.categories?.location ? `\n\nLocation: ${j.categories.location}` : '') }, 'Lever');
    }
    if (ats?.kind === 'ashby') {
      // The posting page usually carries schema.org data; the board API (every job at once) is the fallback.
      try {
        const ld = jsonLdPosting(await get(u.toString(), 'text/html'));
        if (ld && ld.text.length >= 200) return finish(ld, 'Ashby');
      } catch (e) { if (e instanceof FetchError && /closed/.test(e.message)) throw e; }
      const j = JSON.parse(await get(ats.api, 'application/json', 15_000_000));
      const job = (j.jobs || []).find((x) => x.id === ats.id || String(x.jobUrl || '').includes(ats.id));
      if (!job) throw new FetchError('That posting could not be found. It may have closed.');
      return finish({ title: job.title, company: '', text: (job.descriptionPlain || htmlToText(job.descriptionHtml)) + (job.location ? `\n\nLocation: ${job.location}` : '') }, 'Ashby');
    }
    const html = await get(u.toString(), 'text/html');
    const ld = jsonLdPosting(html);
    if (ld && ld.text.length >= 200) return finish(ld, 'the page’s job data');
    const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
    const main = (html.match(/<main\b[\s\S]*?<\/main>/i) || html.match(/<article\b[\s\S]*?<\/article>/i) || html.match(/<body\b[\s\S]*?<\/body>/i) || [html])[0];
    return finish({ title, company: '', text: htmlToText(main) }, 'the page text');
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (err?.name === 'TimeoutError') throw new FetchError('The site took too long to respond. Paste the text instead.');
    throw new FetchError("Couldn't read that page. Paste the text instead.");
  }
}
