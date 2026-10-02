// Roof shapes and gables (src/canalRecall/roofMesh.ts and friends).
//   npx tsx scripts/check-roof-shapes.ts        (add --odds to print the kind odds per style)
// Every kind and gable shape is built on a few footprints and must be:
//  - finite, with unit normals, and closed: an edge used once must be covered by
//    collinear edges, sit at the eaves (the walls close it), lie on another
//    surface, or be buried under the roof inside the footprint;
//  - consistently wound with positive volume (faces point outward);
//  - end walls fill their gable profiles exactly;
//  - decals (white stone, shutters) sit on a gable/wall plane and face out of it;
// and the plan must agree between the tile decorator and the mesh builder on real tiles.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  GABLE_SHAPES, ROOF_KINDS, decorateRoof, fitRect, gableProfile, corniceHeight, localOuterRing, planBuildingRoof, planRoof,
  roofPlanForFeature, roofTriangles, roofTrianglesForOutline, type RoofPlan, type RoofTri, type Rect,
} from '../src/canalRecall/roofMesh.ts';
import { findChamfer, inscribedRects, insetRing, openRing } from '../src/canalRecall/roofFootprint.ts';
import { meshBuildingFor, ORIGIN } from '../src/canalRecall/threeBuildingFeatures.ts';
import { wallTopHeightM } from '../src/canalRecall/threeBuildingMesh.ts';

type V3 = [number, number, number];
type V2 = [number, number];
const dims = { bayM: 5, storeyM: 3.1, cellM: 1.2 };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const triArea = (t: RoofTri) => Math.hypot(...cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))) / 2;

function pointInPoly(pts: readonly V2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToRing(pts: readonly V2[], x: number, y: number): number {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return d;
}
const rectRing = (r: Rect): V2[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [r.cx + (a * r.len) / 2 * r.ux - (b * r.wid) / 2 * r.uy, r.cy + (a * r.len) / 2 * r.uy + (b * r.wid) / 2 * r.ux] as V2);

/** Closed, outward, finite. `foot` is the footprint ring (mesh frame) the roof stands on, `h0` the eaves. */
function checkSolid(label: string, tris: RoofTri[], foot: readonly V2[], h0: number, pieceRings: V2[][] = []): void {
  assert.ok(tris.length > 0, `${label}: has geometry`);
  for (const t of tris) {
    assert.ok(t.p.flat().every(Number.isFinite) && t.uv.flat().every(Number.isFinite), `${label}: finite`);
    assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-6, `${label}: unit normal`);
    const geo = cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]));
    assert.ok(dot(geo, t.n) > 0, `${label}: winding matches the normal`);
  }
  const solid = tris.filter(t => t.part !== 'decal');
  const key = (p: V3) => p.map(v => Math.round(v * 1e4)).join(',');
  const edges = new Map<string, { a: V3; b: V3; dirs: number[] }>();
  for (const t of solid) for (let k = 0; k < 3; k++) {
    const a = t.p[k], b = t.p[(k + 1) % 3], ka = key(a), kb = key(b);
    if (ka === kb) continue;
    const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const e = edges.get(id) ?? { a, b, dirs: [] };
    e.dirs.push(ka < kb ? 1 : -1);
    edges.set(id, e);
  }
  // Consistent winding: an edge two faces share is walked in opposite directions.
  for (const [id, e] of edges) if (e.dirs.length === 2) assert.ok(e.dirs[0] !== e.dirs[1], `${label}: faces sharing edge ${id} disagree on winding`);
  const boundary = [...edges.values()].filter(e => e.dirs.length === 1);
  const onSurface = (p: V3, skip: RoofTri[]): boolean => solid.some(t => {
    if (skip.includes(t)) return false;
    const d = dot(sub(p, t.p[0]), t.n);
    if (Math.abs(d) > 2e-3) return false;
    const [a, b, c] = t.p, v0 = sub(b, a), v1 = sub(c, a), v2 = sub(p, a);
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1), den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-12) return false;
    const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    return v >= -1e-3 && w >= -1e-3 && v + w <= 1 + 1e-3;
  });
  const under = (p: V3): boolean => {
    // Inside the footprint, or inside a roofed piece's rectangle (a cut corner the roof spans).
    if (![foot, ...pieceRings].some(r => pointInPoly(r, p[0], p[1]) && distToRing(r, p[0], p[1]) >= 0.02)) return false;
    return solid.some(t => {
      if (t.n[2] <= 0.05) return false;
      const [a, b, c] = t.p;
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) return false;
      const l1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den, l2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return false;
      return l1 * a[2] + l2 * b[2] + l3 * c[2] >= p[2] - 1e-3;
    });
  };
  for (const e of boundary) {
    const d = sub(e.b, e.a), l = Math.hypot(...d), u: V3 = [d[0] / l, d[1] / l, d[2] / l];
    const cover: Array<[number, number]> = [];
    for (const o of boundary) {
      if (o === e) continue;
      const pa = sub(o.a, e.a), pb = sub(o.b, e.a), ta = dot(pa, u), tb = dot(pb, u);
      const off = (p: V3, t: number) => Math.hypot(p[0] - u[0] * t, p[1] - u[1] * t, p[2] - u[2] * t);
      if (off(pa, ta) < 2e-3 && off(pb, tb) < 2e-3) cover.push([Math.min(ta, tb) / l, Math.max(ta, tb) / l]);
    }
    cover.sort((x, y) => x[0] - y[0]);
    const gaps: Array<[number, number]> = [];
    let at = 0;
    for (const [c0, c1] of cover) { if (c0 > at + 1e-4) gaps.push([at, Math.min(1, c0)]); at = Math.max(at, c1); }
    if (at < 1 - 1e-4) gaps.push([at, 1]);
    const owners = solid.filter(t => t.p.some(p => key(p) === key(e.a)) && t.p.some(p => key(p) === key(e.b)));
    for (const [g0, g1] of gaps) for (const f of [0.1, 0.5, 0.9]) {
      const t = g0 + (g1 - g0) * f, p: V3 = [e.a[0] + d[0] * t, e.a[1] + d[1] * t, e.a[2] + d[2] * t];
      const ok = p[2] <= h0 + 1e-3 || onSurface(p, owners) || under(p);
      assert.ok(ok, `${label}: open edge (${e.a.map(v => v.toFixed(2))})–(${e.b.map(v => v.toFixed(2))}) at z+${(p[2] - h0).toFixed(2)}`);
    }
  }
  // Outward: positive volume about a point on the eaves plane (the open bottom adds nothing there).
  const c = foot.reduce((s, [x, y]) => [s[0] + x / foot.length, s[1] + y / foot.length], [0, 0]), ref: V3 = [c[0], c[1], h0];
  const vol = solid.reduce((s, t) => s + dot(sub(t.p[0], ref), cross(sub(t.p[1], ref), sub(t.p[2], ref))) / 6, 0);
  assert.ok(vol > 0, `${label}: faces point outward (volume ${vol.toFixed(2)})`);
  // Decals sit on a solid face (or the wall plane under the eaves) and face the same way.
  for (const t of tris.filter(q => q.part === 'decal')) {
    const m: V3 = [(t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3, (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3, (t.p[0][2] + t.p[1][2] + t.p[2][2]) / 3];
    const host = solid.some(s => dot(s.n, t.n) > 0.98 && Math.abs(dot(sub(m, s.p[0]), s.n)) < 0.03);
    // Or on the wall plane, or a fascia board hanging at the eaves overhang (up to 0.6 m out).
    const wall = Math.abs(t.n[2]) < 0.02 && [foot, ...pieceRings].some(r => distToRing(r, m[0], m[1]) < 0.6);
    assert.ok(host || wall, `${label}: decal floats at ${m.map(v => v.toFixed(2))}`);
  }
}

const rectPts = (w: number, d: number): V2[] => [[0, 0], [w, 0], [w, d], [0, d], [0, 0]];
const rot = (pts: V2[], a: number): V2[] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a) + 120, x * Math.sin(a) + y * Math.cos(a) - 40]);
const base = (kind: RoofPlan['kind'], extra: Partial<RoofPlan> = {}): RoofPlan => ({ kind, gable: 'plain', riseM: 2.2, dormers: true, material: 'tile', tone: 0.3, seed: 'chk', accents: true, trimHex: '#efebe2', ...extra });
const H0 = 10;
const footprints: Array<[string, V2[]]> = [['5.5x13', rot(rectPts(5.5, 13), 0.4)], ['8x18', rot(rectPts(8, 18), -1.1)], ['12x13', rot(rectPts(12, 13), 2.0)], ['6x30', rot(rectPts(6, 30), 0.1)]];
let built = 0, maxTris = 0;
for (const [name, ring] of footprints) {
  const rect = fitRect(ring)!, foot = openRing(ring);
  for (const kind of ROOF_KINDS) {
    if (kind === 'parapet') continue;
    for (const gable of kind === 'gable' ? GABLE_SHAPES : ['plain' as const]) {
      for (const accents of [true, false]) {
        const riseM = kind === 'mansard' ? 2.6 : kind === 'mansardHip' ? 3.0 : kind === 'school' ? Math.max(2.8, rect.wid * 0.5) : kind === 'sawtooth' ? 2.4 : Math.max(1.6, Math.min(4.6, rect.wid * 0.36));
        const plan = base(kind, { gable, riseM, accents, shutters: gable === 'spout', shutterHex: '#2f4a3a' });
        const tris = roofTriangles(rect, plan, H0, dims);
        const label = `${name} ${kind}${kind === 'gable' ? `/${gable}` : ''}${accents ? '' : ' (no accents)'}`;
        checkSolid(label, tris, foot, H0);
        if (!accents) assert.ok(tris.every(t => t.part !== 'decal' && t.part !== 'trim'), `${label}: no white trim without accents (landmarks)`);
        if (accents && kind !== 'sawtooth') assert.ok(tris.some(t => (t.part === 'decal' || t.part === 'trim') && t.hex === '#efebe2'), `${label}: white accents`);
        maxTris = Math.max(maxTris, tris.length); built++;
        // End walls fill their profiles: outward plates in each end plane add up to the profile's area.
        if (kind === 'gable' || kind === 'pitched' || kind === 'halfHipped') {
          const W = rect.wid, R = riseM, zc = R * 0.55, vc = (W / 2) * (1 - zc / R);
          const prof: V2[] = kind === 'pitched' ? [[-W / 2, 0], [0, R], [W / 2, 0]] : kind === 'halfHipped' ? [[-W / 2, 0], [-vc, zc], [vc, zc], [W / 2, 0]] : gableProfile(gable, W, R);
          const expected = Math.abs(prof.reduce((s, [x0, y0], i) => { const [x1, y1] = prof[(i + 1) % prof.length]; return s + x0 * y1 - x1 * y0; }, 0)) / 2;
          for (const e of [-1, 1]) {
            const along = (q: number[]) => (q[0] - rect.cx) * rect.ux + (q[1] - rect.cy) * rect.uy;
            const area = tris.filter(t => t.part === 'plate' && t.p.every(q => Math.abs(along(q) - e * rect.len / 2) < 1e-6) && (t.n[0] * rect.ux + t.n[1] * rect.uy) * e > 0.99).reduce((s, t) => s + triArea(t), 0);
            assert.ok(Math.abs(area - expected) < 0.01, `${label}: end ${e} fills its profile (${area.toFixed(2)} of ${expected.toFixed(2)} m²)`);
          }
        }
      }
    }
  }
}
// Gable profiles: start and end at the eaves, never go back, stand above the roof slope.
for (const shape of GABLE_SHAPES) for (const [W, R] of [[5.5, 2.0], [4, 1.6], [8, 2.9]] as const) {
  const prof = gableProfile(shape, W, R);
  assert.equal(prof[0][1], 0); assert.equal(prof[prof.length - 1][1], 0);
  assert.ok(prof.every(([x], i) => i === 0 || x >= prof[i - 1][0] - 1e-9), `${shape}: x never goes back`);
  if (shape === 'cornice') assert.ok(Math.abs(Math.max(...prof.map(p => p[1])) - corniceHeight(R)) < 1e-9 && corniceHeight(R) < R, 'cornice: flat top below the ridge, the roof hipped behind it');
  else assert.ok(prof.every(([x, y]) => y >= R * (1 - Math.abs(x) / (W / 2)) - 1e-6), `${shape} ${W}x${R}: the plate stands at or above the slope`);
}

// --- Footprints ---------------------------------------------------------------
{
  // An L: its long leg is roofed and the foot becomes a wing; both lie inside the outline.
  const L: V2[] = rot([[0, 0], [16, 0], [16, 6], [6, 6], [6, 14], [0, 14], [0, 0]], 0.3);
  const ins = inscribedRects(L, fitRect(L, 40)!)!;
  assert.ok(ins && ins.second, 'an L gives a main rectangle and a wing');
  for (const r of [ins.main, ins.second!]) for (const [x, y] of rectRing(r)) assert.ok(pointInPoly(openRing(L), x, y) || distToRing(openRing(L), x, y) < 0.02, 'inscribed corners lie in the outline');
  assert.ok(Math.abs(ins.main.len * ins.main.wid + ins.second!.len * ins.second!.wid - (16 * 6 + 6 * 8)) < 0.05, 'main + wing cover the L');
  // A canal house with a narrower rear extension: the front body is roofed.
  const T: V2[] = rot([[0, 0], [6, 0], [6, 12], [4.5, 12], [4.5, 20], [0, 20], [0, 0]], 1.2);
  const t = inscribedRects(T, fitRect(T, 40)!)!;
  assert.ok(t.main.wid >= 4.4 && t.mainShare >= 0.5, `a house with a rear extension roofs its body (${t.main.len.toFixed(1)}x${t.main.wid.toFixed(1)})`);
  // Plans on non-rectangles keep the lid around their pieces.
  let pieces = 0, two = 0;
  for (let i = 0; i < 200; i++) { const p = planBuildingRoof(`L${i}`, 'c19', 16, 0, L); if (p) { assert.ok(p.keepLid && p.pieces?.length, 'pieces over a lid'); pieces++; if (p.pieces!.length === 2) two++; } }
  assert.ok(pieces > 100 && two > 50, `L-shaped c19 blocks get roofs (${pieces}/200, ${two} with a wing)`);
  // A cut street corner: found, and gets a turret on a share of c19 blocks.
  const C: V2[] = rot([[0, 0], [20, 0], [20, 12], [3, 15], [0, 12], [0, 0]].map(([x, y]) => [x, Math.min(y, 15)]) as V2[], 0.2);
  const chamfered: V2[] = rot([[0, 0], [18, 0], [18, 11], [15, 14], [0, 14], [0, 0]], 0.7);
  assert.ok(findChamfer(chamfered, fitRect(chamfered)!), 'a cut corner is found');
  assert.equal(findChamfer(rot(rectPts(18, 14), 0.7), fitRect(rot(rectPts(18, 14), 0.7))!), null, 'a plain rectangle has no cut corner');
  void C;
  let turrets = 0;
  for (let i = 0; i < 100; i++) { const p = planBuildingRoof(`t${i}`, 'c19', 17, 0, chamfered); if (p?.turret) turrets++; }
  assert.ok(turrets > 20, `c19 corner blocks grow turrets (${turrets}/100)`);
  // Parapets: an inset that stays well formed, and none for a sliver that would fold.
  assert.ok(insetRing(openRing(L), 0.25), 'an L insets cleanly');
  assert.equal(insetRing([[0, 0], [10, 0], [10, 0.3], [0, 0.3]], 0.25), null, 'a 30 cm sliver cannot hold a parapet');
}

// --- Whole outlines in the mesh frame (pieces, wings, turret, parapet) ----------
{
  const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), lat0 = 52.372, lng0 = 4.889;
  const toLngLat = (pts: V2[]) => pts.map(([x, y]) => [lng0 + x / (111_320 * Math.cos(lat0 * Math.PI / 180)), lat0 + y / 110_540]);
  const meshRing = (ll: number[][]) => openRing(ll.map(([lng, lat]) => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * 110_540] as V2));
  const shapes: Array<[string, V2[], string]> = [
    ['L c19', [[0, 0], [16, 0], [16, 6], [6, 6], [6, 14], [0, 14], [0, 0]], 'c19'],
    ['chamfer c19', [[0, 0], [18, 0], [18, 11], [15, 14], [0, 14], [0, 0]], 'c19'],
    ['U postwar', [[0, 0], [30, 0], [30, 20], [22, 20], [22, 8], [8, 8], [8, 20], [0, 20], [0, 0]], 'postwar'],
    ['modern block', [[0, 0], [25, 0], [25, 14], [0, 14], [0, 0]], 'modern'],
  ];
  const seen = new Set<string>();
  for (const [name, pts, style] of shapes) for (let i = 0; i < 60; i++) {
    const ll = toLngLat(pts), feature = { type: 'Feature' as const, properties: { id: `${name}-${i}`, height: 18, minHeight: 0, facade: `${style}-priorBrickRed`, facadeStyle: style }, geometry: { type: 'Polygon', coordinates: [ll] } };
    const plan = roofPlanForFeature(feature);
    if (!plan) continue;
    seen.add(`${name}:${plan.kind}${plan.turret ? '+turret' : ''}${plan.pieces && plan.pieces.length > 1 ? '+wing' : ''}`);
    const h0 = 18 - plan.riseM, tris = roofTrianglesForOutline(ll, ORIGIN, plan, h0, dims, kx);
    const m0 = meshRing(ll)[0], sx = kx / (111_320 * Math.cos(lat0 * Math.PI / 180));
    const pieceRings = (plan.pieces ?? []).map(pc => rectRing(pc.rect).map(([x, y]) => [m0[0] + x * sx, m0[1] + y] as V2));
    checkSolid(`${name} #${i} ${plan.kind}`, tris, meshRing(ll), h0, pieceRings);
  }
  for (const want of ['L c19:mansardHip+wing', 'chamfer c19:hipped+turret', 'U postwar:parapet', 'modern block:parapet']) assert.ok([...seen].some(s => s.startsWith(want.split('+')[0]) && (!want.includes('+') || s.includes(want.split('+')[1]))), `${want} is built (${[...seen].join(', ')})`);
}

// --- OSM roof shapes ---------------------------------------------------------------
{
  const ring = rectPts(6, 14).map(([x, y]) => [4.9 + x / 68_000, 52.37 + y / 110_540]);
  const house = (id: string, roofShape?: string) => ({ type: 'Feature' as const, properties: { id, height: 16, minHeight: 0, facade: 'c19-priorBrickRed', facadeStyle: 'c19', ...(roofShape ? { roofShape } : {}) }, geometry: { type: 'Polygon', coordinates: [ring] } });
  for (const [tag, kinds] of [['quadruple_saltbox', ['mansardHip', 'hipped']], ['double_saltbox', ['gable', 'pitched', 'mansard']], ['gabled', ['gable', 'pitched']], ['hipped', ['hipped']]] as const) {
    let roofed = 0;
    for (let i = 0; i < 40; i++) {
      const out = decorateRoof(house(`${tag}${i}`, tag));
      assert.ok(out.properties.roofPlanned, `${tag}: a mapped roof shape is always drawn`);
      assert.ok((kinds as readonly string[]).includes(String(out.properties.roofShape)), `${tag} -> ${out.properties.roofShape}`);
      assert.equal(out.properties.roofShapeTag, tag, 'the mapped tag is kept');
      assert.deepEqual(roofPlanForFeature(out), roofPlanForFeature(house(`${tag}${i}`, tag)), 'the plan survives decoration');
      roofed++;
    }
    assert.equal(roofed, 40);
  }
  const skillion = house('s', 'skillion');
  assert.equal(decorateRoof(skillion), skillion, 'a shape we cannot draw is left alone');
}

// --- Decorator and mesh agree on real tiles ------------------------------------------
{
  const root = 'public/data/extracts/amsterdam';
  const { decorateFacade } = await import('../src/canalRecall/genericFacades.ts');
  const { decorateBuildingFeature } = await import('../src/canalRecall/buildingTilesBrowser.ts');
  const { shortBuildingId } = await import('../src/canalRecall/buildingFacts.ts');
  const readGz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
  let agreed = 0;
  for (const tile of ['14/8414/5384', '14/8413/5385']) {
    const path = `${root}/building-tiles/${tile}.geojson.gz`;
    if (!existsSync(path)) continue;
    const facts = existsSync(`${root}/building-facts/${tile}.json.gz`) ? readGz(`${root}/building-facts/${tile}.json.gz`).buildings ?? {} : {};
    const fc = readGz(path);
    for (const f of fc.features.slice(0, 1500)) {
      const row = facts[shortBuildingId(String(f.properties.id ?? ''))];
      if (row) f.properties.constructionYear = row[0];
      const d = decorateRoof(decorateFacade(decorateBuildingFeature(f, new Map())));
      if (!d.properties.roofPlanned) continue;
      const mesh = meshBuildingFor(d, 'photo');
      assert.ok(mesh?.roof, `${d.properties.id}: the mesh builds the decorator's roof`);
      assert.deepEqual(mesh!.roof!.plan, roofPlanForFeature(d), `${d.properties.id}: one plan`);
      assert.ok(Math.abs(wallTopHeightM(d.properties) - (Number(d.properties.height) - mesh!.roof!.plan.riseM)) < 1e-9, 'walls stop at the eaves');
      agreed++;
    }
  }
  assert.ok(agreed > 500, `decorator and mesh agree (${agreed} roofs)`);
}

// --- Odds per style ---------------------------------------------------------------------
if (process.argv.includes('--odds')) {
  const sizes: Array<[string, V2[]]> = [['narrow 6x14', rectPts(6, 14)], ['wide 14x18', rectPts(14, 18)], ['villa 11x13', rectPts(11, 13)], ['L', [[0, 0], [16, 0], [16, 6], [6, 6], [6, 14], [0, 14], [0, 0]]], ['hall 20x30', rectPts(20, 30)]];
  for (const style of ['canal', 'c19', 'school', 'postwar', 'modern', 'tower']) for (const [sz, ring] of sizes) {
    const c: Record<string, number> = {};
    const h = sz.startsWith('villa') || sz.startsWith('hall') ? 10 : 16;
    for (let i = 0; i < 2000; i++) { const p = planBuildingRoof(`${style}${i}`, style, h, 0, ring); const k = p ? (p.kind === 'gable' ? `gable/${p.gable}` : p.kind) + (p.turret ? '+turret' : '') : 'flat'; c[k] = (c[k] ?? 0) + 1; }
    console.log(`${style.padEnd(8)} ${sz.padEnd(12)} ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / 20).toFixed(0)}%`).join(', ')}`);
  }
}
void planRoof; void localOuterRing;
console.log(`roof shapes: ok (${built} roofs closed, max ${maxTris} triangles on one rectangle)`);
