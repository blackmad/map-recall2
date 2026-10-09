/**
 * Deterministic FIT: intent (components/counts) + facts (BAG/3DBAG metres)
 * → the canalhouse library's measured `CanalHouseRecipe`.
 *
 * Footprint and roof come verbatim from 3DBAG LoD2.2 via `surveyRecipe`
 * (no generated roof volumes). Facade metres are derived from the frontage
 * width and the 3DBAG front eaves/top profile with fixed proportion rules,
 * so the same intent always fits the same geometry.
 */
import type {CanalHouseRecipe, CanalhouseElevation, CanalhouseOpening, CanalhousePoint} from '../canalhouseRecipes.ts';
import {canalhouseCrownProfile} from '../canalhouseRecipes.ts';
import {surveyRecipe} from '../../../scripts/canalhouse-recipes/survey-recipe.ts';
import {unobservedHouse, type GableType} from '../facade/houseRecord.ts';
import {measured, type Observation} from '../facade/evidence.ts';
import type {BuildingFacts, FrontFacts} from './facts.ts';
import {swatch, type CanalHouseIntent, type FrontIntent, type GableIntent} from './intent.ts';

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
  fronts: {id: string; widthM: number; eavesM: number; crownTopM: number; storeyHeightsM: number[]; mirrored: boolean; edge: [number, number]; frontageDeviationM: number}[];
  warnings: string[];
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

interface Layout { openings: CanalhouseOpening[]; storeyHeights: number[]; groundBase: number; doorLeft: number | null; doorWidth: number }

/** Regular bay grid fitted to width/height. `heightTop` is where full storeys end. */
function layoutFront(f: FrontIntent, width: number, heightTop: number): Layout {
  const basement = f.basement !== 'none' ? clamp(heightTop * 0.07, 0.7, 1.2) : 0;
  const n = f.storeys, groundFactor = f.tallGround || f.shopfront ? 1.32 : 1.1;
  // Upper storeys diminish by 4% each; solve for the first upper storey height.
  const factors = [groundFactor, ...Array.from({length: n - 1}, (_, k) => 0.96 ** k)];
  const unit = (heightTop - basement) / factors.reduce((s, x) => s + x, 0);
  const heights = factors.map(x => x * unit);
  const bays = Array.isArray(f.bays) ? f.bays : Array(n).fill(f.bays);
  const bars = WINDOW_BARS[f.windows], head = f.windows === 'arched' ? {head: 'segmental' as const, headRiseM: 0.18} : {};
  const openings: CanalhouseOpening[] = [];
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
      openings.push({id: `s${s}-b${b}`, kind: 'window', leftM: centre - winW / 2, bottomM: y + sill, widthM: winW, heightM: winH, trimWidthM: 0.07, ...bars, ...(s > 0 ? head : {}), frameSurface: 'trim', barSurface: 'trim'});
    }
    y += h;
  }
  // Shopfront: glazing across the ground storey, around the door.
  if (f.shopfront) {
    const h = heights[0], left = 0.25, right = width - 0.25, spans: [number, number][] = [];
    if (doorLeft === null) spans.push([left, right]);
    else { if (doorLeft - 0.1 - left > 0.6) spans.push([left, doorLeft - 0.1]); if (right - (doorLeft + doorWidth + 0.1) > 0.6) spans.push([doorLeft + doorWidth + 0.1, right]); }
    spans.forEach(([a, b], i) => openings.push({id: `shop-${i}`, kind: 'window', leftM: a, bottomM: basement + 0.35, widthM: b - a, heightM: h * 0.72, trimWidthM: 0.09, verticalBars: (b - a) > 2.4 ? [.5] : [], frameSurface: 'door', barSurface: 'door'}));
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
  return {openings, storeyHeights: [basement, ...heights].filter(h => h > 0).map(h => round(h)), groundBase: basement, doorLeft, doorWidth};
}

function crownProfile(f: FrontIntent, width: number, eaves: number, top: number): CanalhousePoint[] | null {
  const rise = top - eaves;
  if (f.gable === 'flat' || rise < 0.3) return null;
  switch (f.gable) {
    case 'point': return canalhouseCrownProfile('punt', width, eaves, top, 0, eaves, 0);
    case 'spout': return canalhouseCrownProfile('tuit', width, eaves, top, width * 0.34, top - Math.min(0.7, rise * 0.15), 0);
    case 'step': return canalhouseCrownProfile('trap', width, eaves, top, width * 0.3, eaves, clamp(Math.round(rise / 1.4), 2, 5));
    case 'neck': case 'raised-neck': return canalhouseCrownProfile('hals', width, eaves, top, width * 0.42, eaves + rise * (f.gable === 'neck' ? 0.38 : 0.2), 0, {cap: f.crownCap ?? 'pediment', capRiseM: Math.min(0.6, rise * 0.15), crestWidthM: width * 0.42, shoulderCurve: 0.6});
    case 'bell': return canalhouseCrownProfile('klok', width, eaves, top, width * 0.46, eaves + rise * 0.55, 0, {cap: f.crownCap ?? 'rounded', capRiseM: Math.min(0.6, rise * 0.15), crestWidthM: width * 0.46});
    case 'cornice': {
      if (f.crownCap && f.crownCap !== 'flat') return canalhouseCrownProfile('lijst', width, eaves, top, width * 0.3, eaves, 0, {cap: f.crownCap, capRiseM: Math.min(0.7, rise), crestWidthM: width * 0.3});
      return null;
    }
  }
  return null;
}

export function fitIntent(intent: CanalHouseIntent, facts: BuildingFacts): {recipe: CanalHouseRecipe; anchorRD: [number, number]; report: FitReport} {
  if (intent.pandId !== facts.pandId) throw Error('Intent and facts describe different Pand');
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
    let deviation = 0;
    for (let i = (edgeIndex + 1) % n; i !== endIndex; i = (i + 1) % n) deviation = Math.max(deviation, Math.abs((ring[i][0] - a[0]) * (b[1] - a[1]) - (ring[i][1] - a[1]) * (b[0] - a[0])) / width);
    // Heights from the 3DBAG roof profile inside this piece of frontage.
    const along = ff.topProfile.filter(p => { const pt = [ff.endpointsRD[0][0] + (ff.endpointsRD[1][0] - ff.endpointsRD[0][0]) * p.alongM / ff.widthM, ff.endpointsRD[0][1] + (ff.endpointsRD[1][1] - ff.endpointsRD[0][1]) * p.alongM / ff.widthM];
      const t = ((pt[0] - endpoints[0][0]) * (endpoints[1][0] - endpoints[0][0]) + (pt[1] - endpoints[0][1]) * (endpoints[1][1] - endpoints[0][1])) / ((endpoints[1][0] - endpoints[0][0]) ** 2 + (endpoints[1][1] - endpoints[0][1]) ** 2);
      return t >= 0 && t <= 1; }).map(p => p.heightM).sort((x, y) => x - y);
    if (along.length < 3) throw Error(`${front.id}: no 3DBAG roof profile along this front`);
    const eaves = along[Math.floor(along.length * 0.1)], profileTop = along.at(-1)!;
    // Gabled crowns rise above the roof meeting line; their top is the higher
    // of the profile peak and a proportion of the width, capped by the ridge.
    const gabled = !['cornice', 'flat'].includes(front.gable);
    const crownTop = gabled ? Math.max(profileTop + 0.3, Math.min(facts.heights.ridgeM + 0.3, eaves + width * (front.gable === 'step' ? 1 : 0.9))) : eaves + (front.crownCap && front.crownCap !== 'flat' ? 1.1 : 0);
    const corniceH = {none: 0, simple: 0.35, bracketed: 0.55, heavy: 0.8}[front.cornice];
    const layout = layoutFront(front, width, eaves - (gabled ? 0.2 : corniceH + 0.15));
    const flip = (o: CanalhouseOpening): CanalhouseOpening => mirrored ? {...o, leftM: width - o.leftM - o.widthM} : o;
    const elevation: CanalhouseElevation = {
      id: front.id, polygonIndex, edgeIndex, ...(endIndex !== (edgeIndex + 1) % n ? {endEdgeIndex: endIndex, frontageToleranceM: surveyed(round(Math.min(.3, deviation + .01)))} : {}),
      ...(deviation > .3 ? {frontagePlan: surveyed({maxInsetM: round(Math.min(1, deviation + .02)), maxOutsetM: .3})} : {}),
      openings: seen(layout.openings.map(flip)),
      ...(front.palette ? {palette: seen(paletteFor(intent, front))} : {}),
    };
    if (corniceH > 0) elevation.cornice = seen({bottomM: round(eaves - corniceH), heightM: corniceH, depthM: round(corniceH * 0.5), brackets: front.cornice === 'bracketed' ? Math.max(2, Math.round(width / 1.6)) : 0});
    const profile = crownProfile(front, width, eaves, crownTop);
    if (profile) {
      elevation.crown = seen({profile: profile.map(([x, y]) => [round(mirrored ? width - x : x, 4), round(y, 4)] as CanalhousePoint).sort((p, q) => p[0] - q[0]), depthM: 0.18, trimWidthM: 0.08, surface: 'wall'});
      // Attic windows inside the crown.
      const attic = front.atticWindows ?? 0, rise = crownTop - eaves;
      if (attic > 0 && rise > 1.2) {
        const w = clamp(width * 0.14, 0.5, 0.9), h = clamp(rise * 0.4, 0.6, 1.4), gap = w * 0.5, total = attic * w + (attic - 1) * gap;
        for (let k = 0; k < attic; k++) elevation.openings.value.push({id: `attic-${k}`, kind: 'window', leftM: (width - total) / 2 + k * (w + gap), bottomM: eaves + 0.25, widthM: w, heightM: h, trimWidthM: 0.06, ...WINDOW_BARS[front.windows === 'shop' ? 'sash' : front.windows], frameSurface: 'trim', barSurface: 'trim'});
      }
    }
    if (front.hoist) elevation.hoists = seen([{id: 'hoist', centerM: width / 2, heightM: round(gabled ? crownTop - 0.9 : eaves + 0.1), widthM: 0.14, beamHeightM: 0.18, projectionM: 1.1, setbackM: 0.1, surface: 'door'}]);
    if ((front.basement === 'stoop' || front.basement === 'stoop-and-windows') && layout.doorLeft !== null && layout.groundBase > 0) {
      const dl = mirrored ? width - layout.doorLeft - layout.doorWidth : layout.doorLeft;
      elevation.entrance = seen({leftM: round(dl - 0.15), widthM: round(layout.doorWidth + 0.3), riseM: round(layout.groundBase), runM: round(Math.min(1.4, layout.groundBase * 1.4)), approximateRiserM: 0.18, surface: 'stone'});
    }
    // Stone plinth band under ground storey, or across a shopfront.
    const plinth = layout.groundBase > 0 ? layout.groundBase : 0.3;
    elevation.bands = seen([{id: 'plinth', leftM: 0, bottomM: 0, widthM: Math.floor(width * 1000) / 1000, heightM: round(plinth), depthM: 0.06, surface: 'stone'}]);
    if (front.shopfront?.fascia) {
      const top = layout.groundBase + layout.storeyHeights[layout.groundBase > 0 ? 1 : 0];
      elevation.bands.value.push({id: 'fascia', leftM: 0, bottomM: round(top - 0.45), widthM: Math.floor(width * 1000) / 1000, heightM: 0.4, depthM: 0.08, surface: 'trim'});
    }
    mainEaves = Math.min(mainEaves, eaves);
    elevation.bodyEavesM = surveyed(round(eaves));
    elevations.push(elevation);
    reports.push({id: front.id, widthM: round(width), eavesM: round(eaves), crownTopM: round(crownTop), storeyHeightsM: layout.storeyHeights, mirrored, edge: [edgeIndex, endIndex], frontageDeviationM: round(deviation)});
  }
  house.eavesHeightM = surveyed(round(Math.max(mainEaves, survey.shellTopM)));
  house.gable = seen(GABLE_TYPE[intent.fronts[0].gable]);
  const recipe: CanalHouseRecipe = {
    schemaVersion: 1, id: intent.id, house, observations: [bagObservation, ...photoObservations],
    shellTopM: surveyed(survey.shellTopM), footprint: surveyed(polygons), palette: seen(paletteFor(intent)),
    roof: surveyed(survey.roof), elevations,
    simplifications: ['Facade metres fitted from intent counts and 3DBAG heights by fixed proportion rules; not rectified from photos.', ...warnings],
  };
  return {recipe, anchorRD: anchor, report: {fronts: reports, warnings}};
}

export function paletteFor(intent: CanalHouseIntent, front?: FrontIntent) {
  const p = {...intent.palette, ...(front?.palette ?? {})}, roof = ROOF_COLOURS[intent.roof.material];
  return {wall: swatch(p.brick), roof: roof.steep, trim: swatch(p.frame), glass: GLASS, door: swatch(p.door), stone: swatch(p.stone ?? 'sandstone'), joinery: swatch(p.frame)};
}
