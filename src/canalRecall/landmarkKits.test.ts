// Kit review 1 fixes (2026-10-24, docs/handoffs/kit-gaps.md "Landmark kits (review 1)"): every kit draws geometry,
// school walls come from a measurement or the BAG year's period palette (never one fixed beige), and pre-1940 schools
// the 3DBAG says are roofed get a hipped roof round their footprint.
//   node --import tsx --test src/canalRecall/landmarkKits.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { HIP_MAX_PITCH_DEG, KITS, hipAround, kitGeometry, kitIds, simplifyRing, type PartInput } from './landmarkKits.js';
import { PUBLIC_WALL, publicKit, schoolHipRoof, schoolWall, SCHOOL_HIP_MIN_EAVES_M, type SchoolFacts } from './publicBuildings.js';
import { PUBLIC_BUILDINGS } from './publicBuildingData.js';
import { PUBLIC_FACTS } from './publicBuildingFacts.js';
import { PERIOD_WALLS, cityWallTint } from './look/palette.js';

type V2 = [number, number];
const rect = (w: number, d: number, x = 0, y = 0): V2[] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x, y]];
const L: V2[] = [[0, 0], [40, 0], [40, 12], [12, 12], [12, 30], [0, 30], [0, 0]];
const facts = (over: Partial<SchoolFacts>): SchoolFacts => ({ year: 1931, roof: 3, eavesM: 5.6, ridgeM: 14.9, wallHex: null, roofFits: true, ...over });

test('every kit in KITS draws triangles of its own once its parts load', () => {
  for (const ring of [rect(30, 18), L]) {
    for (const kit of KITS) {
      const parts = new Map<string, PartInput>(kitIds(kit).map(id => [id, { id, ring, minHeightM: 0, heightM: 14 }]));
      const tris = kitGeometry(kit, parts).reduce((n, g) => n + g.tris.length, 0);
      assert.ok(tris > 0, `${kit.name}: ${tris} triangles`);
    }
  }
});

test('a plain cinema or worship body draws its coping and plinth on the host walls', () => {
  const cinema = KITS.find(k => k.name === 'Generic cinema NL.IMBAG.Pand.0363100012092742')!;
  assert.ok(cinema.trim?.coping && cinema.trim.plinth, 'pre-1960 body: stone coping and plinth');
  const ring = rect(30, 18), id = cinema.body![0];
  const tris = kitGeometry(cinema, new Map([[id, { id, ring, minHeightM: 0, heightM: 11.2 }]]))[0].tris;
  const zs = tris.flatMap(t => t.p.map(p => p[2]));
  assert.equal(Math.max(...zs), 11.2, 'the coping tops the wall');
  assert.equal(Math.min(...zs), 0, 'the plinth stands on the ground');
  assert.ok(tris.every(t => Math.abs(t.n[2]) < 1e-9), 'bands are vertical');
  const modern = KITS.find(k => k.name === 'Generic church NL.IMBAG.Pand.0363100012123194')!;
  assert.ok(modern.trim?.coping && !modern.trim.plinth, 'a 1967 body gets a fascia only');
});

test('school walls: measured colour, else the BAG year period palette, never the old fixed beige', () => {
  const measured = schoolWall('x', 'm', facts({ year: 1980, wallHex: '#5c504a' }));
  assert.deepEqual(measured, { hex: cityWallTint('#5c504a'), source: 'measured' });
  const white = schoolWall('x', 'm', facts({ year: 1980, wallHex: '#e8e6df' }));
  assert.equal(white.source, 'measured');
  assert.notEqual(white.hex, cityWallTint('#e8e6df'), 'a pale wall is not pulled into the brick range');
  const period = schoolWall('NL.IMBAG.Pand.1', 'm', facts({ year: 1975 }));
  assert.equal(period.source, 'period');
  assert.ok(PERIOD_WALLS.photo.modern!.includes(period.hex));
  assert.ok(PERIOD_WALLS.photo.school!.includes(schoolWall('NL.IMBAG.Pand.1', 'e', facts({ year: 1931 })).hex));
  assert.deepEqual(schoolWall('w1', 'm', undefined), { hex: PUBLIC_WALL.s.m, source: 'era' }, 'only a school with no facts at all keeps the era brick');
  // The published list: every school has facts, so none is left on the fixed era colour, and the walls vary.
  const schools = PUBLIC_BUILDINGS.filter(e => e[1] === 's');
  const factIds = new Set(PUBLIC_FACTS.map(f => f[0]));
  assert.ok(schools.every(e => factIds.has(e[0])), 'every school has a facts row');
  const walls = schools.map(e => publicKit(e).wall!.hex);
  assert.equal(walls.filter(h => h === PUBLIC_WALL.s.m).length, 0, 'no school wears the fixed beige');
  assert.ok(new Set(walls).size > 60, `walls vary (${new Set(walls).size} distinct)`);
  assert.ok(PUBLIC_FACTS.filter(f => f[5]).length > 120, 'most schools are measured from their own crops');
});

test('pre-1940 schools under a 3DBAG ridge get a hipped roof; others keep theirs', () => {
  const hip = schoolHipRoof(facts({}), 12.6)!;
  assert.ok(hip, 'De Weidevogel (1931, eaves 5.6, ridge 14.9)');
  assert.ok(Math.abs(hip.eavesM - 7.2) < 0.11, `main eaves from the 70th percentile: ${hip.eavesM}`);
  assert.ok(Math.abs(hip.eavesM + hip.riseM - 14.9) < 0.11, 'up to the 3DBAG ridge');
  assert.equal(schoolHipRoof(facts({ eavesM: 3.5, ridgeM: 16.9 }), 12.7)!.eavesM, SCHOOL_HIP_MIN_EAVES_M, 'a porch eaves is raised to two storeys');
  assert.equal(schoolHipRoof(facts({ year: 1955 }), 12.6), null, 'post-war: no hip');
  assert.equal(schoolHipRoof(facts({ ridgeM: null }), 12.6), null, 'no 3DBAG ridge: flat');
  assert.equal(schoolHipRoof(facts({ eavesM: 13.6, ridgeM: 14.5 }), 13.7), null, 'a parapet bump is no roof');
  // The published kits: rows 14 and 19 of the review sheet are hipped, the flat Amsterdam School pair (37, 38) is not.
  const kit = (id: string) => KITS.find(k => k.name === `Generic school NL.IMBAG.Pand.${id}`)!;
  for (const id of ['0363100012086684', '0363100012064693', '0363100012068625']) assert.equal(kit(id).halls![0].hip, true, `${id} hipped`);
  for (const id of ['0363100012088641', '0363100012118525', '0363100012072950']) assert.equal(kit(id).halls![0].hip, undefined, `${id} flat`);
  const pre = kit('0363100012086684').halls![0];
  assert.ok(pre.windows!.rows.every(r => r.z1 <= pre.eavesM), 'windows stay under the lowered eaves');
});

test('hipAround roofs an L plan wing by wing, within the eaves and ridge, and lowers a narrow wing', () => {
  const tris = hipAround(L, 7, 5)!;
  assert.ok(tris.length > 0);
  const zs = tris.flatMap(t => t.p.map(p => p[2]));
  assert.equal(Math.min(...zs), 7);
  assert.ok(Math.max(...zs) <= 12 + 1e-9);
  assert.ok(tris.every(t => t.n[2] > 0 && Math.abs(Math.hypot(...t.n) - 1) < 1e-9), 'every face looks up, unit normals');
  // A 6 m wide strip cannot take a 10 m rise at 50 degrees: the rise is lowered to the steepest pitch that fits.
  const narrow = hipAround(rect(40, 6), 6, 10)!;
  const top = Math.max(...narrow.flatMap(t => t.p.map(p => p[2])));
  assert.ok(top < 16 && top - 6 <= 3 * Math.tan((HIP_MAX_PITCH_DEG * Math.PI) / 180) + 1e-6, `narrow wing ridge ${top}`);
  // A 0.8 m jog in a BAG outline is smoothed away before the ring is set in.
  const jog: V2[] = [[0, 0], [20, 0], [20, 0.8], [40, 0.8], [40, 14], [0, 14], [0, 0]];
  assert.equal(simplifyRing(jog, 1).length, 4);
  assert.ok(hipAround(jog, 6, 5));
});
