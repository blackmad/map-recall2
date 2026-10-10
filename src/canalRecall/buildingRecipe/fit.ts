/**
 * Deterministic FIT: intent (components/counts) + facts (BAG/3DBAG metres)
 * → the canalhouse library's measured `CanalHouseRecipe`.
 *
 * Footprint and roof come verbatim from 3DBAG LoD2.2 via `surveyRecipe`
 * (no generated roof volumes). Facade metres are derived from the frontage
 * width and the 3DBAG front eaves/top profile with fixed proportion rules,
 * so the same intent always fits the same geometry.
 */
import type {CanalHouseRecipe, CanalhouseDressing, CanalhouseElevation, CanalhouseOpening, CanalhousePoint} from '../canalhouseRecipes.ts';
import type {CanalhouseGlazedBay} from '../canalhouseGlazedBay.ts';
import {wordRects} from '../blockLetters.ts';
import {canalhouseCrownProfile} from '../canalhouseRecipes.ts';
import {surveyRecipe} from '../../../scripts/canalhouse-recipes/survey-recipe.ts';
import {unobservedHouse, type GableType} from '../facade/houseRecord.ts';
import {measured, type Observation} from '../facade/evidence.ts';
import type {BuildingFacts, FrontFacts} from './facts.ts';
import {swatch, type CanalHouseIntent, type FrontIntent, type GableIntent} from './intent.ts';
import {cleanRoof, type RoofCleanupReport} from './roofCleanup.ts';

export const ROOF_COLOURS: Record<CanalHouseIntent['roof']['material'], {steep: string; low: string; flat: string}> = {
  slate: {steep: '#3b4047', low: '#4b5056', flat: '#6a6c6c'},
  'black-tile': {steep: '#2f2e2f', low: '#3d3b3b', flat: '#666462'},
  'red-tile': {steep: '#8a4632', low: '#7a4a3c', flat: '#6a6664'},
  bitumen: {steep: '#45474a', low: '#4f5154', flat: '#5d5f60'},
  zinc: {steep: '#8b9196', low: '#868c90', flat: '#77797a'},
  copper: {steep: '#5f8a78', low: '#5f8a78', flat: '#6a6c6a'},
};
const GLASS = '#2a3a42';

const GABLE_TYPE: Record<GableIntent, GableType> = {spout: 'tuit', neck: 'hals', 'raised-neck': 'verhoogde-hals', bell: 'klok', step: 'trap', point: 'punt', cornice: 'lijst', flat: 'lijst'};
const WINDOW_BARS: Record<FrontIntent['windows'], Pick<CanalhouseOpening, 'verticalBars' | 'horizontalBars'>> = {
  sash: {verticalBars: [.5], horizontalBars: [.55]},
  'sash-small-panes': {verticalBars: [1 / 3, 2 / 3], horizontalBars: [.25, .5, .75]},
  cross: {verticalBars: [.5], horizontalBars: [.36]},
  plain: {},
  arched: {verticalBars: [.5], horizontalBars: [.55]},
  shop: {},
};

export interface FitReport {
  fronts: {id: string; widthM: number; eavesM: number; crownTopM: number; storeyHeightsM: number[]; mirrored: boolean; edge: [number, number]; frontageDeviationM: number; frontageOutsetM: number; polygonIndex: number}[];
  warnings: string[];
  /** Height the model may exceed the LoD2.2 roof max by: 3DBAG LoD2.2 has no dormers, so declared dormers stand above it. */
  roofAllowanceM?: number;
  /** 3DBAG roof artefacts removed before the survey conversion (roofCleanup.ts). */
  roofCleanup?: RoofCleanupReport;
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Split the frontage chain into consecutive sub-chains by shares, snapping to ring vertices. */
function splitChain(front: FrontFacts, shares: number[]): [number[], number[]][] {
  const chain = front.chainRD, cumulative: number[] = [0];
  for (let i = 1; i < chain.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
  const total = cumulative.at(-1)!, cuts = [0];
  let acc = 0;
  for (const share of shares.slice(0, -1)) {
    acc += share * total;
    let best = -1;
    for (let i = 1; i < chain.length - 1; i++) if (best < 0 || Math.abs(cumulative[i] - acc) < Math.abs(cumulative[best] - acc)) best = i;
    if (best < 0 || Math.abs(cumulative[best] - acc) > 1.5) throw Error(`No footprint vertex within 1.5 m of the ${round(acc, 2)} m front split`);
    cuts.push(best);
  }
  cuts.push(chain.length - 1);
  return cuts.slice(1).map((c, i) => [chain[cuts[i]], chain[c]] as [number[], number[]]);
}

interface Layout { openings: CanalhouseOpening[]; glazedBays: CanalhouseGlazedBay[]; balconies: {storey: number; bay: number}[]; storeyHeights: number[]; groundBase: number; doorLeft: number | null; doorWidth: number; shopSpans: [number, number][]; shopGlass: [number, number] | null }

/** Shopfront proportions: pier width, stall riser top, fascia depth below the ground-storey top. */
const SHOP = {pierM: 0.3, glassBottomM: 0.55, fasciaM: 0.62, fasciaGapM: 0.08};

/** Regular bay grid fitted to width/height. `heightTop` is where full storeys end. */
function layoutFront(f: FrontIntent, width: number, heightTop: number): Layout {
  const basement = f.basement !== 'none' ? clamp(heightTop * 0.07, 0.7, 1.2) : 0;
  const n = f.storeys, groundFactor = f.tallGround || f.shopfront ? 1.32 : 1.1;
  // Upper storeys diminish by 4% each; solve for the first upper storey height.
  const factors = [groundFactor, ...Array.from({length: n - 1}, (_, k) => 0.96 ** k)];
  const unit = (heightTop - basement) / factors.reduce((s, x) => s + x, 0);
  const heights = factors.map(x => x * unit);
  const bays = Array.isArray(f.bays) ? f.bays : Array(n).fill(f.bays);
  const bars = WINDOW_BARS[f.windows], segmental = f.windows === 'arched' ? {head: 'segmental' as const, headRiseM: 0.18, headSegments: 4} : {};
  // Round-arched storeys: a semicircular head (rise = half the width).
  const headFor = (s: number, w: number) => f.archedStoreys?.includes(s) ? {head: 'segmental' as const, headRiseM: Math.floor(w / 2 * 1000) / 1000, headSegments: 6} : segmental;
  const openings: CanalhouseOpening[] = [], glazedBays: CanalhouseGlazedBay[] = [], balconies: Layout['balconies'] = [];
  const doorWidth = clamp(width * 0.2, 0.95, 1.4);
  let doorLeft: number | null = null;
  let y = basement;
  for (let s = 0; s < n; s++) {
    const h = heights[s], count = bays[s];
    const margin = clamp(width * 0.09, 0.3, 1.2), pitch = count ? (width - 2 * margin) / count : 0;
    const winW = clamp(pitch * 0.58, 0.6, 1.5), winH = s === 0 ? h * 0.62 : h * (0.6 - 0.02 * s), sill = s === 0 ? h * 0.2 : h * 0.22;
    for (let b = 0; b < count; b++) {
      const centre = margin + pitch * (b + 0.5);
      if (s === 0 && f.doorBay === b) {
        doorLeft = clamp(centre - doorWidth / 2, 0.05, width - doorWidth - 0.05);
        const doorH = Math.min(h * 0.78, 2.7);
        openings.push({id: 'door', kind: 'door', leftM: doorLeft, bottomM: y, widthM: doorWidth, heightM: doorH, trimWidthM: 0.08, verticalBars: [.5], paneSurface: 'door', frameSurface: 'trim', barSurface: 'trim'});
        const transomH = Math.min(0.6, h - doorH - 0.25);
        if (transomH > 0.2) openings.push({id: 'door-transom', kind: 'window', leftM: doorLeft, bottomM: y + doorH + 0.06, widthM: doorWidth, heightM: transomH, trimWidthM: 0.06, frameSurface: 'trim', barSurface: 'trim'});
        continue;
      }
      if (s === 0 && f.shopfront) continue;
      if (f.bayWindows?.bay === b && f.bayWindows.storeys.includes(s)) {
        const bw = clamp(pitch * 1.05, 1.3, 2.7), bh = h * 0.74;
        glazedBays.push({id: `bay-s${s}-b${b}`, leftM: centre - bw / 2, bottomM: y + h * 0.12, widthM: bw, heightM: bh, depthM: 0.55, frontWidthM: bw * 0.72, lowerPanelM: 0.28, upperPanelM: 0.22, frameWidthM: 0.05, frameDepthM: 0.06, glassDepthM: 0.02, verticalBars: [.5], horizontalBars: [.3]});
        continue;
      }
      const balcony = f.balconies?.storeys.includes(s) && f.balconies.bays.includes(b);
      if (balcony) {
        balconies.push({storey: s, bay: b});
        openings.push({id: `s${s}-b${b}`, kind: 'window', leftM: centre - winW / 2, bottomM: y + 0.04, widthM: winW, heightM: Math.min(h - 0.2, winH + sill - 0.04), trimWidthM: 0.07, ...bars, ...segmental, frameSurface: 'trim', barSurface: 'trim'});
        continue;
      }
      const head = s > 0 || f.archedStoreys?.includes(s) ? headFor(s, winW) : {};
      // A round head needs height for its arch above the sash rail.
      const h2 = 'headRiseM' in head && head.headRiseM! > 0.3 ? Math.min(h - 0.25, Math.max(winH, head.headRiseM! / 0.42)) : winH;
      openings.push({id: `s${s}-b${b}`, kind: 'window', leftM: centre - winW / 2, bottomM: y + Math.min(sill, h - 0.12 - h2), widthM: winW, heightM: h2, trimWidthM: 0.07, ...bars, ...head, frameSurface: 'trim', barSurface: 'trim'});
    }
    y += h;
  }
  // Shopfront: piers at both ends, a stall riser, framed glazing with a transom and
  // mullions, and (with a fascia) a sign band above, all in the shopfront paint.
  const shopSpans: [number, number][] = [];
  let shopGlass: [number, number] | null = null;
  if (f.shopfront) {
    const h = heights[0], left = SHOP.pierM + 0.02, right = width - SHOP.pierM - 0.02;
    if (doorLeft === null) shopSpans.push([left, right]);
    else { if (doorLeft - 0.1 - left > 0.6) shopSpans.push([left, doorLeft - 0.1]); if (right - (doorLeft + doorWidth + 0.1) > 0.6) shopSpans.push([doorLeft + doorWidth + 0.1, right]); }
    // Glass bottom above the ground: the 0.3 m stone plinth always stays, so `none` is glass straight off the plinth.
    const riser = {none: 0.32, low: 0.42, standard: SHOP.glassBottomM}[f.shopfront.stallRiser ?? 'standard'];
    // A sign on the wall above the glass needs a band of wall: lower the glass head.
    const head = f.shopfront.fascia ? SHOP.fasciaM + SHOP.fasciaGapM + 0.04 : f.shopfront.sign?.mount === 'wall' ? 0.75 : 0.3;
    const bottom = basement + riser, top = basement + h - head;
    shopGlass = [bottom, top];
    const totalGlass = shopSpans.reduce((s, [a, b]) => s + b - a, 0);
    shopSpans.forEach(([a, b], i) => {
      const w = b - a, panes = f.shopfront!.displayWindows ? Math.max(1, Math.round(f.shopfront!.displayWindows * w / totalGlass)) : Math.round(w / 1.6), mullions = Math.max(0, panes - 1), glassH = top - bottom;
      openings.push({id: `shop-${i}`, kind: 'window', leftM: a, bottomM: bottom, widthM: w, heightM: glassH, trimWidthM: 0.08,
        verticalBars: Array.from({length: mullions}, (_, k) => round((k + 1) / (mullions + 1), 4)), horizontalBars: glassH > 1.9 ? [0.8] : [], frameSurface: 'shop', barSurface: 'shop'} as CanalhouseOpening);
    });
  }
  // Basement lights below the ground-storey windows, away from the stoop.
  if (f.basement === 'windows' || f.basement === 'stoop-and-windows') {
    const count = bays[0], margin = clamp(width * 0.09, 0.3, 1.2), pitch = count ? (width - 2 * margin) / count : 0;
    for (let b = 0; b < count; b++) {
      const centre = margin + pitch * (b + 0.5), w = clamp(pitch * 0.5, 0.5, 1.2);
      if (doorLeft !== null && centre + w / 2 > doorLeft - 0.9 && centre - w / 2 < doorLeft + doorWidth + 0.9) continue;
      openings.push({id: `basement-b${b}`, kind: 'window', leftM: centre - w / 2, bottomM: 0.12, widthM: w, heightM: Math.max(0.35, basement - 0.3), trimWidthM: 0.05, verticalBars: [.5], frameSurface: 'trim', barSurface: 'trim'});
    }
  }
  return {openings, glazedBays, balconies, storeyHeights: [basement, ...heights].filter(h => h > 0).map(h => round(h)), groundBase: basement, doorLeft, doorWidth, shopSpans, shopGlass};
}

/** A voussoir ring over a segmental/round head: outer arc left to right, inner arc back. */
function archRing(left: number, top: number, w: number, rise: number, ringM: number): CanalhousePoint[] {
  const radius = w * w / (8 * rise) + rise / 2, cx = left + w / 2, cy = top - radius;
  const start = Math.asin(clamp((top - rise - cy) / radius, -1, 1)), n = rise < w * 0.3 ? 3 : 4;
  const arc = (r: number) => Array.from({length: n + 1}, (_, i) => { const a = Math.PI - start - (Math.PI - 2 * start) * i / n; return [round(cx + r * Math.cos(a), 4), round(cy + r * Math.sin(a), 4)] as CanalhousePoint; });
  return [...arc(radius + ringM), ...arc(radius + 0.005).reverse()];
}

function crownProfile(f: FrontIntent, width: number, eaves: number, top: number): CanalhousePoint[] | null {
  const rise = top - eaves;
  if (f.gable === 'flat' || rise < 0.3) return null;
  switch (f.gable) {
    case 'point': return canalhouseCrownProfile('punt', width, eaves, top, 0, eaves, 0);
    case 'spout': return canalhouseCrownProfile('tuit', width, eaves, top, width * 0.34, top - Math.min(0.7, rise * 0.15), 0);
    case 'step': return canalhouseCrownProfile('trap', width, eaves, top, width * 0.3, eaves, clamp(Math.round(rise / 1.4), 2, 5));
    case 'neck': case 'raised-neck': return canalhouseCrownProfile('hals', width, eaves, top, width * 0.5, eaves + rise * (f.gable === 'neck' ? 0.45 : 0.25), 0, {cap: f.crownCap ?? 'pediment', capRiseM: Math.min(0.45, rise * 0.1), crestWidthM: width * 0.5, shoulderCurve: 0.6});
    case 'bell': return canalhouseCrownProfile('klok', width, eaves, top, width * 0.46, eaves + rise * 0.55, 0, {cap: f.crownCap ?? 'rounded', capRiseM: Math.min(0.6, rise * 0.15), crestWidthM: width * 0.46});
    case 'cornice': {
      if (f.crownCap && f.crownCap !== 'flat') {
        // Wide: a parapet over nearly the whole front with the cap across it (1900s fronts, 081118/087959).
        const neck = f.crownCapSpan === 'wide' ? width * 0.94 : width * 0.3, crest = f.crownCapSpan === 'wide' ? width * 0.86 : width * 0.3;
        return canalhouseCrownProfile('lijst', width, eaves, top, neck, eaves, 0, {cap: f.crownCap, capRiseM: Math.min(f.crownCapSpan === 'wide' ? 0.8 : 0.7, rise), crestWidthM: crest});
      }
      return null;
    }
  }
  return null;
}

export function fitIntent(intent: CanalHouseIntent, surveyFacts: BuildingFacts): {recipe: CanalHouseRecipe; anchorRD: [number, number]; report: FitReport; facts: BuildingFacts} {
  if (intent.pandId !== surveyFacts.pandId) throw Error('Intent and facts describe different Pand');
  const cleanup = cleanRoof(surveyFacts, {horizontalFronts: intent.fronts.filter(f => f.gable === 'cornice' || f.gable === 'flat').map(f => f.street)}), facts = cleanup.facts;
  const warnings: string[] = [];
  const bagObservation: Observation = {id: '3dbag', pandId: intent.pandId, kind: 'registry-record', elevation: 'roof', capturedAt: facts.source.fetchedAt.length === 10 ? facts.source.fetchedAt : '2025-01-01', sourceUrl: facts.source.threeDBag, license: 'CC BY 4.0 (3DBAG)'};
  const photoObservations: Observation[] = intent.sources.map(s => ({id: s.id, pandId: intent.pandId, kind: s.kind === 'monument-record' ? 'monument-record' : s.kind === 'archive-photo' ? 'archive-photo' : s.kind === 'human-review' ? 'human-review' : 'street-panorama', elevation: 'front', capturedAt: s.capturedAt, sourceUrl: s.url ?? null, license: s.license ?? null}));
  const photo = photoObservations[0];
  // Intent values are photo classifications, not rectified measurements: the
  // evidence ledger records them as street-level with low confidence.
  const seen = <V>(v: V) => measured(v, 'streetlevel-measured', 0.4, photo);
  const surveyed = <V>(v: V) => measured(v, '3dbag', 0.9, bagObservation);

  // Group fronts by street so several fronts can share one discovered frontage.
  const byStreet = new Map<string, FrontIntent[]>();
  for (const f of intent.fronts) byStreet.set(f.street, [...(byStreet.get(f.street) ?? []), f]);
  const pieces: {front: FrontIntent; facts: FrontFacts; endpoints: [number[], number[]]}[] = [];
  for (const [street, fronts] of byStreet) {
    const ff = facts.fronts.find(x => x.street === street);
    if (!ff) throw Error(`facts.json has no frontage for ${street}; re-run facts`);
    const shares = fronts.map(f => f.share ?? 1 / fronts.length), total = shares.reduce((s, x) => s + x, 0);
    const split = fronts.length === 1 ? [ff.endpointsRD as [number[], number[]]] : splitChain(ff, shares.map(s => s / total));
    fronts.forEach((front, i) => pieces.push({front, facts: ff, endpoints: split[i]}));
  }
  // The first front seeds the shared footprint/roof conversion.
  const survey = surveyRecipe({attributes: facts.attributes, roofsRD: facts.roofsRD}, facts.surveyFootprintPolygonsRD, pieces[0].endpoints);
  const anchor = survey.anchorRD, toLocal = (p: number[]): CanalhousePoint => [p[0] - anchor[0], anchor[1] - p[1]];
  const polygons = survey.polygons;
  const house = unobservedHouse(intent.pandId);
  const elevations: CanalhouseElevation[] = [];
  const reports: FitReport['fronts'] = [];
  let mainEaves = Infinity;
  for (const {front, facts: ff, endpoints} of pieces) {
    const [left, right] = endpoints.map(toLocal);
    // Locate both endpoints on one ring and walk forward along the chain.
    let polygonIndex = -1, iLeft = -1, iRight = -1;
    polygons.forEach((p, pi) => {
      const l = p.outer.findIndex(v => Math.hypot(v[0] - left[0], v[1] - left[1]) < 1e-4), r = p.outer.findIndex(v => Math.hypot(v[0] - right[0], v[1] - right[1]) < 1e-4);
      if (l >= 0 && r >= 0) { polygonIndex = pi; iLeft = l; iRight = r; }
    });
    if (polygonIndex < 0) throw Error(`${front.id}: frontage endpoints are not footprint vertices`);
    const ring = polygons[polygonIndex].outer, n = ring.length;
    const pathLength = (from: number, to: number) => { let s = 0; for (let i = from; i !== to; i = (i + 1) % n) s += Math.hypot(ring[(i + 1) % n][0] - ring[i][0], ring[(i + 1) % n][1] - ring[i][1]); return s; };
    const forward = pathLength(iLeft, iRight) <= pathLength(iRight, iLeft);
    const edgeIndex = forward ? iLeft : iRight, endIndex = forward ? iRight : iLeft;
    // The facade x axis starts at ring[edgeIndex]; mirror authored left-to-right layouts when that is the viewer's right.
    const mirrored = !forward;
    const a = ring[edgeIndex], b = ring[endIndex], width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Signed offsets of intermediate frontage vertices, using the compiler's outward normal.
    const ringSign = ring.reduce((s, p, i) => { const q = ring[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
    const ux = (b[0] - a[0]) / width, uz = (b[1] - a[1]) / width, nx = ringSign * uz, nz = -ringSign * ux;
    let deviation = 0, maxOut = 0, maxIn = 0;
    for (let i = (edgeIndex + 1) % n; i !== endIndex; i = (i + 1) % n) {
      const o = (ring[i][0] - a[0]) * nx + (ring[i][1] - a[1]) * nz;
      deviation = Math.max(deviation, Math.abs(o)); maxOut = Math.max(maxOut, o); maxIn = Math.max(maxIn, -o);
    }
    if (maxOut > 0.5) warnings.push(`${front.id}: frontage vertex ${round(maxOut, 2)} m proud of the chord; facade plane approximated`);
    // Heights from the 3DBAG roof profile inside this piece of frontage.
    const along = ff.topProfile.filter(p => { const pt = [ff.endpointsRD[0][0] + (ff.endpointsRD[1][0] - ff.endpointsRD[0][0]) * p.alongM / ff.widthM, ff.endpointsRD[0][1] + (ff.endpointsRD[1][1] - ff.endpointsRD[0][1]) * p.alongM / ff.widthM];
      const t = ((pt[0] - endpoints[0][0]) * (endpoints[1][0] - endpoints[0][0]) + (pt[1] - endpoints[0][1]) * (endpoints[1][1] - endpoints[0][1])) / ((endpoints[1][0] - endpoints[0][0]) ** 2 + (endpoints[1][1] - endpoints[0][1]) ** 2);
      return t >= 0 && t <= 1; }).map(p => p.heightM).sort((x, y) => x - y);
    if (along.length < 3) throw Error(`${front.id}: no 3DBAG roof profile along this front`);
    const eaves = round(along[Math.floor(along.length * 0.1)]), profileTop = along.at(-1)!;
    // Gabled crowns rise above the roof meeting line; their top is the higher
    // of the profile peak and a proportion of the width, capped by the ridge.
    const gabled = !['cornice', 'flat'].includes(front.gable);
    // Repeated module: one house design laid out `count` times along this front
    // (19th-century rows, double fronts). Layout is fitted once per module width.
    const count = front.repeat ? (front.repeat.count === 'fit' ? Math.max(1, Math.round(width / 6)) : front.repeat.count) : 1;
    const mw = width / count, alternate = !!front.repeat?.mirrorAlternate;
    const place = (k: number, x: number, w = 0) => k * mw + (alternate && k % 2 ? mw - x - w : x);
    const crownTop = gabled ? Math.max(profileTop + 0.3, Math.min(facts.heights.ridgeM + 0.3, eaves + mw * (front.gable === 'step' ? 1 : 0.9))) : eaves + (front.crownCap && front.crownCap !== 'flat' ? 1.1 : 0);
    const corniceH = {none: 0, simple: 0.35, bracketed: 0.55, heavy: 0.8}[front.cornice];
    const layout = layoutFront(front, mw, eaves - (gabled ? 0.2 : corniceH + 0.15));
    const moduleOpenings = Array.from({length: count}, (_, k) => layout.openings.map(o => ({...o, id: count > 1 ? `${o.id}-m${k}` : o.id, leftM: place(k, o.leftM, o.widthM)}))).flat();
    let lintelBands: NonNullable<CanalhouseElevation['bands']>['value'] = [];
    const flipX = (x: number, w: number) => mirrored ? width - x - w : x;
    const flip = (o: CanalhouseOpening): CanalhouseOpening => ({...o, leftM: flipX(o.leftM, o.widthM)});
    const elevation: CanalhouseElevation = {
      id: front.id, polygonIndex, edgeIndex, ...(endIndex !== (edgeIndex + 1) % n ? {endEdgeIndex: endIndex, frontageToleranceM: surveyed(round(Math.min(.3, deviation + .01)))} : {}),
      ...(deviation > .3 ? {frontagePlan: surveyed({maxInsetM: round(Math.min(1, Math.max(maxIn, .01) + .02)), maxOutsetM: round(Math.min(.5, maxOut + .02))})} : {}),
      openings: seen(moduleOpenings.map(flip).map(o => pieces.length > 1 ? {...o, id: `${front.id}-${o.id}`} : o)),
      ...(front.palette ? {palette: seen(paletteFor(intent, front))} : {}),
    };
    // Relieving arches over arched heads: a brick-on-edge ring (band brick or stone dressing).
    const ringSurface = front.archRings === 'none' ? null : front.archRings === 'stone' ? 'stone' as const : front.archRings === 'band' || (front.palette?.band ?? intent.palette.band) ? 'accent' as const : 'stone' as const;
    if (ringSurface) {
      const rings = elevation.openings.value.filter(o => o.head === 'segmental' && o.headRiseM && !o.id.includes('shop')).map(o => ({id: `arch-${o.id}`, profile: archRing(o.leftM, o.bottomM + o.heightM, o.widthM, o.headRiseM!, 0.13), depthM: 0.03, fill: ringSurface}));
      if (rings.length) elevation.ornaments = seen(rings);
    }
    // Bay windows, balcony guards and masonry courses (street-house features).
    const idFor = (k: number, base: string) => `${pieces.length > 1 ? `${front.id}-` : ''}${base}${count > 1 ? `-m${k}` : ''}`;
    if (layout.glazedBays.length) elevation.glazedBays = seen(Array.from({length: count}, (_, k) => layout.glazedBays.map(g => ({...g, id: idFor(k, g.id), leftM: round(flipX(place(k, g.leftM!, g.widthM), g.widthM))}))).flat());
    if (layout.balconies.length) {
      const projecting = !!front.balconies?.projecting;
      elevation.balconies = seen(Array.from({length: count}, (_, k) => layout.balconies.map(b => {
        const opening = moduleOpenings.find(o => o.id === `${count > 1 ? '' : ''}s${b.storey}-b${b.bay}${count > 1 ? `-m${k}` : ''}`)!;
        return {id: idFor(k, `rail-s${b.storey}-b${b.bay}`), openingId: pieces.length > 1 ? `${front.id}-${opening.id}` : opening.id, heightM: 0.9, depthM: projecting ? 0.6 : 0.12, barWidthM: 0.02, posts: projecting ? 9 : 7, ...(projecting ? {projection: {widthM: round(opening.widthM + 0.5), slabThicknessM: 0.12, pierWidthM: 0.06}} : {})};
      })).flat());
    }
    const bandBrick = !!(front.palette?.band ?? intent.palette.band);
    if (front.bands && front.bands !== 'none') {
      const bottoms: number[] = []; let acc = layout.groundBase;
      for (const h of layout.storeyHeights.slice(layout.groundBase > 0 ? 1 : 0)) { bottoms.push(acc); acc += h; }
      const courses: NonNullable<CanalhouseElevation['bands']>['value'] = [];
      bottoms.forEach((bottom, s) => {
        if (s === 0) return;
        if (front.bands === 'storey' || front.bands === 'both') courses.push({id: `course-s${s}`, leftM: 0, bottomM: round(bottom - 0.06), widthM: Math.floor(width * 1000) / 1000, heightM: 0.12, depthM: 0.04, surface: 'stone'});
        // With a band brick in the palette, lintel courses are stripes of that brick (two-colour banding), not stone.
        if (front.bands === 'lintel' || front.bands === 'both') courses.push(bandBrick
          ? {id: `lintel-s${s}`, leftM: 0, bottomM: round(bottom + layout.storeyHeights[s + (layout.groundBase > 0 ? 1 : 0)] * 0.8), widthM: Math.floor(width * 1000) / 1000, heightM: 0.26, depthM: 0.02, surface: 'accent'}
          : {id: `lintel-s${s}`, leftM: 0, bottomM: round(bottom + layout.storeyHeights[s + (layout.groundBase > 0 ? 1 : 0)] * 0.84), widthM: Math.floor(width * 1000) / 1000, heightM: 0.1, depthM: 0.035, surface: 'stone'});
      });
      lintelBands = courses;
    }
    if (corniceH > 0) elevation.cornice = seen({bottomM: round(eaves - corniceH), heightM: corniceH, depthM: round(corniceH * 0.5), brackets: front.cornice === 'bracketed' ? Math.max(2, Math.round(width / 1.6)) : 0});
    // Non-straight frontages need an explicit wall top (the library only reads
    // roof edges lying on the chord); a flat crown at the eaves supplies it.
    const moduleProfile = crownProfile(front, mw, eaves, crownTop);
    const profile = moduleProfile ? Array.from({length: count}, (_, k) => moduleProfile.map(([x, y]) => [place(k, x), y] as CanalhousePoint)).flat() : [[0, eaves], [width, eaves]] as CanalhousePoint[];
    if (profile) {
      elevation.crown = seen({profile: profile.map(([x, y]) => [Math.min(width, Math.max(0, mirrored ? width - x : x)), Math.max(eaves, y)] as CanalhousePoint).sort((p, q) => p[0] - q[0]), depthM: 0.18, trimWidthM: 0.08, surface: 'wall'});
      // Attic windows inside the crown.
      const attic = front.atticWindows ?? 0, rise = crownTop - eaves;
      if (attic > 0 && rise > 1.2) {
        const w = clamp(mw * 0.14, 0.5, 0.9), h = clamp(rise * 0.4, 0.6, 1.4), gap = w * 0.5, total = attic * w + (attic - 1) * gap;
        // Neck gables stack their attic lights up the neck; other crowns set them side by side.
        const stack = front.gable === 'neck' || front.gable === 'raised-neck', hh = stack ? Math.min(h, (rise - 0.8) / attic - 0.3) : h;
        for (let m = 0; m < count; m++) for (let k = 0; k < attic; k++) elevation.openings.value.push({id: `${pieces.length > 1 ? front.id + "-" : ""}attic-${k}${count > 1 ? `-m${m}` : ''}`, kind: 'window', leftM: flipX(place(m, stack ? (mw - w) / 2 : (mw - total) / 2 + k * (w + gap), w), w), bottomM: eaves + 0.25 + (stack ? k * (hh + 0.3) : 0), widthM: w, heightM: stack ? hh : h, trimWidthM: 0.06, ...WINDOW_BARS[front.windows === 'shop' ? 'sash' : front.windows], frameSurface: 'trim', barSurface: 'trim'});
      }
    }
    if (front.dormers) {
      const k = front.dormers, w = clamp(mw / (k * 2.2), 0.9, 1.6), gap = (mw - k * w) / (k + 1);
      elevation.dormers = seen(Array.from({length: k * count}, (_, j) => ({id: `dormer-${j}`, leftM: round(flipX(place(Math.floor(j / k), gap + (j % k) * (w + gap), w), w)), widthM: round(w), bottomM: round(Math.max(eaves, survey.shellTopM) + 0.05), heightM: 1.45, depthM: 1.3, roofRiseM: 0.45, setbackM: 0.35, trimWidthM: 0.07, verticalBars: [.5], wallSurface: 'trim' as const, roofSurface: 'roof' as const})));
    }
    if (front.hoist) elevation.hoists = seen(Array.from({length: count}, (_, m) => ({id: count > 1 ? `hoist-m${m}` : 'hoist', centerM: flipX(place(m, mw / 2), 0), heightM: round(gabled ? crownTop - 0.9 : eaves + 0.1), widthM: 0.14, beamHeightM: 0.18, projectionM: 1.1, setbackM: 0.1, surface: 'door' as const})));
    if ((front.basement === 'stoop' || front.basement === 'stoop-and-windows') && layout.doorLeft !== null && layout.groundBase > 0) {
      // The library admits one entrance per elevation: the first module's stoop.
      const dl = flipX(place(0, layout.doorLeft, layout.doorWidth), layout.doorWidth);
      elevation.entrance = seen({leftM: round(dl - 0.15), widthM: round(layout.doorWidth + 0.3), riseM: round(layout.groundBase), runM: round(Math.min(1.4, layout.groundBase * 1.4)), approximateRiserM: 0.18, surface: 'stone'});
    }
    // Stone plinth band under ground storey, or across a shopfront.
    const plinth = layout.groundBase > 0 ? layout.groundBase : 0.3;
    elevation.bands = seen([{id: 'plinth', leftM: 0, bottomM: 0, widthM: Math.floor(width * 1000) / 1000, heightM: round(plinth), depthM: 0.06, surface: 'stone'}]);
    // A front with its own palette gets a thin masonry facing: the shell and
    // roof closures behind it are shared by the whole owner and keep the main colour.
    elevation.bands.value.push(...lintelBands);
    if (front.palette?.brick) elevation.bands.value.push({id: 'facing', leftM: 0, bottomM: round(plinth), widthM: Math.floor(width * 1000) / 1000, heightM: round(eaves - plinth - 0.02), depthM: 0.03, surface: 'wall'});
    if (front.shopfront && layout.shopGlass) {
      const top = layout.groundBase + layout.storeyHeights[layout.groundBase > 0 ? 1 : 0], full = Math.floor(width * 1000) / 1000;
      // Piers and stall riser in the shopfront paint; the sign band carries a pale lettering panel.
      const blocks = [{id: 'shop-pier-left', leftM: 0, bottomM: round(plinth), widthM: SHOP.pierM, heightM: round(top - plinth - 0.02), depthM: 0.1, surface: 'shop' as const},
        {id: 'shop-pier-right', leftM: round(width - SHOP.pierM - 0.001), bottomM: round(plinth), widthM: SHOP.pierM, heightM: round(top - plinth - 0.02), depthM: 0.1, surface: 'shop' as const}];
      elevation.blocks = seen([...(elevation.blocks?.value ?? []), ...blocks]);
      if (layout.shopGlass[0] - plinth - 0.01 > 0.03) elevation.bands.value.push({id: 'shop-riser', leftM: 0, bottomM: round(plinth), widthM: full, heightM: round(layout.shopGlass[0] - plinth - 0.01), depthM: 0.05, surface: 'shop'});
      if (front.shopfront.fascia) {
        elevation.bands.value.push({id: 'fascia', leftM: 0, bottomM: round(top - SHOP.fasciaM - SHOP.fasciaGapM), widthM: full, heightM: SHOP.fasciaM, depthM: 0.12, surface: 'shop'});
        if (!front.shopfront.sign) elevation.bands.value.push({id: 'fascia-lettering', leftM: round(width * 0.2), bottomM: round(top - SHOP.fasciaGapM - SHOP.fasciaM / 2 - 0.12), widthM: round(width * 0.6), heightM: 0.24, depthM: 0.135, surface: 'trim'});
      }
    }
    // Stone dressings (window surrounds, quoins) and the shop awning: attached slabs/canopies, see CanalhouseDressing.
    const dressings: CanalhouseDressing[] = [], full = Math.floor(width * 1000) / 1000;
    if (front.windowSurround && front.windowSurround !== 'none') {
      const wanted = front.surroundStoreys ?? Array.from({length: front.storeys}, (_, k) => k).filter(k => k > 0 || !front.shopfront);
      for (const o of elevation.openings.value) {
        const m = /(?:^|-)s(\d+)-b\d+(?:-m\d+)?$/.exec(o.id);
        if (!m || o.kind !== 'window' || !wanted.includes(Number(m[1]))) continue;
        const top = o.bottomM + o.heightM, ox = 0.07, oy = o.id;
        if (front.windowSurround === 'keystone') {
          const kw = clamp(o.widthM * 0.2, 0.15, 0.26);
          dressings.push({id: `key-${oy}`, kind: 'slab', leftM: round(o.leftM + o.widthM / 2 - kw / 2), bottomM: round(top - 0.02), widthM: round(kw), heightM: 0.22, depthM: 0.06, surface: 'stone'});
        } else {
          const lw = o.widthM + 2 * ox + 0.12;
          dressings.push({id: `lintel-${oy}`, kind: 'slab', leftM: round(o.leftM - ox - 0.06), bottomM: round(top - 0.04), widthM: round(lw), heightM: 0.14, depthM: 0.05, surface: 'stone'});
          dressings.push({id: `sill-${oy}`, kind: 'slab', leftM: round(o.leftM - ox - 0.05), bottomM: round(o.bottomM - 0.07), widthM: round(o.widthM + 2 * ox + 0.1), heightM: 0.08, depthM: 0.07, surface: 'stone'});
          if (front.windowSurround === 'full-frame') for (const [side, x] of [['l', o.leftM - ox - 0.06], ['r', o.leftM + o.widthM + ox - 0.02]] as const)
            dressings.push({id: `jamb-${side}-${oy}`, kind: 'slab', leftM: round(x), bottomM: round(o.bottomM - 0.01), widthM: 0.08, heightM: round(o.heightM + 0.02), depthM: 0.045, surface: 'stone'});
        }
      }
    }
    if (front.quoins === 'stone') {
      // Alternating long/short corner blocks from the plinth to the eaves; blocks that would cross an opening are skipped.
      const base = layout.groundBase > 0 ? layout.groundBase : 0.3, pitch = 0.62, topLimit = eaves - corniceH - 0.2;
      for (let row = 0, y = base + 0.1; y + 0.5 < topLimit; row++, y += pitch) for (const side of ['l', 'r'] as const) {
        const w = (row + (side === 'l' ? 0 : 1)) % 2 ? 0.28 : 0.5, x = side === 'l' ? 0.02 : full - w - 0.02;
        if (elevation.openings.value.some(o => x < o.leftM + o.widthM + 0.1 && x + w > o.leftM - 0.1 && y < o.bottomM + o.heightM + 0.1 && y + 0.5 > o.bottomM - 0.1)) continue;
        dressings.push({id: `quoin-${side}${row}`, kind: 'slab', leftM: round(x), bottomM: round(y), widthM: w, heightM: 0.5, depthM: 0.04, surface: 'stone'});
      }
    }
    const awning = front.shopfront?.awning;
    if (awning && awning.style !== 'none' && layout.shopGlass) {
      const from = (awning.extent?.from ?? 0) * width, to = (awning.extent?.to ?? 1) * width, left = Math.max(0.05, Math.min(from, to)), right = Math.min(width - 0.05, Math.max(from, to));
      const top = layout.shopGlass[1] + 0.05, drop = awning.style === 'fabric-dutch' ? 0.6 : 0.5, valance = awning.style === 'fabric-dutch' ? 0.22 : 0.2;
      // Never lower than 2.1 m at the valance: lift the attachment line instead.
      const attach = Math.max(top, 2.1 + drop + valance);
      dressings.push({id: 'awning', kind: 'awning', style: awning.style === 'fabric-dutch' ? 'dutch' : 'straight', leftM: round(left), widthM: round(right - left), topM: round(attach), dropM: drop, projectM: awning.style === 'fabric-dutch' ? 0.9 : 1.0, valanceM: valance, surface: 'awning'});
    }
    const sign = front.shopfront?.sign;
    if (sign && layout.shopGlass) {
      const top = layout.groundBase + layout.storeyHeights[layout.groundBase > 0 ? 1 : 0], mount = sign.mount ?? 'fascia';
      // Letter band: the fascia board (its face stands depth + 1.5 cm proud: 0.135 m), the wall band above the glass, or the head of the glass (in front of the shop frames).
      const [bandBottom, bandH, offset] = mount === 'fascia' ? [top - SHOP.fasciaGapM - SHOP.fasciaM, SHOP.fasciaM, 0.145]
        : mount === 'wall' ? [layout.shopGlass[1] + 0.06, top - layout.shopGlass[1] - 0.14, 0.02] : [layout.shopGlass[1] - 0.55, 0.45, 0.1];
      const span = (layout.shopSpans.length && mount === 'glazing') ? layout.shopSpans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a)) : [0.35, width - 0.35] as [number, number];
      // Mirrored elevations run right→left: flipping every rect mirrors the word back to reading order.
      dressings.push(...signDecals(sign.text, span[0], span[1], bandBottom, bandH, offset).map((d, i) => ({...d, leftM: round(flipX(d.leftM, d.widthM), 4), id: `sign-${i}`})));
    }
    if (dressings.length) elevation.dressings = seen(dressings);
    mainEaves = Math.min(mainEaves, eaves);
    elevation.bodyEavesM = surveyed(round(eaves));
    elevations.push(elevation);
    reports.push({id: front.id, widthM: round(width), eavesM: round(eaves), crownTopM: round(crownTop), storeyHeightsM: layout.storeyHeights, mirrored, edge: [edgeIndex, endIndex], frontageDeviationM: round(deviation), frontageOutsetM: round(maxOut, 4), polygonIndex});
  }
  house.eavesHeightM = surveyed(round(Math.max(mainEaves, survey.shellTopM)));
  house.gable = seen(GABLE_TYPE[intent.fronts[0].gable]);
  const recipe: CanalHouseRecipe = {
    schemaVersion: 1, id: intent.id, house, observations: [bagObservation, ...photoObservations],
    shellTopM: surveyed(survey.shellTopM), footprint: surveyed(polygons), palette: seen(paletteFor(intent)),
    roof: surveyed(survey.roof), elevations,
    simplifications: ['Facade metres fitted from intent counts and 3DBAG heights by fixed proportion rules; not rectified from photos.', ...warnings],
  };
  return {recipe, anchorRD: anchor, facts, report: {fronts: reports, warnings, roofAllowanceM: intent.fronts.some(f => f.dormers) ? 1.9 : 0, ...(cleanup.report.actions.length ? {roofCleanup: cleanup.report} : {})}};
}

export function paletteFor(intent: CanalHouseIntent, front?: FrontIntent) {
  const p = {...intent.palette, ...(front?.palette ?? {})}, roof = ROOF_COLOURS[intent.roof.material];
  const shopFront = (front ?? intent.fronts.find(f => f.shopfront))?.shopfront, shop = shopFront?.colour;
  const awningFront = (front ?? intent.fronts.find(f => f.shopfront?.awning && f.shopfront.awning.style !== 'none'))?.shopfront?.awning, awning = awningFront && awningFront.style !== 'none' ? awningFront.colour : undefined;
  return {wall: swatch(p.brick), roof: roof.steep, trim: swatch(p.frame), glass: GLASS, door: swatch(p.door), stone: swatch(p.stone ?? 'sandstone'), joinery: swatch(p.frame),
    ...(p.band ? {accent: swatch(p.band)} : {}), ...(shop ? {shop: swatch(shop)} : {}), ...(awning ? {awning: swatch(awning)} : {}), ...(shopFront?.sign ? {sign: swatch(shopFront.sign.colour)} : {})};
}

/**
 * Sign lettering as flat decals: 5x7 block capitals (blockLetters.ts), runs merged into rectangles, centred in
 * [left, right] x [bottom, bottom + height] with letters 60% of the band height, shrunk to fit the width.
 */
export function signDecals(text: string, left: number, right: number, bottom: number, height: number, offsetM: number) {
  const {rects, width: cells} = wordRects(text);
  if (!cells) return [];
  const cell = Math.min(height * 0.6 / 7, (right - left) * 0.92 / cells), w = cells * cell, x0 = (left + right) / 2 - w / 2, y0 = bottom + height / 2 + 3.5 * cell;
  return rects.map(r => ({kind: 'decal' as const, leftM: round(x0 + r.c0 * cell, 4), bottomM: round(y0 - (r.row1) * cell, 4), widthM: round((r.c1 - r.c0) * cell, 4), heightM: round((r.row1 - r.row0) * cell, 4), offsetM, surface: 'sign' as const}));
}
