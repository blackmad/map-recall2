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
import type { BuurtErker } from './frontKit.js';

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
  /** Joined sides (left/right as seen): the ribbon runs on through the party wall there. */
  joins?: { left?: boolean; right?: boolean };
}

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
  return { ...(pitch > 10 && pitch < 80 ? { pitchDeg: pitch } : {}), ...(hex ? { roofHex: hex } : {}), ...(dormer ? { dormer } : {}), erkers, z0: Number(k.z0), storeyM: Number(k.storeyM), rows: Math.round(Number(k.rows)), capM: Number(k.capM),
    ...(k.ribbon === true ? { ribbon: true as const, ...(joins.left || joins.right ? { joins } : {}) } : {}) };
}

/**
 * The erkers on the street end `e` (±1) of a row roof box L deep and W wide. Seen from the street the front runs left
 * to right along e*v, so a span [a0, a1] of the front stands at v = e * (a - 0.5) * W, its face out along e*u.
 */
export function drawErkers(s: RoofSink, kit: BuurtRoofKit, L: number, W: number, e: number): void {
  const Lk = ERKER_LOOK, z0 = kit.z0, z1 = kit.capM;
  // (c, o, z): c across the front left to right as seen, o out from the wall, z up from the series line.
  const P = (c: number, o: number, z: number): V3 => [e * (L / 2 + o), e * c, z];
  const H = (dc: number, doo: number, dz: number): V3 => [e * doo, e * dc, dz];
  for (const k of kit.erkers) {
    const c0 = (k.a0 - 0.5) * W, c1 = (k.a1 - 0.5) * W, cm = (c0 + c1) / 2, d = Math.min(k.depthM, 1.2);
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
      const m = Math.min(Lk.sideMarginM, sl * 0.12) / sl;
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
    slab(z1, z1 + Lk.capM);
  }
}

/** The roof kit a member's front kit asks for: its erkers over the upper storeys (the series' ground and storey lines,
 *  rowFront.ts rowGroundM) and the series pitch. `topM` is the series line, `groundM` the ground storey's top. */
export function buurtRoofKitFor(front: { erkers: BuurtErker[]; roof?: { pitchDeg: number; roofHex?: string }; ribbon?: true; copingHex?: string; joins?: { left?: boolean; right?: boolean } }, topM: number, storeys: number, groundM: number): BuurtRoofKit | null {
  const rows = Math.max(1, storeys - 1), storeyM = (topM - groundM) / rows;
  if (!(storeyM > 1.5) || !(groundM > 1.5)) return null;
  return { ...(front.roof ? { pitchDeg: front.roof.pitchDeg, dormer: { ...KIT_DORMER } } : {}), ...(front.roof?.roofHex ? { roofHex: front.roof.roofHex } : !front.roof && front.copingHex ? { roofHex: front.copingHex } : {}),
    erkers: front.erkers, z0: +(groundM - topM).toFixed(3), storeyM: +storeyM.toFixed(3), rows, capM: ERKER_LOOK.capM,
    ...(front.ribbon ? { ribbon: true as const, ...(front.joins ? { joins: { ...front.joins } } : {}) } : {}) };
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
  const cL = -W / 2 + (kit.joins?.left ? 0 : Rl.endM), cR = W / 2 - (kit.joins?.right ? 0 : Rl.endM);
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
    if ((i === 0 && kit.joins?.left) || (i === n && kit.joins?.right)) continue;
    q(Math.max(cL, c - f / 2), Math.min(cR, c + f / 2), za, zb, 0.115, 'trim', wh);
  }
}
