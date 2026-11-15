/**
 * House rows (lane R, 2026-11-14): window heads as a typed grammar instead of single glyphs. David: "the little T in our
 * renders over the window aren't right" (Weteringschans 168096, 168042, 169016). A head is a shape, a ring of voussoirs
 * fanning over the opening (white stone, brick, or alternating), a keystone, springer blocks, a filled tympanum or a
 * stepped jack-block crown. `headPieces` turns one head over one opening into flat wall pieces (x along the wall, z up)
 * at the scale of the opening: blocks 0.12-0.2 m, a segmental rise of a sixth of the span. Pure and Node-tested
 * (headGrammar.test.ts); facadeOrnaments.ts row-heads draws the pieces.
 */

export type HeadShape = 'flat' | 'segmental' | 'round';
export type VoussoirPattern = 'white' | 'brick' | 'white-brick';
export interface HeadGrammar {
  shape: HeadShape;
  /** The ring over the opening: blocks fanning from the arch's centre. `count` absent: from the span (BLOCK_M). */
  voussoirs?: { count?: number; alternate: VoussoirPattern; depth: number };
  keystone?: 'plain' | 'raised' | 'carved';
  /** White blocks at the arch's feet. */
  springers?: boolean;
  /** The segment between the opening's flat top and the arch filled with stone (else glazed: the glass follows the arch). */
  tympanum?: boolean;
  /** A stepped crown of small white blocks over a flat head. */
  crown?: 'jack-blocks';
  /** A plain white lintel slab (no ring). */
  lintel?: boolean;
  /** Block quoins round the whole opening: jambs of alternating long and short white blocks (Kinkerstraat 100). */
  surround?: 'blocks';
  /** A light stone tablet in the brick over the head, on the axis (Herengracht 175404: a white block over each window,
   *  the anchors between). */
  tablet?: boolean;
  /** A brick relieving arch over the flat head: a shallow segmental ring of headers, its segment filled with brick. */
  relieving?: boolean;
}

export type HeadTone = 'white' | 'brick' | 'stone' | 'glass';
/** One flat wall piece: four [x, z] corners (counter-clockwise seen from the street), its tone and how proud it stands. */
export interface HeadPiece { pts: [[number, number], [number, number], [number, number], [number, number]]; tone: HeadTone; out: number }

/** Sizes (m). */
/** Row scale (Kinkerstraat review 4: at 40 px/m keystones read as plain hoods and segmental heads as flat): a key at
 *  least 0.26 m wide and 0.36 m tall in full white, a segmental rise of at least 0.22 m. */
export const HEAD = { block: 0.16, minBlocks: 5, rise: 1 / 6, minRise: 0.22, keyUp: 0.07, keyDown: 0.04, keyW: 0.26, keyTopW: 0.32, keyH: 0.36, out: 0.04, keyOut: 0.07,
  quoinLong: 0.42, quoinShort: 0.24, quoinH: 0.27, quoinGap: 0.06,
  tablet: { w: 0.26, h: 0.36, gap: 0.12, out: 0.06, minH: 0.2 }, relieve: { over: 0.06, rise: 0.16, depth: 0.12, lift: 0.08 },
  springerW: 0.18, springerH: 0.2, lintel: 0.16, lintelOver: 0.12, jack: { end: 0.15, mid: 0.22, endW: 0.16, midW: 0.18 }, jackOut: 0.06, glassOut: 0.012, flatFan: 2.2 } as const;

/**
 * D's head dressings (houseSpec/row/types.ts heads[].dressing, with the window shape) on the grammar. Ambiguous ones keep
 * the photo's majority reading in these rows; D can state `voussoirs.alternate` to override (see rowSeries.ts).
 */
export function headGrammarOf(dressing: string | undefined, shape: string | undefined): HeadGrammar | null {
  const arch: HeadShape = shape === 'round' ? 'round' : shape === 'segmental' ? 'segmental' : 'flat';
  switch (dressing) {
    // A white key on a brick arch of fanned voussoirs (Kinkerstraat 98/96/92): the arch is the window's own shape.
    case 'keystone': return { shape: arch, voussoirs: { alternate: 'brick', depth: 0.24 }, keystone: 'raised' };
    // Jack blocks (Weteringschans 168096, 168042, 169016; head sheet 2026-11-14): a white lintel slab wider than the
    // opening with a stepped crown of white blocks on it, one at each end and the tallest on the axis.
    // On a round or segmental window (Herengracht 71's warehouse arches): the glass up into the arch, white blocks at its
    // feet and a white key at its crown, the jack blocks of an arch.
    case 'jack-blocks': return arch !== 'flat' ? { shape: arch, keystone: 'plain', springers: true } : { shape: 'flat', lintel: true, crown: 'jack-blocks' };
    // Segmental tympanum (Kinkerstraat 94/90/86-88): a brick segmental ring over a stone-filled tympanum, a white key.
    case 'segmental-tympanum': return { shape: 'segmental', voussoirs: { alternate: 'brick', depth: 0.16 }, keystone: 'plain', tympanum: true };
    // Arch ring (Weteringschans 171218 top storey): a white half-round ring with a keystone, the glass up into the arch.
    case 'arch-ring': return { shape: 'round', voussoirs: { alternate: 'white', depth: 0.15 }, keystone: 'raised', springers: true };
    // A stone tablet over the head (Herengracht 175404): a light block in the brick on the axis; over a relieving-arch
    // head the arch's brick ring under it.
    case 'tablet': return shape === 'relieving' ? { shape: 'flat', tablet: true, relieving: true } : { shape: 'flat', tablet: true };
    // A stated arched opening (RowGround.archedOpenings): the glass up into its arch inside a slim white frame.
    case 'arched-frame': return { shape: arch === 'flat' ? 'segmental' : arch, voussoirs: { alternate: 'white', depth: 0.08 } };
    case 'stone-lintel': case 'dentil-lintel': return { shape: 'flat', lintel: true };
    // Block surround (Kinkerstraat 100): alternating white quoins up both jambs and a keyed flat head of white blocks.
    case 'block-surround': return { shape: arch, voussoirs: { alternate: 'white', depth: 0.2 }, keystone: 'raised', surround: 'blocks' };
    case 'voussoirs': return { shape: arch === 'flat' ? 'segmental' : arch, voussoirs: { alternate: 'white-brick', depth: 0.22 }, keystone: 'raised', springers: true };
    // A plain arched window (no dressing stated): the glass up into its arch, the brick round it.
    case 'none': return arch !== 'flat' ? { shape: arch } : null;
    default:
      // A stated arched window with a dressing the grammar does not name: a white ring of its shape.
      return dressing && dressing !== 'none' && arch !== 'flat' ? { shape: arch, voussoirs: { alternate: 'white', depth: 0.16 }, keystone: 'plain' } : null;
  }
}

/** How far a head rises over the opening's head line (its crown, keystone or ring top). */
export function headRise(g: HeadGrammar, span: number): number {
  const ring = g.voussoirs?.depth ?? 0;
  const arch = g.shape === 'round' ? span / 2 : g.shape === 'segmental' ? segRise(span) : 0;
  const key = g.keystone ? Math.max(HEAD.keyH - HEAD.keyDown - ring, g.keystone === 'plain' ? 0 : HEAD.keyUp) : 0;
  if (g.tablet) return tabletFoot(g, span) + HEAD.tablet.h;
  const crown = g.crown === 'jack-blocks' ? HEAD.jack.mid : 0, base = g.lintel && !g.voussoirs ? HEAD.lintel : arch + ring;
  return Math.max(g.lintel ? HEAD.lintel : 0, arch + ring + key, base + crown);
}

/** A tablet's foot over the head line: clear of a relieving arch's ring. */
// Over a relieving arch the tablet sits on the ring's crown as its key (Herengracht 27; blind review: lifted clear of it,
// it hung under the next storey's sill like a tab).
const tabletFoot = (g: HeadGrammar, span: number) => g.relieving ? HEAD.relieve.lift + relieveRise(span) + HEAD.relieve.depth - 0.04 : HEAD.tablet.gap;
const relieveRise = (span: number) => Math.min(HEAD.relieve.rise, (span + 2 * HEAD.relieve.over) * 0.14);
const segRise = (span: number) => Math.min(span / 2 * 0.8, Math.max(span * HEAD.rise, HEAD.minRise));
const tone = (p: VoussoirPattern, i: number, n: number): HeadTone =>
  p === 'white' ? 'white' : p === 'brick' ? 'brick' : (Math.abs(i - (n - 1) / 2) % 2 < 0.5 ? 'white' : 'brick');

/**
 * The pieces of head `g` over an opening [x0, x1] whose flat head is at z. Voussoirs fan from the arch centre (flat
 * arches from a centre HEAD.flatFan spans below), an odd count so a block sits on the axis; the axis block is the key.
 */
export function headPieces(g: HeadGrammar, x0: number, x1: number, z: number, sill?: number): HeadPiece[] {
  const out: HeadPiece[] = [], L = x1 - x0, m = (x0 + x1) / 2;
  if (L <= 0.05) return out;
  if (g.tablet) {
    if (g.relieving) {
      // The relieving arch: a shallow segmental ring of brick headers springing just outside the jambs, its segment brick.
      // It springs over the window's white frame head (blind review: inside the frame it read as a dark glass fanlight).
      const R0 = HEAD.relieve, l = x0 - R0.over, r = x1 + R0.over, S = r - l, rise = relieveRise(L), zs = z + R0.lift, Rr = (S * S / 4 + rise * rise) / (2 * rise), cz = zs + rise - Rr;
      const half = Math.asin(Math.min(1, S / 2 / Rr)), n = Math.max(HEAD.minBlocks, Math.round(2 * half * Rr / 0.11)) | 1;
      const pt = (t: number, d: number): [number, number] => { const a = -half + 2 * half * t; return [m + (Rr + d) * Math.sin(a), cz + (Rr + d) * Math.cos(a)]; };
      for (let i = 0; i < 8; i++) out.push({ pts: [[pt(i / 8, 0)[0], zs], [pt((i + 1) / 8, 0)[0], zs], pt((i + 1) / 8, 0), pt(i / 8, 0)], tone: 'brick', out: HEAD.out * 0.4 });
      // The ring's headers in the darker burnt brick, so the arch reads against the wall.
      for (let i = 0; i < n; i++) out.push({ pts: [pt(i / n, 0), pt((i + 1) / n, 0), pt((i + 1) / n, R0.depth), pt(i / n, R0.depth)], tone: i % 2 ? 'stone' : 'brick', out: HEAD.out * 0.6 + (i % 2) * 0.004 });
    }
    const T = HEAD.tablet, zb = z + tabletFoot(g, L);
    out.push({ pts: [[m - T.w / 2, zb], [m + T.w / 2, zb], [m + T.w / 2, zb + T.h], [m - T.w / 2, zb + T.h]], tone: 'white', out: T.out });
    return out;
  }
  if (g.lintel && !g.voussoirs) {
    const l = x0 - HEAD.lintelOver, r = x1 + HEAD.lintelOver, zt = z + HEAD.lintel;
    out.push({ pts: [[l, z], [r, z], [r, zt], [l, zt]], tone: 'white', out: HEAD.out });
    if (g.crown === 'jack-blocks') {
      // The crown on the slab: a block over each end and the tallest on the axis, wall between them.
      const J = HEAD.jack;
      for (const [a, w, h] of [[l, J.endW, J.end], [m - J.midW / 2, J.midW, J.mid], [r - J.endW, J.endW, J.end]] as const)
        out.push({ pts: [[a, zt], [a + w, zt], [a + w, zt + h], [a, zt + h]], tone: 'white', out: HEAD.jackOut });
    }
    return out;
  }
  const v = g.voussoirs;
  // The intrados as a curve t in [0, 1] -> point and its outward unit normal (the joint direction).
  let at: (t: number) => { p: [number, number]; n: [number, number] };
  let arcLen: number;
  if (g.shape === 'flat') {
    const H = L * HEAD.flatFan;
    at = t => { const x = x0 + L * t, dx = x - m, len = Math.hypot(dx, H); return { p: [x, z], n: [dx / len, H / len] }; };
    arcLen = L;
  } else {
    const rise = g.shape === 'round' ? L / 2 : segRise(L), R = (L * L / 4 + rise * rise) / (2 * rise), cz = z + rise - R;
    const half = Math.asin(Math.min(1, L / 2 / R));
    at = t => { const a = -half + 2 * half * t, n: [number, number] = [Math.sin(a), Math.cos(a)]; return { p: [m + R * n[0], cz + R * n[1]], n }; };
    arcLen = 2 * half * R;
    // The segment under the arch: glass that follows the arch, or a stone tympanum.
    const F = 8;
    for (let i = 0; i < F; i++) {
      const a = at(i / F).p, b = at((i + 1) / F).p;
      out.push({ pts: [[a[0], z], [b[0], z], b, a], tone: g.tympanum ? 'stone' : 'glass', out: g.tympanum ? HEAD.out * 0.5 : HEAD.glassOut });
    }
  }
  if (v) {
    let n = v.count ?? Math.max(HEAD.minBlocks, Math.round(arcLen / HEAD.block));
    if (n % 2 === 0) n++;
    for (let i = 0; i < n; i++) {
      const a = at(i / n), b = at((i + 1) / n), d = v.depth;
      // Flat arches keep a level extrados: the joint runs up to z + depth whatever its lean.
      const ext = (q: { p: [number, number]; n: [number, number] }, dd: number): [number, number] => g.shape === 'flat' ? [q.p[0] + q.n[0] * dd / q.n[1], q.p[1] + dd] : [q.p[0] + q.n[0] * dd, q.p[1] + q.n[1] * dd];
      out.push({ pts: [a.p, b.p, ext(b, d), ext(a, d)], tone: tone(v.alternate, i, n), out: HEAD.out + (i % 2) * 0.004 });
    }
  }
  if (g.keystone) {
    // The key on the axis, over the crown of the arch: a white wedge at row scale, proud of the ring.
    const apex = at(0.5).p, h = Math.max(HEAD.keyH, (v?.depth ?? 0) + HEAD.keyDown + (g.keystone === 'plain' ? 0 : HEAD.keyUp));
    const zb = apex[1] - HEAD.keyDown, zt = zb + h;
    out.push({ pts: [[m - HEAD.keyW / 2, zb], [m + HEAD.keyW / 2, zb], [m + HEAD.keyTopW / 2, zt], [m - HEAD.keyTopW / 2, zt]], tone: 'white', out: HEAD.keyOut });
  }
  if (g.surround === 'blocks' && sill !== undefined && z - sill > 0.4) {
    // Quoins up both jambs from the sill to the springing: long and short white blocks in turn, set into the wall.
    const step = HEAD.quoinH + HEAD.quoinGap;
    for (const [edge, sg] of [[x0, -1], [x1, 1]] as const) for (let k = 0, zz = sill; zz + HEAD.quoinH <= z + 1e-9; k++, zz += step) {
      const w = k % 2 ? HEAD.quoinShort : HEAD.quoinLong, xa = sg < 0 ? edge - w + 0.04 : edge - 0.04, xb = xa + w;
      out.push({ pts: [[xa, zz], [xb, zz], [xb, zz + HEAD.quoinH], [xa, zz + HEAD.quoinH]], tone: 'white', out: HEAD.out });
    }
  }
  if (g.springers) for (const [p, s] of [[at(0), -1], [at(1), 1]] as const) {
    const xa = p.p[0] + (s < 0 ? -HEAD.springerW * 0.6 : -HEAD.springerW * 0.4), zb = p.p[1] - HEAD.springerH * 0.5;
    out.push({ pts: [[xa, zb], [xa + HEAD.springerW, zb], [xa + HEAD.springerW, zb + HEAD.springerH], [xa, zb + HEAD.springerH]], tone: 'white', out: HEAD.out + 0.01 });
  }
  return out;
}
