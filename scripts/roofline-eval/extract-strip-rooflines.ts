/**
 * A2: edge-snapped rooflines from the strips in
 * `feat/roofline-strips` (`.cache/facade-twin/strips-roofline-v2`), scored
 * against the A1 Vistas masks (`.cache/roofline-eval/v2/masks/s1`).
 *
 * One JSON per wall (pand), in the exact A2 output format documented in
 * `ROOFLINE_FROM_PHOTOS_PLAN.md` (§0, "A2 output format"), consumed by
 * `build-review-data.ts` and the grading page.
 *
 * Run: npx tsx scripts/roofline-eval/extract-strip-rooflines.ts [--out=DIR]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  consensusProfile, profileShape, resampleProfile, stripBoundaries,
  type Luma, type Mask, type NullReason,
} from '../../src/canalRecall/facade/stripRoofline.ts';
import { profileContentHash, type RooflineProfile, type RooflineProfileView } from '../../src/canalRecall/facade/rooflineGrade.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const cacheRoot = process.env.ROOFLINE_CACHE
  ?? '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const buildingTwinCache = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin';
const stripsDir = path.join(buildingTwinCache, 'strips-roofline-v2');
const masksDir = path.join(cacheRoot, 'roofline-eval/v2/masks/s1');
const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)=(.*)$/.exec(arg);
  if (m) args.set(m[1], m[2]);
}
const outDir = args.get('out') ?? path.join(cacheRoot, 'roofline-eval/strip-profiles');

const UNDEREXPOSED_LUMA = 70;

interface ManifestStrip {
  file: string;
  pandId: string;
  address: string | null;
  panoramaId: string;
  capturedAt: string;
  sourceMeanLuma: number;
  roofBandPixelsPerMetre: number;
  leafOff: boolean;
  frame: StripFrame;
}
interface Manifest { metadata: unknown; strips: ManifestStrip[] }

const manifest = JSON.parse(await readFile(path.join(stripsDir, 'manifest.json'), 'utf8')) as Manifest;

async function loadLuma(file: string): Promise<Luma> {
  const { data, info } = await sharp(path.join(stripsDir, file)).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, values: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

async function loadMask(file: string): Promise<Mask> {
  const maskFile = file.replace(/\.jpg$/i, '.mask.png');
  const maskPath = path.join(masksDir, maskFile);
  const { data, info } = await sharp(maskPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${maskFile}: expected 1-channel greyscale mask, got ${info.channels} channels`);
  return { width: info.width, height: info.height, labels: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

const byWall = new Map<string, ManifestStrip[]>();
for (const strip of manifest.strips) {
  const list = byWall.get(strip.pandId);
  if (list) list.push(strip); else byWall.set(strip.pandId, [strip]);
}

await mkdir(outDir, { recursive: true });

let totalColumns = 0;
let coarseColumns = 0;
let snappedColumns = 0;
const nullReasonTotals: Record<NullReason, number> = { clipped: 0, 'no-sky': 0, 'no-run': 0, 'occluder-near-transition': 0 };
const shapeCounts: Record<string, number> = {};
let underexposedViews = 0;
let totalViews = 0;
let wallsWithConsensus50 = 0;
let wallsWritten = 0;
const wallReports: Array<{ pandId: string; address: string | null; views: number; consensusCoverage: number; shape: string }> = [];

for (const [pandId, strips] of [...byWall.entries()].sort(([a], [b]) => a < b ? -1 : 1)) {
  const first = strips[0];
  const frame0 = first.frame;
  for (const strip of strips) {
    const f = strip.frame;
    if (Math.abs(f.start.x - frame0.start.x) > 0.5 || Math.abs(f.start.y - frame0.start.y) > 0.5
      || Math.abs(f.end.x - frame0.end.x) > 0.5 || Math.abs(f.end.y - frame0.end.y) > 0.5) {
      console.warn(`${pandId}: views disagree on wall endpoints by more than 0.5 m (${strip.file}); using the first view's frame`);
    }
  }

  const views: RooflineProfileView[] = [];
  const usableProfiles: Array<Array<[number, number | null]>> = [];

  for (const strip of strips) {
    const luma = await loadLuma(strip.file);
    const mask = await loadMask(strip.file);
    if (mask.width !== luma.width || mask.height !== luma.height) {
      throw new Error(`${strip.file}: mask size ${mask.width}x${mask.height} != strip size ${luma.width}x${luma.height}`);
    }
    const boundaries = stripBoundaries(mask, luma);
    totalColumns += boundaries.rowPx.length;
    for (const method of boundaries.rowPx.map((row, x) => row === null ? null : boundaries.coarsePx[x] === boundaries.snappedPx[x] ? 'coarse' : 'snapped')) {
      if (method === 'coarse') coarseColumns++;
      else if (method === 'snapped') snappedColumns++;
    }
    for (const reason of Object.keys(nullReasonTotals) as NullReason[]) nullReasonTotals[reason] += boundaries.nullReasons[reason];

    const profile = resampleProfile(strip.frame, boundaries.rowPx);
    const underexposed = strip.sourceMeanLuma < UNDEREXPOSED_LUMA;
    totalViews++;
    if (underexposed) underexposedViews++;
    else usableProfiles.push(profile);

    views.push({
      file: strip.file,
      panoramaId: strip.panoramaId,
      capturedAt: strip.capturedAt,
      coarsePx: boundaries.coarsePx,
      snappedPx: boundaries.snappedPx,
      profile,
      // Materialisation-only extras (see rooflineGrade.ts: never hashed).
      ...( { roofBandPixelsPerMetre: strip.roofBandPixelsPerMetre, underexposed, leafOff: strip.leafOff } as Record<string, unknown>),
    });
  }

  // If every view is underexposed there is nothing better to fall back to;
  // use them all rather than emit an empty consensus.
  const consensusInput = usableProfiles.length > 0 ? usableProfiles : views.map(v => v.profile);
  const consensus = consensusProfile(consensusInput);
  const shape = profileShape(consensus);
  shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1;

  const coverage = consensus.length === 0 ? 0 : consensus.filter(([, up]) => up !== null).length / consensus.length;
  if (coverage >= 0.5) wallsWithConsensus50++;
  wallReports.push({ pandId, address: first.address, views: strips.length, consensusCoverage: coverage, shape });

  const profileWithoutHash: Omit<RooflineProfile, 'profileSha256'> = {
    pandId,
    address: first.address ?? pandId,
    wall: { start: [frame0.start.x, frame0.start.y], end: [frame0.end.x, frame0.end.y] },
    views,
    consensus,
    shape,
  };
  const profileSha256 = await profileContentHash(profileWithoutHash as RooflineProfile);
  const output: RooflineProfile = { ...profileWithoutHash, profileSha256 };
  await writeFile(path.join(outDir, `${pandId}.json`), `${JSON.stringify(output, null, 2)}\n`);
  wallsWritten++;
}

const nullTotal = Object.values(nullReasonTotals).reduce((a, b) => a + b, 0);
const chosenTotal = coarseColumns + snappedColumns;
console.log(`Walls written: ${wallsWritten} (of ${byWall.size} groups), ${totalViews} views (${underexposedViews} underexposed, excluded from consensus).`);
console.log(`Columns: ${totalColumns} total, ${chosenTotal} resolved (${coarseColumns} coarse, ${snappedColumns} snapped), ${nullTotal} null.`);
console.log(`Null reasons: ${JSON.stringify(nullReasonTotals)}`);
console.log(`Shape counts: ${JSON.stringify(shapeCounts)}`);
console.log(`Walls with consensus coverage >= 50%: ${wallsWithConsensus50} / ${wallsWritten} (${(100 * wallsWithConsensus50 / wallsWritten).toFixed(1)}%)`);
console.log(`Output: ${outDir}`);

await writeFile(path.join(path.dirname(outDir), 'strip-profiles-report.json'), `${JSON.stringify({
  wallsWritten, wallGroups: byWall.size, totalViews, underexposedViews,
  totalColumns, coarseColumns, snappedColumns, nullReasonTotals,
  shapeCounts, wallsWithConsensus50, wallReports,
}, null, 2)}\n`);
