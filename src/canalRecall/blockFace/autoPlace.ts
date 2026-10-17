/**
 * Automatic placement of library house types on a block face (buurt generator, 2026-10-16).
 *
 * The per-face path has an author read every pand off the strip and write its placement. This module writes the
 * placements from evidence instead:
 *   1. every pand of the face is scored against every type of a district library by its `match` rule: BAG build year
 *      and frontage width (vetoes), 3DBAG eaves, bouwlagen and roof rise, and the strip's measured wall colour, stucco
 *      share, painted-band rows and window columns (blockFace/stripPalette.ts, buildingRecipe/measureFacade.ts);
 *   2. the best type over `minScore` (and `margin` ahead of the runner-up, else the tie is reported) is placed with the
 *      bay count its width rule and the measured columns give, the 3DBAG storey count when the type allows it, the door
 *      side read off the ground band, the pand's measured brick, and a shopfront from BAG/OSM when the ground trades;
 *   3. a pand that matches nothing, has no usable photo, or (after compiling) fails the likeness gate is HELD: it stays
 *      out of the face, with the reason, and the city tier keeps drawing it. Contiguous runs of placed pands become
 *      the faces that compile (a block face needs two houses).
 * Row coherence (blockFace/rowCoherence.ts) then runs at compile time on the consecutive same-type placements.
 *
 * Pure: no filesystem. scripts/block-face/auto-place.ts gathers the evidence and writes the intents.
 */
import type {HousePlacement, HouseTypeIntent} from './houseType.ts';
import type {BlockFaceHouse, BlockFaceIntent, GroundFloorUse, RhythmSpec} from './intent.ts';
import type {StripPalette} from './stripPalette.ts';
import type {Skyline} from './stripSkyline.ts';
import type {StripStructure} from './stripStructure.ts';
import {rgbToLab, type Rgb} from '../buildingRecipe/measureFacade.ts';
import type {FrontBump} from './bayOutline.ts';
import type {ShopfrontIntent} from '../buildingRecipe/intent.ts';

/** How a library type is recognised (`match` in scripts/block-face/types/<district>/<id>.json). */
export interface TypeMatchRule {
  /** BAG/3DBAG build years (inclusive); outside by more than `yearSlack` vetoes the type. */
  years: [number, number];
  yearSlack?: number;
  /** 3DBAG eaves of the street front (m). */
  eavesM?: [number, number];
  /** 3DBAG bouwlagen the type is seen with. */
  storeys3dbag?: number[];
  /** Roof rise over the eaves (3DBAG roof max - eaves): `flat` under 1.5 m, `pitched` over. */
  roof?: 'flat' | 'pitched';
  /** Window bays by frontage width: the first entry whose `maxWidthM` holds the width. Default: the type's body bays. */
  baysByWidth?: {maxWidthM: number; bays: number}[];
  /** Measured strip wall colour: Lab distance to `hex` within `maxDE` scores 1, within twice that 0.5. */
  wall?: {hex: string; maxDE: number};
  /** The strip reads a painted/stucco wall (stripPalette `stucco`). */
  stucco?: boolean;
  /** The strip shows painted band rows on the piers (two or more band runs). */
  bands?: boolean;
  /**
   * Crown variant by the strip skyline (blockFace/stripSkyline.ts): the first variant whose ranges hold the measured
   * crown (`none: true` = no crown over the eaves); unread or unmatched keeps the type's first crown.
   */
  /** The type is drawn with its house door on this side; a pand whose door reads on the other side is mirrored (pairs). */
  mirrorForDoor?: 'left' | 'right';
  /**
   * Doors pair across the party wall whatever the neighbour's type (`fillPairs`): a pand whose door was not read takes
   * the side that meets a placed neighbour of any type whose door side is known (read, or set by its accent/BAG bay).
   * Rivierenbuurt 1934 portiek rows: a flat front's door meets the door of the erker house beside it.
   */
  doorsPairAcross?: boolean;
  /**
   * The type is drawn with its light accent mass (a white bay stack) on this side; the strip's upper-storey accent
   * asymmetry is then a criterion (an even front scores 0) and a pand whose accent reads on the other side is mirrored.
   */
  mirrorForAccent?: 'left' | 'right';
  /**
   * Range of the upper storeys' light-accent share (StripEvidence.accentShare): the white bay stacks of Hasebroekstraat
   * 56-70 read 0.37-0.56 on the 2024-12-11 strip, the green-tile fronts of 90-98 on the same strip 0.07-0.25. Exposure
   * dependent (a dark 2022 strip reads 0 everywhere), so it is a weighted criterion, never a veto.
   */
  accentShare?: [number, number];
  /**
   * The type has no balconies: a strip that reads balconies (blockFace/stripStructure.ts: a dark open axis without
   * brick spandrels, or stacked balcony slabs) VETOES it. Jan Hanzenstraat 49-51, Ten Katestraat 29-31 and Bellamystraat
   * 18-20 took the green-tile and two-axis types without it.
   */
  balconies?: false;
  /**
   * Range of the widest light bay (stripStructure.ts `bayWidthM`, read relative to the pand's own wall, so it holds on
   * dark and washed-out strips alike): the tile-bay oriels read 2.0-2.3 m, plain window columns at most 1.3 m.
   */
  bayWidthM?: [number, number];
  /**
   * The BAG outline carries a bay in front of the facade line (blockFace/bayOutline.ts `frontBump`, PandEvidence
   * `bagBay`): true for an erker type, false for a flat front. A weighted criterion (3), not a veto: BAG can miss an erker.
   * Rivierenbuurt 1934 rows: the brick-panelled erkers read no light bay on the strip, but BAG draws every one of them.
   */
  bagBay?: boolean;
  /** Range of |bay centre - 0.5| (share of the front): Boterdiepstraat's side erkers 0.18-0.19, Eemsstraat's 0.06-0.10. */
  bagBayOffset?: [number, number];
  crowns?: Record<string, CrownRule & {alt?: CrownRule}>;
  note?: string;
}

/** Skyline ranges of a crown variant; `alt` is a second accepted range set (either matches). */
export interface CrownRule { none?: boolean; riseM?: [number, number]; topWidthM?: [number, number]; widthM?: [number, number] }

/** A library type with its match rule (typeLibrary.ts LibraryHouseType plus `match`). */
export type MatchableType = HouseTypeIntent & {match?: TypeMatchRule};

export interface StripEvidence {
  date: string;
  /** strip.json span pixels, for citations */
  px: [number, number];
  palette: StripPalette;
  /** The wall colour normalised by the light trim (measureFacade `wall.hex`): exposure-independent, what the likeness gate compares. */
  wall: string | null;
  /** `rowExposure` only: the pand's own trim-normalised wall before the row's gain replaced it. */
  wallOwnGain?: string;
  skyline: Skyline | null;
  /** Body-band shares that are no evidence: the strip's grey placeholder and foliage. */
  voidShare: number; foliageShare: number;
  /** Window columns over the upper storeys (measureFacade on the span), null when unread. */
  columns: number | null;
  /** Door side read off the ground band (the dark tall opening nearest a party wall), null when unread. */
  doorSide: 'left' | 'right' | null;
  /** The half of the upper storeys holding clearly more light accent pixels (ratio >= 1.6), null when even. */
  accentSide?: 'left' | 'right' | null;
  /** Share of the upper storeys' (6.5 m .. eaves - 0.5 m) non-placeholder pixels that are light accent (white bays, frames). */
  accentShare?: number;
  /** Exposure-normalised structure of the upper body (blockFace/stripStructure.ts): bays, open axes, balconies. */
  structure?: StripStructure | null;
}

export interface PandEvidence {
  pandId: string;
  address: string;
  builtYear: number | null;
  widthM: number;
  eavesM: number;
  roofMaxM: number;
  storeys3dbag: number | null;
  /** BAG gebruiksdoel of the ground units, and the OSM businesses assigned to the pand (blockFace/uses.ts). */
  groundUses: string[];
  osm: {type: string; id: number; name?: string; category?: string}[];
  strip?: StripEvidence;
  /** The bay of the pand's BAG outline in front of its facade line (`frontBump` of the discovered front), null when straight; undefined = not read. */
  bagBay?: FrontBump | null;
}

export interface Criterion { key: string; score: number | null; weight: number; note: string }
export interface TypeScore { typeId: string; score: number; veto: string[]; criteria: Criterion[] }

export const AUTO_PLACE = {
  /** A placement needs this weighted score (0..1). */
  minScore: 0.7,
  /** A runner-up within this of the winner is reported as a tie. */
  margin: 0.05,
  /** Body pixels that are placeholder grey or foliage beyond this: no photo evidence. */
  maxVoid: 0.35, maxFoliage: 0.3,
  yearSlack: 2,
  /** Frontage beyond the type's fit by more than this vetoes it. */
  widthSlackM: 0.4,
  flatRoofRiseM: 1.5,
} as const;

const W = {eaves: 2, storeys: 1, roof: 1, wall: 2, stucco: 2, bands: 1, columns: 1.5} as const;
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
export const deltaE = (a: string, b: string) => { const p = rgbToLab(hexRgb(a)), q = rgbToLab(hexRgb(b)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const r2 = (v: number) => +v.toFixed(2);

/** The bay count a type gives a pand of this width (its width rule, else the body's). */
export function baysFor(t: MatchableType, widthM: number): number {
  const rule = t.match?.baysByWidth?.find(b => widthM <= b.maxWidthM);
  if (rule) return rule.bays;
  return typeof t.body.bays === 'number' ? t.body.bays : Math.max(...t.body.bays);
}

/** The type's storey pitch: the middle of its eaves range over its body storeys (3.35 m on the 1904 rows). */
export const storeyPitch = (t: MatchableType) => t.match?.eavesM ? (t.match.eavesM[0] + t.match.eavesM[1]) / 2 / t.body.storeys : 3.3;
/** The storey count of the type's fit whose pitch over the eaves is closest to the type's (Hasebroekstraat 1-37: 16.5 m = 5 storeys). */
export function storeysFor(t: MatchableType, eavesM: number): number {
  const options = t.fit?.storeys?.length ? t.fit.storeys : [t.body.storeys], p = storeyPitch(t);
  return options.reduce((best, s) => Math.abs(eavesM / s - p) < Math.abs(eavesM / best - p) ? s : best, t.body.storeys);
}

/**
 * The side of a pand's one-sided light mass: the bay's centre when the structure reads a bay of 1.5 m or more (exposure
 * independent), else the strip's accent-pixel asymmetry.
 */
export function accentSideOf(s: StripEvidence): 'left' | 'right' | null {
  const b = s.structure;
  if (b && b.bayWidthM >= 1.5 && b.bayCentre !== null && Math.abs(b.bayCentre - 0.5) >= 0.1) return b.bayCentre < 0.5 ? 'left' : 'right';
  return s.accentSide ?? null;
}

/** Score one type for one pand. A veto (year, width) makes the score 0. */
export function scoreType(t: MatchableType, ev: PandEvidence): TypeScore {
  const m = t.match, veto: string[] = [], criteria: Criterion[] = [];
  if (!m) return {typeId: t.id, score: 0, veto: ['type has no match rule'], criteria};
  const slack = m.yearSlack ?? AUTO_PLACE.yearSlack;
  if (ev.builtYear === null) veto.push('no build year');
  else if (ev.builtYear < m.years[0] - slack || ev.builtYear > m.years[1] + slack) veto.push(`built ${ev.builtYear}, type ${m.years.join('-')}`);
  const fw = t.fit?.widthM;
  if (fw && (ev.widthM < fw[0] - AUTO_PLACE.widthSlackM || ev.widthM > fw[1] + AUTO_PLACE.widthSlackM)) veto.push(`frontage ${ev.widthM} m, type ${fw.join('-')} m`);
  if (m.eavesM) {
    // The eaves over the storey count the type would draw (its fit) against the type's own storey pitch: a 5-storey
    // member of a 4-storey type's row (Hasebroekstraat 1-37 at 16.5 m beside 4-36 at 13.2 m) is the same design.
    const s = storeysFor(t, ev.eavesM), p = storeyPitch(t), off = Math.abs(ev.eavesM / s - p) / p;
    criteria.push({key: 'eaves', weight: W.eaves, score: off <= 0.08 ? 1 : off <= 0.15 ? 0.5 : 0, note: `3DBAG eaves ${r2(ev.eavesM)} m = ${s} storeys of ${r2(ev.eavesM / s)} m vs the type's ${r2(p)} m`});
  }
  if (m.storeys3dbag) criteria.push({key: 'storeys', weight: W.storeys, score: !ev.storeys3dbag ? null : m.storeys3dbag.includes(ev.storeys3dbag) ? 1 : 0, note: `3DBAG bouwlagen ${ev.storeys3dbag ?? '-'} vs ${m.storeys3dbag.join('/')}`});
  if (m.roof) {
    const rise = ev.roofMaxM - ev.eavesM, form = rise < AUTO_PLACE.flatRoofRiseM ? 'flat' : 'pitched';
    criteria.push({key: 'roof', weight: W.roof, score: form === m.roof ? 1 : 0, note: `roof rise ${r2(rise)} m (${form}) vs ${m.roof}`});
  }
  const s = ev.strip, usable = s && s.voidShare <= AUTO_PLACE.maxVoid && s.foliageShare <= AUTO_PLACE.maxFoliage;
  if (m.wall) {
    const wall = usable ? s!.wall : null, d = wall ? deltaE(wall, m.wall.hex) : null;
    criteria.push({key: 'wall', weight: W.wall, score: d === null ? null : d <= m.wall.maxDE ? 1 : d <= 2 * m.wall.maxDE ? 0.5 : 0, note: d === null ? 'no strip wall' : `strip wall ${wall} dE ${d.toFixed(1)} to ${m.wall.hex} (<= ${m.wall.maxDE})`});
  }
  if (m.stucco !== undefined) criteria.push({key: 'stucco', weight: W.stucco, score: usable ? (s!.palette.stucco === m.stucco ? 1 : 0) : null, note: usable ? `strip accent share ${s!.palette.shares.accent} (${s!.palette.stucco ? 'stucco' : 'brick'})` : 'no strip'});
  if (m.bands !== undefined) {
    const runs = usable ? s!.palette.bandRunsM.length : null;
    criteria.push({key: 'bands', weight: W.bands, score: runs === null ? null : (runs >= 2) === m.bands ? 1 : 0, note: runs === null ? 'no strip' : `${runs} painted band runs`});
  }
  const st = usable ? s!.structure ?? null : null;
  if (m.balconies === false && st?.balconies) veto.push(`strip shows balconies (${st.balconyWhy})`);
  if (m.bagBay !== undefined && ev.bagBay !== undefined) {
    const off = ev.bagBay ? Math.abs(ev.bagBay.centre - 0.5) : null, offOk = !m.bagBayOffset || (off !== null && off >= m.bagBayOffset[0] && off <= m.bagBayOffset[1]);
    criteria.push({key: 'bag-bay', weight: 3, score: !!ev.bagBay === m.bagBay && (!m.bagBay || offOk) ? 1 : 0,
      note: ev.bagBay ? `BAG outline bay ${ev.bagBay.fromM}-${ev.bagBay.toM} m, ${ev.bagBay.depthM} m deep, centre ${ev.bagBay.centre}` : 'BAG outline straight'});
  }
  if (m.bayWidthM) criteria.push({key: 'bay', weight: 3, score: st ? (st.bayWidthM >= m.bayWidthM[0] && st.bayWidthM <= m.bayWidthM[1] ? 1 : 0) : null, note: st ? `widest light bay ${st.bayWidthM} m vs ${m.bayWidthM.join('-')} m` : 'no strip structure'});
  if (m.accentShare) criteria.push({key: 'accent-share', weight: 2, score: usable && s!.accentShare !== undefined ? (s!.accentShare >= m.accentShare[0] && s!.accentShare <= m.accentShare[1] ? 1 : 0) : null, note: usable ? `upper accent share ${s!.accentShare ?? '-'} vs ${m.accentShare.join('-')}` : 'no strip'});
  if (m.mirrorForAccent) { const side = usable ? accentSideOf(s!) : null; criteria.push({key: 'accent-side', weight: 2, score: usable ? (side ? 1 : 0) : null, note: usable ? `upper accent ${side ?? 'even'} (type: one-sided)` : 'no strip'}); }
  const want = baysFor(t, ev.widthM);
  if (usable && s!.columns !== null) criteria.push({key: 'columns', weight: W.columns, score: s!.columns === want ? 1 : Math.abs(s!.columns - want) === 1 ? 0.4 : 0, note: `strip columns ${s!.columns} vs ${want} bays`});
  const scored = criteria.filter(c => c.score !== null), wsum = scored.reduce((a, c) => a + c.weight, 0);
  const score = veto.length ? 0 : wsum ? scored.reduce((a, c) => a + c.weight * c.score!, 0) / wsum : 0;
  return {typeId: t.id, score: r2(score), veto, criteria};
}

/** Ground use of a pand from BAG and OSM (no photo reading: the agreement says so). */
export function groundUse(ev: PandEvidence, photoDate: string): GroundFloorUse {
  const biz = ev.osm.find(o => o.category && !/^office=/.test(o.category)) ?? ev.osm[0];
  const bagTrade = ev.groundUses.some(u => /winkel|bijeenkomst|horeca/.test(u));
  const use: GroundFloorUse['use'] = biz?.category ? (/^amenity=(restaurant|fast_food)/.test(biz.category) ? 'restaurant' : /^amenity=cafe/.test(biz.category) ? 'cafe' : /^amenity=(bar|pub)/.test(biz.category) ? 'bar' : /^shop=/.test(biz.category) ? 'shop' : /^office=/.test(biz.category) ? 'office' : 'services')
    : bagTrade ? 'shop' : ev.groundUses.some(u => /kantoor/.test(u)) ? 'office' : 'residential';
  return {use, ...(biz?.name ? {name: biz.name} : {}), ...(biz?.category ? {category: biz.category} : {}), ...(biz ? {osm: {type: biz.type, id: biz.id, ...(biz.name ? {name: biz.name} : {})}} : {}),
    bag: ev.groundUses, photoDate, agreement: biz ? 'osm-only' : 'bag-only', note: 'auto-place: BAG gebruiksdoel and OSM, not read off the photo'};
}

export interface Placed {
  pandId: string; typeId: string; score: number; runnerUp?: {typeId: string; score: number};
  house: BlockFaceHouse; notes: string[];
}
/** `review`: held after a person reviewed the run's strip sheet (buurten/<buurt>-review-holds.json). */
export interface Held { pandId: string; address: string; stage: 'match' | 'evidence' | 'likeness' | 'run' | 'review'; reason: string; best?: TypeScore }
export type Decision = ({kind: 'placed'} & Placed) | ({kind: 'held'} & Held);

/** The shop ground of an auto-placed trading pand: the measured fascia colour, a residential door on the door side. */
export function autoShopfront(ev: PandEvidence, use: GroundFloorUse): ShopfrontIntent {
  const fascia = ev.strip?.palette.fascia ?? '#3a3a3a';
  return {colour: fascia, fascia: true, ...(use.name ? {name: use.name} : {}), entrance: 'centre', glazing: 'split', stallriser: 'low',
    ...(ev.widthM >= 5 ? {residentialDoor: {side: ev.strip?.doorSide ?? 'left', colour: '#2a2a2a'}} : {}),
    evidence: `auto-place: ${use.agreement} (${[...use.bag ?? [], use.category].filter(Boolean).join(', ')}); fascia colour measured on the strip ${ev.strip?.date ?? '-'} span ${ev.strip?.px.join('-') ?? '-'}`};
}

/** Decide one pand: the best type over the threshold, or a hold with the reason. */
export function decidePand(types: MatchableType[], ev: PandEvidence, slug: string, photoDate: string): Decision {
  const s = ev.strip;
  if (!s) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'evidence', reason: 'no strip span (no panorama covers the front)'};
  if (s.voidShare > AUTO_PLACE.maxVoid) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'evidence', reason: `strip ${Math.round(s.voidShare * 100)} % without panorama data`};
  const ranked = types.map(t => scoreType(t, ev)).sort((a, b) => b.score - a.score);
  const best = ranked[0], second = ranked[1];
  if (!best || best.score < AUTO_PLACE.minScore) {
    const why = !best ? 'no types' : best.veto.length ? `every type vetoed (best ${best.typeId}: ${best.veto.join('; ')})` : `best ${best.typeId} scores ${best.score} < ${AUTO_PLACE.minScore} (${best.criteria.filter(c => c.score !== null && c.score < 1).map(c => c.note).join('; ')})`;
    return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'match', reason: why, best};
  }
  const t = types.find(x => x.id === best.typeId)!;
  const notes: string[] = [];
  if (second && second.score > 0 && best.score - second.score < AUTO_PLACE.margin) notes.push(`near tie with ${second.typeId} (${second.score})`);
  const use = groundUse(ev, photoDate);
  const trading = !['residential', 'office', 'vacant'].includes(use.use);
  const bays = baysFor(t, ev.widthM), bodyBays = typeof t.body.bays === 'number' ? t.body.bays : undefined;
  const placement: HousePlacement = {type: t.id};
  if (bodyBays !== undefined && bays !== bodyBays) placement.overrides = {bays};
  // Storeys from the eaves, not 3DBAG bouwlagen (it counts the attic: 5 on the 4-storey Hasebroekstraat 4-36).
  const storeys = storeysFor(t, ev.eavesM);
  if (storeys !== t.body.storeys) { placement.storeys = storeys; notes.push(`storeys ${storeys}: eaves ${ev.eavesM} m at the type's ${storeyPitch(t).toFixed(2)} m pitch`); }
  // Door side: the type's grounds are authored door-left / door-right; the measured side picks one, unread keeps the first.
  const grounds = Object.keys(t.grounds ?? {});
  if (trading) placement.ground = {shopfront: autoShopfront(ev, use)};
  // A bay in the BAG outline gives the accent side outright (it does not depend on the strip's exposure).
  const bagSide = ev.bagBay && Math.abs(ev.bagBay.centre - 0.5) >= 0.1 ? (ev.bagBay.centre < 0.5 ? 'left' : 'right') : null;
  const aSide = bagSide ?? accentSideOf(s);
  if (t.match?.mirrorForAccent && aSide) { if (aSide !== t.match.mirrorForAccent) placement.mirror = true; notes.push(`accent ${aSide}${placement.mirror ? ': mirrored' : ''}`); }
  else if (t.match?.mirrorForDoor) { if (s.doorSide && s.doorSide !== t.match.mirrorForDoor) placement.mirror = true; notes.push(`door ${s.doorSide ?? 'unread'}${placement.mirror ? ': mirrored' : ''}`); }
  else if (!trading && s.doorSide && grounds.includes(`door-${s.doorSide}`)) placement.ground = `door-${s.doorSide}`;
  if (s.wall && !s.palette.stucco && s.foliageShare <= AUTO_PLACE.maxFoliage) placement.measuredPalette = {brick: s.wall, evidence: `strip ${s.date} span ${s.px.join('-')}: ${s.wallOwnGain ? `raw wall at the row's trim gain (autoPlace.ts rowExposure; own gain ${s.wallOwnGain})` : 'trim-normalised wall (buildingRecipe/measureFacade.ts)'}`};
  const crown = crownFor(t, s.skyline);
  if (crown.name !== Object.keys(t.crowns)[0]) placement.crown = crown.name;
  notes.push(crown.why);
  const rhythm: Partial<RhythmSpec> = {citation: `auto-place: ${t.id} scored ${best.score} on ${best.criteria.map(c => `${c.key} ${c.score ?? '-'}`).join(', ')}; strip ${s.date} span ${s.px.join('-')}`};
  return {kind: 'placed', pandId: ev.pandId, typeId: t.id, score: best.score, ...(second ? {runnerUp: {typeId: second.typeId, score: second.score}} : {}), notes,
    house: {pandId: ev.pandId, slug, address: ev.address, type: placement, groundFloor: use, rhythm: rhythm as RhythmSpec}};
}

export const SKYLINE_MIN_CONFIDENCE = 0.6;

/** The crown variant the skyline reads (`match.crowns`), else the type's first. */
export function crownFor(t: MatchableType, sky: Skyline | null): {name: string; why: string} {
  const first = Object.keys(t.crowns)[0], rules = t.match?.crowns;
  if (!rules) return {name: first, why: `crown ${first} (type default)`};
  if (!sky || sky.confidence < SKYLINE_MIN_CONFIDENCE) return {name: first, why: `crown ${first}: skyline unread (confidence ${sky?.confidence ?? 0})`};
  const c = sky.crown, inR = (v: number, r?: [number, number]) => !r || (v >= r[0] && v <= r[1]);
  for (const [name, r] of Object.entries(rules)) {
    if (!t.crowns[name]) continue;
    const fits = (q: CrownRule) => !!c && inR(c.riseM, q.riseM) && inR(c.topWidthM, q.topWidthM) && inR(c.widthM, q.widthM);
    if (r.none ? !c : fits(r) || (!!r.alt && fits(r.alt))) return {name, why: `crown ${name}: skyline ${c ? `rise ${c.riseM} m, width ${c.widthM} m, top ${c.topWidthM} m` : 'no crown over the eaves'}`};
  }
  return {name: first, why: `crown ${first}: skyline ${c ? `rise ${c.riseM} m, width ${c.widthM} m, top ${c.topWidthM} m` : 'no crown'} matches no variant`};
}

/**
 * One exposure for a row (auto-place `--row-exposure`). The trim normalisation of each pand's wall (measureFacade: the
 * p97 light cells to 215/255) takes whatever is lightest in that pand for white, so on one strip of one brick the gain
 * follows the house type, not the light: Hoendiepstraat 5-35 (2023-01-03) 1.26-1.36 under the white attic storey and
 * 0.82-0.88 where a van or a tree covers it; Eemsstraat 6-36 1.35 at the white-framed erkers, 0.93 at the flat fronts.
 * Here every unpainted pand with both readings takes its raw strip wall (stripPalette `wall`) times the median gain of
 * the face, per channel, so a row keeps the differences in its bricks and loses those of its trim. Returns the gain, or
 * null (nothing changed) with fewer than four such pands.
 */
export function rowExposure(evs: PandEvidence[], given?: [number, number, number]): [number, number, number] | null {
  const use = evs.filter(e => e.strip?.wall && e.strip.palette.wall && !e.strip.palette.stucco);
  if (!given && use.length < 4) return null;
  const gain = given ?? medianGain(trimGains(evs));
  for (const e of use) {
    const r = hexRgb(e.strip!.palette.wall!), hex = '#' + r.map((v, c) => Math.min(255, Math.round(v * gain[c])).toString(16).padStart(2, '0')).join('');
    e.strip!.wallOwnGain = e.strip!.wall!; e.strip!.wall = hex;
  }
  return gain;
}
/** Per pand (unpainted, both readings): the trim normalisation's gain per channel, trim-normalised wall over raw strip wall. */
export function trimGains(evs: PandEvidence[]): number[][] {
  return evs.filter(e => e.strip?.wall && e.strip.palette.wall && !e.strip.palette.stucco)
    .map(e => { const w = hexRgb(e.strip!.wall!), r = hexRgb(e.strip!.palette.wall!); return w.map((v, c) => v / Math.max(1, r[c])); });
}
/**
 * The median per channel of many pands' gains. `--row-exposure=date` pools every face of the run photographed on one
 * day: one light, one exposure (Hoendiepstraat 5-35's own median, 1.33, is its white attic storey; the other faces of
 * 2023-01-03, Eemsstraat and Hoendiepstraat 2-60, read 0.94).
 */
export function medianGain(gains: number[][]): [number, number, number] {
  const median = (xs: number[]) => { const q = [...xs].sort((x, y) => x - y), m = q.length >> 1; return q.length % 2 ? q[m] : (q[m - 1] + q[m]) / 2; };
  return [0, 1, 2].map(c => +median(gains.map(g => g[c])).toFixed(3)) as [number, number, number];
}

/**
 * Row coherence for the BAG erker (Rivierenbuurt 1934 rows). Two rules; the presence of a BAG erker outline is a fact
 * they never override, its offset along the front is not:
 *
 * 1. Between two of a kind. The types of a street side tell their erker apart by its place in the BAG outline
 *    (`match.bagBayOffset`), and BAG digitises the same erker 0.05-0.15 of the front apart from house to house
 *    (Boterdiepstraat 25: 0.75 among 0.65s), so a lone pand lands on a neighbour row's type. A placed pand between two
 *    placed neighbours of one other type (across at most one held pand on each side: Hoendiepstraat 13 beside the held
 *    11), drawn the same way round, takes their type and side. A pand BAG draws with an erker never becomes a type
 *    without one.
 * 2. The rhythm. The rows repeat every four houses (erker pair, then flat pair). A placed pand takes the type and side
 *    of the houses four along when those of them that BAG draws with an erker agree and at least one does: BAG misses
 *    some erkers the photo shows (Eemsstraat 22 and 14, Boterdiepstraat 50) and puts others off their row's place
 *    (Hoendiepstraat 8: 0.25 among 0.31s). Again an erker in BAG is never dropped.
 *
 * The adopted type is scored with the reference house's BAG bay (the row's erker place), so it places on the same
 * evidence as its neighbours. Returns the pands changed.
 */
export function rowCoherence(decisions: Decision[], types: MatchableType[], evs: PandEvidence[], photoDate: string): string[] {
  const changed: string[] = [];
  type P = {kind: 'placed'} & Placed;
  const placedAt = (j: number) => j >= 0 && j < decisions.length && decisions[j].kind === 'placed' ? decisions[j] as P : null;
  const adopt = (k: number, t: MatchableType, ref: number, why: string) => {
    const d = decisions[k] as P, r = decisions[ref] as P, bay = evs[k].bagBay, mirror = !!r.house.type?.mirror;
    let nd = decidePand([t], {...evs[k], bagBay: evs[ref].bagBay ?? bay}, d.house.slug, photoDate);
    if (nd.kind !== 'placed') {
      const {bagBay: _bay, bagBayOffset: _offset, ...rest} = t.match!;
      nd = decidePand([{...t, match: rest} as MatchableType], evs[k], d.house.slug, photoDate);
    }
    if (nd.kind !== 'placed') return;
    if (mirror) nd.house.type!.mirror = true; else delete nd.house.type!.mirror;
    nd.notes = [...nd.notes.filter(x => !/^(accent|door) |^bag-bay /.test(x)), `row coherence: ${why}, was ${d.typeId}${d.house.type?.mirror ? ' (mirrored)' : ''}${bay ? ` (BAG bay centre ${bay.centre})` : ' (no BAG bay)'}`];
    decisions[k] = nd; changed.push(d.pandId);
  };
  const same = (x: P, y: P) => x.typeId === y.typeId && !!x.house.type?.mirror === !!y.house.type?.mirror;
  const keepsBay = (k: number, t: MatchableType | undefined) => !!t?.match && t.match.bagBay !== undefined && !(evs[k].bagBay && !t.match.bagBay);
  for (let k = 1; k + 1 < decisions.length; k++) {
    const d = placedAt(k);
    const ia = placedAt(k - 1) ? k - 1 : decisions[k - 1].kind === 'held' && placedAt(k - 2) ? k - 2 : -1;
    const ib = placedAt(k + 1) ? k + 1 : decisions[k + 1].kind === 'held' && placedAt(k + 2) ? k + 2 : -1;
    if (!d || ia < 0 || ib < 0) continue;
    const a = decisions[ia] as P, b = decisions[ib] as P;
    if (!same(a, b) || a.typeId === d.typeId) continue;
    const t = types.find(x => x.id === a.typeId);
    if (!keepsBay(k, t)) continue;
    adopt(k, t!, ia, `between two ${t!.id}${a.house.type?.mirror ? ' (mirrored)' : ''} houses`);
  }
  for (let k = 0; k < decisions.length; k++) {
    const d = placedAt(k);
    if (!d || evs[k].bagBay === undefined || changed.includes(d.pandId)) continue;
    const at = [k - 4, k + 4].filter(j => placedAt(j) && evs[j].bagBay), anchors = at.map(j => decisions[j] as P);
    if (!anchors.length || anchors.some(x => !same(x, anchors[0])) || same(anchors[0], d)) continue;
    // A pand with its own BAG erker is moved only on a confirmed rhythm: two anchors, or one whose own house four further
    // on agrees with it (Hoendiepstraat 16 and 24 for 8), never on one house at the end of a face.
    const confirmed = at.length === 2 || at.some(j => { const far = placedAt(2 * j - k); return !!far && !!evs[2 * j - k].bagBay && same(far, decisions[j] as P); });
    if (evs[k].bagBay && !confirmed) continue;
    const t = types.find(x => x.id === anchors[0].typeId);
    if (!t?.match?.bagBay || !keepsBay(k, t)) continue;
    adopt(k, t, at[0], `the row repeats every four houses: ${anchors.map(x => x.pandId.slice(-6)).join(' and ')} (BAG erker) are ${t.id}${anchors[0].house.type?.mirror ? ' (mirrored)' : ''}`);
  }
  return changed;
}

/**
 * Mirrored pairs (`match.mirrorForDoor`): a pand whose door was not read takes the opposite of a same-type neighbour
 * whose door was (the doors of a pair meet at one party wall, so neighbours alternate).
 */
export function fillPairs(decisions: Decision[], types: MatchableType[]): number {
  let filled = 0;
  for (let sweep = 0, before = -1; sweep < 4 && filled !== before; sweep++) { before = filled; for (let k = 0; k < decisions.length; k++) {
    const d = decisions[k];
    if (d.kind !== 'placed' || !d.notes.includes('door unread') || !types.find(t => t.id === d.typeId)?.match?.mirrorForDoor) continue;
    const t = types.find(x => x.id === d.typeId)!;
    if (sweep > 0 && !t.match?.doorsPairAcross) continue; // later sweeps chain cross-type pairs only (same-type pairing is one forward pass)
    if (t.match?.doorsPairAcross) {
      // The neighbour's door side: its authored door ground, flipped when mirrored; known unless its own door is unread.
      const sideOf = (x: Decision | undefined): 'left' | 'right' | null => {
        if (x?.kind !== 'placed' || x.notes.includes('door unread')) return null;
        const g = typeof x.house.type?.ground === 'string' ? x.house.type.ground : Object.keys(types.find(y => y.id === x.typeId)?.grounds ?? {})[0];
        const s = g === 'door-left' ? 'left' : g === 'door-right' ? 'right' : null;
        return s && x.house.type?.mirror ? (s === 'left' ? 'right' : 'left') : s;
      };
      const left = sideOf(decisions[k - 1]), right = sideOf(decisions[k + 1]);
      const want = left === 'right' ? 'left' : right === 'left' ? 'right' : left === 'left' ? 'right' : right === 'right' ? 'left' : null;
      if (!want) continue;
      if (want !== t.match.mirrorForDoor) d.house.type!.mirror = true; else delete d.house.type!.mirror;
      const mate = left ? decisions[k - 1] as Placed : decisions[k + 1] as Placed;
      d.notes[d.notes.indexOf('door unread')] = `door unread: ${d.house.type!.mirror ? 'mirrored' : 'as drawn'}, paired with ${mate.pandId.slice(-6)}'s door`;
      filled++;
      continue;
    }
    const mate = [decisions[k - 1], decisions[k + 1]].find(x => x?.kind === 'placed' && x.typeId === d.typeId && !x.notes.includes('door unread')) as Placed | undefined;
    if (!mate) continue;
    if (!mate.house.type!.mirror) d.house.type!.mirror = true; else delete d.house.type!.mirror;
    d.notes[d.notes.indexOf('door unread')] = `door unread: ${d.house.type!.mirror ? 'mirrored' : 'as drawn'}, the opposite of ${mate.pandId.slice(-6)}`;
    filled++;
  } }
  return filled;
}

/**
 * The placement gate of one auto-placed pand over its structural likeness (blockFace/stripLikeness.ts: body NCC of the
 * photo strip against the model render): under `minNcc` the type is wrong for the photo (held); no score (too little
 * usable photo) is no evidence.
 */
export function placementGate(l: {ncc: number | null; abstain: string | null}, minNcc = 0.15): {gate: 'pass' | 'hold' | 'no-evidence'} {
  return {gate: l.ncc === null ? 'no-evidence' : l.ncc < minNcc ? 'hold' : 'pass'};
}

/** Contiguous runs of placed pands (street order); a run of one cannot be a face and is held. */
export function placedRuns(decisions: Decision[]): {runs: Placed[][]; orphans: Held[]} {
  const runs: Placed[][] = [], orphans: Held[] = [];
  let cur: Placed[] = [];
  const flush = () => { if (cur.length >= 2) runs.push(cur); else for (const p of cur) orphans.push({pandId: p.pandId, address: p.house.address, stage: 'run', reason: 'a single placed pand between held neighbours or the face end: a block face needs two houses'}); cur = []; };
  for (const d of decisions) { if (d.kind === 'placed') cur.push(d); else flush(); }
  flush();
  return {runs, orphans};
}

/** The face intent of one run. */
export function runIntent(o: {id: string; street: string; stripDate: string; stripImage: string; types: string[]; run: Placed[]; note: string}): BlockFaceIntent {
  const used = [...new Set(o.run.map(p => p.typeId))];
  return {schemaVersion: 1, kind: 'block-face', id: o.id, street: o.street,
    sources: [{id: `strip-${o.stripDate}`, kind: 'street-panorama', capturedAt: o.stripDate, image: o.stripImage, license: 'Gemeente Amsterdam panorama, CC BY 4.0'} as BlockFaceIntent['sources'][number]],
    authoring: {author: 'auto-place (blockFace/autoPlace.ts)', passes: 1, note: o.note},
    types: o.types.filter(t => used.includes(t)),
    houses: o.run.map(p => p.house),
    continuity: {streetLevel: 'shared', corniceGroups: [], identical: [], partyClip: true,
      roof: {source: 'recipe', pitchDeg: 30, evidence: 'auto-place: low attic behind the cornice; the strips show sky over the cornices of the type rows'}}};
}
