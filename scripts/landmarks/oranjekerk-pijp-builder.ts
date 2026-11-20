import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import source from './oranjekerk-pijp-footprints.json';

/**
 * ORANJEKERK, Van Ostadestraat 149, De Pijp (BAG pand 0363100012237071, 1903; gemeentelijk monument 200431): a dark
 * red-brown brick church with a big traceried window in its west gable, a tall tower on the west front, an octagonal
 * entrance porch, an apse-like south front and a three-storey parsonage at the south-east corner. Massing: the 3DBAG
 * LoD2.2 shell (oranjekerk-pijp-footprints.json, bag-shell-prepare.ts). Drawn from rectified Gemeente Amsterdam panoramas
 * (CC BY 4.0; 50 px/m crops of the brief), per item in oranjekerk-pijp-inventory.json:
 *  - west front (ring edge 23, w01-256): the round-arched traceried window 4.6 m wide (8.0-16.4 m) in the gable, round-arched
 *    traceried side windows (7.9-13.0 m), five round-arched windows below (2.7-6.0 m), stone sills and the side cornices;
 *  - tower (edges 25 and 26, w07-255, w08-165): the arched west door under a brick arch with a fanlight, a band of four small
 *    arched windows, a string course and two tall slit windows;
 *  - parsonage (edge 2, w03-165): paired ground-floor windows over a stone band, segment-headed upper windows;
 *  - south front (edge 34, w04-164): three tall round-arched windows over three lower ones; the porch (edge 21, w06-255): the
 *    wide entrance opening.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};

const src = source as unknown as Src;
const ring = src.facadeRing;

export function buildOranjekerkPijp(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);

  /** Round-arched window: brick reveal arch, frame, glass, mullions (n lights), stone sill. */
  const arch = (f: Frame, t: number, y0: number, y1: number, w: number, lights = 1, ring0 = false) => {
    archBand(b, f, t, y0, w + 0.5, y1 - y0 + 0.3, 0.22, 0.05, 'ochre');
    archSlab(b, f, t, y0, w + 0.1, y1 - y0 + 0.05, 0.1, 'frame');
    archSlab(b, f, t, y0 + 0.05, w, y1 - y0 - 0.05, 0.14, 'glass');
    for (let k = 1; k < lights; k++) slab(b, f, t - w / 2 + (k * w) / lights, y0 + 0.05, 0.07, y1 - y0 - w / 2 - 0.05, 0.18, 'frame');
    if (lights > 1) slab(b, f, t, y0 + (y1 - y0 - w / 2) * 0.62, w, 0.07, 0.18, 'frame');
    if (ring0) {
      // tracery in the head: a ring of circles round a central rose (w01-256)
      const cy = y1 - w / 2;
      ringSlab(b, f, t, cy, w * 0.13, w * 0.17, 0.25, 'frame', -0.05);
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (k / 6);
        ringSlab(b, f, t + Math.cos(a) * w * 0.33, cy + Math.sin(a) * w * 0.3, w * 0.06, w * 0.085, 0.25, 'frame', -0.05);
      }
    }
    slab(b, f, t, y0 - 0.16, w + 0.4, 0.14, 0.16, 'stone');
  };

  // ---------- west front (edge 23, w01-256) ----------
  {
    const {f} = ringFrame(ring, 23);
    arch(f, 8.7, 8.0, 16.4, 4.6, 6, true);
    arch(f, 4.05, 7.9, 13.0, 2.4, 3, true);
    arch(f, 13.2, 7.9, 13.0, 2.4, 3, true);
    for (const t of [4.1, 6.8, 8.65, 10.45, 13.1]) arch(f, t, 2.7, 6.0, 1.45, 1);
    // cornices of the side parts under the gable
    slab(b, f, 2.5, 14.0, 4.4, 0.4, 0.35, 'stone');
    slab(b, f, 13.8, 14.0, 2.9, 0.4, 0.35, 'stone');
  }

  // ---------- tower west face (edge 25, w07-255) ----------
  {
    const {f} = ringFrame(ring, 25);
    archBand(b, f, 2.6, 0.3, 3.4, 5.3, 0.6, 0.12, 'ochre');
    archSlab(b, f, 2.6, 0.3, 1.9, 4.5, 0.1, 'frame');
    archSlab(b, f, 2.6, 3.75, 1.75, 1.0, 0.14, 'glass');
    slab(b, f, 2.6, 0.35, 1.75, 3.35, 0.14, 'dark');
    for (const t of [1.1, 2.05, 3.05, 4.0]) {
      archBand(b, f, t, 7.1, 0.75, 1.25, 0.14, 0.08, 'ochre');
      archSlab(b, f, t, 7.2, 0.45, 1.0, 0.12, 'glass');
    }
    slab(b, f, 2.55, 6.85, 4.6, 0.14, 0.14, 'stone');
    slab(b, f, 2.85, 9.25, 5.5, 0.14, 0.12, 'stone');
    for (const t of [1.55, 3.55]) {
      archSlab(b, f, t, 12.5, 0.55, 5.45, 0.08, 'frame');
      archSlab(b, f, t, 12.55, 0.42, 5.35, 0.12, 'glass');
      slab(b, f, t, 12.35, 0.75, 0.14, 0.14, 'stone');
    }
  }
  // ---------- tower south face (edge 26, w08-165): small arched windows and the slits ----------
  {
    const {f} = ringFrame(ring, 26);
    for (const t of [1.5, 2.4, 3.3, 4.2]) {
      archBand(b, f, t, 7.1, 0.75, 1.25, 0.14, 0.08, 'ochre');
      archSlab(b, f, t, 7.2, 0.45, 1.0, 0.12, 'glass');
    }
    for (const t of [2.3, 3.4]) {
      archSlab(b, f, t, 3.0, 0.6, 2.2, 0.08, 'frame');
      archSlab(b, f, t, 3.05, 0.48, 2.1, 0.12, 'glass');
    }
    slab(b, f, 2.75, 9.25, 5.3, 0.14, 0.12, 'stone');
  }

  // ---------- parsonage (edge 2, w03-165) ----------
  {
    const {f} = ringFrame(ring, 2);
    slab(b, f, 4.8, 4.95, 8.6, 0.16, 0.12, 'stone');
    for (const t of [3.1, 5.4, 7.7]) {
      slab(b, f, t, 1.85, 1.85, 2.9, 0.08, 'frame');
      for (const s of [-0.45, 0.45]) slab(b, f, t + s, 1.9, 0.78, 2.8, 0.12, 'glass');
      slab(b, f, t, 1.85, 0.1, 2.9, 0.16, 'stone');
      for (const [y0, y1] of [[6.0, 8.6], [9.4, 11.6]] as [number, number][]) {
        slab(b, f, t, y0, 1.38, y1 - y0, 0.08, 'frame');
        slab(b, f, t, y0 + 0.05, 1.24, y1 - y0 - 0.1, 0.12, 'glass');
        slab(b, f, t, y0 + (y1 - y0) * 0.62, 1.24, 0.07, 0.16, 'frame');
        slab(b, f, t, y0 - 0.14, 1.5, 0.12, 0.14, 'stone');
      }
    }
  }

  // ---------- south front (edge 34, w04-164) ----------
  {
    const {f, len} = ringFrame(ring, 34);
    for (const k of [-1, 0, 1]) {
      const t = len / 2 + k * 2.05;
      arch(f, t, 9.0, 12.6, 1.15, 2);
      arch(f, t, 3.2, 6.6, 1.0, 1);
    }
    slab(b, f, len / 2, 8.55, len - 0.4, 0.16, 0.12, 'stone');
  }

  // ---------- porch (edge 21, w06-255): the wide entrance under a dark lintel ----------
  {
    const {f, len} = ringFrame(ring, 21);
    slab(b, f, len / 2 + 0.6, 0.0, 2.2, 2.9, 0.1, 'dark');
    slab(b, f, len / 2 + 0.6, 2.9, 2.5, 0.25, 0.14, 'stone');
    archSlab(b, f, 1.0, 1.0, 0.55, 1.4, 0.12, 'glass');
  }
  setSink(sink0);
}
