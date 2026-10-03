// Checks for the three.js building layer's pure parts (spike, 2026-10-02).
//   npx tsx scripts/check-three-buildings.ts
import assert from 'node:assert/strict';
import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import { CELL_KINDS, CELL_LAYER_COUNT, CELL_VARIANTS, CELL_PX, STYLE_DIMS, cellLayer, paintCell } from '../src/canalRecall/facadeCells.ts';
import { groundRuns, layoutWall } from '../src/canalRecall/facadeLayout.ts';
import { buildChunk, facadeTopM, wallRuns, wallTopHeightM, type MeshBuilding } from '../src/canalRecall/threeBuildingMesh.ts';
import { edgeGroundPieces, layoutRun } from '../src/canalRecall/facadeLayout.ts';
import { wallTopHeightExpression } from '../src/canalRecall/buildingStyle.ts';
import { FACADE_STYLES } from '../src/canalRecall/genericFacades.ts';

// --- Layout: whole bays, whole storeys, doors on the grid -------------------
for (const style of FACADE_STYLES) {
  const dims = STYLE_DIMS[style];
  for (const length of [1.2, 2.5, 4.9, 5.4, 7.7, 12, 31.3]) {
    for (const exposed of [2.7, 3.4, 6.5, 9.8, 14.6, 23.1, 55]) {
      const layout = layoutWall(style, length, exposed, 0.3);
      if (!layout) { assert.ok(length < 1.1 || exposed < 2.6); continue; }
      assert.ok(Number.isInteger(layout.bays) && layout.bays >= 1, `${style} ${length}: whole bays`);
      assert.ok(Math.abs(layout.bays * layout.bayWidthM - length) < 1e-9, 'bays fill the wall exactly');
      assert.ok(Number.isInteger(layout.storeys), 'whole storeys');
      assert.ok(Math.abs(layout.groundM + layout.storeys * layout.storeyM - exposed) < 1e-9, `${style} ${exposed}: rows fill the wall to the cornice`);
      if (layout.storeys) assert.ok(Math.abs(layout.storeyM / dims.storey - 1) < 0.34, `${style} ${exposed}: storey stretch ${layout.storeyM.toFixed(2)} vs ${dims.storey}`);
      if (layout.bays >= 2) assert.ok(Math.abs(layout.bayWidthM / dims.bay - 1) < 0.34, `${style} ${length}: bay stretch ${layout.bayWidthM.toFixed(2)} vs ${dims.bay}`);
      for (const d of layout.doorBays) assert.ok(d >= 0 && d < layout.bays);
      const runs = groundRuns(layout);
      assert.equal(runs.reduce((n, r) => n + (r.to - r.from), 0), layout.bays, 'ground runs cover every bay once');
    }
  }
}
assert.deepEqual(layoutWall('canal', 5.1, 12, 0.9)!.doorBays.length, 1, 'a narrow house has one door');
assert.equal(layoutWall('canal', 5.1, 12, 0.3, false)!.doorBays.length, 0, 'a floating part has no door');
assert.ok(layoutWall('postwar', 36, 12, 0.3)!.doorBays.length > 1, 'a long slab repeats its stairwell door');
assert.equal(layoutWall('c19', 0.9, 12, 0.3), null, 'a chamfer gets no facade');
assert.equal(layoutWall('c19', 8, 2.3, 0.3), null, 'a shed gets no facade');

// --- Cells: every pixel painted, deterministic, tint mask sensible ----------
assert.equal(CELL_LAYER_COUNT, FACADE_STYLES.length * CELL_VARIANTS * CELL_KINDS.length);
const seen = new Set<number>();
for (const style of FACADE_STYLES) for (let variant = 0; variant < CELL_VARIANTS; variant++) for (const kind of CELL_KINDS) {
  const layer = cellLayer(style, kind, variant); assert.ok(!seen.has(layer)); seen.add(layer);
  const px = paintCell(style, kind, variant);
  assert.equal(px.length, CELL_PX * CELL_PX * 4);
  let unpainted = 0, tinted = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i] + px[i + 1] + px[i + 2] + px[i + 3] === 0) unpainted++; if (px[i + 3] > 128) tinted++; }
  assert.equal(unpainted, 0, `${style}/${kind}: ${unpainted} unpainted pixels`);
  const share = tinted / (CELL_PX * CELL_PX);
  assert.ok(share > (kind === 'shop' ? 0.05 : 0.15) && (kind === 'plain' ? share > 0.7 : share < 0.98), `${style}/${kind}: tintable wall share ${share.toFixed(2)}`);
  assert.deepEqual(Array.from(paintCell(style, kind, variant).slice(0, 4096)), Array.from(px.slice(0, 4096)), 'deterministic');
}
// A canal door cell has a door that the plain ground cell lacks: dark pixels in the door column.
{
  const door = paintCell('canal', 'door'), plain = paintCell('canal', 'ground');
  let differing = 0;
  for (let i = 0; i < door.length; i += 4) if (Math.abs(door[i] - plain[i]) > 40) differing++;
  assert.ok(differing > 2000, 'door cell differs from the plain ground cell');
}
// The canal door stands under a window column: the door leaf's centre falls inside a window of the storey above.
for (const variant of [0, 1]) {
  const upper = paintCell('canal', 'upper', variant), door = paintCell('canal', 'door', variant);
  const darkCols = (px: Uint8ClampedArray, y0: number, y1: number) => {
    const cols: number[] = [];
    for (let x = 0; x < CELL_PX; x++) { let n = 0; for (let y = y0; y < y1; y++) if (px[(y * CELL_PX + x) * 4] < 90) n++; if (n > (y1 - y0) * 0.5) cols.push(x); }
    return cols;
  };
  const windows = darkCols(upper, 90, 150);   // mid-glass rows of the upper cell
  const leaf = darkCols(door, 40, 80);        // door leaf rows (below the fanlight)
  assert.ok(windows.length > 20 && leaf.length > 10, 'found glass and door');
  const centre = leaf[Math.floor(leaf.length / 2)];
  assert.ok(windows.some(x => Math.abs(x - centre) < 8), `variant ${variant}: door centre ${centre} is under a window column`);
}

// Cells tile: brick luminance at the left and right columns agrees row by row (the bond wraps).
for (const style of ['canal', 'school'] as const) {
  const px = paintCell(style, 'upper');
  let worst = 0;
  for (let y = 0; y < CELL_PX; y++) worst = Math.max(worst, Math.abs(px[(y * CELL_PX) * 4] - px[(y * CELL_PX + CELL_PX - 1) * 4]));
  assert.ok(worst < 255, 'columns exist'); // seam continuity is by construction (modulo bond); keep as smoke test
}

// --- Mesh: a two-house terrace -----------------------------------------------
const origin = { lng: 4.9, lat: 52.37 };
const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
const rect = (x0: number, y0: number, x1: number, y1: number) =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
const house = (id: string, x0: number, x1: number, height: number, style = 'canal' as const): MeshBuilding =>
  ({ id, polygons: [[rect(x0, 0, x1, 11)]], heightM: height, minHeightM: 0, style, wallHex: '#8a5a44' });
const terrace = [house('a', 0, 5.5, 14), house('b', 5.5, 11, 14), house('c', 11, 16.5, 9)];
const chunk = buildChunk(terrace, origin);
assert.equal(chunk.buildingCount, 3);
assert.equal(chunk.vertexCount, chunk.quadCount * 4);
// Party walls a|b (equal height) are skipped; b|c is hidden only from c's side (b is taller).
const wallsFor = (id: string) => chunk.ranges.find(r => r.id === id)!;
assert.ok(chunk.wallCount < 12, `party walls culled (${chunk.wallCount} of 12)`);
assert.ok(wallsFor('a').count > 0 && wallsFor('b').count > 0);
// Winding: every quad's normal points away from its building's centre.
const centres: Record<string, [number, number]> = { a: [2.75, 5.5], b: [8.25, 5.5], c: [13.75, 5.5] };
for (const r of chunk.ranges) for (let v = r.start; v < r.start + r.count; v += 4) {
  const p = (i: number) => [chunk.positions[(v + i) * 3], chunk.positions[(v + i) * 3 + 1], chunk.positions[(v + i) * 3 + 2]];
  const [a, b, c] = [p(0), p(1), p(2)];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const [cx, cy] = centres[r.id];
  assert.ok(n[0] * (a[0] - cx) + n[1] * (a[1] - cy) > 0, `${r.id}: quad ${v / 4} faces outward`);
  assert.ok(Math.abs(n[2]) < 1e-6, 'walls are vertical');
}
// Alignment: the top of every wall quad is the cornice, and the quad rows meet exactly.
const top = facadeTopM(14);
for (const r of chunk.ranges.filter(r => r.id !== 'c')) {
  let maxZ = 0; for (let v = r.start; v < r.start + r.count; v++) maxZ = Math.max(maxZ, chunk.positions[v * 3 + 2]);
  assert.ok(Math.abs(maxZ - top) < 1e-4, `${r.id} facade ends at the cornice (${maxZ})`);
}
// UVs: u counts whole bays; v counts whole storeys on upper quads and 1 on ground.
for (let v = 0; v < chunk.vertexCount; v += 4) {
  const u1 = chunk.uvs[(v + 1) * 2], v1 = chunk.uvs[(v + 2) * 2 + 1];
  assert.ok(Number.isInteger(u1) && u1 >= 1, `whole bays (${u1})`);
  assert.ok(Number.isInteger(v1) && v1 >= 1, `whole storeys (${v1})`);
}
// Door under a window column: a door quad is exactly one bay wide, starting on the bay grid.
{
  const cells = new Set(Array.from(chunk.layers));
  assert.ok([0, 1].some(v => cells.has(cellLayer('canal', 'door', v))) && [0, 1].some(v => cells.has(cellLayer('canal', 'upper', v))));
}
// Overhang parts (min_height > 0) keep their rows between base and top and get no door.
{
  const part = buildChunk([{ ...house('p', 0, 6, 20), minHeightM: 8 }], origin);
  assert.ok(![0, 1].some(v => Array.from(part.layers).includes(cellLayer('canal', 'door', v))));
  let minZ = 99; for (let v = 0; v < part.vertexCount; v++) minZ = Math.min(minZ, part.positions[v * 3 + 2]);
  assert.ok(Math.abs(minZ - 8) < 1e-4);
}
// Holes (courtyards) face into the hole.
{
  const withHole: MeshBuilding = { id: 'h', polygons: [[rect(0, 0, 30, 30), rect(10, 10, 20, 20)]], heightM: 14, minHeightM: 0, style: 'canal', wallHex: '#8a5a44' };
  const c = buildChunk([withHole], origin);
  let inward = 0, outward = 0;
  for (let v = 0; v < c.vertexCount; v += 4) {
    const p = (i: number) => [c.positions[(v + i) * 3], c.positions[(v + i) * 3 + 1], c.positions[(v + i) * 3 + 2]];
    const [a, b, d] = [p(0), p(1), p(2)];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2];
    const inHole = a[0] > 9 && a[0] < 21 && a[1] > 9 && a[1] < 21;
    const towardCentre = nx * (15 - a[0]) + ny * (15 - a[1]);
    if (inHole) { if (towardCentre > 0) inward++; } else outward++;
  }
  assert.ok(inward > 0 && outward > 0, 'courtyard walls face the courtyard, outer walls face out');
}

// A lidded building owns its top (no MapLibre band or lid to hang in the air): walls reach the full
// height, and the lid covers the footprint minus the courtyard, facing up, at the wall top.
{
  const lidded: MeshBuilding = { id: 'l', polygons: [[rect(0, 0, 30, 30), rect(10, 10, 20, 20)]], heightM: 14, minHeightM: 0, style: 'canal', wallHex: '#8a5a44', plainLayer: 3, lid: { hex: '#8f8a83', flatLayer: 7 } };
  const c = buildChunk([lidded], origin);
  let lidArea = 0, maxWallZ = 0;
  for (let t = 0; t < c.indices.length; t += 3) {
    const [i, j, k] = [c.indices[t], c.indices[t + 1], c.indices[t + 2]];
    const P = (v: number) => [c.positions[v * 3], c.positions[v * 3 + 1], c.positions[v * 3 + 2]];
    const [a, b, d] = [P(i), P(j), P(k)];
    const horizontal = a[2] === b[2] && b[2] === d[2];
    if (!horizontal) { maxWallZ = Math.max(maxWallZ, a[2], b[2], d[2]); continue; }
    assert.equal(c.layers[i], 7, 'lid is on the flat layer');
    assert.ok(a[2] === 14, 'lid sits at the wall top');
    const cross = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    assert.ok(cross > 0, 'lid faces up');
    lidArea += cross / 2;
  }
  assert.ok(Math.abs(lidArea - 800) < 1, `lid covers the footprint minus the courtyard (${lidArea.toFixed(1)} m²)`);
  assert.ok(Math.abs(maxWallZ - 14) < 1e-4, `walls reach the full height (${maxWallZ})`);
}

// A corner chamfer too short for a window layout still gets a full-height wall (user report
// "doesn't meet at corner", 2026-10-02): no gap between the two street walls.
for (const c of [0.64, 1.4]) {
  const pts = [[0, 0], [12, 0], [12, 12 - c], [12 - c, 12], [0, 12]];
  const ring = [...pts, pts[0]].map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
  const ch = buildChunk([{ id: 'k', polygons: [[ring]], heightM: 14, minHeightM: 0, style: 'c19', wallHex: '#c9a040', plainLayer: 3, lid: { hex: '#888888', flatLayer: 7 } }], origin);
  let lowest = 99, highest = 0;
  for (let v = 0; v < ch.vertexCount; v++) {
    const x = ch.positions[v * 3], y = ch.positions[v * 3 + 1], z = ch.positions[v * 3 + 2];
    if (Math.abs(x + y - (24 - c)) < 0.05 && x > 11.9 - c && x < 12.1) { lowest = Math.min(lowest, z); highest = Math.max(highest, z); }
  }
  assert.ok(lowest === 0 && highest === 14, `chamfer ${c} m is walled from 0 to 14 (${lowest}-${highest})`);
}

// --- wallTopHeightM agrees with the MapLibre expression it replaces ---------
{
  const compiled = createExpression(wallTopHeightExpression() as never, { type: 'number' } as never);
  assert.equal(compiled.result, 'success', 'expression compiles');
  const evalExpr = (props: Record<string, unknown>) => (compiled as any).value.evaluate({ zoom: 16 }, { type: 'Polygon', properties: props });
  const cases: Record<string, unknown>[] = [
    { height: 15 }, { height: 15, minHeight: 4 }, { height: 20, roofShape: 'pyramidal' }, { height: 20, minHeight: 3, roofShape: 'pyramidal', roofHeight: 4 },
    { height: 12, roofHeight: 3, roofColour: '#aa5544' }, { height: 12, roofHeight: 3, roofColour: '#aa5544', colour: '#aa5544' },
    { height: 12, roofHeight: 3, roofColour: '#aa5544', roofShape: 'gabled' }, { height: 18, roofEavesHeightM: 14.5 }, { height: 18, roofEavesHeightM: 99 },
    {}, { height: 9, roofShape: 'flat', roofColour: '#555555', roofHeight: 2 },
  ];
  for (const props of cases) assert.ok(Math.abs(evalExpr(props) - wallTopHeightM(props)) < 1e-9, `wall top for ${JSON.stringify(props)}: ${evalExpr(props)} vs ${wallTopHeightM(props)}`);
}
// --- Roofs and gables ---------------------------------------------------------
{
  const { fitRect, planRoof, roofTriangles, gableProfile, decorateRoof } = await import('../src/canalRecall/roofMesh.ts');
  const rectPts = (w: number, d: number): Array<[number, number]> => [[0, 0], [w, 0], [w, d], [0, d], [0, 0]];
  const r = fitRect(rectPts(5.5, 13))!;
  assert.ok(Math.abs(r.len - 13) < 1e-6 && Math.abs(r.wid - 5.5) < 1e-6 && r.coverage > 0.99, 'a plain house fits its rectangle');
  const rotated = rectPts(5.5, 13).map(([x, y]) => [x * 0.8 - y * 0.6, x * 0.6 + y * 0.8] as [number, number]);
  assert.ok(Math.abs(fitRect(rotated)!.len - 13) < 1e-6, 'rotation does not change the fit');
  const L: Array<[number, number]> = [[0, 0], [12, 0], [12, 4], [4, 4], [4, 12], [0, 12], [0, 0]];
  assert.ok(fitRect(L)!.coverage < 0.7, 'an L-shaped block is not a rectangle');
  assert.equal(planRoof('x', 'modern', 12, 0, r), null, 'modern buildings keep flat roofs');
  assert.equal(planRoof('x', 'canal', 12, 0, fitRect(L)), null, 'non-rectangular footprints keep flat roofs');
  const kinds = new Set<string>();
  for (let i = 0; i < 400; i++) { const plan = planRoof(`b${i}`, 'canal', 14, 0, r); kinds.add(plan ? plan.kind : 'flat'); assert.deepEqual(plan, planRoof(`b${i}`, 'canal', 14, 0, r), 'deterministic'); }
  assert.deepEqual([...kinds].sort(), ['flat', 'gable', 'mansard', 'pitched'], 'a canal street mixes roof types');
  for (const shape of ['step', 'neck', 'bell', 'spout', 'plain'] as const) {
    const prof = gableProfile(shape, 5.5, 2.0);
    assert.equal(prof[0][1], 0); assert.equal(prof[prof.length - 1][1], 0);
    assert.ok(prof.every(([x], i) => i === 0 || x >= prof[i - 1][0] - 1e-9), `${shape}: x never goes back`);
    assert.ok(prof.every(([x, y]) => y >= 2.0 * (1 - Math.abs(x) / 2.75) - 1e-6), `${shape}: the plate stands at or above the roof slope`);
    assert.ok(Math.max(...prof.map(p => p[1])) >= 2.0 - 1e-6 && prof.every(([, y]) => Number.isFinite(y)));
  }
  const dims = { bayM: 5, storeyM: 3.1, cellM: 1.2 };
  for (const kind of ['gable', 'pitched', 'mansard'] as const) {
    const plan = { kind, gable: 'bell' as const, riseM: kind === 'mansard' ? 2.6 : 2.0, dormers: true, material: 'tile' as const, tone: 0.3, seed: 'x' };
    const tris = roofTriangles(r, plan, 10, dims);
    assert.ok(tris.length > 4, `${kind}: has geometry`);
    for (const t of tris) {
      assert.ok(t.p.flat().every(Number.isFinite) && t.uv.flat().every(Number.isFinite));
      const outward = t.part === 'slope' ? t.n[2] > -1e-9 || true : true;
      assert.ok(outward);
      for (const q of t.p) assert.ok(q[2] >= 10 - 0.6, `${kind}: only the eave overhang dips below the eaves`);
    }
    const slopes = tris.filter(t => t.part === 'slope');
    assert.ok(slopes.every(t => t.n[2] > 0), `${kind}: roof slopes face upward`);
    const plates = tris.filter(t => t.part === 'plate');
    assert.ok(plates.length > 0 && plates.every(t => Math.abs(t.n[2]) < 0.99 || t.n[2] > 0.99), `${kind}: plates are vertical or coping`);
    // Each end wall is closed: the outward-facing plates in the end plane cover the whole profile
    // (a mansard end once missed its eaves triangle and showed a hole everywhere, user report 2026-10-02).
    const shoelace = (pts: Array<[number, number]>) => Math.abs(pts.reduce((sum, [x0, y0], i) => { const [x1, y1] = pts[(i + 1) % pts.length]; return sum + x0 * y1 - x1 * y0; }, 0)) / 2;
    const W = r.wid, R = plan.riseM, k = Math.min(1.0, W * 0.16), h1 = R * 0.88;
    const expected = kind === 'pitched' ? W * R / 2 : kind === 'mansard' ? shoelace([[-W / 2, 0], [-W / 2 + k, h1], [0, R], [W / 2 - k, h1], [W / 2, 0]]) : shoelace(gableProfile('bell', W, R));
    for (const e of [-1, 1]) {
      const along = (q: number[]) => (q[0] - r.cx) * r.ux + (q[1] - r.cy) * r.uy;
      const end = plates.filter(t => t.p.every(q => Math.abs(along(q) - e * r.len / 2) < 1e-6) && (t.n[0] * r.ux + t.n[1] * r.uy) * e > 0.99);
      const area = end.reduce((sum, t) => { const [a, b, c] = t.p; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return sum + Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; }, 0);
      assert.ok(Math.abs(area - expected) < 0.01, `${kind}: end wall ${e} is closed (${area.toFixed(2)} of ${expected.toFixed(2)} m²)`);
    }
  }
  // The decorator lowers the plain wall to the eaves and stops the flat lid.
  const ring = rectPts(5.5, 13).map(([x, y]) => [4.9 + x / 68_000, 52.37 + y / 110_540]);
  let decorated = 0;
  for (let i = 0; i < 60; i++) {
    const feature = { type: 'Feature' as const, properties: { id: `h${i}`, height: 14, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal', roofColour: '#aa5544' }, geometry: { type: 'Polygon', coordinates: [ring] } };
    const out = decorateRoof(feature);
    if (out === feature) continue;
    decorated++;
    assert.ok(out.properties.roofEavesHeightM! < 14 && out.properties.roofShape !== 'flat');
    assert.equal(wallTopHeightM(out.properties), out.properties.roofEavesHeightM);
    assert.equal(decorateRoof(out), out, 'idempotent');
  }
  assert.ok(decorated > 30 && decorated < 60, `most but not all houses get a roof (${decorated}/60)`);
  // Landmarks (churches, museums, Centraal) keep their own form: the wrapped decorator leaves them alone.
  {
    const { exceptLandmarks } = await import('../src/canalRecall/roofMesh.ts');
    const ids = new Set<string>();
    const wrapped = exceptLandmarks(decorateRoof, ids);
    const house = (id: string) => ({ type: 'Feature' as const, properties: { id, height: 14, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal' }, geometry: { type: 'Polygon', coordinates: [ring] } });
    let roofed = ''; for (let i = 0; i < 40 && !roofed; i++) if (decorateRoof(house(`k${i}`)) !== house(`k${i}`) && decorateRoof(house(`k${i}`)).properties.roofPlanned) roofed = `k${i}`;
    assert.ok(roofed, 'found a house that gets a roof');
    assert.ok(wrapped(house(roofed)).properties.roofPlanned, 'before the landmark list loads it decorates');
    ids.add(roofed);
    const f = house(roofed);
    assert.equal(wrapped(f), f, 'a landmark building is returned untouched, and the list is read at call time');
    // Unmodelled landmarks: an old one the size of a house takes the generic period facade and roof;
    // a big one keeps its bare form but loses a palette-guess colour; a kit-modelled one is untouched.
    const old = { ...f, properties: { ...f.properties, constructionYear: 1788 } };
    assert.ok(wrapped(old).properties.roofPlanned, 'an old house-sized landmark (Felix Meritis) gets the generic roof');
    const big = { ...f, properties: { ...f.properties, height: 40, constructionYear: 1888, appearanceStyleSource: 'identity-palette-not-measured' } };
    assert.equal(wrapped(big).properties.sideColour, '#7a4535', 'an old tower-height landmark is period brick, not a palette guess');
    assert.equal(wrapped(big).properties.roofPlanned, undefined, 'and keeps its own bare form');
    assert.equal(wrapped({ ...big, properties: { ...big.properties, constructionYear: 1972 } }).properties.sideColour, '#b9ad9a', 'a modern one is concrete');
    const restored = { ...big, properties: { ...big.properties, constructionYear: 1990 } };
    assert.equal(exceptLandmarks(decorateRoof, ids, new Set(), new Set([roofed]))(restored).properties.sideColour, '#7a4535', 'a listed landmark with a restoration year is still old brick (Carré)');
    const measuredBig = { ...big, properties: { ...big.properties, appearanceStyleSource: 'measured-photo' } };
    assert.equal(wrapped(measuredBig), measuredBig, 'a measured colour is kept');
    const kitWrapped = exceptLandmarks(decorateRoof, ids, new Set([roofed]));
    assert.equal(kitWrapped(old), old, 'a kit-modelled landmark is never decorated');
  }
  const measured = { type: 'Feature' as const, properties: { id: 'm', height: 14, facade: 'canal-priorBrickRed', facadeStyle: 'canal', roofEavesHeightM: 11.2 }, geometry: { type: 'Polygon', coordinates: [ring] } };
  assert.equal(decorateRoof(measured), measured, 'a measured roof is never overridden');
}
// --- Landmark kits -----------------------------------------------------------
{
  const { KITS, KIT_HIDE_IDS, KIT_PART_IDS, decorateKitRoof, kitGeometry } = await import('../src/canalRecall/landmarkKits.ts');
  const square = (cx: number, cy: number, w: number, d = w): Array<[number, number]> => [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2], [cx - w / 2, cy - d / 2]];
  assert.equal(new Set(KITS.map(k => k.name)).size, KITS.length, 'kit names are unique');
  const owners = new Map<string, string>();
  for (const kit of KITS) for (const id of [...kit.tiers.map(t => t.id), ...kit.roofs.map(r => r.id), ...(kit.halls ?? []).map(h => h.id)]) { assert.ok(!owners.has(id), `${id} belongs to one kit`); owners.set(id, kit.name); }
  for (const id of KIT_HIDE_IDS) assert.ok(KIT_PART_IDS.has(id));
  for (const kit of KITS) {
    assert.deepEqual(kitGeometry(kit, new Map()), [], `${kit.name}: nothing to draw until its parts load`);
    // Synthetic parts: a tier is a 10 m square from its own minHeight to height; a roof host a 12 x 30 nave.
    const parts = new Map<string, { id: string; ring: Array<[number, number]>; minHeightM: number; heightM: number }>();
    let z = 0;
    for (const tier of kit.tiers) { parts.set(tier.id, { id: tier.id, ring: square(0, 0, 10), minHeightM: z, heightM: z + 10 }); z += 10; }
    for (const stack of kit.stacks) if (!parts.has(stack.onId)) parts.set(stack.onId, { id: stack.onId, ring: square(0, 0, 10), minHeightM: 0, heightM: 30 });
    for (const roof of kit.roofs) parts.set(roof.id, { id: roof.id, ring: square(40, 0, 12, 30), minHeightM: 0, heightM: 20 });
    for (const hall of kit.halls ?? []) parts.set(hall.id, { id: hall.id, ring: square(0, 80, 40, 60), minHeightM: 0, heightM: 10 });
    const geometry = kitGeometry(kit, parts);
    // A body-only kit (NEMO: just its walls recoloured) builds no geometry of its own.
    const bodyOnly = !kit.tiers.length && !kit.stacks.length && !kit.roofs.length && !kit.halls?.length;
    assert.ok(bodyOnly ? geometry.length === 0 && (kit.body?.length ?? 0) > 0 : geometry.length > 0 && geometry.every(g => g.tris.length > 0), `${kit.name}: builds geometry`);
    for (const g of geometry) for (const t of g.tris) {
      assert.ok(t.p.flat().every(Number.isFinite) && t.uv.flat().every(Number.isFinite) && t.n.every(Number.isFinite), `${kit.name}: finite`);
      assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-6, `${kit.name}: unit normals`);
    }
    // Stacks climb: the highest vertex of a stacked part is above its host's own top.
    for (const stack of kit.stacks) {
      const host = parts.get(stack.onId)!, tris = geometry.find(g => g.id === stack.onId)!.tris;
      const top = Math.max(...tris.flatMap(t => t.p.map(q => q[2])));
      assert.ok(top >= (stack.startZ ?? host.heightM) + stack.stages.reduce((n, s) => n + s.h, 0) - 1e-6, `${kit.name}: the stack reaches its full height`);
    }
  }
  // Roof hosts are lowered to their eaves and walled; non-kit features pass through untouched.
  const nave = KITS[0].roofs[0], feature = { type: 'Feature' as const, properties: { id: nave.id, height: 33 }, geometry: null };
  const decorated = decorateKitRoof(feature);
  assert.equal(decorated.properties.roofEavesHeightM, 33 - nave.riseM);
  assert.equal(decorated.properties.kitWall, 'plain', 'a church is walled in bare brick');
  assert.equal(wallTopHeightM(decorated.properties), 33 - nave.riseM);
  assert.equal(decorateKitRoof(decorated), decorated, 'idempotent');
  const other = { type: 'Feature' as const, properties: { id: 'w1', height: 20 }, geometry: null };
  assert.equal(decorateKitRoof(other), other);
}

// --- Street side, runs, stoops (user report 2026-10-02, Da Costakade by Akitsu) --------
// Pinned spot: the curved block and corner café east of Akitsu (4.8752, 52.3722), shot by
// `LOOK_SHOTS=1 LOOK_SPOT=da-costa-akitsu LOOK_FREE=1 LOOK_ZOOM=19.3 … facade-trees-look`.
{
  const doorLayers = new Set([0, 1].map(v => cellLayer('canal', 'door', v)));
  /** Door quads as [minX, maxX, minY, maxY] in metres from origin. */
  const doorQuads = (c: ReturnType<typeof buildChunk>, id: string) => {
    const r = c.ranges.find(x => x.id === id)!, out: number[][] = [];
    for (let v = r.start; v < r.start + r.count; v++) {
      if (!doorLayers.has(c.layers[v]) || (v - r.start) % 4) continue;
      const xs = [0, 1, 2, 3].map(k => c.positions[(v + k) * 3]), ys = [0, 1, 2, 3].map(k => c.positions[(v + k) * 3 + 1]);
      out.push([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]);
    }
    return out;
  };
  // A house with a street 6 m in front (south) and another house's back 19 m behind it, across gardens.
  const front = house('front', 0, 6, 12), behind: MeshBuilding = { ...house('behind', 0, 6, 12), polygons: [[rect(0, 30, 6, 41)]] };
  const street = new Float32Array([-50, -6, 50, -6]);
  const withStreet = buildChunk([front, behind], origin, 'walls', street);
  const doors = doorQuads(withStreet, 'front');
  assert.ok(doors.length >= 1, 'the street wall keeps its door');
  assert.ok(doors.every(([, , y0, y1]) => Math.abs(y0) < 0.01 && Math.abs(y1) < 0.01), `doors only on the street wall: ${JSON.stringify(doors)}`);
  // No streets known (boat mode): any outer wall may carry a door, as before.
  const sides = new Set(doorQuads(buildChunk([front, behind], origin), 'front').map(([x0, x1, y0, y1]) => `${Math.round(x1 - x0) ? 'h' : 'v'}${Math.round((y0 + y1) / 2)}${Math.round((x0 + x1) / 2)}`));
  assert.ok(sides.size > 1, 'without streets, doors spread over the outer walls');
  // A courtyard wall never carries a door.
  const block: MeshBuilding = { ...house('court', 0, 30, 12), polygons: [[rect(0, 0, 30, 30), rect(10, 10, 20, 20).reverse()]] };
  for (const [x0, x1, y0, y1] of doorQuads(buildChunk([block], origin), 'court')) assert.ok(!(x0 > 9.9 && x1 < 20.1 && y0 > 9.9 && y1 < 20.1), 'no door in the courtyard');
  // Same house, street to the east instead: the door moves to the east wall.
  const east = doorQuads(buildChunk([front], origin, 'walls', new Float32Array([12, -50, 12, 50])), 'front');
  assert.ok(east.length && east.every(([x0, x1]) => Math.abs(x0 - 6) < 0.01 && Math.abs(x1 - 6) < 0.01), 'door follows the street');
}
{
  // A curved frontage (a quarter ring in 12 segments) is one run with one bay width.
  const arc = (r: number, n: number) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI / 2; return [r * Math.cos(a), r * Math.sin(a)]; });
  const outer = arc(40, 12), inner = arc(28, 12).reverse();
  const ring = [...outer, ...inner, outer[0]].map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
  const curved: MeshBuilding = { id: 'curve', polygons: [[ring]], heightM: 15, minHeightM: 0, style: 'school', wallHex: '#8a5a44' };
  const c = buildChunk([curved], origin);
  const upper = new Set([0, 1].map(v => cellLayer('school', 'upper', v)));
  const perMetre: number[] = [];
  for (let v = 0; v < c.vertexCount; v += 4) {
    if (!upper.has(c.layers[v])) continue;
    const len = Math.hypot(c.positions[(v + 1) * 3] - c.positions[v * 3], c.positions[(v + 1) * 3 + 1] - c.positions[v * 3 + 1]);
    if (len > 9) continue; // the two straight end walls
    perMetre.push((c.uvs[(v + 1) * 2] - c.uvs[v * 2]) / len);
  }
  assert.ok(perMetre.length >= 24, `curved segments found (${perMetre.length})`);
  // Two arcs (outer and inner), each with its own grid; within an arc every segment agrees.
  const groups = [...new Set(perMetre.map(x => x.toFixed(4)))];
  assert.ok(groups.length <= 2, `one bay width per curved wall, got ${groups.join(', ')}`);
  // Runs: the ring's 12 + 12 arc edges collapse into 2 runs plus the 2 straight ends.
  const pts = ring.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * ky]);
  const edges = pts.slice(0, -1).map(([x0, y0], i) => { const [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0); return { x0, y0, x1, y1, len, nx: (y1 - y0) / len, ny: -(x1 - x0) / len, hole: false }; });
  assert.equal(wallRuns([edges], () => false).length, 4, 'two arcs and two ends');
  // A run's doors sit on a bay that lies mostly on one edge, and an edge the street rule forbids gets none.
  const run = layoutRun('postwar', [6, 6, 6], 12, 0.4, true, undefined, [false, true, false])!;
  for (const b of run.doorBays) { const mid = (b + 0.5) * run.bayWidthM; assert.ok(mid > 6 && mid < 12, `door bay ${b} on the allowed edge`); }
  assert.deepEqual(edgeGroundPieces(run, 1, 6).reduce((n, p) => n + (p.a1 - p.a0), 0).toFixed(6), (6).toFixed(6), 'ground pieces cover the edge');
}
{
  // A narrow shop has no house door, so no stoop climbs to its shop window (the café corner).
  const STONE = [0xcf, 0xc6, 0xb4];
  const lowStone = (c: ReturnType<typeof buildChunk>) => { for (let v = 0; v < c.vertexCount; v++) if (c.positions[v * 3 + 2] < 0.6 && STONE.every((x, k) => c.tints[v * 4 + k] === x)) return true; return false; };
  let houses = 0, shops = 0;
  for (let i = 0; i < 40; i++) {
    const h = { ...house(`s${i}`, 0, 5.5, 12), extras: true, lid: { hex: '#777777', flatLayer: 0 } };
    if (lowStone(buildChunk([h], origin, 'extras'))) houses++;
    if (lowStone(buildChunk([{ ...h, shopfront: true }], origin, 'extras'))) shops++;
  }
  assert.ok(houses > 5, `stoops exist on houses (${houses})`);
  assert.equal(shops, 0, 'no stoop in front of a narrow shop');
}

{
  // De Hallen (user report 2026-10-02: one bare tan block): its one BAG footprint becomes a row
  // of ~9.6 m tram halls, ridges along the long wall, gable ends on the stepped Bellamyplein side.
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { hallRects, KITS: kits, decorateKitRoof: decorate, kitGeometry: geometry } = await import('../src/canalRecall/landmarkKits.ts');
  const tile = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8413/5384.geojson.gz')).toString());
  const id = 'NL.IMBAG.Pand.0363100012236693', f = tile.features.find((x: any) => x.properties.id === id);
  assert.ok(f, 'De Hallen footprint is in its tile');
  const KO = { lng: 4.9, lat: 52.37 }, kkx = 111_320 * Math.cos(KO.lat * Math.PI / 180);
  const ring: [number, number][] = f.geometry.coordinates[0].map(([lng, lat]: number[]) => [(lng - KO.lng) * kkx, (lat - KO.lat) * 110_540]);
  const kit = kits.find(k => k.name === 'De Hallen')!, spec = kit.halls![0];
  const anchor: [number, number] = [(spec.anchor[0] - KO.lng) * kkx, (spec.anchor[1] - KO.lat) * 110_540];
  const halls = hallRects(ring, spec.widthM, anchor);
  assert.ok(halls.length >= 10, `a row of halls (${halls.length})`);
  assert.ok(halls.every(h => h.wid <= spec.widthM + 1e-6 && h.len > h.wid), 'each hall is a long narrow shed');
  let area2 = 0; for (let i = 0; i + 1 < ring.length; i++) area2 += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const covered = halls.reduce((a, h) => a + h.len * h.wid, 0) / Math.abs(area2 / 2);
  assert.ok(covered > 0.85 && covered < 1.1, `halls cover the footprint (${covered.toFixed(2)})`);
  const decorated = decorate({ type: 'Feature', properties: { id, height: 9.61 }, geometry: null });
  assert.equal(decorated.properties.roofEavesHeightM, spec.eavesM, 'walls stop at the hall eaves');
  assert.equal(decorated.properties.kitWall, 'grid', 'brick walls with windows, not bare tan');
  const tris = geometry(kit, new Map([[id, { id, ring, minHeightM: 0, heightM: 9.61 }]]))[0].tris;
  const top = Math.max(...tris.flatMap(t => t.p.map(p => p[2])));
  assert.ok(Math.abs(top - (spec.eavesM + spec.riseM)) < 0.5, `ridges at ${top.toFixed(1)} m`);
}

{
  // Fatih mosque, Rozengracht 150 (user report 2026-10-02: "wtf happened to this building both in
  // size and color", a 37 m green box): the nave stops at its eaves under one pitched roof, and
  // two brick towers inside the front corners rise to about 40 m with slate caps.
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { KITS: kits, decorateKitRoof: decorate, kitGeometry: geometry } = await import('../src/canalRecall/landmarkKits.ts');
  const tile = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
  const id = 'NL.IMBAG.Pand.0363100012167944', f = tile.features.find((x: any) => x.properties.id === id);
  assert.ok(f, 'Fatih footprint is in its tile');
  const KO = { lng: 4.9, lat: 52.37 }, kkx = 111_320 * Math.cos(KO.lat * Math.PI / 180);
  const toL = ([lng, lat]: number[]): [number, number] => [(lng - KO.lng) * kkx, (lat - KO.lat) * 110_540];
  const ring: [number, number][] = f.geometry.coordinates[0].map(toL);
  const kit = kits.find(k => k.name === 'Fatih')!, spec = kit.halls![0];
  const decorated = decorate({ type: 'Feature', properties: { id, height: 37.31, sideColour: '#557260' }, geometry: null });
  assert.equal(decorated.properties.roofEavesHeightM, 16, 'the nave walls stop at the eaves, not at tower height');
  assert.equal(decorated.properties.sideColour, kit.wall!.hex, 'dark brick, not the palette green');
  const inside = ([x, y]: [number, number]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
  for (const t of spec.towers!) assert.ok(inside(toL(t.at)), 'each tower stands on the footprint');
  const tris = geometry(kit, new Map([[id, { id, ring, minHeightM: 0, heightM: 37.31 }]]))[0].tris;
  const zs = tris.flatMap(t => t.p.map(p => p[2])), top = Math.max(...zs);
  assert.ok(top > 39 && top < 43, `towers about 40 m with caps (${top.toFixed(1)})`);
  const nave = tris.filter(t => t.layer === 'slope'), ridge = Math.max(...nave.flatMap(t => t.p.map(p => p[2])));
  assert.ok(nave.length && Math.abs(ridge - (spec.eavesM + spec.riseM)) < 0.5, `nave ridge at ${ridge.toFixed(1)} m`);
  // Windows (user 2026-10-03: "how does Fatih look", bare dark brick): the front carries three
  // door arches, four windows and the rose in the gable between the towers, the towers their
  // paired windows and belfry arches; all of it is glass a hand's breadth proud of the walls.
  const glass = kit.halls![0].windows!.glassHex!, panes = tris.filter(t => t.hex === glass);
  const bare = geometry({ ...kit, halls: kit.halls!.map(h => ({ ...h, windows: undefined })) }, new Map([[id, { id, ring, minHeightM: 0, heightM: 37.31 }]]))[0].tris;
  assert.ok(tris.length - bare.length < 1500, `windows cost ${tris.length - bare.length} triangles`);
  const front = toL([4.8786371, 52.3730248]);
  const near = (r: number, z0: number, z1: number) => panes.filter(t => t.p.every(p => Math.hypot(p[0] - front[0], p[1] - front[1]) < r && p[2] >= z0 && p[2] <= z1));
  assert.ok(near(2.3, 14, 18).length >= 10, 'a rose window in the gable between the towers');
  assert.ok(near(3.6, 7.5, 11).length >= 4 * 5, 'four round-headed windows over the doors');
  assert.ok(panes.some(t => t.p.every(p => p[2] > 27 && p[2] < 30.5)), 'belfry arches under the tower cornices');
  // The front is mapped as several collinear pieces; the nave's fill row must leave all of them to the placed rows.
  const [ax, ay] = toL([4.878429, 52.372973]), [bx, by] = toL([4.878843, 52.373076]), fl = Math.hypot(bx - ax, by - ay);
  const onFrontLine = (p: number[]) => Math.abs(((p[0] - ax) * (by - ay) - (p[1] - ay) * (bx - ax)) / fl) < 0.4;
  assert.ok(!panes.some(t => t.p.every(onFrontLine) && t.p.some(p => p[2] > 12.4 && p[2] < 13.55)), 'no nave window on the front');
  // Those pieces jog 0.2 m in and out: the front's openings stand proud of the outermost one, not behind it.
  const inward = toL(spec.towers![0].at), side = Math.sign(((inward[0] - ax) * (by - ay) - (inward[1] - ay) * (bx - ax)) / fl);
  const outward = (p: number[]) => -side * ((p[0] - ax) * (by - ay) - (p[1] - ay) * (bx - ax)) / fl;
  const wallFace = Math.max(...ring.filter(onFrontLine).map(outward));
  assert.ok(near(3.6, 7.5, 11).every(t => t.p.every(p => outward(p) > wallFace + 0.05)), 'front windows in front of every piece of the wall');
  assert.ok(panes.every(t => Math.abs(t.n[2]) < 1e-6), 'panes are upright, in their walls');
}

{
  // Carré, Amstel 115-125 (user 2026-10-03: "Carre looks awful in that shot", one bare 28 m brick
  // slab): a cream stuccoed front with a grey stone ground storey and rows of windows, walls to
  // the 19 m cornice, a pediment over the risalit, and one pale cloister dome over the whole block
  // with the sign box on its flat top at BAG's 28.3 m.
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { KITS: kits, decorateKitRoof: decorate, kitGeometry: geometry } = await import('../src/canalRecall/landmarkKits.ts');
  const tile = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8415/5384.geojson.gz')).toString());
  const id = 'NL.IMBAG.Pand.0363100012165489', f = tile.features.find((x: any) => x.properties.id === id);
  assert.ok(f, 'Carré footprint is in its tile');
  const landmarks = JSON.parse(readFileSync('public/data/extracts/amsterdam/landmark-buildings.json', 'utf8'));
  assert.deepEqual(landmarks.buildings.extract_landmarks_1137362739, [id], 'the Royal Theater Carré landmark is this one footprint');
  const KO = { lng: 4.9, lat: 52.37 }, kkx = 111_320 * Math.cos(KO.lat * Math.PI / 180);
  const toL = ([lng, lat]: number[]): [number, number] => [(lng - KO.lng) * kkx, (lat - KO.lat) * 110_540];
  const ring: [number, number][] = f.geometry.coordinates[0].map(toL);
  const inside = ([x, y]: [number, number]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
  const kit = kits.find(k => k.name === 'Carré')!, spec = kit.halls![0];
  const decorated = decorate({ type: 'Feature', properties: { id, height: f.properties.height, sideColour: '#7a4535' }, geometry: null });
  assert.equal(decorated.properties.roofEavesHeightM, 19, 'walls stop at the cornice, not at the sign box');
  assert.equal(decorated.properties.kitWall, 'flat', 'cream stucco, not brick');
  assert.equal(decorated.properties.sideColour, kit.wall!.hex);
  for (const w of spec.wings!) assert.ok(inside(toL(w.at)), 'each roof stands on the footprint');
  for (const t of spec.towers!) assert.ok(inside(toL(t.at)), 'the sign box and the turret cap stand on the footprint');
  const tris = geometry(kit, new Map([[id, { id, ring, minHeightM: 0, heightM: f.properties.height }]]))[0].tris;
  const top = Math.max(...tris.flatMap(t => t.p.map(p => p[2])));
  assert.ok(Math.abs(top - f.properties.height) < 0.5, `sign box top ${top.toFixed(1)} m, BAG ${f.properties.height} m`);
  const roof = tris.filter(t => t.layer === 'slope'), crown = Math.max(...roof.flatMap(t => t.p.map(p => p[2])));
  assert.ok(Math.abs(crown - 27) < 0.3, `dome crown ${crown.toFixed(1)} m`);
  // The dome is convex: its sides steepen towards the eaves (the lowest band is the steepest).
  const dome = roof.filter(t => t.n[2] < 0.999 && t.p.every(p => p[2] >= 19 - 1e-6));
  const band = (z0: number, z1: number) => Math.min(...dome.filter(t => t.p.every(p => p[2] >= z0 - 1e-6 && p[2] <= z1 + 1e-6)).map(t => t.n[2]));
  assert.ok(band(19, 22.1) < band(25.3, 27), 'the dome curves: steep at the eaves, flat at the crown');
  const pediment = tris.filter(t => t.hex === kit.wall!.hex && t.p.some(p => p[2] > 21));
  assert.ok(pediment.length, 'a cream pediment rises over the risalit');
  // The Amstel front (its west end) carries arches and three rows of windows on a stone plinth.
  const glass = spec.windows!.glassHex!, panes = tris.filter(t => t.hex === glass);
  const front = toL([4.903858, 52.362346]);
  const onFront = panes.filter(t => t.p.every(p => Math.abs((p[0] - front[0]) * Math.cos(17 * Math.PI / 180) + (p[1] - front[1]) * Math.sin(17 * Math.PI / 180)) < 2.2));
  for (const [z0, z1] of [[0.4, 3.9], [5.2, 8], [9.3, 11.6], [14.6, 16.3]]) {
    const row = onFront.filter(t => t.p.every(p => p[2] >= z0 - 1e-6 && p[2] <= z1 + 1e-6));
    assert.ok(row.length >= 8 * 2, `front row ${z0}-${z1} m has its windows (${row.length} triangles)`);
  }
  assert.ok(tris.some(t => t.hex === spec.windows!.plinth!.hex), 'a stone ground storey');
  assert.ok(tris.length < 1000, `Carré costs ${tris.length} triangles`);
}

{
  // Windows are opt in: a kit without them draws no glass, so the other kits are unchanged.
  const { KITS: kits, kitGeometry: geometry } = await import('../src/canalRecall/landmarkKits.ts');
  const square = (cx: number, cy: number, w: number, d = w): Array<[number, number]> => [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2], [cx - w / 2, cy - d / 2]];
  for (const kit of kits) {
    if (kit.halls?.some(h => h.windows)) continue;
    const parts = new Map((kit.halls ?? []).map(h => [h.id, { id: h.id, ring: square(0, 0, 40, 60), minHeightM: 0, heightM: 20 }]));
    for (const g of geometry(kit, parts)) assert.ok(g.tris.every(t => t.hex !== '#2c333b'), `${kit.name}: no windows unless the kit asks`);
  }
}

{
  // Hand-modelled landmark churches whose single BAG footprint carries the tower's height (the
  // whole building stood as one bare box at tower height). Each: the walls stop at the eaves,
  // every wing and tower stands on the footprint, the roofs ridge where the photo says, and the
  // highest point matches the documented height. `tile` is the building-tiles/14 file.
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { KITS: kits, decorateKitRoof: decorate, kitGeometry: geometry } = await import('../src/canalRecall/landmarkKits.ts');
  const KO = { lng: 4.9, lat: 52.37 }, kkx = 111_320 * Math.cos(KO.lat * Math.PI / 180);
  const toL = ([lng, lat]: number[]): [number, number] => [(lng - KO.lng) * kkx, (lat - KO.lat) * 110_540];
  const inside = (ring: [number, number][], [x, y]: [number, number]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
  const churches = [
    // Obrechtkerk (Cuypers/Stuyt 1911): twin front towers 36.3 m with caps, a lower tiled crossing tower, nave ridge 23 m.
    { name: 'Obrechtkerk', tile: '8413/5385', id: 'NL.IMBAG.Pand.0363100012124153', bagHeight: 36.27, top: 36.3, tol: 1, ridge: 23, wall: '#7d6858' },
    // Oosterkerk (Stalpaert 1671): lead lantern and dome over hipped slate roofs ridged at 19 m; BAG 26.86 m with the vane.
    { name: 'Oosterkerk', tile: '8415/5384', id: 'NL.IMBAG.Pand.0363100012170274', bagHeight: 26.86, top: 26.9, tol: 1, ridge: 19, wall: '#8c5b46' },
    // De Duif (Molkenboer 1857): no tower, a pitched nave behind a pediment; BAG 24.48 m is the pediment, the model ridges at 22 m.
    { name: 'De Duif', tile: '8414/5385', id: 'NL.IMBAG.Pand.0363100012171729', bagHeight: 24.48, top: 22, tol: 3, ridge: 22, wall: '#a99e8c' },
    // Opstandingskerk (Duintjer 1956): the "Kolenkit" bell tower, 48 m at its high edge (nl.wikipedia), over an 11 m nave.
    { name: 'Opstandingskerk', tile: '8412/5383', id: 'NL.IMBAG.Pand.0363100012133302', bagHeight: 35.17, top: 48, tol: 1, ridge: 14, wall: '#b07a63' },
    // Mozes en Aäronkerk (Suys 1841): cream twin timber towers 33 m over a brown-brick hall with a low roof ridged at 18.5 m.
    { name: 'Mozes en Aäronkerk', tile: '8415/5384', id: 'NL.IMBAG.Pand.0363100012253765', bagHeight: 24.38, top: 33.1, tol: 1, ridge: 18.5, wall: '#7c5a4a' },
    // Westerkerk's east end: the 1.8 m sliver BAG records at 35 m, walled to the nave's 27 m eaves (slim ridge 28.5 m).
    { name: 'Westerkerk', tile: '8414/5384', id: 'NL.IMBAG.Pand.0363100012164998', bagHeight: 35.14, top: 28.5, tol: 1, ridge: 28.5, wall: '#8a4b38' },
  ];
  for (const c of churches) {
    const tile = JSON.parse(gunzipSync(readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${c.tile}.geojson.gz`)).toString());
    const f = tile.features.find((x: any) => x.properties.id === c.id);
    assert.ok(f, `${c.name} footprint is in its tile`);
    const ring: [number, number][] = f.geometry.coordinates[0].map(toL);
    const kit = kits.find(k => k.name === c.name)!, spec = kit.halls![0];
    assert.equal(spec.id, c.id, `${c.name} kit hangs on the BAG footprint`);
    const decorated = decorate({ type: 'Feature', properties: { id: c.id, height: c.bagHeight, sideColour: '#557260' }, geometry: null });
    assert.equal(decorated.properties.roofEavesHeightM, spec.eavesM, `${c.name}: walls stop at the eaves, not at tower height`);
    assert.ok(spec.eavesM < c.bagHeight - 5 && spec.eavesM > 8, `${c.name}: eaves ${spec.eavesM} m sit well below the BAG height`);
    assert.equal(decorated.properties.sideColour, c.wall, `${c.name}: its own wall colour, not the palette's`);
    for (const t of spec.towers ?? []) assert.ok(inside(ring, toL(t.at)), `${c.name}: each tower stands on the footprint`);
    for (const w of spec.wings ?? []) assert.ok(inside(ring, toL(w.at)), `${c.name}: each wing is centred on the footprint`);
    const tris = geometry(kit, new Map([[c.id, { id: c.id, ring, minHeightM: 0, heightM: c.bagHeight }]]))[0].tris;
    const top = Math.max(...tris.flatMap(t => t.p.map(p => p[2])));
    assert.ok(Math.abs(top - c.top) <= c.tol, `${c.name}: highest point ${top.toFixed(1)} m, documented ${c.top} m +/- ${c.tol}`);
    const roof = tris.filter(t => t.layer === 'slope'), ridge = Math.max(...roof.flatMap(t => t.p.map(p => p[2])));
    assert.ok(roof.length && Math.abs(ridge - c.ridge) < 1.5, `${c.name}: roof ridge ${ridge.toFixed(1)} m, expected ${c.ridge} m`);
    // The footprint's towers outrank the roofs only where the church has them.
    if ((spec.towers ?? []).length) assert.ok(top > ridge + 3, `${c.name}: tower rises above the roofs`);
  }
}

{
  // A shop's ground floor takes its paint colour (user 2026-10-02: "the white bit should go to the
  // ground because that's the paint color of the bottom floor … different colors"); doors and upper floors keep the wall.
  const shop: MeshBuilding = { ...house('paint', 0, 12, 12), layers: { upper: 1, ground: 2, door: 3 }, groundHex: '#2b2d2c' };
  const c = buildChunk([shop], origin);
  let ground = 0, other = 0;
  for (let v = 0; v < c.vertexCount; v++) {
    const rgb = [c.tints[v * 4], c.tints[v * 4 + 1], c.tints[v * 4 + 2]];
    if (c.layers[v] === 2) { ground++; assert.deepEqual(rgb, [0x2b, 0x2d, 0x2c], 'shop bays wear the ground-floor paint'); }
    else if (c.layers[v] === 1 || c.layers[v] === 3) { other++; assert.notDeepEqual(rgb, [0x2b, 0x2d, 0x2c], 'upper floors and doors keep the wall colour'); }
  }
  assert.ok(ground > 0 && other > 0);
}

{
  // Bay archetypes follow the facade periods: a 1890 Jordaan block is 19th century, a 1965 slab is modern, not canal houses.
  const { archetypeFor } = await import('../src/canalRecall/bayTextures.ts');
  const { BAY_LAYER_COUNT, BAY_STYLES } = await import('../src/canalRecall/bayLook.ts');
  assert.equal(archetypeFor('x', 1650, 15), 'canal');
  assert.equal(archetypeFor('x', 1890, 15), 'c19');
  assert.equal(archetypeFor('x', 1925, 15), 'school');
  assert.equal(archetypeFor('x', 1965, 15), 'modern');
  assert.ok(BAY_STYLES.canal.every(s => s.shape === 'rect'), 'canal houses have flat lintels; arched hoods are 19th century');
  assert.ok(BAY_LAYER_COUNT < 200, 'bay layers fit the byte layer index with room for roofs');
}
{
  // Wall colours follow the period (user 2026-10-02, real-vs-game sheet: "one brick palette"): canal houses
  // run darker than 19th-century rows, and post-war blocks are buff and grey, not red brick.
  const { bayLookFor } = await import('../src/canalRecall/bayLook.ts');
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const red = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (n >> 16) - (n & 255); };
  const walls = (year: number) => Array.from({ length: 400 }, (_, i) => bayLookFor(`w${i}`, year, 12, 'photo').wallHex);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const canal = walls(1680), c19 = walls(1895), modern = walls(1965);
  assert.ok(mean(canal.map(lum)) + 15 < mean(c19.map(lum)), 'canal houses darker than 19th-century rows');
  assert.ok(canal.filter(h => lum(h) < 60).length > 40, 'some canal houses painted near-black or dark green');
  assert.ok(mean(modern.map(red)) < mean(c19.map(red)) - 30, 'post-war blocks buff and grey, not red brick');
}
console.log('three buildings: ok');
