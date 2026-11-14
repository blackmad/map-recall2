/**
 * Named regressions for the white bars (lane white-bars-20261114, look/pilasterTone.ts).
 *
 * David's frame of 2026-11-14 (street level, own engine, default world) at Haarlemmerdijk 31 (0363100012167794): a tall
 * white strip up the left edge of the house beside it and a pale bar along its top. The house is Haarlemmerdijk 29
 * (0363100012167795), drawn by the generic mesher; the strip is its dice `corner-pilasters` (facadeOrnaments.ts), white,
 * at both ends of the front; the top bar is its dice `kroonlijst`. 31 is its installed recipe model and draws neither.
 *
 * Built in Node on the real tiles (scripts/world/pipeline.ts, the near chunk's 'extras' mode), flag on and off:
 *  - each pinned pand gets corner-pilasters, pale with PILASTER_TONE=0 and its wall colour (x PILASTER_SHADE) by default;
 *  - every building without corner-pilasters is byte-identical between the two builds (positions, tints, layers, indices),
 *    and a building with them differs only in the pilaster triangles' tint.
 *   node --import tsx scripts/check-pilaster-tone.ts
 */
import './world/useBrowserMath.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gameChain, loadTile, type Feature } from './world/pipeline.ts';
import { shellProfiles, shellStreets } from './world/shellBake.ts';
import { buildFeatureChunk, asPolygons } from '../src/canalRecall/threeBuildingFeatures.ts';
import { BuildingContextIndex } from '../src/canalRecall/buildingContextIndex.ts';
import { extraUsage, type ExtraContext } from '../src/canalRecall/facadeExtras.ts';
import { PILASTER_SHADE, resetPilasterToneFlag } from '../src/canalRecall/look/pilasterTone.ts';
import { WHITE, STONE } from '../src/canalRecall/facadeOrnaments.ts';

const ROOT = process.cwd();
/** pand -> [z14 tile, what it is]. */
const PINNED: Record<string, [string, string]> = {
  '0363100012167795': ['8414/5383', 'Haarlemmerdijk 29, beside 31 (167794): David\'s white bars, 2026-11-14'],
  '0363100012157005': ['8413/5384', 'Nassaukade, face nassau-139-144'],
  '0363100012165159': ['8413/5384', 'face groot-3-19'],
};
const MODEL = '0363100012167794'; // Haarlemmerdijk 31: the installed recipe model, not drawn by the generic extras

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const full = (id: string) => `NL.IMBAG.Pand.${id}`;
const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const chain = gameChain(), profiles = shellProfiles(ROOT);
type Build = ReturnType<typeof buildFeatureChunk>;
function build(features: Feature[], context: Feature[], streets: Float32Array | undefined, flag: string): { chunk: Build; walls: ExtraContext[]; used: Map<string, string[]> } {
  process.env.PILASTER_TONE = flag; resetPilasterToneFlag();
  const walls: ExtraContext[] = [], used = new Map<string, string[]>();
  extraUsage.record = (c, u) => { walls.push(c); used.set(`${c.id}|${c.wallKey}`, [...u]); };
  try { return { chunk: buildFeatureChunk(features as never, 'photo', 'extras', streets, profiles, context as never), walls, used }; }
  finally { extraUsage.record = null; }
}

const tiles = [...new Set(Object.values(PINNED).map(([t]) => t))];
let identical = 0, changed = 0;
for (const tile of tiles) {
  const rows = await loadTile(tile, chain);
  const styled = rows.map(r => r.styled);
  const ctx = new BuildingContextIndex(styled, boxOf), inChunk = new Set(styled);
  const context = ctx.neighbors(styled, f => inChunk.has(f));
  const streets = shellStreets(ROOT, styled as never);
  const off = build(styled, context, streets, '0'), on = build(styled, context, streets, '1');
  delete process.env.PILASTER_TONE; resetPilasterToneFlag();
  const a = off.chunk, b = on.chunk;
  assert.equal(a.vertexCount, b.vertexCount, `${tile}: same vertex count`);
  assert.deepEqual(a.positions, b.positions, `${tile}: same positions (the fix only recolours)`);
  assert.deepEqual(a.indices, b.indices, `${tile}: same indices`);
  assert.deepEqual(a.layers, b.layers, `${tile}: same layers`);
  const pilastered = new Set([...on.used].filter(([, u]) => u.includes('corner-pilasters')).map(([k]) => k.split('|')[0]));
  for (const r of b.ranges) {
    let same = true;
    for (let v = r.start; v < r.start + r.count && same; v++) for (let k = 0; k < 4; k++) if (a.tints[v * 4 + k] !== b.tints[v * 4 + k]) { same = false; break; }
    if (pilastered.has(r.id)) { if (!same) changed++; continue; }
    assert.ok(same, `${tile} ${r.id}: no corner-pilasters, so byte-identical tints`);
    identical++;
  }
  for (const [id, [t, what]] of Object.entries(PINNED)) {
    if (t !== tile) continue;
    const walls = on.walls.filter(c => c.id === full(id) && on.used.get(`${c.id}|${c.wallKey}`)?.includes('corner-pilasters'));
    assert.ok(walls.length >= 1, `${id} (${what}): draws corner-pilasters`);
    assert.ok(!walls.some(c => c.registerForce?.includes('corner-pilasters') || c.statedFirst?.includes('corner-pilasters')), `${id}: the pilasters are the dice's, no evidence`);
    const wall = hexRgb(walls[0].wallHex), toned = wall.map(v => Math.round(v * PILASTER_SHADE));
    // The pand's vertex tints: the off build carries the pale pilaster colour, the on build the toned wall in its place.
    const range = b.ranges.find(r => r.id === full(id))!;
    assert.ok(range, `${id}: drawn in the near chunk`);
    let pale = 0, wallToned = 0;
    for (let v = range.start; v < range.start + range.count; v++) {
      const ta = [0, 1, 2].map(k => a.tints[v * 4 + k]), tb = [0, 1, 2].map(k => b.tints[v * 4 + k]);
      if (ta.every((x, k) => x === tb[k])) continue;
      if (Math.min(...ta) > 150) pale++;
      if (Math.max(...tb) < Math.max(...toned) * 1.6 + 20) wallToned++;
    }
    assert.ok(pale > 0 && wallToned === pale, `${id} (${what}): ${pale} pale pilaster vertices with the flag off, ${wallToned} wall-toned with it on (wall ${walls[0].wallHex})`);
    console.log(`ok ${id} ${what}: ${walls.length} front(s), ${pale} pilaster vertices pale (${WHITE}/${STONE}) -> wall ${walls[0].wallHex} x ${PILASTER_SHADE}`);
  }
  if (tile === PINNED['0363100012167795'][0]) {
    // 31 is drawn by its installed recipe model; the runtime hides the generic copy built here (covers.json).
    const covers = JSON.parse(fs.readFileSync(`${ROOT}/public/canal-drive/models/covers.json`, 'utf8')) as { models: Record<string, string[]> };
    assert.ok(Object.values(covers.models).some(v => (Array.isArray(v) ? v : (v as unknown as { p?: string[] }).p ?? []).map(String).includes(MODEL)), `${MODEL} (Haarlemmerdijk 31) is covered by its installed model`);
    console.log(`ok ${MODEL} Haarlemmerdijk 31: covered by its installed model; the bars are on 29`);
  }
}
console.log(`pilaster tone: ${identical} buildings without corner-pilasters byte-identical, ${changed} with them recoloured (positions/indices/layers identical on ${tiles.length} tiles)`);
