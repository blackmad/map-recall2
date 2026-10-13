import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archWindow, wallPoint} from './worship-kit';
import {onWall, wallsOf, type Wall} from './worship-walls';
import source from './aron-schuster-synagoge-footprints.json';

/**
 * Raw Aron Schuster Synagoge (Obrechtsjoel), Jacob Obrechtplein / Heinzestraat, Harry Elte 1928, Amsterdam School.
 * Massing is the 3DBAG LoD2.2 shell (hall, tower, side blocks, 22.6 m tower). The facade features come from the 2025
 * municipal panoramas: the north-west wall on Jacob Obrechtplein (arched side door, pair of tall steel-framed windows with a
 * plaque beside them, small windows above), the covered entrance in the recess west of the strip-windowed hall wall (flat
 * concrete canopy with a dark inscription band on posts, double doors, steps), the five small strip windows, and the slit
 * windows of the tower. The Hebrew fascia inscription is represented as a plain dark band (letters not reproduced).
 */
/** Set-back roof levels measured from 3DBAG (m above ground); every vertex height snaps to the nearest, so roofs read as clean flat decks. */
const LEVELS = [0, 4.6, 5.4, 8.6, 10.5, 11.9, 13.7, 15.4, 17.1, 22.6];
const snap = (y: number) => LEVELS.reduce((best, l) => Math.abs(l - y) < Math.abs(best - y) ? l : best, 0);
/** Snap heights, then drop consecutive duplicate vertices (a sliver edge that collapses would break triangulation). */
const dedupe = (r: number[][]) => r.filter((p, i) => { const q = r[(i + r.length - 1) % r.length]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-4; });
const snapped = {...source, surfaces: source.surfaces.map(s => ({type: s.type, rings: s.rings.map(r => dedupe(r.map(p => [p[0], s.type === 'GroundSurface' ? p[1] : snap(p[1]), p[2]])))}))};
const walls = wallsOf(snapped as never);
const ring = source.nativeRing;
const inRing = (x: number, z: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], q = ring[j];
    if ((a[1] > z) !== (q[1] > z) && x < (q[0] - a[0]) * (z - a[1]) / (q[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const W = (i: number): Wall => {
  const w = walls.find(x => x.index === i);
  if (!w) throw Error(`wall #${i}`);
  return w;
};

/** Steel-framed tall window pane with grid bars. */
function steelPane(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const f = 0.06;
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, t, y, wd, f, 0.1, 'frame', 0.02);
  onWall(b, w, t, y + h - f, wd, f, 0.1, 'frame', 0.02);
  onWall(b, w, t - wd / 2 + f / 2, y, f, h, 0.1, 'frame', 0.02);
  onWall(b, w, t + wd / 2 - f / 2, y, f, h, 0.1, 'frame', 0.02);
  for (let k = 1; k <= 4; k++) onWall(b, w, t, y + h * k / 5, wd, 0.04, 0.09, 'frame', 0.02);
  onWall(b, w, t - wd / 6, y, 0.04, h, 0.09, 'frame', 0.02);
  onWall(b, w, t + wd / 6, y, 0.04, h, 0.09, 'frame', 0.02);
}

/** Small white-framed window with stone sill. */
function smallWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number, frame = 'white') {
  onWall(b, w, t, y - 0.07, wd + 0.14, 0.07, 0.12, 'concrete', 0);
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, t, y, wd, 0.05, 0.09, frame, 0.02);
  onWall(b, w, t, y + h - 0.05, wd, 0.05, 0.09, frame, 0.02);
  onWall(b, w, t - wd / 2 + 0.025, y, 0.05, h, 0.09, frame, 0.02);
  onWall(b, w, t + wd / 2 - 0.025, y, 0.05, h, 0.09, frame, 0.02);
}

export function buildAronSchusterSynagoge(_w: number, _d: number, b: BuildingTools) {
  addShell(b, snapped as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  // ---- north-west wall on Jacob Obrechtplein (#133, t runs from its east end to the west)
  const nw = W(133);
  archWindow(b, nw, 1.9, 0, 1.15, 2.7, {trim: 'greyBrick', glass: 'dark', mullions: 0, round: true});
  onWall(b, nw, 1.9, 0, 1.4, 0.18, 0.4, 'concrete', 0); // threshold
  steelPane(b, nw, 4.4, 0.85, 1.15, 3.35);
  steelPane(b, nw, 5.85, 0.85, 1.15, 3.35);
  onWall(b, nw, 5.15, 4.2, 3.4, 0.3, 0.1, 'greyBrick', 0); // soldier-course lintel
  onWall(b, nw, 5.15, 0.7, 3.4, 0.15, 0.1, 'greyBrick', 0); // sill course
  onWall(b, nw, 7.05, 1.0, 1.5, 0.45, 0.06, 'concrete', 0); // inscription plaque
  smallWindow(b, nw, 2.05, 4.7, 0.75, 0.9);
  smallWindow(b, nw, 4.35, 5.5, 0.75, 0.9);
  smallWindow(b, nw, 6.7, 5.5, 0.75, 0.9);

  // ---- covered entrance in the recess (#8): canopy with dark inscription fascia, double doors, steps
  const en = W(8), el = en.length, mid = el / 2;
  onWall(b, en, mid, 0, 1.7, 2.7, 0.1, 'ochre', 0.02); // timber double doors
  onWall(b, en, mid, 0, 0.06, 2.7, 0.14, 'dark', 0.02);
  onWall(b, en, mid - 1.15, 0.2, 0.55, 2.1, 0.08, 'glass', 0.02, 'pane');
  onWall(b, en, mid + 1.15, 0.2, 0.55, 2.1, 0.08, 'glass', 0.02, 'pane');
  onWall(b, en, mid, 3.5, 5.0, 0.18, 2.4, 'white', 0); // canopy slab
  onWall(b, en, mid, 3.68, 5.0, 0.45, 0.1, 'white', 2.4); // cream fascia on the front edge
  onWall(b, en, mid, 3.82, 4.5, 0.17, 0.04, 'dark', 2.5); // inscription strip (letters not reproduced)
  for (const dt of [-2.3, 2.3]) {
    const q = wallPoint(en, mid + dt, 2.2);
    b.box(q[0], 0, q[1], 0.14, 3.5, 0.14, 'white');
  }
  for (let s = 0; s < 2; s++) { const q = wallPoint(en, mid, 0.2 + s * 0.35); b.box(q[0], 0, q[1], 2.6, 0.14 * (2 - s), 0.4, 'concrete', Math.atan2(en.n[0], en.n[1])); }

  // ---- five small strip windows on the hall wall east of the entrance (#110) and its stone course
  const hall = W(110);
  onWall(b, hall, hall.length / 2, 4.1, hall.length, 0.14, 0.16, 'white', 0);
  for (let k = 0; k < 5; k++) smallWindow(b, hall, hall.length / 2 + (k - 2) * 1.2, 7.6, 0.8, 0.65, 'frame');
  for (const t of [1.4, 3.2]) smallWindow(b, hall, t, 2.7, 0.7, 0.6, 'frame');

  // ---- tower: slit windows and stone coping
  const tn = W(14), te = W(12);
  for (const w of [tn, te]) {
    for (const f of [0.3, 0.7]) onWall(b, w, w.length * f, 13.0, 0.22, 6.0, 0.08, 'dark', 0.01);
  }

  addCornices(b);
  addEntranceForecourt(b, en);
}

/** Pale projecting roof-edge slabs on every wall top (one per set-back), joined by rounded wedges at convex corners, plus the pale course at 4.1 m. */
function addCornices(b: BuildingTools) {
  const d = 0.25, th = 0.3;
  type End = {x: number; z: number; w: Wall; top: number};
  const ends: End[] = [];
  for (const w of walls) {
    const top = Math.max(...w.poly.map(p => p[1]));
    if (w.length < 2.4 || top < 8) continue;
    onWall(b, w, w.length / 2, top - 0.12, w.length, th, d + 0.08, 'white', -0.08);
    ends.push({x: w.origin[0], z: w.origin[1], w, top}, {x: w.origin[0] + w.tangent[0] * w.length, z: w.origin[1] + w.tangent[1] * w.length, w, top});
    if (w.base < 0.5 && w.length > 3 && top > 9 && w.index !== 110) onWall(b, w, w.length / 2, 4.1, w.length, 0.14, 0.16, 'white', 0);
  }
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const a = ends[i], c = ends[j];
    if (a.w === c.w || Math.abs(a.top - c.top) > 0.2 || Math.hypot(a.x - c.x, a.z - c.z) > 0.35) continue;
    const px = (a.x + c.x) / 2, pz = (a.z + c.z) / 2, na = a.w.n, nc = c.w.n;
    const dot = na[0] * nc[0] + na[1] * nc[1];
    if (dot > 0.95 || dot < -0.5 || inRing(px + (na[0] + nc[0]) * 0.1, pz + (na[1] + nc[1]) * 0.1)) continue; // straight, hairpin or reflex
    const a0 = Math.atan2(-na[1], na[0]), a1 = Math.atan2(-nc[1], nc[0]);
    const da = ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const sh = new T.Shape();
    sh.moveTo(px, -pz);
    for (let k = 0; k <= 8; k++) sh.lineTo(px + Math.cos(a0 + da * k / 8) * d, -pz + Math.sin(a0 + da * k / 8) * d);
    const g = new T.ExtrudeGeometry(sh, {depth: th, bevelEnabled: false});
    g.rotateX(-Math.PI / 2);
    g.translate(0, a.top - 0.12, 0);
    b.add(g, 'white' as never);
  }
}

/** Low brick garden wall, gate piers and a dark slatted iron gate in front of the entrance recess. */
function addEntranceForecourt(b: BuildingTools, en: Wall) {
  const mid = en.length / 2, front = 3.3, rot = Math.atan2(en.n[0], en.n[1]);
  const at = (t: number, out: number): [number, number] => wallPoint(en, t, out);
  // side wall running back to the building on the tower side, and the long low front wall on the hall side
  { const q = at(mid + 2.3, front / 2 + 0.1); b.box(q[0], 0, q[1], 0.35, 1.3, front, 'brick', rot); }
  { const q = at(mid - 5.5, front); b.box(q[0], 0, q[1], 7.4, 0.9, 0.35, 'brick', rot); }
  { const q = at(mid - 9.2, front / 2 - 0.1); b.box(q[0], 0, q[1], 0.35, 0.9, front + 0.3, 'brick', rot); }
  // piers and gate
  for (const t of [mid + 2.1, mid - 1.8]) { const q = at(t, front); b.box(q[0], 0, q[1], 0.55, 2.0, 0.55, 'brick', rot); }
  { const q = at(mid + 0.15, front); b.box(q[0], 0.1, q[1], 3.35, 0.06, 0.08, 'frame', rot); b.box(q[0], 1.9, q[1], 3.35, 0.06, 0.08, 'frame', rot); }
  for (let k = 0; k < 15; k++) { const q = at(mid - 1.5 + k * 0.255 + 0.1, front); b.box(q[0], 0.1, q[1], 0.05, 1.86, 0.05, 'frame', rot); }
}
