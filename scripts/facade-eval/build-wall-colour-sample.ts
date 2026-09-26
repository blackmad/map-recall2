/**
 * Freeze a wall-colour grading queue the review page can serve.
 *
 * The crops are already served from `public/data/city-expansion/evidence/`, so
 * nothing is copied — the sample references them by content hash. What this
 * adds is the queue: the measured colour, a brighter alternative, the trust
 * indicators, and a `sha256` over the whole payload that every exported grade
 * is bound to. `facade/appearancePublication.ts` refuses a grade whose
 * `sourceSha256` no longer matches the evidence, so re-measuring invalidates
 * grades rather than silently inheriting them.
 *
 * Why two candidate colours rather than one. The dominant-cluster estimator
 * lands close to the mean of the building pixels, which on brick includes
 * mortar lines, shadowed reveals and window frames — measurably darker than the
 * brick face itself. Whether that is the right colour to paint a building in
 * the game is a judgement, not a measurement, so the page offers the cluster
 * colour and a brighter one from the same pixels and asks which matches. The
 * distribution of those answers calibrates the estimator: if the owner picks
 * the brighter candidate most of the time, the bias is real and can be folded
 * back in, and if they split, it is per-facade and no constant would have
 * fixed it.
 *
 * Usage: npx tsx scripts/facade-eval/build-wall-colour-sample.ts [--limit=N]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const LIMIT = Number(arg('limit') ?? 0);

const IN = 'review-data/wall-colour/v1/measurements.json';
const OUT_DIR = 'public/data/wall-colour/v1';

interface Entry {
  observationId: string;
  buildingId: string;
  address: string | null;
  street: string | null;
  year: number | null;
  capturedAt: string | null;
  /** Served path of the crop this grade is about. */
  crop: string;
  sourceSha256: string;
  /** The dominant-cluster answer. */
  hex: string | null;
  family: string | null;
  material: string | null;
  /** Share of usable pixels the winning cluster holds. */
  share: number | null;
  reliable: boolean;
  review: string[];
  runnerUpHex: string | null;
  runnerUpShare: number | null;
  /** The percentile estimator, shown only where the two disagree sharply. */
  percentileHex: string | null;
  /** Distance between the two estimators, in RGB units. */
  estimatorGap: number | null;
  buildingFraction: number | null;
  castBlueMinusRed: number | null;
  /** Rows to metres above the pavement; see `measure-wall-colour.ts`. */
  metricFrame: {
    baseZ: number; topZ: number; groundNAP: number | null;
    cropHeightPx: number; metresPerPixel: number;
  } | null;
}

const doc = JSON.parse(await readFile(IN, 'utf8')) as { measurements: any[] };
const entries: Entry[] = [];
for (const m of doc.measurements) {
  if (m.status !== 'measured' || !m.dominant) continue;
  const gap = m.sample && m.dominant
    ? Math.hypot(m.sample.rgb[0] - m.dominant.rgb[0], m.sample.rgb[1] - m.dominant.rgb[1], m.sample.rgb[2] - m.dominant.rgb[2])
    : null;
  entries.push({
    observationId: m.id,
    buildingId: m.buildingId,
    address: m.address,
    street: m.street,
    year: m.year,
    capturedAt: m.capturedAt,
    crop: `/data/city-expansion/evidence/${m.sourceSha256}.jpg`,
    sourceSha256: m.sourceSha256,
    hex: m.dominant.hex,
    family: m.dominant.family,
    material: m.dominant.material,
    share: m.dominant.fraction,
    reliable: Boolean(m.dominant.reliable),
    review: m.dominant.review ?? [],
    runnerUpHex: m.dominant.runnerUp?.hex ?? null,
    runnerUpShare: m.dominant.runnerUp?.fraction ?? null,
    percentileHex: m.sample?.hex ?? null,
    estimatorGap: gap === null ? null : Math.round(gap),
    buildingFraction: m.buildingFraction,
    castBlueMinusRed: m.castBlueMinusRed === null ? null : Math.round(m.castBlueMinusRed),
    metricFrame: m.metricFrame ?? null,
  });
}

const queue = LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
const payload = { version: 1, builtAt: new Date().toISOString(), source: IN, entries: queue };
const body = JSON.stringify(payload);
const sha256 = createHash('sha256').update(body).digest('hex');

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'sample.json'), `${JSON.stringify({ ...payload, sha256 }, null, 1)}\n`);

const unreliable = queue.filter(e => !e.reliable).length;
console.log(`${queue.length} entries, ${unreliable} flagged unreliable (they lead the queue)`);
console.log(`sha256 ${sha256.slice(0, 16)}…`);
console.log(`wrote ${OUT_DIR}/sample.json`);
