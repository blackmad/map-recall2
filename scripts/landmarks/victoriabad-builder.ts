import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {eaveOffset, getSink, letters, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import source from './victoriabad-footprints.json';

/**
 * VICTORIABAD, Weesp (BAG pand 0457100000062818, bouwjaar 2005): the indoor bath of Weesp, a dark brown brick hall with a
 * gently curved roof line and a cubic two-storey entrance block, set among trees. Sources: BAG ring + 3DBAG LoD2.2 shell
 * (CC0 / CC BY 4.0) via pool-site-prepare.ts; Gemeente Amsterdam panoramas (CC BY 4.0) for the south and east fronts
 * (victoriabad-brief.md). Per item in victoriabad-inventory.json.
 *  - South front of the hall (w01-184, ring edge 32): dark brick under the curved roof line, a strip of windows high on its
 *    east half and a full-height glass slot at its west end.
 *  - The entrance block (w16-197 edge 34, w14-108 edge 35): the dark-framed low glass box at the ground and the entrance on
 *    the east. The cube's upper window band is not drawn: its wall is set back from the BAG ring (an inner 3DBAG wall).
 *  - East front (w03-84 edge 1): dark brick with a row of windows; VICTORIABAD in white letters on the low brick garden wall
 *    in front of it.
 */
type Src = {nativeRing: number[][]; surfaces: Surface[]};
export function buildVictoriabad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  const fr = (i: number) => ringFrame(ring, i, Math.max(-0.5, Math.min(1.0, eaveOffset(ring, roofs, i))));
  const sink0 = getSink();
  setSink(0.05, true);
  {
    // w01: high window strip over the east half (viewer's right), the glass slot at the west end
    const {f, len} = fr(32);
    band(b, f, len * 0.72, len * 0.42, 5.9, 0.9);
    // the hall rises 11.5 m along (3DBAG roof 2.9 m before it, 7.6 m after): the slot stands at the hall's west end
    slab(b, f, 12.6, 0.3, 1.3, 6.8, 0.1, 'frame');
    slab(b, f, 12.6, 0.4, 1.1, 6.6, 0.14, 'glass');
  }
  // the entrance block's low glass box (ring edge 34, 3DBAG 3.4 m) stays the shell: the openings gate reads a glass front on
  // its 3DBAG wall as past the wall silhouette (2026-11-15), so it is not drawn
  { const {f, len} = fr(35); slab(b, f, len / 2, 0, 2.2, 2.6, 0.12, 'glass'); slab(b, f, len / 2, 2.6, 3.2, 0.3, 1.4, 'greyBrick'); } // entrance door, canopy
  {
    // w03: a row of windows, and the garden wall with VICTORIABAD 7 m in front of it
    const {f, len} = fr(1);
    // the wall drops to 2.8 m past 0.8 of the edge
    for (let k = 0; k < 4; k++) { const t = len * (0.15 + 0.18 * k); slab(b, f, t, 2.0, 1.4, 1.6, 0.08, 'frame'); slab(b, f, t, 2.08, 1.24, 1.44, 0.12, 'glass'); }
    gardenWall(b, f, len * 0.5, 7, 10);
  }
  setSink(sink0);
}
/** A window band centred at t, w wide, from y, h high: a frame strip and glass panes every 1.8 m. */
function band(b: BuildingTools, f: Frame, t: number, w: number, y: number, h: number) {
  slab(b, f, t, y, w, h, 0.08, 'frame');
  const n = Math.max(1, Math.round(w / 1.8));
  for (let k = 0; k < n; k++) slab(b, f, t - w / 2 + (k + 0.5) * (w / n), y + 0.08, w / n - 0.12, h - 0.16, 0.12, 'glass');
}
/** A freestanding low brick wall `out` metres in front of the front, `len` long, lettered VICTORIABAD in white. */
function gardenWall(b: BuildingTools, f: Frame, t: number, out: number, len: number) {
  slab(b, f, t, 0, len, 0.95, 0.35, 'brick', out);
  letters(b, f, 'VICTORIABAD', t, 0.2, out + 0.35, 0.09, 0.05, 'white'); // 5 cm proud: 3 cm letters z-fought the wall face (audit zfight-tight)
}
