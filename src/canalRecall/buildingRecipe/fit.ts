/**
 * Deterministic FIT: intent (components/counts) + facts (BAG/3DBAG metres)
 * → the canalhouse library's measured `CanalHouseRecipe`.
 *
 * Footprint and roof come verbatim from 3DBAG LoD2.2 via `surveyRecipe`
 * (no generated roof volumes). Facade metres are derived from the frontage
 * width and the 3DBAG front eaves/top profile with fixed proportion rules,
 * so the same intent always fits the same geometry.
 */
import type {CanalHouseRecipe, CanalhouseDressing, CanalhouseElevation, CanalhouseFacadeBlock, CanalhouseOpening, CanalhousePoint} from '../canalhouseRecipes.ts';
import type {CanalhouseGlazedBay} from '../canalhouseGlazedBay.ts';
import {canalhouseCrownProfile} from '../canalhouseRecipes.ts';
import {surveyRecipe} from '../../../scripts/canalhouse-recipes/survey-recipe.ts';
import {unobservedHouse, type GableType} from '../facade/houseRecord.ts';
import {measured, type Observation} from '../facade/evidence.ts';
import type {BuildingFacts, FrontFacts} from './facts.ts';
import {swatch, type CanalHouseIntent, type FrontIntent, type GableIntent, type ShopSign} from './intent.ts';
import {cleanRoof, type RoofCleanupReport} from './roofCleanup.ts';
import {gableOrnaments} from './gableOrnament.ts';
import type {CanalhouseOrnament} from '../canalhouseRecipes.ts';

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
  'two-light': {verticalBars: [.5], horizontalBars: [.8]},
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
  fronts: {id: string; widthM: number; eavesM: number; crownTopM: number; storeyHeightsM: number[]; mirrored: boolean; edge: [number, number]; frontageDeviationM: number; frontageOutsetM: number; polygonIndex: number; fascia?: FasciaRect; signBand?: SignBand;
    /** Mansard roof face over the cornice (elevation metres). */ mansard?: {bottomM: number; heightM: number; setbackM: number};
    /** Towers rising over the eaves (elevation metres, the facade frame's x). */ towers?: {leftM: number; widthM: number; bottomM: number; topM: number; cap: 'pyramid' | 'flat'}[];
    /** Eaves from a photo measurement (block-face strip) instead of the 3DBAG profile. */ measuredEaves?: boolean}[];
  warnings: string[];
  /** Height the model may exceed the LoD2.2 roof max by: 3DBAG LoD2.2 has no dormers, so declared dormers stand above it. */
  roofAllowanceM?: number;
  /** 3DBAG roof artefacts removed before the survey conversion (roofCleanup.ts). */
  roofCleanup?: RoofCleanupReport;
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Split the frontage chain into consecutive sub-chains by shares, snapping to ring vertices within `snapM` (0.25 m: a
 * survey vertex that close is the party line; Bilderdijkstraat 135|137 lies 1.2 m from a dormer-ring vertex, which a 1.5 m
 * snap took for the cut). Where no footprint vertex is that close (several houses inside one BAG pand front), a vertex is
 * inserted on the chain at the split: `inserted` lists them (point and the chain edge it lies on) so the caller adds them
 * to the survey rings.
 */
export function splitChain(front: FrontFacts, shares: number[], snapM = 0.25): {pairs: [number[], number[]][]; inserted: {point: number[]; a: number[]; b: number[]}[]} {
  const chain = front.chainRD.map(p => [...p]), inserted: {point: number[]; a: number[]; b: number[]}[] = [];
  const lengths = () => { const c = [0]; for (let i = 1; i < chain.length; i++) c.push(c[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1])); return c; };
  let cumulative = lengths();
  const total = cumulative.at(-1)!, cutPoints: number[][] = [chain[0]];
  let acc = 0;
  for (const share of shares.slice(0, -1)) {
    acc += share * total;
    let best = -1;
    for (let i = 1; i < chain.length - 1; i++) if (best < 0 || Math.abs(cumulative[i] - acc) < Math.abs(cumulative[best] - acc)) best = i;
    if (best >= 0 && Math.abs(cumulative[best] - acc) <= snapM) { cutPoints.push(chain[best]); continue; }
    const i = cumulative.findIndex((c, k) => k + 1 < cumulative.length && c <= acc && cumulative[k + 1] >= acc);
    const t = (acc - cumulative[i]) / (cumulative[i + 1] - cumulative[i]), a = chain[i], b = chain[i + 1];
    const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    inserted.push({point, a: [...a], b: [...b]});
    chain.splice(i + 1, 0, point);
    cumulative = lengths();
    cutPoints.push(point);
  }
  cutPoints.push(chain.at(-1)!);
  return {pairs: cutPoints.slice(1).map((c, i) => [cutPoints[i], c] as [number[], number[]]), inserted};
}

/**
 * Insert `point` (on the frontage edge a-b) into every ring edge it lies inside: survey footprint rings, the front
 * chains, and roof rings (with the height interpolated along the roof edge), so the roof closures along the front still
 * find one footprint edge under each roof edge.
 */
export function insertFootprintVertex(facts: BuildingFacts, a: number[], b: number[], point: number[]) {
  const into = (ring: number[][], closed: boolean) => {
    for (let i = 0; i < ring.length - (closed ? 0 : 1); i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const t = ((point[0] - p[0]) * dx + (point[1] - p[1]) * dy) / (len * len), off = Math.abs((point[0] - p[0]) * dy - (point[1] - p[1]) * dx) / len;
      if (off > 1e-3 || t * len < 1e-3 || (1 - t) * len < 1e-3) continue;
      ring.splice(i + 1, 0, p.length > 2 ? [point[0], point[1], p[2] + (q[2] - p[2]) * t] : [point[0], point[1]]);
      return true;
    }
    return false;
  };
  let hit = 0;
  for (const poly of facts.surveyFootprintPolygonsRD) for (const ring of poly) if (into(ring, true)) hit++;
  for (const fr of facts.fronts) into(fr.chainRD, false);
  for (const r of facts.roofsRD) { if (r.ringsRD) for (const ring of r.ringsRD) into(ring, true); else into(r.vertices, true); }
  if (!hit) throw Error(`Front split: the chain edge ${a.map(v => v.toFixed(2))}-${b.map(v => v.toFixed(2))} is not on a survey footprint ring`);
}

interface Layout { openings: CanalhouseOpening[]; glazedBays: CanalhouseGlazedBay[]; balconies: {storey: number; bay: number}[]; storeyHeights: number[]; groundBase: number; doorLeft: number | null; doorWidth: number; shopSpans: [number, number][]; shopGlass: [number, number] | null; warnings: string[]; /** Shop zone and riser top in viewer-left-to-right metres. */ shopZone: [number, number] | null; riserTopM: number; entrance: {leftM: number; widthM: number} | null; /** Bay boundaries of the shared grid, viewer-left to right. */ bayEdges: number[]; axisCentres: number[]; shopStoreys: 1 | 2; /** `groundFront` piers, beam and panels (viewer-left metres). */ groundBlocks?: CanalhouseFacadeBlock[] }

/** Shopfront proportions: pier width, stall riser top, fascia depth below the ground-storey top. */
const SHOP = {pierM: 0.3, glassBottomM: 0.55, fasciaM: 0.62, fasciaGapM: 0.08};

/** Regular bay grid fitted to width/height. `heightTop` is where full storeys end. */
function layoutFront(f: FrontIntent, width: number, heightTop: number): Layout {
  const basement = f.basement !== 'none' ? clamp(heightTop * 0.07, 0.7, 1.2) : 0;
  const n = f.storeys, groundFactor = f.tallGround || (f.shopfront && !f.shopfront.bays) ? 1.32 : 1.1;
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
    if (equalPiers) { const w = clamp(0.58 * width / (g + 0.42), 0.6, f.windowProportion === 'tall' ? 1.9 : 1.5), gap = (width - g * w) / (g + 1); return {winW: w, pitch: w + gap, first: gap + w / 2}; }
    const margin = clamp(width * 0.09, 0.3, 1.2), pitch = g ? (width - 2 * margin) / g : 0;
    return {winW: clamp(pitch * 0.58, 0.6, 1.5), pitch, first: margin + pitch / 2};
  };
  const sharedGrid = gridOf(grid);
  /** Unequal bays: every cell holds one window, centred, 58 % of the cell (the equal-pier ratio), never wider than the cell allows. */
  const weighted = (weights: number[]) => {
    const total = weights.reduce((t, x) => t + x, 0), edges = [0];
    for (const w of weights) edges.push(edges.at(-1)! + width * w / total);
    const cell = (a: number) => edges[a + 1] - edges[a];
    return {edges, cell, centre: (a: number) => (edges[a] + edges[a + 1]) / 2, w: (a: number) => Math.min(clamp(0.58 * cell(a), 0.5, 2.8), 0.82 * cell(a))};
  };
  const sharedWeighted = f.bayWidths ? weighted(f.bayWidths) : null;
  const ownWeights = (s: number) => f.storeyBayWidths?.[String(s)] ?? (s === n - 1 ? f.storeyBayWidths?.last : undefined);
  /** The axes storey `s` uses on the shared grid, or null when it has to space its windows on its own. */
  const axesFor = (s: number, count: number): number[] | null => {
    const named = f.storeyAxes?.[String(s)] ?? (s === n - 1 ? f.storeyAxes?.last : undefined);
    if (named) return named;
    if (count === grid) return Array.from({length: count}, (_, k) => k);
    if (count > 0 && count < grid && (grid - count) % 2 === 0) { const k0 = (grid - count) / 2; return Array.from({length: count}, (_, k) => k0 + k); }
    if (s > 0 && count > 0) warnings.push(`${f.id}: storey ${s} has ${count} windows on a ${grid}-axis front; add storeyAxes or windows drift off the axes`);
    return null;
  };
  /** Window `b` of a storey: centre, window width and the width of the cell around it. */
  const storeyPlan = (s: number, count: number) => {
    const own = ownWeights(s);
    if (own) { const wg = weighted(own); return {centre: wg.centre, w: wg.w, pitch: wg.cell}; }
    const axes = axesFor(s, count);
    if (axes && sharedWeighted) return {centre: (b: number) => sharedWeighted.centre(axes[b]), w: (b: number) => sharedWeighted.w(axes[b]), pitch: (b: number) => sharedWeighted.cell(axes[b])};
    const g = axes ? sharedGrid : gridOf(count);
    return {centre: (b: number) => g.first + g.pitch * (axes ? axes[b] : b), w: () => g.winW, pitch: () => g.pitch};
  };
  // Bay boundaries of the shared grid (left to right, `grid + 1` values): crown and shop spans follow them.
  const bayEdges = sharedWeighted ? sharedWeighted.edges : [0, ...Array.from({length: grid - 1}, (_, a) => { const g = sharedGrid; return g.first + g.pitch * a + g.pitch / 2; }), width];
  const axisCentres = Array.from({length: grid}, (_, a) => sharedWeighted ? sharedWeighted.centre(a) : sharedGrid.first + sharedGrid.pitch * a);
  // A shopfront limited to some bays: its zone runs between the boundaries of those bays.
  const shopBays = sf?.bays ?? null;
  const shopEdge: [number, number] | null = shopBays ? [bayEdges[shopBays[0]], bayEdges[shopBays[1] + 1]] : null;
  const twoStorey = !!sf && sf.storeys === 2;
  let y = basement;
  for (let s = 0; s < n; s++) {
    const h = heights[s], count = bays[s];
    const plan = storeyPlan(s, count);
    const tall = f.windowProportion === 'tall';
    const winH = tall ? h * (0.72 - 0.015 * s) : s === 0 ? h * 0.62 : h * (0.6 - 0.02 * s), sill = tall ? h * 0.16 : s === 0 ? h * 0.2 : h * 0.22;
    for (let b = 0; b < count; b++) {
      const centre = plan.centre(b), winW = plan.w(b), pitch = plan.pitch(b);
      if (s === 0 && f.groundFront) continue; // groundFrontLayout builds the ground storey
      if (s === 0 && f.doorBay === b && !rd) {
        doorLeft = clamp(centre - doorWidth / 2, 0.05, width - doorWidth - 0.05);
        const doorH = Math.min(h * 0.78, 2.7);
        openings.push({id: 'door', kind: 'door', leftM: doorLeft, bottomM: y, widthM: doorWidth, heightM: doorH, trimWidthM: 0.08, verticalBars: [.5], paneSurface: 'door', frameSurface: 'trim', barSurface: 'trim'});
        const transomH = Math.min(0.6, h - doorH - 0.25);
        if (transomH > 0.2) openings.push({id: 'door-transom', kind: 'window', leftM: doorLeft, bottomM: y + doorH + 0.06, widthM: doorWidth, heightM: transomH, trimWidthM: 0.06, frameSurface: 'trim', barSurface: 'trim'});
        continue;
      }
      if (s === 0 && f.shopfront && (!shopEdge || (centre > shopEdge[0] && centre < shopEdge[1]))) continue;
      if (s === 1 && twoStorey && (shopEdge ? centre > shopEdge[0] && centre < shopEdge[1] : !rd)) continue;
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
    const h = heights[0], pier = SHOP.pierM + 0.02, shopH = h + (twoStorey ? heights[1] : 0);
    let left = pier, right = width - pier;
    if (shopEdge) { left = shopEdge[0] + pier; right = shopEdge[1] - pier; }
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
    if (!rd && !shopEdge && doorLeft !== null) door = [doorLeft - 0.1, doorLeft + doorWidth + 0.1]; // legacy: the doorBay door stands in the shopfront
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
    const bottom = basement + riserH, top = basement + shopH - (sf.fascia ? SHOP.fasciaM + SHOP.fasciaGapM + 0.04 : sf.sign?.mount === 'wall' ? 0.75 : 0.3);
    shopGlass = [bottom, top];
    // Double-height shop: a transom bar at the mezzanine floor (storey 1 bottom) and one over the ground-floor door height.
    const mezzanineBars = (glassH: number) => [round((basement + h - bottom) / glassH, 4)].filter(v => v > 0.1 && v < 0.9);
    if (twoStorey && rd) {
      // Storey-1 windows standing in front of the shop zone belong to the shop glass.
      const inZone = (o: CanalhouseOpening) => o.leftM + o.widthM / 2 > left - pier && o.leftM + o.widthM / 2 < right + pier;
      for (let i = openings.length - 1; i >= 0; i--) if (/^s1-b\d+$/.test(openings[i].id) && inZone(openings[i])) openings.splice(i, 1);
    }
    if (!door) shopSpans.push([left, right]);
    else { if (door[0] - left > 0.6) shopSpans.push([left, door[0]]); if (right - door[1] > 0.6) shopSpans.push([door[1], right]); }
    const glazing = sf.glazing ?? 'split';
    // `displayWindows` fixes the pane count across the shop glass (shared between spans by width); else split by width.
    const totalGlass = shopSpans.reduce((t, [a, b]) => t + b - a, 0);
    shopSpans.forEach(([a, b], i) => {
      const w = b - a, panes = sf.displayWindows ? Math.max(1, Math.round(sf.displayWindows * w / totalGlass)) : glazing === 'split' ? Math.round(w / 1.6) : 1;
      const mullions = Math.max(0, panes - 1), glassH = top - bottom;
      openings.push({id: `shop-${i}`, kind: 'window', leftM: a, bottomM: bottom, widthM: w, heightM: glassH, trimWidthM: 0.08,
        verticalBars: Array.from({length: mullions}, (_, k) => round((k + 1) / (mullions + 1), 4)), horizontalBars: twoStorey ? mezzanineBars(glassH) : glazing === 'single' ? [] : glazing === 'transom' ? [0.8] : glassH > 1.9 ? [0.8] : [], frameSurface: 'shop', barSurface: 'shop'} as CanalhouseOpening);
    });
  }
  // Basement lights below the ground-storey windows, away from the stoop.
  if (f.basement === 'windows' || f.basement === 'stoop-and-windows') {
    const count = bays[0], bp = storeyPlan(0, count);
    for (let b = 0; b < count; b++) {
      const centre = bp.centre(b), w = clamp(bp.pitch(b) * 0.5, 0.5, 1.2);
      if (doorLeft !== null && centre + w / 2 > doorLeft - 0.9 && centre - w / 2 < doorLeft + doorWidth + 0.9) continue;
      openings.push({id: `basement-b${b}`, kind: 'window', leftM: centre - w / 2, bottomM: 0.12, widthM: w, heightM: Math.max(0.35, basement - 0.3), trimWidthM: 0.05, verticalBars: [.5], frameSurface: 'trim', barSurface: 'trim'});
    }
  }
  const groundBlocks = f.groundFront ? groundFrontLayout(f.groundFront, width, heights[0], openings) : undefined;
  return {openings, glazedBays, balconies, storeyHeights: [basement, ...heights].filter(h => h > 0).map(h => round(h)), groundBase: basement, doorLeft, doorWidth, shopSpans, shopGlass, warnings, shopZone, riserTopM, entrance, bayEdges, axisCentres, shopStoreys: twoStorey ? 2 : 1, ...(groundBlocks ? {groundBlocks} : {})};
}

/** Proportions of the historic ground fronts: pier/post width, beam height, panel (riser) top. */
const GROUND_FRONT = {arcade: {pierM: 0.34, beamM: 0.32, riserM: 0.5}, pui: {pierM: 0.2, beamM: 0.42, riserM: 0.62}, wall: {pierM: 0.45, beamM: 0, riserM: 0}} as const;

/**
 * Ground storey of separate openings (`groundFront`): equal bays between piers (arcade), timber posts (pui) or brick
 * piers (wall); each bay a door, glazed door, glazed window, roller shutter or closed panel. Pushes the openings and
 * returns the frame blocks (piers, beam, panels) in viewer-left metres; the ground storey runs from 0 to `h`.
 */
export function groundFrontLayout(g: NonNullable<FrontIntent['groundFront']>, width: number, h: number, openings: CanalhouseOpening[]): CanalhouseFacadeBlock[] {
  const k = GROUND_FRONT[g.kind], n = g.bays.length, framed = g.kind !== 'wall';
  const pier = Math.min(k.pierM, width * 0.06), ow = (width - (n + 1) * pier) / n;
  if (ow < 0.45) throw Error(`groundFront: ${n} bays do not fit a ${round(width, 2)} m front`);
  const top = framed ? h - k.beamM - 0.04 : h * 0.86, blocks: CanalhouseFacadeBlock[] = [];
  const joinery = framed ? 'shop' as const : 'trim' as const;
  if (framed) {
    for (let i = 0; i <= n; i++) blocks.push({id: `gf-pier-${i}`, leftM: Math.min(round(i * (ow + pier)), Math.floor((width - round(pier)) * 1000 - 1) / 1000), bottomM: 0.3, widthM: round(pier), heightM: round(h - k.beamM - 0.3), depthM: g.kind === 'arcade' ? 0.12 : 0.08, surface: 'shop'});
    blocks.push({id: 'gf-beam', leftM: 0, bottomM: round(h - k.beamM), widthM: Math.floor(width * 1000) / 1000, heightM: round(k.beamM - 0.02), depthM: g.kind === 'arcade' ? 0.14 : 0.1, surface: 'shop'});
  }
  g.bays.forEach((kind, i) => {
    const left = pier + i * (ow + pier) + (framed ? 0.02 : 0), w = ow - (framed ? 0.04 : 0), id = `gf-b${i}`;
    if (kind === 'door' || kind === 'glazed-door') {
      const dw = Math.min(w, kind === 'door' ? 1.25 : 1.6), dl = left + (w - dw) / 2, dh = Math.min(top - 0.55, 2.6);
      openings.push({id: `${id}-door`, kind: 'door', leftM: round(dl), bottomM: 0.02, widthM: round(dw), heightM: round(dh), trimWidthM: 0.07, verticalBars: [.5], paneSurface: kind === 'door' ? 'door' : 'glass', frameSurface: joinery, barSurface: joinery});
      const th = top - (0.02 + dh + 0.06);
      if (th >= 0.3) openings.push({id: `${id}-transom`, kind: 'window', leftM: round(left), bottomM: round(0.02 + dh + 0.06), widthM: round(w), heightM: round(th), trimWidthM: 0.06, ...(w > 1.1 ? {verticalBars: [.5]} : {}), frameSurface: joinery, barSurface: joinery});
      // A door narrower than its bay stands in a panel of the frame colour.
      if (framed && w - dw > 0.2) for (const [side, x, pw] of [['l', left, dl - left], ['r', dl + dw, left + w - dl - dw]] as const) if (pw > 0.08) blocks.push({id: `${id}-door-panel-${side}`, leftM: round(x), bottomM: 0.02, widthM: round(pw), heightM: round(dh), depthM: 0.05, surface: 'shop'});
      return;
    }
    const sill = framed ? k.riserM : h * 0.2;
    if (framed) blocks.push({id: `${id}-riser`, leftM: round(left), bottomM: 0.02, widthM: round(w), heightM: round(sill - 0.02), depthM: 0.05, surface: 'shop'});
    if (kind === 'panel') { openings.push({id: `${id}-panel`, kind: 'window', leftM: round(left), bottomM: round(sill), widthM: round(w), heightM: round(top - sill), trimWidthM: 0.07, paneSurface: 'door', frameSurface: joinery, barSurface: joinery}); return; }
    if (kind === 'shutter') { openings.push({id: `${id}-shutter`, kind: 'window', leftM: round(left), bottomM: round(sill), widthM: round(w), heightM: round(top - sill), trimWidthM: 0.07, paneSurface: 'door', horizontalBars: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9], frameSurface: joinery, barSurface: joinery}); return; }
    openings.push({id: `${id}-window`, kind: 'window', leftM: round(left), bottomM: round(sill), widthM: round(w), heightM: round(top - sill), trimWidthM: 0.07, ...(w > 1.1 ? {verticalBars: [.5]} : {}), horizontalBars: [0.74], frameSurface: joinery, barSurface: joinery});
  });
  return blocks;
}

/** A voussoir ring over a segmental/round head: outer arc left to right, inner arc back. */
function archRing(left: number, top: number, w: number, rise: number, ringM: number): CanalhousePoint[] {
  const radius = w * w / (8 * rise) + rise / 2, cx = left + w / 2, cy = top - radius;
  const start = Math.asin(clamp((top - rise - cy) / radius, -1, 1)), n = rise < w * 0.3 ? 3 : 4;
  const arc = (r: number) => Array.from({length: n + 1}, (_, i) => { const a = Math.PI - start - (Math.PI - 2 * start) * i / n; return [round(cx + r * Math.cos(a), 4), round(cy + r * Math.sin(a), 4)] as CanalhousePoint; });
  return [...arc(radius + ringM), ...arc(radius + 0.005).reverse()];
}

interface GableLight { left: number; width: number; bottom: number; height: number }
/** Crown height at x (the upper value on a vertical step, as the library's wall support). */
function profileHeightAt(profile: CanalhousePoint[], x: number): number {
  let h = -Infinity;
  for (let i = 1; i < profile.length; i++) {
    const [x0, y0] = profile[i - 1], [x1, y1] = profile[i];
    if (x < Math.min(x0, x1) - 1e-6 || x > Math.max(x0, x1) + 1e-6) continue;
    h = Math.max(h, Math.abs(x1 - x0) < 1e-9 ? Math.max(y0, y1) : y0 + (y1 - y0) * (x - x0) / (x1 - x0));
  }
  return h;
}
/**
 * Gable lights must stand under the crown outline (the library rejects an opening that escapes its wall). Lights that
 * fit are returned unchanged; otherwise the row shrinks around its centre (width, gap and height) until every corner
 * and every crown vertex over it clears the outline by 12 cm, and at worst drops to one centred light.
 */
export function fitGableLights(profile: CanalhousePoint[], lights: GableLight[], warnings: string[], id: string): GableLight[] {
  const clear = 0.12;
  const fits = (ls: GableLight[]) => ls.every(l => [l.left, l.left + l.width, ...profile.map(p => p[0]).filter(x => x > l.left && x < l.left + l.width)].every(x => l.bottom + l.height <= profileHeightAt(profile, x) - clear + 1e-9));
  if (fits(lights)) return lights;
  const n = lights.length, centre = (lights[0].left + lights.at(-1)!.left + lights.at(-1)!.width) / 2, bottom = lights[0].bottom;
  for (let s = 0.92; s > 0.3; s *= 0.92) {
    const w = lights[0].width * s, gap = w * 0.5, total = n * w + (n - 1) * gap;
    // The height is whatever the outline over the row allows.
    const room = Math.min(...Array.from({length: 2 * n}, (_, k) => profileHeightAt(profile, centre - total / 2 + Math.floor(k / 2) * (w + gap) + (k % 2) * w))) - clear - bottom;
    const h = Math.min(lights[0].height, room);
    if (h < 0.4 || w < 0.3) continue;
    const ls = Array.from({length: n}, (_, k) => ({left: round(centre - total / 2 + k * (w + gap)), width: round(w), bottom, height: round(h)}));
    if (fits(ls)) { warnings.push(`${id}: ${n} gable lights shrunk to ${round(w, 2)} x ${round(h, 2)} m to stand under the crown`); return ls; }
  }
  const w = lights[0].width * 0.6, room = Math.min(profileHeightAt(profile, centre - w / 2), profileHeightAt(profile, centre + w / 2)) - clear - bottom;
  const one = [{left: round(centre - w / 2), width: round(w), bottom, height: round(Math.max(0.3, Math.min(lights[0].height, room)))}];
  warnings.push(`${id}: ${n} gable lights do not fit the crown; one centred light`);
  return fits(one) ? one : [];
}

/** `fill`: the crown stands on a part of the front (`crownAt`/`crownBays`) and fills that part; wide cornice caps by default. */
function crownProfile(f: FrontIntent, width: number, eaves: number, top: number, fill = false): CanalhousePoint[] | null {
  const rise = top - eaves;
  if (f.gable === 'flat' || rise < 0.3) return null;
  switch (f.gable) {
    case 'point': return canalhouseCrownProfile('punt', width, eaves, top, 0, eaves, 0);
    case 'spout': return canalhouseCrownProfile('tuit', width, eaves, top, width * 0.34, top - Math.min(0.7, rise * 0.15), 0);
    case 'step': return canalhouseCrownProfile('trap', width, eaves, top, width * 0.3, eaves, f.crownSteps ?? clamp(Math.round(rise / 1.4), 2, 5));
    case 'neck': case 'raised-neck': return canalhouseCrownProfile('hals', width, eaves, top, width * 0.5, eaves + rise * (f.gable === 'neck' ? 0.45 : 0.25), 0, {cap: f.crownCap ?? 'pediment', capRiseM: Math.min(0.45, rise * 0.1), crestWidthM: width * 0.5, shoulderCurve: 0.6});
    case 'bell': return canalhouseCrownProfile('klok', width, eaves, top, width * 0.46, eaves + rise * 0.55, 0, {cap: f.crownCap ?? 'rounded', capRiseM: Math.min(0.6, rise * 0.15), crestWidthM: width * 0.46});
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

export function fitIntent(intent: CanalHouseIntent, surveyFacts: BuildingFacts): {recipe: CanalHouseRecipe; anchorRD: [number, number]; report: FitReport; facts: BuildingFacts} {
  if (intent.pandId !== surveyFacts.pandId) throw Error('Intent and facts describe different Pand');
  const cleanup = cleanRoof(surveyFacts, {horizontalFronts: intent.fronts.filter(f => f.gable === 'cornice' || f.gable === 'flat' || (f.cornice !== 'none' && f.crownRise !== undefined && (f.crownAt || f.crownBays))).map(f => f.street)});
  let facts = cleanup.facts;
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
    let split = [ff.endpointsRD as [number[], number[]]];
    if (fronts.length > 1) {
      const cut = splitChain(ff, shares.map(s => s / total));
      split = cut.pairs;
      if (cut.inserted.length) {
        facts = structuredClone(facts);
        for (const v of cut.inserted) insertFootprintVertex(facts, v.a, v.b, v.point);
        warnings.push(`${street}: no footprint vertex near ${cut.inserted.length} front split(s); vertex inserted on the frontage`);
      }
    }
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
    // A photo-measured eaves line (block-face strip, `measuredEavesM` in the facts) replaces the 3DBAG 10th percentile:
    // a cornice front hiding a gabled roof reads the roof's low sides as eaves. The wall then rises to it as a crown
    // fill above the lowest roof edge of this front (`bodyEaves`, what the library knows as the elevation's eaves).
    const measuredEaves = facts.measuredEavesM?.[front.id];
    const eaves = measuredEaves !== undefined ? round(measuredEaves) : round(along[Math.floor(along.length * 0.1)]), profileTop = along.at(-1)!;
    const bodyEaves = measuredEaves !== undefined ? round(Math.min(eaves, Math.max(along[0], survey.shellTopM + 0.002))) : eaves;
    // Gabled crowns rise above the roof meeting line; their top is the higher
    // of the profile peak and a proportion of the width, capped by the ridge.
    const gabled = !['cornice', 'flat'].includes(front.gable);
    // Repeated module: one house design laid out `count` times along this front
    // (19th-century rows, double fronts). Layout is fitted once per module width.
    const count = front.repeat ? (front.repeat.count === 'fit' ? Math.max(1, Math.round(width / 6)) : front.repeat.count) : 1;
    const mw = width / count, alternate = !!front.repeat?.mirrorAlternate;
    const place = (k: number, x: number, w = 0) => k * mw + (alternate && k % 2 ? mw - x - w : x);
    const corniceH = {none: 0, simple: 0.35, bracketed: 0.55, heavy: 0.8}[front.cornice];
    const layout = layoutFront(front, mw, eaves - (gabled ? 0.2 : corniceH + 0.15));
    // A crown on part of the front: [x0, x1] in module metres from the viewer's left (`crownAt` fractions or `crownBays` axes).
    const crownSpan: [number, number] | null = front.crownAt ? [front.crownAt.from * mw, front.crownAt.to * mw]
      : front.crownBays ? [layout.bayEdges[front.crownBays.from], layout.bayEdges[front.crownBays.to + 1]] : null;
    const crownW = crownSpan ? crownSpan[1] - crownSpan[0] : mw;
    const upperStoreyM = layout.storeyHeights.at(-1)!;
    const crownTop = front.crownRise !== undefined ? eaves + front.crownRise * upperStoreyM
      : gabled ? Math.max(profileTop + 0.3, Math.min(facts.heights.ridgeM + 0.3, eaves + crownW * (front.gable === 'step' ? 1 : 0.9))) : eaves + (front.crownCap && front.crownCap !== 'flat' ? (front.crownCapRise === 'low' ? 0.55 : 1.1) : 0);
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
    let rawProfile = crownProfile(front, crownW, eaves, crownTop, !!crownSpan);
    if (rawProfile && front.crownFinial) {
      // A finial block on the flat top: widen the longest top-level segment into a small plinth + block.
      const topY = Math.max(...rawProfile.map(p => p[1])), at = rawProfile.findIndex((p, i) => i + 1 < rawProfile!.length && p[1] >= topY - 1e-6 && rawProfile![i + 1][1] >= topY - 1e-6 && rawProfile![i + 1][0] - p[0] > 0.3);
      if (at < 0) warnings.push(`${front.id}: crownFinial needs a flat top segment; none on this crown`);
      else {
        const [a, b] = [rawProfile[at], rawProfile[at + 1]], cx = (a[0] + b[0]) / 2, half = Math.min(0.28, (b[0] - a[0]) * 0.3), fh = 0.4;
        rawProfile = [...rawProfile.slice(0, at + 1), [cx - half, topY], [cx - half, topY + fh], [cx + half, topY + fh], [cx + half, topY], ...rawProfile.slice(at + 1)];
      }
    }
    // A partial crown stands between two stretches of plain eaves line.
    let moduleProfile = rawProfile && crownSpan ? [...(crownSpan[0] > 0.01 ? [[0, eaves] as CanalhousePoint] : []), ...rawProfile.map(([x, y]) => [x + crownSpan[0], y] as CanalhousePoint), ...(crownSpan[1] < mw - 0.01 ? [[mw, eaves] as CanalhousePoint] : [])] : rawProfile;
    // Several gables on one front (`crownGroups`): one crown per bay group, eaves line between them.
    const groupCrowns = front.crownGroups ? front.crownGroups.map(c => {
      const span: [number, number] = [layout.bayEdges[c.from], layout.bayEdges[c.to + 1]], w = span[1] - span[0];
      const top = front.crownRise !== undefined ? eaves + front.crownRise * upperStoreyM : gabled ? Math.max(profileTop + 0.3, Math.min(facts.heights.ridgeM + 0.3, eaves + w * (front.gable === 'step' ? 1 : 0.9))) : crownTop;
      return {span, top, profile: crownProfile(front, w, eaves, top, true)?.map(([x, y]) => [x + span[0], y] as CanalhousePoint) ?? null};
    }) : null;
    if (groupCrowns) {
      const pts: CanalhousePoint[] = [];
      for (const g of groupCrowns) { if (!g.profile) continue; if (!pts.length && g.span[0] > 0.01) pts.push([0, eaves]); pts.push(...g.profile); }
      if (pts.length && pts.at(-1)![0] < mw - 0.01) pts.push([mw, eaves]);
      moduleProfile = pts.length ? pts : null;
    }
    // A tower over some bays: the front wall rises `tower.rise` storeys there (its 3D body and cap: compile.ts addTowers).
    let towerSpan: [number, number] | null = null, towerTop = 0;
    if (front.tower) {
      const span: [number, number] = [layout.bayEdges[front.tower.bays.from], layout.bayEdges[front.tower.bays.to + 1]], top = round(eaves + front.tower.rise * upperStoreyM);
      if (moduleProfile && moduleProfile.some(([x, y]) => y > eaves + 1e-6 && x > span[0] - 0.05 && x < span[1] + 0.05)) warnings.push(`${front.id}: tower overlaps a crown; tower skipped`);
      else {
        towerSpan = span; towerTop = top;
        const base = moduleProfile ?? [[0, eaves], [mw, eaves]] as CanalhousePoint[];
        moduleProfile = [...base.filter(p => p[0] <= span[0] + 1e-6), [span[0], eaves], [span[0], top], [span[1], top], [span[1], eaves], ...base.filter(p => p[0] >= span[1] - 1e-6)];
        if (moduleProfile[0][0] > 0.01) moduleProfile.unshift([0, eaves]);
        if (moduleProfile.at(-1)![0] < mw - 0.01) moduleProfile.push([mw, eaves]);
      }
    }
    const profile = moduleProfile ? Array.from({length: count}, (_, k) => moduleProfile!.map(([x, y]) => [place(k, x), y] as CanalhousePoint)).flat() : [[0, eaves], [width, eaves]] as CanalhousePoint[];
    // Stone ornament of a historic front (wings, ears, cartouche, finial on gables; a gablet/crest on a cornice front).
    if (front.gableOrnament) {
      const crowns = groupCrowns ? groupCrowns.filter(g => g.profile).map((g, i) => ({profile: g.profile!, tag: `c${i}-`}))
        : rawProfile ? [{profile: (crownSpan ? rawProfile.map(([x, y]) => [x + crownSpan[0], y] as CanalhousePoint) : rawProfile), tag: ''}]
        : [{profile: [[0, eaves], [mw, eaves]] as CanalhousePoint[], tag: ''}];
      const pieces2: CanalhouseOrnament[] = [];
      for (let m = 0; m < count; m++) for (const c of crowns) {
        const made = gableOrnaments({ornament: front.gableOrnament, profile: c.profile, eavesM: eaves, widthM: mw, idPrefix: `${pieces.length > 1 ? front.id + '-' : ''}${c.tag}${count > 1 ? `m${m}-` : ''}`});
        if (m === 0) warnings.push(...made.warnings.map(w => `${front.id}: ${w}`));
        for (const o of made.ornaments) pieces2.push({...o, profile: o.profile.map(([x, y]) => [clamp(round(mirrored ? width - place(m, x) : place(m, x), 4), 0, Math.floor(width * 1e4) / 1e4), y] as CanalhousePoint)});
      }
      if (pieces2.length) elevation.ornaments = seen([...(elevation.ornaments?.value ?? []), ...pieces2]);
    }
    if (towerSpan) {
      // One light per storey of rise, centred in the tower.
      const tw = towerSpan[1] - towerSpan[0], ww = clamp(tw * 0.38, 0.45, 1.0), wh = clamp(upperStoreyM * 0.5, 0.6, 1.6), cx = (towerSpan[0] + towerSpan[1]) / 2;
      for (let m = 0; m < count; m++) for (let r = 0; eaves + r * upperStoreyM + 0.3 * upperStoreyM + wh <= towerTop - 0.25; r++)
        elevation.openings.value.push({id: `${pieces.length > 1 ? front.id + '-' : ''}tower-${r}${count > 1 ? `-m${m}` : ''}`, kind: 'window', leftM: round(flipX(place(m, cx - ww / 2, ww), ww)), bottomM: round(eaves + r * upperStoreyM + 0.3 * upperStoreyM), widthM: round(ww), heightM: round(wh), trimWidthM: 0.06, ...WINDOW_BARS[front.windows === 'shop' ? 'sash' : front.windows], frameSurface: 'trim', barSurface: 'trim'});
    }
    if (groupCrowns) {
      // Gable lights per crown, side by side (or stacked up a neck), centred on each crown.
      const attic = front.atticWindows ?? 0;
      for (const g of groupCrowns) {
        const rise = g.top - eaves, cw = g.span[1] - g.span[0];
        if (!g.profile || attic < 1 || rise <= 1.2) continue;
        const w = clamp(cw * 0.2, 0.5, 0.9), h = clamp(rise * 0.4, 0.6, 1.4), gap = w * 0.5, total = attic * w + (attic - 1) * gap, centre = (g.span[0] + g.span[1]) / 2;
        const lights = fitGableLights(g.profile, Array.from({length: attic}, (_, k) => ({left: centre - total / 2 + k * (w + gap), width: w, bottom: eaves + 0.25, height: h})), warnings, front.id);
        for (let m = 0; m < count; m++) lights.forEach((l, k) => elevation.openings.value.push({id: `${pieces.length > 1 ? front.id + '-' : ''}attic-${groupCrowns.indexOf(g)}-${k}${count > 1 ? `-m${m}` : ''}`, kind: 'window', leftM: flipX(place(m, l.left, l.width), l.width), bottomM: l.bottom, widthM: l.width, heightM: l.height, trimWidthM: 0.06, ...WINDOW_BARS[front.windows === 'shop' ? 'sash' : front.windows], frameSurface: 'trim', barSurface: 'trim'}));
      }
    }
    if (profile) {
      elevation.crown = seen({profile: profile.map(([x, y]) => [Math.min(width, Math.max(0, mirrored ? width - x : x)), Math.max(eaves, y)] as CanalhousePoint).sort((p, q) => p[0] - q[0]), depthM: 0.18, trimWidthM: 0.08, surface: 'wall'});
      // Attic windows inside the crown.
      const attic = front.atticWindows ?? 0, rise = crownTop - eaves;
      if (attic > 0 && rise > 1.2 && !groupCrowns) {
        const w = clamp((crownSpan ? crownW * 0.2 : mw * 0.14), 0.5, 0.9), h = clamp(rise * 0.4, 0.6, 1.4), gap = w * 0.5, total = attic * w + (attic - 1) * gap;
        // Gable lights follow a partial crown: on its bay axes when there is one light per bay, else centred on it.
        const onAxes = front.crownBays && front.crownBays.to - front.crownBays.from + 1 === attic ? layout.axisCentres.slice(front.crownBays.from, front.crownBays.to + 1) : null;
        const crownCentre = crownSpan ? (crownSpan[0] + crownSpan[1]) / 2 : mw / 2;
        const round = front.atticShape === 'round', od = clamp(Math.min(crownW * 0.22, rise * 0.28), 0.5, 0.95);
        const atticLeft = (k: number) => onAxes ? onAxes[k] - w / 2 : stack ? (crownSpan ? crownCentre - w / 2 : (mw - w) / 2) : crownSpan ? crownCentre - total / 2 + k * (w + gap) : (mw - total) / 2 + k * (w + gap);
        // Neck gables stack their attic lights up the neck; other crowns set them side by side.
        const stack = front.gable === 'neck' || front.gable === 'raised-neck', hh = stack ? Math.min(h, (rise - 0.8) / attic - 0.3) : h;
        if (round) for (let m = 0; m < count; m++) for (let k = 0; k < attic; k++) elevation.openings.value.push({id: `${pieces.length > 1 ? front.id + "-" : ""}attic-${k}${count > 1 ? `-m${m}` : ''}`, kind: 'window', head: 'oval', leftM: flipX(place(m, (onAxes ? onAxes[k] : crownCentre) - od / 2, od), od), bottomM: eaves + Math.min(rise - od - 0.3, rise * 0.3), widthM: od, heightM: od, trimWidthM: 0.06, frameSurface: 'trim', barSurface: 'trim'});
        else {
          // Side-by-side lights that would escape a narrow crown (three lights in a gable) shrink until they fit under it.
          const planned = Array.from({length: attic}, (_, k) => ({left: atticLeft(k), width: w, bottom: eaves + 0.25 + (stack ? k * (hh + 0.3) : 0), height: stack ? hh : h}));
          const lights = stack || !moduleProfile ? planned : fitGableLights(moduleProfile, planned, warnings, front.id);
          for (let m = 0; m < count; m++) lights.forEach((l, k) => elevation.openings.value.push({id: `${pieces.length > 1 ? front.id + "-" : ""}attic-${k}${count > 1 ? `-m${m}` : ''}`, kind: 'window', leftM: flipX(place(m, l.left, l.width), l.width), bottomM: l.bottom, widthM: l.width, heightM: l.height, trimWidthM: 0.06, ...WINDOW_BARS[front.windows === 'shop' ? 'sash' : front.windows], frameSurface: 'trim', barSurface: 'trim'}));
        }
      }
    }
    // A mansard: a steep roof face from the cornice top, `heightM` high, leaning back `setbackM` (compile.ts addMansards).
    const mansard = front.roofFront === 'mansard' ? {bottomM: round(eaves), heightM: round(clamp(0.65 * upperStoreyM, 1.4, 2.6)), setbackM: 0} : undefined;
    if (mansard) mansard.setbackM = round(mansard.heightM / Math.tan(72 * Math.PI / 180));
    if (front.dormers) {
      const k = front.dormers, w = clamp(mw / (k * 2.2), 0.9, 1.6), gap = (mw - k * w) / (k + 1);
      const style = front.dormerStyle ?? 'plain';
      // Pediment: a triangular trim pediment over a projecting frame. Pointed: a tall pointed roof. On a mansard the dormer
      // stands on the roof face, its front just behind the cornice.
      const shape = style === 'pediment' ? {roofRiseM: round(clamp(w * 0.32, 0.4, 0.6)), frontOverhangM: 0.12} : style === 'pointed' ? {roofRiseM: round(clamp(w * 0.85, 0.8, 1.4))} : {roofRiseM: 0.45};
      const placeOnMansard = mansard ? {setbackM: round(Math.max(0.05, maxOut + 0.03)), heightM: round(clamp(mansard.heightM - 0.25, 1.1, 1.6))} : {setbackM: 0.35, heightM: 1.45};
      elevation.dormers = seen(Array.from({length: k * count}, (_, j) => ({id: `dormer-${j}`, leftM: round(flipX(place(Math.floor(j / k), gap + (j % k) * (w + gap), w), w)), widthM: round(w), bottomM: round(Math.max(eaves, survey.shellTopM) + 0.05), heightM: placeOnMansard.heightM, depthM: 1.3, roofRiseM: shape.roofRiseM, ...('frontOverhangM' in shape ? {frontOverhangM: shape.frontOverhangM} : {}), setbackM: placeOnMansard.setbackM, trimWidthM: 0.07, verticalBars: [.5], wallSurface: 'trim' as const, roofSurface: 'roof' as const})));
    }
    if (front.hoist) elevation.hoists = seen(Array.from({length: count}, (_, m) => ({id: count > 1 ? `hoist-m${m}` : 'hoist', centerM: flipX(place(m, crownSpan ? (crownSpan[0] + crownSpan[1]) / 2 : mw / 2), 0), heightM: round(gabled ? crownTop - 0.9 : eaves + 0.1), widthM: 0.14, beamHeightM: 0.18, projectionM: 1.1, setbackM: 0.1, surface: 'door' as const})));
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
    if (layout.groundBlocks?.length) elevation.blocks = seen([...(elevation.blocks?.value ?? []), ...Array.from({length: count}, (_, k) => layout.groundBlocks!.map(b => ({...b, id: idFor(k, b.id), leftM: round(flipX(place(k, b.leftM, b.widthM), b.widthM))}))).flat()]);
    if (front.shopfront && layout.shopGlass && layout.shopZone) {
      const g0 = layout.groundBase > 0 ? 1 : 0, floor = layout.groundBase + layout.storeyHeights[g0];
      const top = floor + (layout.shopStoreys === 2 ? layout.storeyHeights[g0 + 1] : 0), full = Math.floor(width * 1000) / 1000;
      // The shop band spans the whole front, or only the shop zone when a residential door or wall bays stand beside it.
      const zone: [number, number] = front.shopfront.residentialDoor || front.shopfront.bays ? [Math.max(0, layout.shopZone[0] - SHOP.pierM - 0.02), Math.min(mw, layout.shopZone[1] + SHOP.pierM + 0.02)] : [0, mw];
      const zw = Math.floor((zone[1] - zone[0]) * 1000 - 1) / 1000, at = (x: number, w: number) => round(flipX(place(0, x, w), w));
      const sign = front.shopfront.sign;
      // Piers and stall riser in the shopfront paint.
      const pierH = round(top - plinth - 0.02);
      const blocks = [{id: 'shop-pier-left', leftM: at(zone[0], SHOP.pierM), bottomM: round(plinth), widthM: SHOP.pierM, heightM: pierH, depthM: 0.1, surface: 'shop' as const},
        {id: 'shop-pier-right', leftM: at(zone[1] - SHOP.pierM - 0.001, SHOP.pierM), bottomM: round(plinth), widthM: SHOP.pierM, heightM: pierH, depthM: 0.1, surface: 'shop' as const}];
      elevation.blocks = seen([...(elevation.blocks?.value ?? []), ...blocks]);
      elevation.bands.value.push({id: 'shop-riser', leftM: at(zone[0], zw), bottomM: round(plinth), widthM: zw, heightM: round(Math.max(0.05, layout.shopGlass[0] - plinth - 0.01)), depthM: 0.05, surface: 'shop'});
      if (layout.shopStoreys === 2) elevation.bands.value.push({id: 'shop-mezzanine', leftM: at(zone[0], zw), bottomM: round(floor - 0.12), widthM: zw, heightM: 0.24, depthM: 0.06, surface: 'shop'});
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
    mainEaves = Math.min(mainEaves, bodyEaves);
    elevation.bodyEavesM = surveyed(round(bodyEaves));
    elevations.push(elevation);
    reports.push({id: front.id, widthM: round(width), eavesM: round(eaves), crownTopM: round(groupCrowns ? Math.max(...groupCrowns.map(g => g.top)) : crownTop), storeyHeightsM: layout.storeyHeights, mirrored, edge: [edgeIndex, endIndex], frontageDeviationM: round(deviation), frontageOutsetM: round(maxOut, 4), polygonIndex, ...(fasciaRect ? {fascia: fasciaRect} : {}), ...(signBand ? {signBand} : {}),
      ...(mansard ? {mansard} : {}), ...(towerSpan ? {towers: Array.from({length: count}, (_, m) => ({leftM: round(flipX(place(m, towerSpan![0], towerSpan![1] - towerSpan![0]), towerSpan![1] - towerSpan![0])), widthM: round(towerSpan![1] - towerSpan![0]), bottomM: round(bodyEaves), topM: towerTop, cap: front.tower!.cap}))} : {}), ...(measuredEaves !== undefined ? {measuredEaves: true} : {})});
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
  const shopFront = (front ?? intent.fronts.find(f => f.shopfront))?.shopfront, groundFront = (front ?? intent.fronts.find(f => f.groundFront))?.groundFront;
  // A historic ground front paints its piers/posts/beam in `shop` (default: the frame colour).
  const shop = shopFront?.colour ?? (groundFront ? groundFront.colour ?? p.frame : undefined);
  const awningFront = (front ?? intent.fronts.find(f => f.shopfront?.awning && f.shopfront.awning.style !== 'none'))?.shopfront?.awning, awning = awningFront && awningFront.style !== 'none' ? awningFront.colour : undefined;
  return {wall: swatch(p.brick), roof: roof.steep, trim: swatch(p.frame), glass: GLASS, door: swatch(p.door), stone: swatch(p.stone ?? 'sandstone'), joinery: swatch(p.frame),
    ...(p.band ? {accent: swatch(p.band)} : {}), ...(shop ? {shop: swatch(shop)} : {}), ...(awning ? {awning: swatch(awning)} : {})};
}
