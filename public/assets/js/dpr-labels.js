// Places value labels next to points on a line chart, in empty space: never across a plotted line, another label,
// another point or the chart edge. Pure geometry (no DOM), so it runs in the Node tests too.
//
// placeLabels({ labels: [{ x, y, w, h }], segments: [[x1, y1, x2, y2]], bounds: { l, t, r, b }, pad })
//   labels:   the point each label belongs to (x, y) and the label's size (w, h)
//   segments: every plotted line segment, in the same coordinates
// Returns [{ x, y, w, h, clear, leader }]: the label's top-left corner; `clear` is false only when no empty spot
// existed (it then avoids other labels but may touch a line); `leader` asks for a short line back to the point.

const DISTANCES = [8, 12, 17, 23, 30, 38, 48, 60, 74, 90];
// Unit directions, tried in this order at each distance: right, left, then the diagonals, then straight up and down.
const DIRECTIONS = [[1, 0], [-1, 0], [1, -1], [1, 1], [-1, -1], [-1, 1], [0, -1], [0, 1]];

function rectAt(px, py, w, h, [dx, dy], d) {
  const k = dx && dy ? Math.SQRT1_2 : 1;
  const ox = dx * d * k, oy = dy * d * k;
  // Anchor the label's near side or corner to the offset point.
  const x = dx > 0 ? px + ox : dx < 0 ? px + ox - w : px - w / 2;
  const y = dy > 0 ? py + oy : dy < 0 ? py + oy - h : py - h / 2;
  return { x, y, w, h };
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

// Does segment (x1,y1)–(x2,y2) touch rectangle r? Liang–Barsky clipping.
export function segmentHitsRect([x1, y1, x2, y2], r) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

export function placeLabels({ labels, segments, bounds, pad = 3 }) {
  const placed = [];
  const dots = labels.map((l) => ({ x: l.x - 6, y: l.y - 6, w: 12, h: 12 }));
  const inBounds = (r) => r.x >= bounds.l && r.y >= bounds.t && r.x + r.w <= bounds.r && r.y + r.h <= bounds.b;
  const free = (r, i, strict) => inBounds(r)
    && !placed.some((p) => overlaps(grow(r, pad), p))
    && !dots.some((d, j) => j !== i && overlaps(r, d))
    && !(strict && (overlaps(r, dots[i]) || segments.some((s) => segmentHitsRect(s, grow(r, pad)))));

  labels.forEach((l, i) => {
    let best = null;
    for (const strict of [true, false]) {
      for (const d of DISTANCES) {
        for (const dir of DIRECTIONS) {
          const r = rectAt(l.x, l.y, l.w, l.h, dir, d);
          if (free(r, i, strict)) { best = { ...r, clear: strict, leader: d >= 23 }; break; }
        }
        if (best) break;
      }
      if (best) break;
    }
    best ||= { ...rectAt(l.x, l.y, l.w, l.h, DIRECTIONS[0], DISTANCES[0]), clear: false, leader: false };
    placed.push(best);
  });
  return placed;
}

// Width of a short number label set in Fondamento (advance widths from the font, in ems), plus a little air.
const EMS = { 0: 0.721, 1: 0.368, 2: 0.535, 3: 0.538, 4: 0.664, 5: 0.542, 6: 0.629, 7: 0.479, 8: 0.59, 9: 0.626, '.': 0.23, '%': 0.947 };
export const labelWidth = (text, fontSize) => [...String(text)].reduce((w, c) => w + (EMS[c] ?? 0.6) * fontSize, 0) + 4;
