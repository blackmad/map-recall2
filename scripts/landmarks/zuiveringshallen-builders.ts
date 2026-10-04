import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './zuiveringshallen-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
/** Original native Westergas halls. Cadastral bays remain disjoint; no imported mesh or photo texture. */
export function buildZuiveringshallen(id: string, _w: number, _d: number, b: BuildingTools) {
  const ensemble = data.ensembles.find(e => e.id === id)!;
  const angle = ensemble.authorHeadingDegrees * Math.PI / 180;
  const project = (p: number[]) => {
    const e = (p[0] - ensemble.anchor[0]) * 111320 * Math.cos(ensemble.anchor[1] * Math.PI / 180);
    const n = (p[1] - ensemble.anchor[1]) * 110540;
    return new T.Vector2(e * Math.sin(angle) + n * Math.cos(angle), e * Math.cos(angle) - n * Math.sin(angle));
  };
  const rings = ensemble.parents.map(p => p.geometry.coordinates[0].slice(0, -1).map(project));
  function triangles(positions: number[], c: Colour) {
    if (!positions.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); b.add(g, c);
  }
  function clip(ring: T.Vector2[], z: number, above: boolean) {
    const out: T.Vector2[] = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], a = above ? p.y >= z : p.y <= z, c = above ? q.y >= z : q.y <= z;
      if (a) out.push(p.clone());
      if (a !== c) { const t = (z - p.y) / (q.y - p.y); out.push(new T.Vector2(p.x + (q.x - p.x) * t, z)); }
    }
    return out;
  }
  function roofVolume(ring: T.Vector2[], breaks: number[], height: (z: number) => number) {
    const walls: number[] = [], clockwise = T.ShapeUtils.area(ring) < 0;
    const tri = (out: number[], a: number[], c: number[], d: number[]) => { if (clockwise) out.push(...a, ...d, ...c); else out.push(...a, ...c, ...d); };
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const ts = [0, 1];
      for (const z of breaks) if ((p.y - z) * (q.y - z) < 0) ts.push((z - p.y) / (q.y - p.y));
      ts.sort((a, c) => a - c);
      for (let j = 0; j < ts.length - 1; j++) {
        const a = p.clone().lerp(q, ts[j]), c = p.clone().lerp(q, ts[j + 1]);
        const lo = [a.x, 0, a.y], hi = [a.x, height(a.y), a.y], lq = [c.x, 0, c.y], hq = [c.x, height(c.y), c.y];
        tri(walls, lo, hi, hq); tri(walls, lo, hq, lq);
      }
    }
    triangles(walls, 'brick');
    // Each pitch owns its upward roof triangles; no duplicate upward extrusion cap.
    for (let i = 0; i < breaks.length - 1; i++) {
      const part = clip(clip(ring, breaks[i], true), breaks[i + 1], false);
      if (part.length < 3) continue;
      const shape = new T.ShapeGeometry(new T.Shape(part)), p = shape.getAttribute('position'), ix = shape.index!, roof: number[] = [];
      for (let j = 0; j < ix.count; j += 3) {
        const v = [0, 1, 2].map(k => { const n = ix.getX(j + k), z = p.getY(n); return [p.getX(n), height(z) + .02, z]; });
        // ShapeGeometry XY faces +Z; XZ roof must face +Y, so reverse it.
        roof.push(...v[0], ...v[2], ...v[1]);
      }
      shape.dispose(); triangles(roof, 'slate');
    }
  }
  function plane(x: number, y: number, z: number, w: number, h: number, c: Colour, rotation = Math.PI) {
    b.add(new T.PlaneGeometry(w, h), c, x, y + h / 2, z, rotation);
  }
  function arch(x: number, y: number, z: number, w: number, h: number, c: Colour, rotation = Math.PI) {
    const s = new T.Shape(), r = w / 2, shoulder = h - r;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, shoulder);
    for (let i = 1; i <= 10; i++) { const a = i * Math.PI / 10; s.lineTo(Math.cos(a) * r, shoulder + Math.sin(a) * r); }
    s.closePath(); b.add(new T.ShapeGeometry(s), c, x, y, z, rotation);
  }
  function window(x: number, y: number, z: number, w: number, h: number, front: boolean, round = true) {
    const s = front ? -1 : 1, a = front ? Math.PI : 0;
    if (round) { arch(x, y, z, w + .24, h + .16, 'stone', a); arch(x, y + .10, z + s * .035, w, h - .04, 'dark', a); }
    else { plane(x, y, z, w + .20, h + .14, 'stone', a); plane(x, y + .08, z + s * .035, w, h - .02, 'dark', a); }
    plane(x, y + .16, z + s * .06, w - .16, h - (round ? w * .50 : .27), 'glass', a);
    b.box(x, y + .13, z + s * .075, .07, h - .19, .08, 'dark');
    b.box(x, y + h * .51, z + s * .08, w - .08, .07, .085, 'dark');
    b.box(x, y - .11, z, w + .32, .16, .28, 'stone');
  }
  const bounds = (r: T.Vector2[]) => ({ x0: Math.min(...r.map(p => p.x)), x1: Math.max(...r.map(p => p.x)), z0: Math.min(...r.map(p => p.y)), z1: Math.max(...r.map(p => p.y)) });
  const main = bounds(rings[0]);
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j], p = ensemble.parents[j], r = bounds(ring), mid = (r.z0 + r.z1) / 2;
    if (id === 'de-krakeling' && j === 0) {
      // Actual broad eastern parent contains high central hall plus low front/rear roofs.
      const valley = 9.6, ridge = 15.0;
      roofVolume(clip(clip(ring, -valley, true), valley, false), [-valley, 0, valley], z => 9.4 + 8.5 * (1 - Math.abs(z) / valley));
      // The low roofs meet a vertical high-hall wall, rather than climbing to its eaves.
      for (const side of [-1, 1]) {
        const wing = clip(ring, side * valley, side > 0);
        const breaks = side < 0 ? [r.z0 - .01, -ridge, -valley] : [valley, ridge, r.z1 + .01];
        roofVolume(wing, breaks, z => 5.6 + 4.95 * Math.max(0, 1 - Math.abs(Math.abs(z) - ridge) / 5.6));
      }
    } else {
      const half = (r.z1 - r.z0) / 2;
      roofVolume(ring, [r.z0 - .01, mid, r.z1 + .01], z => p.eaveMetres + (p.ridgeMetres - p.eaveMetres) * Math.max(0, 1 - Math.abs(z - mid) / half));
    }
    // Main-hall clerestory above the lower roofs; roof-height hierarchy remains legible.
    if (j === 0) {
      for (const s of [-1, 1]) for (let x = r.x0 + 3; x < r.x1 - 1.6; x += 4.7) {
        const z = id === 'de-krakeling' ? s * 9.645 : s < 0 ? main.z0 - .045 : main.z1 + .045;
        window(x, 7.3, z, 1.35, 2.1, s < 0, false);
        b.box(x + 2.1, 5.6, z, .30, 4.45, .36, 'brick');
      }
      // Three small ridge rooflights on West, one on the shorter Motion hall.
      const count = id === 'zuiveringshal-west' ? 3 : id === 'amsterdam-in-motion' ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const x = r.x0 + (r.x1 - r.x0) * (i + 1) / (count + 1);
        const rise = id === 'de-krakeling' ? .06 : .43;
        b.box(x, p.ridgeMetres - .12, mid, 8.1, rise + .03, 1.1, 'glass');
        b.box(x, p.ridgeMetres + rise - .08, mid, 8.35, .10, 1.36, 'slate');
        for (let u = -3.95; u <= 3.96; u += 1.32) b.box(x + u, p.ridgeMetres - .12, mid - .57, .08, rise + .03, .10, 'white');
      }
      if (id === 'de-krakeling') {
        // Decorate only the actual long external low-wing segments, not partitions against attached bays.
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], q = ring[(i + 1) % ring.length];
          if (Math.abs(q.x - a.x) < 5 || Math.abs(q.y - a.y) > .6 || Math.abs((a.y + q.y) / 2) < 18.9) continue;
          const lo = Math.min(a.x, q.x), hi = Math.max(a.x, q.x), z = (a.y + q.y) / 2, front = z < 0;
          for (let x = lo + 1.3; x < hi - .7; x += 2.5) { window(x, .9, z + (front ? -.05 : .05), 1.6, 2.7, front); window(x, 4.28, z + (front ? -.05 : .05), .70, .96, front); }
          b.box((lo + hi) / 2, 5.45, z, hi - lo, .20, .30, 'stone');
        }
      }
      continue;
    }
    const front = (r.z0 + r.z1) / 2 < 0, z = front ? r.z0 - .045 : r.z1 + .045, width = r.x1 - r.x0;
    for (const y of [.65, 4.0]) b.box((r.x0 + r.x1) / 2, y, z, width, .16, .20, 'stone');
    const n = Math.max(2, Math.round(width / 2.5));
    for (let k = 0; k < n; k++) {
      const x = r.x0 + (k + .5) * width / n;
      window(x, .9, z + (front ? -.03 : .03), Math.min(1.6, width / n * .68), 2.7, front);
      // Small repetitive round-headed upper lights below the visible cornice.
      window(x, 4.28, z + (front ? -.025 : .025), .70, .96, front);
    }
    b.box((r.x0 + r.x1) / 2, 5.44, z, width, .22, .34, 'stone');
  }
  function frontGable(parentSuffix: string, w: number, portal: boolean, chimney: boolean) {
    const j = ensemble.parents.findIndex(p => p.bagId.endsWith(parentSuffix));
    if (j < 0) return;
    const r = bounds(rings[j]), x = (r.x0 + r.x1) / 2, z = r.z0 - .18, base = 5.43, top = 10.6;
    const s = new T.Shape(); s.moveTo(-w / 2, base); s.lineTo(w / 2, base); s.lineTo(0, top); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: .32, bevelEnabled: false }); b.add(g, 'brick', x, 0, z);
    for (const side of [-1, 1]) {
      const dx = side * w / 2, dy = base - top, length = Math.hypot(dx, dy), geom = new T.BoxGeometry(.18, length, .40);
      geom.rotateZ(Math.atan2(-dx, dy)); b.add(geom, 'stone', x + dx / 2, (base + top) / 2, z + .08);
      b.box(x + side * w / 2, 0, z, .58, 6.8, .60, 'brick'); b.box(x + side * w / 2, 6.7, z, .83, .16, .83, 'stone');
    }
    const circle = new T.CircleGeometry(.83, 16); b.add(circle, 'stone', x, 7.55, z - .03, Math.PI);
    b.add(new T.CircleGeometry(.68, 16), 'glass', x, 7.55, z - .06, Math.PI);
    b.box(x, 6.87, z - .075, .06, 1.36, .08, 'dark'); b.box(x, 7.53, z - .08, 1.36, .06, .08, 'dark');
    for (const u of [-w * .23, w * .23]) arch(x + u, 5.86, z - .04, .85, 1.30, 'dark');
    if (portal) {
      // Broad current metal-and-glass entrance is visible in the owner photographs.
      b.box(x, 0, z - .12, 6.3, 4.3, .38, 'stone'); plane(x, .12, z - .34, 5.58, 3.83, 'glass');
      for (let u = -2.79; u <= 2.80; u += 1.395) b.box(x + u, .12, z - .37, .11, 3.84, .12, 'dark');
      b.box(x, 3.10, z - .37, 5.58, .10, .12, 'dark');
    }
    if (chimney) {
      // Decorative entrance finial height is approximate from owner imagery, not a surveyed chimney claim.
      b.box(x, 9.54, z + .08, .70, 2.35, .73, 'brick'); b.box(x, 11.89, z + .08, .98, .20, .95, 'stone');
      b.box(x, 12.09, z + .08, .06, .62, .06, 'dark');
    }
  }
  if (id === 'zuiveringshal-west') frontGable('6031', 11.3, true, true);
  else if (id === 'amsterdam-in-motion') {
    frontGable('6651', 8.0, false, false);
    const r = bounds(rings[ensemble.parents.findIndex(p => p.bagId.endsWith('6952'))]), x = (r.x0 + r.x1) / 2;
    b.box(x, .10, r.z0 - .18, 6.2, 4.07, .26, 'stone'); plane(x, .25, r.z0 - .33, 5.73, 3.66, 'glass');
    for (let u = -2.86; u <= 2.87; u += 1.43) b.box(x + u, .25, r.z0 - .36, .11, 3.66, .10, 'dark');
  } else {
    // Current Krakeling entrance occupies the western projecting bay of its own parent.
    const x = main.x0 + 10.35, z = main.z0 - .17, w = 9.3;
    const s = new T.Shape(); s.moveTo(-w / 2, 5.55); s.lineTo(w / 2, 5.55); s.lineTo(0, 11.9); s.closePath();
    b.add(new T.ExtrudeGeometry(s, { depth: .35, bevelEnabled: false }), 'brick', x, 0, z);
    b.box(x, 0, z - .14, 6.1, 4.3, .30, 'stone'); plane(x, .12, z - .33, 5.5, 3.92, 'glass');
    for (const u of [-2.75, -1.4, 0, 1.4, 2.75]) b.box(x + u, .12, z - .36, .09, 3.92, .12, 'dark');
    b.add(new T.CircleGeometry(.90, 16), 'stone', x, 8.0, z - .04, Math.PI); b.add(new T.CircleGeometry(.71, 16), 'glass', x, 8.0, z - .07, Math.PI);
    // Three small event flags reproduce the current venue’s entrance gesture without photo textures.
    for (let k = 0; k < 3; k++) { const u = x - 5.1 + k * 5.1; b.box(u, 0, z - .95, .07, 8.8, .07, 'dark'); b.box(u + .50, 3.4, z - .94, .94, 4.55, .08, k === 1 ? 'gold' : 'red'); }
  }
}
