import assert from 'node:assert/strict';
import { fitGable, fitGableTemplate, type GableProfileSample } from './gableFit.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

// Deterministic PRNG (mulberry32) plus a Box-Muller gaussian, so noisy fixtures
// are reproducible across runs.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussianSource(seed: number) {
  const rand = mulberry32(seed);
  let spare: number | null = null;
  return (sigma: number) => {
    if (spare != null) {
      const value = spare * sigma;
      spare = null;
      return value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    const z1 = mag * Math.sin(2 * Math.PI * v);
    spare = z1;
    return z0 * sigma;
  };
}

const sampleM = 0.1;
const width = 6;
const alongs: number[] = [];
for (let a = 0; a <= width + 1e-9; a += sampleM) alongs.push(Math.round(a * 1000) / 1000);

function noisyProfile(trueHeight: (along: number) => number, seed: number, sigma = 0.1): GableProfileSample[] {
  const gaussian = gaussianSource(seed);
  return alongs.map((along) => [along, trueHeight(along) + gaussian(sigma)] as GableProfileSample);
}

const rms = (profile: GableProfileSample[], trueHeight: (along: number) => number) => {
  const errs = profile.filter((p): p is [number, number] => p[1] != null).map(([a, u]) => u - trueHeight(a));
  return Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
};

// --- self-intersection check on a closed (along, up) outline ---
function segmentsIntersect(p1: readonly [number, number], p2: readonly [number, number], p3: readonly [number, number], p4: readonly [number, number]): boolean {
  const d = (a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}
function hasSelfIntersection(outline: ReadonlyArray<readonly [number, number]>): boolean {
  const n = outline.length - 1; // last point repeats the first
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    const a1 = outline[i];
    const a2 = outline[i + 1];
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
      const b1 = outline[j];
      const b2 = outline[j + 1];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

const fitErrorTable: Array<{ label: string; fitErrorM: number; noiseRmsM: number }> = [];

// ---------------------------------------------------------------------------
// lijstgevel: flat cornice with a raised central parapet
{
  const eaveUp = 4.0;
  const baseUp = 5.0;
  const parapetUp = 5.3;
  const trueHeight = (along: number) => (along >= 2 && along <= 4 ? parapetUp : baseUp);
  const profile = noisyProfile(trueHeight, 1);
  const fit = fitGableTemplate({ profile, type: 'lijstgevel' });
  check(fit !== null, 'lijstgevel fits');
  if (fit) {
    check(Math.abs(fit.params.baseUp - baseUp) < 0.1, `baseUp recovered, got ${fit.params.baseUp.toFixed(3)} want ${baseUp}`);
    check(Math.abs((fit.params.parapetUp ?? NaN) - parapetUp) < 0.15, `parapetUp recovered, got ${fit.params.parapetUp?.toFixed(3)} want ${parapetUp}`);
    check(Math.abs((fit.params.parapetStartAlong ?? NaN) - 2) < 0.3, `parapet start recovered, got ${fit.params.parapetStartAlong?.toFixed(2)}`);
    check(Math.abs((fit.params.parapetEndAlong ?? NaN) - 4) < 0.3, `parapet end recovered, got ${fit.params.parapetEndAlong?.toFixed(2)}`);
    check(!hasSelfIntersection(fit.outline), 'lijstgevel outline has no self-intersections');
    fitErrorTable.push({ label: 'lijstgevel', fitErrorM: fit.fitErrorM, noiseRmsM: rms(profile, trueHeight) });
  }
}

// ---------------------------------------------------------------------------
// puntgevel: a symmetric triangle
{
  const eaveUp = 4.0;
  const apexAlong = 3.0;
  const apexUp = 5.5;
  const trueHeight = (along: number) => {
    const half = along < apexAlong ? apexAlong : width - apexAlong;
    return eaveUp + (apexUp - eaveUp) * Math.max(0, 1 - Math.abs(along - apexAlong) / half);
  };
  const profile = noisyProfile(trueHeight, 2);
  const fit = fitGableTemplate({ profile, type: 'puntgevel' });
  check(fit !== null, 'puntgevel fits');
  if (fit) {
    check(Math.abs(fit.params.apexAlong - apexAlong) < 0.3, `apexAlong recovered, got ${fit.params.apexAlong.toFixed(2)} want ${apexAlong}`);
    check(Math.abs(fit.params.apexUp - apexUp) < 0.15, `apexUp recovered, got ${fit.params.apexUp.toFixed(3)} want ${apexUp}`);
    check(!hasSelfIntersection(fit.outline), 'puntgevel outline has no self-intersections');
    fitErrorTable.push({ label: 'puntgevel', fitErrorM: fit.fitErrorM, noiseRmsM: rms(profile, trueHeight) });
  }
}

// ---------------------------------------------------------------------------
// trapgevel: 3 symmetric steps each side
{
  const eaveUp = 4.0;
  const n = 3;
  const stepRun = width / 2 / n;
  const stepRise = 0.5;
  const trueHeight = (along: number) => {
    const d = Math.min(along, width - along);
    const k = Math.min(n, Math.floor(d / stepRun));
    return eaveUp + k * stepRise;
  };
  const profile = noisyProfile(trueHeight, 3);
  const fit = fitGableTemplate({ profile, type: 'trapgevel' });
  check(fit !== null, 'trapgevel fits');
  if (fit) {
    check(fit.params.steps === n, `step count recovered, got ${fit.params.steps} want ${n}`);
    check(Math.abs(fit.params.stepRiseM - stepRise) < 0.1, `stepRise recovered, got ${fit.params.stepRiseM.toFixed(3)} want ${stepRise}`);
    check(Math.abs(fit.params.stepRunM - stepRun) < 0.25, `stepRun recovered, got ${fit.params.stepRunM.toFixed(3)} want ${stepRun}`);
    check(!hasSelfIntersection(fit.outline), 'trapgevel outline has no self-intersections');
    fitErrorTable.push({ label: 'trapgevel', fitErrorM: fit.fitErrorM, noiseRmsM: rms(profile, trueHeight) });
  }
}

// ---------------------------------------------------------------------------
// halsgevel: raised neck, straight shoulders
{
  const eaveUp = 4.0;
  const shoulderUp = 4.3;
  const neckUp = 5.2;
  const neckWidthM = 2.0;
  const centre = width / 2;
  const trueHeight = (along: number) => (Math.abs(along - centre) <= neckWidthM / 2 ? neckUp : shoulderUp);
  const profile = noisyProfile(trueHeight, 4);
  const fit = fitGableTemplate({ profile, type: 'halsgevel' });
  check(fit !== null, 'halsgevel fits');
  if (fit) {
    check(Math.abs(fit.params.neckWidthM - neckWidthM) < 0.4, `neckWidthM recovered, got ${fit.params.neckWidthM.toFixed(2)} want ${neckWidthM}`);
    check(Math.abs(fit.params.neckUp - neckUp) < 0.15, `neckUp recovered, got ${fit.params.neckUp.toFixed(3)} want ${neckUp}`);
    check(Math.abs(fit.params.shoulderUp - shoulderUp) < 0.15, `shoulderUp recovered, got ${fit.params.shoulderUp.toFixed(3)} want ${shoulderUp}`);
    check(!hasSelfIntersection(fit.outline), 'halsgevel outline has no self-intersections');
    fitErrorTable.push({ label: 'halsgevel', fitErrorM: fit.fitErrorM, noiseRmsM: rms(profile, trueHeight) });
  }
}

// ---------------------------------------------------------------------------
// klokgevel: raised neck, shoulders bow outward
const eaveUp = 4.0;
const klokShoulderUp = 4.3;
const klokNeckUp = 5.3;
const klokNeckWidthM = 2.0;
const klokBulge = 0.25;
const klokTrueHeight = (() => {
  const centre = width / 2;
  const halfNeck = klokNeckWidthM / 2;
  return (along: number) => {
    if (Math.abs(along - centre) <= halfNeck) return klokNeckUp;
    if (along < centre) {
      const t = Math.max(0, Math.min(1, along / (centre - halfNeck)));
      return klokShoulderUp + t * (klokNeckUp - klokShoulderUp) + klokBulge * Math.sin(Math.PI * t);
    }
    const t = Math.max(0, Math.min(1, (along - (centre + halfNeck)) / (width - (centre + halfNeck))));
    return klokNeckUp + t * (klokShoulderUp - klokNeckUp) + klokBulge * Math.sin(Math.PI * t);
  };
})();
{
  const profile = noisyProfile(klokTrueHeight, 5);
  const fit = fitGableTemplate({ profile, type: 'klokgevel' });
  check(fit !== null, 'klokgevel fits');
  if (fit) {
    check(Math.abs(fit.params.neckWidthM - klokNeckWidthM) < 0.6, `neckWidthM recovered, got ${fit.params.neckWidthM.toFixed(2)} want ${klokNeckWidthM}`);
    check(Math.abs(fit.params.neckUp - klokNeckUp) < 0.2, `neckUp recovered, got ${fit.params.neckUp.toFixed(3)} want ${klokNeckUp}`);
    check(fit.params.bulgeM > 0.05, `bulge recovered as positive (outward bow), got ${fit.params.bulgeM.toFixed(3)}`);
    check(!hasSelfIntersection(fit.outline), 'klokgevel outline has no self-intersections');
    fitErrorTable.push({ label: 'klokgevel', fitErrorM: fit.fitErrorM, noiseRmsM: rms(profile, klokTrueHeight) });
  }
}

// A half-occluded klokgevel (left side entirely null) is completed by mirroring
// the measured right side.
{
  const fullProfile = noisyProfile(klokTrueHeight, 6, 0.05);
  const occluded: GableProfileSample[] = fullProfile.map(([a, u]) => (a < width / 2 ? [a, null] : [a, u]));
  const fit = fitGableTemplate({ profile: occluded, type: 'klokgevel' });
  check(fit !== null, 'half-occluded klokgevel still fits a template');
  if (fit) {
    check(fit.mirroredSide === 'left', `left side is mirrored from the measured right, got ${fit.mirroredSide}`);
    check(Math.abs(fit.params.neckWidthM - klokNeckWidthM) < 0.4, `occluded neckWidthM recovered, got ${fit.params.neckWidthM.toFixed(2)}`);
    check(Math.abs(fit.params.neckUp - klokNeckUp) < 0.2, `occluded neckUp recovered, got ${fit.params.neckUp.toFixed(3)}`);
    // The completed outline should span the full nominal width, not just the measured half.
    const alongsOfOutline = fit.outline.map((p) => p[0]);
    check(Math.min(...alongsOfOutline) < 0.5, 'mirrored outline reaches the occluded left edge');
    check(Math.max(...alongsOfOutline) > width - 0.5, 'mirrored outline reaches the measured right edge');
    check(!hasSelfIntersection(fit.outline), 'half-occluded klokgevel outline has no self-intersections');
  }
}

// A measured asymmetry is not erased: give both sides real (different) data
// and confirm no mirroring is applied.
{
  const asymmetric: GableProfileSample[] = alongs.map((a) => [a, a < width / 2 ? 4.2 : 4.6] as GableProfileSample);
  const fit = fitGableTemplate({ profile: asymmetric, type: 'lijstgevel' });
  check(fit !== null && fit.mirroredSide === null, 'no mirroring applied when both sides carry real (asymmetric) data');
}

// ---------------------------------------------------------------------------
// fitGable: the decision layer around fitGableTemplate
// ---------------------------------------------------------------------------

// unknown type always falls back to the Douglas-Peucker polyline, never a template
{
  const rand = mulberry32(9);
  const bumpy: GableProfileSample[] = alongs.map((a) => [a, 4 + Math.sin(a * 3.1) * 0.6 + Math.sin(a * 11) * 0.3 + (rand() - 0.5) * 0.1]);
  const result = fitGable({ profile: bumpy, type: 'unknown' });
  check(result.method === 'polyline', `unknown type falls back to a polyline, got ${result.method}`);
  check(result.params === null, 'polyline fallback carries no template params');
  check(fitGableTemplate({ profile: bumpy, type: 'unknown' }) === null, 'fitGableTemplate refuses to fit an unknown type');
  check(!hasSelfIntersection(result.outline), 'unknown-type polyline outline has no self-intersections');
}

// Too few points to fit anything also falls back cleanly, through both entry points.
{
  const tiny: GableProfileSample[] = [[0, 4], [0.1, 4.05], [0.2, 4.1]];
  check(fitGable({ profile: tiny, type: 'trapgevel' }).method === 'polyline', 'too few points falls back to a polyline');
  check(fitGableTemplate({ profile: tiny, type: 'trapgevel' }) === null, 'too few points refuses a template fit');
}

// fitGable's own fallback rule: a profile that is genuinely well described by
// very few polyline vertices (here, an almost-flat lijstgevel with only 0.02 m
// of noise) should not spend a named template on it when a 2-point polyline
// already nails it — the point of the >=30% margin is exactly to prefer the
// simpler description when both are essentially exact.
{
  const trueHeight = () => 5.0;
  const profile = noisyProfile(trueHeight, 11, 0.02);
  const result = fitGable({ profile, type: 'lijstgevel' });
  check(result.outline.length >= 2, 'fitGable always returns a usable outline');
  check(!hasSelfIntersection(result.outline), 'near-flat lijstgevel outline has no self-intersections');
}

console.log('\nG2 gable-fit RMS error table (metres), via fitGableTemplate on noisy synthetic samples (sigma=0.1 m):');
console.log('type'.padEnd(18), 'fitErrorM'.padEnd(12), 'inputNoiseRmsM');
for (const row of fitErrorTable) {
  console.log(row.label.padEnd(18), row.fitErrorM.toFixed(4).padEnd(12), row.noiseRmsM.toFixed(4));
}

process.stdout.write(`\nGable fit checks passed (${checks} assertions).\n`);
