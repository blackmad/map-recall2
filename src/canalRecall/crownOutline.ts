/**
 * One definition of the canal-house crown outlines (neck, bell, point, step, spout, cornice with a cap, shouldered),
 * shared by the kit (canalhouseRecipes.ts / buildingRecipe/fit.ts re-export these unchanged) and the ordinary
 * renderer's row crowns (houseLine/crownProfile.ts). Light on purpose: no three.js, no scripts, so the browser mesher
 * can import it. Moved verbatim from canalhouseRecipes.ts and fit.ts (lane 1, 2026-11-13): the kit's output is
 * byte-identical.
 */
import type {GableType} from './facade/houseRecord.ts';
import type {FrontIntent} from './buildingRecipe/intent.ts';

export type CanalhousePoint = [number, number];
const EPS = 1e-5;
const finite = (...v: number[]) => { if (!v.every(Number.isFinite)) throw new Error('Non-finite assembly dimension'); };
const positive = (...v: number[]) => { finite(...v); if (v.some(n => n <= 0)) throw new Error('Assembly dimension must be positive'); };
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Optional vocabulary helper: all dimensions/counts must be supplied by an observation. */
export interface CanalhouseCrownOptions {
  /** Independent cap width, bounded by neck width for a single-valued outline. */
  crestWidthM?: number;
  /** `segmental`: a low circular arc over the crest (meets its base at an angle, unlike `rounded`'s vertical-tangent half ellipse). */
  cap?: 'flat' | 'rounded' | 'pediment' | 'segmental';
  capRiseM?: number;
  /** Clock shoulder power: 1 straight, >1 concave, <1 convex. Omit for legacy sine. */
  shoulderCurve?: number;
  /**
   * Named flank curve for clock and neck crowns (overrides `shoulderCurve`), foot to neck, mirrored on both flanks:
   * `concave` a quarter ellipse, flat at the foot and tangent to the neck (a claw piece, a bell's flare: the Wallen
   * fronts measure 0.1 of the climb at mid-flank, the ellipse gives 0.13); `ogee` concave below and convex above (an S);
   * `straight` a plain slant; `convex` the quarter-sine bulge.
   */
  shoulder?: CrownShoulder;
}
export type CrownShoulder = 'concave' | 'ogee' | 'straight' | 'convex';
/** Flank samples (f along foot->neck, h up eaves->shoulder), both in [0, 1], foot first. */
export function crownShoulderCurve(shoulder: CrownShoulder, segments = 8): [number, number][] {
  return Array.from({length: segments + 1}, (_, i) => {
    const u = i / segments;
    if (shoulder === 'concave') { const a = u * Math.PI / 2; return [Math.sin(a), 1 - Math.cos(a)] as [number, number]; }
    if (shoulder === 'ogee') return [u, u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2] as [number, number];
    if (shoulder === 'straight') return [u, u] as [number, number];
    return [u, Math.sin(u * Math.PI / 2)] as [number, number];
  });
}
export function canalhouseCrownProfile(type: GableType, widthM: number, eavesM: number, topM: number,
  neckWidthM: number, shoulderM: number, steps: number, options: CanalhouseCrownOptions = {}): CanalhousePoint[] {
  positive(widthM, eavesM); finite(topM, neckWidthM, shoulderM, steps);
  if (topM < eavesM || neckWidthM < 0 || neckWidthM > widthM || shoulderM < eavesM || shoulderM > topM) throw new Error('Invalid crown profile dimensions');
  const crest=options.crestWidthM??neckWidthM, cap=options.cap??'flat', rise=options.capRiseM??0;
  finite(crest,rise,options.shoulderCurve??1);
  if(crest<0||crest>neckWidthM||rise<0||rise>topM-shoulderM+EPS||
    !['flat','rounded','pediment','segmental'].includes(cap)||(cap==='flat'&&rise!==0)||
    (cap!=='flat'&&(crest===0||rise===0))||
    (options.shoulderCurve!==undefined&&(options.shoulderCurve<.25||options.shoulderCurve>8))||
    (options.shoulder!==undefined&&!['concave','ogee','straight','convex'].includes(options.shoulder)))throw new Error('Invalid crown cap or shoulder dimensions');
  if(Object.keys(options).length&&!['klok','hals','lijst'].includes(type))throw new Error('Cap controls require a clock, neck or list crown');
  const mid = widthM/2, left = (widthM-neckWidthM)/2, right = widthM-left;
  if (type === 'lijst' && !Object.keys(options).length) return [[0,eavesM],[widthM,eavesM]];
  if (type === 'punt') return [[0,eavesM],[mid,topM],[widthM,eavesM]];
  if (type === 'trap') {
    if (!Number.isInteger(steps) || steps < 1 || steps > 20) throw new Error('Invalid observed step count');
    const out: CanalhousePoint[] = [[0,eavesM]];
    for (let i=1;i<=steps;i++) { const x=left*i/steps, y=eavesM+(topM-eavesM)*i/steps; out.push([x,out.at(-1)![1]],[x,y]); }
    // The right flank mirrors the left exactly (user, 2026-10-16: stepped gables are symmetric). The former loop ran
    // one tread late: the crest gained a tread on the right and the eaves-level tread was lost, so every step gable
    // leaned by one tread width.
    out.push([right,topM]);
    for(let i=steps;i>=1;i--) { const x=widthM-left*i/steps, yHigh=eavesM+(topM-eavesM)*i/steps, yLow=eavesM+(topM-eavesM)*(i-1)/steps; if (i<steps) out.push([x,yHigh]); out.push([x,yLow]); }
    out.push([widthM,eavesM]); return out;
  }
  const capBase=topM-rise,capLeft=mid-crest/2,capRight=mid+crest/2;
  const capPoints:CanalhousePoint[]=[[left,capBase],[capLeft,capBase]];
  if(cap==='rounded')for(let i=1;i<=12;i++){const angle=Math.PI*(1-i/12);capPoints.push([mid+crest/2*Math.cos(angle),capBase+rise*Math.sin(angle)]);}
  else if(cap==='pediment')capPoints.push([mid,topM],[capRight,capBase]);
  else if(cap==='segmental'){
    // Circle through both crest ends and the apex: radius from chord and rise.
    const half=crest/2,radius=(half*half+rise*rise)/(2*rise),centreY=topM-radius,sweep=Math.asin(Math.min(1,half/radius));
    for(let i=1;i<12;i++){const a=-sweep+2*sweep*i/12;capPoints.push([mid+radius*Math.sin(a),centreY+radius*Math.cos(a)]);}
    capPoints.push([capRight,capBase]);
  }
  else capPoints.push([capRight,topM]);
  capPoints.push([right,capBase]);
  const compact=(points:CanalhousePoint[])=>points.filter((p,i)=>i===0||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>EPS);
  if (type === 'lijst') return compact([[0,eavesM],[left,eavesM],...capPoints,[right,eavesM],[widthM,eavesM]]);
  if ((type === 'klok' || type === 'hals') && options.shoulder) {
    const curve = crownShoulderCurve(options.shoulder), out: CanalhousePoint[] = [];
    for (const [f, h] of curve) out.push([left*f, eavesM+(shoulderM-eavesM)*h]);
    out.push(...capPoints);
    for (const [f, h] of [...curve].reverse()) out.push([widthM-left*f, eavesM+(shoulderM-eavesM)*h]);
    return compact(out);
  }
  if (type === 'klok') {
    const out: CanalhousePoint[] = [];
    // Smooth reusable silhouette; width, shoulder and crest remain measured inputs.
    const shoulder=(f:number)=>options.shoulderCurve===undefined?Math.sin(f*Math.PI/2):f**options.shoulderCurve;
    for(let i=0;i<=8;i++){ const f=i/8; out.push([left*f,eavesM+(shoulderM-eavesM)*shoulder(f)]); }
    // Preserve the exact legacy profile when no controls are selected.
    out.push(...(Object.keys(options).length?capPoints:[[left,topM],[right,topM]] as CanalhousePoint[]));
    for(let i=8;i>=0;i--){ const f=i/8; out.push([widthM-left*f,eavesM+(shoulderM-eavesM)*shoulder(f)]); } return Object.keys(options).length?compact(out):out;
  }
  if(type==='hals'&&options.shoulderCurve!==undefined){
    const out:CanalhousePoint[]=[];
    for(let i=0;i<=8;i++){const f=i/8;out.push([left*f,eavesM+(shoulderM-eavesM)*f**options.shoulderCurve]);}
    out.push(...capPoints);
    for(let i=8;i>=0;i--){const f=i/8;out.push([widthM-left*f,eavesM+(shoulderM-eavesM)*f**options.shoulderCurve]);}
    return compact(out);
  }
  if(Object.keys(options).length)return compact([[0,eavesM],[left,shoulderM],...capPoints,[right,shoulderM],[widthM,eavesM]]);
  return [[0,eavesM],[left,shoulderM],[left,topM],[right,topM],[right,shoulderM],[widthM,eavesM]];
}

/** Neck share of a neck/bell crown's width: measured (`crownNeckWidth`) or the stock 0.5 neck / 0.46 bell. */
export const neckShare = (f: FrontIntent) => f.crownNeckWidth ?? (f.gable === 'bell' ? 0.46 : 0.5);
/** Cap rise of a neck/bell crown `width` wide: measured (`crownCapRatio` of the neck, within 0.4 of the rise) or the stock share of the rise. */
// A flat cap (`crownCap: "flat"`, Van Breestraat 119-127 bell gables, Museumkwartier #159) has no rise: the neck ends in a
// level coping. Before, a neck/bell crown with a flat cap threw in canalhouseCrownProfile (a flat cap with a rise), so no
// installed recipe carries one and every other crown is byte-identical.
export const capRiseOf = (f: FrontIntent, rise: number, width: number) => f.crownCap === 'flat' ? 0 : f.crownCapRatio !== undefined ? Math.min(f.crownCapRatio * width * neckShare(f), rise * 0.4) : f.gable === 'bell' ? Math.min(0.6, rise * 0.15) : Math.min(0.45, rise * 0.1);

/**
 * A `shouldered` gable `width` wide (FrontIntent.shouldered): plumb sides `shoulder` over the eaves, then straight rakes
 * to the top (a point, or a flat top `flatTop` wide). Its top is eaves + shoulder + rise.
 */
export function shoulderedProfile(width: number, eaves: number, s: NonNullable<FrontIntent['shouldered']>): CanalhousePoint[] {
  const sy = eaves + s.shoulder, top = sy + s.rise, tw = Math.min(s.flatTop ?? 0, width * 0.8), mid = width / 2;
  return [[0, eaves], [0, sy], ...(tw > 0.01 ? [[mid - tw / 2, top], [mid + tw / 2, top]] as CanalhousePoint[] : [[mid, top]] as CanalhousePoint[]), [width, sy], [width, eaves]];
}

/**
 * One half of a symmetric crown outline (`FrontIntent.crownHalf`): `full` is the crown drawn over twice the half's span;
 * the left half keeps x <= centre, the right half x >= centre shifted to start at 0. The cut is interpolated on the
 * segment that crosses the centre (the apex itself on a pointed crown).
 */
export function halfCrown(full: CanalhousePoint[], half: 'left' | 'right'): CanalhousePoint[] {
  const c = (full[0][0] + full.at(-1)![0]) / 2, out: CanalhousePoint[] = [];
  const keep = (x: number) => half === 'left' ? x <= c + 1e-9 : x >= c - 1e-9;
  for (let i = 0; i < full.length; i++) {
    const p = full[i];
    if (i > 0) {
      const q = full[i - 1];
      if ((q[0] - c) * (p[0] - c) < -1e-12) out.push([c, q[1] + (p[1] - q[1]) * (c - q[0]) / (p[0] - q[0])]);
    }
    if (keep(p[0])) out.push(p);
  }
  const dedup = out.filter((p, i) => i === 0 || Math.abs(p[0] - out[i - 1][0]) > 1e-9 || Math.abs(p[1] - out[i - 1][1]) > 1e-9);
  return half === 'left' ? dedup : dedup.map(([x, y]) => [round(x - c, 4), y] as CanalhousePoint);
}

/** `fill`: the crown stands on a part of the front (`crownAt`/`crownBays`) and fills that part; wide cornice caps by default. */
export function crownProfile(f: FrontIntent, width: number, eaves: number, top: number, fill = false): CanalhousePoint[] | null {
  // A half crown (`crownHalf`): the crown drawn twice as wide, cut on its centre line (the party wall).
  if (f.crownHalf) { const full = crownProfile({...f, crownHalf: undefined}, width * 2, eaves, top, fill); return full && halfCrown(full, f.crownHalf); }
  const rise = top - eaves;
  if (f.gable === 'flat' || rise < 0.3) return null;
  switch (f.gable) {
    case 'shouldered': return f.shouldered ? shoulderedProfile(width, eaves, f.shouldered) : null;
    case 'point': return canalhouseCrownProfile('punt', width, eaves, top, 0, eaves, 0);
    case 'spout': return canalhouseCrownProfile('tuit', width, eaves, top, width * 0.34, top - Math.min(0.7, rise * 0.15), 0);
    case 'step': return canalhouseCrownProfile('trap', width, eaves, top, width * 0.3, eaves, f.crownSteps ?? clamp(Math.round(rise / 1.4), 2, 5));
    // Flanks: `crownShoulder` (measured off the strip, gableFromStrip `flankCurvature`), default concave. The kit drew
    // every neck (power 0.6) and bell (quarter sine) flank convex, the inverse of the claw pieces and bell flares on the
    // photos (user, 2026-10-16); every flank measured on the six bell/neck faces reads concave.
    // `crownNeckWidth` / `crownCapRiseM`: measured on the photo; absent, the stock shares (byte-identical).
    case 'neck': case 'raised-neck': { const n = width * neckShare(f); return canalhouseCrownProfile('hals', width, eaves, top, n, eaves + rise * (f.crownShoulderRise ?? (f.gable === 'neck' ? 0.45 : 0.25)), 0, {cap: f.crownCap ?? 'pediment', capRiseM: capRiseOf(f, rise, width), crestWidthM: n, shoulder: f.crownShoulder ?? 'concave'}); }
    case 'bell': { const n = width * neckShare(f); return canalhouseCrownProfile('klok', width, eaves, top, n, eaves + rise * (f.crownShoulderRise ?? 0.55), 0, {cap: f.crownCap ?? 'rounded', capRiseM: capRiseOf(f, rise, width), crestWidthM: n, shoulder: f.crownShoulder ?? 'concave'}); }
    case 'cornice': {
      if (f.crownCap && f.crownCap !== 'flat') {
        // Wide: a parapet over nearly the whole front with the cap across it (1900s fronts, 081118/087959).
        const spanK = {narrow: [0.3, 0.3], medium: [0.62, 0.56], wide: [0.94, 0.86]}[f.crownCapSpan ?? (fill ? 'wide' : 'narrow')];
        const capRise = f.crownCapRise === 'low' ? 0.38 : f.crownCapSpan === 'wide' ? 0.8 : 0.7;
        return canalhouseCrownProfile('lijst', width, eaves, top, width * spanK[0], eaves, 0, {cap: f.crownCap, capRiseM: Math.min(capRise, rise), crestWidthM: width * spanK[1]});
      }
      return null;
    }
  }
  return null;
}
