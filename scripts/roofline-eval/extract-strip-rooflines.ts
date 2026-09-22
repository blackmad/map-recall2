/**
 * A2: edge-snapped rooflines from the strips in
 * `feat/roofline-strips` (`.cache/facade-twin/strips-roofline-v2`), scored
 * against the A1 Vistas masks (`.cache/roofline-eval/v2/masks/s1`), and
 * checked for plausibility against the A3 3DBAG cache
 * (`.cache/roofline-eval/3dbag/3dbag-strips.json`).
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
  applyEaveGate, consensusProfile, emptyNullReasonTotals, profileShape, resampleProfile, stripBoundaries,
  type Luma, type Mask, type NullReason,
} from '../../src/canalRecall/facade/stripRoofline.ts';
import { profileContentHash, type RooflineProfile, type RooflineProfileView } from '../../src/canalRecall/facade/rooflineGrade.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';
import { extractFacadeWallPlanes } from '../../src/canalRecall/building/facadePointCloud.ts';
import { matchWallSurface, type A0WallFrame, type WallSurfaceRelation } from '../../src/canalRecall/facade/wallSurfaceMatch.ts';

const cacheRoot = process.env.ROOFLINE_CACHE
  ?? '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const buildingTwinCache = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin';
const stripsDir = path.join(buildingTwinCache, 'strips-roofline-v2');
const masksDir = path.join(cacheRoot, 'roofline-eval/v2/masks/s1');
const threeDBagCachePath = path.join(cacheRoot, 'roofline-eval/3dbag/3dbag-strips.json');
const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)=(.*)$/.exec(arg);
  if (m) args.set(m[1], m[2]);
}
const outDir = args.get('out') ?? path.join(cacheRoot, 'roofline-eval/strip-profiles');

const UNDEREXPOSED_LUMA = 70;
const EAVE_MARGIN_M = 1.0;

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

interface ThreeDBagCache { features: Array<{ pandId: string; response: unknown }> }
const threeDBagCache = JSON.parse(await readFile(threeDBagCachePath, 'utf8')) as ThreeDBagCache;
const threeDBagByPand = new Map<string, unknown>(threeDBagCache.features.map(f => [f.pandId, f.response]));

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

/**
 * The matched 3DBAG wall's eave (its own highest vertex), or null if no
 * `WallSurface` of this pand matches the A0 wall frame. Not gated in the
 * `null` case — see the module doc and the report's `no3dbagMatch` count.
 */
function eaveNapFor(pandId: string, frame0: StripFrame): { eaveNap: number | null; relation: WallSurfaceRelation } {
  const response = threeDBagByPand.get(pandId);
  if (!response) return { eaveNap: null, relation: 'no-surface' };
  const surfaces = extractFacadeWallPlanes(response as never);
  const wallFrame: A0WallFrame = {
    pandId, start: frame0.start, end: frame0.end,
    bottomNap: frame0.bottomNap, topNap: frame0.topNap, leftEdge: frame0.leftEdge,
  };
  const match = matchWallSurface(wallFrame, surfaces);
  if (match.relation !== 'match' || !match.surfaceId) return { eaveNap: null, relation: match.relation };
  const surface = surfaces.find(s => s.surfaceId === match.surfaceId);
  if (!surface) return { eaveNap: null, relation: match.relation };
  const eaveNap = Math.max(...surface.vertices.map(v => v[2]));
  return { eaveNap, relation: match.relation };
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
const nullReasonTotals = emptyNullReasonTotals();
const shapeCounts: Record<string, number> = {};
let underexposedViews = 0;
let totalViews = 0;
let wallsWithConsensus50Strict = 0;
let wallsWithConsensus50WithSingle = 0;
let wallsWritten = 0;
let wallsMatched3dbag = 0;
let wallsNo3dbagMatch = 0;
const relationCounts: Partial<Record<WallSurfaceRelation, number>> = {};
const wallReports: Array<{
  pandId: string; address: string | null; views: number;
  consensusCoverageStrict: number; consensusCoverageWithSingle: number; shape: string;
  threeDBagRelation: WallSurfaceRelation; eaveNap: number | null;
}> = [];

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

  const { eaveNap, relation } = eaveNapFor(pandId, frame0);
  relationCounts[relation] = (relationCounts[relation] ?? 0) + 1;
  if (eaveNap !== null) wallsMatched3dbag++; else wallsNo3dbagMatch++;

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

    // The 3DBAG plausibility gate: only applied when this wall matched a
    // LoD2.2 WallSurface (`eaveNap !== null`); otherwise ungated, as specified.
    let gatedRowPx = boundaries.rowPx;
    if (eaveNap !== null) {
      const gate = applyEaveGate(strip.frame, boundaries.rowPx, eaveNap, EAVE_MARGIN_M);
      gatedRowPx = gate.rowPx;
      nullReasonTotals['below-3dbag-eave'] += gate.gated;
    }

    const profile = resampleProfile(strip.frame, gatedRowPx);
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
  const { profile: consensus, singleView: consensusSingleView } = consensusProfile(consensusInput);
  const shape = profileShape(consensus);
  shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1;

  const resolved = consensus.filter(([, up]) => up !== null).length;
  const strictResolved = consensus.filter(([, up], i) => up !== null && !consensusSingleView[i]).length;
  const coverageWithSingle = consensus.length === 0 ? 0 : resolved / consensus.length;
  const coverageStrict = consensus.length === 0 ? 0 : strictResolved / consensus.length;
  if (coverageStrict >= 0.5) wallsWithConsensus50Strict++;
  if (coverageWithSingle >= 0.5) wallsWithConsensus50WithSingle++;
  wallReports.push({
    pandId, address: first.address, views: strips.length,
    consensusCoverageStrict: coverageStrict, consensusCoverageWithSingle: coverageWithSingle,
    shape, threeDBagRelation: relation, eaveNap,
  });

  const profileWithoutHash: Omit<RooflineProfile, 'profileSha256'> = {
    pandId,
    address: first.address ?? pandId,
    wall: { start: [frame0.start.x, frame0.start.y], end: [frame0.end.x, frame0.end.y] },
    views,
    consensus,
    shape,
  };
  const profileSha256 = await profileContentHash(profileWithoutHash as RooflineProfile);
  const output: RooflineProfile = { ...profileWithoutHash, profileSha256, consensusSingleView };
  await writeFile(path.join(outDir, `${pandId}.json`), `${JSON.stringify(output, null, 2)}\n`);
  wallsWritten++;
}

const nullTotal = Object.values(nullReasonTotals).reduce((a, b) => a + b, 0);
const chosenTotal = coarseColumns + snappedColumns;
console.log(`Walls written: ${wallsWritten} (of ${byWall.size} groups), ${totalViews} views (${underexposedViews} underexposed, excluded from consensus).`);
console.log(`3DBAG match: ${wallsMatched3dbag} walls matched (eave gate applied), ${wallsNo3dbagMatch} no match (ungated). Relations: ${JSON.stringify(relationCounts)}`);
console.log(`Columns: ${totalColumns} total, ${chosenTotal} resolved (${coarseColumns} coarse, ${snappedColumns} snapped), ${nullTotal} null.`);
console.log(`Null reasons: ${JSON.stringify(nullReasonTotals)}`);
console.log(`Shape counts: ${JSON.stringify(shapeCounts)}`);
console.log(`Walls with consensus coverage >= 50% (strict, >=2-view agreement only): ${wallsWithConsensus50Strict} / ${wallsWritten} (${(100 * wallsWithConsensus50Strict / wallsWritten).toFixed(1)}%)`);
console.log(`Walls with consensus coverage >= 50% (with single-view columns kept): ${wallsWithConsensus50WithSingle} / ${wallsWritten} (${(100 * wallsWithConsensus50WithSingle / wallsWritten).toFixed(1)}%)`);
console.log(`Output: ${outDir}`);

await writeFile(path.join(path.dirname(outDir), 'strip-profiles-report.json'), `${JSON.stringify({
  wallsWritten, wallGroups: byWall.size, totalViews, underexposedViews,
  wallsMatched3dbag, wallsNo3dbagMatch, relationCounts,
  totalColumns, coarseColumns, snappedColumns, nullReasonTotals,
  shapeCounts, wallsWithConsensus50Strict, wallsWithConsensus50WithSingle, wallReports,
}, null, 2)}\n`);
