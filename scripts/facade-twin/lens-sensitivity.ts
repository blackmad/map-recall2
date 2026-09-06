/**
 * How much does a measurement depend on where we put the lens?
 *
 * Every façade number in `measured-facades.json` is read off a strip that was
 * rectified from an assumed camera position. If a 10 cm error in that position
 * changes the storey count, the storey count is not a property of the building.
 * This re-measures stored façades at deliberate vertical offsets and reports how
 * the answer moves.
 *
 * The δ=0 pass is a provenance check as much as a control: it must reproduce the
 * stored reading exactly. If it does not, the store was written by different code
 * than is checked out now, and no comparison against it means anything.
 *
 * Reads only cached panoramas — it never downloads, so it is safe to run often.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/lens-sensitivity.ts --buildings=60
 *   npx tsx scripts/facade-twin/lens-sensitivity.ts --deltas=0,0.25,1
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { measureFacade, STRIP_BASE_BELOW_GROUND_M, MAX_PIXELS_PER_METRE, MIN_PIXELS_PER_METRE } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { loadTrackOffsets, resolveLens } from './panorama-render.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { MassingRecord, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const BUDGET = Number(arg('buildings') ?? 60);
const DELTAS = (arg('deltas') ?? '-1,-0.5,-0.25,-0.1,0,0.1,0.25,0.5,1').split(',').map(Number);

const offsetOf = await loadTrackOffsets(CACHE);
const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
    .map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const stored = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as
  Record<string, { pandId: string; panoramaId: string; standoffM: number; wall: [number, number, number, number]; storeyBands: number; bays: number; openings: unknown[] }>;

const cached = async (id: string) => {
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  try { await access(file); return file; } catch { return null; }
};

// Group by image: decoding an 8000 px equirectangular dominates the cost, and
// every δ for every building sharing an image can be measured from one decode.
const byImage = new Map<string, string[]>();
for (const [pandId, f] of Object.entries(stored)) {
  (byImage.get(f.panoramaId) ?? byImage.set(f.panoramaId, []).get(f.panoramaId)!).push(pandId);
}

type Row = { pandId: string; delta: number; storeys: number; bays: number; openings: number; prominence: number;
  gates: Array<{ mean: number; widthM: number; heightM: number; verdict: string }> };
const rows: Row[] = [];
let done = 0, images = 0, skippedNoImage = 0;

for (const [panoramaId, pandIds] of byImage) {
  if (done >= BUDGET) break;
  const view = views.get(panoramaId);
  const file = view && await cached(panoramaId);
  if (!view || !file) { skippedNoImage += pandIds.length; continue; }
  const decoded = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  images++;

  for (const pandId of pandIds) {
    if (done >= BUDGET) break;
    const f = stored[pandId];
    const mass = massing.get(pandId);
    const ground = mass?.groundLevel ?? null, eaves = mass?.eavesHeight ?? null;
    if (ground === null || eaves === null || eaves <= ground) continue;
    const lens = resolveLens(view, offsetOf, ground);
    if (!lens) continue;
    const wall = { start: { x: f.wall[0], y: f.wall[1] }, end: { x: f.wall[2], y: f.wall[3] } };
    // Recompute the standoff rather than reading the store's rounded copy: at this
    // detector's sensitivity, 0.05 m of rounding is enough to move an answer, so a
    // control built on the rounded value would report drift that is its own.
    const camera = RD_NEW.fromLngLat(view.lngLat);
    const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy) || 1;
    const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
    const exact = Math.abs((camera.x - mid.x) * (dy / len) - (camera.y - mid.y) * (dx / len));
    const ppm = Math.min(MAX_PIXELS_PER_METRE, Math.max(MIN_PIXELS_PER_METRE, 1250 / exact));

    for (const delta of DELTAS) {
      const rect = rectifyFacade(image, { ...lens.pose, z: lens.pose.z + delta },
        { start: wall.start, end: wall.end, baseZ: ground - STRIP_BASE_BELOW_GROUND_M, topZ: eaves + 0.3 },
        { pixelsPerMetre: ppm, camera: AMSTERDAM_CAMERA });
      const m = measureFacade(rect, { pixelsPerMetre: rect.pixelsPerMetre });
      rows.push({ pandId, delta, storeys: m.storeys.length, bays: m.bays, openings: m.openings.length,
        prominence: m.storeyProminence, gates: m.openingGates });
    }
    done++;
    if (done % 10 === 0) process.stdout.write(`  ${done}/${BUDGET} buildings`);
  }
}
console.log(`\n\n${done} buildings re-measured from ${images} cached images (${skippedNoImage} skipped, image not cached)\n`);

const at = (d: number) => new Map(rows.filter(r => r.delta === d).map(r => [r.pandId, r]));
const base = at(0);

// Provenance: δ=0 must reproduce the store, or the store predates this code.
if (DELTAS.includes(0)) {
  const ids = [...base.keys()];
  const same = ids.filter(id => base.get(id)!.storeys === stored[id].storeyBands).length;
  console.log(`provenance — δ=0 reproduces the stored storey count for ${same}/${ids.length} buildings` +
    (same === ids.length ? '' : `  ← the store was NOT written by this code`));
  const sameBays = ids.filter(id => base.get(id)!.bays === stored[id].bays).length;
  console.log(`             δ=0 reproduces the stored bay count for    ${sameBays}/${ids.length}\n`);
}

console.log('   δ (m)     n   mean |Δstoreys|   unchanged   mean |Δbays|   mean |Δopenings|');
for (const d of DELTAS) {
  if (d === 0) continue;
  const m = at(d);
  const ids = [...m.keys()].filter(id => base.has(id));
  if (!ids.length) continue;
  const ds = ids.map(id => Math.abs(m.get(id)!.storeys - base.get(id)!.storeys));
  const db = ids.map(id => Math.abs(m.get(id)!.bays - base.get(id)!.bays));
  const dop = ids.map(id => Math.abs(m.get(id)!.openings - base.get(id)!.openings));
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const unchanged = 100 * ds.filter(x => x === 0).length / ds.length;
  console.log(`${(d > 0 ? '+' : '') + d.toFixed(2)}`.padStart(8) + String(ids.length).padStart(6) +
    mean(ds).toFixed(2).padStart(15) + `${unchanged.toFixed(0)}%`.padStart(12) +
    mean(db).toFixed(2).padStart(14) + mean(dop).toFixed(2).padStart(17));
}

// Does stability predict correctness? If a building whose storey count survives
// a deliberate ±0.1 m nudge also agrees better with 3DBAG, then invariance is a
// usable confidence signal and the fragile readings can be held back rather than
// published. If it predicts nothing, invariance is just a second kind of noise.
const houses = JSON.parse(await readFile(path.join(STAGING, 'house-records.json'), 'utf8')).houses as
  Record<string, { pandId: string; storeys?: { value: number } }>;
const declared = new Map<string, number>();
for (const h of Object.values(houses)) if (h.storeys && h.storeys.value > 0) declared.set(h.pandId, h.storeys.value);

const nudges = DELTAS.filter(d => d !== 0 && Math.abs(d) <= 0.1);
if (nudges.length && declared.size) {
  // Both exclusions matter and I first reported this figure without either. A
  // pand whose 3DBAG `storeys` is 0 has no declared value -- 0 is the missing
  // marker -- and a reading with no storey bands is the absence of a measurement.
  // Counting the second against the first put the MAE at 1.21 instead of 0.76.
  const ids = [...base.keys()].filter(id => declared.has(id) && base.get(id)!.storeys > 0);
  const stable = ids.filter(id => nudges.every(d => at(d).get(id)?.storeys === base.get(id)!.storeys));
  const shaky = ids.filter(id => !stable.includes(id));
  const report = (label: string, group: string[]) => {
    if (!group.length) return console.log(`${label.padEnd(28)} n=0`);
    const err = group.map(id => base.get(id)!.storeys - declared.get(id)!);
    const mae = err.reduce((s, x) => s + Math.abs(x), 0) / err.length;
    const bias = err.reduce((s, x) => s + x, 0) / err.length;
    const exact = 100 * err.filter(x => x === 0).length / err.length;
    const within1 = 100 * err.filter(x => Math.abs(x) <= 1).length / err.length;
    console.log(`${label.padEnd(28)} n=${String(group.length).padStart(4)}  bias ${bias >= 0 ? '+' : ''}${bias.toFixed(2)}  MAE ${mae.toFixed(2)}  exact ${exact.toFixed(0)}%  within1 ${within1.toFixed(0)}%`);
  };
  console.log(`\nagainst 3DBAG's declared storeys, split by invariance under ±${Math.max(...nudges.map(Math.abs))} m:`);
  report('  survives the nudge', stable);
  report('  moves under the nudge', shaky);
  report('  everything', ids);
}

/**
 * Does a weak peak predict a reading that will not hold still?
 *
 * The ladder search always returns a winner. If the winner that barely outscores
 * the field is also the one a nudge dislodges, prominence is a usable refusal
 * criterion and the fix is the same one the registration check already got.
 */
if (nudges.length) {
  const ids = [...base.keys()].filter(id => base.get(id)!.storeys > 0);
  const held = (id: string) => nudges.every(d => at(d).get(id)?.storeys === base.get(id)!.storeys);
  const bands: Array<[string, (p: number) => boolean]> = [
    ['below 1.0σ', p => p < 1.0], ['1.0–1.5σ', p => p >= 1.0 && p < 1.5],
    ['1.5–2.0σ', p => p >= 1.5 && p < 2.0], ['2.0σ and above', p => p >= 2.0],
  ];
  console.log(`\nladder peak prominence against survival of a ±${Math.max(...nudges.map(Math.abs))} m nudge:`);
  console.log('  prominence          n    holds still');
  for (const [label, test] of bands) {
    const g = ids.filter(id => test(base.get(id)!.prominence));
    if (!g.length) continue;
    const kept = g.filter(held).length;
    console.log(`  ${label.padEnd(18)}${String(g.length).padStart(4)}    ${(100 * kept / g.length).toFixed(0)}%`);
  }
}

/**
 * Which of the three gates changes its mind?
 *
 * Confirming an opening is a darkness floor, then a width range, then a height
 * range, and the box the last two judge is trimmed at a fraction of the first
 * one's mean -- so a nudge can move a cell across any of them, and across the
 * later ones by way of the first. Fixing the wrong gate would be effort spent
 * where the flips are not.
 */
if (nudges.length) {
  const flips: Record<string, number> = {};
  let cells = 0, changed = 0;
  for (const d of nudges) {
    const m = at(d);
    for (const [id, r] of m) {
      const b = base.get(id);
      if (!b) continue;
      // Cells are matched by position in the scan, which is stable: bands and
      // bays are enumerated in the same order for the same façade.
      const n = Math.min(b.gates.length, r.gates.length);
      for (let i = 0; i < n; i++) {
        cells++;
        const was = b.gates[i].verdict, now = r.gates[i].verdict;
        if (was === now) continue;
        changed++;
        flips[`${was} → ${now}`] = (flips[`${was} → ${now}`] ?? 0) + 1;
      }
    }
  }
  console.log(`\nopening gates: ${changed} of ${cells} cells changed their verdict under the nudge (${(100 * changed / cells).toFixed(1)}%)`);
  for (const [k, v] of Object.entries(flips).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${String(v).padStart(4)}  ${(100 * v / changed).toFixed(0)}%`);
  }
  // How close does a confirmed opening sit to the floor it had to clear?
  const means = [...base.values()].flatMap(r => r.gates.filter(g => g.verdict === 'confirmed').map(g => g.mean)).sort((a, b) => a - b);
  if (means.length) {
    const qq = (f: number) => means[Math.floor(f * means.length)];
    console.log(`\n  confirmed cells' mean score: p10 ${qq(0.1).toFixed(3)}  p50 ${qq(0.5).toFixed(3)}  p90 ${qq(0.9).toFixed(3)}  (floor 0.14)`);
    console.log(`  within 0.02 of the floor: ${(100 * means.filter(m => m < 0.16).length / means.length).toFixed(0)}%`);
  }
}

const out = path.join(CACHE, 'lens-sensitivity.json');
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), deltas: DELTAS, rows }, null, 2));
console.log(`\nwrote ${path.relative(process.cwd(), out)}`);
