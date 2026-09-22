/**
 * Did the headroom actually free the roofline?
 *
 * A0 re-cuts the strips with sky above the 3DBAG ridge, and the only question
 * that decides whether the re-cut worked is: how many columns were brick right
 * up to the top edge before, and how many are now. Until a segmentation model
 * exists (A1), the luminance floor from `skyline` answers it — crudely, but the
 * same way at both ends, so the difference is meaningful.
 *
 * This reads two generated strip sets, measures each strip, reports the share
 * before and after for the walls that appear in both, writes a JSON report and
 * a contact-sheet PNG into the *after* directory. It writes nothing outside the
 * output directory.
 *
 * Usage (paths may be absolute; run with the repository's cache as cwd):
 *   npx tsx scripts/roofline-eval/clipped-column-report.ts \
 *     --before=<dir> --after=<dir> [--out=<dir>] [--sheet=<png>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { topClippedShare } from '../../src/canalRecall/facade/skyline.ts';

const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = path.resolve(arg('before') ?? '.cache/facade-twin/strips-confident');
const AFTER = path.resolve(arg('after') ?? '.cache/facade-twin/strips-roofline-v1');
const OUT = path.resolve(arg('out') ?? AFTER);
const SHEET = path.resolve(arg('sheet') ?? path.join(OUT, 'contact-sheet-roofline.png'));

interface StripRecord {
  file: string;
  pandId: string;
  address: string | null;
  viewIndex?: number;
  sourceMeanLuma?: number;
}
interface Manifest {
  metadata: any;
  strips: StripRecord[];
}

const readManifest = async (dir: string): Promise<Manifest> =>
  JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));

interface Measured { strip: StripRecord; share: number; meanLuma: number }

async function measure(dir: string, strip: StripRecord): Promise<Measured> {
  try {
    const image = jpeg.decode(await readFile(path.join(dir, strip.file)), { useTArray: true, formatAsRGBA: true });
    const data = Uint8ClampedArray.from(image.data);
    let sum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4 * 31) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    return {
      strip,
      share: topClippedShare({ width: image.width, height: image.height, data }),
      meanLuma: count ? sum / count : 0,
    };
  } catch { return { strip, share: 0, meanLuma: 0 }; }
}

function pool(measured: Measured[]): { share: number | null; strips: number } {
  if (!measured.length) return { share: null, strips: 0 };
  const mean = measured.reduce((sum, m) => sum + m.share, 0) / measured.length;
  return { share: mean, strips: measured.length };
}

const pct = (value: number | null) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);

const beforeManifest = await readManifest(BEFORE);
const afterManifest = await readManifest(AFTER);

const before: Measured[] = [];
const after: Measured[] = [];
for (const strip of beforeManifest.strips) before.push(await measure(BEFORE, strip));
for (const strip of afterManifest.strips) after.push(await measure(AFTER, strip));

const beforePands = new Set(before.map(m => m.strip.pandId));
const matchedBefore = before.filter(m => afterManifest.strips.some(s => s.pandId === m.strip.pandId));
const matchedAfter = after.filter(m => beforePands.has(m.strip.pandId));

const report = {
  generatedAt: new Date().toISOString(),
  method: 'absolute luminance+colour sky test (skyline.ts topClippedColumns): first 4 rows, '
    + 'luma >= 140 and blue not more than 10 luma below red',
  before: {
    dir: BEFORE, strips: beforeManifest.strips.length,
    headroomM: beforeManifest.metadata?.headroomM ?? 0.5,
    pooled: pool(before),
  },
  after: {
    dir: AFTER, strips: afterManifest.strips.length,
    headroomM: afterManifest.metadata?.headroomM ?? null,
    viewsPerWall: afterManifest.metadata?.viewsPerWall ?? null,
    dropOuts: afterManifest.metadata?.dropOuts ?? null,
    pooled: pool(after),
  },
  matched: {
    pands: new Set(matchedAfter.map(m => m.strip.pandId)).size,
    before: pool(matchedBefore),
    after: pool(matchedAfter),
  },
  strips: {
    before: before.map(m => ({ file: m.strip.file, pandId: m.strip.pandId, share: m.share, meanLuma: m.meanLuma })),
    after: after.map(m => ({ file: m.strip.file, pandId: m.strip.pandId, viewIndex: m.strip.viewIndex ?? 1, share: m.share, meanLuma: m.meanLuma })),
  },
  // A strip is "garbage" when both it and the frame it was cut from are dark:
  // the render is then mostly JPEG grain, which no geometry gate can see. Both
  // conditions are needed — a canal panorama is dark overall because of the
  // water in the nadir while its façade is perfectly exposed, and a dark strip
  // can be a genuinely dark building on a bright frame.
  garbageSuspects: {
    thresholds: { stripMeanLuma: 70, sourceMeanLuma: 80 },
    before: before.filter(m => m.meanLuma < 70 && (m.strip.sourceMeanLuma ?? Infinity) < 80)
      .map(m => ({ file: m.strip.file, address: m.strip.address, sourceMeanLuma: m.strip.sourceMeanLuma ?? null, stripMeanLuma: Number(m.meanLuma.toFixed(1)) })),
    after: after.filter(m => m.meanLuma < 70 && (m.strip.sourceMeanLuma ?? Infinity) < 80)
      .map(m => ({ file: m.strip.file, address: m.strip.address, viewIndex: m.strip.viewIndex ?? 1, sourceMeanLuma: m.strip.sourceMeanLuma ?? null, stripMeanLuma: Number(m.meanLuma.toFixed(1)) })),
  },
};

await mkdir(OUT, { recursive: true });
const reportPath = path.join(OUT, 'clipped-columns.json');
await writeFile(reportPath, JSON.stringify(report, null, 1));

// ---- contact sheet ---------------------------------------------------------
// Before and after, per wall, so the headroom is judged by looking rather than
// by the number above. ImageMagick is used because it is the only text-rendering
// image tool the project already has on this machine; the JSON report is the
// self-contained artefact and this PNG is its picture.
const afterByPand = new Map<string, Measured[]>();
for (const measured of after) {
  (afterByPand.get(measured.strip.pandId) ?? afterByPand.set(measured.strip.pandId, []).get(measured.strip.pandId)!)
    .push(measured);
}
const beforeByPand = new Map<string, Measured>();
for (const measured of before) if (!beforeByPand.has(measured.strip.pandId)) beforeByPand.set(measured.strip.pandId, measured);

const FONT = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(f => existsSync(f));
const args: string[] = ['-background', '#f5f4ef', '-fill', '#1a1c1a', '-pointsize', '13',
  '-tile', '6x', '-geometry', '200x320+6+8'];
if (FONT) args.push('-font', FONT);
let tiles = 0;
for (const pandId of [...afterByPand.keys()].sort()) {
  const address = afterByPand.get(pandId)![0].strip.address ?? pandId;
  const prior = beforeByPand.get(pandId);
  if (prior) {
    args.push('-label', `${address}\nBEFORE  clipped ${pct(prior.share)}`);
    args.push(path.join(BEFORE, prior.strip.file));
    tiles++;
  }
  for (const measured of afterByPand.get(pandId)!) {
    args.push('-label', `${address}\nAFTER v${measured.strip.viewIndex ?? 1}  clipped ${pct(measured.share)}`);
    args.push(path.join(AFTER, measured.strip.file));
    tiles++;
  }
}
let sheetWritten = false;
try {
  execFileSync('montage', [...args, SHEET], { stdio: 'inherit' });
  sheetWritten = true;
} catch (error) {
  console.error(`contact sheet: montage failed (${(error as Error).message}); JSON report is at ${reportPath}`);
}

const drop = afterManifest.metadata?.dropOuts;
if (drop) console.log(`after run drop-outs: ${JSON.stringify(drop)}`);
console.log(`strips: before ${beforeManifest.strips.length}, after ${afterManifest.strips.length} (montage tiles ${tiles})`);
console.log(`clipped columns (mean per strip, ${report.method}):`);
console.log(`  before  ${pct(report.before.pooled.share)} over ${report.before.pooled.strips} strips`);
console.log(`  after   ${pct(report.after.pooled.share)} over ${report.after.pooled.strips} strips`);
console.log(`  matched ${report.matched.pands} walls: ${pct(report.matched.before.share)} → ${pct(report.matched.after.share)}`);
const g = report.garbageSuspects;
console.log(`  garbage suspects (strip luma < ${g.thresholds.stripMeanLuma} and source luma < ${g.thresholds.sourceMeanLuma}): `
  + `before ${g.before.length}, after ${g.after.length}`);
for (const s of g.after) console.log(`    after  ${s.address} v${s.viewIndex}  source luma ${s.sourceMeanLuma}  strip luma ${s.stripMeanLuma}`);
if (sheetWritten) console.log(`→ ${SHEET}`);
console.log(`→ ${reportPath}`);
