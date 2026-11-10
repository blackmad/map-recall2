/**
 * Hand set v1 (house line lane H5h, #351; docs/house-line.md §4c): photo readings of 80 pands, the truth set for the describe
 * writers (H5), H1c's bay counts and H9's easy houses. A reading is made from archived crops on a metre grid (scripts/house-specs/
 * hand-set/sheets.ts), never from a small strip, and every field carries the image it was read from and a confidence.
 *
 * Conventions (the reader's contract; READING_CONVENTION below is the text both readers were given):
 *  - axes (= HouseSpec `bays`, frontBays): window columns of the upper storeys, the maximum over the storeys above the ground storey.
 *  - storeys (= FrontIntent `storeys`): full storeys from the street-level storey up to the gable foot / cornice line, ground storey
 *    included; a souterrain, an entresol inside the ground storey and windows in the gable, crown or roof are not counted.
 *  - gable: GABLES of buildingRecipe/intent.ts; finish: brick / painted-brick / stucco / stone; wall colour family: WALL_FAMILIES.
 */
import { GABLES, type GableIntent } from '../buildingRecipe/intent.ts';
import { rgbToHsl } from '../blockFace/wallColour.ts';

export const HAND_SET_VERSION = 1 as const;
export const FINISHES = ['brick', 'painted-brick', 'stucco', 'stone'] as const;
export type Finish = (typeof FINISHES)[number];
/** Coarse wall colour of the main upper wall (not trim, not the shopfront). */
export const WALL_FAMILIES = ['white', 'grey', 'buff', 'orange', 'red', 'red-brown', 'brown', 'dark'] as const;
export type WallFamily = (typeof WALL_FAMILIES)[number];
export const PUIS = ['shop', 'residential', 'warehouse'] as const;
export type Pui = (typeof PUIS)[number];
export const CONFIDENCES = ['high', 'med', 'low'] as const;
export type Confidence = (typeof CONFIDENCES)[number];
/** A dark front: the families that read dark on the street (brown and near-black); red-brown brick counts as light. */
export const DARK_FAMILIES: readonly WallFamily[] = ['brown', 'dark'];

/** A field the crop cannot show (crown out of view, top cut, hidden) is `'unknown'`: stated as not visible, never scored. */
export const UNKNOWN = 'unknown' as const;
export type Reading<T> = { value: T | typeof UNKNOWN; confidence: Confidence; /** the panel ref the field was read from */ ref: string; note?: string };
export type HandFields = {
  axes: Reading<number>;
  /** per-storey window columns from storey 2 (index 1) up, only when they differ */
  axesPerStorey?: number[];
  storeys: Reading<number>;
  souterrain?: boolean; entresol?: boolean; atticInCrown?: boolean;
  gable: Reading<GableIntent>;
  /** How many separate crowns of the `gable` type one front carries, when more than one (182857: two step gables over one pand,
   *  ruling H5h round 3). The gable is scored on its type only; a renderer draws `crowns` of them. Absent = one. */
  crowns?: number;
  finish: Reading<Finish>;
  wall: Reading<WallFamily>;
  pui?: Reading<Pui>;
};
/** One house front of a multi-front pand, left to right along the pand's street wall; `share` of the wall's width (the shares sum
 *  to 1). Same readings and the same unknown rule as a pand's fields; it maps to one HouseSpec `design.fronts[]` entry. */
export type HandFront = { share: number } & Omit<HandFields, 'axesPerStorey'>;
export type HandPand = {
  pandId: string;
  group: 'ab07' | 'easy' | 'nassau';
  /** every image the reader had, panel order; sha256 of the file (a strip ref carries its pixel span) */
  images: { ref: string; sha256: string }[];
  readable: boolean;
  /** `multi` when the pand's own street wall (the BAG wall the crop is rectified on) carries more than one house front: the pand is
   *  kept with its readings but left out of every score (a writer reading one front cannot match, and nor can a reader's count). */
  extent: 'single' | 'multi';
  fields: HandFields;
  /** extent multi only: the fronts of the wall, left to right (absent when the fronts cannot be told apart, e.g. under a tree). */
  fronts?: HandFront[];
  notes?: string;
};
/** Gable-only rows (round 3): a crown crop read for the gable type only, by a blind reader, to bring the gable gate to n >= 60. */
export type GableRow = { pandId: string; images: { ref: string; sha256: string }[]; gable: Reading<GableIntent>; crowns?: number; note?: string };
export type GableRowSet = { version: typeof HAND_SET_VERSION; reader: string; date: string; convention: string; rows: GableRow[] };
export type HandSet = { version: typeof HAND_SET_VERSION; reader: string; date: string; convention: string; pands: HandPand[] };

/** The one storey definition of the house line (docs/house-line.md §1 and §4c; H5's writers, H9 and H1c use it). */
export const STOREYS_DEFINITION = 'Full street-facing storeys, counting neither a souterrain nor an attic in the crown.';

export const READING_CONVENTION = `Reading convention, hand set v1 (docs/house-line.md §4c). Read the pand's street front from the sheet: each panel is an archived
rectified crop (x along the wall, y up from the ground) under a metre grid (thin line every metre, heavy every 3 m). Several panels are
other capture years of the same wall: use them to see past trees and vans. Count on the grid, never on a small thumbnail.

axes    Window columns of the upper storeys: vertical lines of openings above the ground storey. Take the storey with the most columns
        (record axesPerStorey from storey 2 up only when storeys differ). One axis per separate opening in the masonry: two lights in
        one opening split by a timber or stone mullion are one axis; two openings with a brick pier between are two. A balcony door
        counts. A projecting bay window (erker) is one axis, however many lights it has. The ground storey (shopfront, doors) is not
        counted.
        A pand whose wall carries two house fronts counts both (all columns of the pand's street wall).
storeys ${STOREYS_DEFINITION}
        How to apply it: count from the street-level storey up to the cornice line or the gable foot (where a gable's outline leaves
        the party walls). The ground storey counts once however tall (shop or bel-etage); an entresol/mezzanine inside it is part of
        it -> entresol: true. A souterrain (half below the pavement, windows at knee height, usually under a stoop) -> souterrain: true.
        Windows inside the gable, crown or roof (dormers, a gable's attic storey, a set-back roof storey) -> atticInCrown: true. A
        bel-etage over a souterrain is storey 1. A full top storey in the front plane under a cornice counts.
gable   The crown: spout (tuit), neck (hals), raised-neck (verhoogde hals), bell (klok), step (trap), point (a triangular or pointed
        gable, punt), cornice (a horizontal moulded cornice/lijst, roof behind, flat or pitched), flat (a plain parapet, no moulding),
        shouldered. unknown when the crown is not in view (top cut off or hidden).
finish  The upper wall: brick (bare brick, any colour), painted-brick (painted, brick coursing still visible), stucco (smooth render,
        plaster, often with incised joints), stone (stone-faced). Ignore the ground storey.
wall    Colour family of the main upper wall (not trim, not shopfront): white (white, cream, very pale), grey, buff (yellow, sand,
        beige), orange (orange, salmon), red, red-brown, brown, dark (near-black, very dark brown or grey).
pui     Ground storey use: shop (shop window, cafe, office glazing), residential (house door and house windows), warehouse (loading doors).
confidence per field: high = clearly visible, one reading; med = partly hidden or one close alternative; low = mostly guessed.
        ref = the panel (A, B, C) you read it from.
unknown A field the crop cannot show is "unknown" (the crown not in view, the top cut off so storeys cannot be counted, the ground
        storey hidden for pui): never guess it at low confidence. unknown is never scored.
extent  multi when the pand's wall carries more than one house front (two or three gables, a row of fronts in one crop); the
        readings are still made but the pand is not scored. single otherwise.
readable false when no panel shows the pand's front (wrong wall, close-up, all hidden); then every value is unknown.`;

const isReading = (r: any, ok: (v: unknown) => boolean) => r && typeof r === 'object' && (r.value === UNKNOWN || ok(r.value)) && (CONFIDENCES as readonly string[]).includes(r.confidence) && typeof r.ref === 'string' && r.ref.length > 0;
const posInt = (max: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;
const inList = (l: readonly string[]) => (v: unknown) => typeof v === 'string' && l.includes(v);

/** Problems with a hand set (empty = valid). */
export function validateHandSet(set: any): string[] {
  const p: string[] = [];
  if (set?.version !== HAND_SET_VERSION) p.push('version must be 1');
  if (typeof set?.reader !== 'string' || !set.reader) p.push('reader required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(set?.date ?? '')) p.push('date YYYY-MM-DD');
  if (!Array.isArray(set?.pands)) return [...p, 'pands must be an array'];
  const seen = new Set<string>();
  for (const h of set.pands) {
    const at = `pand ${h?.pandId}`;
    if (!/^\d{16}$/.test(h?.pandId ?? '')) p.push(`${at}: pandId 16 digits`);
    if (seen.has(h.pandId)) p.push(`${at}: duplicate`); seen.add(h.pandId);
    if (!['ab07', 'easy', 'nassau'].includes(h.group)) p.push(`${at}: group`);
    if (!Array.isArray(h.images) || !h.images.length || h.images.some((i: any) => !/^source-data:\/\//.test(i.ref) || !/^[0-9a-f]{64}$/.test(i.sha256))) p.push(`${at}: images need source-data refs and sha256`);
    if (typeof h.readable !== 'boolean') p.push(`${at}: readable boolean`);
    if (h.extent !== 'single' && h.extent !== 'multi') p.push(`${at}: extent single | multi`);
    const f = h.fields ?? {};
    const checks: [string, (v: unknown) => boolean][] = [['axes', posInt(30)], ['storeys', posInt(12)], ['gable', inList(GABLES)], ['finish', inList(FINISHES)], ['wall', inList(WALL_FAMILIES)]];
    for (const [k, ok] of checks) if (f[k]?.value === null) p.push(`${at}: fields.${k} is null: a field the crop cannot show is "unknown"`); else if (!isReading(f[k], ok)) p.push(`${at}: fields.${k} must be {value, confidence high|med|low, ref}`);
    if (f.pui !== undefined && !isReading(f.pui, inList(PUIS))) p.push(`${at}: fields.pui`);
    if (f.axesPerStorey !== undefined && (!Array.isArray(f.axesPerStorey) || !f.axesPerStorey.every(posInt(30)))) p.push(`${at}: axesPerStorey`);
    if (!h.readable) for (const [k] of checks) if (f[k] && f[k].value !== UNKNOWN) p.push(`${at}: unreadable pand states ${k}`);
    for (const [k] of checks) if (f[k]?.ref && Array.isArray(h.images) && !h.images.some((i: any) => i.ref === f[k].ref)) p.push(`${at}: fields.${k}.ref is not one of the pand's images`);
    if (f.crowns !== undefined && !(posInt(5)(f.crowns) && f.crowns >= 2)) p.push(`${at}: fields.crowns is 2..5 (absent = one crown)`);
    if (h.fronts !== undefined) {
      if (h.extent !== 'multi') p.push(`${at}: fronts only on an extent multi pand`);
      if (!Array.isArray(h.fronts) || h.fronts.length < 2) p.push(`${at}: fronts lists two or more fronts`);
      else {
        h.fronts.forEach((fr: any, n: number) => {
          if (!(typeof fr?.share === 'number' && fr.share > 0 && fr.share <= 1)) p.push(`${at}: fronts[${n}].share 0..1`);
          for (const [k, ok] of checks) if (!isReading(fr?.[k], ok)) p.push(`${at}: fronts[${n}].${k} must be {value, confidence, ref}`); else if (!h.images.some((i: any) => i.ref === fr[k].ref)) p.push(`${at}: fronts[${n}].${k}.ref is not one of the pand's images`);
          if (fr?.pui !== undefined && !isReading(fr.pui, inList(PUIS))) p.push(`${at}: fronts[${n}].pui`);
          if (fr?.crowns !== undefined && !(posInt(5)(fr.crowns) && fr.crowns >= 2)) p.push(`${at}: fronts[${n}].crowns 2..5`);
        });
        const sum = h.fronts.reduce((a: number, fr: any) => a + (fr?.share ?? 0), 0);
        if (Math.abs(sum - 1) > 0.02) p.push(`${at}: fronts shares sum to ${sum.toFixed(2)}, not 1`);
      }
    }
  }
  return p;
}

/** Problems with a gable-only row set (empty = valid). */
export function validateGableRows(set: any): string[] {
  const p: string[] = [];
  if (set?.version !== HAND_SET_VERSION) p.push('version must be 1');
  if (typeof set?.reader !== 'string' || !set.reader) p.push('reader required');
  if (!Array.isArray(set?.rows)) return [...p, 'rows must be an array'];
  const seen = new Set<string>();
  for (const r of set.rows) {
    const at = `row ${r?.pandId}`;
    if (!/^\d{16}$/.test(r?.pandId ?? '')) p.push(`${at}: pandId 16 digits`);
    if (seen.has(r.pandId)) p.push(`${at}: duplicate`); seen.add(r.pandId);
    if (!Array.isArray(r.images) || !r.images.length || r.images.some((i: any) => !/^source-data:\/\//.test(i.ref) || !/^[0-9a-f]{64}$/.test(i.sha256))) p.push(`${at}: images need source-data refs and sha256`);
    if (r.gable?.value === null) p.push(`${at}: gable is null: say "unknown"`);
    else if (!isReading(r.gable, inList(GABLES))) p.push(`${at}: gable must be {value, confidence, ref}`);
    else if (!r.images.some((i: any) => i.ref === r.gable.ref)) p.push(`${at}: gable.ref is not one of the row's images`);
    if (r.crowns !== undefined && !(posInt(5)(r.crowns) && r.crowns >= 2)) p.push(`${at}: crowns 2..5`);
  }
  return p;
}

/** HSL lightness under which a measured wall hex counts as a dark front. 0.38 is the stratification split of select.ts, fixed
 *  before any reading was made. A hex is not mapped to a WALL_FAMILIES word: a mapping fitted on this set would be scored on it
 *  (score.ts prints the median measured colour per read family instead). */
export const HEX_DARK_L = 0.38;
export function hexTone(hex: string, darkL = HEX_DARK_L): 'dark' | 'light' | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return null;
  const n = parseInt(m[1], 16); return rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])[2] < darkL ? 'dark' : 'light';
}
export const toneOf = (f: WallFamily | null) => (f === null ? null : DARK_FAMILIES.includes(f) ? 'dark' : 'light');
