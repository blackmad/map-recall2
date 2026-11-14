import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archBand, archSlab, disc, facePanel, letters, poly, ringFrame, ringSlab, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './rijksakademie-footprints.json';

/**
 * RIJKSAKADEMIE VAN BEELDENDE KUNSTEN, Sarphatistraat 470 (BAG pand 0363100012165748, bouwjaar 1864, rijksmonument): the
 * Oranje-Nassaukazerne cavalry barracks, since 1992 the national academy of fine art (nl.wikipedia Sarphatistraat 470).
 * Massing is the 3DBAG LoD2.2 shell (rijksakademie-footprints.json, native east/south metres); detail from the Gemeente
 * Amsterdam panoramas (CC BY 4.0), rijksakademie-inventory.json:
 *  - Sarphatistraat (w04/w05-342, TMX7316010203-001675_pano_0000_006181 2020 and TMX7315120208-000070_pano_0014_000105
 *    2016): two 34 m brown-brick ranges of two storeys, each with seven pairs of round-headed white-framed windows per
 *    storey, a central door with an arched fanlight, iron wall anchors and a white eaves cornice under the tiled roof.
 *  - the entrance pavilion (w12-342, TMX7316010203-001675_pano_0000_006176): a white pediment over a white entablature,
 *    three pairs of round-headed windows, the KAVALLERIE-KAZERNE plaque and the arched gateway.
 *  - the north-east gable (w09-342, TMX7316010203-000190_pano_0000_002073): an oculus over three arched openings.
 *  - the Singelgracht range (w02-162, TMX7316010203-001984_pano_0000_000252 2021): one tall storey of round-headed windows.
 *  - the modern studio blocks on the water side (w10/w11/w13/w14/w22) keep the 3DBAG shell; the west side has no capture.
 */
export function buildRijksakademie(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.2, true);
  const src = source as unknown as {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
  addShell(b, src as never, {wall: 'brick', roof: 'red'});
  b.mark?.('shell');
  const ring = src.nativeRing;
  /** Detail planes stand 5 cm proud of the BAG line: the 3DBAG walls wander a few cm either side of it. */
  const OFF = 0.05;

  /** Round-headed window in a white frame: glass, white ring, mullion and transom, a stone sill. */
  const arched = (f: Frame, t: number, y0: number, y1: number, w: number) => {
    archSlab(b, f, t, y0, w, y1 - y0, 0.03, 'glass', 0, 8);
    archBand(b, f, t, y0, w + 0.12, y1 - y0 + 0.06, 0.1, 0.07, 'white', 0, 8);
    facePanel(b, f, t, y0, 0.06, y1 - y0 - w / 2, 'white', 0.08);
    facePanel(b, f, t, y1 - w / 2 - 0.04, w - 0.04, 0.06, 'white', 0.08);
    slab(b, f, t, y0 - 0.12, w + 0.25, 0.12, 0.12, 'stone');
  };
  const pair = (f: Frame, t: number, y0: number, y1: number, w: number, gap: number) => {
    for (const s of [-1, 1]) arched(f, t + s * (w + gap) / 2, y0, y1, w);
  };
  /** Iron wall anchor: a small cross of two flat bars. */
  const anchor = (f: Frame, t: number, y: number) => {
    slab(b, f, t, y - 0.18, 0.06, 0.36, 0.04, 'dark');
    slab(b, f, t - 0.18, y - 0.03, 0.36, 0.06, 0.04, 'dark');
  };

  // ---- the two Sarphatistraat ranges (ring edges 45 and 55, 34.4 m, eaves 11.1 m) ----
  for (const i of [45, 55]) {
    const {f, len} = ringFrame(ring, i, OFF);
    const n = 7, pitch = len / n;
    for (let k = 0; k < n; k++) {
      const t = pitch * (k + 0.5);
      if (k === 3) {
        // central door with an arched fanlight
        archSlab(b, f, t, 0, 1.5, 3.6, 0.03, 'dark', 0, 8);
        archBand(b, f, t, 0, 1.7, 3.7, 0.1, 0.07, 'white', 0, 8);
        facePanel(b, f, t, 2.7, 1.3, 0.08, 'white', 0.08);
        archSlab(b, f, t, 2.78, 1.3, 0.7, 0.02, 'glass', 0.08, 8);
      } else pair(f, t, 1.0, 3.5, 0.85, 0.35);
      pair(f, t, 5.5, 8.5, 0.9, 0.35);
      if (k > 0) { anchor(f, pitch * k, 4.5); anchor(f, pitch * k, 9.6); }
    }
    slab(b, f, len / 2, 10.55, len - 0.1, 0.5, 0.3, 'white');
    // plinth course, broken at the door
    const d0 = pitch * 3.5 - 0.9, d1 = pitch * 3.5 + 0.9;
    for (const [p0, p1] of [[0.05, d0], [d1, len - 0.05]]) slab(b, f, (p0 + p1) / 2, 0, p1 - p0, 0.5, 0.02, 'stone');
  }

  // ---- the entrance pavilion (BAG vertices 49 .. 51, 13.5 m, 3DBAG pediment apex 13.3 m at mid-front) ----
  {
    const {f} = ringFrame(ring, 49);
    // ringFrame on the first piece; extend the frame across the three collinear pieces
    const p0 = ring[49], p1 = ring[52], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const sameDir = f.tangent[0] * (p1[0] - p0[0]) + f.tangent[1] * (p1[1] - p0[1]) > 0;
    const o = sameDir ? p0 : p1;
    const F: Frame = {origin: [o[0] + f.n[0] * OFF, o[1] + f.n[1] * OFF], tangent: f.tangent, n: f.n};
    for (const t of [L / 6, L / 2, 5 * L / 6]) pair(F, t, 5.5, 8.5, 0.9, 0.35);
    for (const t of [L / 6, 5 * L / 6]) pair(F, t, 1.0, 3.5, 0.85, 0.35);
    for (const t of [L / 3, 2 * L / 3]) { anchor(F, t, 4.6); anchor(F, t, 9.2); }
    // arched gateway
    archSlab(b, F, L / 2, 0, 2.6, 4.2, 0.03, 'dark', 0, 10);
    archBand(b, F, L / 2, 0, 2.9, 4.35, 0.15, 0.08, 'stone', 0, 10);
    // KAVALLERIE-KAZERNE plaque
    slab(b, F, L / 2, 4.42, 3.4, 0.36, 0.05, 'dark');
    letters(b, F, 'KAVALLERIE-KAZERNE', L / 2, 4.45, 0.05, 0.029, 0.02, 'white', 0.034);
    // entablature, pediment base and raking cornices
    slab(b, F, L / 2, 10.3, L - 0.1, 0.55, 0.35, 'white');
    slab(b, F, L / 2, 10.85, L - 0.1, 0.3, 0.45, 'white');
    const apexT = L / 2, apexY = 13.25, eaveY = 11.3;
    for (const s of [-1, 1]) {
      const x0 = s * (L / 2 - 0.05), y0 = eaveY, x1 = 0, y1 = apexY, len = Math.hypot(x1 - x0, y1 - y0), k = 0.32;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len, [px, py] = s < 0 ? [uy, -ux] : [-uy, ux];
      poly(b, F, apexT, 0, [[x0 + px * 0.08, y0 + py * 0.08], [x1 + px * 0.08, y1 + py * 0.08], [x1 + px * k, y1 + py * k], [x0 + px * k, y0 + py * k]], 0.4, 'white');
    }
  }

  // ---- the north-east gable (ring edge 31, 18.6 m): oculus over three arched openings ----
  {
    const {f, len} = ringFrame(ring, 31, OFF);
    ringSlab(b, f, len / 2, 8.4, 0.62, 0.8, 0.08, 'stone', 0, 20);
    disc(b, f, len / 2, 8.4, 0.62, 0.04, 'glass', 0);
    archSlab(b, f, len / 2, 0.6, 2.2, 3.8, 0.03, 'glass', 0, 10);
    archBand(b, f, len / 2, 0.6, 2.5, 3.95, 0.15, 0.07, 'stone', 0, 10);
    for (const s of [-1, 1]) arched(f, len / 2 + s * 4.6, 1.0, 3.6, 1.1);
  }

  // ---- the Singelgracht range (ring edge 65, 29.2 m, eaves 8.1 m): one tall storey of round-headed windows ----
  {
    const {f, len} = ringFrame(ring, 65, OFF);
    const n = 8;
    for (let k = 0; k < n; k++) arched(f, len * (k + 0.5) / n, 1.4, 5.4, 1.35);
    slab(b, f, len / 2, 7.6, len - 0.1, 0.45, 0.25, 'white');
  }
  setSink(sink0);
}
