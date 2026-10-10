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
import {canalhouseCrownProfile} from '../canalhouseRecipes.ts';
import {surveyRecipe} from '../../../scripts/canalhouse-recipes/survey-recipe.ts';
import {unobservedHouse, type GableType} from '../facade/houseRecord.ts';
import {measured, type Observation} from '../facade/evidence.ts';
import type {BuildingFacts, FrontFacts} from './facts.ts';
import {swatch, type CanalHouseIntent, type FrontIntent, type GableIntent, type ShopSign} from './intent.ts';
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

/**
 * A rectangle on the shop front in viewer metres (leftM, measured from the viewer's left) plus where it sits in the
 * elevation frame (frontLeftM); `depthM` is its face's distance in front of the wall plane.
 */
export interface FasciaRect { leftM: number; widthM: number; bottomM: number; heightM: number; depthM: number; frontLeftM: number; mirrored: boolean; sign?: ShopSign | null }
/** Where the sign's lettering goes (signage.ts): the fascia board, the wall band above the glass, or the head of the largest pane. */
export interface SignBand extends FasciaRect { mount: NonNullable<ShopSign['mount']>; sign: ShopSign }

export interface FitReport {
  fronts: {id: string; widthM: number; eavesM: number; crownTopM: number; storeyHeightsM: number[]; mirrored: boolean; edge: [number, number]; frontageDeviationM: number; frontageOutsetM: number; polygonIndex: number; fascia?: FasciaRect; signBand?: SignBand}[];
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

interface Layout { openings: CanalhouseOpening[]; glazedBays: CanalhouseGlazedBay[]; balconies: {storey: number; bay: number}[]; storeyHeights: number[]; groundBase: number; doorLeft: number | null; doorWidth: number; shopSpans: [number, number][]; shopGlass: [number, number] | null; warnings: string[]; /** Shop zone and riser top in viewer-left-to-right metres. */ shopZone: [number, number] | null; riserTopM: number; entrance: {leftM: number; widthM: number} | null }

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
  const doorWidth = f.shopfront?.residentialDoor ? clamp(width * 0.17, 0.95, 1.3) : clamp(width * 0.2, 0.95, 1.4);
  let doorLeft: number | null = null;
  const warnings: string[] = [];
  const sf = f.shopfront, rd = sf?.residentialDoor;
  // Window axes: one grid per front so windows line up between storeys; equal piers unless the intent says `margin`.
  const grid = f.axisGrid ?? Math.max(...bays.slice(n > 1 ? 1 : 0));
  const equalPiers = f.piers !== 'margin';
  const gridOf = (g: number) => {
    if (equalPiers) { const w = clamp(0.58 * width / (g + 0.42), 0.6, 1.5), gap = (width - g * w) / (g + 1); return {winW: w, pitch: w + gap, first: gap + w / 2}; }
    const margin = clamp(width * 0.09, 0.3, 1.2), pitch = g ? (width - 2 * margin) / g : 0;
    return {winW: clamp(pitch * 0.58, 0.6, 1.5), pitch, first: margin + pitch / 2};
  };
  const sharedGrid = gridOf(grid);
  /** The axes storey `s` uses on the shared grid, or null when it has to space its windows on its own. */
  const axesFor = (s: number, count: number): number[] | null => {
    const named = f.storeyAxes?.[String(s)] ?? (s === n - 1 ? f.storeyAxes?.last : undefined);
    if (named) return named;
    if (count === grid) return Array.from({length: count}, (_, k) => k);
    if (count > 0 && count < grid && (grid - count) % 2 === 0) { const k0 = (grid - count) / 2; return Array.from({length: count}, (_, k) => k0 + k); }
    if (s > 0 && count > 0) warnings.push(`${f.id}: storey ${s} has ${count} windows on a ${grid}-axis front; add storeyAxes or windows drift off the axes`);
    return null;
  };
  const storeyPlan = (s: number, count: number) => { const axes = axesFor(s, count), g = axes ? sharedGrid : gridOf(count); return {g, centre: (b: number) => g.first + g.pitch * (axes ? axes[b] : b)}; };
  let y = basement;
  for (let s = 0; s < n; s++) {
    const h = heights[s], count = bays[s];
    const plan = storeyPlan(s, count), winW = plan.g.winW, pitch = plan.g.pitch;
    const winH = s === 0 ? h * 0.62 : h * (0.6 - 0.02 * s), sill = s === 0 ? h * 0.2 : h * 0.22;
    for (let b = 0; b < count; b++) {
      const centre = plan.centre(b);
      if (s === 0 && f.doorBay === b && !rd) {
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
        const balW = Math.min(winW * 1.15, winW + 0.3 * Math.max(0, pitch - winW));
        openings.push({id: `s${s}-b${b}`, kind: 'window', leftM: centre - balW / 2, bottomM: y + 0.04, widthM: balW, heightM: Math.min(h - 0.2, winH + sill - 0.04), trimWidthM: 0.07, ...bars, ...segmental, frameSurface: 'trim', barSurface: 'trim'});
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
  let shopGlass: [number, number] | null = null, shopZone: [number, number] | null = null, entrance: Layout['entrance'] = null, riserTopM = 0;
  if (sf) {
    const h = heights[0], pier = SHOP.pierM + 0.02;
    let left = pier, right = width - pier;
    if (rd) {
      // A separate street door to the dwellings at one end; the shop takes the rest.
      const edge = 0.12, resLeft = rd.side === 'right' ? width - doorWidth - edge : edge;
      doorLeft = resLeft;
      const doorH = Math.min(h * 0.78, 2.7), ground = basement;
      openings.push({id: 'door', kind: 'door', leftM: resLeft, bottomM: ground, widthM: doorWidth, heightM: doorH, trimWidthM: 0.08, verticalBars: [.5], paneSurface: 'door', frameSurface: 'trim', barSurface: 'trim'});
      const transomH = Math.min(0.5, h - doorH - 0.25);
      if (transomH > 0.2) openings.push({id: 'door-transom', kind: 'window', leftM: resLeft, bottomM: ground + doorH + 0.06, widthM: doorWidth, heightM: transomH, trimWidthM: 0.06, frameSurface: 'trim', barSurface: 'trim'});
      if (rd.side === 'right') right = resLeft - 0.18; else left = resLeft + doorWidth + 0.18;
      if (sf.shopShare !== undefined) { const span = (width - 2 * pier) * sf.shopShare; if (rd.side === 'right') right = Math.min(right, left + span); else left = Math.max(left, right - span); }
    }
    shopZone = [left, right];
    const zw = right - left, entr = sf.entrance ?? (rd ? 'none' : 'none');
    let door: [number, number] | null = null;
    if (!rd && doorLeft !== null) door = [doorLeft - 0.1, doorLeft + doorWidth + 0.1]; // legacy: the doorBay door stands in the shopfront
    else if (entr !== 'none') {
      const ew = clamp(zw * 0.26, 0.95, 1.5), pos = entr.startsWith('centre') ? left + (zw - ew) / 2 : entr.startsWith('left') ? left + 0.15 : right - ew - 0.15;
      const recessed = entr.endsWith('recessed');
      const doorH = Math.min(h * 0.74, 2.5);
      entrance = {leftM: pos, widthM: ew};
      openings.push({id: 'shop-door', kind: 'door', leftM: pos, bottomM: basement + 0.02, widthM: ew, heightM: doorH, trimWidthM: 0.07, verticalBars: [], paneSurface: 'glass', frameSurface: 'shop', barSurface: 'shop', ...(recessed ? {recessM: 0.5, frameDepthM: 0.1} : {})} as CanalhouseOpening);
      door = [pos - 0.08, pos + ew + 0.08];
    }
    const riserH = {none: 0.12, low: 0.3, medium: SHOP.glassBottomM, high: 0.9}[sf.stallriser ?? 'medium'];
    riserTopM = riserH;
    // A sign on the wall above the glass (no fascia board) needs a band of wall: lower the glass head.
    const bottom = basement + riserH, top = basement + h - (sf.fascia ? SHOP.fasciaM + SHOP.fasciaGapM + 0.04 : sf.sign?.mount === 'wall' ? 0.75 : 0.3);
    shopGlass = [bottom, top];
    if (!door) shopSpans.push([left, right]);
    else { if (door[0] - left > 0.6) shopSpans.push([left, door[0]]); if (right - door[1] > 0.6) shopSpans.push([door[1], right]); }
    const glazing = sf.glazing ?? 'split';
    // `displayWindows` fixes the pane count across the shop glass (shared between spans by width); else split by width.
    const totalGlass = shopSpans.reduce((t, [a, b]) => t + b - a, 0);
    shopSpans.forEach(([a, b], i) => {
      const w = b - a, panes = sf.displayWindows ? Math.max(1, Math.round(sf.displayWindows * w / totalGlass)) : glazing === 'split' ? Math.round(w / 1.6) : 1;
      const mullions = Math.max(0, panes - 1), glassH = top - bottom;
      openings.push({id: `shop-${i}`, kind: 'window', leftM: a, bottomM: bottom, widthM: w, heightM: glassH, trimWidthM: 0.08,
        verticalBars: Array.from({length: mullions}, (_, k) => round((k + 1) / (mullions + 1), 4)), horizontalBars: glazing === 'single' ? [] : glazing === 'transom' ? [0.8] : glassH > 1.9 ? [0.8] : [], frameSurface: 'shop', barSurface: 'shop'} as CanalhouseOpening);
    });
  }
  // Basement lights below the ground-storey windows, away from the stoop.
  if (f.basement === 'windows' || f.basement === 'stoop-and-windows') {
    const count = bays[0], bp = storeyPlan(0, count), pitch = bp.g.pitch;
    for (let b = 0; b < count; b++) {
      const centre = bp.centre(b), w = clamp(pitch * 0.5, 0.5, 1.2);
      if (doorLeft !== null && centre + w / 2 > doorLeft - 0.9 && centre - w / 2 < doorLeft + doorWidth + 0.9) continue;
      openings.push({id: `basement-b${b}`, kind: 'window', leftM: centre - w / 2, bottomM: 0.12, widthM: w, heightM: Math.max(0.35, basement - 0.3), trimWidthM: 0.05, verticalBars: [.5], frameSurface: 'trim', barSurface: 'trim'});
    }
  }
  return {openings, glazedBays, balconies, storeyHeights: [basement, ...heights].filter(h => h > 0).map(h => round(h)), groundBase: basement, doorLeft, doorWidth, shopSpans, shopGlass, warnings, shopZone, riserTopM, entrance};
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
        const spanK = {narrow: [0.3, 0.3], medium: [0.62, 0.56], wide: [0.94, 0.86]}[f.crownCapSpan ?? 'narrow'];
        const capRise = f.crownCapRise === 'low' ? 0.38 : f.crownCapSpan === 'wide' ? 0.8 : 0.7;
        return canalhouseCrownProfile('lijst', width, eaves, top, width * spanK[0], eaves, 0, {cap: f.crownCap, capRiseM: Math.min(capRise, rise), crestWidthM: width * spanK[1]});
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
    const crownTop = gabled ? Math.max(profileTop + 0.3, Math.min(facts.heights.ridgeM + 0.3, eaves + mw * (front.gable === 'step' ? 1 : 0.9))) : eaves + (front.crownCap && front.crownCap !== 'flat' ? (front.crownCapRise === 'low' ? 0.55 : 1.1) : 0);
    const corniceH = {none: 0, simple: 0.35, bracketed: 0.55, heavy: 0.8}[front.cornice];
    const layout = layoutFront(front, mw, eaves - (gabled ? 0.2 : corniceH + 0.15));
    const moduleOpenings = Array.from({length: count}, (_, k) => layout.openings.map(o => ({...o, id: count > 1 ? `${o.id}-m${k}` : o.id, leftM: place(k, o.leftM, o.widthM)}))).flat();
    let lintelBands: NonNullable<CanalhouseElevation['bands']>['value'] = [];
    let fasciaRect: FasciaRect | undefined, signBand: SignBand | undefined;
    warnings.push(...layout.warnings);
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
    if (front.shopfront && layout.shopGlass && layout.shopZone) {
      const top = layout.groundBase + layout.storeyHeights[layout.groundBase > 0 ? 1 : 0], full = Math.floor(width * 1000) / 1000;
      // The shop band spans the whole front, or only the shop zone when a residential door stands beside it.
      const zone: [number, number] = front.shopfront.residentialDoor ? [Math.max(0, layout.shopZone[0] - SHOP.pierM - 0.02), Math.min(mw, layout.shopZone[1] + SHOP.pierM + 0.02)] : [0, mw];
      const zw = Math.floor((zone[1] - zone[0]) * 1000 - 1) / 1000, at = (x: number, w: number) => round(flipX(place(0, x, w), w));
      const sign = front.shopfront.sign;
      // Piers and stall riser in the shopfront paint.
      const pierH = round(top - plinth - 0.02);
      const blocks = [{id: 'shop-pier-left', leftM: at(zone[0], SHOP.pierM), bottomM: round(plinth), widthM: SHOP.pierM, heightM: pierH, depthM: 0.1, surface: 'shop' as const},
        {id: 'shop-pier-right', leftM: at(zone[1] - SHOP.pierM - 0.001, SHOP.pierM), bottomM: round(plinth), widthM: SHOP.pierM, heightM: pierH, depthM: 0.1, surface: 'shop' as const}];
      elevation.blocks = seen([...(elevation.blocks?.value ?? []), ...blocks]);
      elevation.bands.value.push({id: 'shop-riser', leftM: at(zone[0], zw), bottomM: round(plinth), widthM: zw, heightM: round(Math.max(0.05, layout.shopGlass[0] - plinth - 0.01)), depthM: 0.05, surface: 'shop'});
      if (front.shopfront.fascia) {
        elevation.bands.value.push({id: 'fascia', leftM: at(zone[0], zw), bottomM: round(top - SHOP.fasciaM - SHOP.fasciaGapM), widthM: zw, heightM: SHOP.fasciaM, depthM: 0.12, surface: 'shop'});
        fasciaRect = {leftM: zone[0], widthM: zw, bottomM: round(top - SHOP.fasciaM - SHOP.fasciaGapM), heightM: SHOP.fasciaM, depthM: 0.12, frontLeftM: at(zone[0], zw), mirrored, sign};
      }
      // The sign is real lettering (signage.ts) only when the intent carries one; otherwise nothing is drawn (no invented text).
      if (sign) {
        const mount = sign.mount ?? 'fascia', glassTop = layout.shopGlass[1];
        if (mount === 'fascia' && fasciaRect) signBand = {...fasciaRect, mount, sign};
        else if (mount === 'wall') {
          const l = zone[0] + SHOP.pierM + 0.05, w = round(zone[1] - zone[0] - 2 * SHOP.pierM - 0.1);
          signBand = {mount, sign, leftM: round(l), widthM: w, bottomM: round(glassTop + 0.06), heightM: round(top - glassTop - 0.14), depthM: 0.03, frontLeftM: at(l, w), mirrored};
        } else if (mount === 'glazing' && layout.shopSpans.length) {
          // On the glass: lettering across the head of the widest pane, standing just proud of the shop frames.
          const [a, b] = layout.shopSpans.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p)), w = round(b - a - 0.16);
          signBand = {mount, sign, leftM: round(a + 0.08), widthM: w, bottomM: round(glassTop - 0.55), heightM: 0.45, depthM: 0.07, frontLeftM: at(a + 0.08, w), mirrored};
        }
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
    if (dressings.length) elevation.dressings = seen(dressings);
    mainEaves = Math.min(mainEaves, eaves);
    elevation.bodyEavesM = surveyed(round(eaves));
    elevations.push(elevation);
    reports.push({id: front.id, widthM: round(width), eavesM: round(eaves), crownTopM: round(crownTop), storeyHeightsM: layout.storeyHeights, mirrored, edge: [edgeIndex, endIndex], frontageDeviationM: round(deviation), frontageOutsetM: round(maxOut, 4), polygonIndex, ...(fasciaRect ? {fascia: fasciaRect} : {}), ...(signBand ? {signBand} : {})});
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
    ...(p.band ? {accent: swatch(p.band)} : {}), ...(shop ? {shop: swatch(shop)} : {}), ...(awning ? {awning: swatch(awning)} : {})};
}
