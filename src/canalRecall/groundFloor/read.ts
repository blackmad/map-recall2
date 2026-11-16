// The ground-floor photo read (plan Phase 2): one answer per pand from a street-panorama cut of its street wall, the
// pand's two ends marked by thin cyan uprights (scripts/retail-ground/front-photos.ts --whole-wall --outline). Frozen
// schema GF_READ_V1; readers write it, `toGroundFloorPart` turns it into the merge's `photo-read` part.
import { GF_FINISHES, GF_HEADS, GF_OPENING_KINDS, GF_PIER_MATERIALS, GF_PLINTHS, GF_SIGNS, isHex, openingProblems, piersBetween,
  type GfFinish, type GfHead, type GfOpeningKind, type GfPierMaterial, type GfPlinthKind, type GfSignKind, type GroundFloorPart } from './types.js';

export const GF_READ_PROMPT_VERSION = 'gf-read-v1';

/** One reader's answer for one pand. Fractions are of the pand's front between the cyan uprights, left to right. */
export interface GroundFloorRead {
  v: 1;
  pandId: string;
  /** The OSM node the cut was aimed from, when the cut came from the shop list. */
  node?: number;
  image: { ref: string; pano?: string; date?: string };
  reader: string;
  prompt: string;
  /** False: the ground floor between the uprights cannot be read (occluded, wrong wall, too far); nothing else counts. */
  readable: boolean;
  /** How sure the reader is of the whole read, 0..1. */
  conf: number;
  /** `multi`: the pand's wall carries more than one shopfront; the openings still cover the whole span. */
  extent?: 'single' | 'multi';
  openings: Array<{ a0: number; a1: number; sillM: number; headM: number; head: GfHead; kind: GfOpeningKind }>;
  piers?: { material: GfPierMaterial; rusticated?: boolean };
  plinth?: { kind: GfPlinthKind; heightM?: number };
  groundFinish?: { material: GfFinish; hex?: string };
  fascia?: { kind: 'none' | 'band'; heightM?: number; inOpening?: boolean; hex?: string };
  sign?: { kind: GfSignKind; opening?: number; blade?: boolean };
  groundTopM?: number;
  /** Fields read at low confidence (by key: openings, piers, plinth, groundFinish, fascia, sign, groundTopM). */
  low?: string[];
  notes?: string;
}

export const GF_READ_PROMPT = `You read the ground floor of one Amsterdam building from a street-panorama cut. Two thin cyan uprights mark the ends of the
building's street wall (the BAG pand); read only what lies between them, the ground storey (street level up to the first-floor line).
Never describe from memory: only what the photo shows. Give fractions of the width between the uprights, left to right as seen.

Write one JSON object (schema ${GF_READ_PROMPT_VERSION}):
- readable: false when the ground storey between the uprights cannot be seen (vehicle, scaffold, tree, crowd, wrong wall); then stop.
- conf 0..1 for the whole read; extent "multi" when the span holds more than one shopfront.
- openings: every opening in the ground storey, left to right: a0, a1 (fractions), sillM and headM (metres over the pavement; a
  door leaf is about 2.2 m, a storey about 3 m: use them as rulers; headM is the crown of an arched head), head
  (${GF_HEADS.join(' | ')}: segmental = a shallow arc, round = a half circle, basket = a flattened arch) and kind
  (${GF_OPENING_KINDS.join(' | ')}: shop = a shop window, with or without its own door inside; door = a separate street door;
  passage = a gate or archway through the building; blank = a blind recess).
- piers: the solid wall between and beside the openings: material (${GF_PIER_MATERIALS.join(' | ')}), rusticated true when
  the stone is banded or channelled.
- plinth: ${GF_PLINTHS.join(' | ')} with heightM: a distinct base course under the openings (stone band, rusticated base).
- groundFinish: the ground storey's own surface where it differs from the wall above (${GF_FINISHES.join(' | ')}: painted-pui =
  a painted timber or panel shopfront filling the storey) and its colour as #rrggbb from a sunlit part.
- fascia: band = a sign board running across (heightM, hex); inOpening true when the board sits inside an opening, between the
  piers; none when there is no board.
- sign: where the business's name is: wall-letters (letters straight on the wall or stone, no board), board-in-opening (a small
  board or lettered panel inside an opening: give its opening index), fascia (on the fascia board), lightbox (a box or logo panel
  standing proud), none; blade true when a hanging sign projects from the wall.
- groundTopM: the first-floor line over the pavement.
- low: the keys you read at low confidence; notes: anything the fields cannot say (e.g. "consoles on the piers", "canted
  corner"): these become the kit's limits, never the nearest option.`;

const isIn = (list: readonly string[], v: unknown) => typeof v === 'string' && list.includes(v);

/** Problems with a read (empty = valid). */
export function readProblems(a: any): string[] {
  if (!a || typeof a !== 'object') return ['a read is an object'];
  const p: string[] = [];
  if (a.v !== 1 || !/^\d{16}$/.test(a.pandId ?? '') || typeof a.reader !== 'string' || !a.image?.ref || typeof a.prompt !== 'string') p.push('v 1, pandId (16 digits), reader, prompt, image.ref');
  if (typeof a.readable !== 'boolean' || typeof a.conf !== 'number' || a.conf < 0 || a.conf > 1) p.push('readable: boolean, conf 0..1');
  if (!a.readable) return p;
  p.push(...openingProblems(a.openings));
  if (a.piers && !isIn(GF_PIER_MATERIALS, a.piers.material)) p.push(`piers.material: ${GF_PIER_MATERIALS.join('|')}`);
  if (a.plinth && !isIn(GF_PLINTHS, a.plinth.kind)) p.push(`plinth.kind: ${GF_PLINTHS.join('|')}`);
  if (a.groundFinish && (!isIn(GF_FINISHES, a.groundFinish.material) || (a.groundFinish.hex !== undefined && !isHex(a.groundFinish.hex)))) p.push('groundFinish: material, hex?');
  if (a.fascia && !(a.fascia.kind === 'none' || a.fascia.kind === 'band')) p.push('fascia.kind: none|band');
  if (a.sign && (!isIn(GF_SIGNS, a.sign.kind) || (a.sign.opening !== undefined && !(Number.isInteger(a.sign.opening) && a.sign.opening >= 0 && a.sign.opening < (a.openings?.length ?? 0))))) p.push('sign: kind, opening (an index into openings)?');
  if (a.groundTopM !== undefined && !(typeof a.groundTopM === 'number' && a.groundTopM >= 2.2 && a.groundTopM <= 9)) p.push('groundTopM: 2.2..9');
  return p;
}

/** The read as a merge part at source `photo-read`; a field named in `low` keeps half the read's confidence on its own
 *  receipt, by halving the part's confidence only through `lowFields` (merge.ts). Null for an unreadable read. */
export function toGroundFloorPart(a: GroundFloorRead, at: string | null = null): (GroundFloorPart & { lowFields?: string[] }) | null {
  if (!a.readable || readProblems(a).length) return null;
  const openings = a.openings.map(o => ({ a0: o.a0, a1: o.a1, sillM: o.sillM, headM: o.headM, head: o.head, kind: o.kind }));
  return {
    source: 'photo-read', confidence: a.conf, ref: a.image.ref, at,
    openings,
    ...(a.piers ? { piers: piersBetween(openings, a.piers.material, !!a.piers.rusticated) } : {}),
    ...(a.plinth ? { plinth: { kind: a.plinth.kind, heightM: a.plinth.kind === 'none' ? 0 : a.plinth.heightM ?? 0.45 } } : {}),
    ...(a.groundFinish ? { groundFinish: { material: a.groundFinish.material, ...(a.groundFinish.hex ? { hex: a.groundFinish.hex.toLowerCase() } : {}) } } : {}),
    ...(a.fascia ? { fascia: { kind: a.fascia.kind, ...(a.fascia.heightM ? { heightM: a.fascia.heightM } : {}), ...(a.fascia.inOpening ? { inOpening: true } : {}), ...(a.fascia.hex ? { hex: a.fascia.hex.toLowerCase() } : {}) } } : {}),
    ...(a.sign ? { sign: { kind: a.sign.kind, ...(a.sign.opening !== undefined ? { opening: a.sign.opening } : {}), ...(a.sign.blade ? { blade: true } : {}) } } : {}),
    ...(a.groundTopM ? { groundTopM: a.groundTopM } : {}),
    ...(a.low?.length ? { lowFields: a.low } : {}),
  };
}
