// Terraces (lane terraces-20261114): flag, permit filter, style, hours, geometry, kit caps, placement, layer helpers.
//   node --import tsx --test src/canalRecall/terraces/terraces.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { inPolygon, permitRejection, rdMultiPolygonToLocal, simplifyRing, terraceHours, terraceOpenAt, terraceStyle, terracesEnabled, toLocal, fromLocal, polygonArea, type PermitRow, type Polygon, type Vec2 } from './extract.ts';
import { TERRACE_LO_TRI_CAP, TERRACE_MODEL_IDS, TERRACE_TRI_CAP, TERRACE_TONES, UNIT_SIZE, terraceModel } from './kit.ts';
import { EDGE_CLEAR_M, dominantAxis, hash01, placeTerrace, streetEdges, terraceDepth, type SurfaceProbe } from './placement.ts';
import { decodeUnits, fadeAt, selectUnits, BUCKET_M } from '../engine/terraceLayer.ts';
import { lngLatToRd } from '../rdCoordinates.ts';

const row = (o: Partial<PermitRow> = {}): PermitRow => ({ id: 1, statusVergunning: 'Verleend', begindatum: '2025-01-01', einddatum: '2028-01-01', terrasgeometrie: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] }, ...o });
/** A rectangle w x d (m) at local (x, y), rotated `deg`. */
const rect = (x: number, y: number, w: number, d: number, deg = 0): Polygon => {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return [[[0, 0], [w, 0], [w, d], [0, d]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as Vec2)];
};
const allPavement: SurfaceProbe = () => 'pavement';

test('flag: default off; ?terraces=1 or TERRACES=1 on; 0 and the kill switch win', () => {
  assert.equal(terracesEnabled('', null), false);
  assert.equal(terracesEnabled('?terraces=1', null), true);
  assert.equal(terracesEnabled('', '1'), true);
  assert.equal(terracesEnabled('?terraces=1', '0'), false);
  assert.equal(terracesEnabled('?terraces=0', '1'), false);
  assert.equal(terracesEnabled('?terraces=1', null, false), false);
});

test('permit filter: granted, started, not expired, with a terrace polygon', () => {
  const today = '2026-11-14';
  assert.equal(permitRejection(row(), today), null);
  assert.equal(permitRejection(row({ statusVergunning: 'Deels verleend' }), today), null);
  assert.equal(permitRejection(row({ begindatum: null }), today), null);
  assert.match(permitRejection(row({ statusVergunning: null }), today)!, /status/);
  assert.match(permitRejection(row({ statusVergunning: 'Buiten behandeling' }), today)!, /status/);
  assert.equal(permitRejection(row({ einddatum: '2026-11-13' }), today), 'expired');
  assert.equal(permitRejection(row({ begindatum: '2026-12-01' }), today), 'not started');
  assert.equal(permitRejection(row({ terrasgeometrie: null }), today), 'no terrace geometry');
});

test('style from category, specification and name', () => {
  assert.equal(terraceStyle('Café', 'Café', 'Café Hoppe'), 'brown');
  assert.equal(terraceStyle('Café', 'Eetcafé', 'Eetcafé De Pijp'), 'brown');
  assert.equal(terraceStyle('Café', 'Café', 'Proeflokaal Wynand Fockink'), 'brown');
  assert.equal(terraceStyle('Restaurant', 'Restaurant', 'Copain'), 'restaurant');
  assert.equal(terraceStyle('Nachtzaak', 'Discotheek', 'Paradiso'), 'bar');
  assert.equal(terraceStyle('Café', 'Café', 'Wine Bar Vyne'), 'bar');
  assert.equal(terraceStyle('Café', 'Café', 'Bar Cadaq'), 'bistro');
  assert.equal(terraceStyle('Restaurant', 'Restaurant', 'Seafood Bar Spui B.V.'), 'restaurant');
  assert.equal(terraceStyle('Café', 'Café', 'Het Paleis'), 'bistro');
  assert.equal(terraceStyle('Alcoholvrij', 'Lunchroom', 'Lunchroom X'), 'modern');
  assert.equal(terraceStyle('Fastfood', 'Snackbar', 'Snackbar Y'), 'modern');
});

test('terrace hours: parsing, past midnight, weekend span', () => {
  const h = terraceHours(row({ oTijdenTerrasZoDoVan: '10.00', oTijdenTerrasZoDoTot: '01.00', oTijdenTerrasVrZaVan: '10.00', oTijdenTerrasVrZaTot: '02.00' }))!;
  assert.deepEqual(h, { sunThu: ['10:00', '01:00'], friSat: ['10:00', '02:00'] });
  assert.equal(terraceOpenAt(h, 1, '12:00'), true);   // Monday noon
  assert.equal(terraceOpenAt(h, 1, '09:00'), false);  // Monday 9:00
  assert.equal(terraceOpenAt(h, 2, '00:30'), true);   // Monday night, Tuesday 00:30
  assert.equal(terraceOpenAt(h, 2, '01:30'), false);
  assert.equal(terraceOpenAt(h, 6, '01:30'), true);   // Friday night, Saturday 01:30
  assert.equal(terraceHours(row({ oTijdenTerrasZoDoVan: 'nvt', oTijdenTerrasZoDoTot: '-' })), null);
  assert.equal(terraceOpenAt(null, 3, '03:00'), true);
});

test('geometry: local frame round trip, simplify keeps corners, RD polygon lands where its corner is', () => {
  const [lng, lat] = fromLocal(...toLocal(4.8931, 52.3731));
  assert.ok(Math.abs(lng - 4.8931) < 1e-9 && Math.abs(lat - 52.3731) < 1e-9);
  const ring: Vec2[] = [[0, 0], [5, 0.05], [10, 0], [10, 4], [0, 4]];
  assert.equal(simplifyRing(ring, 0.25).length, 4);
  // Leidseplein-ish corner, an 8 x 4 m terrace in RD
  const [x, y] = lngLatToRd(4.8826, 52.3641);
  const polys = rdMultiPolygonToLocal([[[[x, y], [x + 8, y], [x + 8, y + 4], [x, y + 4], [x, y]]]]);
  assert.equal(polys.length, 1);
  assert.ok(Math.abs(polygonArea(polys[0]) - 32) < 0.5, `area ${polygonArea(polys[0])}`);
  const [cx, cy] = toLocal(4.8826, 52.3641);
  assert.ok(Math.hypot(polys[0][0][0][0] - cx, polys[0][0][0][1] - cy) < 0.5);
  assert.equal(rdMultiPolygonToLocal([[[[x, y], [x + 0.5, y], [x, y + 0.5], [x, y]]]]).length, 0, 'sliver dropped');
});

test('kit: every model under its triangle cap, low twins lighter, brown café tones match the retail-ground palette', () => {
  for (const id of TERRACE_MODEL_IDS) {
    const hi = terraceModel(id), lo = terraceModel(id, true);
    assert.ok(hi.triangles <= TERRACE_TRI_CAP, `${id} ${hi.triangles}`);
    assert.ok(lo.triangles <= TERRACE_LO_TRI_CAP && lo.triangles < hi.triangles, `${id}-lo ${lo.triangles}`);
    assert.equal(hi.positions.length, hi.triangles * 9);
    assert.equal(hi.colours.length, hi.positions.length);
    assert.ok(hi.positions.every(Number.isFinite));
    assert.ok(Math.min(...Array.from(hi.positions).filter((_, i) => i % 3 === 2)) >= 0, `${id} below ground`);
  }
  assert.equal(TERRACE_TONES.brownWood, '#3a2519');
  assert.equal(TERRACE_TONES.brownDark, '#2b1a12');
  for (const [id, s] of Object.entries(UNIT_SIZE)) assert.ok(terraceModel(id as never).radiusM <= Math.hypot(s.halfX, s.halfY) + 0.12, id);
  assert.ok(terraceModel('parasol').heightM > 2.2, 'parasol clears heads');
});

test('placement: a 10 x 4 m terrace gets a grid at real spacing, inside the polygon', () => {
  const poly = rect(0, 0, 10, 4, 0);
  const p = placeTerrace('t1', 'bistro', [poly], allPavement);
  const sets = p.units.filter(u => u.model === 'set-bistro');
  assert.ok(sets.length >= 8 && sets.length <= 14, `${sets.length} sets`);
  for (const u of sets) assert.ok(inPolygon([u.x, u.y], poly));
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) assert.ok(Math.hypot(sets[i].x - sets[j].x, sets[i].y - sets[j].y) >= 1.39, 'pitch');
  assert.ok(Math.abs(p.depthM - 4) < 0.3);
});

test('placement: rotated terraces keep their axis; strips get the facade bench', () => {
  assert.ok(Math.abs(dominantAxis([rect(0, 0, 12, 3, 23)]) * 180 / Math.PI - 23) < 1.5);
  const strip = placeTerrace('t2', 'brown', [rect(0, 0, 9, 1, 23)], allPavement);
  assert.ok(strip.units.length >= 3 && strip.units.every(u => u.model === 'set-wall'), JSON.stringify(strip.units.map(u => u.model)));
  for (const u of strip.units) assert.ok(Math.abs((((u.yawDeg - 23) % 180) + 180) % 180) < 1.5 || Math.abs((((u.yawDeg - 23) % 180) + 180) % 180 - 180) < 1.5);
  assert.ok(Math.abs(terraceDepth(rect(0, 0, 9, 1, 23)[0] ? rect(0, 0, 9, 1, 23) : []) - 1) < 0.3);
});

test('placement: nothing on the carriageway, cycle path or water; parking bays at carriageway level', () => {
  const poly = rect(0, 0, 10, 6);
  // y > 4: a cycle path runs through the terrace polygon's outer strip; x > 8: water.
  const probe: SurfaceProbe = ([x, y]) => (y > 4 ? 'road' : x > 8 ? 'water' : x < 2 ? 'parking' : 'pavement');
  const p = placeTerrace('t3', 'modern', [poly], probe);
  assert.ok(p.units.length > 0);
  for (const u of p.units) { assert.ok(u.y < 4.2, `unit at y ${u.y}`); if (u.model.startsWith('set-')) assert.ok(u.x < 8, `unit at x ${u.x}`); }
  assert.ok(p.units.some(u => u.level === 1), 'a parking-bay unit');
});

test('placement: street edges found outside the polygon; dressed edges keep the units clear', () => {
  const poly = rect(0, 0, 12, 5);
  const probe: SurfaceProbe = ([, y]) => (y < -0.4 ? 'road' : 'pavement');
  const edges = streetEdges(poly, probe);
  assert.equal(edges.length, 1);
  assert.ok(edges[0][0][1] === 0 && edges[0][1][1] === 0);
  // Find an id whose hash dresses a restaurant's edges (60 %), then check the screens and the clearance.
  const id = Array.from({ length: 50 }, (_, i) => `r${i}`).find(i => hash01(`${i}/edge`) < 0.6)!;
  const p = placeTerrace(id, 'restaurant', [poly], probe);
  const screens = p.units.filter(u => u.model === 'screen');
  assert.ok(screens.length >= 6, `${screens.length} screens`);
  for (const s of screens) assert.ok(Math.abs(s.y - 0.3) < 0.01);
  for (const u of p.units.filter(u => u.model === 'set-restaurant')) assert.ok(u.y - 0.83 >= 0.3 + 0.18 && u.y - 0.68 >= EDGE_CLEAR_M - 0.15 - 1e-6, `set at y ${u.y}`);
});

test('placement is deterministic and a tiny polygon falls back to one unit or none', () => {
  const poly = rect(5, 5, 7, 3, 10);
  assert.deepEqual(placeTerrace('x', 'bar', [poly], allPavement), placeTerrace('x', 'bar', [poly], allPavement));
  const tiny = placeTerrace('y', 'restaurant', [rect(0, 0, 1.5, 1.4)], allPavement);
  assert.ok(tiny.units.length <= 1);
});

test('layer helpers: decode, select by radius with near/far split, fade', () => {
  const units = decodeUnits({ models: [...TERRACE_MODEL_IDS], terraces: [{ lng: 4.9, lat: 52.37, units: [[0, 0, 0, 90], [6, 100, 0, 0, 3], [1, 0, 2000, 0, 0, 1]] } as never] });
  assert.equal(units.length, 3);
  assert.ok(Math.abs(units[0].yaw - Math.PI / 2) < 1e-9);
  assert.equal(units[1].c, 3); assert.equal(units[2].level, 1);
  const [x1] = toLocal(units[1].lng, units[1].lat); assert.ok(Math.abs(x1 - 10) < 1e-6);
  const pos = new Float64Array([0, 0, 10, 0, 0, 200, 100, 0]);
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < 4; i++) { const k = `${Math.floor(pos[2 * i] / BUCKET_M)}_${Math.floor(pos[2 * i + 1] / BUCKET_M)}`; (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(i); }
  const s = selectUnits(pos, buckets, 0, 0, 150, 60);
  assert.deepEqual(s.near.sort(), [0, 1]); assert.deepEqual(s.far, [3]);
  assert.equal(fadeAt(50), 1); assert.equal(fadeAt(150), 0); assert.ok(fadeAt(130) > 0 && fadeAt(130) < 1);
});

test('stray polygons: far from the premises, or (no premises) from the largest part, are dropped', async () => {
  const { plausiblePolygons } = await import('./extract.ts');
  const near = rect(0, 0, 6, 3), far = rect(-245_000, 0, 2, 2);
  assert.deepEqual(plausiblePolygons([near, far], [1, 1]).dropped, 1);
  assert.deepEqual(plausiblePolygons([near, far], null).kept, [near]);
  assert.equal(plausiblePolygons([rect(0, 0, 200, 3)], null).dropped, 1, 'over 150 m across');
});

test('a park-sized permit keeps MAX_TABLE_UNITS units round the premises', async () => {
  const { MAX_TABLE_UNITS } = await import('./placement.ts');
  const p = placeTerrace('big', 'bistro', [rect(0, 0, 60, 60)], allPavement, [0, 0]);
  const sets = p.units.filter(u => u.model === 'set-bistro');
  assert.equal(sets.length, MAX_TABLE_UNITS);
  assert.ok(sets.every(u => Math.hypot(u.x, u.y) < 30), 'clustered at the premises corner');
});
