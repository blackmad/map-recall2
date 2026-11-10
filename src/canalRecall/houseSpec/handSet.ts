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

export type Reading<T> = { value: T | null; confidence: Confidence; /** the panel ref the field was read from */ ref: string; note?: string };
export type HandFields = {
  axes: Reading<number>;
  /** per-storey window columns from storey 2 (index 1) up, only when they differ */
  axesPerStorey?: number[];
  storeys: Reading<number>;
  souterrain?: boolean; entresol?: boolean; atticInCrown?: boolean;
  gable: Reading<GableIntent>;
  finish: Reading<Finish>;
  wall: Reading<WallFamily>;
  pui?: Reading<Pui>;
};
export type HandPand = {
  pandId: string;
  group: 'ab07' | 'easy' | 'nassau';
  /** every image the reader had, panel order; sha256 of the file (a strip ref carries its pixel span) */
  images: { ref: string; sha256: string }[];
  readable: boolean;
  fields: HandFields;
  notes?: string;
};
export type HandSet = { version: typeof HAND_SET_VERSION; reader: string; date: string; convention: string; pands: HandPand[] };

export const READING_CONVENTION = `Reading convention, hand set v1 (docs/house-line.md §4c). Read the pand's street front from the sheet: each panel is an archived
rectified crop (x along the wall, y up from the ground) under a metre grid (thin line every metre, heavy every 3 m). Several panels are
other capture years of the same wall: use them to see past trees and vans. Count on the grid, never on a small thumbnail.

axes    Window columns of the upper storeys: vertical lines of openings above the ground storey. Take the storey with the most columns
        (record axesPerStorey from storey 2 up only when storeys differ). One axis per separate opening in the masonry: two lights in
        one opening split by a timber or stone mullion are one axis; two openings with a brick pier between are two. A balcony door
        counts. A projecting bay window (erker) is one axis, however many lights it has. The ground storey (shopfront, doors) is not
        counted.
        A pand whose wall carries two house fronts counts both (all columns of the pand's street wall).
storeys Full storeys from the street-level storey up to the cornice line, or to the gable foot (where a gable's outline leaves the
        party walls). The ground storey counts once however tall (shop or bel-etage). NOT counted: a souterrain (a storey half below the
        pavement, windows at knee height, usually under a stoop) -> souterrain: true; an entresol/mezzanine inside a tall ground storey ->
        entresol: true; windows inside the gable, crown or roof (dormers, a gable's attic storey) -> atticInCrown: true. A bel-etage over
        a souterrain is storey 1. A full top storey in the front plane under a cornice counts.
gable   The crown: spout (tuit), neck (hals), raised-neck (verhoogde hals), bell (klok), step (trap), point (a triangular or pointed
        gable, punt), cornice (a horizontal moulded cornice/lijst, roof behind, flat or pitched), flat (a plain parapet, no moulding),
        shouldered. null when the top is cut off or hidden.
finish  The upper wall: brick (bare brick, any colour), painted-brick (painted, brick coursing still visible), stucco (smooth render,
        plaster, often with incised joints), stone (stone-faced). Ignore the ground storey.
wall    Colour family of the main upper wall (not trim, not shopfront): white (white, cream, very pale), grey, buff (yellow, sand,
        beige), orange (orange, salmon), red, red-brown, brown, dark (near-black, very dark brown or grey).
pui     Ground storey use: shop (shop window, cafe, office glazing), residential (house door and house windows), warehouse (loading doors).
confidence per field: high = clearly visible, one reading; med = partly hidden or one close alternative; low = mostly guessed.
        value null (confidence low) when the field cannot be read. ref = the panel (A, B, C) you read it from.
readable false when no panel shows the pand's front (wrong wall, close-up, all hidden); then every value is null.`;

const isReading = (r: any, ok: (v: unknown) => boolean) => r && typeof r === 'object' && (r.value === null || ok(r.value)) && (CONFIDENCES as readonly string[]).includes(r.confidence) && typeof r.ref === 'string' && r.ref.length > 0;
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
    const f = h.fields ?? {};
    const checks: [string, (v: unknown) => boolean][] = [['axes', posInt(30)], ['storeys', posInt(12)], ['gable', inList(GABLES)], ['finish', inList(FINISHES)], ['wall', inList(WALL_FAMILIES)]];
    for (const [k, ok] of checks) if (!isReading(f[k], ok)) p.push(`${at}: fields.${k} must be {value, confidence high|med|low, ref}`);
    if (f.pui !== undefined && !isReading(f.pui, inList(PUIS))) p.push(`${at}: fields.pui`);
    if (f.axesPerStorey !== undefined && (!Array.isArray(f.axesPerStorey) || !f.axesPerStorey.every(posInt(30)))) p.push(`${at}: axesPerStorey`);
    if (!h.readable) for (const [k] of checks) if (f[k] && f[k].value !== null) p.push(`${at}: unreadable pand states ${k}`);
    for (const [k] of checks) if (f[k]?.ref && Array.isArray(h.images) && !h.images.some((i: any) => i.ref === f[k].ref)) p.push(`${at}: fields.${k}.ref is not one of the pand's images`);
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
