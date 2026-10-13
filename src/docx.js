// Minimal .docx writer for résumés, no dependencies. A .docx is a zip of a few XML parts; this writes only what a
// résumé needs and what applicant-tracking systems parse reliably: one column, Arial, plain paragraphs, real bullet
// lists, and contact details in the body (not in a page header).
//
// Input: { name, title, contact: { email, phone, location, linkedin, site }, summary: { text }, callout?,
//          roles: [{ company, title, dates, bullets: [{ text }] }], skills: [{ text, group, groupIndex }],
//          education: [{ school, detail }] }

// Skills grouped by category, categories in their given order; within a group, skills keep their order.
export function skillGroups(skills) {
  const groups = [];
  for (const s of [...skills].sort((a, b) => (a.groupIndex ?? 99) - (b.groupIndex ?? 99))) {
    const name = s.group || 'Skills';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push(g = { name, items: [] });
    g.items.push(s.text);
  }
  return groups;
}
// Two contact lines: how to reach the person, then where to read more.
export function contactLines(c = {}) {
  return [[c.email, c.phone, c.location].filter(Boolean).join(' · '), [c.linkedin, c.site].filter(Boolean).join(' · ')].filter(Boolean);
}

const enc = new TextEncoder();
const esc = (s) => String(s ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BRAND = '0F6E73';
// Sizes are in half-points; spacing in twentieths of a point.
const TEXT_WIDTH = 12240 - 2 * 864; // letter width minus left and right margins, in twips
const run = (text, { bold, italic, size, color, caps, spacing } = {}) =>
  `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${caps ? '<w:caps/>' : ''}${spacing ? `<w:spacing w:val="${spacing}"/>` : ''}${color ? `<w:color w:val="${color}"/>` : ''}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const tab = '<w:r><w:tab/></w:r>';
const para = (runs, { after = 40, before = 0, style, keepNext, bullet, border, rightTab } = {}) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${keepNext ? '<w:keepNext/>' : ''}${bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}${border ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="B9C4C4"/></w:pBdr>` : ''}${rightTab ? `<w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH}"/></w:tabs>` : ''}<w:spacing w:before="${before}" w:after="${after}"/></w:pPr>${runs}</w:p>`;
const heading = (text) => para(run(text, { bold: true, caps: true, size: 20, color: BRAND, spacing: 16 }), { before: 160, after: 70, keepNext: true, border: true });

export function documentXml(doc) {
  const c = doc.contact || {};
  const lines = contactLines(c);
  const body = [
    para(run(doc.name, { bold: true, size: 42, color: BRAND }), { after: 20 }),
    para(run(doc.title, { bold: true, size: 23 }), { after: 60 }),
    ...lines.map((l, i) => para(run(l, { size: 19, color: '333333' }), { after: i === lines.length - 1 ? 40 : 0 })),
    heading('Summary'),
    para(run(doc.summary.text)),
    // Optional one-line pointer to the site, in italics under the summary.
    ...(doc.callout ? [para(run(doc.callout, { italic: true, color: '333333' }), { before: 20 })] : []),
    heading('Experience'),
    ...doc.roles.flatMap((r, i) => [
      // Company left, dates right (a right-aligned tab stop), then the title in italics.
      para(run(r.company, { bold: true }) + tab + run(r.dates, { size: 20, color: '333333' }), { before: i ? 110 : 0, after: 0, keepNext: true, rightTab: true }),
      para(run(r.title, { italic: true }), { after: 30, keepNext: true }),
      ...r.bullets.map((b) => para(run(b.text), { bullet: true, after: 24 })),
    ]),
    heading('Skills'),
    ...skillGroups(doc.skills).map((g) => para(run(`${g.name}: `, { bold: true }) + run(g.items.join(', ')), { after: 24 })),
    heading('Education'),
    ...doc.education.map((e) => para(run(e.school, { bold: true }) + run(` — ${e.detail}`), { after: 24 })),
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="792" w:right="864" w:bottom="792" w:left="864" w:header="432" w:footer="432" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="111111"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="270" w:hanging="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

const core = (doc, title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(doc.name)}</dc:creator><cp:lastModifiedBy>${esc(doc.name)}</cp:lastModifiedBy></cp:coreProperties>`;

export function buildDocx(doc, { title } = {}) {
  return zip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['docProps/core.xml', core(doc, title || `${doc.name} - Resume`)],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', documentXml(doc)],
    ['word/styles.xml', STYLES],
    ['word/numbering.xml', NUMBERING],
  ]);
}

// ---------- zip (stored, no compression; valid for .docx and tiny at résumé size) ----------
let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function zip(files) {
  const chunks = [], central = [];
  let offset = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01, so the same résumé gives the same bytes
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, 0, true); local.setUint16(12, DOS_DATE, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true); local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, 0, true); cen.setUint16(14, DOS_DATE, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
    cen.setUint16(28, nameBytes.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
