/**
 * Is an inferred lens height as good as a datum-corrected published one?
 *
 * 15,312 frames — every panorama from 2024 and 2025 — publish no camera height,
 * and `lensHeightNap` infers one from the ground beneath the camera. The claim
 * beside it is that the inference "is worth about a metre, the same order as the
 * per-track datum offset already carried by every frame that does publish a
 * height". That was reasoning, not measurement, and it is the claim that decides
 * whether the newest imagery in the archive can be used for identity.
 *
 * This measures it, on the frames where both answers exist: take a frame that
 * publishes a height, correct it with its solved track datum, then ask
 * `lensHeightNap` what it would have inferred had the height been missing, and
 * compare. Reuses the pipeline's own functions rather than restating them, so
 * what passes here is what the pipeline does.
 *
 * Usage: npx tsx scripts/facade-twin/check-inferred-height.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { hasUsablePose, lensHeightNap } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { loadTrackOffsets } from './panorama-render.ts';
import type { LngLat, MassingRecord, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const offsetOf = await loadTrackOffsets(CACHE);

// The ground beneath a camera is the ground of the nearest building whose
// massing we have — the same approximation the pipeline makes when it hands a
// building's groundLevel to resolveLens.
const CELL = 60;
const cells = new Map<string, Array<{ p: ProjectedPoint; groundZ: number }>>();
for (const entry of registry) {
  const groundZ = massing.get(entry.buildingId)?.groundLevel;
  if (!Number.isFinite(groundZ as number)) continue;
  const p = RD_NEW.fromLngLat(entry.footprintLngLat[0]);
  const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
  (cells.get(key) ?? cells.set(key, []).get(key)!).push({ p, groundZ: groundZ as number });
}
const groundAt = (p: ProjectedPoint) => {
  const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
  let best: { d: number; groundZ: number } | null = null;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const b of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
      const d = (b.p.x - p.x) ** 2 + (b.p.y - p.y) ** 2;
      if (!best || d < best.d) best = { d, groundZ: b.groundZ };
    }
  }
  return best && best.d < CELL * CELL ? best.groundZ : null;
};

const errors: number[] = [];
let noGround = 0, noDatum = 0, noHeight = 0;
for (const view of views) {
  if (!hasUsablePose(view)) { noHeight++; continue; }
  const solved = offsetOf(view);
  if (solved.source === 'none') { noDatum++; continue; }
  const groundZ = groundAt(RD_NEW.fromLngLat(view.lngLat));
  if (groundZ === null) { noGround++; continue; }
  const published = lensHeightNap(view, groundZ);
  const inferred = lensHeightNap({ ...view, cameraHeight: 0 }, groundZ);
  if (!published || !inferred || published.inferred) continue;
  errors.push(inferred.z - (published.z - solved.offsetM));
}

if (errors.length < 500) {
  console.error(`only ${errors.length} frames could be compared — too few to conclude`);
  process.exit(1);
}
errors.sort((a, b) => a - b);
const q = (f: number) => errors[Math.floor(f * errors.length)];
const mean = errors.reduce((s, x) => s + x, 0) / errors.length;
const within = (m: number) => (100 * errors.filter(e => Math.abs(e) <= m).length / errors.length);

console.log(`Inferred lens height against the datum-corrected published one\n`);
console.log(`  ${errors.length} frames compared (${noHeight} publish no height, ${noDatum} have no solved datum, ${noGround} no ground beneath)`);
console.log(`  error  p05 ${q(0.05).toFixed(2)}  p25 ${q(0.25).toFixed(2)}  median ${q(0.5).toFixed(2)}  p75 ${q(0.75).toFixed(2)}  p95 ${q(0.95).toFixed(2)} m`);
console.log(`  mean ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} m — within 0.5 m on ${within(0.5).toFixed(0)}%, within 1 m on ${within(1).toFixed(0)}%\n`);

/**
 * The bar is the claim the code makes about itself: "worth about a metre".
 *
 * A band aimed at a door is the most height-sensitive thing built here — at a 4 m
 * standoff half a metre of lens error is about seven degrees of aim — so this is
 * the number that decides whether the 2024–2025 frames can carry identity work.
 */
const BAR_M = 1.0;
if (Math.abs(q(0.5)) > BAR_M || within(1) < 60) {
  console.error(`FAIL — the inference is worse than the metre the code claims for it.`);
  process.exit(1);
}
console.log(`PASS — the inference holds to about a metre, which is the order of the datum offset`);
console.log(`       every published height already carries. Horizontal work may use these frames;`);
console.log(`       anything vertical must still check the inferred flag.`);
