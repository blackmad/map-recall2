// A ramp's side band (issue #270): whether the walls carry on along a stretch of the way, and the steep ground sheets
// beside it. Shared by check-tunnels (the `wallBand` pin) and probe-ramp-gap.
import { CUT_CHANNEL, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { insideCut, locateCut, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';

type Vec2 = [number, number];
/** Layers not counted (thin furniture, paint, the water): the ground sheets are land, parks and the road surfaces. */
const SKIP = new Set<GroundLayer>(['kerb', 'paint', 'deckBody', 'bollard', 'furniture', 'hedge', 'track', 'ballast', 'water']);
/** A steep sheet: steeper than 45°, spanning more than SPAN_M in height and PLAN_M2 in plan. */
export const STEEP_SPAN_M = 1, STEEP_PLAN_M2 = 0.05;
/** A triangle whose centroid is this near a walled edge lies on the wall face (R5-C2's clip remainder), not the band. */
export const WALL_FACE_M = 0.5;

/** Station along the polyline and the signed lateral offset (+ left of its direction). */
export function alongLine(line: readonly Vec2[], x: number, y: number): { s: number; lat: number } {
  let best = Infinity, at = 0, acc = 0, lat = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], dx = line[i + 1][0] - ax, dy = line[i + 1][1] - ay, L = Math.hypot(dx, dy) || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (L * L))), d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) { best = d; at = acc + t * L; lat = Math.sign(dx * (y - ay) - dy * (x - ax)) * d; }
    acc += L;
  }
  return { s: at, lat };
}

const lineLength = (line: readonly Vec2[]) => line.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);

/** Whether (x, y) is within WALL_FACE_M of a walled edge of a cut. */
function onWallFace(cuts: readonly Cut[], x: number, y: number): boolean {
  for (const c of cuts) {
    if (x < c.bbox[0] || x > c.bbox[2] || y < c.bbox[1] || y > c.bbox[3]) continue;
    const h = locateCut(c, x, y);
    if (!h || h.s < 0 || h.s > c.s[c.s.length - 1]) continue;
    if ((h.wallL >= 0.5 && Math.abs(h.lateral - h.left) < WALL_FACE_M) || (h.wallR >= 0.5 && Math.abs(-h.lateral - h.right) < WALL_FACE_M)) return true;
  }
  return false;
}

function inStrip(cuts: readonly Cut[], x: number, y: number): boolean {
  return cuts.some(c => x >= c.bbox[0] && x <= c.bbox[2] && y >= c.bbox[1] && y <= c.bbox[3] && (() => { const h = locateCut(c, x, y); return !!h && insideCut(c, h); })());
}

/**
 * The steep ground sheets in the band on `side` (+1 left, -1 right) of `line`, out to `reachM`, between its ends:
 * every counted layer's triangles steeper than 45° that span STEEP_SPAN_M and STEEP_PLAN_M2, their centroid off the
 * wall faces (and, for the layers the cut channel masks, outside the strips). Binned by 4 m along the line.
 */
export function steepInBand(cells: readonly BuiltCell[], cuts: readonly Cut[], line: readonly Vec2[], side: 1 | -1, reachM: number): { n: number; m2: number; bins: Record<string, number>; layers: Record<string, number> } {
  const L = lineLength(line), out = { n: 0, m2: 0, bins: {} as Record<string, number>, layers: {} as Record<string, number> };
  for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
    if (SKIP.has(layer) || !m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, q = idx[t + 2] * 3;
      const cx = (p[a] + p[b] + p[q]) / 3, cy = (p[a + 1] + p[b + 1] + p[q + 1]) / 3;
      const h = alongLine(line, cx, cy);
      if (h.s <= 0 || h.s >= L || side * h.lat < 0 || side * h.lat > reachM) continue;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[q] - p[a], vy = p[q + 1] - p[a + 1], vz = p[q + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
      const plan = Math.abs(nz) / 2, span = Math.max(p[a + 2], p[b + 2], p[q + 2]) - Math.min(p[a + 2], p[b + 2], p[q + 2]);
      if (Math.abs(nz) / nl >= Math.SQRT1_2 || span <= STEEP_SPAN_M || plan <= STEEP_PLAN_M2) continue;
      if (onWallFace(cuts, cx, cy)) continue;
      // Land and green inside a strip are masked off by the cut channel (groundCell CUT_CHANNEL 0): not drawn.
      if (CUT_CHANNEL[layer] === 0 && inStrip(cuts, cx, cy)) continue;
      out.n++; out.m2 += plan;
      const bin = `s${Math.floor(h.s / 4) * 4}`;
      out.bins[bin] = (out.bins[bin] ?? 0) + 1; out.layers[layer] = (out.layers[layer] ?? 0) + 1;
    }
  }
  return out;
}

/** Samples every `stepM` along `line`: how many lie inside a cut with a wall on `side` of the line there. */
export function wallsAlong(cuts: readonly Cut[], line: readonly Vec2[], side: 1 | -1, stepM = 2): { samples: number; walled: number; open: number[] } {
  const L = lineLength(line), open: number[] = [];
  let samples = 0, walled = 0;
  for (let s = 0; s <= L + 1e-6; s += stepM) {
    // The point at s and the line's normal there.
    let acc = 0, px = line[0][0], py = line[0][1], nx = 0, ny = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const dx = line[i + 1][0] - line[i][0], dy = line[i + 1][1] - line[i][1], l = Math.hypot(dx, dy) || 1e-9;
      if (acc + l >= s || i + 2 === line.length) { const f = Math.min(1, (s - acc) / l); px = line[i][0] + dx * f; py = line[i][1] + dy * f; nx = -dy / l; ny = dx / l; break; }
      acc += l;
    }
    samples++;
    const ok = cuts.some(c => {
      const h = locateCut(c, px, py);
      if (!h || !insideCut(c, h)) return false;
      // Which of the cut's sides lies on `side` of the line: the lateral of a point 1 m that way.
      const g = locateCut(c, px + nx * side, py + ny * side);
      return !!g && (g.lateral > h.lateral ? h.wallL >= 0.5 : h.wallR >= 0.5);
    });
    if (ok) walled++; else open.push(Math.round(s));
  }
  return { samples, walled, open };
}
