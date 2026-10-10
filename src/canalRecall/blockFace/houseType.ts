/**
 * House types for street surveys (Stage 1 of docs/research/sol-canalhouse-salvage-20261010.md §4.3).
 *
 * A 19th-century row repeats a few house fronts: one upper body, a handful of crowns (dormer, gable, tower), and a
 * ground floor that is a named residential variant (door left/right, stoop) or, on a shop street, a different shop
 * on every house. A `HouseTypeIntent` writes the body ONCE, names its crown, ground and palette variants, and carries
 * the rhythm spec and the strip evidence. A `HousePlacement` on a block-face house picks a type and its variants:
 * crown, ground (named, or a per-house `shopfront`/`groundFront`), palette, mirror, storey count, door bay, visual
 * module span, and several modules per BAG pand (one front per module). Two placements may form a pair module whose
 * crown straddles their party wall (`pair`).
 *
 * Placement resolves to today's `HouseDesign` (blockFace/intent.ts) before anything metric happens, so fitting,
 * compiling, gates, interference, the GLB audit and the review sheet are unchanged; a face without types resolves
 * byte-identically. Stage 2 (content-hash instancing of the resolved slots) is a re-encoding after compile and is not
 * part of this module.
 */
import type {CanalHouseIntent, FrontIntent, GroundFrontIntent, PaletteIntent, ShopfrontIntent} from '../buildingRecipe/intent.ts';
import {frontGrid} from '../buildingRecipe/intent.ts';
import type {HouseDesign, RhythmSpec} from './intent.ts';

/** Everything above the cornice line: a crown variant sets exactly these (and nothing else). */
export const CROWN_KEYS = ['gable', 'crownCap', 'crownCapSpan', 'crownCapRise', 'crownAt', 'crownBays', 'crownRise', 'crownSteps', 'crownFinial',
  'atticWindows', 'atticShape', 'dormers', 'dormerStyle', 'dormerAt', 'gableOrnament', 'roofFront', 'crownGroups', 'tower', 'hoist'] as const;
/** Body fields a crown variant may also set (a gabled variant drops the cornice its cornice variant has). */
export const CROWN_BODY_KEYS = ['cornice'] as const;
/** The ground storey (with souterrain/stoop): a ground variant or a per-house shop sets these. */
export const GROUND_KEYS = ['doorBay', 'basement', 'souterrain', 'tallGround', 'shopfront', 'groundFront', 'shutters'] as const;
/** Keys a type never sets: identity and frontage split come from the face/placement. */
const PLACEMENT_KEYS = ['id', 'street', 'share'] as const;
type CrownKey = typeof CROWN_KEYS[number];
type GroundKey = typeof GROUND_KEYS[number];

/** The upper body: bays, storeys, windows, balconies, bay windows, bands, surrounds, cornice. Written once per type. */
export type BodyIntent = Omit<FrontIntent, CrownKey | GroundKey | typeof PLACEMENT_KEYS[number]>;
/** A crown variant. `pair: true` = the crown straddles the party wall of a pair module; it is authored for the LEFT member. */
export type CrownIntent = Partial<Pick<FrontIntent, CrownKey | typeof CROWN_BODY_KEYS[number]>> & {gable: FrontIntent['gable']; pair?: boolean; note?: string};
/** A named ground variant (residential rows). Shop streets give a per-house shop in the placement instead. */
export type GroundVariant = Partial<Pick<FrontIntent, GroundKey>> & {note?: string};

export interface HouseTypeIntent {
  schemaVersion: 1;
  kind: 'house-type';
  /** Slug, unique on the face, e.g. `nassau-1897-stucco-cornice`. */
  id: string;
  description: string;
  /** Storey counts and BAG frontage widths (m) the type was read on; a placement outside is reported as a deviation. */
  fit?: {widthM?: [number, number]; storeys?: number[]};
  body: BodyIntent;
  /** Named crown variants; at least one. */
  crowns: Record<string, CrownIntent>;
  /** Named ground variants (door left/right, stoop). Optional: a shop street gives every house its own shopfront. */
  grounds?: Record<string, GroundVariant>;
  /** Named palettes (wall, frames, door, stone...); the first is the default. */
  palettes: Record<string, PaletteIntent>;
  roof: CanalHouseIntent['roof'];
  /** Rhythm spec of the type (houses inherit it; a placement overrides single fields, e.g. its citation). */
  rhythm: Partial<RhythmSpec>;
  /** Where the type was read: face, pands (last 6 digits are fine) and what on the strip shows it. */
  evidence: {face: string; pands: string[]; citation: string}[];
  notes?: string[];
}

/** One module of a placement (several house modules in one BAG pand: one front per module, left to right). */
export interface ModulePlacement {
  crown?: string;
  ground?: string | {shopfront: ShopfrontIntent} | {groundFront: GroundFrontIntent};
  mirror?: boolean;
  doorBay?: number | null;
  /** Share of the pand's frontage (default: equal shares). */
  share?: number;
  /** Body fields this module changes (e.g. no balcony stack on the end module). Reported as a type deviation. */
  overrides?: Partial<BodyIntent>;
}

export interface HousePlacement {
  type: string;
  /** Crown variant (default for every module). */
  crown?: string;
  /** Ground: a named variant, or this house's own shop / historic ground front (written as seen, never mirrored). */
  ground?: ModulePlacement['ground'];
  palette?: string;
  /** Left-right mirror of the type as seen from the street (door, balconies, crown placement, dormers, bay widths). */
  mirror?: boolean;
  /** Full storeys incl. ground when this house has one more/less than the type. */
  storeys?: number;
  /** Door bay as seen from the street (after mirroring); `null` = no door. */
  doorBay?: number | null;
  /**
   * Visual house module vs the BAG pand: the window grid spans `{from, to}` of the pand's frontage (fractions from the
   * viewer's left, -0.5..1.5) because the visual party wall (pilaster, downpipe, band joint) is not where BAG puts it.
   * The rest of the front stays plain wall. Needs `evidence` (strip columns).
   */
  visualSpan?: {from: number; to: number; evidence: string};
  /** Several house modules in this pand (one front each, left to right); the fields above are their defaults. */
  modules?: ModulePlacement[];
  /** Pair module: this house is the left or right half of a pair whose crown straddles the party wall. */
  pair?: 'left' | 'right';
  overrides?: Partial<BodyIntent>;
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const flipFrac = (s: {from: number; to: number}) => ({from: +(1 - s.to).toFixed(4), to: +(1 - s.from).toFixed(4)});

/**
 * Left-right mirror of one front as seen from the street. Every side-specific field is flipped; a field that cannot be
 * flipped one-to-one (balconies on storeys with different bay counts) is an error, never a silent copy.
 */
export function mirrorFront(f: FrontIntent): FrontIntent {
  const out: FrontIntent = {...f};
  const bays = Array.isArray(f.bays) ? f.bays : Array(f.storeys).fill(f.bays), grid = frontGrid(f);
  const flipAxis = (a: number) => grid - 1 - a;
  const flipAxes = (s: {from: number; to: number}) => ({from: flipAxis(s.to), to: flipAxis(s.from)});
  const sameCount = (storeys: number[], what: string) => {
    const n = bays[storeys[0]];
    if (storeys.some(s => bays[s] !== n)) throw Error(`${f.id}: cannot mirror ${what} over storeys with different bay counts`);
    return n;
  };
  if (f.doorBay !== null && f.doorBay !== undefined) out.doorBay = bays[0] - 1 - f.doorBay;
  if (f.bayWidths) out.bayWidths = [...f.bayWidths].reverse();
  if (f.storeyBayWidths) out.storeyBayWidths = Object.fromEntries(Object.entries(f.storeyBayWidths).map(([k, v]) => [k, [...v].reverse()]));
  if (f.storeyAxes) out.storeyAxes = Object.fromEntries(Object.entries(f.storeyAxes).map(([k, v]) => [k, v.map(flipAxis).sort((p, q) => p - q)]));
  if (f.crownAt) out.crownAt = flipFrac(f.crownAt);
  if (f.crownBays) out.crownBays = flipAxes(f.crownBays);
  if (f.crownGroups) out.crownGroups = f.crownGroups.map(flipAxes).reverse();
  if (f.tower) out.tower = {...f.tower, bays: flipAxes(f.tower.bays)};
  if (f.dormerAt) out.dormerAt = f.dormerAt.map(flipFrac).reverse();
  if (f.gridAt) out.gridAt = flipFrac(f.gridAt);
  if (f.balconies) { const n = sameCount(f.balconies.storeys, 'balconies'); out.balconies = {...f.balconies, bays: f.balconies.bays.map(b => n - 1 - b).sort((p, q) => p - q)}; }
  if (f.bayWindows) { const n = sameCount(f.bayWindows.storeys, 'bay windows'); out.bayWindows = {...f.bayWindows, bay: n - 1 - f.bayWindows.bay}; }
  if (f.groundFront) out.groundFront = {...f.groundFront, bays: [...f.groundFront.bays].reverse()};
  if (f.shopfront) {
    const sf = f.shopfront;
    if (sf.sign || sf.residentialDoor || sf.bays || sf.awning?.extent || (sf.entrance && /left|right/.test(sf.entrance))) throw Error(`${f.id}: a type ground with lettering or a side-specific shop cannot be mirrored; give the shop per house`);
  }
  if (f.repeat?.mirrorAlternate) throw Error(`${f.id}: repeat.mirrorAlternate inside a mirrored type`);
  return out;
}

const pick = <T extends object>(o: T, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));

/** Problems with a type definition (keys in the right slot, variants present, evidence). */
export function typeProblems(t: HouseTypeIntent): string[] {
  const p: string[] = [], at = `type ${t?.id ?? '?'}`;
  if (t?.kind !== 'house-type' || t.schemaVersion !== 1) p.push(`${at}: kind must be "house-type", schemaVersion 1`);
  if (!/^[a-z0-9-]+$/.test(t?.id ?? '')) p.push(`${at}: id must be a lowercase slug`);
  if (!t?.description) p.push(`${at}: description required`);
  for (const k of Object.keys(t?.body ?? {})) if ((CROWN_KEYS as readonly string[]).includes(k) || (GROUND_KEYS as readonly string[]).includes(k) || (PLACEMENT_KEYS as readonly string[]).includes(k)) p.push(`${at}.body.${k}: belongs in a ${(CROWN_KEYS as readonly string[]).includes(k) ? 'crown' : (GROUND_KEYS as readonly string[]).includes(k) ? 'ground' : 'placement'}`);
  if (!t?.body?.storeys) p.push(`${at}.body: storeys required`);
  const crowns = Object.entries(t?.crowns ?? {});
  if (!crowns.length) p.push(`${at}.crowns: at least one crown variant`);
  for (const [name, c] of crowns) {
    if (!c?.gable) p.push(`${at}.crowns.${name}: gable required`);
    for (const k of Object.keys(c ?? {})) if (![...CROWN_KEYS, ...CROWN_BODY_KEYS, 'pair', 'note'].includes(k)) p.push(`${at}.crowns.${name}.${k}: not a crown field (${[...CROWN_KEYS, ...CROWN_BODY_KEYS].join(', ')})`);
  }
  for (const [name, g] of Object.entries(t?.grounds ?? {})) for (const k of Object.keys(g ?? {})) if (!(GROUND_KEYS as readonly string[]).includes(k) && k !== 'note') p.push(`${at}.grounds.${name}.${k}: not a ground field (${GROUND_KEYS.join(', ')})`);
  if (!Object.keys(t?.palettes ?? {}).length) p.push(`${at}.palettes: at least one palette`);
  if (!t?.roof?.material) p.push(`${at}.roof.material required`);
  if (!t?.evidence?.length || t.evidence.some(e => !e.citation || !e.pands?.length)) p.push(`${at}.evidence: face, pands and a strip citation per entry`);
  if (t?.fit?.widthM && !(t.fit.widthM[0] > 0 && t.fit.widthM[1] >= t.fit.widthM[0])) p.push(`${at}.fit.widthM: [min, max]`);
  return p;
}

export interface ResolvedPlacement { design: HouseDesign; rhythm: Partial<RhythmSpec>; deviations: string[] }

/**
 * Resolve one placement to a house design. `street` is the face street; `widthM` (optional) the BAG frontage width for
 * the fit-range check. Throws on unknown variants; returns type deviations (overrides, out-of-range widths/storeys).
 */
export function resolvePlacement(t: HouseTypeIntent, place: HousePlacement, street: string, widthM?: number): ResolvedPlacement {
  const deviations: string[] = [];
  const modules: ModulePlacement[] = place.modules?.length ? place.modules : [{}];
  const fronts = modules.map((m, k): FrontIntent => {
    const crownName = m.crown ?? place.crown ?? Object.keys(t.crowns)[0];
    const crown = t.crowns[crownName];
    if (!crown) throw Error(`type ${t.id}: no crown variant "${crownName}" (has ${Object.keys(t.crowns).join(', ')})`);
    if (crown.pair && !place.pair) throw Error(`type ${t.id}: crown "${crownName}" straddles a party wall; the placement must be one half of a pair`);
    const groundRef = m.ground ?? place.ground;
    let ground: Partial<FrontIntent> = {}, perHouse: Partial<FrontIntent> = {};
    if (typeof groundRef === 'string') {
      const g = t.grounds?.[groundRef];
      if (!g) throw Error(`type ${t.id}: no ground variant "${groundRef}" (has ${Object.keys(t.grounds ?? {}).join(', ') || 'none'})`);
      ground = pick(g, GROUND_KEYS);
    } else if (groundRef) perHouse = groundRef;
    else if (t.grounds && Object.keys(t.grounds).length) ground = pick(Object.values(t.grounds)[0], GROUND_KEYS);
    const overrides = {...(place.overrides ?? {}), ...(m.overrides ?? {})};
    for (const key of Object.keys(overrides)) {
      if ((CROWN_KEYS as readonly string[]).includes(key) || (GROUND_KEYS as readonly string[]).includes(key)) throw Error(`type ${t.id}: override ${key} is a crown/ground field; add a variant instead`);
      const was = (t.body as Record<string, unknown>)[key], now = (overrides as Record<string, unknown>)[key];
      if (JSON.stringify(was) !== JSON.stringify(now)) deviations.push(`${modules.length > 1 ? `module ${k}: ` : ''}${key} ${JSON.stringify(now)} (type: ${JSON.stringify(was) ?? 'unset'})`);
    }
    // Type order: body, crown, type ground; then the house: storeys, overrides; then mirror; then as-seen fields.
    let f: FrontIntent = {id: modules.length > 1 ? `m${k}` : 'front0', street, ...(modules.length > 1 ? {share: m.share ?? +(1 / modules.length).toFixed(4)} : {}),
      ...(t.body as Omit<FrontIntent, 'id' | 'street' | 'gable' | 'doorBay' | 'basement'>), ...pick(crown, [...CROWN_KEYS, ...CROWN_BODY_KEYS]), ...ground} as FrontIntent;
    if (!has(f, 'doorBay')) f.doorBay = null;
    if (!has(f, 'basement')) f.basement = 'none';
    if (!has(f, 'hoist')) f.hoist = false;
    if (place.storeys !== undefined) { f.storeys = place.storeys; if (place.storeys !== t.body.storeys) deviations.push(`storeys ${place.storeys} (type: ${t.body.storeys})`); }
    f = {...f, ...overrides} as FrontIntent;
    if (m.mirror ?? place.mirror) f = mirrorFront(f);
    // The visual module is read off the strip as seen, so it is applied after mirroring.
    if (place.visualSpan) f.gridAt = {from: place.visualSpan.from, to: place.visualSpan.to};
    // As-seen fields (never mirrored): the house's own shop/ground front and an explicit door bay.
    if (perHouse && Object.keys(perHouse).length) { if ('shopfront' in perHouse) delete f.groundFront; if ('groundFront' in perHouse) { delete f.shopfront; f.basement = 'none'; } f = {...f, ...perHouse}; }
    const door = m.doorBay !== undefined ? m.doorBay : place.doorBay;
    if (door !== undefined) f.doorBay = door;
    return f;
  });
  const paletteName = place.palette ?? Object.keys(t.palettes)[0], palette = t.palettes[paletteName];
  if (!palette) throw Error(`type ${t.id}: no palette "${paletteName}" (has ${Object.keys(t.palettes).join(', ')})`);
  const storeys = place.storeys ?? t.body.storeys;
  if (t.fit?.storeys && !t.fit.storeys.includes(storeys)) deviations.push(`storeys ${storeys} outside the type's ${t.fit.storeys.join('/')}`);
  const perModule = widthM !== undefined ? widthM / modules.length : undefined;
  if (t.fit?.widthM && perModule !== undefined && (perModule < t.fit.widthM[0] - 0.25 || perModule > t.fit.widthM[1] + 0.25)) deviations.push(`module width ${perModule.toFixed(2)} m outside the type's ${t.fit.widthM.join('-')} m`);
  const tag = `type ${t.id}${modules.length > 1 ? ` x${modules.length} modules` : ''}: crown ${modules.map(m => m.crown ?? place.crown ?? Object.keys(t.crowns)[0]).join('/')}` +
    `${modules.some(m => (m.mirror ?? place.mirror)) ? ', mirrored' : ''}${place.pair ? `, pair ${place.pair}` : ''}, palette ${paletteName}`;
  return {design: {fronts, roof: t.roof, palette, notes: [tag, ...(deviations.length ? [`type deviations: ${deviations.join('; ')}`] : [])]}, rhythm: t.rhythm, deviations};
}

/** Problems with the placements of a face: unknown types, pairs that do not pair, visual spans without evidence. */
export function placementProblems(types: Map<string, HouseTypeIntent>, houses: {pandId: string; type?: HousePlacement}[]): string[] {
  const p: string[] = [];
  houses.forEach((h, i) => {
    const pl = h.type, at = `house ${h.pandId.slice(-6)}.type`;
    if (!pl) return;
    const t = types.get(pl.type);
    if (!t) { p.push(`${at}: unknown type ${pl.type}`); return; }
    if (pl.visualSpan) {
      const s = pl.visualSpan;
      if (!(s.from >= -0.5 && s.to <= 1.5 && s.to - s.from >= 0.5)) p.push(`${at}.visualSpan: {from, to} fractions of the frontage, -0.5 <= from, to <= 1.5, at least 0.5 wide`);
      if (!s.evidence) p.push(`${at}.visualSpan: needs evidence (strip columns of the visual party walls)`);
    }
    if (pl.modules && pl.modules.length < 2) p.push(`${at}.modules: two or more modules (one module is the placement itself)`);
    if (pl.modules && pl.visualSpan) p.push(`${at}: visualSpan and modules are alternatives`);
    const shares = pl.modules?.filter(m => m.share !== undefined).map(m => m.share!) ?? [];
    if (shares.length && (shares.length !== pl.modules!.length || Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 0.01)) p.push(`${at}.modules: give every module a share (summing to 1) or none`);
    if (pl.pair) {
      const j = pl.pair === 'left' ? i + 1 : i - 1, other = houses[j]?.type;
      if (!other || other.pair !== (pl.pair === 'left' ? 'right' : 'left')) p.push(`${at}.pair: the ${pl.pair === 'left' ? 'next' : 'previous'} house must be the ${pl.pair === 'left' ? 'right' : 'left'} half`);
      else {
        if (other.type !== pl.type || (other.crown ?? '') !== (pl.crown ?? '')) p.push(`${at}.pair: both halves use the same type and crown`);
        if (!!other.mirror === !!pl.mirror) p.push(`${at}.pair: the right half is the mirror of the left (exactly one of the two is mirrored)`);
      }
      const crown = t.crowns[pl.crown ?? Object.keys(t.crowns)[0]];
      if (crown && !crown.pair) p.push(`${at}.pair: crown ${pl.crown} is not a pair crown (crowns.${pl.crown}.pair)`);
      if (pl.pair === 'left' && pl.mirror) p.push(`${at}.pair: a pair crown is authored for the left half; mirror the right half`);
    }
  });
  return p;
}
