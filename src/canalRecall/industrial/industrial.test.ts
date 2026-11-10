// The industrial classifier, table and kit (lane industrial-kit 2026-11-10; user 2026-11-09 in Westpoort: Isarweg
// storage tanks drawn as round towers with windows, sheds drawn as grey offices with shopfronts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndustrial, ringRoundness, type IndustrialFacts } from './industrialClass.ts';
import { applyIndustrial, industrialEnricher, isIndustrialTable, type IndustrialTable } from './industrialTable.ts';
import { INDUSTRIAL_PALETTES, industrialMeshSpec, industrialTris, industrialWallHex, type KitEdge } from './industrialKit.ts';
import { ORIGIN, buildFeatureChunk, meshBuildingFor, type Feature } from '../threeBuildingFeatures.ts';
import { BAY_ENTRIES } from '../bayLook.ts';

const circle = (r: number, n = 36) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
const base: IndustrialFacts = { id: 'x', heightM: 10, minHeightM: 0, areaM2: 2000, roundness: 0.7, vertices: 4, year: 1985 };

test('roundness: a circle near 1, a square 0.785', () => {
  assert.ok(ringRoundness(circle(10)).roundness > 0.99);
  assert.ok(Math.abs(ringRoundness([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]).roundness - Math.PI / 4) < 1e-9);
  assert.equal(ringRoundness([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]).vertices, 4);
});

test('classify: the user\'s three Westpoort spots', () => {
  // Isarweg storage tank 0363100012212203: OSM man_made=storage_tank, building=yes, round, no VBO.
  assert.equal(classifyIndustrial({ ...base, id: 'NL.IMBAG.Pand.0363100012212203', heightM: 11.8, areaM2: 32.5, roundness: 0.98, vertices: 71, year: 1971, osmBuilding: 'yes', manMade: 'storage_tank', industrialLand: true }).kind, 'tank');
  // The 1967 warehouse 0363100012202272 (blue profiled sheet in the panorama).
  assert.equal(classifyIndustrial({ ...base, id: 'NL.IMBAG.Pand.0363100012202272', year: 1967, osmBuilding: 'warehouse', industrialLand: true, uses: { industriefunctie: 9000 } }).kind, 'shed');
  // The 1991 industrial hall 0363100012099856 on the Hornweg.
  assert.equal(classifyIndustrial({ ...base, id: 'NL.IMBAG.Pand.0363100012099856', year: 1991, heightM: 13.2, osmBuilding: 'industrial', industrialLand: true }).kind, 'shed');
});

test('classify: what keeps the grammar', () => {
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'warehouse', year: 1890 }).kind, null, 'a canal pakhuis has windows');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', uses: { woonfunctie: 400, industriefunctie: 600 } }).kind, null, 'housing in it');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', uses: { bijeenkomstfunctie: 900, industriefunctie: 100 } }).kind, null, 'a converted hall used for meetings');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', landmark: true }).kind, null);
  assert.equal(classifyIndustrial({ ...base, roundness: 0.99, vertices: 40, industrialLand: false }).kind, null, 'a round building off the estates');
  assert.equal(classifyIndustrial({ ...base, roundness: 0.99, vertices: 40, industrialLand: true, uses: { kantoorfunctie: 500 } }).kind, 'office', 'a round office on an estate keeps its windows');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', heightM: 45 }).kind, null, 'a tower is no shed');
  assert.equal(classifyIndustrial({ ...base, areaM2: 6, manMade: 'storage_tank', roundness: 0.99, vertices: 30 }).kind, null, 'too small');
  assert.equal(classifyIndustrial({ ...base, areaM2: 30, osmBuilding: 'industrial', industrialLand: true }).kind, null, 'a hut');
  assert.equal(classifyIndustrial({ ...base, manMade: 'silo' }).kind, 'silo', 'a mapped silo block, not round');
  assert.equal(classifyIndustrial({ ...base, manMade: 'storage_tank', osmBuilding: 'house' }).kind, null, 'a house with a tank tag');
  // A distribution hall registered 'industriefunctie,kantoorfunctie' (half each): a shed, not an office.
  assert.equal(classifyIndustrial({ ...base, industrialLand: true, uses: { industriefunctie: 5000, kantoorfunctie: 5000 } }).kind, 'works', 'with its offices on the front');
  assert.equal(classifyIndustrial({ ...base, industrialLand: true, uses: { industriefunctie: 6352 }, vbos: 11 }).kind, 'works', 'a multi-tenant hall (Westpoort 0363100012071928, TE HUUR, offices on the front)');
  assert.equal(classifyIndustrial({ ...base, industrialLand: true, uses: { industriefunctie: 1000, kantoorfunctie: 5000 } }).kind, 'office');
  assert.equal(classifyIndustrial({ ...base, industrialLand: true }).kind, 'shed', 'an unregistered hall on an estate');
  assert.equal(classifyIndustrial({ ...base, industrialLand: true, areaM2: 200 }).kind, null, 'a small unregistered building on an estate');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', areaM2: 65, heightM: 13.9, year: 2015 }).kind, null, 'a small workshop in an old-city courtyard');
  assert.equal(classifyIndustrial({ ...base, osmBuilding: 'industrial', areaM2: 65, heightM: 4, industrialLand: true }).kind, 'shed', 'a small hut on an estate');
});

test('table and enricher: stamps only named ids; a missing table changes nothing', async () => {
  const table: IndustrialTable = { version: 1, source: 't', ids: { a: 'tank', b: 'shed' } };
  assert.ok(isIndustrialTable(table));
  assert.ok(!isIndustrialTable({ version: 2, ids: {} }));
  const fs = [{ properties: { id: 'a' } }, { properties: { id: 'c' } }] as { properties: Record<string, unknown> }[];
  assert.equal(applyIndustrial(fs, table), 1);
  assert.equal(fs[0].properties.industrial, 'tank');
  assert.ok(!('industrial' in fs[1].properties));
  let fetches = 0;
  const e = industrialEnricher('/x', async () => { fetches++; return table; });
  const apply = await e({ z: 14, x: 0, y: 0 }, undefined as any);
  await e({ z: 14, x: 1, y: 0 }, undefined as any);
  assert.equal(fetches, 1);
  const g: { properties: Record<string, unknown> }[] = [{ properties: { id: 'b' } }];
  (apply as (f: typeof g) => void)(g);
  assert.equal(g[0].properties.industrial, 'shed');
  assert.equal(await industrialEnricher('/x', async () => null)({ z: 14, x: 0, y: 0 }, undefined as any), undefined);
});

test('kit: wall colours from the measured palette; shed doors on the street wall, tank cone and rail', () => {
  assert.ok(INDUSTRIAL_PALETTES.shed.includes(industrialWallHex('x', 'shed')));
  const L = 60, D = 30;
  const edges: KitEdge[] = [[0, 0, L, 0], [L, 0, L, D], [L, D, 0, D], [0, D, 0, 0]].map(([x0, y0, x1, y1]) => { const len = Math.hypot(x1 - x0, y1 - y0); return { x0, y0, x1, y1, len, nx: (y1 - y0) / len, ny: -(x1 - x0) / len, hole: false }; });
  const spec = industrialMeshSpec('hall', 'shed', 9, 1800);
  const tris = industrialTris({ id: 'hall', spec, wallHex: '#3a5566', edges, street: new Set([edges[0]]), hidden: () => false, base: 0, top: 9 });
  const doors = tris.filter(t => t.hex === spec.trim.door || t.hex === spec.trim.doorDark);
  assert.ok(doors.length >= 2, 'doors drawn');
  assert.ok(doors.every(t => t.p.every(p => p[1] <= 0)), 'doors on the street wall (y = 0, normal -y)');
  const ring = circle(8, 24).map(([x, y]) => [x, y]);
  const tankEdges: KitEdge[] = ring.map((p, i) => { const q = ring[(i + 1) % ring.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]); return { x0: p[0], y0: p[1], x1: q[0], y1: q[1], len, nx: (q[1] - p[1]) / len, ny: -(q[0] - p[0]) / len, hole: false }; });
  const tank = industrialMeshSpec('tank', 'tank', 12, 200);
  const tt = industrialTris({ id: 'tank', spec: tank, wallHex: '#c6cbcd', edges: tankEdges, street: new Set(), hidden: () => false, base: 0, top: 12 });
  const cone = tt.filter(t => t.n[2] !== 0);
  assert.ok(cone.length === 24 && cone.every(t => t.n[2] > 0 && t.p.some(p => p[2] > 12.5)), 'one upward cone face per edge');
  assert.ok(tt.some(t => t.hex === tank.trim.rail));
});

// ------------------------------------------------------------- meshes
const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const box = (x: number, y: number, w: number, d: number): number[][] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x, y]].map(([a, b]) => [ORIGIN.lng + a / KX, ORIGIN.lat + b / KY]);
const hall = (props: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100012202272', height: 10.2, minHeight: 0, facade: 'x', facadeStyle: 'postwar', constructionYear: 1967, buildingType: 'warehouse', ...props }, geometry: { type: 'Polygon', coordinates: [box(0, 5, 80, 40)] } }) as Feature;
const g = globalThis as { __canalRecallIndustrialKit?: boolean };
const streets = Float32Array.from([-100, 0, 200, 0]);
const same = (a: ReturnType<typeof buildFeatureChunk>, b: ReturnType<typeof buildFeatureChunk>) =>
  a.vertexCount === b.vertexCount && Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer)) && Buffer.from(a.layers.buffer).equals(Buffer.from(b.layers.buffer)) && Buffer.from(a.tints.buffer).equals(Buffer.from(b.tints.buffer)) && Buffer.from(a.uvs.buffer).equals(Buffer.from(b.uvs.buffer));

test('mesh: no stamp, or the flag off, is byte-identical to before', () => {
  try {
    g.__canalRecallIndustrialKit = true;
    const plain = buildFeatureChunk([hall()], 'storybook', 'walls', streets);
    g.__canalRecallIndustrialKit = false;
    assert.ok(same(buildFeatureChunk([hall({ industrial: 'shed' })], 'storybook', 'walls', streets), plain), 'flag off ignores the stamp');
    assert.ok(same(buildFeatureChunk([hall()], 'storybook', 'walls', streets), plain), 'no stamp, flag on or off');
  } finally { delete g.__canalRecallIndustrialKit; }
});

test('mesh: a stamped shed has no window or shop cells; a tank no window cells; an office keeps windows but no shop', () => {
  try {
    g.__canalRecallIndustrialKit = true;
    for (const look of ['photo', 'storybook', 'cartoon'] as const) {
      const before = buildFeatureChunk([hall()], look, 'walls', streets);
      const usesBay = (c: ReturnType<typeof buildFeatureChunk>) => [...c.layers].some(l => l < BAY_ENTRIES.length && BAY_ENTRIES[l].kind !== 'plain');
      assert.ok(usesBay(before), `${look}: before draws window cells`);
      const shed = buildFeatureChunk([hall({ industrial: 'shed' })], look, 'walls', streets);
      assert.ok(!usesBay(shed), `${look}: the shed draws no bay cells`);
      const b = meshBuildingFor(hall({ industrial: 'shed' }), look)!;
      assert.ok(b.bare && b.industrial?.kind === 'shed' && !b.shop && !b.shopfront && !b.extras);
      const tank = meshBuildingFor(hall({ industrial: 'tank' }), look)!;
      assert.ok(tank.bare && tank.industrial?.kind === 'tank' && !tank.roof && !tank.flatRoof);
      const office = meshBuildingFor(hall({ industrial: 'office' }), look)!;
      assert.ok(!office.bare && office.layers && BAY_ENTRIES[office.layers.ground].kind === 'ground' && !office.shop);
    }
  } finally { delete g.__canalRecallIndustrialKit; }
});
