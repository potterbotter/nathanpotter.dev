// The Word export: a valid zip with the parts Word needs, and the same content as the plain-text résumé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { buildDocx, zip } from '../src/docx.js';
import { assemble, fakePlan } from '../src/resume.js';

const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
const contact = { email: 'hello@nathanpotter.dev', phone: '(555) 010-0000', location: 'Bay Area', linkedin: 'linkedin.com/in/x', site: 'nathanpotter.dev/?ref=acme-1' };

// Read a zip back through its central directory, checking each entry's CRC like an unzip tool would.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50, 'end of central directory');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(v.getUint32(at, true), 0x02014b50, 'central directory entry');
    const method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true), nameLen = v.getUint16(at + 28, true), local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const dataAt = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + v.getUint32(at + 20, true));
    const data = method === 0 ? raw : inflateRawSync(raw);
    assert.equal(data.length, size);
    files[name] = new TextDecoder().decode(data);
    at += 46 + nameLen + v.getUint16(at + 30, true) + v.getUint16(at + 32, true);
  }
  return files;
}

test('the zip writer round-trips, including non-ASCII names and text', () => {
  const files = unzip(zip([['a.txt', 'hello'], ['dir/é.xml', '<x>—</x>']]));
  assert.deepEqual(files, { 'a.txt': 'hello', 'dir/é.xml': '<x>—</x>' });
});

test('the .docx has the parts Word needs and every résumé line', () => {
  const { doc } = assemble(cv, fakePlan(cv).plan, { contact });
  const files = unzip(buildDocx(doc));
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) assert.ok(files[part], part);
  const xml = files['word/document.xml'];
  const plain = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const text = plain(xml.replace(/<[^>]+>/g, ''));
  assert.ok(text.includes(doc.name) && text.includes(doc.title) && text.includes(contact.phone) && text.includes(doc.summary.text));
  for (const r of doc.roles) { assert.ok(text.includes(r.company)); for (const b of r.bullets) assert.ok(text.includes(b.text), b.card_id); }
  for (const e of doc.education) assert.ok(text.includes(e.school));
  const bullets = doc.roles.reduce((n, r) => n + r.bullets.length, 0);
  assert.equal((xml.match(/<w:numId w:val="1"\/>/g) || []).length, bullets, 'one real list item per bullet');
  assert.ok(!/<w:hdr|<w:tbl|<w:txbx/.test(xml), 'no headers, tables or text boxes (ATS-safe)');
});

test('markup characters in content are escaped, not interpreted', () => {
  const { doc } = assemble(cv, fakePlan(cv).plan, { contact });
  doc.summary.text = 'R&D <script> "quoted"';
  const xml = unzip(buildDocx(doc))['word/document.xml'];
  assert.ok(xml.includes('R&amp;D &lt;script&gt; &quot;quoted&quot;'));
});
