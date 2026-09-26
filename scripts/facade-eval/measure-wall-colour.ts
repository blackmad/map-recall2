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
 * Two estimators run on every crop, because the first one is not trustworthy
 * here and the comparison is the evidence for that:
 *
 *   - `sampleWallColour` (a luma percentile) runs unmasked, because
 *     `machineRoutingProposal` carries no opening or trim geometry for this
 *     district. On a facade that is roughly half brick, a third blue-reflecting
 *     glass and a tenth white trim, a percentile lands *between* the parts:
 *     Da Costakade 77, plainly dark brick, measured `#3f6b6e` — teal — with
 *     `lumaSpread` at 177 of 255 honestly reporting that the crop is not one
 *     colour.
 *   - `dominantWallColour` takes the largest coherent colour cluster among
 *     pixels the Mapillary-Vistas segmentation calls building, which removes
 *     sky, vegetation, vehicles and people outright, and rejects trim, shadowed
 *     glass and blue-dominant bins before ranking.
 *
 * Capture year is recorded because campaigns are not colour-comparable. Over
 * all 598 crops, building pixels run red-dominant as masonry should, but by
 * different amounts: mean (blue − red) is −15.7 in 2022, −12.0 in 2023, −24.7
 * in 2024 and −2.4 in 2025. The 2025 campaign is the coldest by about 20
 * points against 2024, so the same wall photographed in the two years does not
 * measure the same colour. (An earlier reading of this on the first 120 records
 * put 2025 at +7.9 and called it 30 points; that sample was the head of a queue
 * sorted by luma spread, so it was the least typical crops, not a random draw.
 * The full-set numbers above are the ones to trust.)
 *
 * Masks come from `scripts/roofline-eval/segment.py --method s1` over the same
 * crops; label 2 is building. Re-run it if the crop set changes.
 *
 * Usage: npx tsx scripts/facade-eval/measure-wall-colour.ts [--release=<id prefix>] [--masks=<dir>]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { sampleWallColour, type RgbImage, type WallColourSample } from '../../src/canalRecall/facade/wallColourSample.ts';
import { dominantWallColour, type DominantWallColour } from '../../src/canalRecall/facade/dominantWallColour.ts';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const RELEASES = 'public/data/city-expansion/releases';
const EVIDENCE = 'public/data/city-expansion/evidence';
const OUT_DIR = 'review-data/wall-colour/v1';
const MASKS = arg('masks') ?? '.cache/wall-colour/seg/masks/s1';
/** The segmentation's label for building, including roof. See segment.py. */
const BUILDING = 2;

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
  /** The percentile estimator, kept as the comparison that justifies the other. */
  sample: WallColourSample | null;
  /** The estimator whose answer is offered to the grader. */
  dominant: DominantWallColour | null;
  /**
   * What an image row means in metres. Without this a consumer can only reason
   * in fractions of the crop, and a fraction means something different on a
   * two-storey building than on a five-storey one — which is why a fractional
   * search window fails across a mixed street. An Amsterdam shopfront boundary
   * sits about 2.5–6 m above the pavement whatever is stacked above it.
   *
   * Row 0 is the top of the crop. NAP at row r is
   * `topZ - (r / cropHeightPx) * (topZ - baseZ)`, and metres above the pavement
   * is that minus `groundNAP`.
   */
  metricFrame: {
    baseZ: number;
    topZ: number;
    groundNAP: number | null;
    cropHeightPx: number;
    metresPerPixel: number;
  } | null;
  /** Fraction of the crop the segmentation calls building. */
  buildingFraction: number | null;
  /** Mean (blue − red) over building pixels: the campaign's colour cast. */
  castBlueMinusRed: number | null;
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

  const empty = { sample: null, dominant: null, buildingFraction: null, castBlueMinusRed: null, metricFrame: null };
  const file = image?.sha256 ? path.join(EVIDENCE, `${image.sha256}.jpg`) : null;
  if (!file || !existsSync(file)) {
    measurements.push({ ...base, ...empty, status: 'unusable', reason: 'crop not on disk' });
    unusable += 1;
    continue;
  }

  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb: RgbImage = { data, width: info.width, height: info.height, channels: 3 };

  // Rows to metres. Taken from the decoded height, not the recorded one, so a
  // resized crop still converts correctly.
  const plane = image.plane;
  const metricFrame = plane && Number.isFinite(plane.baseZ) && Number.isFinite(plane.topZ)
    ? {
      baseZ: plane.baseZ,
      topZ: plane.topZ,
      groundNAP: payload.groundNAP ?? null,
      cropHeightPx: info.height,
      metresPerPixel: (plane.topZ - plane.baseZ) / info.height,
    }
    : null;

  // The segmentation mask, resized to the crop if the segmenter tiled it at a
  // different scale. 1 marks a pixel the estimator may use.
  let mask: Uint8Array | null = null;
  let buildingFraction: number | null = null;
  let cast: number | null = null;
  const maskFile = path.join(MASKS, `${image.sha256}.mask.png`);
  if (existsSync(maskFile)) {
    const raw = await sharp(maskFile).resize(info.width, info.height, { kernel: 'nearest' })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const labels = raw.data;
    const channels = raw.info.channels;
    mask = new Uint8Array(info.width * info.height);
    let building = 0;
    let sumR = 0;
    let sumB = 0;
    for (let i = 0; i < mask.length; i += 1) {
      if (labels[i * channels] !== BUILDING) continue;
      mask[i] = 1;
      building += 1;
      sumR += data[i * 3];
      sumB += data[i * 3 + 2];
    }
    buildingFraction = building / mask.length;
    cast = building > 0 ? (sumB - sumR) / building : null;
  }

  const sample = sampleWallColour(rgb, []);
  const dominant = dominantWallColour(rgb, mask);
  if (!sample && !dominant) {
    measurements.push({ ...base, ...empty, buildingFraction, castBlueMinusRed: cast, metricFrame,
      status: 'unusable', reason: 'no estimator found a usable wall' });
    unusable += 1;
    continue;
  }
  measurements.push({ ...base, status: 'measured', sample, dominant, buildingFraction, castBlueMinusRed: cast, metricFrame });
  measured += 1;
}

/** Least trustworthy first. An unreliable cluster — too small a share, or a
 *  runner-up nearly as large — means a genuinely two-tone or occluded facade,
 *  and those are the ones a human should see soonest. Within each group, the
 *  widest luma spread leads. */
measurements.sort((a, b) => {
  const rank = (m: Measurement) => (m.dominant ? (m.dominant.reliable ? 1 : 0) : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return (b.sample?.lumaSpread ?? -1) - (a.sample?.lumaSpread ?? -1);
});

const body = JSON.stringify({ version: 1, crop: CROP, release: path.basename(dir), measurements }, null, 2);
const sha256 = createHash('sha256').update(body).digest('hex');
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'measurements.json'), `${body}\n`);
await writeFile(path.join(OUT_DIR, 'measurements.sha256'), `${sha256}\n`);

console.log(`measured ${measured}, unusable ${unusable}`);

const reliable = measurements.filter(m => m.dominant?.reliable).length;
const withMask = measurements.filter(m => m.buildingFraction !== null).length;
console.log(`segmentation masks for ${withMask}; dominant cluster reliable on ${reliable} of ${measured}`);

const families = new Map<string, number>();
for (const m of measurements) {
  if (!m.dominant) continue;
  families.set(m.dominant.family, (families.get(m.dominant.family) ?? 0) + 1);
}
console.log('families (dominant):', [...families].map(([k, v]) => `${k} ${v}`).join(', '));

/** How far apart the two estimators land. A large median gap is the argument
 *  for having replaced the percentile; a small one would mean the extra
 *  machinery bought nothing. */
const distances: number[] = [];
for (const m of measurements) {
  if (!m.sample || !m.dominant) continue;
  const [r1, g1, b1] = m.sample.rgb;
  const [r2, g2, b2] = m.dominant.rgb;
  distances.push(Math.hypot(r1 - r2, g1 - g2, b1 - b2));
}
distances.sort((a, b) => a - b);
if (distances.length) {
  const at = (q: number) => distances[Math.floor(distances.length * q)].toFixed(0);
  console.log(`percentile vs cluster RGB distance: median ${at(0.5)}, p90 ${at(0.9)}, max ${distances.at(-1)!.toFixed(0)}`);
}

const casts = measurements.filter(m => m.castBlueMinusRed !== null && m.capturedAt);
const byYear = new Map<string, number[]>();
for (const m of casts) {
  const year = m.capturedAt!.slice(0, 4);
  (byYear.get(year) ?? byYear.set(year, []).get(year)!).push(m.castBlueMinusRed!);
}
console.log('colour cast by capture year (mean blue − red on building pixels):');
for (const year of [...byYear.keys()].sort()) {
  const values = byYear.get(year)!;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  console.log(`  ${year}: n=${values.length} ${mean >= 0 ? '+' : ''}${mean.toFixed(1)}`);
}

console.log(`\nwrote ${OUT_DIR}/measurements.json (sha256 ${sha256.slice(0, 16)}…)`);
