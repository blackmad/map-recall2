import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3, Vector3} from 'three';
import {buildKiosk, glyphRects, minimumRectangle, panelLayout, placedKiosk, placement, textPixels, triangleCount, type KioskPart, type KioskSpec, type Pt} from './kioskKit';

const glass: KioskSpec = {
  variant: 'glass', width: 4.6, depth: 2.6, wallHeight: 2.75, plinth: 0.08, post: 0.12, mullion: 0.08, frameDepth: 0.1,
  baseRail: 0.12, headRail: 0.2,
  faces: {
    front: {panels: [{kind: 'glass', width: 1}, {kind: 'glass', width: 1}, {kind: 'door', width: 1}, {kind: 'glass', width: 1, lettering: {text: 'DR. FALAFEL', height: 0.2, bottom: 1.8, maxWidth: 0.9}}]},
    back: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    left: {panels: [{kind: 'glass', width: 1}, {kind: 'solid', width: 1}]},
    right: {panels: [{kind: 'solid', width: 1}]},
  },
  roof: {kind: 'flat', thickness: 0.25, overhang: 0.3},
};
const herring: KioskSpec = {
  variant: 'herring', width: 3.2, depth: 2.2, wallHeight: 2.5, plinth: 0.15, post: 0.1, mullion: 0.08, frameDepth: 0.08,
  baseRail: 0.1, headRail: 0.12,
  faces: {front: {panels: [{kind: 'board', width: 1}, {kind: 'hatch', width: 2}, {kind: 'board', width: 1}]}, back: {panels: [{kind: 'board', width: 1}]}, left: {panels: [{kind: 'board', width: 1}]}, right: {panels: [{kind: 'board', width: 1}]}},
  roof: {kind: 'hip', rise: 0.6, overhang: 0.25, eaveThickness: 0.1, ridge: 'width'},
  hatch: {face: 'front', sill: 1.05, head: 2.1, counterDepth: 0.3, cover: 'flap', flapAngleDeg: 80},
  signs: [{face: 'front', along: 0, bottom: 2.2, width: 2.4, height: 0.28, proud: 0.06, lettering: {text: 'HARING', height: 0.2, bottom: 2.24}}],
};
const trailer: KioskSpec = {
  variant: 'trailer', width: 3.5, depth: 2.0, wallHeight: 2.6, plinth: 0, post: 0.08, mullion: 0.06, frameDepth: 0.06,
  baseRail: 0.08, headRail: 0.1,
  faces: {front: {panels: [{kind: 'solid', width: 1}, {kind: 'hatch', width: 2}]}, back: {panels: [{kind: 'solid', width: 1}]}, left: {panels: [{kind: 'solid', width: 1}]}, right: {panels: [{kind: 'door', width: 1}]}},
  roof: {kind: 'barrel', rise: 0.25, overhang: 0.05},
  hatch: {face: 'front', sill: 1.45, head: 2.3, counterDepth: 0.25, cover: 'awning', awningDepth: 0.7, stripes: 6},
  trailer: {floor: 0.75, wheelRadius: 0.32, wheelsAt: [0.2], drawbar: 0.9},
};
const stall: KioskSpec = {
  variant: 'flower-stall', width: 6, depth: 4, wallHeight: 2.6, plinth: 0, post: 0.1, mullion: 0.06, frameDepth: 0.08,
  baseRail: 0.1, headRail: 0.3,
  faces: {front: {panels: []}, back: {panels: [{kind: 'glass', width: 1}, {kind: 'glass', width: 1}]}, left: {panels: [{kind: 'glass', width: 1}]}, right: {panels: [{kind: 'glass', width: 1}]}},
  roof: {kind: 'gable', rise: 0.8, overhang: 0.2, eaveThickness: 0.08, ridge: 'width'},
  stall: {hullDepth: 1.0, hullOverhang: 0.2, tiers: 3, tierDepth: 0.5, tierRise: 0.3, openFace: 'front'},
};
const SPECS = {glass, herring, trailer, stall};

function bounds(parts: KioskPart[]) {
  const b = new Box3();
  for (const p of parts) {p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!);}
  return b;
}

test('minimumRectangle recovers a rotated rectangle and picks the front nearest the requested bearing', () => {
  const a = 30 * Math.PI / 180, e: Pt = [Math.cos(a), Math.sin(a)], n: Pt = [-e[1], e[0]];
  const ring: Pt[] = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]].map(([u, v]) => [10 + u * e[0] + v * n[0], 5 + u * e[1] + v * n[1]] as Pt);
  const r = minimumRectangle(ring);
  assert.ok(Math.abs(r.width - 4) < 1e-6 && Math.abs(r.depth - 3) < 1e-6, JSON.stringify(r));
  assert.ok(Math.hypot(r.centre[0] - 10, r.centre[1] - 5) < 1e-6);
  // the long sides' outward normals are n and -n; n = (-sin30, cos30) in (east, south) points south-west-ish
  const side = minimumRectangle(ring, (r.frontBearing + 90) % 360);
  assert.ok(Math.abs(side.width - 3) < 1e-6 && Math.abs(side.depth - 4) < 1e-6, 'a short side picked as front has width 3');
});

test('placement turns the local front (+Z) to the requested compass bearing', () => {
  for (const b of [0, 90, 180, 286, 17]) {
    const m = placement([3, -4], b);
    const p = new Vector3(0, 0, 1).applyMatrix4(m), o = new Vector3(0, 0, 0).applyMatrix4(m);
    const bearing = (Math.atan2(p.x - o.x, -(p.z - o.z)) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(((bearing - b) % 360 + 540) % 360 - 180) < 1e-6, `${b} -> ${bearing}`);
    assert.ok(Math.abs(o.x - 3) < 1e-9 && Math.abs(o.z + 4) < 1e-9);
    // the front viewer's right (+X local) is 90 degrees counter-clockwise of the front bearing
    const r = new Vector3(1, 0, 0).applyMatrix4(m);
    const rb = (Math.atan2(r.x - o.x, -(r.z - o.z)) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(((rb - (b + 270)) % 360 + 540) % 360 - 180) < 1e-6);
  }
});

test('glyph rectangles cover every lit pixel exactly once', () => {
  const sample = ['01110', '10001', '10001', '11111', '10001', '10001', '10001'];
  const lit = new Set<string>();
  for (const [x, y, w, h] of glyphRects(sample)) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    assert.equal(sample[yy][xx], '1');
    assert.ok(!lit.has(`${xx},${yy}`), 'overlap');
    lit.add(`${xx},${yy}`);
  }
  assert.equal(lit.size, sample.join('').split('').filter(c => c === '1').length);
  assert.equal(textPixels('AB'), 11);
  assert.throws(() => buildKiosk({...glass, signs: [{face: 'front', along: 0, bottom: 2.9, width: 1, height: 0.3, proud: 0.06, lettering: {text: 'É', height: 0.2, bottom: 2.95}}]}));
});

test('panel layout fills the clear length between the corner posts', () => {
  for (const s of Object.values(SPECS)) for (const f of ['front', 'back', 'left', 'right'] as const) {
    const {panels, mullions} = panelLayout(s, f);
    if (!panels.length) continue;
    const used = panels.reduce((a, p) => a + p[1], 0) + mullions.length * s.mullion;
    const L = f === 'front' || f === 'back' ? s.width : s.depth;
    assert.ok(Math.abs(used - (L - 2 * s.post)) < 1e-9);
  }
});

for (const [name, s] of Object.entries(SPECS)) test(`${name}: finite, within budget, inside its plan plus overhang`, () => {
  const parts = buildKiosk(s);
  const tris = triangleCount(parts);
  assert.ok(tris > 50 && tris < 3000, `${name} ${tris} triangles`);
  for (const p of parts) for (const v of p.geometry.getAttribute('position').array as Float32Array) assert.ok(Number.isFinite(v));
  const b = bounds(parts);
  const reach = s.roof.overhang + 0.12 + (s.hatch ? (s.hatch.cover === 'flap' ? s.hatch.head - s.hatch.sill : (s.hatch.awningDepth ?? 0.8) + 0.1) : 0) + (s.stall ? s.stall.hullOverhang + 0.4 : 0) + (s.trailer ? s.trailer.drawbar + 0.1 : 0);
  assert.ok(b.max.x <= s.width / 2 + reach && b.min.x >= -s.width / 2 - reach, `${name} x ${b.min.x}..${b.max.x}`);
  assert.ok(b.max.z <= s.depth / 2 + reach && b.min.z >= -s.depth / 2 - reach, `${name} z ${b.min.z}..${b.max.z}`);
  assert.ok(b.min.y >= (s.stall ? -s.stall.hullDepth - 0.05 : -1e-6), `${name} below ground ${b.min.y}`);
  assert.ok(b.max.y < s.wallHeight + 1.5);
});

test('trailer wheels touch the ground and the drawbar reaches its hitch', () => {
  const parts = buildKiosk(trailer);
  const wheels = bounds(parts.filter(p => p.role === 'wheel'));
  assert.ok(Math.abs(wheels.min.y) < 1e-6);
  const chassis = bounds(parts.filter(p => p.role === 'chassis'));
  assert.ok(chassis.min.x < -trailer.width / 2 - trailer.trailer!.drawbar + 0.1, `drawbar reaches ${chassis.min.x}`);
});

test('the hatch flap swings out above the counter and is wound outward (positive volume)', () => {
  const parts = buildKiosk(herring).filter(p => p.role === 'flap');
  assert.equal(parts.length, 1);
  const pos = parts[0].geometry.getAttribute('position').array as Float32Array;
  let v = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const a = new Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new Vector3(pos[i + 3], pos[i + 4], pos[i + 5]), c = new Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  assert.ok(v > 0, `flap volume ${v}`);
  const b = bounds(parts);
  assert.ok(b.min.y > herring.hatch!.sill && b.max.z > herring.depth / 2 + 0.8);
});

test('placedKiosk keeps the plan centre and bearing', () => {
  const parts = placedKiosk(glass, [1, 2], 286);
  const b = bounds(parts.filter(p => p.role === 'frame'));
  const c = b.getCenter(new Vector3());
  assert.ok(Math.hypot(c.x - 1, c.z - 2) < 0.05, `${c.x},${c.z}`);
  // lettering is on the front: it lies on the bearing-286 side of the centre (west-north-west)
  const l = bounds(parts.filter(p => p.role === 'lettering')).getCenter(new Vector3());
  assert.ok(l.x < c.x - 1, `lettering at ${l.x} vs centre ${c.x}`);
});
