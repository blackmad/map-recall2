import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {frameRing, onFramePlane, ownFront, signText, timberWindow} from './wallen-more-kit';
import source from './red-light-secrets-footprints.json';

/**
 * RED LIGHT SECRETS (Museum of Prostitution), Oudezijds Achterburgwal 60, De Wallen: two step-gabled twin houses of the
 * early seventeenth century (BAG 1610) whose one museum (VBO 60-H) spans both panden, 0363100012171848 (left from the canal)
 * and 0363100012172006 (right). Each front is red brick banded with white sandstone (speklagen): continuous white bands at
 * sill and head of every storey, white blocks set in the brick between them, white-framed cross windows in white block
 * surrounds, three axes on the two main storeys, two in the gable and one in the top step, five steps to a top block.
 * The ground storey of both is white-painted with tall windows lit red behind; the left house has its double door on the
 * right, the right house on the left; the museum's red neon "Red Light Secrets" runs over the souterrain entrance of the
 * right house.
 *
 * Read from the rectified Gemeente Amsterdam panoramas b_20250114_1026_Track06_Sphere_00141 (left front) and _00142 (right
 * front), 2025-01-14, and recording_2025-06-30_05-16-46_01522 (2025-06-30), at 100 px/m. Crop datum 0.4 m NAP; the model
 * stands on the 3DBAG ground of the right pand (0.88 m NAP; the left pand's 0.69 m ground is shifted into the same datum),
 * so heights are read off the crop minus 0.48 m. The 12.5 m north side of the right house is an alley wall under
 * scaffolding in every 2024-25 view and is left plain brick. Per item in red-light-secrets-inventory.json.
 */
type Src = {facadeRings: number[][][]; surfaces: Surface[]};
const src = source as unknown as Src;
const h = (y: number) => +(y - 0.48).toFixed(3);

/** Step gable outline (crop m): full width to 13.8, then steps of 0.55 m rising, 0.48 m in from each side, the top block 16.3. */
function stepTop(len: number) {
  const steps = [13.8, 14.35, 14.92, 15.48, 16.02];
  return (t: number) => {
    const d = Math.min(t, len - t);
    const k = Math.min(steps.length - 1, Math.floor(d / 0.5));
    if (k === steps.length - 1 && Math.abs(t - len / 2) < 0.35) return h(16.35);
    return h(steps[k]);
  };
}

export function buildRedLightSecrets(_w: number, _d: number, b: BuildingTools) {
  const fronts = [ringFrame(src.facadeRings[1], 5), ringFrame(src.facadeRings[0], 2)];
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => fronts.some(({f}) => onFramePlane(f)(s))});
  const sink0 = getSink();
  setSink(0);
  fronts.forEach(({f, len}, k) => {
    ownFront(b, f, len, stepTop(len), src.surfaces, 'brick', {coping: 'stone', copingW: 0.12, n: 48});
    upper(b, f, len);
    ground(b, f, len, k === 1);
  });
  setSink(sink0);
}

/** A white band across the front at y (crop m). */
const band = (b: BuildingTools, f: Frame, len: number, y: number, hh = 0.16, w = len) => slab(b, f, len / 2, h(y), w, hh, 0.04, 'stone');

/** A row of white sandstone blocks in a brick band at y (crop m) over t0..t1: bow-tie blocks (0.5 x 0.22 m, waisted) alternating with small diamonds, as cut on both fronts. */
function blocks(b: BuildingTools, f: Frame, t0: number, t1: number, y: number) {
  const n = Math.max(2, Math.round((t1 - t0) / 0.6));
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * i / n, yc = h(y) + 0.11;
    if (i % 2) poly(b, f, t, yc, [[0, -0.13], [0.13, 0], [0, 0.13], [-0.13, 0]], 0.05, 'stone', 0);
    else poly(b, f, t, yc, [[-0.25, -0.11], [-0.08, -0.05], [0.08, -0.05], [0.25, -0.11], [0.25, 0.11], [0.08, 0.05], [-0.08, 0.05], [-0.25, 0.11]], 0.05, 'stone', 0);
  }
}

/** A white-framed cross window in a white block surround, t centre, crop y0..y1. */
function win(b: BuildingTools, f: Frame, t: number, w: number, y0: number, y1: number) {
  timberWindow(b, f, t, h(y0), w, y1 - y0, {cols: 2, rows: 2, rowWeights: [0.8, 1], frame: 'frame', sill: null});
  for (let y = y0; y + 0.18 <= y1 + 0.01; y += 0.36) for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.14), h(y), 0.32, 0.18, 0.04, 'stone');
}

/** The upper storeys: three axes (t 18/50/82 %) at 6.85-8.4 and 9.4-10.95, two (28/72 %) at 12.15-13.25, one in the top step 14.85-15.5. */
function upper(b: BuildingTools, f: Frame, len: number) {
  const A3 = [0.18, 0.5, 0.82].map(p => p * len), A2 = [0.3, 0.7].map(p => p * len);
  for (const [y0, y1] of [[6.85, 8.4], [9.4, 10.95]]) {
    band(b, f, len, y0 - 0.16);
    band(b, f, len, y1);
    for (const t of A3) win(b, f, t, 1.05, y0, y1);
  }
  band(b, f, len, 5.95, 0.12);
  blocks(b, f, 0.3, len - 0.3, 6.15);
  blocks(b, f, 0.3, len - 0.3, 8.85);
  blocks(b, f, 0.3, len - 0.3, 11.45);
  band(b, f, len, 11.85, 0.14);
  for (const t of A2) win(b, f, t, 1.05, 12.15, 13.25);
  band(b, f, len, 13.35, 0.14);
  blocks(b, f, 0.6, len - 0.6, 14.1);
  win(b, f, len / 2, 0.75, 14.85, 15.5);
  band(b, f, len, 14.68, 0.12, len - 1.0);
}

/**
 * The white-painted ground storey (0.9-5.6 m crop) under a white cornice band: two tall windows lit red behind and a
 * double door with a transom; the left house has its door on the right (t 68-94 %), the right house on the left (t 3-29 %).
 * Below it the souterrain; over the right house's souterrain entrance the red neon sign.
 */
function ground(b: BuildingTools, f: Frame, len: number, right: boolean) {
  slab(b, f, len / 2, 0, len, h(5.6), 0.06, 'sandstone');
  slab(b, f, len / 2, h(5.45), len, 0.18, 0.14, 'sandstone', 0.06);
  slab(b, f, len / 2, 0, len, Math.max(0.1, h(0.9)), 0.08, 'greyBrick', 0.06);
  const door: [number, number] = right ? [0.03, 0.29] : [0.68, 0.94];
  const wins: [number, number][] = right ? [[0.36, 0.55], [0.67, 0.86]] : [[0.07, 0.27], [0.39, 0.58]];
  const [d0, d1] = door.map(p => p * len);
  timberWindow(b, f, (d0 + d1) / 2, h(4.0), d1 - d0, 1.05, {cols: 2, rows: 1, frame: 'frame', sill: null, out: 0.06});
  for (const s of [-1, 1]) slab(b, f, (d0 + d1) / 2 + s * (d1 - d0) / 4, h(1.0), (d1 - d0) / 2 - 0.04, 2.9, 0.06, 'green', 0.06);
  for (const [p0, p1] of wins) {
    const t0 = p0 * len, t1 = p1 * len, y0 = right ? 2.0 : 1.6;
    frameRing(b, f, (t0 + t1) / 2, h(y0) + 0.05, t1 - t0 - 0.06, 5.0 - y0, 0.06, 0.08, 'frame', 0.06);
    slab(b, f, (t0 + t1) / 2, h(y0) + 0.05, t1 - t0 - 0.06, 5.0 - y0, 0.03, 'red', 0.07);
    for (let k = 1; k < 4; k++) slab(b, f, (t0 + t1) / 2, h(y0) + (5.0 - y0) * k / 4, t1 - t0, 0.04, 0.03, 'frame', 0.12);
  }
  if (right) {
    slab(b, f, 0.66 * len, 0, 0.26 * len, Math.max(0.3, h(1.3)), 0.04, 'dark', 0.15);
    signText(b, f, 'Red Light Secrets', 0.68 * len, h(1.72), 0.1, {width: 3.0, height: 0.42, d: 0.05, colour: 'pink'});
  } else {
    slab(b, f, 0.33 * len, Math.max(0.05, h(0.45)), 0.8, 0.25, 0.04, 'pink', 0.08);
  }
}
