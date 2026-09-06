/**
 * Is the published camera height believable?
 *
 * `defectsOf` has always rejected a height of zero, because Amsterdam publishes a
 * missing value as a zero and "a missing value must never be arithmetic". That
 * caught 15,312 frames — all of 2024 and 2025 — and it was the whole of the
 * check. A height that is *present but nonsense* went straight through.
 *
 * They exist. Measured against the ground beneath the camera across the frames
 * that publish a height, the lens sits **2.45 m** up at the median — the survey
 * van, matching `SURVEY_LENS_ABOVE_GROUND_M` to a centimetre — and the
 * distribution is tight through p95 at 4.65 m and p99 at 10.66 m, then runs away
 * to 97 m.
 *
 * They are corrupt rather than unusual. `TMX7316010203-002952_pano_0003_000616`
 * publishes 106.1 m and shows an ordinary canal-side street from about two
 * metres, the van's own roof rack in the bottom of the frame.
 *
 * What believing one costs: the band is aimed 60 m downwards, the projection
 * lands in the panorama's black nadir cap — which begins at −57° elevation — and
 * the tile returns solid black. Four of the 400 bands in the number-band store
 * are black for exactly this reason, and every one was filed `unread`, which
 * reads as "the doorplate was illegible" rather than "we photographed the
 * ground". `missingFraction` did not catch it either, because the sample lands
 * *inside* the image; the pixels there are simply black.
 *
 * `lensHeightNap` now treats such a height as missing and infers from the ground
 * instead, reporting `inferred: true` — the same path the 2024–25 frames take.
 * This measures how often that fires, and holds a bar under it.
 *
 * Usage: npx tsx scripts/facade-twin/check-lens-height.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { lensHeightNap } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, MassingRecord, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

// Corrupt heights are rare and clustered in a few survey tracks. Above this share
// something has changed about the feed and the guard is doing more than tidying.
const REJECT_BAR = 0.03;

const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));

// The ground beneath a camera is the ground of the nearest building we have
// massing for — the same approximation the pipeline makes elsewhere.
const CELL = 60;
const cells = new Map<string, Array<{ p: ProjectedPoint; groundZ: number }>>();
for (const e of registry) {
  const g = massing.get(e.buildingId)?.groundLevel;
  if (!Number.isFinite(g as number)) continue;
  const p = RD_NEW.fromLngLat(e.footprintLngLat[0]);
  const k = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
  (cells.get(k) ?? cells.set(k, []).get(k)!).push({ p, groundZ: g as number });
}
const groundAt = (p: ProjectedPoint) => {
  let best: number | null = null, bd = Infinity;
  for (let gx = Math.floor(p.x / CELL) - 1; gx <= Math.floor(p.x / CELL) + 1; gx++)
    for (let gy = Math.floor(p.y / CELL) - 1; gy <= Math.floor(p.y / CELL) + 1; gy++)
      for (const c of cells.get(`${gx},${gy}`) ?? []) {
        const d = (c.p.x - p.x) ** 2 + (c.p.y - p.y) ** 2;
        if (d < bd) { bd = d; best = c.groundZ; }
      }
  return best;
};

let publishes = 0, zeroHeight = 0, noGround = 0, rejected = 0;
const heights: number[] = [];
const perTrack = new Map<string, number>();
const worst: Array<{ id: string; published: number; aboveGround: number }> = [];
for (const v of views) {
  const groundZ = groundAt(RD_NEW.fromLngLat(v.lngLat));
  if (!v.cameraHeight) { zeroHeight++; continue; }
  publishes++;
  if (groundZ == null) { noGround++; continue; }
  const lens = lensHeightNap(v, groundZ);
  if (!lens) continue;
  // The guard fired when a frame that publishes a height still comes back inferred.
  if (lens.inferred) {
    rejected++;
    const track = v.panoramaId.split('_pano_')[0];
    perTrack.set(track, (perTrack.get(track) ?? 0) + 1);
    worst.push({ id: v.panoramaId, published: v.cameraHeight, aboveGround: v.cameraHeight - 43.5 - groundZ });
  } else {
    heights.push(lens.z - groundZ);
  }
}

heights.sort((a, b) => a - b);
const q = (p: number) => heights[Math.min(heights.length - 1, Math.floor(p * heights.length))];
console.log('\nIs the published camera height believable?\n');
console.log(`  ${views.length} frames — ${zeroHeight} publish zero (the known 2024–25 batches), ${publishes} publish a height`);
console.log(`  ${noGround} have no building near enough to give a ground level`);
console.log('\n  accepted frames, lens above the ground beneath it:');
for (const p of [0.01, 0.05, 0.5, 0.95, 0.99]) console.log(`    p${(100 * p).toFixed(0).padStart(3)}  ${q(p).toFixed(2)} m`);
console.log(`    min ${heights[0]?.toFixed(2)}   max ${heights[heights.length - 1]?.toFixed(2)}`);
console.log(`\n  rejected as implausible and inferred instead: ${rejected}  (${(100 * rejected / publishes).toFixed(2)}% of frames that publish one)`);
if (worst.length) {
  console.log('\n  the tallest claims:');
  for (const w of worst.sort((a, b) => b.aboveGround - a.aboveGround).slice(0, 5)) {
    console.log(`    ${w.id.slice(-24)}  published ${w.published.toFixed(1)} m  = ${w.aboveGround.toFixed(1)} m above the street`);
  }
  console.log('\n  by survey track:', [...perTrack].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([t, n]) => `${t.split('-').pop()}:${n}`).join('  '));
  console.log('  Clustered in a few tracks rather than scattered, which is what a datum');
  console.log('  fault in one survey run looks like and not random corruption.');
}

const share = rejected / publishes;
console.log(`\nlens height — ${(100 * (1 - share)).toFixed(2)}% of published heights are believable  (bar ${100 - 100 * REJECT_BAR}%)\n`);
if (share > REJECT_BAR) {
  console.log('FAIL — too many published heights are implausible; the feed or the bound has changed.');
  process.exit(1);
}
console.log('PASS — the implausible minority is caught and inferred from the ground instead.');
