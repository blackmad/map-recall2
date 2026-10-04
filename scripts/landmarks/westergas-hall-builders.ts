import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './westergas-hall-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
/** Original measured Machinegebouw/Cantine and De Wester hall, with their current roof silhouettes. */
export function buildWestergasHall(id: string, _w: number, _d: number, b: BuildingTools) {
 const source = data.buildings.find(p => p.id === id)!, angle = source.authorHeadingDegrees * Math.PI / 180;
 const project = (p: number[]) => { const e = (p[0] - source.anchor[0]) * 111320 * Math.cos(source.anchor[1] * Math.PI / 180), n = (p[1] - source.anchor[1]) * 110540; return new T.Vector2(e * Math.sin(angle) + n * Math.cos(angle), e * Math.cos(angle) - n * Math.sin(angle)); };
 const ring = source.parents[0].geometry.coordinates[0].slice(0, -1).map(project);
 const x0 = Math.min(...ring.map(p => p.x)), x1 = Math.max(...ring.map(p => p.x)), z0 = Math.min(...ring.map(p => p.y)), z1 = Math.max(...ring.map(p => p.y));
 function geometry(values: number[], c: Colour) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals(); b.add(g, c); }
 function clip(poly: T.Vector2[], value: number, key: 'x' | 'y', above: boolean) {
  const out: T.Vector2[] = [];
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], a = above ? p[key] >= value : p[key] <= value, c = above ? q[key] >= value : q[key] <= value;
   if (a) out.push(p.clone()); if (a !== c) out.push(p.clone().lerp(q, (value - p[key]) / (q[key] - p[key])));
  }
  return out;
 }
 function volume(poly: T.Vector2[], zBreaks: number[], height: (x: number, z: number) => number) {
  if (poly.length < 3) return;
  const walls: number[] = [], clockwise = T.ShapeUtils.area(poly) < 0;
  for (let i = 0; i < poly.length; i++) {
   const p = poly[i], q = poly[(i + 1) % poly.length], ts = [0, 1];
   for (const z of zBreaks) if ((p.y - z) * (q.y - z) < 0) ts.push((z - p.y) / (q.y - p.y)); ts.sort((a, c) => a - c);
   for (let j = 0; j < ts.length - 1; j++) { const a = p.clone().lerp(q, ts[j]), c = p.clone().lerp(q, ts[j + 1]); const p0 = [a.x, 0, a.y], p1 = [a.x, height(a.x, a.y), a.y], q0 = [c.x, 0, c.y], q1 = [c.x, height(c.x, c.y), c.y];
    if (clockwise) walls.push(...p0, ...q1, ...p1, ...p0, ...q0, ...q1); else walls.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
   }
  }
  geometry(walls, 'brick');
  for (let i = 0; i < zBreaks.length - 1; i++) {
   const part = clip(clip(poly, zBreaks[i], 'y', true), zBreaks[i + 1], 'y', false); if (part.length < 3) continue;
   const shape = new T.ShapeGeometry(new T.Shape(part)), p = shape.getAttribute('position'), ix = shape.index!, roofs: number[] = [];
   for (let j = 0; j < ix.count; j += 3) { const vertices = [0, 1, 2].map(k => { const v = ix.getX(j + k), x = p.getX(v), z = p.getY(v); return [x, height(x, z) + .025, z]; }); roofs.push(...vertices[0], ...vertices[2], ...vertices[1]); }
   shape.dispose(); geometry(roofs, 'slate');
  }
 }
 function arch(x: number, y: number, z: number, width: number, height: number, colour: Colour, rotation: number) {
  const r = width / 2, shoulder = height - r, s = new T.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, shoulder);
  for (let i = 1; i <= 10; i++) { const a = i * Math.PI / 10; s.lineTo(r * Math.cos(a), shoulder + r * Math.sin(a)); } s.closePath(); b.add(new T.ShapeGeometry(s), colour, x, y, z, rotation);
 }
 function plane(x: number, y: number, z: number, w: number, h: number, c: Colour, a: number) { b.add(new T.PlaneGeometry(w, h), c, x, y + h / 2, z, a); }
 function window(x: number, y: number, z: number, width: number, height: number, a: number, pair = false, blind = false) {
  const nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
  arch(x, y, z, width + .24, height + .16, 'stone', a);
  arch(x + nx * .025, y + .09, z + nz * .025, width, height - .01, blind ? 'brick' : 'dark', a);
  if (!blind) {
   arch(x + nx * .045, y + .18, z + nz * .045, width - .16, height - .22, 'glass', a);
   b.box(x + nx * .08, y + .16, z + nz * .08, .09, height - .18, .10, 'white', a);
   for (const row of pair ? [.40, .67] : [.60]) b.box(x + nx * .09, y + height * row, z + nz * .09, width - .14, .09, .10, 'white', a);
   if (pair) for (const s of [-1, 1]) { const u = width * .25 * s; b.box(x + u * tx + nx * .07, y + .16, z + u * tz + nz * .07, .065, height - .25, .09, 'white', a); }
  }
  b.box(x, y - .12, z, width + .36, .18, .30, 'stone', a);
 }
 function beam(a: T.Vector3, c: T.Vector3, width: number, colour: Colour) {
  const delta = c.clone().sub(a), g = new T.BoxGeometry(width, delta.length(), width); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize())); const mid = a.clone().add(c).multiplyScalar(.5); b.add(g, colour, mid.x, mid.y, mid.z);
 }
 if (id === 'machinegebouw') {
  // Two unequal longitudinal gables: the high machine hall and its lower side hall.
  const profile: [number, number][] = [[z0, 7.10], [-3.15, 12.80], [2.55, 7.25], [5.55, 10.15], [z1, 6.90]];
  const height = (_x: number, z: number) => { for (let i = 0; i < profile.length - 1; i++) if (z <= profile[i + 1][0]) { const p = profile[i], q = profile[i + 1]; return p[1] + (q[1] - p[1]) * (z - p[0]) / (q[0] - p[0]); } return 6.9; };
  volume(ring, profile.map(p => p[0]), height);
  for (const side of [-1, 1]) {
   const z = side < 0 ? z0 - .035 : z1 + .035, a = side < 0 ? Math.PI : 0;
   // Five bays and coupled high windows follow the protected building description.
   for (let k = 0; k < 5; k++) {
    const x = x0 + (k + .5) * (x1 - x0) / 5;
    for (const u of [-.62, .62]) window(x + u, 4.25, z, .72, 2.15, a);
    b.box(x + (x1 - x0) / 10 - .15, 0, z, .29, 6.84, .30, 'brick');
    if (side < 0) { window(x, .65, z, 2.30, 2.85, a, true, k === 1 || k === 3); }
    if (side > 0 && k === 2) { b.box(x, 0, z, 2.62, 3.42, .21, 'stone'); plane(x, .13, z + .12, 2.30, 3.14, 'dark', a); b.box(x, .13, z + .14, .10, 3.14, .12, 'white'); }
   }
   for (const y of [.6, 3.72, 6.75]) b.box((x0 + x1) / 2, y, z, x1 - x0, .17, .26, 'stone');
   for (let x = x0 + .35; x < x1; x += .70) b.box(x, 6.93, z, .24, .19, .28, 'brick');
   b.box((x0 + x1) / 2, side < 0 ? 7.05 : 6.84, z, x1 - x0 + .15, .18, .32, 'white');
  }
  for (const side of [-1, 1]) {
   const x = side < 0 ? x0 - .04 : x1 + .04, a = side < 0 ? -Math.PI / 2 : Math.PI / 2;
   // Tall end windows with Renaissance tracery, and a round light in the main gable.
   window(x, .73, -3.15, 1.95, 5.38, a, true); window(x, .73, 5.55, 1.63, 4.55, a, true);
   b.add(new T.CircleGeometry(.63, 16), 'stone', x, 9.55, -3.15, a); b.add(new T.CircleGeometry(.49, 16), 'dark', x + side * .03, 9.55, -3.15, a);
   for (const y of [.6, 6.63]) b.box(x, y, (z0 + z1) / 2, .27, .17, z1 - z0, 'stone');
   for (let i = 0; i < profile.length - 1; i++) beam(new T.Vector3(x, profile[i][1] + .07, profile[i][0]), new T.Vector3(x, profile[i + 1][1] + .07, profile[i + 1][0]), .18, 'white');
  }
  for (const [z, y] of [[-3.15, 12.8], [5.55, 10.15]]) {
   b.box((x0 + x1) / 2, y + .02, z, x1 - x0, .12, .17, 'brick');
   // Small terracotta ridge crests, rather than the vanished historic boiler chimney.
   for (let x = x0 + .55; x < x1 - .35; x += 1.08) b.add(new T.ConeGeometry(.11, .22, 5), 'brick', x, y + .24, z);
  }
 } else {
  const ridge = -.25, eave = 9.33, high = 15.33;
  const main = clip(ring, -22.32, 'x', true);
  volume(main, [z0, ridge, z1], (_x, z) => Math.max(8.3, eave + (high - eave) * (1 - Math.abs(z - ridge) / 9.05)));
  // West entrance lean-to is a distinct surveyed low sloping annex, not a second high hall.
  const annex = clip(ring, -22.32, 'x', false);
  volume(annex, [z0, z1], (_x, z) => Math.max(2.23, Math.min(9.14, 2.23 + (3.3 - z) * .603)));
  for (const side of [-1, 1]) {
   const z = side < 0 ? -9.3 - .025 : 8.8 + .025, a = side < 0 ? Math.PI : 0;
   const left = -22.1, width = 45.95;
   // Main hall's rhythm of tall coupled arches and masonry blind ground bays.
   for (let i = 0; i < 9; i++) {
    const x = left + (i + .5) * width / 9;
    for (const u of [-.65, .65]) window(x + u, 4.10, z, 1.08, 3.08, a);
    window(x, .48, z, 2.70, 2.71, a, false, i !== 7);
    b.box(left + i * width / 9, 0, z, .32, 9.15, .36, 'brick');
    // Small recessed rectangular upper frieze panels visible in the current owner photograph.
    plane(x, 7.72, z + side * .03, 3.15, .58, 'dark', a); plane(x, 7.81, z + side * .05, 2.97, .40, 'brick', a);
   }
   for (const y of [.48, 3.48, 9.0]) b.box(.9, y, z, width, .18, .26, 'stone');
   b.box(.9, 9.19, z, width + .1, .17, .35, 'stone');
  }
  for (const side of [-1, 1]) {
   const x = side < 0 ? -22.35 : 23.95, a = side < 0 ? -Math.PI / 2 : Math.PI / 2;
   for (const z of [-5.3, 4.8]) for (const u of [-.68, .68]) window(x, 4.08, z + u, 1.05, 3.08, a);
   for (const z of [-5.3, 4.8]) window(x, .49, z, 2.80, 2.62, a, false, true);
   // Blind upper-gable panel remains masonry, as in the current exterior image.
   plane(x + side * .03, 10.01, ridge, 4.17, 2.45, 'stone', a); plane(x + side * .05, 10.13, ridge, 3.91, 2.17, 'brick', a);
   for (const z of [-5.25, 4.65]) plane(x + side * .03, 8.36, z, 3.32, .65, 'dark', a);
   for (const z of [-9.3, 8.8]) beam(new T.Vector3(x, eave + .04, z), new T.Vector3(x, high + .08, ridge), .20, 'brick');
   b.box(x, high + .08, ridge, .52, .18, .58, 'stone');
  }
  window(-24.13, .12, -.4, 1.48, 3.08, -Math.PI / 2);
  // The next-door WestWeelde cross-wing and historic chimney belong to other parents.
 }
}
