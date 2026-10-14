// Chart value labels land in empty space. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeLabels, segmentHitsRect, labelWidth } from '../public/assets/js/dpr-labels.js';

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const line = (pts) => pts.slice(1).map((p, i) => [...pts[i], ...p]);
const bounds = { l: 40, t: 0, r: 680, b: 240 };

test('segment–rectangle test', () => {
  const r = { x: 10, y: 10, w: 10, h: 10 };
  assert.equal(segmentHitsRect([0, 15, 30, 15], r), true);   // passes through
  assert.equal(segmentHitsRect([12, 12, 14, 14], r), true);  // inside
  assert.equal(segmentHitsRect([0, 0, 30, 5], r), false);    // passes above
  assert.equal(segmentHitsRect([0, 0, 9, 30], r), false);    // passes to the left
});

test('labels never cross a plotted line, each other or the edges, even with lines close together', () => {
  // Two near-parallel falling lines and a vertical focus line through both labelled points.
  const a = [[48, 87], [208, 108], [368, 136], [528, 164], [648, 185]];
  const b = [[48, 70], [208, 96], [368, 122], [528, 150], [648, 170]];
  const segments = [...line(a), ...line(b), [368, 12, 368, 240]];
  const labels = [{ x: 368, y: 136, w: labelWidth('33.1', 15), h: 17 }, { x: 368, y: 122, w: labelWidth('35.4', 15), h: 17 }];
  const placed = placeLabels({ labels, segments, bounds, pad: 4 });
  for (const p of placed) {
    assert.equal(p.clear, true);
    for (const s of segments) assert.equal(segmentHitsRect(s, p), false, JSON.stringify({ p, s }));
    assert.ok(p.x >= bounds.l && p.y >= bounds.t && p.x + p.w <= bounds.r && p.y + p.h <= bounds.b);
  }
  assert.equal(overlaps(placed[0], placed[1]), false);
});

test('a label hemmed in on every side still avoids the other labels', () => {
  // A dense fan of lines through one point: no clear spot within reach.
  const segments = Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * Math.PI; return [300 - 200 * Math.cos(t), 120 - 200 * Math.sin(t), 300 + 200 * Math.cos(t), 120 + 200 * Math.sin(t)]; });
  const labels = [{ x: 300, y: 120, w: 30, h: 17 }, { x: 300, y: 120, w: 30, h: 17 }];
  const [p, q] = placeLabels({ labels, segments, bounds, pad: 4 });
  assert.equal(overlaps(p, q), false);
});
