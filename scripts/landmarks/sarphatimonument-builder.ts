import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {textBoxes, textWidth} from './pixel-font';

/**
 * Sarphatimonument, Sarphatipark (monument and fountain for Dr Samuel Sarphati, unveiled 1886; designed by Louis Royer's pupil Jan Springer with the
 * sculptor Jacques de Braekeleer's bronze bust): a baldachin of eight red granite columns over a bronze bust, on a scaled stone base with four
 * shell basins and bronze frogs, in a lobed stone-rimmed pool inside a black hooped fence.
 * Original low-poly model from the Commons photographs by Ceescamel (CC BY-SA 4.0) and SanderK (CC BY-SA 2.5); proportions measured against the
 * columns in the photographs (about 11 m to the crown, base 6 m, pool about 20 m). Local frame: x east, z south, y up; the bust faces +z (south), the
 * facing is a visual estimate.
 */
type Colour = Parameters<BuildingTools['add']>[1];

/** Pool outline radius by angle: a four-lobed rounded square. */
const poolR = (th: number) => 9.0 + 1.1 * Math.cos(4 * th);

export interface SarphatiStats {columns: number; fenceBars: number}

export function buildSarphatimonument(_w: number, _d: number, b: BuildingTools, stats: SarphatiStats = {columns: 0, fenceBars: 0}) {
  const add = (g: T.BufferGeometry, c: Colour, x = 0, y = 0, z = 0) => b.add(g, c, x, y, z);
  const ring = (rOut: (th: number) => number, rIn: ((th: number) => number) | null, y0: number, y1: number, c: Colour, n = 64) => {
    const s = new T.Shape();
    for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, r = rOut(th); (i ? s.lineTo : s.moveTo).call(s, r * Math.cos(th), r * Math.sin(th)); }
    s.closePath();
    if (rIn) { const h = new T.Path(); for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, r = rIn(th); (i ? h.lineTo : h.moveTo).call(h, r * Math.cos(th), r * Math.sin(th)); } h.closePath(); s.holes.push(h); }
    const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false}); g.rotateX(Math.PI / 2); g.translate(0, y1, 0); add(g, c);
  };

  // ---- pool: stone rim 0.55 m high round a dark floor
  ring(th => poolR(th) + 0.55, th => poolR(th), 0, 0.55, 'concrete');
  ring(th => poolR(th) + 0.02, null, 0, 0.1, 'greyBrick');
  // coping on top of the rim
  ring(th => poolR(th) + 0.55, th => poolR(th), 0.55, 0.7, 'concrete');
  // ---- black hooped fence 3.6 m outside the rim
  {
    const n = 96, pts: [number, number][] = [];
    for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2; pts.push([Math.cos(th) * (poolR(th) + 1.5), Math.sin(th) * (poolR(th) + 1.5)]); }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
      b.box((p[0] + q[0]) / 2, 0.15, (p[1] + q[1]) / 2, len, 0.04, 0.04, 'dark', ang);
      b.box((p[0] + q[0]) / 2, 0.85, (p[1] + q[1]) / 2, len, 0.05, 0.05, 'dark', ang);
      const bars = Math.max(1, Math.round(len / 0.5));
      for (let k = 0; k < bars; k++) {
        const t = (k + 0.5) / bars; b.box(p[0] + (q[0] - p[0]) * t, 0, p[1] + (q[1] - p[1]) * t, 0.03, 0.9, 0.03, 'dark'); stats.fenceBars++;
      }
      if (i % 6 === 0) b.box(p[0], 0, p[1], 0.1, 1.05, 0.1, 'dark');
    }
  }

  // ---- monument: four-fold; face k puts geometry in a frame with x across the face, z out of it
  const faceOf = (k: number) => {
    const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const put = (g: T.BufferGeometry, x: number, y: number, z: number, col: Colour) => { g.rotateY(a); add(g, col, x * c + z * s, y, -x * s + z * c); };
    const box = (x: number, y0: number, z0: number, w: number, h: number, d: number, col: Colour) => put(new T.BoxGeometry(w, h, d), x, y0 + h / 2, z0 + d / 2, col);
    const ext = (shape: T.Shape, z0: number, dep: number, col: Colour) => put(new T.ExtrudeGeometry(shape, {depth: dep, bevelEnabled: false}), 0, 0, z0, col);
    return {put, box, ext};
  };

  // scaled base: battered octagonal frustum, 6.9 m across at the foot to 5.6 m at 1.8 m (the corners are cut in the photographs)
  { const g = new T.CylinderGeometry(2.95, 3.6, 1.8, 8, 1); g.rotateY(Math.PI / 8); add(g, 'stone', 0, 0.9 + 0.35, 0); }
  // solid dado core between the base and the column plinth
  b.box(0, 1.8, 0, 4.6, 1.5, 4.6, 'stone');
  // a stepped plinth ring under the base
  b.box(0, 0.0, 0, 7.6, 0.35, 7.6, 'concrete');
  for (let k = 0; k < 4; k++) {
    const f = faceOf(k);
    // shell basin: a wide bowl on a short bracket in the middle of every face, with a spout mask over it
    f.put(new T.CylinderGeometry(1.2, 0.55, 0.5, 14), 0, 1.65, 2.6, 'stone');
    f.put(new T.CylinderGeometry(1.0, 1.0, 0.04, 14), 0, 1.92, 2.6, 'glass');
    f.box(0, 0.35, 2.0, 0.9, 1.0, 0.6, 'stone');
    f.put(new T.SphereGeometry(0.2, 8, 6), 0, 2.45, 2.55, 'bronze');
    // frogs at the two corners of the face (bronze, 0.45 m)
    for (const s of [-1, 1]) { const g = new T.SphereGeometry(1, 8, 6); g.scale(0.22, 0.17, 0.3); f.put(g, s * 2.7, 0.55, 3.1, 'bronze'); f.put(new T.SphereGeometry(0.1, 6, 5), s * 2.7, 0.78, 3.28, 'bronze'); }
    // dado: 4.7 m block with a red marble panel, two small plaques and a lion-head roundel
    f.box(0, 2.0, 2.3, 4.2, 1.3, 0.1, 'stone');
    f.box(-1.45, 2.3, 2.38, 0.9, 0.55, 0.06, 'red'); f.box(1.45, 2.3, 2.38, 0.9, 0.55, 0.06, 'red'); f.box(0, 2.2, 2.38, 1.0, 0.8, 0.06, 'red');
    { const g = new T.CylinderGeometry(0.28, 0.28, 0.08, 12); g.rotateX(Math.PI / 2); f.put(g, 0, 2.65, 2.45, 'bronze'); }
    // arch band over the opening and the frieze lettering on the front only
    const sh = new T.Shape(); sh.moveTo(-1.35, 0); sh.lineTo(1.35, 0); sh.lineTo(1.35, 0); sh.absarc(0, 0, 1.35, 0, Math.PI, false); sh.lineTo(-1.35, 0);
    const hole = new T.Path(); hole.moveTo(-1.0, 0); hole.lineTo(1.0, 0); hole.absarc(0, 0, 1.0, 0, Math.PI, false); hole.lineTo(-1.0, 0); sh.holes.push(hole);
    f.put(new T.ExtrudeGeometry(sh, {depth: 0.35, bevelEnabled: false}), 0, 5.3, 1.95, 'stone');
    f.box(-1.2, 3.6, 1.95, 0.35, 1.7, 0.35, 'stone'); f.box(1.2, 3.6, 1.95, 0.35, 1.7, 0.35, 'stone');
    // entablature and pediment: cornice slab, dentil band, segmental pediment with raking cornice
    f.box(0, 6.95, 2.55, 5.5, 0.3, 0.2, 'stone');
    f.box(0, 6.55, 2.05, 4.6, 0.35, 0.65, 'stone');
    f.box(0, 6.0, 2.05, 4.2, 0.55, 0.35, 'stone');
    const ped = new T.Shape(); ped.absarc(0, 0, 2.1, 0, Math.PI, false); ped.lineTo(2.1, 0);
    { const g = new T.ExtrudeGeometry(ped, {depth: 0.3, bevelEnabled: false}); g.scale(1, 0.4, 1); f.put(g, 0, 7.3, 2.2, 'stone'); }
    const pedIn = new T.Shape(); pedIn.absarc(0, 0, 1.75, 0, Math.PI, false); pedIn.lineTo(1.75, 0);
    { const g = new T.ExtrudeGeometry(pedIn, {depth: 0.08, bevelEnabled: false}); g.scale(1, 0.4, 1); f.put(g, 0, 7.3, 2.5, 'concrete'); }
    // drum cartouche and urns
    f.box(0, 7.6, 1.2, 1.5, 0.7, 0.2, 'stone');
    { const g = new T.SphereGeometry(1, 10, 6); g.scale(0.5, 0.3, 0.1); f.put(g, 0, 8.0, 1.5, 'copper'); }
    for (const s of [-1, 1]) { f.put(new T.CylinderGeometry(0.15, 0.1, 0.5, 8), s * 1.4, 8.45, 1.45, 'stone'); f.put(new T.SphereGeometry(0.17, 8, 6), s * 1.4, 8.8, 1.45, 'stone'); }
  }
  // eight red granite columns, in pairs at the corners, bronze bases and capitals
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const swap of [false, true]) {
    stats.columns++;
    const x = (swap ? 1.45 : 1.75) * sx, z = (swap ? 1.75 : 1.45) * sz;
    b.add(new T.CylinderGeometry(0.21, 0.23, 3.0, 10), 'red', x, 3.6 + 1.5, z);
    b.add(new T.CylinderGeometry(0.3, 0.3, 0.25, 10), 'bronze', x, 3.6 + 0.12, z);
    b.add(new T.CylinderGeometry(0.34, 0.26, 0.3, 10), 'bronze', x, 6.6 - 0.15, z);
  }
  // column plinth slab that the bases stand on, and the roof slab of the baldachin
  b.box(0, 3.3, 0, 5.2, 0.3, 5.2, 'stone');
  b.box(0, 6.6, 0, 5.7, 0.35, 5.7, 'stone');
  // the bronze bust of Sarphati on its pedestal in the middle, facing +z
  b.box(0, 3.6, 0, 1.0, 0.9, 1.0, 'bronze');
  b.box(0, 4.5, 0, 0.85, 0.12, 0.85, 'bronze');
  { const g = new T.SphereGeometry(1, 10, 8); g.scale(0.42, 0.34, 0.26); b.add(g, 'bronze', 0, 4.95, 0); }
  { const g = new T.SphereGeometry(1, 10, 8); g.scale(0.16, 0.21, 0.17); b.add(g, 'bronze', 0, 5.4, 0.03); }
  // drum, dome, finial and the gilt crown
  b.box(0, 6.95, 0, 3.0, 1.4, 3.0, 'stone');
  b.box(0, 8.35, 0, 3.3, 0.18, 3.3, 'stone');
  { const g = new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.65, 1.5, 1.65); b.add(g, 'copper', 0, 8.53, 0); }
  b.add(new T.CylinderGeometry(0.26, 0.45, 0.5, 8), 'stone', 0, 10.28, 0);
  b.add(new T.CylinderGeometry(0.1, 0.2, 0.55, 8), 'stone', 0, 10.8, 0);
  { const g = new T.CylinderGeometry(0.34, 0.2, 0.34, 8, 1, true); b.add(new T.CylinderGeometry(0.2, 0.2, 0.05, 8), 'gold', 0, 11.1, 0); b.add(g, 'gold', 0, 11.245, 0); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.add(new T.ConeGeometry(0.05, 0.2, 4), 'gold', Math.cos(a) * 0.34, 11.46, Math.sin(a) * 0.34); } b.add(new T.CylinderGeometry(0.34, 0.34, 0.03, 8), 'gold', 0, 11.37, 0); }
  // frieze lettering SARPHATI on the south (+z) entablature front
  {
    const word = 'SARPHATI', pixel = 0.05, W = textWidth(word, pixel);
    for (const t of textBoxes(word, pixel)) b.box(t.x + t.w / 2 - W / 2, 6.0 + 0.1 + t.y, 2.4 + 0.02, t.w, t.h, 0.04, 'gold');
  }
}
