/**
 * A5: the decisive test of the +3.2 m question. Runs the SAME method as A2
 * (coarse boundary + edge snap + strict only-sky-above purity + sky rescue +
 * multi-view bias alignment + consensus, all from
 * `src/canalRecall/facade/stripRoofline.ts`) on the Oud-Zuid elevation views
 * `fetch-oudzuid-elevation-crops.ts` cut, segmented by `segment.py --method=s1`,
 * and scores the result against R1's own scan-measured gold profile per
 * elevation -- so instead of inferring bias from 3DBAG's own roof-max
 * attribute (A2 round 4's `above-3dbag-max` diagnostic), this measures the
 * photo pipeline's error against LASER-MEASURED ground truth directly.
 *
 * Unlike A2, this does NOT apply the below-3dbag-eave / above-3dbag-max
 * gates: there is no 3DBAG plausibility check to make here, because the
 * scan itself IS the ground truth being compared against.
 *
 * Run: npx tsx scripts/roofline-eval/extract-oudzuid-rooflines.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  applyViewBias, consensusProfile, estimateViewBias,
  profileShape, rescueSky, resampleProfile, stripBoundaries, type Luma, type Mask,
} from '../../src/canalRecall/facade/stripRoofline.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const viewsDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/facade-eval/oudzuid/elevation-views-v1';
const masksDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/oudzuid-a5/masks/s1';
const outDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/oudzuid-a5';
const SAMPLE_M = 0.10;
const UNDEREXPOSED_LUMA = 70;
const ABSTENTION_COVERAGE = 0.50; // §1 rule: abstention = elevations with < 50% of columns reported

interface ManifestStrip {
  file: string; pandId: string; address: string | null; panoramaId: string; capturedAt: string;
  sourceMeanLuma: number; frame: StripFrame; obliquityDeg: number;
}
interface Manifest { metadata: unknown; strips: ManifestStrip[] }
interface GoldElevation {
  id: string; tile: string; buildingId: string; widthM: number; shape: string; peakUp: number; eaveUp: number;
  profile: Array<{ along: number; up: number | null }>;
}
interface Gold { elevations: GoldElevation[] }

const manifest = JSON.parse(await readFile(path.join(viewsDir, 'manifest.json'), 'utf8')) as Manifest;
const gold = JSON.parse(await readFile(path.join(viewsDir, 'gold-measured.json'), 'utf8')) as Gold;
const goldById = new Map(gold.elevations.map(e => [e.id, e]));

async function loadLuma(file: string): Promise<Luma> {
  const { data, info } = await sharp(path.join(viewsDir, file)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, values: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
async function loadMask(file: string): Promise<Mask> {
  const maskPath = path.join(masksDir, file.replace(/\.jpg$/i, '.mask.png'));
  const { data, info } = await sharp(maskPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${maskPath}: expected 1-channel mask, got ${info.channels}`);
  return { width: info.width, height: info.height, labels: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

const byElevation = new Map<string, ManifestStrip[]>();
for (const s of manifest.strips) {
  const list = byElevation.get(s.pandId);
  if (list) list.push(s); else byElevation.set(s.pandId, [s]);
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

interface ElevationResult {
  id: string; tile: string; buildingId: string; widthM: number; views: number;
  goldShape: string; photoShape: string; shapeAgree: boolean;
  goldCoverage: number; photoCoverage: number; overlapColumns: number; overlapResolvedBoth: number;
  medianSignedErrorM: number | null; medianAbsErrorM: number | null;
  medianSignedErrorAfterOffsetM: number | null; medianAbsErrorAfterOffsetM: number | null;
  medianOffsetM: number | null; // per-elevation median(photo - gold) -- the "wrong height" component
  peakErrorM: number | null;
  abstained: boolean;
  maxViewBiasM: number;
  photoProfile: Array<[number, number | null]>;
  goldProfile: Array<[number, number | null]>;
  frames: Array<{ file: string; panoramaId: string; frame: StripFrame }>;
}

const results: ElevationResult[] = [];

for (const [elevationId, strips] of [...byElevation.entries()].sort(([a], [b]) => a < b ? -1 : 1)) {
  const goldElevation = goldById.get(elevationId);
  if (!goldElevation) { console.warn(`${elevationId}: no matching gold elevation, skipping`); continue; }
  const frame0 = strips[0].frame;

  const viewProfiles: Array<{ file: string; panoramaId: string; underexposed: boolean; profile: Array<[number, number | null]> }> = [];
  for (const strip of strips) {
    const luma = await loadLuma(strip.file);
    const mask = await loadMask(strip.file);
    if (mask.width !== luma.width || mask.height !== luma.height) {
      throw new Error(`${strip.file}: mask size ${mask.width}x${mask.height} != strip size ${luma.width}x${luma.height}`);
    }
    const rescue = rescueSky(mask, luma);
    const boundaries = stripBoundaries({ width: mask.width, height: mask.height, labels: rescue.labels }, luma);
    const profile = resampleProfile(strip.frame, boundaries.rowPx, SAMPLE_M);
    const underexposed = strip.sourceMeanLuma < UNDEREXPOSED_LUMA;
    viewProfiles.push({ file: strip.file, panoramaId: strip.panoramaId, underexposed, profile });
  }

  const usable = viewProfiles.filter(v => !v.underexposed);
  const usableProfiles = usable.map(v => v.profile);
  const { biasesM } = estimateViewBias(usableProfiles);
  const aligned = usableProfiles.map((p, i) => applyViewBias(p, biasesM[i]));
  const maxViewBiasM = biasesM.length ? Math.max(...biasesM.map(Math.abs)) : 0;
  const consensusInput = aligned.length > 0 ? aligned : viewProfiles.map(v => v.profile);
  const { profile: photoProfile } = consensusProfile(consensusInput);
  const photoShape = profileShape(photoProfile);

  const goldProfile: Array<[number, number | null]> = goldElevation.profile.map(p => [p.along, p.up]);
  const goldResolved = goldProfile.filter(([, up]) => up !== null).length;
  const goldCoverage = goldProfile.length ? goldResolved / goldProfile.length : 0;
  const photoResolved = photoProfile.filter(([, up]) => up !== null).length;
  const photoCoverage = photoProfile.length ? photoResolved / photoProfile.length : 0;
  const abstained = photoCoverage < ABSTENTION_COVERAGE;

  // Match by `along` key -- both are sampled at SAMPLE_M from the SAME
  // plane.start (the crop fetcher used the gold elevation's own plane), so
  // no interpolation is needed, only a key lookup.
  const goldByKey = new Map<number, number>();
  for (const [along, up] of goldProfile) if (up !== null) goldByKey.set(Math.round(along / SAMPLE_M), up);
  const diffs: number[] = [];
  let overlapColumns = 0;
  for (const [along, up] of photoProfile) {
    const key = Math.round(along / SAMPLE_M);
    if (goldByKey.has(key)) overlapColumns++;
    if (up === null) continue;
    const goldUp = goldByKey.get(key);
    if (goldUp === undefined) continue;
    diffs.push(up - goldUp);
  }
  const medianSignedErrorM = median(diffs);
  const medianAbsErrorM = median(diffs.map(Math.abs));
  const medianOffsetM = medianSignedErrorM; // same computation; named for clarity at the call site
  const diffsAfterOffset = medianOffsetM !== null ? diffs.map(d => d - medianOffsetM) : diffs;
  const medianSignedErrorAfterOffsetM = median(diffsAfterOffset);
  const medianAbsErrorAfterOffsetM = median(diffsAfterOffset.map(Math.abs));

  const photoPeak = photoProfile.map(([, up]) => up).filter((u): u is number => u !== null);
  const peakErrorM = photoPeak.length ? Math.abs(Math.max(...photoPeak) - goldElevation.peakUp) : null;

  results.push({
    id: elevationId, tile: goldElevation.tile, buildingId: goldElevation.buildingId, widthM: goldElevation.widthM,
    views: strips.length, goldShape: goldElevation.shape, photoShape, shapeAgree: photoShape === goldElevation.shape,
    goldCoverage, photoCoverage, overlapColumns, overlapResolvedBoth: diffs.length,
    medianSignedErrorM, medianAbsErrorM, medianSignedErrorAfterOffsetM, medianAbsErrorAfterOffsetM, medianOffsetM,
    peakErrorM, abstained, maxViewBiasM,
    photoProfile, goldProfile,
    frames: strips.map(s => ({ file: s.file, panoramaId: s.panoramaId, frame: s.frame })),
  });

  console.log(`${elevationId}: ${strips.length} views, photo coverage ${(photoCoverage * 100).toFixed(0)}%, `
    + `median error ${medianSignedErrorM?.toFixed(2) ?? 'n/a'} m (abs ${medianAbsErrorM?.toFixed(2) ?? 'n/a'} m), `
    + `peak error ${peakErrorM?.toFixed(2) ?? 'n/a'} m, shape photo=${photoShape} gold=${goldElevation.shape} `
    + `${photoShape === goldElevation.shape ? 'AGREE' : 'DISAGREE'}, bias ${maxViewBiasM.toFixed(2)} m`);
}

// §1 rule aggregates: median OVER ELEVATIONS of each elevation's own median error.
const scored = results.filter(r => !r.abstained && r.medianAbsErrorM !== null);
const medianOfElevationMedianAbsError = median(scored.map(r => r.medianAbsErrorM!));
const medianOfElevationMedianSignedError = median(scored.map(r => r.medianSignedErrorM!));
const medianOfElevationMedianAbsErrorAfterOffset = median(scored.filter(r => r.medianAbsErrorAfterOffsetM !== null).map(r => r.medianAbsErrorAfterOffsetM!));
const medianPeakError = median(results.filter(r => r.peakErrorM !== null).map(r => r.peakErrorM!));
const shapeAgreementRate = results.length ? results.filter(r => r.shapeAgree).length / results.length : 0;
const abstentionRate = results.length ? results.filter(r => r.abstained).length / results.length : 0;
const offsetDistribution = results.filter(r => r.medianOffsetM !== null).map(r => r.medianOffsetM!);
const sortedOffsets = [...offsetDistribution].sort((a, b) => a - b);

console.log('');
console.log(`=== A5 result: ${results.length} elevations scored (${scored.length} not abstained) ===`);
console.log(`Median-over-elevations of median SIGNED error (photo - scan): ${medianOfElevationMedianSignedError?.toFixed(3) ?? 'n/a'} m`);
console.log(`Median-over-elevations of median ABSOLUTE error: ${medianOfElevationMedianAbsError?.toFixed(3) ?? 'n/a'} m  (§1 threshold: <= 0.30 m)`);
console.log(`Median-over-elevations of median ABSOLUTE error AFTER removing each elevation's own offset: ${medianOfElevationMedianAbsErrorAfterOffset?.toFixed(3) ?? 'n/a'} m`);
console.log(`Median peak-height error: ${medianPeakError?.toFixed(3) ?? 'n/a'} m  (§1 threshold: <= 0.50 m)`);
console.log(`Shape agreement: ${(shapeAgreementRate * 100).toFixed(0)}%  (§1 threshold: >= 80%)`);
console.log(`Abstention (elevations with < 50% of columns reported): ${(abstentionRate * 100).toFixed(0)}%  (§1 threshold: <= 30%)`);
console.log(`Per-elevation median-offset (photo - scan) distribution (m): min ${sortedOffsets[0]?.toFixed(2) ?? 'n/a'}, median ${median(sortedOffsets)?.toFixed(2) ?? 'n/a'}, max ${sortedOffsets[sortedOffsets.length - 1]?.toFixed(2) ?? 'n/a'}, all values: [${sortedOffsets.map(v => v.toFixed(2)).join(', ')}]`);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: 's1 (Mask2Former Vistas) + A2 edge snapping + sky rescue + per-view bias alignment + consensus',
  goldSource: 'feat/roofline-r1:review-data/roofline-gold/v1/measured.json',
  headroomM: 6,
  rule: {
    medianColumnErrorAbsM: { threshold: 0.30, actual: medianOfElevationMedianAbsError, pass: medianOfElevationMedianAbsError !== null && medianOfElevationMedianAbsError <= 0.30 },
    medianPeakErrorM: { threshold: 0.50, actual: medianPeakError, pass: medianPeakError !== null && medianPeakError <= 0.50 },
    shapeAgreementRate: { threshold: 0.80, actual: shapeAgreementRate, pass: shapeAgreementRate >= 0.80 },
    abstentionRate: { threshold: 0.30, actual: abstentionRate, pass: abstentionRate <= 0.30 },
  },
  medianOfElevationMedianSignedError,
  medianOfElevationMedianAbsError,
  medianOfElevationMedianAbsErrorAfterOffset,
  medianPeakError,
  shapeAgreementRate,
  abstentionRate,
  perElevationOffsetDistribution: sortedOffsets,
  elevations: results.map(r => ({
    id: r.id, tile: r.tile, buildingId: r.buildingId, widthM: r.widthM, views: r.views,
    goldShape: r.goldShape, photoShape: r.photoShape, shapeAgree: r.shapeAgree,
    goldCoverage: r.goldCoverage, photoCoverage: r.photoCoverage,
    overlapColumns: r.overlapColumns, overlapResolvedBoth: r.overlapResolvedBoth,
    medianSignedErrorM: r.medianSignedErrorM, medianAbsErrorM: r.medianAbsErrorM,
    medianSignedErrorAfterOffsetM: r.medianSignedErrorAfterOffsetM, medianAbsErrorAfterOffsetM: r.medianAbsErrorAfterOffsetM,
    medianOffsetM: r.medianOffsetM, peakErrorM: r.peakErrorM, abstained: r.abstained, maxViewBiasM: r.maxViewBiasM,
  })),
};
await writeFile(path.join(outDir, 'a5-report.json'), `${JSON.stringify(report, null, 2)}\n`);

// Full per-elevation data (with profiles + frames), for overlay rendering.
await writeFile(path.join(outDir, 'a5-elevations-full.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nWrote ${path.join(outDir, 'a5-report.json')} and a5-elevations-full.json`);
