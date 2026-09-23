/**
 * A2: edge-snapped rooflines from the strips in
 * `feat/roofline-strips` (`.cache/facade-twin/strips-roofline-v2`), scored
 * against the A1 Vistas masks (`.cache/roofline-eval/v2/masks/s1`), rescued
 * for overcast-sky mislabelling, checked for plausibility against the A3
 * 3DBAG cache (`.cache/roofline-eval/3dbag/3dbag-strips.json`), and aligned
 * across views for a per-view vertical bias before consensus.
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
  applyEaveGate, applyRoofMaxGate, applyViewBias, consensusProfile, consensusToViewPx, emptyNullReasonTotals, estimateViewBias,
  medianOffset, NULL_REASONS, profileShape, rescueSky, resampleProfile, stripBoundaries,
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
const ROOF_MAX_MARGIN_M = 1.0;
const BIAS_FLAG_M = 0.5;
const SAMPLE_M = 0.10;

interface ManifestStrip {
  file: string;
  pandId: string;
  address: string | null;
  panoramaId: string;
  capturedAt: string;
  sourceMeanLuma: number;
  roofBandPixelsPerMetre: number;
  leafOff: boolean;
  topZ: number;
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

const humanReason = (reason: NullReason): string => ({
  clipped: "clipped (the strip didn't clear the roof)",
  'no-sky': 'no sky in view',
  'no-run': 'no clean roofline edge in the mask',
  'occluder-near-transition': 'a branch or wire right at the edge',
  'not-open-sky-above': 'no open sky above (tree or overcast)',
  'below-3dbag-eave': "below the building's known height",
  'above-3dbag-max': "above the building's own airborne-lidar roof max (likely a neighbour/chimney set back)",
}[reason]);

/**
 * `b3_h_dak_max` from the pand's own 3DBAG `Building` CityObject attributes —
 * airborne lidar's own roof max, independent of anything this pipeline
 * measured. Falls back to the strip manifest's `topZ` when the attribute is
 * absent (e.g. an older cache), per the integrator's instruction.
 */
function roofMaxNapFor(pandId: string, fallbackTopZ: number): number {
  const response = threeDBagByPand.get(pandId) as { feature?: { CityObjects?: Record<string, { type?: string; attributes?: Record<string, unknown> }> } } | undefined;
  const cityObjects = response?.feature?.CityObjects ?? {};
  for (const object of Object.values(cityObjects)) {
    if (object.type !== 'Building') continue;
    const value = object.attributes?.b3_h_dak_max;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallbackTopZ;
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
let totalRescuedPixels = 0;
let totalMaskPixels = 0;
let wallsRecoveredBySkyRescue = 0;
let roofMaxColumnsGatedBeforeTotal = 0;
let roofMaxColumnsGatedAfterTotal = 0;
let roofMaxWallsGatedBefore = 0;
let roofMaxWallsGatedAfter = 0;
const roofMaxOffsetBeforeDistribution: number[] = [];
const roofMaxOffsetAfterDistribution: number[] = [];
const relationCounts: Partial<Record<WallSurfaceRelation, number>> = {};
const biasDistributionM: number[] = [];
const wallReports: Array<{
  pandId: string; address: string | null; views: number;
  consensusCoverageStrict: number; consensusCoverageWithSingle: number; shape: string;
  threeDBagRelation: WallSurfaceRelation; eaveNap: number | null; roofMaxNap: number;
  maxViewBiasM: number; referenceView: number | null; recoveredBySkyRescue: boolean;
  medianOffsetVs3dbagMaxBeforeAlignmentM: number | null; medianOffsetVs3dbagMaxAfterAlignmentM: number | null;
  columnsGatedByRoofMaxBeforeAlignment: number; columnsGatedByRoofMaxAfterAlignment: number;
  reasonSummary: string;
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
  const roofMaxNap = roofMaxNapFor(pandId, first.topZ);

  interface ViewData {
    strip: ManifestStrip;
    profile: Array<[number, number | null]>;
    coarsePx: Array<number | null>;
    snappedPx: Array<number | null>;
    width: number;
    underexposed: boolean;
    rescuedSkyFraction: number;
    wallReasonTally: Record<NullReason, number>;
    resolvedWithRescue: number;
    resolvedWithoutRescue: number;
  }
  const viewData: ViewData[] = [];

  for (const strip of strips) {
    const luma = await loadLuma(strip.file);
    const mask = await loadMask(strip.file);
    if (mask.width !== luma.width || mask.height !== luma.height) {
      throw new Error(`${strip.file}: mask size ${mask.width}x${mask.height} != strip size ${luma.width}x${luma.height}`);
    }

    // Diagnostic only: how many columns resolve WITHOUT the sky rescue, so the
    // report can honestly say how many walls the rescue actually recovers.
    const withoutRescue = stripBoundaries(mask, luma);
    const resolvedWithoutRescue = withoutRescue.rowPx.filter(v => v !== null).length;

    const rescue = rescueSky(mask, luma);
    totalRescuedPixels += Math.round(rescue.rescuedSkyFraction * mask.labels.length);
    totalMaskPixels += mask.labels.length;
    const boundaries = stripBoundaries({ width: mask.width, height: mask.height, labels: rescue.labels }, luma);
    const resolvedWithRescue = boundaries.rowPx.filter(v => v !== null).length;

    totalColumns += boundaries.rowPx.length;
    for (const method of boundaries.rowPx.map((row, x) => row === null ? null : boundaries.coarsePx[x] === boundaries.snappedPx[x] ? 'coarse' : 'snapped')) {
      if (method === 'coarse') coarseColumns++;
      else if (method === 'snapped') snappedColumns++;
    }
    for (const reason of Object.keys(nullReasonTotals) as NullReason[]) nullReasonTotals[reason] += boundaries.nullReasons[reason];
    const wallReasonTally = { ...boundaries.nullReasons };

    // The 3DBAG plausibility gate: only applied when this wall matched a
    // LoD2.2 WallSurface (`eaveNap !== null`); otherwise ungated, as specified.
    let gatedRowPx = boundaries.rowPx;
    if (eaveNap !== null) {
      const gate = applyEaveGate(strip.frame, boundaries.rowPx, eaveNap, EAVE_MARGIN_M);
      gatedRowPx = gate.rowPx;
      nullReasonTotals['below-3dbag-eave'] += gate.gated;
      wallReasonTally['below-3dbag-eave'] += gate.gated;
    }

    const profile = resampleProfile(strip.frame, gatedRowPx);
    const underexposed = strip.sourceMeanLuma < UNDEREXPOSED_LUMA;
    totalViews++;
    if (underexposed) underexposedViews++;

    viewData.push({
      strip, profile, coarsePx: boundaries.coarsePx, snappedPx: boundaries.snappedPx, width: boundaries.rowPx.length,
      underexposed, rescuedSkyFraction: rescue.rescuedSkyFraction, wallReasonTally, resolvedWithRescue, resolvedWithoutRescue,
    });
  }

  const recoveredBySkyRescue = viewData.every(v => v.resolvedWithoutRescue === 0) && viewData.some(v => v.resolvedWithRescue > 0);
  if (recoveredBySkyRescue) wallsRecoveredBySkyRescue++;

  // Per-view vertical bias, estimated on the (rescued, gated) profiles before
  // consensus — see estimateViewBias's doc. Only non-underexposed views take
  // part; if all views are underexposed there is nothing to align, and the
  // fallback below uses them unaligned rather than emitting an empty wall.
  const usableIndices = viewData.map((v, i) => (v.underexposed ? -1 : i)).filter(i => i >= 0);
  const usableProfiles = usableIndices.map(i => viewData[i].profile);
  const { biasesM, referenceIndex: usableReferenceIndex } = estimateViewBias(usableProfiles);
  const alignedUsableProfiles = usableProfiles.map((p, i) => applyViewBias(p, biasesM[i]));
  const referenceViewIndex = usableReferenceIndex >= 0 ? usableIndices[usableReferenceIndex] : null;
  const maxViewBiasM = biasesM.length ? Math.max(...biasesM.map(Math.abs)) : 0;
  biasDistributionM.push(maxViewBiasM);

  // The above-3dbag-max gate, applied *after* bias alignment (the integrator
  // wants to see whether alignment alone already fixes an upward offset
  // against 3DBAG's own airborne-lidar roof max, or whether set-back objects
  // remain a separate problem the gate has to catch). Diagnostics are taken
  // both before alignment (on `usableProfiles`) and after (on
  // `alignedUsableProfiles`, pre-gate).
  //
  // NOT WIRED INTO CONSENSUS. Measured across the full 89-wall run, this gate
  // fires on 78/89 walls (88%) both before and after per-view bias alignment,
  // and the median per-wall offset against 3DBAG's own roof max barely moves
  // with alignment (+3.39 m -> +3.21 m median). Per-view bias alignment only
  // corrects disagreement *between this wall's own views*; it cannot correct
  // an offset that is consistent across all of a wall's views but wrong
  // relative to 3DBAG's absolute scale. Firing on the large majority of walls,
  // by a magnitude alignment does not touch, is exactly the "threshold or
  // reasoning is wrong" case called out in the request -- this reads as a
  // shared, roughly-constant calibration gap between the photo/strip pipeline
  // and 3DBAG's datum (plausible contributor: `b3_h_dak_max` does not always
  // equal the manifest's own `topZ` -- one sampled pand showed 15.291 vs 13.7,
  // a 1.6 m gap in the datum alone), not per-wall set-back objects the gate
  // was designed to catch. Applying it as a hard filter would silently gut
  // consensus on nearly every wall rather than removing genuine outliers, so
  // it is left as a diagnostic (reported below and per-wall in the report
  // JSON / `medianOffsetVs3dbagMaxM`) and NOT applied to `consensusInput`.
  const offsetsBeforeAlignment: Array<number | null> = [];
  const offsetsAfterAlignment: Array<number | null> = [];
  let columnsGatedBeforeAlignment = 0;
  let columnsGatedAfterAlignment = 0;
  for (const [i, aligned] of alignedUsableProfiles.entries()) {
    offsetsBeforeAlignment.push(medianOffset(usableProfiles[i], roofMaxNap));
    offsetsAfterAlignment.push(medianOffset(aligned, roofMaxNap));
    columnsGatedBeforeAlignment += applyRoofMaxGate(usableProfiles[i], roofMaxNap, ROOF_MAX_MARGIN_M).gated;
    columnsGatedAfterAlignment += applyRoofMaxGate(aligned, roofMaxNap, ROOF_MAX_MARGIN_M).gated;
  }
  roofMaxColumnsGatedBeforeTotal += columnsGatedBeforeAlignment;
  roofMaxColumnsGatedAfterTotal += columnsGatedAfterAlignment;
  if (columnsGatedBeforeAlignment > 0) roofMaxWallsGatedBefore++;
  if (columnsGatedAfterAlignment > 0) roofMaxWallsGatedAfter++;
  const medianOfMedians = (values: Array<number | null>): number | null => {
    const nums = values.filter((v): v is number => v !== null);
    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)] * 1000) / 1000;
  };
  const medianOffsetBeforeAlignmentM = medianOfMedians(offsetsBeforeAlignment);
  const medianOffsetAfterAlignmentM = medianOfMedians(offsetsAfterAlignment);
  if (medianOffsetBeforeAlignmentM !== null) roofMaxOffsetBeforeDistribution.push(medianOffsetBeforeAlignmentM);
  if (medianOffsetAfterAlignmentM !== null) roofMaxOffsetAfterDistribution.push(medianOffsetAfterAlignmentM);

  const consensusInput = alignedUsableProfiles.length > 0 ? alignedUsableProfiles : viewData.map(v => v.profile);
  const { profile: consensus, singleView: consensusSingleView } = consensusProfile(consensusInput);
  const shape = profileShape(consensus);
  shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1;

  const resolved = consensus.filter(([, up]) => up !== null).length;
  const strictResolved = consensus.filter(([, up], i) => up !== null && !consensusSingleView[i]).length;
  const coverageWithSingle = consensus.length === 0 ? 0 : resolved / consensus.length;
  const coverageStrict = consensus.length === 0 ? 0 : strictResolved / consensus.length;
  if (coverageStrict >= 0.5) wallsWithConsensus50Strict++;
  if (coverageWithSingle >= 0.5) wallsWithConsensus50WithSingle++;

  // One reason string for the grading queue. A large bias that alignment
  // could not fully recover from (coverage is still poor) is reported ahead
  // of any per-column reason — it is the more actionable, wall-level finding.
  // Otherwise, the first view's own dominant abstention reason, if it
  // accounts for at least half its columns; otherwise a plain coverage line,
  // with a large *successfully* aligned bias still noted rather than hidden.
  let reasonSummary: string;
  if (maxViewBiasM >= BIAS_FLAG_M && coverageWithSingle < 0.5) {
    reasonSummary = `views disagree by ${maxViewBiasM.toFixed(2)} m before alignment`;
  } else {
    const primary = viewData[0];
    let dominantReason: NullReason | null = null, dominantCount = 0;
    for (const reason of NULL_REASONS) {
      if (primary.wallReasonTally[reason] > dominantCount) { dominantCount = primary.wallReasonTally[reason]; dominantReason = reason; }
    }
    const biasNote = maxViewBiasM >= BIAS_FLAG_M ? ` (views aligned by ${maxViewBiasM.toFixed(2)} m)` : '';
    reasonSummary = dominantReason && dominantCount / primary.width >= 0.5
      ? `${dominantCount} of ${primary.width} columns: ${humanReason(dominantReason)}${biasNote}`
      : `${resolved} of ${consensus.length} along-samples resolved (${Math.round(100 * coverageWithSingle)}%)${biasNote}`;
  }
  // Always append the 3DBAG offset, aligned figure preferred, so the owner can
  // see when a whole wall looks systematically lifted even if coverage is fine.
  if (medianOffsetAfterAlignmentM !== null && Math.abs(medianOffsetAfterAlignmentM) >= 0.3) {
    reasonSummary += ` · ${medianOffsetAfterAlignmentM > 0 ? '+' : ''}${medianOffsetAfterAlignmentM.toFixed(2)} m vs 3DBAG roof max`;
  }

  const alignmentNote = referenceViewIndex !== null
    ? `Absolute NAP is view ${referenceViewIndex + 1} of ${strips.length}'s own scale (the reference for bias alignment); no independent datum was invented.`
    : 'No usable view to align against; consensus (if any) uses each view\'s own unaligned scale.';

  wallReports.push({
    pandId, address: first.address, views: strips.length,
    consensusCoverageStrict: coverageStrict, consensusCoverageWithSingle: coverageWithSingle,
    shape, threeDBagRelation: relation, eaveNap, roofMaxNap, maxViewBiasM, referenceView: referenceViewIndex, recoveredBySkyRescue,
    medianOffsetVs3dbagMaxBeforeAlignmentM: medianOffsetBeforeAlignmentM, medianOffsetVs3dbagMaxAfterAlignmentM: medianOffsetAfterAlignmentM,
    columnsGatedByRoofMaxBeforeAlignment: columnsGatedBeforeAlignment, columnsGatedByRoofMaxAfterAlignment: columnsGatedAfterAlignment,
    reasonSummary,
  });

  const views: RooflineProfileView[] = viewData.map((v, i) => {
    const usablePos = usableIndices.indexOf(i);
    const viewBiasM = usablePos >= 0 ? biasesM[usablePos] : 0;
    return {
      file: v.strip.file,
      panoramaId: v.strip.panoramaId,
      capturedAt: v.strip.capturedAt,
      coarsePx: v.coarsePx,
      snappedPx: v.snappedPx,
      profile: v.profile,
      consensusPx: consensusToViewPx(v.strip.frame, consensus, v.width, viewBiasM),
      viewBiasM,
      rescuedSkyFraction: v.rescuedSkyFraction,
      // Materialisation-only extras (see rooflineGrade.ts: never hashed).
      ...( { roofBandPixelsPerMetre: v.strip.roofBandPixelsPerMetre, underexposed: v.underexposed, leafOff: v.strip.leafOff } as Record<string, unknown>),
    };
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
  const output: RooflineProfile = {
    ...profileWithoutHash, profileSha256, consensusSingleView, maxViewBiasM, alignmentNote, reasonSummary,
    medianOffsetVs3dbagMaxM: medianOffsetAfterAlignmentM,
  };
  await writeFile(path.join(outDir, `${pandId}.json`), `${JSON.stringify(output, null, 2)}\n`);
  wallsWritten++;
}

const nullTotal = Object.values(nullReasonTotals).reduce((a, b) => a + b, 0);
const chosenTotal = coarseColumns + snappedColumns;
const sortedBias = [...biasDistributionM].sort((a, b) => a - b);
const quantile = (p: number) => sortedBias.length ? sortedBias[Math.min(sortedBias.length - 1, Math.floor(p * (sortedBias.length - 1)))] : 0;
const biasOver50cm = biasDistributionM.filter(b => b >= 0.5).length;
const sortedRoofMaxBefore = [...roofMaxOffsetBeforeDistribution].sort((a, b) => a - b);
const sortedRoofMaxAfter = [...roofMaxOffsetAfterDistribution].sort((a, b) => a - b);
const roofMaxQuantile = (sorted: number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] : 0;
const roofMaxOffsetSummary = (sorted: number[]) => ({
  min: sorted[0] ?? 0, p10: roofMaxQuantile(sorted, 0.1), median: roofMaxQuantile(sorted, 0.5),
  p90: roofMaxQuantile(sorted, 0.9), max: sorted[sorted.length - 1] ?? 0, n: sorted.length,
});

console.log(`Walls written: ${wallsWritten} (of ${byWall.size} groups), ${totalViews} views (${underexposedViews} underexposed, excluded from consensus).`);
console.log(`3DBAG match: ${wallsMatched3dbag} walls matched (eave gate applied), ${wallsNo3dbagMatch} no match (ungated). Relations: ${JSON.stringify(relationCounts)}`);
console.log(`Columns: ${totalColumns} total, ${chosenTotal} resolved (${coarseColumns} coarse, ${snappedColumns} snapped), ${nullTotal} null.`);
console.log(`Null reasons: ${JSON.stringify(nullReasonTotals)}`);
console.log(`Shape counts: ${JSON.stringify(shapeCounts)}`);
console.log(`Walls with consensus coverage >= 50% (strict, >=2-view agreement only): ${wallsWithConsensus50Strict} / ${wallsWritten} (${(100 * wallsWithConsensus50Strict / wallsWritten).toFixed(1)}%)`);
console.log(`Walls with consensus coverage >= 50% (with single-view columns kept): ${wallsWithConsensus50WithSingle} / ${wallsWritten} (${(100 * wallsWithConsensus50WithSingle / wallsWritten).toFixed(1)}%)`);
console.log(`Sky rescue: ${(100 * totalRescuedPixels / totalMaskPixels).toFixed(2)}% of all mask pixels rescued; ${wallsRecoveredBySkyRescue} / ${wallsWritten} walls went from 0 resolved columns (any view) to some resolved columns because of it.`);
console.log(`Per-view bias |max| distribution (m) across ${wallReports.length} walls: min ${sortedBias[0]?.toFixed(3) ?? 0}, p10 ${quantile(0.1).toFixed(3)}, median ${quantile(0.5).toFixed(3)}, p90 ${quantile(0.9).toFixed(3)}, max ${sortedBias[sortedBias.length - 1]?.toFixed(3) ?? 0}. ${biasOver50cm} walls >= 0.5 m.`);
console.log(`Above-3DBAG-max gate (DIAGNOSTIC ONLY, NOT applied to consensus -- see comment above consensusInput): would gate ${roofMaxColumnsGatedBeforeTotal} columns BEFORE bias alignment (${roofMaxWallsGatedBefore} / ${wallsWritten} walls affected), ${roofMaxColumnsGatedAfterTotal} columns AFTER alignment (${roofMaxWallsGatedAfter} / ${wallsWritten} walls affected). This is ${(100 * roofMaxWallsGatedAfter / wallsWritten).toFixed(0)}% of walls -- fires nearly everywhere, so it is NOT wired into the pipeline; see the report JSON's aboveThreeDBagMaxGate.note.`);
console.log(`Median(consensus up - 3DBAG roof max) per wall, BEFORE alignment (m): ${JSON.stringify(roofMaxOffsetSummary(sortedRoofMaxBefore))}`);
console.log(`Median(consensus up - 3DBAG roof max) per wall, AFTER alignment (m): ${JSON.stringify(roofMaxOffsetSummary(sortedRoofMaxAfter))}`);
console.log(`Output: ${outDir}`);

await writeFile(path.join(path.dirname(outDir), 'strip-profiles-report.json'), `${JSON.stringify({
  wallsWritten, wallGroups: byWall.size, totalViews, underexposedViews,
  wallsMatched3dbag, wallsNo3dbagMatch, relationCounts,
  totalColumns, coarseColumns, snappedColumns, nullReasonTotals,
  shapeCounts, wallsWithConsensus50Strict, wallsWithConsensus50WithSingle,
  skyRescue: { pixelFraction: totalRescuedPixels / totalMaskPixels, wallsRecovered: wallsRecoveredBySkyRescue },
  biasDistributionM: { min: sortedBias[0] ?? 0, p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9), max: sortedBias[sortedBias.length - 1] ?? 0, over50cm: biasOver50cm },
  aboveThreeDBagMaxGate: {
    applied: false,
    note: 'Diagnostic only. This gate fires on the large majority of walls (see wallsGatedAfterAlignment / wallsWritten) '
      + 'by a magnitude that per-view bias alignment does not touch (median offset barely moves: '
      + 'perWallMedianOffsetBeforeAlignmentM.median -> perWallMedianOffsetAfterAlignmentM.median). That pattern reads as a '
      + 'shared, roughly-constant calibration gap between the photo/strip pipeline and 3DBAG\'s datum, not per-wall '
      + 'set-back objects, so it was NOT applied as a hard filter -- doing so would gut consensus on nearly every wall. '
      + 'See extract-strip-rooflines.ts, the comment above consensusInput.',
    columnsGatedBeforeAlignment: roofMaxColumnsGatedBeforeTotal, columnsGatedAfterAlignment: roofMaxColumnsGatedAfterTotal,
    wallsGatedBeforeAlignment: roofMaxWallsGatedBefore, wallsGatedAfterAlignment: roofMaxWallsGatedAfter,
    perWallMedianOffsetBeforeAlignmentM: roofMaxOffsetSummary(sortedRoofMaxBefore),
    perWallMedianOffsetAfterAlignmentM: roofMaxOffsetSummary(sortedRoofMaxAfter),
  },
  wallReports,
}, null, 2)}\n`);
