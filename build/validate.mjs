// Content checks shared by the build and the admin Worker. Throws on the first problem.
export function validate(cv) {
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };
  must(cv && typeof cv === 'object', 'Content must be an object');
  must(cv.person?.name && cv.summary && cv.experience?.roles?.length, 'Content is missing person, summary or experience');

  const ids = new Set();
  const details = new Map();
  const tags = new Set(cv.experience.tags);
  for (const role of cv.experience.roles) {
    must(Number.isInteger(role.nextCard), `Role ${role.anchor} needs a numeric nextCard`);
    must(/^[A-Z][a-z]{2} \d{4} [–-] ([A-Z][a-z]{2} \d{4}|present)$/.test(role.dates), `Role ${role.anchor} dates must look like "Jan 2025 – present" (the job-fit tool computes tenure from them)`);
    const prefix = role.anchor.replace(/^exp-/, '') + '-';
    for (const card of role.cards) {
      must(typeof card.id === 'string' && card.id.startsWith(prefix), `Card id "${card.id}" doesn't belong to ${role.anchor}`);
      must(!ids.has(card.id), `Duplicate card id: ${card.id}`);
      ids.add(card.id);
      must(Number(card.id.slice(prefix.length)) < role.nextCard, `Card ${card.id} is not below ${role.anchor}.nextCard; ids must never be reused`);
      must(tags.has(card.tag), `Card ${card.id} has unknown tag "${card.tag}"`);
      for (const f of ['metric', 'headline', 'detail']) must(typeof card[f] === 'string' && card[f].trim(), `Card ${card.id} is missing ${f}`);
      must(!details.has(card.detail), `Cards ${details.get(card.detail)} and ${card.id} share the same detail text`);
      details.set(card.detail, card.id);
    }
  }

  const anchors = new Set(cv.experience.roles.map((r) => r.anchor));
  for (const [key, view] of Object.entries(cv.views)) {
    if (key.startsWith('_')) continue;
    for (const a of view.roleOrder) must(anchors.has(a), `View ${key} orders unknown role ${a}`);
    for (const t of view.upFrontTags || []) must(tags.has(t), `View ${key} uses unknown tag "${t}"`);
  }

  for (const g of cv.skills.groups) {
    for (const s of g.items) {
      must(Array.isArray(s.forms) && s.forms.length && s.forms.every((f) => typeof f === 'string' && f.trim()), `A skill in ${g.name} has no wordings`);
      must(Number.isInteger(s.shown) && s.shown >= 0 && s.shown < s.forms.length, `Skill "${s.forms[0]}" shows a wording that doesn't exist`);
    }
  }
  must(Array.isArray(cv.about), 'About must be a list of paragraphs');
  return true;
}
