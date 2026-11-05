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
/** sha256 (first 16 hex) of each spec's roles and positions, measured on the kit before the #227 greenhouse additions */
const PINNED = {glass: 'abb3859f8d19d92f', herring: '657f344fbbeb06cc', trailer: '47f385e9f81c305b', stall: '421b397aa88655f6'};

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

test('green roof, slab band, flue and screens: tufts stand on the planting, screens stand in front of their face', () => {
  const s: KioskSpec = {...glass, cornerRole: 'corner',
    roof: {kind: 'flat', thickness: 0.3, overhang: 0.27, green: {inset: 0.15, height: 0.12, tufts: 8}, band: {bottom: 0.08, height: 0.12}, flue: {along: 1, across: 0.5, height: 0.4, radius: 0.1}},
    screens: [{face: 'front', along: -1.2, width: 2, height: 1.9, solidHeight: 0.9, out: 0.6, angleDeg: 8}]};
  const parts = buildKiosk(s);
  const roofTop = s.wallHeight + 0.3;
  const green = bounds(parts.filter(p => p.role === 'green')), tufts = bounds(parts.filter(p => p.role === 'foliage'));
  assert.ok(Math.abs(green.min.y - roofTop) < 1e-6 && tufts.min.y >= roofTop + 0.12 - 1e-6);
  assert.equal(parts.filter(p => p.role === 'corner').length, 4);
  const band = bounds(parts.filter(p => p.role === 'trim'));
  assert.ok(band.max.z > s.depth / 2 + 0.27 + 0.049 && band.min.y > s.wallHeight);
  const sc = bounds(parts.filter(p => p.role === 'screen'));
  assert.ok(sc.min.z > s.depth / 2 + 0.4 && sc.max.y <= 1.9 + 1e-6, `screen z ${sc.min.z}..${sc.max.z}`);
  assert.ok(triangleCount(parts) < 3000);
});

test('flat lettering costs two triangles per glyph rectangle and faces out; lattice strips stay on their panel', () => {
  const sign = (flat: boolean): KioskSpec => ({...glass, faces: {...glass.faces, front: {panels: [{kind: 'glass', width: 1}]}}, signs: [{face: 'front', along: 0, bottom: 2.5, width: 4, height: 0.3, proud: 0.06, lettering: {text: 'FRENS', height: 0.2, bottom: 2.55, flat}}]});
  const n = (flat: boolean) => triangleCount(buildKiosk(sign(flat)).filter(p => p.role === 'lettering'));
  const quads = n(true) / 2;
  assert.ok(quads >= 5 && n(false) === quads * 12, `${quads} rects, ${n(false)} block triangles`);
  const flat = buildKiosk(sign(true)).filter(p => p.role === 'lettering');
  const nz = flat[0].geometry.getAttribute('normal').getZ(0);
  assert.ok(nz > 0.99, 'front lettering faces +Z');
  const sh: KioskSpec = {...glass, faces: {...glass.faces, front: {panels: [{kind: 'shuttered', width: 1, sill: 1.2}, {kind: 'shuttered', width: 1, sill: 0.6, lattice: 'square', lowerRole: 'counter'}]}}};
  const parts = buildKiosk(sh), lat = bounds(parts.filter(p => p.role === 'screen'));
  assert.ok(lat.min.x >= -sh.width / 2 && lat.max.x <= sh.width / 2 && lat.min.y >= sh.plinth + sh.baseRail - 1e-6 && lat.max.y <= sh.wallHeight - sh.headRail + 1e-6);
  assert.ok(parts.some(p => p.role === 'counter') && triangleCount(parts) < 3000);
});

test('a ridge sign stands on the centre line, lettered on both sides, with a finial at each end', () => {
  const s: KioskSpec = {...herring, faces: {...herring.faces, front: {panels: [{kind: 'board', width: 1}]}}, hatch: undefined,
    signs: [{face: 'front', along: 0, bottom: 3.0, width: 1.9, height: 0.5, proud: 0.06, mount: 'ridge', lettering: {text: 'HARING', height: 0.2, bottom: 3.12, flat: true}, finials: {role: 'awning', width: 0.3, height: 0.6, leanDeg: 20}}]};
  const parts = buildKiosk(s);
  const board = bounds(parts.filter(p => p.role === 'sign'));
  assert.ok(Math.abs(board.min.z + 0.03) < 1e-6 && Math.abs(board.max.z - 0.03) < 1e-6);
  const letters = parts.filter(p => p.role === 'lettering');
  const zs = letters.map(p => {p.geometry.computeBoundingBox(); return p.geometry.boundingBox!.min.z;});
  assert.ok(zs.some(z => z > 0.05) && zs.some(z => z < -0.05), 'lettering on both faces of the board');
  // the back lettering faces -Z
  const back = letters.find(p => p.geometry.boundingBox!.min.z < -0.05)!;
  assert.ok(back.geometry.getAttribute('normal').getZ(0) < -0.99);
  const fin = bounds(parts.filter(p => p.role === 'awning'));
  assert.ok(fin.min.x < -0.95 && fin.max.x > 0.95 && fin.min.y >= 3.0 - 0.2);
});

test('a panel role draws a solid/glass infill in that role (posters) and leaves the default untouched', () => {
  const s: KioskSpec = {...glass, faces: {...glass.faces, front: {panels: [{kind: 'solid', width: 1, role: 'bloomA'}, {kind: 'glass', width: 1, role: 'bloomC'}, {kind: 'solid', width: 1}]}}};
  const parts = buildKiosk(s);
  assert.equal(parts.filter(p => p.role === 'bloomA').length, 1);
  assert.equal(parts.filter(p => p.role === 'bloomC').length, 1);
  assert.equal(triangleCount(parts), triangleCount(buildKiosk({...s, faces: {...s.faces, front: {panels: [{kind: 'solid', width: 1}, {kind: 'glass', width: 1}, {kind: 'solid', width: 1}]}}})));
});

// Bloemenmarkt (#227): the greenhouse roof, the stall's street front and the part-on-the-quay hull.
const greenhouse: KioskSpec = {
  ...stall, width: 14, depth: 13, wallHeight: 2.75, headRail: 0.12,
  faces: {front: {panels: []}, back: {panels: Array.from({length: 12}, () => ({kind: 'glass' as const, width: 1}))}, left: {panels: []}, right: {panels: [{kind: 'glass', width: 1}]}},
  roof: {kind: 'greenhouse', bays: 4, rise: 0.75, overhang: 0.05, barPitch: 1.3, frontEnd: 'solid'},
  stall: {hullDepth: 1.4, hullOverhang: 0, tiers: 2, tierDepth: 0.5, tierRise: 0.3, openFace: 'front', landDepth: 3.2,
    front: {tube: 0.09, fascia: {height: 0.45, roles: ['bloomA', 'foliage', 'bloomB']}, posts: 5}},
};

test('greenhouse roof: one ridge per bay at the rise, glass slopes, solid street gables and glass canal gables', () => {
  const parts = buildKiosk(greenhouse), r = greenhouse.roof as Extract<KioskSpec['roof'], {kind: 'greenhouse'}>;
  const top = bounds(parts.filter(p => p.role === 'roofGlass' || p.role === 'frame' || p.role === 'roofFrame' || p.role === 'solid'));
  assert.ok(Math.abs(top.max.y - (greenhouse.wallHeight + r.rise + 0.035)) < 0.03, `top ${top.max.y}`);
  // the roof stays inside the width (the row is continuous) and reaches its overhang front and back
  const roofParts = parts.filter(p => {p.geometry.computeBoundingBox(); return p.geometry.boundingBox!.min.y >= greenhouse.wallHeight - 0.05;});
  const rb = bounds(roofParts);
  // (the glass slabs' lower corners reach 1.5 cm past the outer eave line: half their 3 cm thickness)
  assert.ok(rb.min.x >= -greenhouse.width / 2 - 0.02 && rb.max.x <= greenhouse.width / 2 + 0.02, `x ${rb.min.x}..${rb.max.x}`);
  assert.ok(rb.max.z >= greenhouse.depth / 2 + r.overhang - 1e-6 && rb.min.z <= -greenhouse.depth / 2 - r.overhang + 1e-6);
  // four ridge caps at the bay centres
  const ridges = roofParts.filter(p => p.role === 'roofFrame' && Math.abs(p.geometry.boundingBox!.max.y - (greenhouse.wallHeight + r.rise + 0.035)) < 1e-4);
  assert.deepEqual([...new Set(ridges.map(p => +p.geometry.boundingBox!.getCenter(new Vector3()).x.toFixed(3)))].sort((a, b) => a - b), [-5.25, -1.75, 1.75, 5.25]);
  assert.equal(ridges.length, 8, "two ridge lengths per bay");
  // the street gables are solid, the canal gables glass, one triangle per bay at each end
  const ends = (role: string, front: boolean) => roofParts.filter(p => p.role === role && !p.geometry.index && p.geometry.getAttribute('position').count === 24 && (p.geometry.boundingBox!.min.z > 0) === front).length;
  assert.equal(ends('solid', true), 4);
  assert.equal(ends('roofGlass', false), 4);
  // roof glazing is its own role (cladding, not a window in a wall): no plain glass above the wall head
  assert.equal(roofParts.filter(p => p.role === 'glass').length, 0);
  // every slope and gable is wound outward (positive volume)
  for (const p of roofParts.filter(q => !q.geometry.index && q.geometry.getAttribute('position').count === 24)) {
    const pos = p.geometry.getAttribute('position').array as Float32Array;
    let v = 0;
    for (let i = 0; i < pos.length; i += 9) v += new Vector3(pos[i], pos[i + 1], pos[i + 2]).dot(new Vector3(pos[i + 3], pos[i + 4], pos[i + 5]).cross(new Vector3(pos[i + 6], pos[i + 7], pos[i + 8]))) / 6;
    assert.ok(v > 0, `gable volume ${v}`);
  }
  assert.ok(triangleCount(parts) < 3000, `${triangleCount(parts)} triangles`);
});

test('stall street front: tube in front of the head, fascia panels in their roles, posts; hull only under the water part', () => {
  const parts = buildKiosk(greenhouse), D = greenhouse.depth;
  const tube = bounds(parts.filter(p => p.role === 'trim'));
  assert.ok(tube.min.z > D / 2 && tube.max.y <= greenhouse.wallHeight + 0.05 && tube.max.y > greenhouse.wallHeight - 0.2, `tube ${tube.min.z} ${tube.max.y}`);
  for (const role of ['bloomA', 'foliage', 'bloomB'] as const) {
    const f = parts.filter(p => {p.geometry.computeBoundingBox(); return p.role === role && p.geometry.boundingBox!.min.y > 2;});
    assert.equal(f.length, 1, `${role} fascia panel`);
  }
  // three inner posts reach the fascia bottom
  const posts = parts.filter(p => {p.geometry.computeBoundingBox(); const b = p.geometry.boundingBox!; return p.role === 'frame' && b.min.y < 0.1 && b.max.z <= D / 2 + 1e-6 && b.min.z > D / 2 - 0.2 && Math.abs(b.max.y - (greenhouse.wallHeight - 0.12 - 0.45)) < 1e-6;});
  assert.equal(posts.length, 3);
  const hull = bounds(parts.filter(p => p.role === 'hull'));
  // under the water part only, 4 cm inside the deck's edges, its top inside the deck slab 3 cm above its underside
  assert.ok(Math.abs(hull.max.z - (D / 2 - 3.2)) < 1e-6 && Math.abs(hull.min.z - (-D / 2 + 0.04)) < 1e-6, `hull z ${hull.min.z}..${hull.max.z}`);
  assert.ok(Math.abs(hull.max.x - (greenhouse.width / 2 - 0.04)) < 1e-6 && Math.abs(hull.min.y + 1.42) < 1e-6 && Math.abs(hull.max.y + 0.07) < 1e-6);
  const deck = bounds(parts.filter(p => p.role === 'deck'));
  assert.ok(Math.abs(hull.max.y - deck.min.y - 0.03) < 1e-6 && deck.max.y > 0);
});

test('kit additions leave the existing variants byte-identical (digests pinned before the greenhouse roof)', async () => {
  const crypto = await import('node:crypto');
  const digest = (s: KioskSpec) => {
    const h = crypto.createHash('sha256');
    for (const p of buildKiosk(s)) {h.update(p.role); h.update(Buffer.from((p.geometry.getAttribute('position').array as Float32Array).buffer));}
    return h.digest('hex').slice(0, 16);
  };
  assert.deepEqual(Object.fromEntries(Object.entries(SPECS).map(([n, s]) => [n, digest(s)])), PINNED);
});
