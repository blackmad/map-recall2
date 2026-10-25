// Street surface texture layouts (pure; the canvases are painted in gameGround.ts).
//
// Klinker carriageways (Amsterdam's gebakken klinker streets, BGT `rijbaan
// ... open verharding`) are laid in herringbone (keperverband) in mixed
// tones ("genuanceerd": red-brown, purple-brown, grey-brown bricks side by
// side). The old texture was a stretcher bond in one red-brown with a little
// brightness noise, which from the boat read as the same flat red as a cycle
// path (user 2026-10-14, Houtmankade: "why road on one side and red on the
// other side?"). Herringbone and the mixed tones say "brick street" up close;
// the base colour (look/palette.ts STREET_GROUND.klinker) says it from afar.

export interface BrickRect { x: number; y: number; w: number; h: number; tone: number }

/**
 * Herringbone of 2 × 1 bricks over a `units` × `units` tile (units a multiple
 * of 4, so it repeats seamlessly): staircases of a horizontal brick at (k, k)
 * and a vertical one at (k + 2, k − 1), repeated every 4 units along x.
 * Bricks crossing the tile edge are returned once per wrapped copy that
 * touches the tile. `tone` is a stable per-brick index into the tone list.
 */
export function herringboneBricks(units: number, tones: number, seed = 7): BrickRect[] {
  if (units % 4) throw new Error('herringbone tile must be a multiple of 4 units');
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out: BrickRect[] = [];
  const push = (x: number, y: number, w: number, h: number, tone: number) => {
    for (const dx of [-units, 0, units]) for (const dy of [-units, 0, units]) {
      const X = x + dx, Y = y + dy;
      if (X + w <= 0 || Y + h <= 0 || X >= units || Y >= units) continue;
      out.push({ x: X, y: Y, w, h, tone });
    }
  };
  // One period: k in [0, units), copies c with 4c in [0, units); positions taken modulo the tile.
  for (let k = 0; k < units; k++) for (let c = 0; c < units / 4; c++) {
    const m = (v: number) => ((v % units) + units) % units;
    push(m(k + 4 * c), k, 2, 1, Math.floor(rnd() * tones));
    push(m(k + 2 + 4 * c), m(k - 1), 1, 2, Math.floor(rnd() * tones));
  }
  return out;
}

/**
 * Per-brick tone multipliers (r, g, b) of a "genuanceerd" klinker mix around
 * the base: as-is, redder, purple-brown, grey-brown, yellow-brown. They average to
 * 1 per channel within 2 %, so the tile's mean stays the palette's base.
 */
export const KLINKER_TONES: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [1.1, 0.95, 0.9],
  [0.9, 0.88, 0.98],
  [0.98, 1.08, 1.12],
  [1.02, 1.09, 1.0],
];

/**
 * Asphalt-like grain over a `size` × `size` tile that repeats seamlessly (lane road-surfaces 2026-10-25, issue #63):
 * per-texel fine grain (`fine`), sparse light and dark aggregate stones of 1–2 texels (`stones`, about 4 % of the
 * tile), and a soft mottle on a periodic lattice of `cells` × `cells` (`mottle`; wear and patching). Returns one
 * brightness offset per texel (row-major), in the same units as the amplitudes, with mean exactly 0, so the tile's
 * average (and so its look from afar, where the mipmaps average it) stays the palette's base.
 */
export function asphaltGrain(size: number, amp: { fine: number; stones: number; mottle: number }, cells = 8, seed = 11): Float32Array {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = new Float32Array(size * size);
  const lattice = Float32Array.from({ length: cells * cells }, () => rnd() - 0.5);
  const at = (i: number, j: number) => lattice[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * cells, v = (y / size) * cells, i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
    const m = at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv;
    out[y * size + x] = (rnd() - 0.5) * amp.fine + m * 2 * amp.mottle;
  }
  const n = Math.round(size * size * 0.02);
  for (let k = 0; k < n; k++) {
    const x = Math.floor(rnd() * size), y = Math.floor(rnd() * size), d = (rnd() < 0.5 ? -1 : 1) * amp.stones * (0.6 + 0.4 * rnd());
    const r = rnd() < 0.3 ? 2 : 1;
    for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) out[((y + dy) % size) * size + ((x + dx) % size)] += d;
  }
  let mean = 0;
  for (const v of out) mean += v;
  mean /= out.length;
  for (let i = 0; i < out.length; i++) out[i] -= mean;
  return out;
}
