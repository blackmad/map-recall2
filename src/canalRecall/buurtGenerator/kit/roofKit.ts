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
import type { RoofSink, V3 } from '../../roofSink.js';
import { entriesOf, type BuurtEntry, type BuurtErker } from './frontKit.js';

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
  /** Joined sides (left/right as seen): the ribbon and the eaves run on through the party wall there. */
  joins?: { left?: boolean; right?: boolean };
  /** What stands at each party wall (round 4, Maasstraat): `pier` a brick pilaster rising to a chimney stack over the
   *  coping, where the block ends and the ribbon breaks; `pair` the block's middle wall, the portiek stair's pair of
   *  lights either side of a white panel. */
  sides?: { left?: KitSide; right?: KitSide };
  /** The series' window rhythm on the upper storeys (round 4): singles on the pier side, half the stair pair on the pair
   *  side, drawn by the kit over a brick plate (`drawRhythm`), in place of the mesher's even cells. */
  rhythm?: true;
  /** Broad flat eaves with a white soffit and fascia over the street front (round 4, Rooseveltlaan): overhang (m). */
  eaves?: { overhangM: number; /** false: no lattice frieze, the slab sits on the line. */ frieze?: false };
  /** Erker windows as continuous white bands, corner to corner on every face (round 5, Rooseveltlaan). */
  erkerBands?: true;
  /** Loggias on every upper storey between the erkers (round 5, Rooseveltlaan's west end): `drawLoggias`. */
  loggias?: true;
  /** The street entrances (round 7, a row note): `drawEntries`, from the pand's ground at `groundZ` (m under the line). */
  entries?: BuurtEntry[]; groundZ?: number;
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
  const ev = k.eaves as { overhangM?: unknown; frieze?: unknown } | undefined, eaves = ev && Number(ev.overhangM) > 0.2 && Number(ev.overhangM) < 2 ? { overhangM: Number(ev.overhangM), ...(ev.frieze === false ? { frieze: false as const } : {}) } : null;
  return { ...(pitch > 10 && pitch < 80 ? { pitchDeg: pitch } : {}), ...(hex ? { roofHex: hex } : {}), ...(dormer ? { dormer } : {}), erkers, z0: Number(k.z0), storeyM: Number(k.storeyM), rows: Math.round(Number(k.rows)), capM: Number(k.capM),
    ...(joins.left || joins.right ? { joins } : {}), ...(k.ribbon === true ? { ribbon: true as const } : {}), ...(k.rhythm === true ? { rhythm: true as const } : {}),
    ...(sides.left || sides.right ? { sides } : {}), ...(eaves ? { eaves } : {}), ...(k.erkerBands === true ? { erkerBands: true as const } : {}), ...(k.loggias === true ? { loggias: true as const } : {}),
    ...(entries.length && gz < 0 ? { entries, groundZ: gz } : {}) };
}

/**
 * The erkers on the street end `e` (±1) of a row roof box L deep and W wide. Seen from the street the front runs left
 * to right along e*v, so a span [a0, a1] of the front stands at v = e * (a - 0.5) * W, its face out along e*u.
 */
export function drawErkers(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  // Under broad eaves the erker rises through the frieze to the eaves slab, which caps it (Rooseveltlaan).
  const Lk = ERKER_LOOK, z0 = kit.z0, z1 = kit.eaves ? friezeOf(kit) : kit.capM;
  // (c, o, z): c across the front left to right as seen, o out from the wall, z up from the series line.
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  const H = (dc: number, doo: number, dz: number): V3 => [e * doo, e * dc, dz];
  for (const k of kit.erkers) {
    const c0 = (k.a0 - 0.5) * W, c1 = (k.a1 - 0.5) * W, cm = (c0 + c1) / 2, d = Math.min(k.depthM, 1.2);
    // BAG's span inside its cells: brick over a cell whose window the erker half covers.
    if (k.plates) { const q = frontQuad(s, L, e); for (const [p0, p1] of k.plates) if (p1 - p0 > 0.002) q((p0 - 0.5) * W, (p1 - 0.5) * W, z0, 0, PLATE_O, 'plate'); }
    const fw = Math.max(0.6, Math.min(c1 - c0, k.faceM || c1 - c0));
    const canted = fw < c1 - c0 - 0.15;
    // The plan: base left, face left, face right, base right (as seen).
    // Half of a pair across the party wall (the span reaches the front's end): straight and open on that side, the
    // neighbour's half closes it.
    const openL = k.a0 <= 0.005, openR = k.a1 >= 0.995;
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
    slab(z1, z1 + (kit.eaves ? EAVES_LOOK.thickM : Lk.capM));
  }
}

/** Round 10: an erker's cap stands over the series line only where the roof says so: the Plan Zuid pitched roof's
 *  erkers rise through the cornice into the tiles (Biesboschstraat, round 2). On a flat series the cap's top is the
 *  line itself, so no bay stands over the roof line (David on Hunzestraat 095203/108726, round 9 sheet). */
export const erkerCapOf = (front: { roof?: unknown }): number => front.roof ? ERKER_LOOK.capM : -ERKER_LOOK.capM;

/** The roof kit a member's front kit asks for: its erkers over the upper storeys (the series' ground and storey lines,
 *  rowFront.ts rowGroundM) and the series pitch. `topM` is the series line, `groundM` the ground storey's top. */
export function buurtRoofKitFor(front: { erkers: BuurtErker[]; roof?: { pitchDeg: number; riseM?: number; roofHex?: string; dormers?: false; eavesM?: number; eavesFrieze?: false }; ribbon?: true; rhythm?: true; sides?: { left?: KitSide; right?: KitSide }; copingHex?: string; erkerBands?: true; loggias?: true; joins?: { left?: boolean; right?: boolean }; eaves?: { overhangM: number; frieze?: false }; entries?: BuurtEntry[] }, topM: number, storeys: number, groundM: number): BuurtRoofKit | null {
  const rows = Math.max(1, storeys - 1), storeyM = (topM - groundM) / rows;
  if (!(storeyM > 1.5) || !(groundM > 1.5)) return null;
  // The broad eaves: the pitched roof's (round 4), else a flat series' own (round 7).
  const eaves = front.roof?.eavesM ? { overhangM: front.roof.eavesM, ...(front.roof.eavesFrieze === false ? { frieze: false as const } : {}) } : !front.roof && front.eaves ? { ...front.eaves } : null;
  const sided = front.ribbon || front.rhythm || eaves;
  // A dormer on a low (seen) rise keeps inside the slope: its face at most 80 % of the rise (round 8).
  const dh = front.roof?.riseM ? Math.min(KIT_DORMER.heightM, Math.max(0.6, +(front.roof.riseM * 0.8).toFixed(2))) : KIT_DORMER.heightM;
  return { ...(front.roof ? { pitchDeg: front.roof.pitchDeg, ...(front.roof.dormers === false ? {} : { dormer: { ...KIT_DORMER, heightM: dh } }) } : {}), ...(front.roof?.roofHex ? { roofHex: front.roof.roofHex } : !front.roof && front.copingHex ? { roofHex: front.copingHex } : {}),
    erkers: front.erkers, z0: +(groundM - topM).toFixed(3), storeyM: +storeyM.toFixed(3), rows, capM: erkerCapOf(front),
    ...(sided && front.joins ? { joins: { ...front.joins } } : {}), ...(front.ribbon ? { ribbon: true as const } : {}), ...(front.rhythm && !front.erkers.length ? { rhythm: true as const } : {}),
    ...(front.sides && (front.ribbon || front.rhythm) ? { sides: { ...front.sides } } : {}), ...(eaves ? { eaves } : {}),
    ...(front.erkerBands && front.erkers.length ? { erkerBands: true as const } : {}), ...(front.loggias ? { loggias: true as const } : {}),
    ...(front.entries?.length ? { entries: front.entries.map(x => ({ ...x })), groundZ: +(-topM).toFixed(3) } : {}) };
}

/** Whether the kit draws anything on the street end (the roof hook runs `drawKitFront` then). */
export const kitDrawsFront = (k: BuurtRoofKit): boolean => !!(k.erkers.length || k.ribbon || k.rhythm || k.eaves || k.sides || k.loggias || k.entries?.length);

/** Everything the kit draws on the street end `e` of a row roof box (L deep, W wide), in drawing order. */
export function drawKitFront(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  if (kit.rhythm) drawRhythm(s, kit, L, W, e);
  if (kit.ribbon) drawRibbon(s, kit, L, W, e);
  if (kit.sides) drawPiers(s, kit, L, W, e);
  if (kit.loggias) drawLoggias(s, kit, L, W, e);
  if (kit.eaves) drawEaves(s, kit, L, W, e);
  drawErkers(s, kit, L, W, e);
  if (kit.entries?.length) drawEntries(s, kit, L, W, e);
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
    const taken = (kit.entries ?? []).map(en => { const h = Math.min(en.kind === 'gable-bay' ? E.bayW / 2 : E.plateW / 2, W / 2 - 0.1), c = Math.max(-W / 2 + h, Math.min(W / 2 - h, (en.a - 0.5) * W)); return [c - h, c + h] as const; });
    q(-W / 2, W / 2, gz + 0.05, kit.z0 - 0.05, PLATE_O - 0.004 + E.groundO, 'plate');
    const cw = W / cells, ww = cw * E.groundShare;
    for (let i = 0; i < cells; i++) {
      const c0 = -W / 2 + i * cw + (cw - ww) / 2, c1 = c0 + ww;
      if (taken.some(([a, b]) => c1 > a + 0.05 && c0 < b - 0.05)) continue;
      light(frontQuadAt(s, L, e, E.groundO), c0, c1, gz + E.groundFootM, kit.z0 - E.groundHeadM, ww > 1.1);
    }
  }
  for (const en of kit.entries ?? []) {
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
  const R = RHYTHM_LOOK, q = frontQuad(s, L, e), rows = kit.rows - (kit.ribbon ? 1 : 0);
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
  const cL = -W / 2 - (kit.joins?.left ? 0 : ov), cR = W / 2 + (kit.joins?.right ? 0 : ov), zb0 = fz, zt = fz + E.thickM;
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  s.quad(P(cL, -E.backM, zb0), P(cR, -E.backM, zb0), P(cR, ov, zb0), P(cL, ov, zb0), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, -1], wh);
  s.quad(P(cL, ov, zb0), P(cR, ov, zb0), P(cR, ov, zt), P(cL, ov, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [e, 0, 0], wh);
  s.quad(P(cL, ov, zt), P(cR, ov, zt), P(cR, -E.backM, zt), P(cL, -E.backM, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], wh);
  for (const [c, sg, open] of [[cL, -1, kit.joins?.left], [cR, 1, kit.joins?.right]] as const) if (!open)
    s.quad(P(c, -E.backM, zb0), P(c, ov, zb0), P(c, ov, zt), P(c, -E.backM, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, e * sg, 0], wh);
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
