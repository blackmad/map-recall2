/**
 * Belt review, ground storeys and flat crowns (kit-ground lane, 2026-11-21; Herengracht 2-90 even). The kit drew every
 * solo plot's ground storey as brick with one opening under each upper window axis and the door in one of them, and every
 * flat front with a cornice. The photos say otherwise:
 *
 *   - a white or cream stucco ground storey with pilasters, tall windows and a cornice band under a brick upper front
 *     (Herengracht 2-4, 12; white pilasters and frames on brick, 86);
 *   - ground openings that do not follow the upper bays (70: two tall windows over a street tier with the door, where the
 *     kit drew a door; 2-4: two tall windows and a door under a tall light; 86: two windows and the door to the right);
 *   - a street tier under the ground windows (20, 70): doors and glass at the pavement under a fascia, the tall ground
 *     windows over it;
 *   - a flat projecting eaves canopy (20) and a flat slab on short piers (34) in place of a cornice;
 *   - doors with a pair of leaves, leaded lights, an arched fanlight, a light the opening's height share (doors).
 *
 * The read (`groundFront`, `flatCrown` on a photo read, measured on the crop by eye where no reader states them) is held in
 * shares of the front's width as seen and of the ground storey's height over the pavement, so the drawing keeps the photo's
 * proportions at whatever ground height the storey profile gives. Pure and browser-safe: the renderer
 * (threeBuildingMesh.ts soloGroundBoxes, facadeOrnaments.ts `solo-ground-face`, `solo-ground-tier`, `flat-crown`) draws
 * it. Absent: nothing changes.
 */

const HEX = /^#[0-9a-f]{6}$/i;
const share = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** A ground-storey opening as seen: x as shares of the front's width (left to right), z as shares of the ground storey's
 *  height over the pavement (of the tier's height for a street-tier opening). */
export interface GroundOpening {
  kind: 'door' | 'window';
  x0: number; x1: number; z0: number; z1: number;
  /** A door's pair of leaves (Herengracht 20's glazed double doors, 70's). */
  leaves?: 2;
}
export const DOOR_FANLIGHTS = ['plain', 'leaded', 'arched', 'oval', 'oval-spoked', 'diamond', 'none'] as const;
export type DoorFanlight = (typeof DOOR_FANLIGHTS)[number];
/** The street door's own read: its leaves, the light over it (and the light's share of the opening), its case. */
export interface GroundDoorRead {
  leaves?: 2;
  fanlight?: DoorFanlight;
  /** The light's share of the door opening's height (the transom bar to the head). */
  fanShare?: number;
  /** `pilasters`: a stone or timber case with pilasters and an entablature (Herengracht 10, 58, 64); `frame`: the door's
   *  frame only. Absent: as the read's surround says. */
  case?: 'pilasters' | 'frame';
  top?: 'entablature' | 'pediment' | 'segmental';
  /** The leaf's paint as seen (Herengracht 66's varnished oak); absent: the belt's near-black. */
  leaf?: string;
}
export interface GroundFace {
  /** The facing's paint (a cream or white render). */
  hex: string;
  /** `full`: the whole ground storey faced between the openings; `frames`: wide surrounds round the openings, the brick
   *  between them (86). */
  fill: 'full' | 'frames';
  /** A pilaster on every pier between the openings and at both ends. */
  pilasters?: boolean;
  /** Horizontal rustication joints in the facing (12). */
  rusticated?: boolean;
}
export interface GroundFront {
  /** The ground storey's openings, left to right; absent: one under each upper axis as measured (groundOpenings). */
  openings?: GroundOpening[];
  face?: GroundFace;
  /** A cornice band over the ground storey (the entablature of a pilastered ground, a stone frieze on 70). */
  band?: { hex: string };
  /** A street tier under the ground windows: its top as a share of the ground storey, its facing and fascia paint, its
   *  openings (z as shares of the tier). */
  tier?: { top: number; hex: string; fascia?: string; openings: GroundOpening[] };
  door?: GroundDoorRead;
  /** Who measured it. */
  by?: string;
}

/** A flat crown: a projecting eaves canopy (Herengracht 20) or a flat slab on short piers over a set-back top (34). */
export interface FlatCrown {
  kind: 'canopy' | 'slab-on-piers';
  /** The crown zone's height under the wall top (m): the canopy's fascia and its raked soffit down to the wall, or the
   *  slab and its piers. The storeys stop under it. */
  depthM: number;
  /** The fascia's (slab's) height (m). */
  slabM: number;
  /** Its projection (m). */
  outM: number;
  hex: string;
  /** Slab on piers: the piers' centres as shares of the front, their width (m), the set-back storey's paint seen between. */
  piers?: number[];
  pierW?: number;
  recessHex?: string;
  by?: string;
}

function openingOf(raw: unknown): GroundOpening | null {
  const o = raw as Partial<GroundOpening> | null;
  if (!o || (o.kind !== 'door' && o.kind !== 'window')) return null;
  if (![o.x0, o.x1, o.z0, o.z1].every(share) || !(o.x1! - o.x0! > 0.02) || !(o.z1! - o.z0! > 0.02)) return null;
  return { kind: o.kind, x0: o.x0!, x1: o.x1!, z0: o.z0!, z1: o.z1!, ...(o.leaves === 2 ? { leaves: 2 as const } : {}) };
}
const openingsOf = (raw: unknown): GroundOpening[] => Array.isArray(raw) ? raw.map(openingOf).filter((o): o is GroundOpening => !!o).sort((p, q) => p.x0 - q.x0) : [];

/** A read's ground front, checked: openings with valid shares (sorted left to right), a face and band with a hex, a tier
 *  with a top share; null when nothing valid is left. */
export function groundFrontOf(raw: unknown): GroundFront | null {
  const r = raw as Record<string, any> | null;
  if (!r || typeof r !== 'object') return null;
  const out: GroundFront = {};
  const openings = openingsOf(r.openings);
  if (openings.length) out.openings = openings;
  const f = r.face;
  if (f && typeof f.hex === 'string' && HEX.test(f.hex)) out.face = { hex: f.hex.toLowerCase(), fill: f.fill === 'frames' ? 'frames' : 'full', ...(f.pilasters === true ? { pilasters: true } : {}), ...(f.rusticated === true ? { rusticated: true } : {}) };
  if (r.band && typeof r.band.hex === 'string' && HEX.test(r.band.hex)) out.band = { hex: r.band.hex.toLowerCase() };
  const t = r.tier;
  if (t && share(t.top) && t.top > 0.1 && t.top < 0.7 && typeof t.hex === 'string' && HEX.test(t.hex)) {
    out.tier = { top: t.top, hex: t.hex.toLowerCase(), ...(typeof t.fascia === 'string' && HEX.test(t.fascia) ? { fascia: t.fascia.toLowerCase() } : {}), openings: openingsOf(t.openings) };
    // The ground windows stand over the tier.
    if (out.openings) out.openings = out.openings.filter(o => o.z0 >= t.top - 0.02);
  }
  const d = r.door;
  if (d && typeof d === 'object') {
    const door: GroundDoorRead = {};
    if (d.leaves === 2) door.leaves = 2;
    if ((DOOR_FANLIGHTS as readonly string[]).includes(d.fanlight)) door.fanlight = d.fanlight;
    if (typeof d.fanShare === 'number' && d.fanShare >= 0.1 && d.fanShare <= 0.6) door.fanShare = d.fanShare;
    if (d.case === 'pilasters' || d.case === 'frame') door.case = d.case;
    if (d.top === 'entablature' || d.top === 'pediment' || d.top === 'segmental') door.top = d.top;
    if (typeof d.leaf === 'string' && HEX.test(d.leaf)) door.leaf = d.leaf.toLowerCase();
    if (Object.keys(door).length) out.door = door;
  }
  if (!Object.keys(out).length) return null;
  if (typeof r.by === 'string') out.by = r.by;
  return out;
}

/** A read's flat crown, checked (depths in metres within plausible ranges); null otherwise. */
export function flatCrownOf(raw: unknown): FlatCrown | null {
  const r = raw as Partial<FlatCrown> | null;
  if (!r || (r.kind !== 'canopy' && r.kind !== 'slab-on-piers') || typeof r.hex !== 'string' || !HEX.test(r.hex)) return null;
  const n = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
  if (!n(r.depthM, 0.2, 4) || !n(r.slabM, 0.1, 1.5) || !n(r.outM, 0, 2.5) || r.slabM! > r.depthM!) return null;
  const piers = Array.isArray(r.piers) ? r.piers.filter(share).sort((a, b) => a - b) : [];
  return { kind: r.kind, depthM: r.depthM!, slabM: r.slabM!, outM: r.outM!, hex: r.hex.toLowerCase(),
    ...(r.kind === 'slab-on-piers' && piers.length ? { piers, pierW: n(r.pierW, 0.1, 1.2) ? r.pierW! : 0.3 } : {}),
    ...(typeof r.recessHex === 'string' && HEX.test(r.recessHex) ? { recessHex: r.recessHex.toLowerCase() } : {}),
    ...(typeof r.by === 'string' ? { by: r.by } : {}) };
}

/** A solo ground box (threeBuildingMesh.ts soloGroundBoxes): seen shares across, metres over the base up. `tier-*`: drawn
 *  by the street tier extra, never cut into the ground cell. */
export type SoloGroundBox = { a0: number; a1: number; sillM: number; headM: number; kind: 'door' | 'window' | 'basement' | 'tier-door' | 'tier-window'; leaves?: 2 };

/**
 * The read ground front's boxes on a ground storey `G` metres tall: the openings (a window box widened by the cell unit's
 * margins so the unit's glass lands on the measured opening, as soloGroundBoxes does), then the street tier's openings in
 * the tier's height. Undefined when the read lists no openings.
 */
export function groundFrontBoxes(front: GroundFront, G: number, margin: { l: number; r: number; t: number; b: number } = { l: 0, r: 0, t: 0, b: 0 }): SoloGroundBox[] | undefined {
  if (!front.openings?.length || !(G > 1.5)) return undefined;
  const out: SoloGroundBox[] = [];
  for (const o of front.openings) {
    const sill = o.z0 * G, head = Math.min(G - 0.05, o.z1 * G);
    if (o.kind === 'door') { out.push({ a0: o.x0, a1: o.x1, sillM: +sill.toFixed(3), headM: +head.toFixed(3), kind: 'door', ...(o.leaves ? { leaves: o.leaves } : {}) }); continue; }
    const w = o.x1 - o.x0, h = head - sill;
    out.push({ a0: o.x0 - w * margin.l, a1: o.x1 + w * margin.r, sillM: +Math.max(0.05, sill - h * margin.b).toFixed(3), headM: +Math.min(G - 0.02, head + h * margin.t).toFixed(3), kind: 'window' });
  }
  const t = front.tier;
  if (t) for (const o of t.openings) out.push({ a0: o.x0, a1: o.x1, sillM: +(o.z0 * t.top * G).toFixed(3), headM: +(o.z1 * t.top * G).toFixed(3), kind: o.kind === 'door' ? 'tier-door' : 'tier-window', ...(o.leaves ? { leaves: o.leaves } : {}) });
  return out;
}

/** The pilasters a faced ground storey stands on its piers (m along the front as seen): one centred on every pier between
 *  neighbouring openings (as wide as PILASTER.share of the pier, PILASTER.min-PILASTER.max), and one at each end. */
export const PILASTER = { share: 0.7, min: 0.16, max: 0.5, end: 0.32, out: 0.09, gap: 0.05 } as const;
export function groundPilasters(openings: ReadonlyArray<{ x0: number; x1: number }>, L: number): Array<[number, number]> {
  const spans = [...openings].map(o => [o.x0 * L, o.x1 * L] as const).sort((p, q) => p[0] - q[0]), out: Array<[number, number]> = [];
  const edges: Array<[number, number]> = [[0, spans[0]?.[0] ?? L], ...spans.slice(1).map((s, i) => [spans[i][1], s[0]] as [number, number]), [spans[spans.length - 1]?.[1] ?? 0, L]];
  edges.forEach(([a, b], i) => {
    const pier = b - a - 2 * PILASTER.gap;
    if (pier < PILASTER.min) return;
    const end = i === 0 || i === edges.length - 1;
    const w = Math.min(end ? PILASTER.end : PILASTER.max, Math.max(PILASTER.min, end ? pier : pier * PILASTER.share));
    // An end pilaster stands at the front's edge; a middle one on its pier's centre.
    const c = end ? (i === 0 ? w / 2 : L - w / 2) : (a + b) / 2;
    out.push([+(c - w / 2).toFixed(3), +(c + w / 2).toFixed(3)]);
  });
  return out;
}
