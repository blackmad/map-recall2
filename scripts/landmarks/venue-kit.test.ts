import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';
import {setSink} from './nearbar-kit';
import {arcLettering, balusterCentres, balustradeRun, festoonPanel, swagOutline, clipRingByLine, lettering, clipRingByY, cutFrontWalls, insidePoly, modillionCentres, pedimentOutline, pedimentSolid, profileGeometry, segDist, TriSink, verticalLettering, wallFacingXZ, concaveGable, concaveGableOutline, bulletDomeProfile, roundedTowerCap} from './venue-kit';
import {signedArea} from './neck-gable';
import {addShell} from './worship-shell';

/** BuildingTools that only collects geometries per colour. */
const collector = () => {
  const got: {g: T.BufferGeometry; c: string}[] = [];
  return {b: {add: (g: T.BufferGeometry, c: string) => { got.push({g, c}); }} as unknown as BuildingTools, got};
};
const boxOf = (gs: T.BufferGeometry[]) => { const bb = new T.Box3(); for (const g of gs) { g.computeBoundingBox(); bb.union(g.boundingBox!); } return bb; };
/** A wall along +x with the kit's outward normal n = (-tz, tx) = +z. */
const F: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};

test('clipRingByLine keeps one side of a vertical plane and stays planar', () => {
  // a sloping roof plane y = x / 2 over the square 0..4 x 0..4
  const ring = [[0, 0, 0], [4, 2, 0], [4, 2, 4], [0, 0, 4]];
  const left = clipRingByLine(ring, [2, 0], [2, 4], 1), right = clipRingByLine(ring, [2, 0], [2, 4], -1);
  const xs = (r: number[][]) => r.map(p => p[0]);
  assert.ok(xs(left).every(x => x <= 2 + 1e-9) || xs(left).every(x => x >= 2 - 1e-9));
  assert.ok(Math.min(...xs(left)) < 2 !== Math.min(...xs(right)) < 2, 'the two sides differ');
  for (const p of [...left, ...right]) assert.ok(Math.abs(p[1] - p[0] / 2) < 1e-9, 'clipped points lie in the plane');
  assert.deepEqual(clipRingByLine(ring, [10, 0], [10, 4], xs(left)[0] < 2 ? -1 : 1).length, 0);
});

test('insidePoly and segDist', () => {
  const sq: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.ok(insidePoly([2, 2], sq));
  assert.ok(!insidePoly([5, 2], sq));
  const q = segDist([2, 3], [0, 0], [4, 0]);
  assert.equal(q.d, 3); assert.equal(q.u, 0.5);
});

test('modillionCentres spans both ends at no more than the pitch', () => {
  const c = modillionCentres(1, 11, 0.6);
  assert.equal(c[0], 1); assert.ok(Math.abs(c[c.length - 1] - 11) < 1e-9);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 0.6 - 1e-9 && c[i] - c[i - 1] < 1.2);
  assert.deepEqual(modillionCentres(0, 0.2, 1), [0, 0.2]);
});

test('pedimentOutline insets every side by the same distance', () => {
  const w = 4.7, h = 1.3, inset = 0.18, outer = pedimentOutline(w, h), inner = pedimentOutline(w, h, inset);
  assert.deepEqual(outer[2], [0, h]);
  const dist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / Math.hypot(dx, dy);
  };
  for (const p of inner) {
    const d = Math.min(dist(p, outer[0], outer[1]), dist(p, outer[1], outer[2]), dist(p, outer[2], outer[0]));
    assert.ok(Math.abs(d - inset) < 1e-9, `inner vertex ${p} is ${d} from the outer outline`);
  }
});

test('pedimentSolid stays inside its outline and the tympanum sits behind the rakes', () => {
  setSink(0);
  const {b, got} = collector();
  pedimentSolid(b, F, 5, 10, 4, 1.2, {d: 0.3, rake: 0.2, tymp: 'white', trim: 'stone'});
  const bb = boxOf(got.map(x => x.g));
  assert.ok(bb.min.x >= 3 - 1e-6 && bb.max.x <= 7 + 1e-6 && bb.min.y >= 10 - 1e-6 && bb.max.y <= 11.2 + 1e-6);
  const tymp = boxOf(got.filter(x => x.c === 'white').map(x => x.g)), trim = boxOf(got.filter(x => x.c === 'stone').map(x => x.g));
  assert.ok(tymp.max.z < trim.max.z, 'tympanum is shallower than the rakes');
});

test('verticalLettering reads upward and stays within its column', () => {
  setSink(0);
  const {b, got} = collector(), px = 0.05;
  const width = verticalLettering(b, F, 'ARTI', 2, 5, px, 0.02, 'white');
  assert.ok(got.length > 0);
  const bb = boxOf(got.map(x => x.g));
  assert.ok(bb.min.y >= 5 - 1e-9 && Math.abs(bb.max.y - (5 + width)) < px + 1e-5, 'text runs up the wall over its width');
  assert.ok(bb.max.x - bb.min.x <= 7 * px + 1e-5, 'glyph height lies across the column');
});

test('verticalLettering down reads top to bottom, mirrors up, and the default is unchanged', () => {
  setSink(0);
  const px = 0.05;
  const up = collector(), down = collector();
  const w = verticalLettering(up.b, F, '100', 2, 5, px, 0.02, 'white');
  const w2 = verticalLettering(down.b, F, '100', 2, 5, px, 0.02, 'white', 0, 'down');
  assert.equal(w, w2);
  const bu = boxOf(up.got.map(x => x.g)), bd = boxOf(down.got.map(x => x.g));
  assert.ok(bd.max.y <= 5 + 1e-9 && Math.abs(bd.min.y - (5 - w)) < px + 1e-5, 'text runs down the wall from y0');
  assert.ok(Math.abs((bu.max.x + bu.min.x) / 2 + (bd.max.x + bd.min.x) / 2 - 4) < 1e-6, 'columns mirror about t');
  // the first glyph ('1') sits at the top when reading down, at the bottom when reading up
  const first = (g: typeof down.got, top: boolean) => g.map(x => boxOf([x.g])).sort((a, c) => top ? c.max.y - a.max.y : a.min.y - c.min.y)[0];
  assert.ok(first(down.got, true).max.y > 5 - 7 * px, 'reading down starts at the top');
  assert.ok(first(up.got, false).min.y < 5 + 7 * px, 'reading up starts at the bottom');
  // the default call draws exactly what the explicit 'up' draws
  const ex = collector();
  verticalLettering(ex.b, F, '100', 2, 5, px, 0.02, 'white', 0, 'up');
  assert.deepEqual(ex.got.map(x => Array.from(x.g.getAttribute('position').array)), up.got.map(x => Array.from(x.g.getAttribute('position').array)));
});

test('concaveGableOutline is symmetric, counter-clockwise, concave between shoulder and neck', () => {
  const g = {half: 1.3, shoulder: 0.3, neckHalf: 0.3, neckY: 2.1, apexY: 2.7};
  const r = concaveGableOutline(g);
  assert.ok(signedArea(r) > 0, 'counter-clockwise');
  for (const [x, y] of r) assert.ok(r.some(([x2, y2]) => Math.abs(x2 + x) < 1e-9 && Math.abs(y2 - y) < 1e-9), 'mirror point exists');
  assert.ok(Math.max(...r.map(p => p[1])) === g.apexY && Math.max(...r.map(p => Math.abs(p[0]))) === g.half);
  // concave: the curve's midpoint lies below the straight line from shoulder to neck
  const right = r.filter(p => p[0] > 0 && p[1] >= g.shoulder && p[1] <= g.neckY);
  const mid = right[Math.floor(right.length / 2)];
  const lineY = g.shoulder + (g.neckY - g.shoulder) * (g.half - mid[0]) / (g.half - g.neckHalf);
  assert.ok(mid[1] < lineY, 'curve sags below the chord');
});

test('concaveGable keeps the body behind the wall plane and the rim inside the outline, proud of it', () => {
  setSink(0);
  const {b, got} = collector();
  const g = {half: 1.3, shoulder: 0.3, neckHalf: 0.3, neckY: 2.1, apexY: 2.7};
  concaveGable(b, F, 10, 12, g, {depth: 1.5, wall: 'brick', trim: 'sandstone', rim: 0.14, rimD: 0.08});
  const body = boxOf(got.filter(x => x.c === 'brick').map(x => x.g)), rim = boxOf(got.filter(x => x.c === 'sandstone').map(x => x.g));
  assert.ok(Math.abs(body.max.z) < 1e-6 && Math.abs(body.min.z + 1.5) < 1e-6, 'body from -depth to the wall plane');
  assert.ok(Math.abs(rim.max.z - 0.08) < 1e-6, 'rim stands rimD proud');
  assert.ok(rim.min.x >= 10 - 1.3 - 0.1 && rim.max.x <= 10 + 1.3 + 0.1 && rim.max.y <= 12 + 2.7 + 0.1 && rim.min.y >= 12 - 0.07, 'rim within the outline (half a rim of overrun at the joints)');
});

test('profileGeometry extrudes outwards with outward-facing windings', () => {
  const g = profileGeometry(F, 0, 3, [[0, 0], [0.4, 0], [0.4, 0.3], [0, 0.3]]);
  const bb = boxOf([g]);
  assert.ok(Math.abs(bb.max.z - 0.4) < 1e-6 && Math.abs(bb.min.z) < 1e-6 && Math.abs(bb.max.x - 3) < 1e-6);
  // signed volume of a closed outward-wound mesh is positive
  const p = g.getAttribute('position'); let vol = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(p, i), c = new T.Vector3().fromBufferAttribute(p, i + 1), d = new T.Vector3().fromBufferAttribute(p, i + 2);
    vol += a.dot(c.clone().cross(d)) / 6;
  }
  assert.ok(Math.abs(vol - 3 * 0.4 * 0.3) < 1e-6, `volume ${vol}`);
});

test('TriSink winds each triangle to the wanted normal and drops degenerate ones', () => {
  const s = new TriSink();
  s.tri('stone', [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1]);
  s.tri('stone', [0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]);
  const t = s.tris.get('stone')!;
  assert.equal(t.length, 9);
  const u = [t[3] - t[0], t[4] - t[1], t[5] - t[2]], v = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
  assert.ok(u[0] * v[1] - u[1] * v[0] < 0);
});

test('clipRingByY keeps the gable above a section top and drops slivers', () => {
  const gable = [[0, 0, 0], [6, 0, 0], [6, 10, 0], [3, 13, 0], [0, 10, 0]];
  const top = clipRingByY(gable, 10, 1);
  assert.ok(top.every(p => p[1] >= 10 - 1e-9));
  assert.equal(top.length, 3);
  const low = clipRingByY(gable, 10, -1);
  assert.ok(low.every(p => p[1] <= 10 + 1e-9) && low.length === 4);
  assert.deepEqual(clipRingByY(gable, 12.99, 1), []);
});

test('arcLettering centres the text on the arc top and keeps every run on the radius band', () => {
  setSink(0);
  const {b, got} = collector(), px = 0.03, r = 4, ct = 23.9, cy = 1;
  const span = arcLettering(b, F, 'DE CLUB', ct, cy, r, px, 0.03, 'stone');
  assert.ok(span > 0 && span < Math.PI / 2);
  const bb = boxOf(got.map(x => x.g));
  assert.ok(Math.abs((bb.min.x + bb.max.x) / 2 - ct) < 0.05, 'centred on the arc');
  assert.ok(bb.max.y <= cy + r + 7 * px + 0.02 && bb.max.y > cy + r, 'top letters sit on the radius');
  assert.ok(bb.min.y > cy + r * Math.cos(span / 2) - 0.1, 'ends follow the arc down');
});

test('cutFrontWalls keeps each range of a front wall only above its drawn top', () => {
  // a 10 m front along +x (outward normal +z), 8 m tall; a back wall 5 m in stays untouched
  const front = {type: 'WallSurface', rings: [[[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]]]} as const;
  const back = {type: 'WallSurface', rings: [[[0, 0, -5], [10, 0, -5], [10, 8, -5], [0, 8, -5]]]} as const;
  const out = cutFrontWalls([front, back] as never, [[0, 0], [10, 0]], {a: [0, 0], b: [10, 0]}, [[-1, 4, 6], [4, 11, 9]]);
  assert.equal(out.length, 2, 'the second range is above the wall top, so only the first range and the back wall remain');
  const kept = out.find(s => s.rings[0].every(p => p[2] === 0))!;
  assert.ok(kept.rings[0].every(p => p[1] >= 6 - 1e-9 && p[0] <= 4 + 1e-9));
  assert.ok(out.includes(back as never));
});

test('lettering centres level text on t, sits on the baseline and spreads with tracking', () => {
  const {b, got} = collector();
  setSink(0);
  const px = 0.1;
  const w0 = lettering(b, F, 'Bavaria', 3, 2, px, 0.02, 'blue');
  const bb = boxOf(got.map(g => g.g));
  assert.ok(Math.abs((bb.min.x + bb.max.x) / 2 - 3) < 0.05, 'centred on t');
  assert.ok(Math.abs(bb.min.y - 2) < 1e-6, 'baseline at y');
  assert.ok(bb.max.x - bb.min.x <= w0 + 1e-6);
  const {b: b2} = collector();
  const w1 = lettering(b2, F, 'Bavaria', 3, 2, px, 0.02, 'blue', 0, 0.4);
  assert.ok(Math.abs(w1 - w0 - 6 * 0.4) < 1e-9, 'tracking adds per gap');
  assert.throws(() => lettering(b2, F, 'Bav#', 0, 0, px, 0.02, 'blue'));
});

test('strutBetween spans its two points', async () => {
  const {strutBetween, pathSkin, pathLedge} = await import('./venue-kit');
  const {b, got} = collector();
  strutBetween(b, [0, 0, 0], [3, 4, 0], 0.2, 'stone');
  const bb = boxOf(got.map(g => g.g));
  assert.ok(Math.abs(bb.min.y + 0.08) < 0.1 && Math.abs(bb.max.y - 4.08) < 0.1, `y ${bb.min.y}..${bb.max.y}`);
  assert.ok(bb.max.x > 2.9 && bb.min.x < 0.1);
  const M = new TriSink();
  pathSkin(M, [[0, 0], [4, 0], [4, 4]], 0, 3, 0, 'stone');
  pathLedge(M, [[0, 0], [4, 0]], 3, 0.2, -0.1, 0.3, 'slate');
  assert.equal(M.tris.get('stone')!.length / 9, 4);
  assert.equal(M.tris.get('slate')!.length / 9, 10);
});

test('pathLettering follows a bent path and matches lettering width on a straight one', async () => {
  const {pathLettering} = await import('./venue-kit');
  setSink(0);
  const {b: b1} = collector();
  const w0 = lettering(b1, F, 'meervaart', 0, 0, 0.1, 0.02, 'white');
  const {b, got} = collector();
  const w1 = pathLettering(b, [[0, 0], [10, 0]], 'meervaart', 5, 1, 0.1, 0.02, 'white');
  assert.ok(Math.abs(w1 - w0) < 1e-9, 'same set width');
  const bb = boxOf(got.map(g => g.g));
  assert.ok(Math.abs((bb.min.x + bb.max.x) / 2 - 5) < 0.06 && Math.abs(bb.min.y - 1) < 1e-6);
  // a right-angle bend at x = 5: glyphs past the corner turn to the second leg
  const {b: b3, got: g3} = collector();
  pathLettering(b3, [[0, 0], [5, 0], [5, 5]], 'meervaart', 5, 0, 0.2, 0.02, 'white');
  const box3 = boxOf(g3.map(g => g.g));
  assert.ok(box3.max.z > 1 && box3.min.x < 4, 'text runs along both legs');
});

test('swagOutline hangs from the panel corners, deepest and thickest in the middle', () => {
  const p = swagOutline(2, 0.3, 0.1, 10);
  assert.equal(p.length, 22);
  const top = p.slice(0, 11), bot = p.slice(11).reverse();
  assert.deepEqual(top[0], [-1, -0]);
  assert.ok(Math.abs(top[10][0] - 1) < 1e-12 && Math.abs(top[10][1]) < 1e-12);
  assert.ok(Math.abs(top[5][1] + 0.3) < 1e-12, 'middle sags by `sag`');
  const thick = (k: number) => top[k][1] - bot[k][1];
  assert.ok(Math.abs(thick(5) - 0.1) < 1e-12 && thick(0) < thick(5) && thick(10) < thick(5));
});

test('festoonPanel stands its swag proud of the panel, inside the panel outline', () => {
  setSink(0);
  const {b, got} = collector();
  festoonPanel(b, F, 5, 2, 2.4, 0.75, {panel: 'sandstone', swag: 'white', d: 0.06, relief: 0.05});
  const panel = boxOf(got.filter(x => x.c === 'sandstone').map(x => x.g)), swag = boxOf(got.filter(x => x.c === 'white').map(x => x.g));
  assert.ok(Math.abs(panel.max.z - 0.06) < 1e-5 && Math.abs(swag.min.z - 0.06) < 1e-5 && Math.abs(swag.max.z - 0.11) < 1e-5);
  assert.ok(swag.min.x >= panel.min.x - 1e-5 && swag.max.x <= panel.max.x + 1e-5 && swag.min.y >= panel.min.y - 1e-5 && swag.max.y <= panel.max.y + 1e-5);
});

test('balustradeRun: balusters stay clear of the dies, dies rise above the rail', () => {
  setSink(0);
  assert.deepEqual(balusterCentres(0, 2, 0.5), [0.25, 0.75, 1.25, 1.75]);
  const {b, got} = collector();
  balustradeRun(b, F, 0, 10, 12, {h: 0.6, d: 0.2, pitch: 0.3, c: 'stone', dies: [5], dieW: 1, dieH: 0.85, die: 'brick', cap: 'sandstone'});
  const balusters = got.filter(x => x.c === 'stone').map(x => { x.g.computeBoundingBox(); return x.g.boundingBox!; }).filter(bb => bb.max.x - bb.min.x < 0.2);
  assert.ok(balusters.length > 20);
  for (const bb of balusters) assert.ok(bb.max.x <= 4.5 + 1e-5 || bb.min.x >= 5.5 - 1e-5, 'no baluster inside a die');
  const die = boxOf(got.filter(x => x.c === 'brick' || x.c === 'sandstone').map(x => x.g));
  assert.ok(Math.abs(die.max.y - 12.85) < 1e-5 && die.max.y > 12.6);
});

test('wallFacingXZ points away from the block whatever the winding; addShell wallFor recolours walls only', () => {
  // a 4 x 3 m wall in the plane z = 2 (block centre at the origin), wound both ways
  const ring = [[-2, 0, 2], [2, 0, 2], [2, 3, 2], [-2, 3, 2]];
  for (const r of [ring, [...ring].reverse()]) {
    const [nx, nz] = wallFacingXZ({type: 'WallSurface', rings: [r]}, [0, 0]);
    assert.ok(Math.abs(nx) < 1e-9 && Math.abs(nz - 1) < 1e-9);
  }
  assert.deepEqual(wallFacingXZ({type: 'RoofSurface', rings: [[[0, 5, 0], [1, 5, 0], [1, 5, 1]]]}, [0, 0]), [0, 0]);
  const surfaces = [
    {type: 'WallSurface', rings: [ring]},
    {type: 'WallSurface', rings: [[[-2, 0, -2], [-2, 3, -2], [2, 3, -2], [2, 0, -2]]]},
    {type: 'RoofSurface', rings: [[[-2, 3, -2], [2, 3, -2], [2, 3, 2], [-2, 3, 2]]]},
  ];
  const plain = collector(), coloured = collector();
  addShell(plain.b, {surfaces, nativeRing: []}, {wall: 'brick', roof: 'slate'});
  addShell(coloured.b, {surfaces, nativeRing: []}, {wall: 'brick', roof: 'slate', wallFor: s => (wallFacingXZ(s, [0, 0])[1] > 0.5 ? 'white' : 'brick')});
  assert.deepEqual(plain.got.map(g => g.c), ['brick', 'brick', 'slate']);
  assert.deepEqual(coloured.got.map(g => g.c), ['white', 'brick', 'slate']);
});

test('bulletDomeProfile rises from r to a point, narrowing monotonically, fuller than a cone', () => {
  const p = bulletDomeProfile(2, 4);
  assert.deepEqual(p[0], [2, 0]);
  assert.deepEqual(p[p.length - 1], [0, 4]);
  for (let i = 1; i < p.length; i++) { assert.ok(p[i][0] <= p[i - 1][0] + 1e-12); assert.ok(p[i][1] > p[i - 1][1]); }
  for (const [r, h] of p.slice(1, -1)) assert.ok(r > 2 * (1 - h / 4), 'outside the cone');
});

test('roundedTowerCap stacks drum, cornice, dome and ball on its axis', () => {
  const {b, got} = collector();
  const cap = {drumR: 2, drumH: 1.4, sides: 8, corniceR: 2.25, corniceH: 0.25, domeR: 2.1, domeH: 4.2, ballR: 0.35, spikeH: 0.5};
  const top = roundedTowerCap(b, F, 10, -2, 30, cap, {drum: 'brick', trim: 'stone', dome: 'slate', ball: 'gold'});
  const all = boxOf(got.map(x => x.g));
  assert.ok(Math.abs(all.min.y - 30) < 1e-4 && Math.abs(all.max.y - top) < 1e-4);
  assert.ok(Math.abs((all.min.x + all.max.x) / 2 - 10) < 1e-4 && Math.abs((all.min.z + all.max.z) / 2 + 2) < 1e-4, 'centred on (t, out)');
  const dome = boxOf(got.filter(x => x.c === 'slate').map(x => x.g));
  assert.ok(Math.abs(dome.min.y - 31.65) < 1e-4 && Math.abs(dome.max.y - 35.85) < 1e-4);
  assert.ok(all.max.x - all.min.x <= 2 * 2.25 + 1e-4, 'nothing wider than the cornice');
});
