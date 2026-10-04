import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './amstel-hotel-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
/** Original measured riverside hotel, retaining the low conservatory and terrace. */
export function buildAmstelHotel(_id: string, _w: number, _d: number, b: BuildingTools) {
 const a = data.authorHeadingDegrees * Math.PI / 180;
 const project = (p: number[]) => { const e = (p[0] - data.anchor[0]) * 111320 * Math.cos(data.anchor[1] * Math.PI / 180), n = (p[1] - data.anchor[1]) * 110540; return new T.Vector2(e * Math.sin(a) + n * Math.cos(a), e * Math.cos(a) - n * Math.sin(a)); };
 const ring = data.parent.geometry.coordinates[0].slice(0, -1).map(project);
 function clip(poly: T.Vector2[], key: 'x' | 'y', v: number, above: boolean) {
  const out: T.Vector2[] = [];
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], inside = above ? p[key] >= v : p[key] <= v, next = above ? q[key] >= v : q[key] <= v; if (inside) out.push(p.clone()); if (inside !== next) out.push(p.clone().lerp(q, (v - p[key]) / (q[key] - p[key]))); }
  return out;
 }
 const region = (x0: number, x1: number, z0: number, z1: number) => clip(clip(clip(clip(ring, 'x', x0, true), 'x', x1, false), 'y', z0, true), 'y', z1, false);
 function volume(poly: T.Vector2[], bottom: number, top: number, colour: Colour, cap = true) {
  if (poly.length < 3) return;
  const g = new T.ExtrudeGeometry(new T.Shape(poly), { depth: top - bottom, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, top, 0);
  if (cap) { b.add(g, colour); return; }
  const flat = g.index ? g.toNonIndexed() : g, p = flat.getAttribute('position'), normals = flat.getAttribute('normal'), out: number[] = [];
  for (let i = 0; i < p.count; i += 3) { if ([0, 1, 2].every(k => normals.getY(i + k) > .9)) continue; for (let k = 0; k < 3; k++) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); }
  const shell = new T.BufferGeometry(); shell.setAttribute('position', new T.Float32BufferAttribute(out, 3)); shell.computeVertexNormals(); b.add(shell, colour); g.dispose(); if (flat !== g) flat.dispose();
 }
 function roof(poly: T.Vector2[], zbreaks: number[], h: (x: number, z: number) => number, colour: Colour = 'slate') {
  const walls: number[] = [], clockwise = T.ShapeUtils.area(poly) < 0;
  for (let i = 0; i < poly.length; i++) {
   const p = poly[i], q = poly[(i + 1) % poly.length], ts = [0, 1]; for (const z of zbreaks) if ((p.y - z) * (q.y - z) < 0) ts.push((z - p.y) / (q.y - p.y)); ts.sort((a, b) => a - b);
   for (let k = 0; k < ts.length - 1; k++) { const p0 = p.clone().lerp(q, ts[k]), p1 = p.clone().lerp(q, ts[k + 1]), vs = [[p0.x, 22.95, p0.y], [p0.x, h(p0.x, p0.y), p0.y], [p1.x, 22.95, p1.y], [p1.x, h(p1.x, p1.y), p1.y]]; const order = clockwise ? [0, 3, 1, 0, 2, 3] : [0, 1, 3, 0, 3, 2]; for (const j of order) walls.push(...vs[j]); }
  }
  const wallGeo = new T.BufferGeometry(); wallGeo.setAttribute('position', new T.Float32BufferAttribute(walls, 3)); wallGeo.computeVertexNormals(); b.add(wallGeo, colour);
  for (let k = 0; k < zbreaks.length - 1; k++) {
   const part = clip(clip(poly, 'y', zbreaks[k], true), 'y', zbreaks[k + 1], false); if (part.length < 3) continue;
   const g = new T.ShapeGeometry(new T.Shape(part)), p = g.getAttribute('position'), ix = g.index!, values: number[] = [];
   for (let i = 0; i < ix.count; i += 3) for (const j of [0, 2, 1]) { const v = ix.getX(i + j), x = p.getX(v), z = p.getY(v); values.push(x, h(x, z) + .025, z); }
   const r = new T.BufferGeometry(); r.setAttribute('position', new T.Float32BufferAttribute(values, 3)); r.computeVertexNormals(); b.add(r, colour); g.dispose();
  }
 }
 const main = region(-39.2, 39.2, -13.02, 6.25);
 volume(ring, 0, 3.5, 'stone');
 volume(main, 3.5, 22.95, 'frame', false);
 // Surveyed low glass lounge occupies only the central riverfront projection.
 const conservatory = region(-13.15, 13.2, 6.25, 14.9);
 volume(conservatory, 3.5, 8.45, 'stone');
 for (const zone of [[-39.2, -29.9, 28.35], [-29.9, -3.0, 27.1], [-3.0, 5.1, 29.54], [5.1, 31.75, 27.1], [31.75, 39.2, 28.35]]) {
  const poly = clip(clip(main, 'x', zone[0], true), 'x', zone[1], false), top = zone[2], pavilion = top > 28;
  const profile: [number, number][] = [[-13.02, 22.95], [-10.5, pavilion ? top : 25.7], [-3.4, top], [3.9, pavilion ? top : 25.8], [6.25, 22.95]];
  const height = (_x: number, z: number) => { for (let i = 0; i < profile.length - 1; i++) if (z <= profile[i + 1][0]) { const p = profile[i], q = profile[i + 1]; return p[1] + (q[1] - p[1]) * (z - p[0]) / (q[0] - p[0]); } return 22.95; };
  roof(poly, profile.map(p => p[0]), height);
 }
 function facadeZ(x: number, side: number) {
  const hits: number[] = [];
  for (let i = 0; i < main.length; i++) { const p = main[i], q = main[(i + 1) % main.length]; if ((p.x <= x && x <= q.x || q.x <= x && x <= p.x) && Math.abs(q.x - p.x) > .001) hits.push(p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x)); }
  return side < 0 ? Math.min(...hits) : Math.max(...hits);
 }
 function plane(x: number, y: number, z: number, w: number, h: number, c: Colour, rot = 0) { b.add(new T.PlaneGeometry(w, h), c, x, y + h / 2, z, rot); }
 function dormerRoof(x: number, y: number, z: number, w: number, d: number, h: number, c: Colour) {
  const p = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [w / 2, 0, d / 2], [0, h, -d / 2], [0, h, d / 2]];
  const f = [0, 5, 4, 0, 2, 5, 1, 5, 3, 1, 4, 5, 0, 4, 1, 2, 3, 5], g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(f.flatMap(i => p[i]), 3)); g.computeVertexNormals(); b.add(g, c, x, y, z);
 }
 function window(x: number, y: number, z: number, w: number, h: number, rot = 0, arch = false) {
  const nx = Math.sin(rot), nz = Math.cos(rot);
  plane(x, y, z, w + .30, h + .22, 'stone', rot); plane(x + nx * .025, y + .10, z + nz * .025, w, h, 'dark', rot); plane(x + nx * .05, y + .16, z + nz * .05, w - .16, h - .13, 'glass', rot);
  b.box(x + nx * .075, y + .12, z + nz * .075, .075, h, .085, 'white', rot); b.box(x + nx * .075, y + h * .71, z + nz * .075, w, .075, .085, 'white', rot);
  b.box(x, y - .14, z, w + .46, .17, .35, 'stone', rot);
  if (arch) { const s = new T.Shape(), radius = w / 2 + .17; s.moveTo(-radius, 0); for (let i = 0; i <= 12; i++) { const a = Math.PI - i * Math.PI / 12; s.lineTo(radius * Math.cos(a), radius * Math.sin(a)); } s.closePath(); b.add(new T.ShapeGeometry(s), 'stone', x, y + h + .08, z, rot); }
 }
 for (const side of [-1, 1]) {
  const rot = side < 0 ? Math.PI : 0;
  for (let i = 0; i < 27; i++) { const x = -37.7 + i * 2.9, z = facadeZ(x, side) + side * .04;
   for (const y of [4.55, 10.18, 14.20, 19.03]) window(x, y, z, 1.40, y < 5 ? 3.10 : 2.80, rot, y < 5);
   for (const y of [3.55, 8.8, 17.9, 22.67]) b.box(x, y, z, 3.02, .21, .32, 'stone');
   if (i % 3 === 0) b.box(x - 1.32, 3.5, z, .30, 19.25, .30, 'stone');
   // The restored roof has a regular dormer rhythm along its two long sides.
   const pavilion = x < -29.9 || x > 31.75 || x > -3 && x < 5.1;
   if (!pavilion) { const dz = side < 0 ? -10.8 : 4.0; b.box(x, 23.12, dz, 1.74, 2.18, .72, 'stone'); window(x, 23.22, dz + side * .39, 1.1, 1.75, rot); dormerRoof(x, 25.28, dz, 1.98, 1.02, .51, 'slate'); }
  }
 }
 // Small domed dormer turrets flank the central pavilion in the primary facade photographs.
 for (const x of [-8.7, 10.6]) for (const side of [-1, 1]) {
  const z = side < 0 ? -10.6 : 3.7;
  b.box(x, 23.0, z, 2.50, 3.72, 1.28, 'stone'); window(x, 23.55, z + side * .68, 1.23, 2.35, side < 0 ? Math.PI : 0);
  const dome = new T.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1.28, .88, .82); b.add(dome, 'slate', x, 26.75, z);
  b.add(new T.ConeGeometry(.14, .65, 6), 'slate', x, 27.96, z);
 }
 b.clock(1, 28.1, 4.08);
 // End facades keep the same four-floor masonry/window hierarchy.
 for (const side of [-1, 1]) for (const z of [-9.2, -5.1, -.9, 3.1]) { const x = side < 0 ? -39.21 : 39.21, rot = side < 0 ? -Math.PI / 2 : Math.PI / 2; for (const y of [4.55, 10.18, 14.20, 19.03]) window(x, y, z, 1.4, 2.8, rot, y < 5); }
 for (const side of [-1, 1]) {
  const z = side < 0 ? -12.95 : 6.3, rot = side < 0 ? Math.PI : 0;
  for (const [x, width, top] of [[-34.1, 6.0, 28.35], [1.0, 6.2, 29.54], [35.5, 5.8, 28.35]]) {
   // Raised pediment dormers distinguish the central pavilion and both end pavilions.
   b.box(x, 22.95, z, width, .32, .62, 'stone'); b.box(x, 23.1, z - side * 1.30, width * .54, 3.30, .75, 'stone'); window(x, 23.33, z - side * .87, 1.55, 2.68, rot);
   dormerRoof(x, 26.40, z - side * 1.30, width * .65, 1.18, .75, 'stone');
   // Narrow stone roof-edge rails surround the slate pavilion roof;
   // a full pale slab would conceal its photographed dark roof surface.
   if (side > 0) {
    for (const dx of [-width / 2, width / 2]) b.box(x + dx, top, -3.4, .18, .20, 13.8, 'stone');
    for (const dz of [-10.3, 3.5]) b.box(x, top, dz, width + .30, .20, .18, 'stone');
   }
  }
 }
 // Eight restored corner lions: intentionally simple original low-poly sculptures.
 function lion(x: number, z: number, top: number) {
  b.box(x, top, z, .64, .12, .70, 'stone'); b.add(new T.IcosahedronGeometry(.34, 0), 'stone', x, top + .70, z); b.add(new T.IcosahedronGeometry(.27, 0), 'stone', x, top + 1.25, z); b.box(x, top + .12, z + .24, .44, .90, .16, 'stone'); b.box(x, top + .35, z + .32, .38, .52, .10, 'stone');
 }
 for (const x of [-36.8, -31.4, 32.8, 38.1]) for (const z of [-10.4, 3.8]) lion(x, z, 28.35);
 // Current white conservatory frame and glass upper roof preserve the later river extension.
 for (let x = -12.0; x < 12.3; x += 1.5) { window(x, 4.00, 14.98, 1.1, 3.40); b.box(x, 3.5, 15.02, .13, 5.0, .17, 'white'); }
 b.box(0, 8.35, 14.98, 25.4, .22, .25, 'white');
 const glass = region(-13.15, 13.2, 6.25, 14.9);
 // Independent low hip-like glazing; the terrace outside it stays at3.5m.
 const lowTop = (z: number) => 8.45 + Math.max(0, 1 - Math.abs(z - 10.7) / 4.5) * 2.85;
 for (const limits of [[6.25, 10.7], [10.7, 14.9]]) { const part = clip(clip(glass, 'y', limits[0], true), 'y', limits[1], false), g = new T.ShapeGeometry(new T.Shape(part)), p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, lowTop(z), z); } const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const tmp = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, tmp); } g.computeVertexNormals(); b.add(g, 'glass'); }
 for (let x = -12.7; x <= 12.7; x += .95) for (const [za, zb] of [[6.25, 10.7], [10.7, 14.9]]) { const p = new T.Vector3(x, lowTop(za), za), q = new T.Vector3(x, lowTop(zb), zb), delta = q.clone().sub(p), g = new T.BoxGeometry(.06, delta.length(), .06); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize())); const m = p.add(q).multiplyScalar(.5); b.add(g, 'white', m.x, m.y, m.z); }
}
