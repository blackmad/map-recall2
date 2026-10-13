import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './begijnhof-source.json';

/**
 * Begijnhof court houses (Amsterdam): the ring of gabled houses round the lawn, seventeen BAG pands (south arc Begijnhof 1-27, the east row and the
 * west row beside the Houten Huys), with the lawn, front gardens behind picket fences, the weeping beech, the chestnut, the stone Beguine statue
 * and the lamps. The Begijnhofkapel, the English Reformed Church and the Houten Huys are separate models and are not repeated here.
 * Plans and heights: BAG footprints and 3DBAG ridge heights (begijnhof-source.json). Facades from Gemeente Amsterdam panoramas (CC BY 4.0, passage
 * views only; the court is gated) and Wikimedia Commons photographs by Dietmar Rabich (CC BY-SA 4.0) and Dennis G. Jarvis (CC BY-SA 2.0).
 * Each house gets a court-facing gable (step, neck, bell or spout, chosen to follow the photographed skyline), a window grid with white sash frames,
 * and a door with a stoop; party walls and backs are plain brick under a pitched roof. Window counts follow measured frontage, not the true sashes.
 */
type Colour = Parameters<BuildingTools['add']>[1];
const MX = 111320 * Math.cos(source.anchor[1] * Math.PI / 180), MY = 110540;
const local = (p: number[]) => new T.Vector2((p[0] - source.anchor[0]) * MX, -(p[1] - source.anchor[1]) * MY);
/** Open lawn of the court in the local frame (x east, z south). */
const LAWN: [number, number][] = [[-52, 23], [-37, 20], [-21, 15.5], [-11.5, 18], [-9.5, 27], [-13, 28.5], [-55, 42], [-57, 36], [-50, 34], [-53, 30]];
const GABLES = ['step', 'neck', 'bell', 'spout'] as const;

const RINGS = source.pands.map(p => p.ring.slice(0, -1).map(local));
function inRing(r: T.Vector2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i].y > y) !== (r[j].y > y) && x < (r[j].x - r[i].x) * (y - r[i].y) / (r[j].y - r[i].y) + r[i].x) inside = !inside;
  return inside;
}

export function buildBegijnhof(_w: number, _d: number, b: BuildingTools) {
  const lawnC = LAWN.reduce((a, p) => [a[0] + p[0] / LAWN.length, a[1] + p[1] / LAWN.length], [0, 0]);
  source.pands.forEach((pand, index) => {
    const ring = pand.ring.slice(0, -1).map(local);
    // Make the ring counter-clockwise in (x, z-south) so edge normals are consistent.
    let area = 0; ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; area += p.x * q.y - q.x * p.y; });
    if (area < 0) ring.reverse();
    // Court-facing edge: the longest-enough edge whose midpoint is nearest the lawn centre.
    let best = -1, bestD = 1e9;
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length], len = p.distanceTo(q); if (len < 3.2) return;
      const m = p.clone().lerp(q, .5), d = Math.hypot(m.x - lawnC[0], m.y - lawnC[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0) return;
    const p0 = ring[best], p1 = ring[(best + 1) % ring.length], edge = p1.clone().sub(p0), width = edge.length();
    const e = edge.clone().normalize(), nrm = new T.Vector2(-e.y, e.x); // outward for a counter-clockwise ring in a y-down frame is -(e.y), e.x flipped below
    const mid = p0.clone().lerp(p1, .5);
    const toLawn = new T.Vector2(lawnC[0] - mid.x, lawnC[1] - mid.y);
    if (nrm.dot(toLawn) < 0) nrm.negate();
    const angle = Math.atan2(nrm.x, nrm.y), u = new T.Vector2(Math.cos(angle), -Math.sin(angle));
    const at = (x: number, z: number) => mid.clone().addScaledVector(u, x).addScaledVector(nrm, z);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: Colour) => { const q = at(x, z); b.box(q.x, y, q.y, w, h, d, c, angle); };
    const ridge = Math.max(8, (pand.ridgeM ?? 12) - (pand.groundM ?? 0)), rise = Math.min(3.4, width / 2 * 1.05), eave = ridge - rise;
    // Body to the eave.
    const body = new T.ExtrudeGeometry(new T.Shape(ring), {depth: eave, bevelEnabled: false});
    body.rotateX(Math.PI / 2); body.translate(0, eave, 0);
    b.add(body, 'brick');
    // Local extents of the footprint in the front frame (u across, v depth inward).
    const us: number[] = [], vs: number[] = [];
    ring.forEach(p => { const d = p.clone().sub(mid); us.push(d.dot(u)); vs.push(-d.dot(nrm)); });
    const umin = Math.min(...us), umax = Math.max(...us), vmax = Math.max(...vs), vmin = Math.min(...vs);
    const fill = Math.abs(area / 2) / ((umax - umin) * (vmax - vmin));
    // Pitched roof along the depth (ridge perpendicular to the front, gable to the court), else a flat slate cap.
    const rv = (x: number, y: number, z: number) => { const q = at(x, z); return [q.x, y, q.y]; };
    const tri = (pts: number[][], c: Colour) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); b.add(g, c); };
    const z0 = -vmax + 0.02, z1 = -vmin + 0.0, uc = (umin + umax) / 2;
    if (fill > .5) {
      const zf = z1 - .22, X0 = umin - .1, X1 = umax + .1;
      const P = (x: number, y: number, z: number) => rv(x, y, z);
      const BL = P(X0, eave, z0), FL = P(X0, eave, zf), BR = P(X1, eave, z0), FR = P(X1, eave, zf), RB = P(uc, ridge, z0), RF = P(uc, ridge, zf);
      const quad = (a: number[], b2: number[], c: number[], d: number[]) => [a, b2, c, a, c, d];
      tri([...quad(BL, FL, RF, RB), ...quad(RB, RF, FR, BR), FL, FR, RF, BL, RB, BR, ...quad(BL, BR, FR, FL)], 'red');
    } else {
      const slab = new T.ExtrudeGeometry(new T.Shape(ring), {depth: .3, bevelEnabled: false}); slab.rotateX(Math.PI / 2); slab.translate(0, eave + .3, 0); b.add(slab, 'slate');
    }
    // Court gable: a stepped silhouette from the eave to the ridge, set on the front, in brick with a stone coping.
    const kind = GABLES[(index * 7 + 3) % GABLES.length], half = width / 2;
    const sil = new T.Shape(); sil.moveTo(-half, 0);
    const prof: [number, number][] = [];
    if (kind === 'step') { const n = 4; for (let k = 0; k < n; k++) { const x = half * (1 - k / n), y = rise * (k + 1) / n; prof.push([-x, y - rise / n], [-x, y], [-x + half / n, y]); } }
    else if (kind === 'neck') { prof.push([-half, 0], [-half * .55, rise * .15], [-half * .55, rise * .62], [-half * .3, rise * .78]); }
    else if (kind === 'bell') { prof.push([-half, 0], [-half * .9, rise * .3], [-half * .55, rise * .55], [-half * .3, rise * .8]); }
    else { prof.push([-half, 0], [-half * .8, rise * .4], [-half * .45, rise * .7], [-half * .2, rise * .9]); }
    prof.forEach(([x, y], i) => { if (i === 0) sil.lineTo(x, y); else sil.lineTo(x, y); });
    sil.lineTo(0, rise);
    [...prof].reverse().forEach(([x, y]) => sil.lineTo(-x, y));
    sil.lineTo(half, 0); sil.closePath();
    const gg = new T.ExtrudeGeometry(sil, {depth: .22, bevelEnabled: false});
    { const q = at(0, -.22 + .0); b.add(gg, 'brick', q.x, eave, q.y, angle); }
    // Stone coping: a thin dark-stone cap along the gable top, on the silhouette's top edge.
    box(0, ridge - .02, -.05, .5, .12, .3, 'stone');
    // Windows and door: white sash frames with glass, three or four storeys.
    /** True when the opening's footprint on the wall is clear of every other pand's body (party walls and jogs hide it). */
    const clear = (x: number, wd: number) => [-wd / 2 - .15, 0, wd / 2 + .15].every(dx => { const q = at(x + dx, .3); return !RINGS.some((r, k) => k !== index && inRing(r, q.x, q.y)) && !inRing(ring, q.x, q.y); });
    const floors = Math.max(2, Math.round(eave / 3.1)), cols = Math.max(1, Math.round(width / 2.1)), pitch = width / cols;
    const doorCol = index % cols;
    for (let fl = 0; fl < floors; fl++) {
      const y = fl === 0 ? 1.0 : .55 + fl * 3.0, h = fl === 0 ? 1.55 : 1.75, wid = Math.min(1.0, pitch * .55);
      for (let c = 0; c < cols; c++) {
        const x = -width / 2 + pitch * (c + .5);
        if (!clear(x, wid + .4)) continue;
        if (fl === 0 && c === doorCol) {
          box(x, 0.35, .08, wid + .1, 2.3, .12, 'white'); box(x, 0.35, .03, wid - .12, 2.1, .04, 'dark');
          for (const s of [0, 1, 2]) box(x, 0.0 + s * .17, .22 + (2 - s) * .22, wid + .6, .17, .44 - (2 - s) * .22 + .05, 'concrete');
          continue;
        }
        box(x, y, .05, wid + .16, h + .16, .1, 'white');
        box(x, y + .08, .02, wid, h, .04, 'glass');
        box(x, y + .08 + h / 2 - .025, .08, wid, .05, .06, 'white');
        box(x, y + h + .16, .09, wid + .3, .1, .16, 'stone');
      }
    }
    // Hoist beam in the gable.
    box(0, ridge - .5, .12, .08, .4, .22, 'bronze');
    // Front garden fence: low black pickets (a rail on posts) with a front hedge strip, 3 m out from the wall.
    for (let x = -width / 2; x <= width / 2 + .001; x += width / Math.max(2, Math.round(width / 1.6))) box(x, 0, 3.0, .06, .85, .06, 'bronze');
    box(0, .55, 3.0, width, .05, .05, 'bronze'); box(0, .8, 3.0, width, .05, .05, 'bronze');
    box(0, 0, 2.6, width - .2, .35, .7, 'green');
  });
  // Lawn: a flat green slab at the court (a hair above the ground, no overlap with the houses).
  const lawn = new T.Shape(LAWN.map(p => new T.Vector2(p[0], p[1])));
  const lg = new T.ExtrudeGeometry(lawn, {depth: .04, bevelEnabled: false}); lg.rotateX(Math.PI / 2); lg.translate(0, .04, 0); b.add(lg, 'green');
  // Weeping beech (dark leaves) and horse chestnut (green) from the photographs; the statue of a Beguine and lamps.
  const trunk = (x: number, z: number, h: number) => { const g = new T.CylinderGeometry(.15, .19, h, 8); b.add(g, 'bronze', x, h / 2, z); };
  trunk(-44, 27, 3.2);
  { const g = new T.SphereGeometry(1, 12, 8); g.scale(5.5, 5.5, 5.5); b.add(g, 'green', -44, 8, 27); }
  trunk(-24, 22, 3.6);
  { const g = new T.SphereGeometry(1, 12, 8); g.scale(3.0, 2.6, 3.0); b.add(g, 'bronze', -24, 5.2, 22); }
  trunk(-31, 24.5, 4.0);
  { const g = new T.SphereGeometry(1, 10, 8); g.scale(2.6, 3.0, 2.6); b.add(g, 'green', -31, 6, 24.5); }
  // Beguine statue on a stone plinth near the east end of the lawn.
  b.box(-20, 0, 27, .7, .4, .7, 'stone');
  { b.add(new T.CylinderGeometry(.14, .3, 1.0, 8), 'stone', -20, .4 + .5, 27); b.add(new T.CylinderGeometry(.11, .14, .4, 8), 'stone', -20, 1.6, 27); b.add(new T.SphereGeometry(.11, 8, 6), 'stone', -20, 1.78, 27); }
  // Lamp posts at the path (cast iron, 3.2 m).
  for (const [x, z] of [[-48, 30], [-33, 28.5], [-16, 24]]) { b.box(x, 0, z, .12, 3.0, .12, 'bronze'); b.box(x, 3.0, z, .4, .5, .4, 'stone'); b.box(x, 3.5, z, .5, .1, .5, 'bronze'); }
}
