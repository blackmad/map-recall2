import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallBetween} from './worship-kit';
import {wallsOf, type Wall} from './worship-walls';
import {archBand, archSlab, frameOf, poly, put, setSink, slab, type Frame} from './nearbar-kit';
import source from './vrijburg-footprints.json';

/**
 * Vrijburg, Diepenbrockstraat 46 (Remonstrant church, 1931-33). Massing is the 3DBAG LoD2.2 shell in native east/south
 * metres: a 16.6 m wide nave under one very steep roof (ridge 21.9 m) that runs down to 4.2 m aisle walls, a low wing
 * at the NE end, and a slender square bell tower (27.4 m) beside the nave. Detail from the 2025 municipal panoramas
 * and a 2023 street photo:
 *  - SW street front: the tall triangular brick gable, a wide round-arched entrance with a stone arch ring, an
 *    organ-pipe group of seven narrow slit windows high in the gable and a small louvre near the apex;
 *  - NW and SE long sides: a low aisle wall with a stone ledge and a row of small windows, three gabled clerestory
 *    dormers each with a group of slender slit windows over a white stone sill;
 *  - NE wing and its entrance: white-framed windows in two storeys and a flat hood on slender posts over the door.
 */
type P2 = [number, number];
const front = wallBetween([-19.29, 10.63], [-8.8, 23.56], 21.9, [-0.777, 0.63]);
const nwAisle = wallBetween([-3.44, -4.45], [-16.33, 6.04], 4.1, [-0.631, -0.775]);
const seAisle = wallBetween([-4.18, 21.74], [15.91, 5.39], 4.1, [0.63, 0.777]);
const nwDormerLine = wallBetween([-14.0, 6.2], [-4.7, -1.1], 11.5, [-0.619, -0.788], 5.2);
const seDormerLine = wallBetween([7.8, 10.1], [-2.8, 18.6], 11.5, [0.625, 0.78], 5.2);

const tOf = (w: Wall, p: P2) => (p[0] - w.origin[0]) * w.tangent[0] + (p[1] - w.origin[1]) * w.tangent[1];

/** Group of narrow slit windows ("organ pipes"): brick piers between dark glass slits, sill below. */
function slits(b: BuildingTools, f: Frame, t: number, y: number, n: number, pitch: number, heights: number[]) {
  const w0 = pitch * 0.62;
  for (let k = 0; k < n; k++) {
    const tt = t + (k - (n - 1) / 2) * pitch;
    slab(b, f, tt, y, w0, heights[k], 0.1, 'glass', 0.03);
    slab(b, f, tt, y + heights[k], w0 + 0.1, 0.07, 0.14, 'stone');
  }
  slab(b, f, t, y - 0.14, n * pitch + 0.5, 0.14, 0.22, 'white');
}
function smallWindow(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  slab(b, f, t, y - 0.1, w + 0.25, 0.1, 0.18, 'stone');
  slab(b, f, t, y, w, h, 0.08, 'glass', 0.02);
  slab(b, f, t, y + h, w + 0.2, 0.1, 0.14, 'stone');
  slab(b, f, t, y, 0.05, h, 0.12, 'white', 0.02);
}
/** White-framed sash window with stone sill and lintel, one centre bar and a transom. */
function sash(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  slab(b, f, t, y - 0.1, w + 0.3, 0.1, 0.2, 'stone');
  slab(b, f, t, y, w, h, 0.06, 'glass', 0.02);
  slab(b, f, t, y + h, w + 0.2, 0.1, 0.16, 'stone');
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.03), y, 0.06, h, 0.1, 'white', 0.02);
  slab(b, f, t, y, 0.05, h, 0.1, 'white', 0.02);
  slab(b, f, t, y + h * 0.6, w, 0.05, 0.1, 'white', 0.02);
  slab(b, f, t, y, w, 0.05, 0.1, 'white', 0.02);
  slab(b, f, t, y + h - 0.05, w, 0.05, 0.1, 'white', 0.02);
}

export function buildVrijburg(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  setSink(0.55);   // 3DBAG walls step 0.1-0.5 m off the straight chords used for the frames

  // ---- SW front gable (apex at t = 8.3) ----
  {
    const f = frameOf(front), mid = front.length / 2;
    // entrance: stone arch ring, outer brick ring, double timber doors
    archBand(b, f, mid, 0, 5.2, 4.7, 0.34, 0.1, 'stone');
    archBand(b, f, mid, 0, 4.5, 4.2, 0.38, 0.14, 'brick');
    archSlab(b, f, mid, 0, 3.1, 3.5, 0.08, 'dark', 0.02);
    slab(b, f, mid, 0, 0.05, 3.0, 0.12, 'frame', 0.02);
    for (const s of [-1, 1]) slab(b, f, mid + s * 2.0, 0.9, 0.35, 0.16, 0.16, 'stone');
    // gable windows: seven slits, tallest in the middle
    slits(b, f, mid, 6.1, 7, 0.46, [3.0, 3.6, 4.2, 4.8, 4.2, 3.6, 3.0]);
    // apex louvre
    slab(b, f, mid, 16.6, 0.4, 1.3, 0.1, 'dark', 0.02);
    slab(b, f, mid, 17.9, 0.5, 0.1, 0.14, 'stone');
    // low string course at the aisle line
    slab(b, f, mid, 4.15, front.length - 0.4, 0.12, 0.1, 'stone');
  }

  // ---- long sides: aisle windows + clerestory dormers ----
  const aisleSide = (w: Wall, from: number, to: number, pitch: number, skip: [number, number] = [0, 0]) => {
    const f = frameOf(w);
    slab(b, f, w.length / 2, 3.75, w.length - 0.3, 0.14, 0.2, 'stone');
    slab(b, f, w.length / 2, 0, w.length, 0.4, 0.1, 'stone');
    for (let t = from; t <= to; t += pitch) if (t < skip[0] || t > skip[1]) smallWindow(b, f, t, 1.7, 0.6, 1.5);
  };
  aisleSide(nwAisle, 1.6, nwAisle.length - 1.2, 1.35, [6.9, 10.4]);
  aisleSide(seAisle, 1.6, seAisle.length - 1.2, 1.35);
  const dormers = (w: Wall, from: P2, to: P2, count: number) => {
    const f = frameOf(w);
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count, p: P2 = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
      slits(b, f, tOf(w, p), 6.4, 5, 0.46, [2.6, 3.0, 3.4, 3.0, 2.6]);
    }
    slab(b, f, w.length / 2, 5.05, w.length - 0.4, 0.14, 0.24, 'white');
  };
  dormers(nwDormerLine, [-14.0, 6.2], [-4.7, -1.1], 3);
  dormers(seDormerLine, [7.8, 10.1], [-2.8, 18.6], 3);

  // ---- NE wing: windows and the entrance hood on the NW face ----
  {
    const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
    for (const i of [27, 28]) {
      const w = walls.get(i)!, f = frameOf(w);
      for (const y of [1.6, 4.4]) sash(b, f, w.length / 2, y, 0.9, 1.3);
    }
  }
  {
    // gabled entrance porch on the NW aisle wall: timber doors between stone pilasters, slate roof, brick gable
    const f = frameOf(nwAisle), t = 8.65, W = 3.4, D = 1.9, H = 2.9, ap = 1.5;
    slab(b, f, t, 0, W, H, D, 'brick', 0);
    poly(b, f, t, H, [[-W / 2, 0], [W / 2, 0], [0, ap]], 0.2, 'brick', D - 0.2);
    const L = Math.hypot(W / 2 + 0.25, ap), ang = Math.atan2(ap, W / 2 + 0.25);
    for (const s of [-1, 1]) put(b, f, new T.BoxGeometry(L, 0.14, D + 0.3).rotateZ(-s * ang).translate(s * (W / 4 + 0.12), 0.35 + ap / 2, (D + 0.3) / 2 - 0.05), t, H, 0, 'slate');
    archSlab(b, f, t, 0, 1.9, 2.5, 0.06, 'dark', D);
    slab(b, f, t, 0, 0.05, 2.4, 0.1, 'frame', D);
    for (const s of [-1, 1]) { slab(b, f, t + s * 1.15, 0, 0.3, 2.9, 0.2, 'stone', D); slab(b, f, t + s * 1.15, 2.5, 0.38, 0.12, 0.26, 'stone', D); }
  }

  // ---- bell tower: stone cornice, tall green copper spire and finial (3DBAG ends the shaft in a flat roof at 27.4 m) ----
  {
    const cx = -1.05, cz = -5.8, rot = Math.PI / 4 + (48 * Math.PI) / 180;
    const cornice = new T.CylinderGeometry(2.35, 2.35, 0.3, 4); cornice.rotateY(rot);
    b.add(cornice, 'stone' as never, cx, 27.4 + 0.13, cz);
    const prof = [[1.45, 0], [1.3, 0.1], [1.05, 1.6], [0.7, 3.8], [0.4, 5.6], [0.18, 7.0], [0.05, 8.2]].map(p => new T.Vector2(p[0], p[1]));
    const spire = new T.LatheGeometry(prof, 8);
    b.add(spire, 'copper' as never, cx, 27.4 + 0.25, cz);
    b.add(new T.SphereGeometry(0.16, 6, 4), 'copper' as never, cx, 27.4 + 8.55, cz);
    b.add(new T.CylinderGeometry(0.03, 0.03, 1.4, 5), 'dark' as never, cx, 27.4 + 9.2, cz);
  }
}
