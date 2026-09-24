/**
 * Measure a wall colour per district observation, from the crop's own pixels.
 *
 * The district release already carries a wall colour for 595 of its 598
 * observations — `machineRoutingProposal.wallColour`, a model's word for it.
 * That is the source `facade/wallColourSample.ts` was written to distrust: on
 * the reviewed set it returned white over a whole red-brick facade once and
 * omitted the colour entirely another time. This script measures the pixels
 * instead and carries the model's answer alongside, unused, so a grader can see
 * where the two disagree.
 *
 * Masks: none are available here. `machineRoutingProposal` carries no opening
 * or trim geometry for this district, so `sampleWallColour` runs on the crop
 * with an empty feature list and falls back to what it can do without them —
 * skip the top and bottom margins, exclude near-white joinery, and report a
 * luma percentile of what survives. That is weaker than a masked sample and the
 * output says so: every record carries `wallFraction` and `lumaSpread`, and the
 * grading queue is ordered by `lumaSpread` so the least trustworthy crops are
 * looked at first. When `openingLattice.ts` can supply opening boxes for these
 * walls, pass them in and the sample gets strictly better.
 *
 * Usage: npx tsx scripts/facade-eval/measure-wall-colour.ts [--release=<id prefix>]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { sampleWallColour, type RgbImage, type WallColourSample } from '../../src/canalRecall/facade/wallColourSample.ts';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const RELEASES = 'public/data/city-expansion/releases';
const EVIDENCE = 'public/data/city-expansion/evidence';
const OUT_DIR = 'review-data/wall-colour/v1';

/** Which crop to measure. The full facade is cleaner than the ground band,
 *  which is dominated by shopfronts, awnings, parked cars and people. */
const CROP = 'full' as const;

interface Measurement {
  id: string;
  buildingId: string;
  elevationId: string;
  address: string | null;
  street: string | null;
  year: number | null;
  /** Content hash of the crop the sample was taken from. A grade is bound to
   *  this; if it changes, the grade is stale and must not be re-used. */
  sourceSha256: string;
  cropFile: string;
  capturedAt: string | null;
  status: 'measured' | 'unusable';
  reason?: string;
  sample: WallColourSample | null;
  /** The model's claim, carried for comparison only. Never published. */
  machineWallColour: string | null;
}

const releaseDir = async () => {
  const wanted = arg('release');
  const entries = await readdir(RELEASES);
  const pointer = JSON.parse(await readFile('public/data/city-expansion/current.json', 'utf8')) as { releaseId?: string };
  const id = wanted ?? pointer.releaseId;
  const hit = entries.find(entry => id && entry.startsWith(id));
  if (!hit) throw new Error(`no release directory matches ${id ?? '(no current.json releaseId)'}`);
  return path.join(RELEASES, hit);
};

const tilePaths = async (dir: string) => {
  const zoomDir = path.join(dir, 'tiles', '16');
  const out: string[] = [];
  for (const x of await readdir(zoomDir)) {
    for (const file of await readdir(path.join(zoomDir, x))) {
      if (file.endsWith('.json.gz')) out.push(path.join(zoomDir, x, file));
    }
  }
  return out.sort();
};

const dir = await releaseDir();
console.log(`release ${path.basename(dir).slice(0, 16)}…`);

/** One record per observation, deduplicated: a building spans several tiles. */
const seen = new Set<string>();
const observations: any[] = [];
for (const tile of await tilePaths(dir)) {
  const doc = JSON.parse(gunzipSync(await readFile(tile)).toString('utf8'));
  for (const owner of doc.owners ?? []) {
    for (const observation of owner.observations ?? []) {
      const payload = observation.payload;
      if (!payload?.id || seen.has(payload.id)) continue;
      seen.add(payload.id);
      observations.push(payload);
    }
  }
}
console.log(`${observations.length} observations`);

const measurements: Measurement[] = [];
let measured = 0;
let unusable = 0;
for (const payload of observations) {
  const image = payload.images?.[CROP];
  const base: Omit<Measurement, 'status' | 'sample'> = {
    id: payload.id,
    buildingId: payload.buildingId,
    elevationId: payload.elevationId,
    address: payload.address ?? null,
    street: payload.street ?? null,
    year: payload.year ?? null,
    sourceSha256: image?.sha256 ?? '',
    cropFile: image?.file ?? '',
    capturedAt: image?.date ?? null,
    machineWallColour: payload.machineRoutingProposal?.wallColour ?? null,
  };

  const file = image?.sha256 ? path.join(EVIDENCE, `${image.sha256}.jpg`) : null;
  if (!file || !existsSync(file)) {
    measurements.push({ ...base, status: 'unusable', reason: 'crop not on disk', sample: null });
    unusable += 1;
    continue;
  }

  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb: RgbImage = { data, width: info.width, height: info.height, channels: 3 };
  // No masks: `machineRoutingProposal` carries no opening or trim geometry for
  // this district. The sampler's margins and near-white exclusion do the work.
  const sample = sampleWallColour(rgb, []);
  if (!sample) {
    measurements.push({ ...base, status: 'unusable', reason: 'nothing survived masking', sample: null });
    unusable += 1;
    continue;
  }
  measurements.push({ ...base, status: 'measured', sample });
  measured += 1;
}

/** Least trustworthy first: a wide luma spread is a shadowed, occluded or
 *  mixed crop, and those are the ones a human should see soonest. */
measurements.sort((a, b) => (b.sample?.lumaSpread ?? -1) - (a.sample?.lumaSpread ?? -1));

const body = JSON.stringify({ version: 1, crop: CROP, release: path.basename(dir), measurements }, null, 2);
const sha256 = createHash('sha256').update(body).digest('hex');
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'measurements.json'), `${body}\n`);
await writeFile(path.join(OUT_DIR, 'measurements.sha256'), `${sha256}\n`);

console.log(`measured ${measured}, unusable ${unusable}`);
const families = new Map<string, number>();
const disagree: string[] = [];
for (const m of measurements) {
  if (!m.sample) continue;
  families.set(m.sample.family, (families.get(m.sample.family) ?? 0) + 1);
  if (m.machineWallColour && m.machineWallColour !== 'unknown' && m.machineWallColour !== m.sample.family) {
    disagree.push(`${m.address ?? m.buildingId}: measured ${m.sample.family} (${m.sample.hex}), model said ${m.machineWallColour}`);
  }
}
console.log('families:', [...families].map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`model disagrees with the pixels on ${disagree.length} of ${measured}`);
for (const line of disagree.slice(0, 8)) console.log(`  ${line}`);
console.log(`\nwrote ${OUT_DIR}/measurements.json (sha256 ${sha256.slice(0, 16)}…)`);
