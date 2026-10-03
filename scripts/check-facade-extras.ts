// Facade extras: every component builds finite, unit-normal, in-frame geometry on a typical wall of
// each of its styles; door items need a door; choices are deterministic; the triangle budgets hold;
// ornaments are all-or-nothing; every component turns up in a sample city; extras only exist in the
// near chunk.
import assert from 'node:assert/strict';
import { ExtraSink, EXTRA_BUDGET, ORNAMENT_COMPONENTS, ROOF_COMPONENTS, WALL_COMPONENTS, COMPONENT_COUNT, chanceFor, wallExtras, type ExtraContext } from '../src/canalRecall/facadeExtras.ts';
import { bayLookOpenings, proceduralOpenings } from '../src/canalRecall/facadeOpenings.ts';
import { doorSpan, windowSpans } from '../src/canalRecall/facadeOrnaments.ts';
import { buildChunk, type MeshBuilding } from '../src/canalRecall/threeBuildingMesh.ts';
import type { FacadeStyle } from '../src/canalRecall/genericFacades.ts';

const STYLES: FacadeStyle[] = ['canal', 'c19', 'school', 'postwar', 'modern', 'tower'];
const wall = (style: ExtraContext['style'], id = 'h1', over: Partial<ExtraContext> = {}): ExtraContext => ({
  id, style, wallKey: '0,0', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 10 }, base: 0, top: 14,
  layout: { bays: 2, bayWidthM: 5, groundM: 3.3, storeys: 3, storeyM: 3.1, doorBays: [0] }, wallHex: '#a4523b', accentHex: '#ffffff', groundLevel: true, ...over,
});
const finite = (s: ExtraSink, what: string) => {
  for (const t of s.tris) { assert.ok(t.p.flat().every(Number.isFinite), `${what}: finite`); assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-6, `${what}: unit normal`); }
};
assert.ok(COMPONENT_COUNT >= 70, `component count ${COMPONENT_COUNT}`);
assert.equal(new Set([...WALL_COMPONENTS, ...ROOF_COMPONENTS].map(c => c.id)).size, COMPONENT_COUNT, 'unique ids');

// Openings follow the painters (bayTextures.ts / facadeCells.ts).
const two = Array.from({ length: 64 }, (_, i) => `b${i}`).map(id => bayLookOpenings(id, 'canal')).find(o => o.upper.axes.length === 2)!;
assert.deepEqual(two.upper.axes, [0.25, 0.75], 'two bay-look canal windows on the quarter axes');
assert.ok(Math.abs(two.upper.sill - 60 / 310) < 1e-9 && Math.abs(two.upper.head - 248 / 310) < 1e-9, 'bay-look window from 0.19 to 0.80 of the storey');
assert.ok(new Set(Array.from({ length: 64 }, (_, i) => bayLookOpenings(`b${i}`, 'canal').upper.axes.length)).size >= 2, 'bay-look window count varies by house');
assert.deepEqual(proceduralOpenings('c19').upper.axes, [0.5], 'one tall c19 window per bay');
assert.ok(proceduralOpenings('school').ribbon, 'procedural School windows are ribbons');

// Every wall component, on every style it claims.
const DOOR_ITEMS = ['stoop', 'stoop-railing', 'double-stoop', 'gable-stone', 'door-pediment', 'door-canopy', 'door-lantern', 'entrance-slab', 'door-surround', 'brick-door-arch', 'portiek'];
for (const comp of WALL_COMPONENTS) {
  const live = comp.styles.filter(st => chanceFor(comp.p, st) > 0);
  assert.ok(live.length > 0, `${comp.id} is used by at least one style`);
  for (const style of live) {
    const c = wall(style), sink = new ExtraSink(9999);
    comp.build(c, sink, 0.4);
    assert.ok(sink.tris.length > 0, `${comp.id} builds geometry on a ${style} wall`);
    finite(sink, comp.id);
    // In frame: along the wall (a hair past its ends), out at most a bike's length, from the
    // pavement to the roofline plus the component's declared rise.
    // Ornaments stay on their own wall; furniture (a double stoop, a bench) may overhang the end a little.
    const rise = comp.rise ?? 0.6, slack = ORNAMENT_COMPONENTS.includes(comp) ? 0.06 : 0.4;
    for (const t of sink.tris) for (const p of t.p) {
      const along = p[0], out = -p[1];
      assert.ok(along >= -slack && along <= c.f.len + slack, `${comp.id}/${style}: along ${along}`);
      assert.ok(out >= -0.1 && out <= 2.0, `${comp.id}/${style}: out ${out}`);
      assert.ok(p[2] >= -0.01 && p[2] <= c.top + rise + 1e-6, `${comp.id}/${style}: height ${p[2]}`);
    }
  }
  if (DOOR_ITEMS.includes(comp.id)) {
    const sink = new ExtraSink(9999);
    comp.build(wall(live[0], 'h1', { layout: { ...wall(live[0]).layout, doorBays: [] } }), sink, 0.4);
    assert.equal(sink.tris.length, 0, `${comp.id} needs a door`);
  }
}
// User report 2026-10-03 (Nassaukade, screenshots): heavy cornices and stray objects by the stoops.
{
  const outOf = (id: string, style: FacadeStyle, over: Partial<ExtraContext> = {}) => {
    const sink = new ExtraSink(9999); WALL_COMPONENTS.find(c => c.id === id)!.build(wall(style, 'h1', over), sink, 0.4);
    return { sink, out: Math.max(0, ...sink.tris.flatMap(t => t.p.map(p => -p[1]))) };
  };
  for (const id of ['kroonlijst', 'console-cornice', 'cornice-brackets']) assert.ok(outOf(id, 'c19').out <= 0.42, `${id} projects at most 0.42 m (${outOf(id, 'c19').out})`);
  assert.equal(outOf('geveltuin', 'canal', { shopfront: true }).sink.tris.length, 0, 'no facade garden in front of a shop window');
  assert.ok(Math.max(...outOf('geveltuin', 'canal').sink.tris.flatMap(t => t.p.map(p => p[2]))) <= 1.15, 'facade garden plants stay low (no green posts)');
  // The light-well railing is bars, not a plate: no triangle wider than a rail is 0.75 m tall.
  const well = outOf('basement-well', 'canal').sink;
  assert.ok(well.tris.every(t => { const xs = t.p.map(p => p[0]), zs = t.p.map(p => p[2]); return Math.max(...xs) - Math.min(...xs) < 0.1 || Math.max(...zs) - Math.min(...zs) < 0.1; }), 'basement railing is openwork');
}
for (const comp of ROOF_COMPONENTS) {
  const sink = new ExtraSink(9999);
  comp.build({ id: 'r', style: comp.styles[0], rect: { cx: 0, cy: 0, ux: 1, uy: 0, len: 12, wid: 9 }, z: 14, wallHex: '#a4523b' }, sink, 0.4);
  assert.ok(sink.tris.length > 0, `${comp.id} builds geometry on a roof`);
  finite(sink, comp.id);
  for (const t of sink.tris) for (const p of t.p) assert.ok(p[2] >= 14 - 1e-6, `${comp.id}: on the roof`);
}

// Dressing lands on the openings: sills under the windows, the surround round the door.
{
  const c = wall('canal', 'b3'), w = windowSpans(c, 0), d = doorSpan(c)!;
  assert.equal(w.length, 2 * bayLookOpenings('b3', 'canal').upper.axes.length, 'a window span per painted window');
  assert.ok(w.every(s => s.z0 > c.layout.groundM && s.z1 < c.layout.groundM + c.layout.storeyM), 'first-storey windows inside the first storey');
  assert.ok(d.x > 0 && d.x < 5 && d.z1 < c.layout.groundM, 'door inside its bay and the ground floor');
}

// Ornaments are all or nothing: a cornice that does not fit is dropped whole.
{
  const kroon = ORNAMENT_COMPONENTS.find(c => c.id === 'kroonlijst')!, full = new ExtraSink(9999);
  kroon.build(wall('canal'), full, 0.4);
  const small = new ExtraSink(full.tris.length - 1);
  small.begin(); kroon.build(wall('canal'), small, 0.4);
  assert.equal(small.commit(), false, 'kroonlijst over budget is refused');
  assert.equal(small.tris.length, 0, 'and leaves nothing behind');
}

// Deterministic and budgeted.
const a = new ExtraSink(EXTRA_BUDGET.building), b = new ExtraSink(EXTRA_BUDGET.building);
assert.deepEqual(wallExtras(wall('canal', 'x7'), a), wallExtras(wall('canal', 'x7'), b));
let maxStreet = 0, maxSide = 0;
const seen = new Set<string>();
for (let i = 0; i < 3000; i++) {
  const style = STYLES[i % 6], period = i % 7 === 0 ? 'c19' as const : undefined;
  const s = new ExtraSink(EXTRA_BUDGET.building), streetWall = wall(style, `b${i}`, { period, layout: { ...wall(style).layout, storeys: 2 + (i % 5), bays: 1 + (i % 3) }, f: { ...wall(style).f, len: 5 + (i % 4) * 3 } });
  for (const id of wallExtras(streetWall, s)) seen.add(id);
  maxStreet = Math.max(maxStreet, s.tris.length);
  const back = new ExtraSink(EXTRA_BUDGET.building);
  for (const id of wallExtras({ ...streetWall, wallKey: '9,9', layout: { ...streetWall.layout, doorBays: [] }, streetSide: false }, back)) seen.add(id);
  maxSide = Math.max(maxSide, back.tris.length);
}
assert.ok(maxStreet <= EXTRA_BUDGET.wall, `street wall budget holds (${maxStreet})`);
assert.ok(maxSide <= EXTRA_BUDGET.sideWall, `side wall budget holds (${maxSide})`);
const unseen = WALL_COMPONENTS.map(c => c.id).filter(id => !seen.has(id));
assert.deepEqual(unseen, [], `every wall component appears in a 3000-wall sample`);

// A 19th-century house laid out as a canal house (the bay looks) gets 19th-century ornament and keeps canal furniture.
{
  const got = new Set<string>();
  for (let i = 0; i < 400; i++) for (const id of wallExtras(wall('canal', `p${i}`, { period: 'c19' }), new ExtraSink(EXTRA_BUDGET.building))) got.add(id);
  for (const id of ['iron-balconies', 'stucco-hoods', 'console-cornice', 'stoop', 'hoist-beam']) assert.ok(got.has(id), `c19 period on a canal layout gets ${id}`);
  assert.ok(!got.has('warehouse-shutters'), 'but not canal-only ornament');
}

// Walls mode carries no extras; extras mode carries only extras, within the building budget.
const origin = { lng: 4.9, lat: 52.37 }, kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
const ring = [[0, 0], [10, 0], [10, 12], [0, 12], [0, 0]].map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
const houses: MeshBuilding[] = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, polygons: [[ring]], heightM: 14, minHeightM: 0, style: 'canal', wallHex: '#a4523b', plainLayer: 3, lid: { hex: '#888888', flatLayer: 7 }, extras: true }));
const walls = buildChunk(houses, origin), extras = buildChunk(houses, origin, 'extras'), plain = buildChunk(houses.map(h => ({ ...h, extras: false })), origin);
assert.equal(walls.vertexCount, plain.vertexCount, 'walls mode ignores extras');
assert.ok(extras.vertexCount > 0, 'extras mode has extras');
const tris = extras.vertexCount / 3 | 0;
assert.ok(tris <= 40 * EXTRA_BUDGET.building, `building budget holds (${tris} for 40)`);
console.log(`facade extras: ok (${COMPONENT_COUNT} components, ${ORNAMENT_COMPONENTS.length} ornaments, ${tris} triangles for 40 houses; max street wall ${maxStreet}, side wall ${maxSide})`);
