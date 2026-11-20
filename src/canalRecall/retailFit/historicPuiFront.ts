// Historic-pui front (lane retail-fit-20261120, round 5): a register-named historic shopfront drawn as the building's
// own pui, never as a template fascia box (David: "fit designs into the building's existing windows").
//
//   mode 'kit'   the pand is generic (no recipe, house spec or face model): a measured kit pui in place of the template:
//                pilasters, a low panelled plinth under a sill, the glass in bays with small panes where the photo has
//                them, a transom bar with top lights, the door (in the template's recess, so the mesher's wall cut and
//                the door agree), and the sign the photo shows.
//   mode 'sign'  the pand draws its own front (recipe / house spec / face model): only the read name is added, flush
//                on the wall (painted band, neon script) or on the ground-storey glass line; the mesher cuts nothing.
//
// The sign kinds: 'band' (letters painted on the pui's frieze, in the frame colour), 'glass' (letters on the widest
// window), 'neon' (lit script letters on the wall over the pui). Every colour, pane grid and door side is a per-pand
// read (historic-puis.json `front`, with its source); nothing here is a guess beyond the proportions below, which are
// the six brown-bar crops' medians (artifacts/retail-fit/photos/puis).
import type { Builder, RetailFrontInput } from '../retailFront.js';

export type PuiSignKind = 'band' | 'glass' | 'neon';
/** A per-pand read of the historic pui (historic-puis.json `front`). */
export type PuiFrontSpec = {
  /** Frame, pilasters and frieze. */
  frame: string;
  /** Plinth (stall riser) under the glass; absent: the frame darkened. */
  plinth?: string;
  /** Pilasters in their own colour (Tribe's cream cast iron on a black pui); absent: the frame. */
  pilaster?: string;
  /** Glazing bars per window bay [columns, rows]; absent: one sheet per bay. */
  panes?: [number, number];
  /** The door's leaf colour; absent: the frame darkened. */
  door?: string;
  /** The sign: kind, its ink, script lettering (a painted or neon hand) or the bold sans. */
  sign: { kind: PuiSignKind; ink: string; script?: boolean };
  /** Glass tone behind the panes (the photos' dark warm interiors). */
  glass?: string;
};
export type HistoricPuiHost = { mode: 'kit' | 'sign'; front: PuiFrontSpec };

/** Measured proportions (medians of the six brown-bar crops, m). */
export const PUI_KIT = {
  /** Frieze (sign band) under the storey top, and how far it stands out (flush: a painted board in the pui's plane). */
  friezeM: 0.48, friezeOutM: 0.05,
  pilasterM: 0.2, pilasterOutM: 0.08,
  /** Plinth height, sill over it, and the panel inset lines on it. */
  plinthM: 0.62, sillM: 0.06, sillOutM: 0.07, panelInsetM: 0.08,
  /** Top lights over the transom bar (when the storey leaves room). */
  transomM: 0.08, topLightMinM: 0.3,
  /** Mullions between bays, bays at most this wide; glazing bars. */
  mullionM: 0.1, bayMaxM: 1.7, barM: 0.05,
  /** The street's reflection over the glass's upper share (the crops' glass is dark, its head greyer). */
  reflectShare: 0.32,
  /** Out from the wall: glass, bars and mullions, plinth. */
  glassOutM: 0.015, barOutM: 0.04, frameOutM: 0.06, plinthOutM: 0.04,
  doorHeadM: 2.3,
  /** Letters (at most; fitWord keeps them legible, MIN_LETTER_H, or draws none): on the frieze, on the glass at this
   *  share of its height, neon over the frieze. */
  bandLetterM: 0.44, glassLetterM: 0.45, glassAt: 0.6, neonLetterM: 0.5, letterOutM: 0.02,
} as const;

const DEFAULT_GLASS = '#2a2420', REFLECT = '#4a4a48';
const mix = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function shade(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map(x => Math.max(0, Math.min(255, Math.round(x * k))));
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}

/** The window bays of [a0, a1]: equal bays at most PUI_KIT.bayMaxM wide. */
export function puiBays(a0: number, a1: number): Array<[number, number]> {
  const w = a1 - a0;
  if (w < 0.5) return [];
  const n = Math.max(1, Math.ceil(w / PUI_KIT.bayMaxM)), bw = w / n;
  return Array.from({ length: n }, (_, i) => [a0 + i * bw, a0 + (i + 1) * bw] as [number, number]);
}

/**
 * Draws the host's pui (or, for mode 'sign', only its name) into `b` over [s0, s1] of the wall, the ground storey from
 * `base` to `top`. `door`: the template's recess (retailDoor), so the mesher's wall cut is filled by this door.
 */
export function historicPuiFront(b: Builder, host: HistoricPuiHost, input: Pick<RetailFrontInput, 'word' | 'letters' | 'faces'>, s0: number, s1: number, base: number, top: number, door: { a0: number; a1: number; depthM: number } | null): void {
  const K = PUI_KIT, f = host.front, word = input.word ? input.word.toUpperCase() : undefined;
  const frieze0 = top - K.friezeM, script = f.sign.script && input.faces !== undefined ? { face: 'script' as const, layer: input.faces + 2 } : undefined;
  const text = word && script ? word.charAt(0) + word.slice(1).toLowerCase() : word;
  const letters = (a0: number, a1: number, zMid: number, o: number, maxH: number, bg: string, lit: boolean) => {
    if (text) b.word(text, a0, a1, zMid, o, maxH, f.sign.ink, bg, lit, input.letters, script);
  };
  if (host.mode === 'sign') {
    // The building's own front stands; the name only, flush on the wall or on the glass line.
    if (f.sign.kind === 'glass') letters(s0 + 0.3, s1 - 0.3, base + K.plinthM + (frieze0 - K.plinthM - base) * K.glassAt, K.glassOutM + K.letterOutM, K.glassLetterM, DEFAULT_GLASS, false);
    else letters(s0 + 0.2, s1 - 0.2, f.sign.kind === 'neon' ? top - K.neonLetterM / 2 - 0.02 : frieze0 + K.friezeM / 2, K.letterOutM, f.sign.kind === 'neon' ? K.neonLetterM : K.bandLetterM, f.frame, f.sign.kind === 'neon');
    return;
  }
  const frame = f.frame, plinth = f.plinth ?? shade(frame, 0.8), pil = f.pilaster ?? frame, glass = f.glass ?? DEFAULT_GLASS, leaf = f.door ?? shade(frame, 0.7);
  // Frieze: the pui's own board, flush in its plane (the name painted on it for a 'band' sign); a neon sign stands on
  // the frieze too (the photos' script tube runs over the pui head).
  b.slab(s0, s1, 0.01, K.friezeOutM, frieze0, top, frame, 'bottom');
  // Pilasters at both ends, base to the frieze's head.
  b.fin(s0, s0 + K.pilasterM, 0, K.pilasterOutM, base, top, pil);
  b.fin(s1 - K.pilasterM, s1, 0, K.pilasterOutM, base, top, pil);
  const g0 = s0 + K.pilasterM, g1 = s1 - K.pilasterM, sill = base + K.plinthM, head = Math.min(base + K.doorHeadM, frieze0 - 0.05);
  const lights = frieze0 - head - K.transomM >= K.topLightMinM;
  // The door: in the template's recess when the mesher cut one (its leaf at the back, dark reveals), else flush.
  const d = door && door.a0 >= g0 - 1e-6 && door.a1 <= g1 + 1e-6 ? door : null;
  if (d) {
    const rev = shade(frame, 0.55), o = -d.depthM;
    b.face([b.P(d.a0, o, base), b.P(d.a0, 0, base), b.P(d.a0, 0, head), b.P(d.a0, o, head)], b.N(1, 0, 0), rev);
    b.face([b.P(d.a1, o, base), b.P(d.a1, 0, base), b.P(d.a1, 0, head), b.P(d.a1, o, head)], b.N(-1, 0, 0), rev);
    b.face([b.P(d.a0, o, head), b.P(d.a1, o, head), b.P(d.a1, 0, head), b.P(d.a0, 0, head)], [0, 0, -1], shade(frame, 0.45));
    b.face([b.P(d.a0, o, base + 0.02), b.P(d.a1, o, base + 0.02), b.P(d.a1, 0, base + 0.02), b.P(d.a0, 0, base + 0.02)], [0, 0, 1], '#4a4540');
    b.panel(d.a0, d.a1, o, base + 0.02, head, leaf);
    // The leaf's glazed upper half and its frame on the pui line.
    b.panel(d.a0 + 0.12, d.a1 - 0.12, o + 0.01, base + 1.2, head - 0.12, glass);
    b.panel(d.a0 - K.mullionM, d.a0, K.frameOutM, base, head, frame);
    b.panel(d.a1, d.a1 + K.mullionM, K.frameOutM, base, head, frame);
  }
  // Top lights over the transom bar, the whole width (over the door too).
  if (lights) {
    b.slab(g0, g1, 0, K.frameOutM, head, head + K.transomM, frame, 'bottom');
    b.panel(g0, g1, K.glassOutM, head + K.transomM, frieze0, glass);
    for (const [a0, a1] of puiBays(g0, g1).slice(1).map(([a]) => [a - K.mullionM / 2, a + K.mullionM / 2])) b.panel(a0, a1, K.frameOutM, head + K.transomM, frieze0, frame);
  }
  // The windows either side of the door: plinth with its panels, sill, glass in bays, mullions and glazing bars.
  const spans: Array<[number, number]> = d ? [[g0, d.a0 - K.mullionM], [d.a1 + K.mullionM, g1]] : [[g0, g1]];
  const glassTop = lights ? head : frieze0;
  let widest: [number, number] | null = null;
  for (const [c0, c1] of spans) {
    if (c1 - c0 < 0.3) { if (c1 > c0) b.panel(c0, c1, K.frameOutM, base, glassTop, frame); continue; }
    b.panel(c0, c1, K.plinthOutM, base, sill, plinth);
    b.slab(c0 - 0.02, c1 + 0.02, 0, K.sillOutM, sill - K.sillM, sill, frame, 'top');
    const bays = puiBays(c0, c1);
    for (const [a0, a1] of bays) {
      // Panel inset lines on the plinth (one sunk panel per bay, its rim a step lighter).
      const i = K.panelInsetM;
      if (a1 - a0 > 2 * i + 0.2 && K.plinthM - K.sillM > 2 * i + 0.1) b.panel(a0 + i, a1 - i, K.plinthOutM + 0.005, base + i, sill - K.sillM - i, shade(plinth, 0.85));
      const zr = glassTop - (glassTop - sill) * K.reflectShare;
      b.panel(a0, a1, K.glassOutM, sill, zr, glass);
      b.panel(a0, a1, K.glassOutM, zr, glassTop, mix(glass, REFLECT, 0.55));
      if (!widest || a1 - a0 > widest[1] - widest[0]) widest = [a0, a1];
      const [cols, rows] = f.panes ?? [1, 1];
      for (let c = 1; c < cols; c++) { const a = a0 + (a1 - a0) * c / cols; b.panel(a - K.barM / 2, a + K.barM / 2, K.barOutM, sill, glassTop, frame); }
      for (let r = 1; r < rows; r++) { const z = sill + (glassTop - sill) * r / rows; b.panel(a0, a1, K.barOutM, z - K.barM / 2, z + K.barM / 2, frame); }
    }
    for (const [a] of bays.slice(1)) b.panel(a - K.mullionM / 2, a + K.mullionM / 2, K.frameOutM, base, glassTop, frame);
  }
  // The sign.
  if (f.sign.kind === 'glass' && widest && widest[1] - widest[0] >= 0.9) letters(widest[0] + 0.08, widest[1] - 0.08, sill + (glassTop - sill) * K.glassAt, K.barOutM + K.letterOutM, K.glassLetterM, glass, false);
  else if (f.sign.kind !== 'glass') letters(s0 + 0.25, s1 - 0.25, f.sign.kind === 'neon' ? top - K.neonLetterM / 2 - 0.02 : frieze0 + K.friezeM / 2, K.friezeOutM + K.letterOutM, f.sign.kind === 'neon' ? K.neonLetterM : K.bandLetterM, frame, f.sign.kind === 'neon');
}
