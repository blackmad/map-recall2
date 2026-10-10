/**
 * Gable identification from a block face's rectified strip.
 *
 * The September roofline work (facade/gable.ts `gableFeatures`/`classifyGable`,
 * facade/gableFit.ts `fitGable`/`fitGableTemplate`) names and fits a gable from
 * a measured roofline, but was only ever run on the Oud-Zuid scan gold set and
 * never reached the recipe path: faces hand-author `gable`, `crownSteps`,
 * `crownRise` and `crownAt`/`crownBays`. This module connects the two:
 *
 *   strip pixels -> per-column skyline (deterministic sky/building test)
 *   -> per-pand roofline profile in metres (strip.json scale)
 *   -> crown span + `classifyGable` + `fitGable` + step/symmetry measurements
 *   -> a comparison with the authored crown, and (opt-in, `crownFromPhoto`)
 *      a patch of the front's crown fields so the compiled crown follows the photo.
 *
 * The sky test is deliberately simple and explainable (no learned model: the
 * Mask2Former checkpoint of scripts/roofline-eval is not installed locally).
 * Each column abstains (null) when the transition is not clean: foliage, bare
 * branches, a building clipped by the strip top, or unrendered grey fill.
 */
import {classifyGable, gableFeatures, type GableReading, type GableType} from '../facade/gable.ts';
import {fitGable, fitGableTemplate, type GableProfileSample} from '../facade/gableFit.ts';
import type {FrontIntent, GableIntent, CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {fitIntent, type FitReport} from '../buildingRecipe/fit.ts';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';

export interface StripPixels { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: number }

export interface SkylineOptions {
  /** Pixels per metre of the strip (strip.json). */
  pixelsPerMetre: number;
  /** RGB distance to the running sky colour below which a pixel is sky. */
  skyTolerance?: number;
  /** Required non-sky fraction in the window below the boundary. */
  solidFraction?: number;
}

const SAMPLE_M = 0.1;
const isFill = (r: number, g: number, b: number) => r === 128 && g === 128 && b === 128;

/** Blue daylight sky: blue dominant and bright (no brick or render is like that). */
const blueSky = (r: number, g: number, b: number) => b > 150 && b >= g && b > r + 25;
/** Overcast/white sky at the strip top, the seed for the running reference. */
const skySeed = (r: number, g: number, b: number) => blueSky(r, g, b) || (Math.min(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 40);

/**
 * Top building row per strip column in [x0, x1), or null where the column abstains.
 * Scans down from the strip top keeping a running sky colour; the boundary is the first
 * row below which `solidFraction` of the next 0.5 m is non-sky (so wires do not count).
 */
export function stripSkyline(img: StripPixels, x0: number, x1: number, options: SkylineOptions): (number | null)[] {
  const {width, height, channels, data} = img, ppm = options.pixelsPerMetre;
  const tol = options.skyTolerance ?? 34, solid = options.solidFraction ?? 0.85, win = Math.max(6, Math.round(0.5 * ppm));
  const px = (x: number, y: number): [number, number, number] => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dx = -1; dx <= 1; dx++) { const xx = Math.min(width - 1, Math.max(0, x + dx)), p = (y * width + xx) * channels; r += data[p]; g += data[p + 1]; b += data[p + 2]; n++; }
    return [r / n, g / n, b / n];
  };
  const raw: (number | null)[] = [], skyAbove: number[] = [];
  for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
    // Seed: median of the top rows that look like sky. No sky at the top -> clipped column.
    const seeds: [number, number, number][] = [];
    for (let y = 0; y < Math.min(8, height); y++) { const c = px(x, y); if (skySeed(...c)) seeds.push(c); }
    if (seeds.length < 4) { raw.push(null); skyAbove.push(0); continue; }
    const ref = [0, 1, 2].map(k => seeds.map(s => s[k]).sort((a, b) => a - b)[seeds.length >> 1]);
    const sky = new Uint8Array(height), fill = new Uint8Array(height);
    for (let y = 0; y < height; y++) {
      const [r, g, b] = px(x, y);
      if (isFill(Math.round(r), Math.round(g), Math.round(b))) { fill[y] = 1; continue; }
      const d = Math.hypot(r - ref[0], g - ref[1], b - ref[2]);
      if (d < tol || blueSky(r, g, b)) { sky[y] = 1; ref[0] = ref[0] * 0.9 + r * 0.1; ref[1] = ref[1] * 0.9 + g * 0.1; ref[2] = ref[2] * 0.9 + b * 0.1; }
    }
    let found: number | null = null;
    let nonSky = 0;
    for (let y = 0; y < Math.min(win, height); y++) nonSky += sky[y] || fill[y] ? 0 : 1;
    for (let y = 0; y + win < height; y++) {
      if (!sky[y] && !fill[y] && nonSky >= solid * win) { found = y; break; }
      nonSky += (sky[y + win] || fill[y + win] ? 0 : 1) - (sky[y] || fill[y] ? 0 : 1);
    }
    if (found === null || found < 2) { raw.push(null); skyAbove.push(0); continue; }
    // A clean edge has sky right above it; foliage/branches leave a mixed band.
    const above = Math.max(0, found - win);
    let s = 0, f = 0;
    for (let y = above; y < found; y++) { s += sky[y]; f += fill[y]; }
    raw.push(f > (found - above) * 0.3 ? null : found);
    skyAbove.push(s / Math.max(1, found - above));
  }
  // Roughness: a tree crown or wire clutter jumps column to column; a roofline does not (a step is one jump).
  const half = Math.max(2, Math.round(0.3 * ppm));
  return raw.map((v, i) => {
    if (v === null || skyAbove[i] < 0.7) return null;
    const near = raw.slice(Math.max(0, i - half), i + half + 1).filter((u): u is number => u !== null);
    if (near.length < half) return null;
    const med = near.sort((a, b) => a - b)[near.length >> 1];
    const mad = near.map(u => Math.abs(u - med)).sort((a, b) => a - b)[near.length >> 1];
    // A wire end, pole or branch tip is a narrow spike above (or a notch below) its neighbourhood; a step edge only
    // differs from the median within a column or two of the edge, and nulling those is harmless (interpolated).
    return mad > 0.35 * ppm || Math.abs(v - med) > 0.5 * ppm ? null : v;
  });
}

/** Skyline columns of one pand span -> (along m from the viewer's left, up m above the strip ground) at 0.1 m. */
export function spanProfile(skyline: (number | null)[], spanPx: [number, number], heightPx: number, ppm: number): GableProfileSample[] {
  const out: GableProfileSample[] = [], widthM = (spanPx[1] - spanPx[0]) / ppm, n = Math.max(2, Math.floor(widthM / SAMPLE_M));
  for (let k = 0; k < n; k++) {
    const a = spanPx[0] + k * SAMPLE_M * ppm, b = Math.min(spanPx[1], a + SAMPLE_M * ppm);
    const vals: number[] = []; let total = 0;
    for (let x = Math.floor(a); x < Math.max(Math.floor(a) + 1, Math.floor(b)); x++) { total++; const v = skyline[x]; if (v !== null && v !== undefined) vals.push(v); }
    const along = +(k * SAMPLE_M + SAMPLE_M / 2).toFixed(3);
    if (vals.length * 2 < total || !vals.length) { out.push([along, null]); continue; }
    vals.sort((p, q) => p - q);
    out.push([along, +((heightPx - vals[vals.length >> 1]) / ppm).toFixed(3)]);
  }
  return out;
}

/** Recipe vocabulary for the classifier's types. */
export const GABLE_TO_INTENT: Record<GableType, GableIntent | null> = {lijstgevel: 'cornice', puntgevel: 'point', tuitgevel: 'spout', trapgevel: 'step', klokgevel: 'bell', halsgevel: 'neck', unknown: null};
/** Intent gable -> classifier type (raised-neck reads as a neck). */
export const INTENT_TO_GABLE: Record<GableIntent, GableType> = {spout: 'tuitgevel', neck: 'halsgevel', 'raised-neck': 'halsgevel', bell: 'klokgevel', step: 'trapgevel', point: 'puntgevel', cornice: 'lijstgevel', flat: 'lijstgevel'};

export interface CrownShape {
  eavesUp: number;
  /** Crown top above its own eaves (m). 0 for a plain cornice line. */
  riseM: number;
  /** Crown extent as fractions of the front width from the viewer's left; null when there is no crown. */
  span: {from: number; to: number} | null;
  widthM: number;
  /** Crown centre minus front centre, fraction of the front width (+ = right). */
  offset: number;
  /** Highest point minus crown centre, fraction of the crown width. */
  peakOffset: number;
  /** 1 = mirror symmetric about the crown centre. */
  symmetry: number;
  /** Distinct plateau levels per side (+1 for a flat top): a step gable's step count per side. */
  stepsLeft: number;
  stepsRight: number;
}

const median = (v: number[]) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const round = (v: number, d = 2) => Number(v.toFixed(d));

/** Fill short null gaps by linear interpolation (for features that need a dense array). */
function dense(profile: GableProfileSample[]): number[] {
  const vals = profile.map(p => p[1]), out: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] !== null) { out.push(vals[i]!); continue; }
    let l = i - 1, r = i + 1;
    while (l >= 0 && vals[l] === null) l--;
    while (r < vals.length && vals[r] === null) r++;
    const lv = l >= 0 ? vals[l]! : r < vals.length ? vals[r]! : 0, rv = r < vals.length ? vals[r]! : lv;
    out.push(lv + (rv - lv) * (r === l ? 0 : (i - l) / (r - l)));
  }
  return out;
}

/** Plateau levels (runs >= 0.25 m within 0.15 m) above `eaves + 0.3`, counted per side of the crown centre. */
export function stepCounts(up: number[], eaves: number, centreIndex: number, sampleM = SAMPLE_M): {left: number; right: number; top: boolean} {
  const runs: {a: number; b: number; level: number}[] = [];
  let s = 0;
  for (let i = 1; i <= up.length; i++) {
    if (i < up.length && Math.abs(up[i] - up[s]) <= 0.15 && Math.abs(up[i] - up[i - 1]) <= 0.1) continue;
    if ((i - s) * sampleM >= 0.25) { const level = median(up.slice(s, i)); if (level > eaves + 0.3) runs.push({a: s, b: i - 1, level}); }
    s = i;
  }
  const peak = Math.max(...up);
  const isTop = (r: {level: number}) => r.level >= peak - 0.35;
  const top = runs.some(isTop);
  const levels = (side: typeof runs) => { const ls: number[] = []; for (const r of side.sort((p, q) => p.level - q.level)) if (!ls.some(l => Math.abs(l - r.level) < 0.3)) ls.push(r.level); return ls.length; };
  const left = runs.filter(r => !isTop(r) && (r.a + r.b) / 2 < centreIndex), right = runs.filter(r => !isTop(r) && (r.a + r.b) / 2 >= centreIndex);
  return {left: levels(left) + (top ? 1 : 0), right: levels(right) + (top ? 1 : 0), top};
}

/** Shape measurements of a profile (photo or authored, same code so the numbers compare). */
export function crownShape(profile: GableProfileSample[], eavesUp?: number): CrownShape {
  const up = dense(profile), n = up.length, widthM = n * SAMPLE_M;
  const known = profile.map(p => p[1]).filter((v): v is number => v !== null);
  // Eaves: the lower of the two outer-eighth medians (a taller neighbour or a wing leaks into one side only).
  const k = Math.max(2, Math.floor(n / 8));
  const sides = [profile.slice(0, k), profile.slice(n - k)].map(s => median(s.map(p => p[1]).filter((v): v is number => v !== null))).filter(Number.isFinite);
  const eaves = eavesUp ?? (sides.length ? Math.min(...sides) : median(known));
  const peak = Math.max(...up), rise = peak - eaves;
  const none: CrownShape = {eavesUp: round(eaves), riseM: round(Math.max(0, rise)), span: null, widthM: round(widthM), offset: 0, peakOffset: 0, symmetry: 1, stepsLeft: 0, stepsRight: 0};
  if (!Number.isFinite(eaves) || !known.length) return {...none, eavesUp: NaN, riseM: 0};
  if (rise < 0.4) return none;
  // Crown: the longest run above eaves + 0.4 m, extended out to its foot (<= eaves + 0.15 m).
  let best: [number, number] | null = null;
  for (let i = 0; i < n;) {
    if (up[i] <= eaves + 0.4) { i++; continue; }
    let j = i; while (j + 1 < n && up[j + 1] > eaves + 0.4) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
    i = j + 1;
  }
  if (!best) return none;
  let [a, b] = best;
  while (a > 0 && up[a - 1] > eaves + 0.15) a--;
  while (b < n - 1 && up[b + 1] > eaves + 0.15) b++;
  const from = a / n, to = (b + 1) / n, cw = (b - a + 1) * SAMPLE_M, centre = (a + b) / 2;
  const peakIdx = up.indexOf(peak);
  let mirror = 0, m = 0;
  for (let i = a; i <= b; i++) { const j = Math.round(a + b - i); if (j >= a && j <= b) { mirror += Math.abs(up[i] - up[j]); m++; } }
  const steps = stepCounts(up.slice(a, b + 1), eaves, centre - a);
  return {eavesUp: round(eaves), riseM: round(rise), span: {from: round(from, 3), to: round(to, 3)}, widthM: round(cw), offset: round((a + b + 1) / 2 / n - 0.5, 3),
    peakOffset: round((peakIdx - centre) / Math.max(1, b - a + 1), 3), symmetry: round(1 - Math.min(1, mirror / Math.max(1, m) / Math.max(rise, 0.5)), 3), stepsLeft: steps.left, stepsRight: steps.right};
}

export interface PhotoGable {
  /** Fraction of the front's 0.1 m samples with a measured roofline. */
  coverage: number;
  /** Fraction measured inside the crown span. */
  crownCoverage: number;
  shape: CrownShape;
  /** Classifier on the crown span (the gable itself), and on the whole front (as the register would see it). */
  crown: GableReading;
  front: GableReading;
  intentGable: GableIntent | null;
  /** fitGable on the crown span: template vs polyline decision and errors. */
  fit: {method: 'template' | 'polyline'; params: Record<string, number> | null; fitErrorM: number; polylineErrorM: number; templateParams: Record<string, number> | null; templateErrorM: number | null; trace: [number, number][]};
  /** Why the reading should not drive a crown (empty = usable). */
  abstain: string[];
}

/** Read a front's gable off its photo profile (along from the viewer's left, up above the strip ground). */
export function readPhotoGable(profile: GableProfileSample[]): PhotoGable {
  const coverage = profile.filter(p => p[1] !== null).length / Math.max(1, profile.length);
  const shape = crownShape(profile);
  const abstain: string[] = [];
  if (coverage < 0.6) abstain.push(`only ${Math.round(coverage * 100)} % of the roofline measured`);
  if (!Number.isFinite(shape.eavesUp)) {
    const none: GableReading = {type: 'unknown', confidence: 0, reason: 'no roofline measured'};
    return {coverage: round(coverage, 3), crownCoverage: 0, shape, crown: none, front: none, intentGable: null, fit: {method: 'polyline', params: null, fitErrorM: 0, polylineErrorM: 0, templateParams: null, templateErrorM: null, trace: []}, abstain};
  }
  const frontRel = dense(profile).map(v => v - shape.eavesUp), widthM = profile.length * SAMPLE_M;
  const front = classifyGable(gableFeatures({profile: frontRel, plotWidthM: widthM, sampleM: SAMPLE_M}));
  const emptyFit = {method: 'polyline' as const, params: null, fitErrorM: 0, polylineErrorM: 0, templateParams: null, templateErrorM: null, trace: [] as [number, number][]};
  if (!shape.span) {
    return {coverage: round(coverage, 3), crownCoverage: round(coverage, 3), shape, crown: {type: 'lijstgevel', confidence: front.type === 'lijstgevel' ? front.confidence : 0.5, reason: `no crown rises 0.4 m above the eaves line (rise ${shape.riseM} m)`}, front, intentGable: 'cornice', fit: emptyFit, abstain};
  }
  const n = profile.length, a = Math.round(shape.span.from * n), b = Math.round(shape.span.to * n);
  const crownProfile = profile.slice(a, b);
  const crownCoverage = crownProfile.filter(p => p[1] !== null).length / Math.max(1, crownProfile.length);
  if (crownCoverage < 0.7) abstain.push(`only ${Math.round(crownCoverage * 100)} % of the crown measured`);
  // Pad with eaves-level samples so the classifier's flank median sees the crown's foot.
  const pad = Math.max(2, Math.round(crownProfile.length / 10));
  const rel = [...Array(pad).fill(0), ...dense(crownProfile).map(v => v - shape.eavesUp), ...Array(pad).fill(0)];
  const features = gableFeatures({profile: rel, plotWidthM: rel.length * SAMPLE_M, sampleM: SAMPLE_M});
  let crown = classifyGable(features);
  // Refinement for small stepped crowns: gable.ts wants >= 3 plateaus each wider than 8 % of the plot, which a
  // 3-4 m crown with 0.3 m steps (Marnixstraat 124-138) never reaches. A wide raised body (not a neck) with at least
  // one side step plus a flat top on BOTH sides is a stepped outline.
  // One shoulder level per side under a flat top is ALSO the silhouette of a neck gable whose scrolls sit below the
  // eaves estimate; it reads as stepped only on a partial crown (the 19th-c. rows), and as a neck over most of the front.
  const crownFraction = shape.span.to - shape.span.from, maxSteps = Math.max(shape.stepsLeft, shape.stepsRight), minSteps = Math.min(shape.stepsLeft, shape.stepsRight);
  if (crown.type === 'unknown' && features.neckWidth >= 0.5 && minSteps >= 2 && (maxSteps >= 3 || crownFraction < 0.45))
    crown = {type: 'trapgevel', confidence: 0.5, reason: `${shape.stepsLeft}/${shape.stepsRight} plateau levels per side under a flat top on a wide raised body (${Math.round(features.neckWidth * 100)} %) — stepped (blockFace refinement of an unknown)`};
  else if (crown.type === 'unknown' && minSteps === 2 && maxSteps === 2)
    crown = {type: 'halsgevel', confidence: 0.4, reason: `one shoulder level per side under a flat top across ${Math.round(crownFraction * 100)} % of the front — a neck (or a one-step gable; blockFace refinement of an unknown)`};
  // A narrow element over a cornice is a finial, statue, chimney or hoist beam, not a gable.
  if (shape.widthM < 1.5 && crown.type !== 'trapgevel')
    crown = {type: 'lijstgevel', confidence: 0.6, reason: `only a ${shape.widthM} m wide element rises ${shape.riseM} m above the eaves line — an ornament or chimney on a cornice front, not a gable`};
  if (crown.type === 'unknown') abstain.push(`classifier: ${crown.reason}`);
  const fitIn = {profile: crownProfile.map(([x, y]) => [x, y] as const), type: crown.type};
  const decided = fitGable(fitIn), template = fitGableTemplate(fitIn);
  return {coverage: round(coverage, 3), crownCoverage: round(crownCoverage, 3), shape, crown, front, intentGable: GABLE_TO_INTENT[crown.type],
    fit: {method: decided.method, params: decided.params, fitErrorM: round(decided.fitErrorM, 3), polylineErrorM: round(decided.polylineErrorM, 3), templateParams: template?.params ? Object.fromEntries(Object.entries(template.params).map(([k, v]) => [k, round(v, 3)])) : null, templateErrorM: template ? round(template.fitErrorM, 3) : null,
      trace: (template?.trace ?? decided.trace).map(([x, y]) => [round(x, 3), round(y, 3)] as [number, number])}, abstain};
}

/**
 * The skyline is the gable's outline only where sky meets the facade. Where a pitched roof (behind, or the neighbour's)
 * shows above the cornice, the skyline at the flanks is that roof, not the gable's foot: Bilderdijkstraat skylines sit
 * 1.5-3 m above the compiled eaves and a stepped gable in front of its roof reads as a small "point" on top. Abstain
 * when the photo's eaves line and the compiled eaves (strip frame) disagree by more than `toleranceM` (Marnixstraat's
 * parapet is 0.4-0.7 m above the compiled eaves, Oudezijds Achterburgwal 0-0.6 m).
 */
export function withModelEaves(photo: PhotoGable, modelEavesUp: number, toleranceM = 0.8): PhotoGable {
  const d = photo.shape.eavesUp - modelEavesUp;
  if (!Number.isFinite(d) || Math.abs(d) <= toleranceM) return photo;
  return {...photo, abstain: [...photo.abstain, d > 0 ? `skyline ${round(d)} m above the compiled eaves: a roof shows above the cornice, so the skyline is not the gable outline` : `skyline ${round(-d)} m below the compiled eaves: the facade top is not against sky`]};
}

/** Sample an authored crown profile ([x, y] polyline, viewer's left) at the photo's 0.1 m spacing. */
export function sampleOutline(points: [number, number][], widthM: number): GableProfileSample[] {
  const pts = [...points].sort((p, q) => p[0] - q[0]), n = Math.max(2, Math.floor(widthM / SAMPLE_M)), out: GableProfileSample[] = [];
  for (let k = 0; k < n; k++) {
    const x = k * SAMPLE_M + SAMPLE_M / 2;
    // Highest outline value at x (vertical segments of steps have two points at one x).
    let y = -Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (x < Math.min(x0, x1) - 1e-9 || x > Math.max(x0, x1) + 1e-9) continue;
      y = Math.max(y, x1 === x0 ? Math.max(y0, y1) : y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }
    out.push([round(x, 3), Number.isFinite(y) ? round(y, 3) : null]);
  }
  return out;
}

export interface CrownComparison {
  authored: {gable: GableIntent; shape: CrownShape; steps?: number};
  photo: {gable: GableIntent | null; confidence: number; shape: CrownShape};
  mismatches: string[];
}

/** Compare an authored crown (intent gable + compiled outline, eaves-relative) with the photo reading. */
export function compareCrowns(gable: GableIntent, authored: CrownShape, photo: PhotoGable, authoredSteps?: number, roofBehind?: string): CrownComparison {
  const out: string[] = [], p = photo.shape;
  if (roofBehind && ['cornice', 'flat'].includes(gable) && photo.intentGable && photo.intentGable !== 'cornice')
    return {authored: {gable, shape: authored, steps: authoredSteps}, photo: {gable: photo.intentGable, confidence: photo.crown.confidence, shape: p}, mismatches: []};
  if (photo.abstain.length) {
    // The crown's TOP against sky is still a measurement when the flanks are not (a roof behind, a tree at one side):
    // `authored.riseM` is measured from the photo's eaves line, so authored top = photo eaves + authored rise.
    const top = authored.span && p.span && photo.crownCoverage >= 0.5 && Math.abs(authored.riseM - p.riseM) > 0.6 ? [`top: intent crown top ${round(p.eavesUp + authored.riseM)} m, photo ${round(p.eavesUp + p.riseM)} m above the strip ground`] : [];
    return {authored: {gable, shape: authored, steps: authoredSteps}, photo: {gable: photo.intentGable, confidence: photo.crown.confidence, shape: p}, mismatches: [`photo abstains: ${photo.abstain.join('; ')}`, ...top]};
  }
  const family = (g: GableIntent | null) => g === 'raised-neck' ? 'neck' : g === 'flat' ? 'cornice' : g;
  const authoredHasCrown = !!authored.span && authored.riseM >= 0.4;
  if (family(gable) !== family(photo.intentGable) && !(gable === 'cornice' && photo.intentGable === 'cornice')) out.push(`type: intent ${gable}, photo ${photo.intentGable ?? 'unknown'} (${photo.crown.type} ${photo.crown.confidence.toFixed(2)}: ${photo.crown.reason})`);
  const photoCrown = !!p.span && photo.intentGable !== 'cornice';
  if (authoredHasCrown !== photoCrown && family(gable) !== 'cornice') out.push(`crown: intent ${authoredHasCrown ? `rises ${authored.riseM} m` : 'none'}, photo ${photoCrown ? `rises ${p.riseM} m` : 'none'}`);
  if (authoredHasCrown && p.span) {
    if (Math.abs(authored.riseM - p.riseM) > Math.max(0.6, 0.2 * p.riseM)) out.push(`rise: intent ${authored.riseM} m, photo ${p.riseM} m (above the photo's eaves line)`);
    // Width and position only mean something for a crown on part of the front (a full-width gable's foot depends on
    // where each side puts its eaves line, scroll feet and all).
    const partial = Math.max((authored.span?.to ?? 1) - (authored.span?.from ?? 0), p.span.to - p.span.from) < 0.8;
    if (partial && Math.abs(authored.widthM - p.widthM) > Math.max(0.35, 0.1 * p.widthM)) out.push(`width: intent ${authored.widthM} m, photo ${p.widthM} m`);
    if (partial && Math.abs(authored.offset - p.offset) > 0.025) out.push(`position: intent centre ${authored.offset >= 0 ? '+' : ''}${authored.offset}, photo ${p.offset >= 0 ? '+' : ''}${p.offset} (fraction of front, + = right)`);
    if (family(gable) === 'step' && photo.intentGable === 'step') {
      const ps = Math.max(p.stepsLeft, p.stepsRight), as = authoredSteps ?? Math.max(authored.stepsLeft, authored.stepsRight);
      if (Math.abs(ps - as) >= 1) out.push(`steps: intent ${as} per side, photo ${p.stepsLeft} left / ${p.stepsRight} right`);
    }
    if (p.symmetry < 0.8 && authored.symmetry >= 0.9) out.push(`symmetry: photo is lopsided (${p.symmetry}, peak ${p.peakOffset >= 0 ? '+' : ''}${p.peakOffset} of crown width), intent symmetric`);
  }
  return {authored: {gable, shape: authored, steps: authoredSteps}, photo: {gable: photo.intentGable, confidence: photo.crown.confidence, shape: p}, mismatches: out};
}

/** Front fields a photo crown sets; every other crown field is removed so stale authored values cannot conflict. */
const CROWN_FIELDS = ['crownSteps', 'crownRise', 'crownAt', 'crownBays', 'crownGroups', 'crownCap', 'crownCapSpan', 'crownCapRise', 'crownFinial'] as const;

export interface PhotoCrownPatch {
  pandId: string;
  frontId: string;
  set: Partial<FrontIntent>;
  /** What the photo said, for the report. */
  reading: {type: GableType; confidence: number; riseM: number; span: {from: number; to: number} | null; steps: [number, number]};
}

/**
 * Turn a photo reading into a front patch, given the authored front and its fitted upper-storey height.
 * Keeps the authored placement (`crownBays`, `crownAt`) when the photo's span agrees within 0.4 m each end, and the
 * authored cap/finial when the type is unchanged; otherwise the photo decides. Returns null when the photo abstains.
 */
export function photoCrownPatch(pandId: string, front: FrontIntent, reading: PhotoGable, fit: {widthM: number; upperStoreyM: number; authoredSpan: {from: number; to: number} | null;
  /** The compiled front's eaves in the strip frame (m above the strip ground): the crown is built on it, so the rise is photo top minus this. Default: the photo's own eaves line. */
  modelEavesUp?: number}): PhotoCrownPatch | null {
  if (reading.abstain.length || !reading.intentGable) return null;
  // A mansard or dormers behind a cornice show above it in a front view; the silhouette cannot tell them from a gable.
  if (['cornice', 'flat'].includes(front.gable) && reading.intentGable !== 'cornice' && (front.roofFront || front.dormers)) return null;
  const s = {...reading.shape, riseM: round(reading.shape.eavesUp + reading.shape.riseM - (fit.modelEavesUp ?? reading.shape.eavesUp))}, gable = reading.intentGable, sameType = INTENT_TO_GABLE[front.gable] === reading.crown.type;
  const set: Partial<FrontIntent> = {gable: sameType ? front.gable : gable};
  if (gable === 'cornice') {
    // A plain cornice line: keep an authored cap only when the photo shows one (rise >= 0.4 m has a span).
    if (sameType && s.span) for (const k of ['crownCap', 'crownCapSpan', 'crownCapRise'] as const) if (front[k] !== undefined) (set as any)[k] = front[k];
  } else {
    set.crownRise = round(Math.min(3, Math.max(0.3, s.riseM / fit.upperStoreyM)), 2);
    if (gable === 'step') set.crownSteps = Math.min(6, Math.max(1, Math.round((s.stepsLeft + s.stepsRight) / 2)));
    if (sameType) for (const k of ['crownCap', 'crownFinial'] as const) if (front[k] !== undefined && (k !== 'crownFinial' || ['step', 'neck', 'raised-neck', 'bell'].includes(set.gable!))) (set as any)[k] = front[k];
    const span = s.span!, tol = 0.4 / fit.widthM, keep = fit.authoredSpan && Math.abs(fit.authoredSpan.from - span.from) <= tol && Math.abs(fit.authoredSpan.to - span.to) <= tol;
    if (keep && front.crownBays) set.crownBays = front.crownBays;
    else if (keep && front.crownAt) set.crownAt = front.crownAt;
    else if (span.to - span.from < 0.95) set.crownAt = {from: round(span.from, 3), to: round(Math.max(span.to, span.from + 0.2), 3)};
  }
  return {pandId, frontId: front.id, set, reading: {type: reading.crown.type, confidence: reading.crown.confidence, riseM: s.riseM, span: s.span, steps: [s.stepsLeft, s.stepsRight]}};
}

/** Apply photo crown patches to resolved house intents (crown fields replaced, everything else untouched), re-validated. */
export function applyPhotoCrowns(intents: CanalHouseIntent[], patches: PhotoCrownPatch[]): CanalHouseIntent[] {
  if (!patches.length) return intents;
  return intents.map(intent => {
    const mine = patches.filter(p => p.pandId === intent.pandId);
    if (!mine.length) return intent;
    const fronts = intent.fronts.map(f => {
      const p = mine.find(x => x.frontId === f.id);
      if (!p) return f;
      const next: any = {...f};
      for (const k of CROWN_FIELDS) delete next[k];
      return {...next, ...p.set} as FrontIntent;
    });
    return validateIntent({...intent, fronts, notes: [...(intent.notes ?? []), ...mine.map(p => `crown ${p.frontId} from photo: ${p.reading.type} ${p.reading.confidence.toFixed(2)}, rise ${p.reading.riseM} m${p.reading.type === 'trapgevel' ? `, steps ${p.reading.steps.join('/')}` : ''}`)]});
  });
}

/** The compiled crown outline of one front from a fitted recipe, in viewer-left metres (null: no crown, plain eaves line). */
export function authoredOutline(recipe: CanalHouseRecipe, report: FitReport, frontId: string): [number, number][] | null {
  const f = report.fronts.find(x => x.id === frontId), e = recipe.elevations.find(x => x.id === frontId);
  if (!f || !e?.crown) return null;
  return e.crown.value.profile.map(([x, y]) => [f.mirrored ? f.widthM - x : x, y] as [number, number]).sort((p, q) => p[0] - q[0]);
}

/** Authored crown shape of a front (same measurements as the photo), eaves = the fitted eaves. */
export function authoredShape(recipe: CanalHouseRecipe, report: FitReport, frontId: string): CrownShape {
  const f = report.fronts.find(x => x.id === frontId)!;
  const outline = authoredOutline(recipe, report, frontId) ?? [[0, f.eavesM], [f.widthM, f.eavesM]];
  return crownShape(sampleOutline(outline, f.widthM), f.eavesM);
}

/**
 * Patches for the fronts a face marks `continuity.crownFromPhoto`, from photo readings keyed `<pandId>/<frontId>`.
 * `facts` are the face-grounded facts the compile uses. A requested front whose photo abstains keeps its authored
 * crown and is reported in `kept`.
 */
export function facePhotoPatches(requests: {pand: string; front?: string}[], intents: CanalHouseIntent[], facts: BuildingFacts[], readings: Map<string, PhotoGable>, stripGroundNAP: number): {patches: PhotoCrownPatch[]; kept: {pand: string; front: string; why: string}[]} {
  const patches: PhotoCrownPatch[] = [], kept: {pand: string; front: string; why: string}[] = [];
  for (const r of requests) {
    const i = intents.findIndex(x => x.pandId === r.pand);
    if (i < 0) throw Error(`crownFromPhoto: ${r.pand} is not on this face`);
    const {recipe, report} = fitIntent(intents[i], facts[i]);
    for (const front of intents[i].fronts.filter(f => r.front === undefined || f.id === r.front)) {
      const raw = readings.get(`${r.pand}/${front.id}`);
      if (!raw) { kept.push({pand: r.pand, front: front.id, why: 'no photo reading for this front'}); continue; }
      const rf = report.fronts.find(x => x.id === front.id)!, modelEavesUp = rf.eavesM + facts[i].heights.groundNAP - stripGroundNAP;
      const reading = withModelEaves(raw, modelEavesUp);
      const patch = photoCrownPatch(r.pand, front, reading, {widthM: rf.widthM, upperStoreyM: rf.storeyHeightsM.at(-1)!, authoredSpan: authoredShape(recipe, report, front.id).span, modelEavesUp});
      if (patch) patches.push(patch); else kept.push({pand: r.pand, front: front.id, why: reading.abstain.join('; ') || 'photo type unknown'});
    }
  }
  return {patches, kept};
}
