import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {eaveOffset, getSink, letters, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './zwembad-bijlmer-footprints.json';

/**
 * ZWEMBAD BIJLMER in the Bijlmer Sportcentrum, Bijlmerpark (BAG pand 0363100012103346, bouwjaar 2008): a long sports and
 * swimming hall in mottled grey-brown brick with a curved roof line, its south and west sides one glass curtain wall.
 * Sources: BAG ring + 3DBAG LoD2.2 shell (CC0 / CC BY 4.0) via pool-site-prepare.ts; Gemeente Amsterdam panoramas (CC BY 4.0)
 * for every wall (brief: zwembad-bijlmer-brief.md). Per item in zwembad-bijlmer-inventory.json.
 *  - Glass curtain wall on the west and south (ring edges 23-27: w09-251, w06-264, w08-174, w07-224, w05-160): narrow
 *    vertical panes in light frames from the plinth to the eave, panes of two tones (the sky and the hall behind).
 *  - The sign band (w06-264, w08-174): a row of white squares at about 2.6 m, each with one green letter, spelling BIJLMER
 *    SPORTCENTRUM; on w06 BIJLMER in tall red letters top right, SPORTCENTRUM under it and the three Amsterdam crosses.
 *  - Brick walls (w01-61, w02-331, w03-241, w04-61) on a light concrete plinth; w01 carries a high strip of windows and a
 *    thin canopy; w02 a canopy over the service door.
 */
type Src = {nativeRing: number[][]; surfaces: Surface[]};
const GLASS_EDGES = [23, 24, 25, 26, 27];
const BRICK_EDGES = [0, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 28, 31];

export function buildZwembadBijlmer(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;
  // 3DBAG wall 69 is a 0.26 m jog 3 cm proud of the west curtain's wall line: the curtain glass stood 2 cm in front of it
  // (audit zfight-tight 1.3 m2). The glass covers it, so the jog is cut, not the glass moved.
  addShell(b, src as never, {wall: 'greyBrick', roof: 'slate', skip: (_s, i) => i === 69});
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  const fr = (i: number) => ringFrame(ring, i, Math.max(-0.5, Math.min(1.0, eaveOffset(ring, roofs, i))));
  /** Lowest roof over the edge, sampled 0.8 m inside it: where a full-height front must stop. */
  const eave = (i: number) => {
    const {f, len} = ringFrame(ring, i);
    let lo = Infinity;
    for (let k = 0; k <= 8; k++) { const t = 0.3 + ((len - 0.6) * k) / 8; const y = roofHeightAt(src.surfaces, f.origin[0] + f.tangent[0] * t - f.n[0] * 0.8, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.8); if (y !== null) lo = Math.min(lo, y); }
    return Number.isFinite(lo) ? lo : 9;
  };
  const sink0 = getSink();
  setSink(0.05, true);
  for (const i of GLASS_EDGES) curtain(b, fr(i), eave(i) - 0.35, i * 7);
  for (const i of BRICK_EDGES) { const {f, len} = fr(i); if (len > 1) slab(b, f, len / 2, 0, len, 0.7, 0.08, 'concrete'); }

  // the sign band of white squares with green letters (w06, w08)
  for (const i of [24, 25]) { const {f, len} = fr(i); signBand(b, f, len, 2.6, 'BIJLMER SPORTCENTRUM'); }
  {
    // BIJLMER in red over SPORTCENTRUM at the right of w06 (edge 24), the three crosses left of it
    const {f, len} = fr(24), y = Math.max(5.5, eave(24) - 2.4), t = len - 6.2;
    letters(b, f, 'BIJLMER', t, y, 0.12, 0.2, 0.04, 'red');
    letters(b, f, 'SPORTCENTRUM', t, y - 0.75, 0.12, 0.08, 0.03, 'red');
    for (let k = 0; k < 3; k++) letters(b, f, 'X', t - 5.2, y + 0.9 - k * 0.65, 0.12, 0.08, 0.03, 'red');
  }
  // w01 (edge 4): the high strip of windows over the east half and the thin canopy
  {
    // on the BAG line: the 3DBAG eave runs 0.6 m inside it, but the wall below it stands on the line (the strip sank into it)
    const {f, len} = ringFrame(ring, 4, 0.02);
    slab(b, f, len * 0.3, 6.2, len * 0.55, 1.2, 0.1, 'frame');
    const n = Math.round((len * 0.55) / 2.4);
    for (let k = 0; k < n; k++) slab(b, f, len * 0.3 - (len * 0.55) / 2 + (k + 0.5) * ((len * 0.55) / n), 6.3, (len * 0.55) / n - 0.2, 1.0, 0.14, 'glass');
    slab(b, f, len * 0.62, 3.0, 9, 0.2, 1.6, 'concrete');
  }
  // w02 (edges 10-12): the canopy over the service door and its grey door
  {
    const {f, len} = fr(10);
    slab(b, f, len / 2, 3.0, 6, 0.2, 1.2, 'concrete');
    slab(b, f, len / 2, 0.7, 2.8, 2.3, 0.1, 'dark');
  }
  setSink(sink0);
}

/** Glass curtain from the plinth to y1: narrow panes (1.25 m) in light frames, transoms at 3.2 m and two-thirds height,
 *  panes in two tones by a fixed hash (the photo's mix of sky and hall). */
function curtain(b: BuildingTools, {f, len}: {f: Frame; len: number}, y1: number, seed: number) {
  // inset 0.2 m from the edge ends and no end mullions: the 3DBAG corners are cut back, a corner mullion stood off the wall
  const y0 = 0.7, n = Math.max(1, Math.round((len - 0.4) / 1.25)), w = (len - 0.4) / n, t0 = 0.2;
  slab(b, f, len / 2, 0, len, y0, 0.12, 'concrete'); // plinth
  const rows = [y0, 3.2, y0 + (y1 - y0) * 0.66, y1];
  for (let r = 0; r + 1 < rows.length; r++) for (let k = 0; k < n; k++) {
    const h = ((k * 73 + r * 151 + seed * 37) % 100) / 100;
    slab(b, f, t0 + (k + 0.5) * w, rows[r] + 0.04, w - 0.06, rows[r + 1] - rows[r] - 0.08, 0.12, h < 0.35 ? 'canopyGlass' : 'glass');
  }
  for (let k = 1; k < n; k++) slab(b, f, t0 + k * w, y0, 0.08, y1 - y0, 0.2, 'frame');
  for (const y of rows) slab(b, f, len / 2, y - 0.04, len - 0.4, 0.08, 0.2, 'frame');
}
/** A row of 0.56 m white squares across the edge at y, each with one green letter; `text` centred, blanks either side. */
function signBand(b: BuildingTools, f: Frame, len: number, y: number, text: string) {
  const s = 0.62, n = Math.floor((len - 0.4) / s), start = (len - n * s) / 2, chars = [...text], off = Math.floor((n - chars.length) / 2);
  for (let k = 0; k < n; k++) {
    const t = start + (k + 0.5) * s;
    slab(b, f, t, y, s - 0.06, s - 0.06, 0.1, 'white', 0.2);
    const ch = chars[k - off];
    if (ch && ch !== ' ') letters(b, f, ch, t, y + 0.08, 0.3, 0.055, 0.03, 'green');
  }
}
