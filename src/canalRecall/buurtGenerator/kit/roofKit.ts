/**
 * Buurt generator kit, the roof storey and the erkers (docs/handoffs/buurt-generators-20261115.md, round 2), drawn in
 * the row roof's box frame (roofSink.ts: u along the box from the back to the street end, v across, z up from the
 * series line) through one hook in roofMesh.ts' row mansard. Pure geometry: no flags here; the caller only passes a
 * kit when `buurtKit` is on and the record carries one, so every other roof is drawn as before, byte for byte.
 *
 *  - Pitched: the Plan Zuid eaves-front roof (Biesboschstraat, Scheldestraat, Churchilllaan): red tiles from the
 *    cornice line up at the stated pitch to the 3DBAG rise, the series' dormers and hoist beams on the street slope.
 *    The row mansard draws it with its street band as deep as the pitch asks (`pitchBandM`), joined at the party walls.
 *  - Erkers: the canted or box bay over the upper storeys, from the first floor to just over the cornice, brick between
 *    white-framed lights on every face and storey, a white sill slab under it and a white cap on it. Placed where the
 *    BAG outline has it (frontKit.ts `erkersOf`), never by dice.
 */
import { drawRedLightFront, RED_LIGHT_LOOK, type FrontPanelSink } from '../../groundParts/redLightFront.js';
import type { RoofSink, V3 } from '../../roofSink.js';
import { balconiesOf, cantsValid, entriesOf, erkerRowsOf, kitAtticOf, kitEavesOf, kitPanesOf, raisedOf, KIT_FLAT_RISE_M, type BuurtEntry, type BuurtErker, type KitAttic, type KitBalcony, type KitCant, type KitEaves, type KitWindowFront, windowFrontsOf, type KitPanes, type KitRaised, stairAxisOf, type KitStairAxis, countedOf, type KitCounted } from './frontKit.js';

export interface BuurtRoofKit {
  /** Street slope pitch (degrees): the row mansard's band becomes a pitched roof face. Absent: the stock band. */
  pitchDeg?: number;
  erkers: BuurtErker[];
  /** The first upper floor, below the series line (m, negative), the upper storey pitch (m) and the upper storeys. */
  z0: number; storeyM: number; rows: number;
  /** The erker's cap above the series line (m). */
  capM: number;
  /** The series' tile tone measured from the cached panorama (round 3; threeBuildingFeatures.ts takes it as the roof hex). */
  roofHex?: string;
  /** The series' dormers measured from the photo: width, face height (m) and set-back up the street slope (share of the band). */
  dormer?: { widthM: number; heightM: number; setback: number };
  /** The top storey is a ribbon of attic lights across the front (round 3, Maasstraat): `drawRibbon`. */
  ribbon?: true;
  /** The top storey is the attic band (round 13): `drawAttic`, in place of the ribbon. */
  attic?: KitAttic;
  /** Raised brick parts over the line (round 13): `drawRaised`; `footZ` the pavement under the line (m) for proud ones. */
  raised?: KitRaised[]; footZ?: number;
  /** Joined sides (left/right as seen): the ribbon and the eaves run on through the party wall there. */
  joins?: { left?: boolean; right?: boolean };
  /** What stands at each party wall (round 4, Maasstraat): `pier` a brick pilaster rising to a chimney stack over the
   *  coping, where the block ends and the ribbon breaks; `pair` the block's middle wall, the portiek stair's pair of
   *  lights either side of a white panel. */
  sides?: { left?: KitSide; right?: KitSide };
  /** The series' window rhythm on the upper storeys (round 4): singles on the pier side, half the stair pair on the pair
   *  side, drawn by the kit over a brick plate (`drawRhythm`), in place of the mesher's even cells. */
  rhythm?: true;
  /** Round 19: one narrow stair light per upper storey plus `wide` wide windows (frontKit.ts KitStairAxis, drawStairAxis). */
  stairAxis?: KitStairAxis;
  counted?: KitCounted;
  /** Broad flat eaves with a white soffit and fascia over the street front (round 4, Rooseveltlaan): overhang (m). */
  eaves?: KitEaves;
  /** Erker windows as continuous white bands, corner to corner on every face (round 5, Rooseveltlaan). */
  erkerBands?: true;
  /** Loggias on every upper storey between the erkers (round 5, Rooseveltlaan's west end): `drawLoggias`. */
  loggias?: true;
  /** The street entrances (round 7, a row note): `drawEntries`, from the pand's ground at `groundZ` (m under the line). */
  entries?: BuurtEntry[]; groundZ?: number;
  /** Stacked balconies (round 14): `drawBalconies`. */
  balconies?: KitBalcony[];
  /** Small-paned upper sashes (round 14): `drawPanes`. */
  panes?: KitPanes;
  /** Canted folds (round 15): `drawCants`, from `footZ` (the pavement under the line). */
  cants?: KitCant[];
  /** Ground-storey window fronts (round 16): `drawWindowFronts`, from `footZ`. */
  windowFronts?: KitWindowFront[];
}
export type KitSide = 'pier' | 'pair';

/** The pier at a block's end (Maasstraat 2022-03-23): 1.45 m wide (each member draws its half), 0.12 m proud of the
 *  front, its stack 1.2 m over the series line and 0.7 m into the roof; the ribbon stops 1.6 m short of it. */
export const PIER_LOOK = { halfM: 0.72, outM: 0.12, stackM: 1.2, stackBackM: 0.7, ribbonInsetM: 1.6 } as const;
/** The window rhythm (Maasstraat): singles 2.2 m wide with a centre bar; the stair pair's light 1.3 m wide, 0.45 m off
 *  the middle wall, a white panel between; lights 0.85 m over the floor, at most 1.8 m tall, a transom at 27 %. */
export const RHYTHM_LOOK = { singleM: 2.2, singleGapM: 0.6, pairLightM: 1.3, pairPanelM: 0.45, footM: 0.85, maxHeightM: 1.8, transom: 0.27 } as const;
/** Rooseveltlaan's eaves (2022-03-24, 29.5 px/m): over the series line a white lattice frieze 0.85 m tall (dark openings
 *  0.38 m wide every 0.55 m, each with a white V strut) on a 0.08 m white sill, then the slab: 0.9 m overhang, a 0.4 m
 *  white fascia, the soffit under it. */
export const EAVES_LOOK = { overhangM: 0.9, thickM: 0.4, backM: 0.2, friezeM: 0.85, sillM: 0.08, bayM: 0.55, openM: 0.38, strutM: 0.06, dark: '#2c2a29' } as const;
/** A loggia (Rooseveltlaan west end, 2022-03-24): a brick parapet 1.0 m over the floor, the opening dark to 0.25 m
 *  under the next floor, the window wall behind it 0.3 m into the opening; 0.35 m of brick either side. */
/** The Apollo entrances (Sportstraat 2022-03-22 and Herculesstraat, 30 px/m): a red door 1.1 x 2.3 m in a 0.12 m white
 *  frame; the canopy a white slab 0.8 m deep and 0.18 m thick at 2.8 m; the portiek bay 3.2 m wide and 0.15 m proud, the
 *  stair lights 0.55 x 1.3 m from 0.9 m over each upper floor, its white gable 2.2 m wide and 1.5 m over the eaves with a
 *  dark diamond 0.55 m across. */
export const ENTRY_LOOK = { doorW: 1.1, doorH: 2.3, frameM: 0.12, plateW: 2.0, red: '#7a2420', canopyZ: 2.8, canopyW: 2.6, bayCanopyW: 3.6, canopyD: 0.8, canopyT: 0.18,
  groundShare: 0.71, groundO: 0.12, groundFootM: 0.9, groundHeadM: 0.45, bayW: 3.2, bayGapM: 0.25, minLightM: 0.9, bayO: 0.15, stairW: 0.55, stairH: 1.3, stairFootM: 0.9, gableW: 2.2, gableH: 1.5, gableD: 0.5, diamondM: 0.55, dark: '#2f2b29' } as const;
export const LOGGIA_LOOK = { parapetM: 1.0, headM: 0.25, sideM: 0.35, minM: 1.5, dark: '#2f2b29', backInsetM: 0.3 } as const;
/** The eaves frieze's height on a kit (0 when the eaves have none). */
export const friezeOf = (kit: BuurtRoofKit): number => kit.eaves && kit.eaves.frieze !== false ? EAVES_LOOK.friezeM : 0;
/** The attic band (round 13, lane R; Stadionkade 2025-07-30 at 26 px/m, Europaplein 2025-07-14 at 35 px/m): the top
 *  storey under the eaves slab is a white band 1.3 m tall up to the line (Europaplein about 1.0, Stadionkade about 1.6),
 *  a white sill ledge 0.12 m at its foot, brick under it; in it pairs of small lights 0.32 x 0.6 m with a 0.1 m white
 *  mullion, a pair every 1.6 m, centred in the band, dark glass in a 0.05 m white frame. */
export const ATTIC_LOOK = { heightM: 1.3, sillM: 0.12, lightW: 0.32, lightH: 0.6, mullionM: 0.1, pitchM: 1.6, frameM: 0.05, endM: 0.4, glass: '#3e4a52' } as const;
/** The eaves slab's underside and top over the line (m): the lattice or attic band's top, or with `lid` the coping's top
 *  less the fascia, so the slab caps the coping and nothing shows over it. */
export function eavesSlabOf(kit: BuurtRoofKit): { z0: number; z1: number } {
  const fz = friezeOf(kit), fa = kit.eaves?.fasciaM ?? EAVES_LOOK.thickM;
  const z0 = kit.eaves?.lid ? Math.max(fz, KIT_FLAT_RISE_M + 0.03 - fa) : fz;
  return { z0, z1: z0 + fa };
}
/** The kit plates over the mesher's front: brick at 0.09 m, glass 0.1 m, white frames 0.115 m proud of the wall. */
const PLATE_O = 0.09, GLASS_O = 0.1, FRAME_O = 0.115;

/** The Plan Zuid dormer as the Biesboschstraat photo shows it: a broad white-cheeked box high on the tiles, its hoist beam. */
export const KIT_DORMER = { widthM: 1.6, heightM: 1.45, setback: 0.6 } as const;

/** The attic ribbon (Maasstraat 2022-03-23, 40 px/m): lights 1.1 m tall from 1.0 m over the top floor, about 1.2 m apart. */
export const RIBBON_LOOK = { footM: 1.0, heightM: 1.1, lightM: 1.2, frameM: 0.09, endM: 0.45 } as const;

export const ERKER_LOOK = {
  /** White frames and slabs (the rows' frame white, rowFront.ts ROW_SHOP_FRAME family). */
  white: '#ece9e1',
  /** The lights' glass: the painter's casement glass (bayTextures.ts window glass, mid blue-grey). */
  glass: '#4f5f69',
  frameM: 0.07, sillM: 0.16, capM: 0.32, capOutM: 0.08,
  /** A light's foot above its floor and head under the next floor (m): the series' casement heights. */
  lightFootM: 0.8, lightHeadM: 0.35, sideMarginM: 0.1,
} as const;
/** The white timber bay front (round 12, lane R; Hunzestraat 2025-07-14 at 40 px/m, Kuinderstraat 2025-07-14 at 36 px/m,
 *  Stadionkade 2025-07-30 at 26 px/m): lights from 0.85 m over the floor to 0.3 m under the next, corner to corner on
 *  every face; white posts 0.07 m each side of a corner (0.14 m together), head and sill 0.1 m, a transom at 68 % with
 *  the toplights over it in panes about 0.32 m wide, casements about 0.8 m wide. The glass reads pale (net curtains and
 *  sky), the brick only as the spandrel between storeys; a one-storey oriel stops 0.25 m under the next floor. */
export const TIMBER_LOOK = { footM: 0.85, headM: 0.3, postM: 0.07, railM: 0.1, transom: 0.68, transomM: 0.08, toplightM: 0.32, barM: 0.035, casementM: 0.8, mullionM: 0.08,
  glass: '#9eabb1', apronPanelM: 0.06, partialCapGapM: 0.25 } as const;

/** The row mansard's street band depth for a pitched face: rise over the pitch, leaving a ridge strip behind it. */
export function pitchBandM(riseM: number, depthM: number, pitchDeg: number): number {
  return Math.max(0.3, Math.min(riseM / Math.tan(pitchDeg * Math.PI / 180), depthM / 2 - 0.4));
}

/** A kit carried on a feature's `rowRoof.kit`, validated; null when absent or malformed. */
export function buurtRoofKitOf(v: unknown): BuurtRoofKit | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as Record<string, unknown>;
  if (![k.z0, k.storeyM, k.rows, k.capM].every(x => Number.isFinite(Number(x))) || !(Number(k.storeyM) > 1) || !(Number(k.rows) >= 1)) return null;
  const erkers = (Array.isArray(k.erkers) ? k.erkers : []).filter((e): e is BuurtErker => !!e && typeof e === 'object' && [e.a0, e.a1, e.depthM, e.faceM].every(Number.isFinite) && e.a1 > e.a0 && e.depthM > 0);
  const pitch = Number(k.pitchDeg);
  const hex = typeof k.roofHex === 'string' && /^#[0-9a-f]{6}$/i.test(k.roofHex) ? k.roofHex : null;
  const dm = k.dormer as Record<string, unknown> | undefined;
  const dormer = dm && [dm.widthM, dm.heightM, dm.setback].every(x => Number(x) > 0) ? { widthM: Number(dm.widthM), heightM: Number(dm.heightM), setback: Math.min(0.9, Number(dm.setback)) } : null;
  const j = k.joins as { left?: unknown; right?: unknown } | undefined;
  const joins = j && typeof j === 'object' ? { ...(j.left === true ? { left: true } : {}), ...(j.right === true ? { right: true } : {}) } : {};
  const sd = k.sides as { left?: unknown; right?: unknown } | undefined, side = (x: unknown): KitSide | null => x === 'pier' || x === 'pair' ? x : null;
  const sides = sd && typeof sd === 'object' ? { ...(side(sd.left) ? { left: side(sd.left)! } : {}), ...(side(sd.right) ? { right: side(sd.right)! } : {}) } : {};
  const entries = entriesOf(k.entries), gz = Number(k.groundZ);
  const stair = k.rhythm === true ? null : stairAxisOf(k.stairAxis), counted = k.rhythm === true || stair || erkers.length ? null : countedOf(k.counted), eaves = kitEavesOf(k.eaves), attic = kitAtticOf(k.attic), raised = raisedOf(k.raised), fz = Number(k.footZ), balconies = balconiesOf(k.balconies), panes = kitPanesOf(k.panes), cants = cantsValid(k.cants), windowFronts = windowFrontsOf(k.windowFronts);
  return { ...(pitch > 10 && pitch < 80 ? { pitchDeg: pitch } : {}), ...(hex ? { roofHex: hex } : {}), ...(dormer ? { dormer } : {}), erkers, z0: Number(k.z0), storeyM: Number(k.storeyM), rows: Math.round(Number(k.rows)), capM: Number(k.capM),
    ...(joins.left || joins.right ? { joins } : {}), ...(k.ribbon === true ? { ribbon: true as const } : {}), ...(k.rhythm === true ? { rhythm: true as const } : {}), ...(stair ? { stairAxis: stair } : {}), ...(counted ? { counted } : {}),
    ...(sides.left || sides.right ? { sides } : {}), ...(eaves ? { eaves } : {}), ...(k.erkerBands === true ? { erkerBands: true as const } : {}), ...(k.loggias === true ? { loggias: true as const } : {}),
    ...(entries.length && gz < 0 ? { entries, groundZ: gz } : {}), ...(attic ? { attic } : {}), ...(raised.length && fz < 0 ? { raised, footZ: fz } : {}),
    ...(balconies.length ? { balconies } : {}), ...(panes ? { panes } : {}), ...(cants.length && fz < 0 ? { cants, footZ: fz } : {}), ...(windowFronts.length && fz < 0 ? { windowFronts, footZ: fz } : {}) };
}

/**
 * The erkers on the street end `e` (±1) of a row roof box L deep and W wide. Seen from the street the front runs left
 * to right along e*v, so a span [a0, a1] of the front stands at v = e * (a - 0.5) * W, its face out along e*u.
 */
export function drawErkers(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  // Under broad eaves the erker rises through the frieze to the eaves slab, which caps it (Rooseveltlaan).
  // Round 13: under a lid the erker rises to the slab's soffit (Hunzestraat).
  const Lk = ERKER_LOOK, T = TIMBER_LOOK, z0 = kit.z0, ev = kit.eaves;
  const zLine = !ev ? kit.capM : ev.lid ? eavesSlabOf(kit).z0 : friezeOf(kit);
  // (c, o, z): c across the front left to right as seen, o out from the wall, z up from the series line.
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  const H = (dc: number, doo: number, dz: number): V3 => [e * doo, e * dc, dz];
  for (const k of kit.erkers) {
    // Round 12: a bay over fewer storeys than the series stops under the next floor, with its own white cap.
    // Round 13: under the attic band an erker without its own storeys stops under the attic storey (Europaplein).
    const rows = erkerRowsOf(k, kit.attic && kit.rows > 1 && !k.storeys ? kit.rows - 1 : kit.rows), partial = rows < kit.rows, timber = k.front === 'timber';
    const z1 = partial ? z0 + rows * kit.storeyM - T.partialCapGapM : zLine;
    const c0 = (k.a0 - 0.5) * W, c1 = (k.a1 - 0.5) * W, cm = (c0 + c1) / 2, d = Math.min(k.depthM, 1.2);
    // BAG's span inside its cells: brick over a cell whose window the erker half covers.
    if (k.plates) { const q = frontQuad(s, L, e); for (const [p0, p1] of k.plates) if (p1 - p0 > 0.002) q((p0 - 0.5) * W, (p1 - 0.5) * W, z0, partial ? z1 : 0, PLATE_O, 'plate'); }
    const fw = Math.max(0.6, Math.min(c1 - c0, k.faceM || c1 - c0));
    const canted = fw < c1 - c0 - 0.15;
    // The plan: base left, face left, face right, base right (as seen).
    // Half of a pair across the party wall (the span reaches the front's end): straight and open on that side, the
    // neighbour's half closes it.
    const openL = k.a0 <= 0.005 && !k.corner, openR = k.a1 >= 0.995 && !k.corner;
    const fl = openL ? c0 : canted ? (openR ? c1 - fw : cm - fw / 2) : c0, frr = openR ? c1 : canted ? (openL ? c0 + fw : cm + fw / 2) : c1;
    const plan: Array<[number, number]> = [[c0, 0], [fl, d], [frr, d], [c1, 0]];
    for (let i = 0; i < 3; i++) {
      if ((i === 0 && openL) || (i === 2 && openR)) continue;
      const [pc, po] = plan[i], [qc, qo] = plan[i + 1], sl = Math.hypot(qc - pc, qo - po);
      if (sl < 0.05) continue;
      // Outward (towards the street): the segment turned left as seen, (dc, do) -> (-do, dc).
      const nc = -(qo - po), no = qc - pc, nl = Math.hypot(nc, no), hint = H(nc / nl, no / nl, 0);
      const at = (f: number, out: number, z: number) => P(pc + (qc - pc) * f + nc / nl * out, po + (qo - po) * f + no / nl * out, z);
      // Brick between the lights (the series wall), first floor to cap.
      s.quad(at(0, 0, z0), at(1, 0, z0), at(1, 0, z1), at(0, 0, z1), s.wallUv(0, z0), s.wallUv(sl, z0), s.wallUv(sl, z1), s.wallUv(0, z1), 'plate', hint);
      // Bands (erkerBands): the lights run corner to corner, so the white frames read as one band round the erker.
      if (timber) { timberFace(s, at, hint, sl, kit.storeyM, z0, z1, rows, !!k.apron, i === 0 || (i === 1 && openL), i === 2 || (i === 1 && openR)); continue; }
      const m = kit.erkerBands ? 0 : Math.min(Lk.sideMarginM, sl * 0.12) / sl;
      for (let r = 0; r < kit.rows; r++) {
        const zf = z0 + r * kit.storeyM, za = zf + Lk.lightFootM, zb = Math.min(zf + kit.storeyM - Lk.lightHeadM, z1 - 0.15);
        if (zb - za < 0.6) continue;
        s.quad(at(m, 0.02, za), at(1 - m, 0.02, za), at(1 - m, 0.02, zb), at(m, 0.02, zb), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, Lk.glass);
        // White frame: jambs, head, a toplight transom and the sill, proud of the glass.
        const fr = Lk.frameM / sl, strip = (f0: number, f1: number, zz0: number, zz1: number) => s.quad(at(f0, 0.04, zz0), at(f1, 0.04, zz0), at(f1, 0.04, zz1), at(f0, 0.04, zz1), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, Lk.white);
        strip(m, m + fr, za, zb); strip(1 - m - fr, 1 - m, za, zb);
        strip(m, 1 - m, zb - Lk.frameM, zb); strip(m, 1 - m, za, za + Lk.frameM);
        const zt = za + (zb - za) * 0.72; strip(m, 1 - m, zt - Lk.frameM / 2, zt + Lk.frameM / 2);
        // A casement every ~0.9 m of face (the photo's erkers: three lights on a 2 m face), white mullions between.
        const nl = Math.max(1, Math.round(sl * (1 - 2 * m) / 0.9));
        if (nl > 1) for (let i = 1; i < nl; i++) { const f = m + (1 - 2 * m) * i / nl; strip(f - fr / 2, f + fr / 2, za, zb); }
        else if (sl > 1.1) strip(0.5 - fr / 2, 0.5 + fr / 2, za, zt);
      }
    }
    // The white sill slab under its foot (seen from the pavement) and the white cap over it, both a little proud.
    const out = Lk.capOutM, centre = P(cm, -1, 0);
    const ring = (z: number): V3[] => plan.map(([c, o], i) => P(i === 0 ? c - out : i === 3 ? c + out : c + Math.sign(c - cm) * out, i === 1 || i === 2 ? o + out : o, z));
    const slab = (za: number, zb: number) => {
      const lo = ring(za), hi = ring(zb);
      for (let i = 0; i < 3; i++) {
        const mid: V3 = [(lo[i][0] + lo[i + 1][0]) / 2 - centre[0], (lo[i][1] + lo[i + 1][1]) / 2 - centre[1], 0];
        s.quad(lo[i], lo[i + 1], hi[i + 1], hi[i], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', mid, Lk.white);
      }
      for (let i = 1; i < 3; i++) { s.tri(lo[0], lo[i], lo[i + 1], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, -1], Lk.white); s.tri(hi[0], hi[i], hi[i + 1], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], Lk.white); }
    };
    slab(z0 - Lk.sillM, z0);
    slab(z1, z1 + (ev && !partial ? ev.fasciaM ?? EAVES_LOOK.thickM : Lk.capM));
  }
}

/**
 * One face of a white timber bay (round 12, TIMBER_LOOK) over its brick plate: per storey the pale glass corner to
 * corner, the white posts at its edges (`postL`/`postR`: the face meets another face or the wall there), head, sill, the
 * transom and the toplight bars over it, the casement mullions; `apron` paints the first storey's spandrel white under
 * its lights. `at(f, out, z)` is the face's frame: f along it, out from it.
 */
function timberFace(s: RoofSink, at: (f: number, out: number, z: number) => V3, hint: V3, sl: number, storeyM: number, z0: number, z1: number, rows: number, apron: boolean, postL: boolean, postR: boolean): void {
  const T = TIMBER_LOOK, wh = ERKER_LOOK.white;
  const strip = (f0: number, f1: number, zz0: number, zz1: number, out = 0.04) => s.quad(at(f0, out, zz0), at(f1, out, zz0), at(f1, out, zz1), at(f0, out, zz1), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, wh);
  const pw = T.postM / sl, mw = T.mullionM / sl, bw = T.barM / sl;
  for (let r = 0; r < rows; r++) {
    const zf = z0 + r * storeyM, za = zf + T.footM, zb = Math.min(zf + storeyM - T.headM, z1 - 0.1);
    if (zb - za < 0.6) continue;
    if (apron && r === 0) {
      strip(0, 1, zf, za, 0.03);
      const zm = (zf + za) / 2; strip(0, 1, zm - T.apronPanelM / 2, zm + T.apronPanelM / 2, 0.045);
    }
    s.quad(at(0, 0.02, za), at(1, 0.02, za), at(1, 0.02, zb), at(0, 0.02, zb), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, T.glass);
    // Posts: a full post where the face meets the wall, half of the shared corner post where it meets the next face.
    strip(0, postL ? pw * 1.4 : pw, za, zb); strip(1 - (postR ? pw * 1.4 : pw), 1, za, zb);
    strip(0, 1, zb - T.railM, zb); strip(0, 1, za, za + T.railM);
    // The sill ledge under the lights, proud of the frames.
    strip(0, 1, za - 0.05, za + 0.02, 0.07);
    const zt = za + (zb - za) * T.transom; strip(0, 1, zt - T.transomM / 2, zt + T.transomM / 2);
    // Casements below the transom, the toplights' small panes above it.
    const nc = Math.max(1, Math.round(sl / T.casementM));
    for (let i = 1; i < nc; i++) { const f = i / nc; strip(f - mw / 2, f + mw / 2, za, zb); }
    const np = Math.max(2, Math.round(sl / T.toplightM));
    for (let i = 1; i < np; i++) { const f = i / np; if (nc > 1 && Array.from({ length: nc - 1 }, (_, j) => (j + 1) / nc).some(g => Math.abs(g - f) < mw)) continue; strip(f - bw / 2, f + bw / 2, zt, zb - T.railM); }
  }
}

/** Round 10: an erker's cap stands over the series line only where the roof says so: the Plan Zuid pitched roof's
 *  erkers rise through the cornice into the tiles (Biesboschstraat, round 2). On a flat series the cap's top is the
 *  line itself, so no bay stands over the roof line (David on Hunzestraat 095203/108726, round 9 sheet). */
export const erkerCapOf = (front: { roof?: unknown }): number => front.roof ? ERKER_LOOK.capM : -ERKER_LOOK.capM;

/** The roof kit a member's front kit asks for: its erkers over the upper storeys (the series' ground and storey lines,
 *  rowFront.ts rowGroundM) and the series pitch. `topM` is the series line, `groundM` the ground storey's top. */
export function buurtRoofKitFor(front: { erkers: BuurtErker[]; roof?: { pitchDeg: number; riseM?: number; roofHex?: string; dormers?: false; eavesM?: number; eavesFrieze?: false }; ribbon?: true; attic?: KitAttic; raised?: KitRaised[]; rhythm?: true; stairAxis?: KitStairAxis; counted?: KitCounted; sides?: { left?: KitSide; right?: KitSide }; copingHex?: string; erkerBands?: true; loggias?: true; joins?: { left?: boolean; right?: boolean }; eaves?: KitEaves; entries?: BuurtEntry[]; balconies?: KitBalcony[]; panes?: KitPanes; cants?: KitCant[]; windowFronts?: KitWindowFront[] }, topM: number, storeys: number, groundM: number): BuurtRoofKit | null {
  const rows = Math.max(1, storeys - 1), storeyM = (topM - groundM) / rows;
  if (!(storeyM > 1.5) || !(groundM > 1.5)) return null;
  // The broad eaves: the pitched roof's (round 4), else a flat series' own (round 7).
  const eaves = front.roof?.eavesM ? { overhangM: front.roof.eavesM, ...(front.roof.eavesFrieze === false ? { frieze: false as const } : {}) } : !front.roof && front.eaves ? { ...front.eaves } : null;
  const sided = front.ribbon || front.rhythm || eaves;
  // A dormer on a low (seen) rise keeps inside the slope: its face at most 80 % of the rise (round 8).
  const dh = front.roof?.riseM ? Math.min(KIT_DORMER.heightM, Math.max(0.6, +(front.roof.riseM * 0.8).toFixed(2))) : KIT_DORMER.heightM;
  return { ...(front.roof ? { pitchDeg: front.roof.pitchDeg, ...(front.roof.dormers === false ? {} : { dormer: { ...KIT_DORMER, heightM: dh } }) } : {}), ...(front.roof?.roofHex ? { roofHex: front.roof.roofHex } : !front.roof && front.copingHex ? { roofHex: front.copingHex } : {}),
    erkers: front.erkers, z0: +(groundM - topM).toFixed(3), storeyM: +storeyM.toFixed(3), rows, capM: erkerCapOf(front),
    ...(sided && front.joins ? { joins: { ...front.joins } } : {}), ...(front.ribbon ? { ribbon: true as const } : {}), ...(front.rhythm && !front.erkers.length ? { rhythm: true as const } : {}), ...(front.stairAxis && !front.rhythm && !front.erkers.length ? { stairAxis: { ...front.stairAxis } } : {}), ...(front.counted && !front.stairAxis && !front.rhythm && !front.erkers.length && !front.panes && !front.loggias && !front.windowFronts?.length && !front.cants?.length ? { counted: { ...front.counted } } : {}),
    ...(front.sides && (front.ribbon || front.rhythm) ? { sides: { ...front.sides } } : {}), ...(eaves ? { eaves } : {}),
    ...(front.erkerBands && front.erkers.length ? { erkerBands: true as const } : {}), ...(front.loggias ? { loggias: true as const } : {}),
    ...(front.entries?.length ? { entries: front.entries.map(x => ({ ...x })), groundZ: +(-topM).toFixed(3) } : {}), ...(front.attic ? { attic: { ...front.attic } } : {}),
    ...(front.raised?.length ? { raised: front.raised.map(x => ({ ...x })), footZ: +(-topM).toFixed(3) } : {}),
    ...(front.balconies?.length ? { balconies: front.balconies.map(x => ({ ...x })) } : {}), ...(front.panes ? { panes: { ...front.panes } } : {}),
    ...(front.cants?.length ? { cants: front.cants.map(x => ({ ...x })), footZ: +(-topM).toFixed(3) } : {}),
    ...(front.windowFronts?.length ? { windowFronts: front.windowFronts.map(x => ({ ...x })), footZ: +(-topM).toFixed(3) } : {}) };
}

/** Whether the kit draws anything on the street end (the roof hook runs `drawKitFront` then). */
export const kitDrawsFront = (k: BuurtRoofKit): boolean => !!(k.erkers.length || k.ribbon || k.attic || k.raised?.length || k.rhythm || k.stairAxis || k.counted || k.eaves || k.sides || k.loggias || k.entries?.length || k.balconies?.length || k.panes || k.cants?.length || k.windowFronts?.length);

/** Everything the kit draws on the street end `e` of a row roof box (L deep, W wide), in drawing order. */
export function drawKitFront(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  if (kit.rhythm) drawRhythm(s, kit, L, W, e);
  else if (kit.stairAxis) drawStairAxis(s, kit, L, W, e);
  else if (kit.counted) drawCounted(s, kit, L, W, e);
  else if (kit.panes && !kit.loggias) drawPanes(s, kit, L, W, e);
  if (kit.attic) drawAttic(s, kit, L, W, e);
  else if (kit.ribbon) drawRibbon(s, kit, L, W, e);
  if (kit.sides) drawPiers(s, kit, L, W, e);
  if (kit.loggias) drawLoggias(s, kit, L, W, e);
  if (kit.eaves) drawEaves(s, kit, L, W, e);
  drawErkers(s, kit, L, W, e);
  if (kit.balconies?.length) drawBalconies(s, kit, L, W, e);
  if (kit.entries?.length) drawEntries(s, kit, L, W, e);
  if (kit.raised?.length) drawRaised(s, kit, L, W, e);
  if (kit.cants?.length) drawCants(s, kit, L, W, e);
  if (kit.windowFronts?.length) drawWindowFronts(s, kit, L, W, e);
}

/** How far past the kit's plates a window front stands (m): clear of the mesher's ground sills and door reveals. */
export const WINDOW_FRONT_O = 0.06;
/** The window fronts (round 16, KitWindowFront; De Wallen): groundParts/redLightFront.ts drawn through the front frame,
 *  from the pavement (`footZ`). The kit's sink has no lit faces: the tube and the curtains are flat colours here (the
 *  retail front can draw them lit). */
export function drawWindowFronts(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const q = frontQuad(s, L, e), z0 = kit.footZ ?? kit.z0 - 3, o = PLATE_O + WINDOW_FRONT_O;
  const sink: FrontPanelSink = {
    panel: (a0, a1, oo, z1, z2, hex) => q(a0, a1, z1, z2, oo, 'trim', hex),
    box: (a0, a1, o0, o1, z1, z2, hex) => frontBox(s, L, e, a0, a1, o0, o1, z1, z2, 'trim', hex),
  };
  for (const w of kit.windowFronts ?? []) {
    const c0 = (w.a0 - 0.5) * W, c1 = (w.a1 - 0.5) * W;
    drawRedLightFront(sink, c0, c1, z0, o, w);
    // Brick from the frame's head to the ground storey's top, behind the tube: the photos show wall there, not the
    // shop fascia or the upper ground-floor glass the mesher's ground cell draws (0363100012177991, 178276).
    const head = z0 + (w.headM ?? RED_LIGHT_LOOK.headM) + RED_LIGHT_LOOK.barM;
    if (kit.z0 - head > 0.02) q(c0, c1, head, kit.z0, o - 0.002, 'plate');
  }
}

/** The canted folds (round 15, KitCant; Amstelkade): a brick prism from the pavement (`footZ`) to the line over each,
 *  its cheeks from the wall to the ridge at `ap`, a top on it; a ridge at a party wall the neighbour carries on, unless
 *  the side is free (no join), where a return closes it. */
export function drawCants(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z], z0 = kit.footZ ?? kit.z0 - 3, z1 = -0.02;
  for (const k of kit.cants ?? []) {
    const c0 = (k.a0 - 0.5) * W, cp = (k.ap - 0.5) * W, c1 = (k.a1 - 0.5) * W, o = k.outM, b = PLATE_O - 0.02;
    const face = (ca: number, oa: number, cb: number, ob: number) => {
      const l = Math.hypot(cb - ca, ob - oa);
      if (l < 0.02) return;
      // Its outward hint: the face's normal in the (c, o) plane, towards the street side.
      const nc = -(ob - oa) / l, no = (cb - ca) / l;
      s.quad(P(ca, oa, z0), P(cb, ob, z0), P(cb, ob, z1), P(ca, oa, z1), s.wallUv(0, z0), s.wallUv(l, z0), s.wallUv(l, z1), s.wallUv(0, z1), 'plate', [e * no, e * nc, 0]);
    };
    face(c0, b, cp, o); face(cp, o, c1, b);
    // Round 16: brick over the cells whose window the cant half covers, pavement to the line.
    if (k.plates) { const q = frontQuad(s, L, e); for (const [p0, p1] of k.plates) if (p1 - p0 > 0.002) q((p0 - 0.5) * W, (p1 - 0.5) * W, z0, z1, PLATE_O, 'plate'); }
    const atL = k.ap <= 0.0001, atR = k.ap >= 0.9999;
    if ((atL && !kit.joins?.left) || (atR && !kit.joins?.right)) face(atR ? cp : cp, atR ? o : b, atR ? cp : cp, atR ? b : o);
    s.tri(P(c0, b, z1), P(cp, o, z1), P(c1, b, z1), [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], kit.roofHex ?? '#6b6560');
  }
}


/** A raised part's box behind the wall (m: it reads as a block, not a sheet, over the roof) and its coping. */
export const RAISED_LOOK = { backM: 0.35, copingM: 0.08, copingOutM: 0.04 } as const;
/** The raised brick parts (round 13, KitRaised): a brick box from the line (a proud one from the pavement) to its rise,
 *  reaching back over the roof, and a thin brick coping on it. */
export function drawRaised(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const R = RAISED_LOOK;
  for (const r of kit.raised ?? []) {
    const c0 = (r.a0 - 0.5) * W, c1 = (r.a1 - 0.5) * W, out = r.outM ?? r.faceM ?? 0.01, foot = r.outM ? kit.footZ ?? kit.z0 : -0.05;
    frontBox(s, L, e, c0, c1, -R.backM, out, foot, r.riseM, 'plate');
    frontBox(s, L, e, c0 - R.copingOutM, c1 + R.copingOutM, -R.backM - R.copingOutM, out + R.copingOutM, r.riseM, r.riseM + R.copingM, 'plate');
    if (r.lights) raisedLights(s, kit, L, e, r, c0, c1, out);
  }
}

/** Round 20: a raised part's storeys over the line, `lights` windows each (RAISED_LIGHT_LOOK), on its face. */
export const RAISED_LIGHT_LOOK = { footM: 0.7, maxHeightM: 1.4, headM: 0.5, maxWidthM: 1.3, gapM: 0.45, minRiseM: 1.9 } as const;
function raisedLights(s: RoofSink, kit: BuurtRoofKit, L: number, e: number, r: KitRaised, c0: number, c1: number, out: number): void {
  const P = RAISED_LIGHT_LOOK, n = r.lights!, rows = r.riseM < P.minRiseM ? 0 : Math.max(1, Math.floor((r.riseM - P.headM) / kit.storeyM + 0.25));
  const q = frontQuadAt(s, L, e, out), cw = (c1 - c0) / n, w = Math.min(P.maxWidthM, cw - P.gapM);
  if (w < 0.4) return;
  for (let k = 0; k < rows; k++) {
    const za = k * kit.storeyM + P.footM, zb = Math.min(za + P.maxHeightM, Math.min((k + 1) * kit.storeyM, r.riseM) - P.headM);
    if (zb - za < 0.5) continue;
    for (let i = 0; i < n; i++) { const m = c0 + cw * (i + 0.5); light(q, m - w / 2, m + w / 2, za, zb, w > 1.1); }
  }
}

/** A box in the front frame: c0..c1 across, o0..o1 out from the wall, z0..z1 up; its front, top, bottom and two cheeks. */
function frontBox(s: RoofSink, L: number, e: number, c0: number, c1: number, o0: number, o1: number, z0: number, z1: number, part: 'plate' | 'trim', hex?: string): void {
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  const uv = (a: number, z: number): [number, number] => part === 'plate' ? s.wallUv(a, z) : [0, 0];
  s.quad(P(c0, o1, z0), P(c1, o1, z0), P(c1, o1, z1), P(c0, o1, z1), uv(c0, z0), uv(c1, z0), uv(c1, z1), uv(c0, z1), part, [e, 0, 0], hex);
  s.quad(P(c0, o0, z1), P(c0, o1, z1), P(c1, o1, z1), P(c1, o0, z1), uv(c0, o0), uv(c0, o1), uv(c1, o1), uv(c1, o0), part, [0, 0, 1], hex);
  s.quad(P(c0, o0, z0), P(c1, o0, z0), P(c1, o1, z0), P(c0, o1, z0), uv(c0, o0), uv(c1, o0), uv(c1, o1), uv(c0, o1), part, [0, 0, -1], hex);
  for (const [c, sg] of [[c0, -1], [c1, 1]] as const) s.quad(P(c, o0, z0), P(c, o1, z0), P(c, o1, z1), P(c, o0, z1), uv(o0, z0), uv(o1, z0), uv(o1, z1), uv(o0, z1), part, [0, e * sg, 0], hex);
}

/**
 * The street entrances (round 7, a row note from the photo) on the street end `e`: at each, a brick plate over the
 * mesher's ground opening, the red door in its white frame; a `canopy` over it; a `gable-bay` the portiek bay, a brick
 * strip proud of the wall from the pavement to the line with the stair's narrow lights up it (it hides the cells behind),
 * the door under a wider canopy at its foot and the white gable over the line with its dark diamond.
 */
export function drawEntries(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const E = ENTRY_LOOK, wh = ERKER_LOOK.white, q = frontQuad(s, L, e), gz = kit.groundZ ?? kit.z0 - 3;
  // The ground storey redrawn (the entry states the series' cells): a brick plate over the mesher's ground (its own door
  // goes), then a white-framed window in every cell the entrance leaves free.
  const cells = kit.entries?.find(x => x.cells)?.cells;
  if (cells) {
    const taken = (kit.entries ?? []).map(en => { const h = Math.min(entryHalfM(en), W / 2 - 0.1), c = Math.max(-W / 2 + h, Math.min(W / 2 - h, (en.a - 0.5) * W)); return [c - h, c + h] as const; });
    q(-W / 2, W / 2, gz + 0.05, kit.z0 - 0.05, PLATE_O - 0.004 + E.groundO, 'plate');
    const cw = W / cells, ww = cw * E.groundShare;
    for (let i = 0; i < cells; i++) {
      const c0 = -W / 2 + i * cw + (cw - ww) / 2, c1 = c0 + ww;
      if (taken.some(([a, b]) => c1 > a + 0.05 && c0 < b - 0.05)) continue;
      light(frontQuadAt(s, L, e, E.groundO), c0, c1, gz + E.groundFootM, kit.z0 - E.groundHeadM, ww > 1.1);
    }
  }
  for (const en of kit.entries ?? []) {
    if (en.kind === 'porch' || en.kind === 'portiek' || en.kind === 'arched') { drawEntryKind(s, kit, L, W, e, en, gz); continue; }
    const bay = en.kind === 'gable-bay', half = Math.min(bay ? E.bayW / 2 : E.plateW / 2, W / 2 - 0.1), c = Math.max(-W / 2 + half, Math.min(W / 2 - half, (en.a - 0.5) * W));
    // A door's plate stands proud of the mesher's ground sills (round 8: they showed through it at 0.09 m).
    const o = bay ? E.bayO : E.groundO;
    if (bay) {
      frontBox(s, L, e, c - half, c + half, 0, E.bayO, gz, 0, 'plate');
      // The upper storeys' cell windows the bay half covers (round 8: a sliver showed at either edge): brick over each
      // such window, and the part the bay leaves free redrawn as a light of its own when it is wide enough.
      if (en.cells) {
        const cw = W / en.cells, ww = cw * E.groundShare, b0 = c - half, b1 = c + half;
        for (let i = 0; i < en.cells; i++) {
          const w0 = -W / 2 + i * cw + (cw - ww) / 2, w1 = w0 + ww;
          if (!(w1 > b0 && w0 < b1)) continue;
          q(w0 - 0.06, w1 + 0.06, kit.z0 + 0.05, -0.05, PLATE_O, 'plate');
          for (const [f0, f1] of [[w0, b0 - E.bayGapM], [b1 + E.bayGapM, w1]] as const) if (f1 - f0 >= E.minLightM)
            for (let r = 0; r < kit.rows; r++) { const za = kit.z0 + r * kit.storeyM + RHYTHM_LOOK.footM; light(q, f0, f1, za, Math.min(za + RHYTHM_LOOK.maxHeightM, kit.z0 + (r + 1) * kit.storeyM - 0.5), f1 - f0 > 1.1); }
        }
      }
      const sw = E.stairW / 2;
      for (let r = 0; r < kit.rows; r++) {
        const za = kit.z0 + r * kit.storeyM + E.stairFootM, zb = Math.min(za + E.stairH, kit.z0 + (r + 1) * kit.storeyM - 0.3);
        if (zb - za > 0.5) light(frontQuadAt(s, L, e, o), c - sw, c + sw, za, zb, false);
      }
      // The white gable over the line, its dark diamond.
      const gw = E.gableW / 2;
      frontBox(s, L, e, c - gw, c + gw, o - E.gableD, o + 0.02, -0.05, E.gableH, 'trim', wh);
      frontBox(s, L, e, c - gw - 0.1, c + gw + 0.1, o - E.gableD, o + 0.1, E.gableH, E.gableH + 0.15, 'trim', wh);
      const P = (cc: number, z: number): V3 => [e * (L / 2 + o + 0.04), e * cc, z], d = E.diamondM / 2, zm = E.gableH * 0.55;
      s.quad(P(c, zm - d), P(c + d, zm), P(c, zm + d), P(c - d, zm), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [e, 0, 0], E.dark);
    } else q(c - half, c + half, gz, gz + E.doorH + 0.35, PLATE_O + o, 'plate');
    // The door: its white frame and the red leaf.
    const qd = frontQuadAt(s, L, e, o), dw = E.doorW / 2, f = E.frameM;
    qd(c - dw - f, c + dw + f, gz, gz + E.doorH + f, PLATE_O + 0.005, 'trim', wh);
    qd(c - dw, c + dw, gz, gz + E.doorH, GLASS_O + 0.005, 'trim', E.red);
    if (en.kind !== 'door') { const cw = Math.min((bay ? E.bayCanopyW : E.canopyW) / 2, W / 2); frontBox(s, L, e, c - cw, c + cw, o, o + E.canopyD, gz + E.canopyZ, gz + E.canopyZ + E.canopyT, 'trim', wh); }
  }
}
/** The round 14 entrances (lane R), measured from the photo:
 *  - porch (Gerrit van der Veenstraat 2025-07-14 at 37 px/m): a varnished timber front 4.0 m wide and 2.9 m tall of
 *    glazed leaves about 1 m wide under a 0.45 m toplight band of small panes; stone piers 0.5 m wide and 0.3 m proud
 *    either side; a stone canopy 0.3 m thick and 0.45 m out over the lot, 0.1 m past the piers.
 *  - portiek (Trompenburgstraat 2025-07-14 at 31 px/m): a dark opening 1.6 m wide and 2.6 m tall in brick reveals
 *    0.3 m wide and 0.25 m deep, three pale steps and the door at the back.
 *  - arched (President Kennedylaan at 38 px/m): a round arch 1.8 m across (2.4 m for the double doors there) springing at
 *    2.0 m, its brick ring 0.28 m deep and 0.06 m proud, the dark recess under it, the door 1.0 x 2.2 m in it. */
export const ENTRY_KIND_LOOK = {
  timber: '#7a4a2a', timberDark: '#4a2e1d', glass: '#33302d', stone: '#aaa59b', recess: '#24211e', step: '#8f8a82',
  porch: { widthM: 4.0, heightM: 2.9, pierM: 0.5, pierO: 0.3, canopyT: 0.3, canopyO: 0.45, canopyOverM: 0.1, leafM: 1.0, toplightM: 0.45, paneM: 0.3, stileM: 0.09 },
  portiek: { widthM: 1.6, heightM: 2.6, revealM: 0.3, revealO: 0.25, doorW: 1.0, doorShare: 0.6, headM: 0.4, doorH: 2.2, stepM: 0.17, steps: 3 },
  arched: { widthM: 1.8, springM: 2.0, ringM: 0.28, ringO: 0.06, doorW: 1.0, doorH: 2.2, segs: 12 },
} as const;
/** Half the front an entrance takes (m): its plate over the mesher's ground. */
export function entryHalfM(en: BuurtEntry): number {
  const K = ENTRY_KIND_LOOK;
  if (en.kind === 'porch') return (en.widthM ?? K.porch.widthM) / 2 + K.porch.pierM;
  if (en.kind === 'portiek') return (en.widthM ?? K.portiek.widthM) / 2 + K.portiek.revealM;
  if (en.kind === 'arched') return (en.widthM ?? K.arched.widthM) / 2 + K.arched.ringM;
  return en.kind === 'gable-bay' ? ENTRY_LOOK.bayW / 2 : ENTRY_LOOK.plateW / 2;
}
/** One porch, portiek or arched doorway at `en`, from the pavement `gz`: a brick plate over the mesher's ground there,
 *  then the kind's parts (ENTRY_KIND_LOOK). All on the ground plane `groundO` out, as the round 7 doors. */
function drawEntryKind(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number, en: BuurtEntry, gz: number): void {
  const K = ENTRY_KIND_LOOK, o = ENTRY_LOOK.groundO, half = Math.min(entryHalfM(en), W / 2 - 0.1), c = Math.max(-W / 2 + half, Math.min(W / 2 - half, (en.a - 0.5) * W));
  const q = frontQuadAt(s, L, e, o), base = PLATE_O + o, door = en.doorHex ?? K.timber;
  // Clear of the first upper floor (and its sills) above.
  const top = Math.min(kit.z0 - 0.1, gz + (en.kind === 'porch' ? K.porch.heightM + K.porch.canopyT : en.kind === 'portiek' ? K.portiek.heightM + K.portiek.revealM : K.arched.springM + (en.widthM ?? K.arched.widthM) / 2 + K.arched.ringM) + 0.15);
  q(c - half, c + half, gz, top, PLATE_O, 'plate');
  if (en.kind === 'porch') {
    const P = K.porch, w = Math.min(en.widthM ?? P.widthM, 2 * (half - P.pierM)), h = Math.min(P.heightM, top - gz - P.canopyT), a = c - w / 2, b = c + w / 2;
    q(a, b, gz, gz + h, PLATE_O + 0.004, 'trim', K.timber);
    // The leaves: glass in each over a timber foot, dark stiles between; the toplight band's small panes over them.
    const n = Math.max(1, Math.round(w / P.leafM)), lw = w / n, zt = gz + h - P.toplightM;
    for (let i = 0; i < n; i++) {
      const l0 = a + i * lw, l1 = l0 + lw;
      q(l0 + 0.14, l1 - 0.14, gz + 0.9, zt - 0.14, PLATE_O + 0.008, 'trim', K.glass);
      if (i) q(l0 - P.stileM / 2, l0 + P.stileM / 2, gz, zt, PLATE_O + 0.012, 'trim', K.timberDark);
    }
    q(a, b, zt + 0.07, gz + h - 0.07, PLATE_O + 0.008, 'trim', K.glass);
    q(a, b, zt - 0.04, zt + 0.07, PLATE_O + 0.012, 'trim', K.timber);
    const m = Math.max(2, Math.round(w / P.paneM));
    for (let i = 1; i < m; i++) { const x = a + w * i / m; q(x - 0.025, x + 0.025, zt + 0.07, gz + h - 0.07, PLATE_O + 0.012, 'trim', K.timber); }
    for (const [p0, p1] of [[a - P.pierM, a], [b, b + P.pierM]] as const) frontBox(s, L, e, p0, p1, base - 0.02, base + P.pierO, gz, gz + h, 'trim', K.stone);
    frontBox(s, L, e, a - P.pierM - P.canopyOverM, b + P.pierM + P.canopyOverM, base - 0.02, base + P.canopyO, gz + h, gz + h + P.canopyT, 'trim', K.stone);
  } else if (en.kind === 'portiek') {
    const P = K.portiek, w = Math.min(en.widthM ?? P.widthM, 2 * (half - P.revealM)), h = Math.min(P.heightM, top - gz - P.revealM), a = c - w / 2, b = c + w / 2;
    q(a, b, gz, gz + h, PLATE_O + 0.004, 'trim', K.recess);
    // The door at the back of the stair reads smaller than the opening: at most 60 % of it, on the top step, under a dark head.
    const dw = Math.min(P.doorW, w * P.doorShare) / 2, sh = P.steps * P.stepM;
    q(c - dw, c + dw, gz + sh, gz + Math.min(h - P.headM, sh + P.doorH), PLATE_O + 0.008, 'trim', door);
    for (let i = 0; i < P.steps; i++) q(a, b, gz + i * P.stepM, gz + i * P.stepM + 0.05, PLATE_O + 0.012 + (P.steps - i) * 0.01, 'trim', K.step);
    frontBox(s, L, e, a - P.revealM, a, base - 0.02, base + P.revealO, gz, gz + h + P.revealM, 'plate');
    frontBox(s, L, e, b, b + P.revealM, base - 0.02, base + P.revealO, gz, gz + h + P.revealM, 'plate');
    frontBox(s, L, e, a, b, base - 0.02, base + P.revealO, gz + h, gz + h + P.revealM, 'plate');
  } else {
    const A = K.arched, r = Math.min((en.widthM ?? A.widthM) / 2, half - A.ringM), zs = gz + Math.min(A.springM, top - gz - r - A.ringM);
    // The recess: the jambs' rectangle and the arch above it in vertical strips (the ring covers their steps).
    q(c - r, c + r, gz, zs, PLATE_O + 0.004, 'trim', K.recess);
    const strips = A.segs;
    for (let i = 0; i < strips; i++) {
      const x0 = -r + 2 * r * i / strips, x1 = x0 + 2 * r / strips, xm = Math.min(Math.abs(x0), Math.abs(x1));
      q(c + x0, c + x1, zs - 0.01, zs + Math.sqrt(Math.max(0, r * r - xm * xm)), PLATE_O + 0.004, 'trim', K.recess);
    }
    // The brick ring: one quad per segment between the recess and the ring's outer edge, standing proud.
    const P = (x: number, z: number): V3 => [e * (L / 2 + base + A.ringO), e * x, z], R = r + A.ringM;
    for (let i = 0; i < A.segs; i++) {
      const t0 = Math.PI * (1 - i / A.segs), t1 = Math.PI * (1 - (i + 1) / A.segs);
      const p = [[r, t0], [R, t0], [R, t1], [r, t1]].map(([rr, t]) => P(c + rr * Math.cos(t), zs + rr * Math.sin(t)));
      // Wound as the front quads (left to right, bottom to top as seen) for a front-facing normal on either end.
      s.quad(p[0], p[3], p[2], p[1], s.wallUv(c + r * Math.cos(t0), zs), s.wallUv(c + r * Math.cos(t1), zs), s.wallUv(c + R * Math.cos(t1), zs + 0.2), s.wallUv(c + R * Math.cos(t0), zs + 0.2), 'plate', [e, 0, 0]);
    }
    // The ring's feet down the jambs, and the door in the recess (two leaves on a wide arch).
    for (const [j0, j1] of [[c - R, c - r], [c + r, c + R]] as const) q(j0, j1, gz, zs, PLATE_O + A.ringO, 'plate');
    // The door up to the springing, the arch's head over it dark (the fanlight in shadow), as the photos read.
    const dw = Math.min(r > 1.05 ? 2 * A.doorW : A.doorW, 2 * r - 0.3) / 2, dz = gz + Math.min(A.doorH, zs - gz);
    q(c - dw, c + dw, gz, dz, PLATE_O + 0.008, 'trim', door);
    if (r > 1.05) q(c - 0.04, c + 0.04, gz, dz, PLATE_O + 0.012, 'trim', K.timberDark);
  }
}

/** Stacked balconies (KitBalcony, Trompenburgstraat 2025-07-14 at 31 px/m): per storey a pale slab 0.2 m thick at the
 *  floor, its railing 1.0 m tall of bars every 0.11 m with a top and a foot rail, on its front and both cheeks. */
export const BALCONY_LOOK = { depthM: 1.0, slabM: 0.2, railM: 1.0, barM: 0.025, barGapM: 0.11, railBarM: 0.05, slab: '#c9c4b8', dark: '#262828' } as const;
export function drawBalconies(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const B = BALCONY_LOOK, wh = ERKER_LOOK.white, q = frontQuad(s, L, e), top = kit.rows - (kit.attic || kit.ribbon ? 1 : 0);
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  for (const b of kit.balconies ?? []) {
    const c0 = (b.a0 - 0.5) * W, c1 = (b.a1 - 0.5) * W, d = PLATE_O + (b.depthM ?? B.depthM), hex = b.rail === 'white' || b.rail === 'solid' ? wh : B.dark;
    const r0 = (b.from ?? 1) - 1, r1 = Math.min(kit.rows, b.storeys ? r0 + b.storeys : top);
    for (let r = r0; r < r1; r++) {
      const zf = kit.z0 + r * kit.storeyM, zr = zf + B.railM;
      frontBox(s, L, e, c0, c1, PLATE_O - 0.02, d, zf - B.slabM, zf, 'trim', B.slab);
      if (b.rail === 'solid') { frontBox(s, L, e, c0, c1, d - 0.12, d, zf, zr, 'trim', wh); continue; }
      frontBox(s, L, e, c0, c1, d - B.railBarM, d, zr - B.railBarM, zr, 'trim', hex);
      q(c0, c1, zf + 0.08, zf + 0.08 + B.railBarM, d - B.railBarM / 2, 'trim', hex);
      const n = Math.max(2, Math.round((c1 - c0) / B.barGapM));
      for (let i = 0; i <= n; i++) { const x = c0 + (c1 - c0) * i / n, h = B.barM / 2; q(Math.max(c0, x - h), Math.min(c1, x + h), zf, zr, d - B.railBarM / 2, 'trim', hex); }
      // The cheeks: a top rail and bars back to the wall, either side.
      const m = Math.max(2, Math.round((d - PLATE_O) / B.barGapM));
      for (const [c, sg] of [[c0, -1], [c1, 1]] as const) {
        const hint: V3 = [0, e * sg, 0];
        s.quad(P(c, PLATE_O, zr - B.railBarM), P(c, d, zr - B.railBarM), P(c, d, zr), P(c, PLATE_O, zr), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, hex);
        for (let i = 0; i < m; i++) { const o = PLATE_O + (d - PLATE_O) * i / m, h = B.barM / 2; s.quad(P(c, o - h, zf), P(c, o + h, zf), P(c, o + h, zr), P(c, o - h, zr), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', hint, hex); }
      }
    }
  }
}

/** The small-paned sashes (KitPanes, Gerrit van der Veenstraat 2025-07-14 at 37 px/m): windows 0.9 m over the floor to
 *  0.3 m under the next, a white frame, a pair of casements with a white mullion under the toplight band of small panes. */
export const PANES_LOOK = { footM: 0.9, headM: 0.3, rows: 2, paneM: 0.3, share: 0.42, widthShare: 0.62, barM: 0.035, mullionM: 0.08, overO: 0.045 } as const;
export function drawPanes(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  // The plate and the windows stand `overO` further out than the other kit plates: the mesher's sills reach past 0.09 m
  // (Gerrit van der Veenstraat showed them as white strips through the plate).
  const Pn = PANES_LOOK, p = kit.panes!, wh = ERKER_LOOK.white, f = ERKER_LOOK.frameM, q = frontQuadAt(s, L, e, Pn.overO), rows = kit.rows - (kit.attic || kit.ribbon ? 1 : 0);
  if (rows < 1) return;
  q(-W / 2, W / 2, kit.z0 + 0.05, kit.z0 + rows * kit.storeyM - 0.05, PLATE_O, 'plate');
  const cw = W / p.cells, ww = cw * (p.widthShare ?? Pn.widthShare), share = p.share ?? Pn.share, pr = p.rows ?? Pn.rows, pane = p.paneM ?? Pn.paneM;
  // An erker covers the cells its span (and its brick plates) reach, on the storeys it covers.
  const spans = kit.erkers.map(k => ({ c0: (Math.min(k.a0, ...(k.plates ?? []).map(x => x[0])) - 0.5) * W, c1: (Math.max(k.a1, ...(k.plates ?? []).map(x => x[1])) - 0.5) * W, rows: erkerRowsOf(k, kit.rows) }));
  for (let r = 0; r < rows; r++) {
    const za = kit.z0 + r * kit.storeyM + Pn.footM, zb = kit.z0 + (r + 1) * kit.storeyM - Pn.headM, zt = zb - (zb - za) * share;
    if (zb - za < 0.8) continue;
    for (let i = 0; i < p.cells; i++) {
      const c0 = -W / 2 + i * cw + (cw - ww) / 2, c1 = c0 + ww;
      if (spans.some(k => r < k.rows && c1 > k.c0 - 0.05 && c0 < k.c1 + 0.05)) continue;
      q(c0, c1, za, zb, GLASS_O, 'trim', ERKER_LOOK.glass);
      q(c0, c0 + f, za, zb, FRAME_O, 'trim', wh); q(c1 - f, c1, za, zb, FRAME_O, 'trim', wh);
      q(c0, c1, zb - f, zb, FRAME_O, 'trim', wh); q(c0, c1, za, za + f, FRAME_O, 'trim', wh);
      q(c0, c1, zt - f / 2, zt + f / 2, FRAME_O, 'trim', wh);
      q((c0 + c1) / 2 - Pn.mullionM / 2, (c0 + c1) / 2 + Pn.mullionM / 2, za, zt, FRAME_O, 'trim', wh);
      const n = Math.max(2, Math.round((c1 - c0) / pane));
      for (let j = 1; j < n; j++) { const x = c0 + (c1 - c0) * j / n; q(x - Pn.barM / 2, x + Pn.barM / 2, zt, zb, FRAME_O, 'trim', wh); }
      if (pr === 2) { const zm = (zt + zb) / 2; q(c0, c1, zm - Pn.barM / 2, zm + Pn.barM / 2, FRAME_O, 'trim', wh); }
    }
  }
}
/** frontQuad on a face `o` out from the wall (a proud bay's own plane). */
function frontQuadAt(s: RoofSink, L: number, e: number, o: number) {
  const q = frontQuad(s, L, e);
  return (c0: number, c1: number, z0: number, z1: number, oo: number, part: 'plate' | 'trim', hex?: string) => q(c0, c1, z0, z1, oo + o, part, hex);
}

/** A quad in the front frame (c across left to right as seen, o out from the wall, z up from the series line). */
function frontQuad(s: RoofSink, L: number, e: number) {
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  return (c0: number, c1: number, z0: number, z1: number, o: number, part: 'plate' | 'trim', hex?: string, hint: V3 = [e, 0, 0]) =>
    s.quad(P(c0, o, z0), P(c1, o, z0), P(c1, o, z1), P(c0, o, z1), part === 'plate' ? s.wallUv(c0, z0) : [0, 0], part === 'plate' ? s.wallUv(c1, z0) : [0, 0], part === 'plate' ? s.wallUv(c1, z1) : [0, 0], part === 'plate' ? s.wallUv(c0, z1) : [0, 0], part, hint, hex);
}

/** One white-framed light: glass, jambs, head, sill and a transom; a centre bar when `bar`. */
function light(q: ReturnType<typeof frontQuad>, c0: number, c1: number, za: number, zb: number, bar: boolean): void {
  const f = ERKER_LOOK.frameM, wh = ERKER_LOOK.white, zt = zb - (zb - za) * RHYTHM_LOOK.transom;
  q(c0, c1, za, zb, GLASS_O, 'trim', ERKER_LOOK.glass);
  q(c0, c0 + f, za, zb, FRAME_O, 'trim', wh); q(c1 - f, c1, za, zb, FRAME_O, 'trim', wh);
  q(c0, c1, zb - f, zb, FRAME_O, 'trim', wh); q(c0, c1, za, za + f, FRAME_O, 'trim', wh);
  q(c0, c1, zt - f / 2, zt + f / 2, FRAME_O, 'trim', wh);
  if (bar) q((c0 + c1) / 2 - f / 2, (c0 + c1) / 2 + f / 2, za, zt, FRAME_O, 'trim', wh);
}

/**
 * The series' window rhythm (Maasstraat): a brick plate over the upper storeys under the ribbon hides the mesher's even
 * cells; on it, per storey, the singles spaced over the pier side and, at the `pair` wall, this member's half of the
 * stair pair (one light and half the white panel; the neighbour draws the other half).
 */
export function drawRhythm(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const R = RHYTHM_LOOK, q = frontQuad(s, L, e), rows = kit.rows - (kit.ribbon || kit.attic ? 1 : 0);
  if (rows < 1) return;
  q(-W / 2, W / 2, kit.z0 + 0.05, kit.z0 + rows * kit.storeyM - 0.05, PLATE_O, 'plate');
  const pairL = kit.sides?.left === 'pair', pairR = kit.sides?.right === 'pair', reach = R.pairPanelM + R.pairLightM;
  const a = -W / 2 + (pairL ? reach : 0), b = W / 2 - (pairR ? reach : 0);
  const n = b - a > 1.2 ? Math.max(1, Math.round((b - a) / (R.singleM + R.singleGapM * 2))) : 0, sw = n ? Math.min(R.singleM, (b - a) / n - R.singleGapM) : 0;
  for (let r = 0; r < rows; r++) {
    const za = kit.z0 + r * kit.storeyM + R.footM, zb = za + Math.min(R.maxHeightM, kit.storeyM - 1.2);
    for (let i = 0; i < n; i++) { const c = a + (b - a) * (i + 0.5) / n; light(q, c - sw / 2, c + sw / 2, za, zb, true); }
    for (const [on, sg] of [[pairL, -1], [pairR, 1]] as const) if (on) {
      const wall = sg * W / 2, inner = wall - sg * R.pairPanelM, far = wall - sg * reach;
      light(q, Math.min(inner, far), Math.max(inner, far), za, zb, R.pairLightM > 1.1);
      q(Math.min(wall, inner), Math.max(wall, inner), za, zb, GLASS_O + 0.005, 'trim', ERKER_LOOK.white);
    }
  }
}

/** Round 19 (lane R): the stair light (Plan Zuid portiek blocks, Maasstraat/Alblasstraat panoramas): 0.6 m wide, 0.9 m
 *  tall from 1.2 m over each floor (the landing between the flats' sills and heads); the wide windows at most 2.2 m. */
/** Round 21: the counted windows (KitCounted) over a brick plate on the upper storeys, `n` evenly spaced cells, each light
 *  the measured width (less the cell's gap when the cells are narrower) and the rhythm's height. */
export const COUNTED_LOOK = { minGapM: 0.35 } as const;
export function drawCounted(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const R = RHYTHM_LOOK, k = kit.counted!, q = frontQuad(s, L, e), rows = kit.rows - (kit.ribbon || kit.attic ? 1 : 0);
  if (rows < 1) return;
  const cw = W / k.n, sw = Math.min(k.widthM, cw - COUNTED_LOOK.minGapM);
  if (sw < 0.4) return;
  q(-W / 2, W / 2, kit.z0 + 0.05, kit.z0 + rows * kit.storeyM - 0.05, PLATE_O, 'plate');
  for (let r = 0; r < rows; r++) {
    const za = kit.z0 + r * kit.storeyM + R.footM, zb = za + Math.min(R.maxHeightM, kit.storeyM - 1.2);
    for (let i = 0; i < k.n; i++) { const m = -W / 2 + cw * (i + 0.5); light(q, m - sw / 2, m + sw / 2, za, zb, sw > 1.1); }
  }
}
export const STAIR_LOOK = { lightM: 0.6, heightM: 0.9, footM: 1.2, gapM: 0.5 } as const;
/** One narrow stair light per upper storey at the stated place and the stated wide windows beside it, over a brick
 *  plate (the mesher's even cells hidden, as `drawRhythm`): the wide ones shared between the two sides by length. */
export function drawStairAxis(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const R = RHYTHM_LOOK, S = STAIR_LOOK, st = kit.stairAxis!, q = frontQuad(s, L, e), rows = kit.rows - (kit.ribbon || kit.attic ? 1 : 0);
  if (rows < 1) return;
  q(-W / 2, W / 2, kit.z0 + 0.05, kit.z0 + rows * kit.storeyM - 0.05, PLATE_O, 'plate');
  const c = Math.max(-W / 2 + S.lightM / 2 + 0.1, Math.min(W / 2 - S.lightM / 2 - 0.1, -W / 2 + st.a * W));
  const segs = [[-W / 2, c - S.lightM / 2 - S.gapM], [c + S.lightM / 2 + S.gapM, W / 2]].filter(([a, b]) => b - a > 1);
  const total = segs.reduce((n, [a, b]) => n + b - a, 0);
  const counts = segs.map(([a, b]) => Math.round(st.wide * (b - a) / (total || 1)));
  if (counts.length === 2 && counts[0] + counts[1] !== st.wide) counts[(segs[0][1] - segs[0][0]) / Math.max(1, counts[0]) > (segs[1][1] - segs[1][0]) / Math.max(1, counts[1]) ? 0 : 1] += st.wide - counts[0] - counts[1];
  if (counts.length === 1) counts[0] = st.wide;
  for (let r = 0; r < rows; r++) {
    const za = kit.z0 + r * kit.storeyM + R.footM, zb = za + Math.min(R.maxHeightM, kit.storeyM - 1.2);
    segs.forEach(([a, b], k) => { const n = Math.max(0, counts[k]), sw = n ? Math.min(R.singleM, (b - a) / n - R.singleGapM) : 0;
      for (let i = 0; i < n; i++) { const m = a + (b - a) * (i + 0.5) / n; light(q, m - sw / 2, m + sw / 2, za, zb, sw > 1.1); } });
    const sa = kit.z0 + r * kit.storeyM + S.footM, sb = Math.min(sa + S.heightM, kit.z0 + (r + 1) * kit.storeyM - 0.3);
    if (sb - sa > 0.4) light(q, c - S.lightM / 2, c + S.lightM / 2, sa, sb, false);
  }
}

/** The brick pier at a block's end: a pilaster from the first floor to the line, its stack over the coping. */
export function drawPiers(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const Pl = PIER_LOOK, q = frontQuad(s, L, e), o1 = PLATE_O + Pl.outM;
  for (const sg of [-1, 1] as const) {
    if ((sg < 0 ? kit.sides?.left : kit.sides?.right) !== 'pier') continue;
    const wall = sg * W / 2, inner = wall - sg * Pl.halfM, c0 = Math.min(wall, inner), c1 = Math.max(wall, inner);
    q(c0, c1, kit.z0, Pl.stackM, o1, 'plate');
    // Its inner cheek (towards the member's middle), the full height, and the stack's back and top.
    const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z], hint: V3 = [0, -e * sg, 0];
    s.quad(P(inner, -Pl.stackBackM, 0), P(inner, o1, 0), P(inner, o1, Pl.stackM), P(inner, -Pl.stackBackM, Pl.stackM), s.wallUv(0, 0), s.wallUv(o1 + Pl.stackBackM, 0), s.wallUv(o1 + Pl.stackBackM, Pl.stackM), s.wallUv(0, Pl.stackM), 'plate', hint);
    s.quad(P(inner, 0, kit.z0), P(inner, o1, kit.z0), P(inner, o1, 0), P(inner, 0, 0), s.wallUv(0, kit.z0), s.wallUv(o1, kit.z0), s.wallUv(o1, 0), s.wallUv(0, 0), 'plate', hint);
    q(c0, c1, 0, Pl.stackM, -Pl.stackBackM, 'plate', undefined, [-e, 0, 0]);
    s.quad(P(c0, -Pl.stackBackM, Pl.stackM), P(c1, -Pl.stackBackM, Pl.stackM), P(c1, o1, Pl.stackM), P(c0, o1, Pl.stackM), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], '#6b6560');
  }
}

/**
 * Loggias on the upper storeys (Rooseveltlaan west end): over each run of the front the erkers leave free (less a brick
 * margin), per storey a brick parapet, the dark opening above it and the window wall behind, all over a brick plate that
 * hides the mesher's cells there.
 */
export function drawLoggias(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const G = LOGGIA_LOOK, q = frontQuad(s, L, e);
  const taken = kit.erkers.map(k => [(Math.min(k.a0, ...(k.plates ?? []).map(p => p[0])) - 0.5) * W, (Math.max(k.a1, ...(k.plates ?? []).map(p => p[1])) - 0.5) * W] as const).sort((a, b) => a[0] - b[0]);
  const runs: Array<[number, number]> = [];
  let x = -W / 2;
  for (const [a, b] of taken) { if (a > x) runs.push([x, a]); x = Math.max(x, b); }
  if (x < W / 2) runs.push([x, W / 2]);
  for (const [a0, b0] of runs) {
    const a = a0 + G.sideM, b = b0 - G.sideM;
    if (b - a < G.minM) continue;
    q(a0, b0, kit.z0, 0, PLATE_O, 'plate');
    for (let r = 0; r < kit.rows; r++) {
      const zf = kit.z0 + r * kit.storeyM, za = zf + G.parapetM, zb = zf + kit.storeyM - G.headM;
      q(a, b, za, zb, PLATE_O + 0.005, 'trim', G.dark);
      // The window wall at the back of the loggia, seen through the opening: a band of lights in white frames.
      const n = Math.max(1, Math.round((b - a - 2 * G.backInsetM) / 1.2)), w = (b - a - 2 * G.backInsetM) / n;
      for (let i = 0; i < n; i++) light(q, a + G.backInsetM + i * w + 0.08, a + G.backInsetM + (i + 1) * w - 0.08, za + 0.05, zb - 0.15, false);
      q(a, b, za - 0.06, za, FRAME_O, 'trim', ERKER_LOOK.white);
    }
  }
}

/** Broad flat eaves over the street front: the lattice frieze standing on the series line, then a white slab with its
 *  soffit and fascia, running on through joined walls (each member draws its own width; bays are phased on the wall). */
export function drawEaves(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const E = EAVES_LOOK, ov = kit.eaves!.overhangM, wh = ERKER_LOOK.white, q = frontQuad(s, L, e);
  // The frieze: a white band with dark openings and a V strut in each, on a white sill.
  const fz = friezeOf(kit);
  if (fz) {
  q(-W / 2, W / 2, 0, E.friezeM, PLATE_O, 'trim', wh);
  q(-W / 2, W / 2, -E.sillM / 2, E.sillM, FRAME_O + 0.02, 'trim', wh);
  }
  const n = fz ? Math.max(1, Math.round(W / E.bayM)) : 0, bay = W / Math.max(1, n), za = E.sillM + 0.06, zb = E.friezeM - 0.06;
  for (let i = 0; i < n; i++) {
    const c = -W / 2 + (i + 0.5) * bay, h = Math.min(E.openM, bay - 0.12) / 2;
    q(c - h, c + h, za, zb, GLASS_O, 'trim', E.dark);
    const P = (cc: number, z: number): V3 => [e * (L / 2 + FRAME_O), e * cc, z], t = E.strutM / 2;
    for (const sg of [-1, 1] as const) s.quad(P(c - t, za), P(c + t, za), P(c + sg * h + t, zb), P(c + sg * h - t, zb), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [e, 0, 0], wh);
  }
  const cL = -W / 2 - (kit.joins?.left ? 0 : ov), cR = W / 2 + (kit.joins?.right ? 0 : ov), { z0: zb0, z1: zt } = eavesSlabOf(kit);
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  // A lid: the wall runs up to its soffit in front of the coping (Hunzestraat: brick to the slab, no roof seen).
  if (kit.eaves!.lid && zb0 > fz) q(-W / 2, W / 2, fz - 0.02, zb0, PLATE_O, 'plate');
  s.quad(P(cL, -E.backM, zb0), P(cR, -E.backM, zb0), P(cR, ov, zb0), P(cL, ov, zb0), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, -1], wh);
  s.quad(P(cL, ov, zb0), P(cR, ov, zb0), P(cR, ov, zt), P(cL, ov, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [e, 0, 0], wh);
  s.quad(P(cL, ov, zt), P(cR, ov, zt), P(cR, -E.backM, zt), P(cL, -E.backM, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], wh);
  for (const [c, sg, open] of [[cL, -1, kit.joins?.left], [cR, 1, kit.joins?.right]] as const) if (!open)
    s.quad(P(c, -E.backM, zb0), P(c, ov, zb0), P(c, ov, zt), P(c, -E.backM, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, e * sg, 0], wh);
}

/** The attic band (ATTIC_LOOK) in the top storey: a brick plate over the storey (the mesher's windows go), the white band
 *  from the line down its height with the sill ledge at its foot, and pairs of small lights at the stated pitch, centred
 *  on the member. */
export function drawAttic(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const A = ATTIC_LOOK, wh = ERKER_LOOK.white, q = frontQuad(s, L, e), pitch = kit.attic?.pitchM ?? A.pitchM;
  const h = Math.min(kit.attic?.heightM ?? A.heightM, kit.storeyM - 0.2), zb = -h;
  q(-W / 2, W / 2, -kit.storeyM + 0.05, -0.02, PLATE_O, 'plate');
  q(-W / 2, W / 2, zb, 0, PLATE_O + 0.005, 'trim', wh);
  q(-W / 2, W / 2, zb - A.sillM, zb, FRAME_O + 0.02, 'trim', wh);
  const lh = Math.min(A.lightH, h - 0.3), za = zb + (h - lh) / 2, pw = 2 * A.lightW + A.mullionM;
  const n = Math.max(1, Math.floor((W - 2 * A.endM + pitch - pw) / pitch));
  if (lh < 0.25) return;
  for (let i = 0; i < n; i++) {
    const c = (i - (n - 1) / 2) * pitch, c0 = c - pw / 2, c1 = c + pw / 2;
    q(c0, c1, za, za + lh, GLASS_O + 0.01, 'trim', A.glass);
    const f = A.frameM;
    q(c0, c0 + f, za, za + lh, FRAME_O, 'trim', wh); q(c1 - f, c1, za, za + lh, FRAME_O, 'trim', wh);
    q(c0, c1, za, za + f, FRAME_O, 'trim', wh); q(c0, c1, za + lh - f, za + lh, FRAME_O, 'trim', wh);
    q(c - A.mullionM / 2, c + A.mullionM / 2, za, za + lh, FRAME_O, 'trim', wh);
  }
}

/**
 * The attic ribbon on the street end `e` of a row roof box (L deep, W wide): the top storey's own windows are covered by
 * a brick plate (the series wall) a hair proud of the wall, and on it one white-framed band of lights from party wall to
 * party wall. A joined side runs to the wall's end, so the band reads continuous along the row; a free end stops short.
 */
export function drawRibbon(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const Rl = RIBBON_LOOK, wh = ERKER_LOOK.white, z0 = -kit.storeyM, za = z0 + Rl.footM, zb = za + Rl.heightM;
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  const hint: V3 = [e, 0, 0];
  // A pier side breaks the band (one ribbon per block); a joined side runs on; a free end stops short.
  const endOf = (side: 'left' | 'right') => kit.sides?.[side] === 'pier' ? PIER_LOOK.ribbonInsetM : kit.joins?.[side] ? 0 : Rl.endM;
  const cL = -W / 2 + endOf('left'), cR = W / 2 - endOf('right'), openL = endOf('left') === 0, openR = endOf('right') === 0;
  const q = (c0: number, c1: number, z0q: number, z1q: number, o: number, part: 'plate' | 'trim', hex?: string) =>
    s.quad(P(c0, o, z0q), P(c1, o, z0q), P(c1, o, z1q), P(c0, o, z1q), part === 'plate' ? s.wallUv(c0, z0q) : [0, 0], part === 'plate' ? s.wallUv(c1, z0q) : [0, 0], part === 'plate' ? s.wallUv(c1, z1q) : [0, 0], part === 'plate' ? s.wallUv(c0, z1q) : [0, 0], part, hint, hex);
  q(-W / 2, W / 2, z0 + 0.05, -0.02, 0.09, 'plate');
  if (cR - cL < 0.8) return;
  q(cL, cR, za, zb, 0.1, 'trim', ERKER_LOOK.glass);
  const f = Rl.frameM, n = Math.max(1, Math.round((cR - cL) / Rl.lightM));
  q(cL, cR, za - f, za, 0.115, 'trim', wh); q(cL, cR, zb, zb + f, 0.115, 'trim', wh);
  q(cL, cR, za + (zb - za) * 0.62 - f / 2, za + (zb - za) * 0.62 + f / 2, 0.115, 'trim', wh);
  for (let i = 0; i <= n; i++) {
    const c = cL + (cR - cL) * i / n;
    if ((i === 0 && openL) || (i === n && openR)) continue;
    q(Math.max(cL, c - f / 2), Math.min(cR, c + f / 2), za, zb, 0.115, 'trim', wh);
  }
}
