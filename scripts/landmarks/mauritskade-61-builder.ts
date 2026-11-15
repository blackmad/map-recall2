import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {rawWall} from './big-kit';
import {archSlab, archBand, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './mauritskade-61-footprints.json';
import inventory from './mauritskade-61-inventory.json';

/**
 * MAURITSKADE 61 (BAG pand 0363100012153693, gemeentelijk monument 200984, 1908): the former laboratory building on the
 * north edge of the Oosterpark, "zorgvuldig uitgevoerde metselwerk, de houten kozijnen en het daklandschap" (municipal
 * register, cited in the brief). Massing: the 3DBAG LoD2.2 shell (mauritskade-61-footprints.json, bag-shell-prepare.ts):
 * brick to the 13.8 m eave, red-brown tiled roofs, the two front gables to 19.2 m. The Mauritskade front is facade-ring edge
 * 45 (35.06 m, flat at the 3DBAG plane), read from the rectified Gemeente Amsterdam panorama
 * TMX7316010203-001209_pano_0000_000078 (2019, CC BY 4.0): 48.8 px/m across, heights scaled 1.29 to the 3DBAG eave.
 *  - two stepped stone-coped gables (t 6.05-13.57 and 18.6-25.9) with four arched lights under a segmental stone arch and a
 *    scrolled finial;
 *  - paired tall windows with cream stone surrounds and quoined jambs, white frames with many-paned upper sashes, on both
 *    storeys; single wide ground-floor windows in the wings;
 *  - the cream timber eave on brackets over the wings and the middle; a grey stone plinth.
 * Every other photographed or inferred street wall of the brief gets the same paired-window system on the 3DBAG wall.
 */
export function buildMauritskade61(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; anchor: [number, number]};
  addShell(b, src as never, {wall: 'brick', roof: 'red'});
  const sink0 = getSink();
  setSink(0.05);
  const {f} = ringFrame(src.facadeRing, 45);
  const T = (px: number) => (px - 10) * 0.02087; // photo x (w01-59.jpg) to t along the front
  const EAVE = 13.8;

  // layers on the wall plane: surround 0.06, frame 0.1, glass 0.14, bars 0.18 (sunk 5 cm behind, as the Schiller front)
  /** One light: white frame, glass, a transom at 70 %, vertical glazing bars in the upper sash. */
  const light = (fr: Frame, t: number, y0: number, y1: number, w: number) => {
    slab(b, fr, t, y0, w, y1 - y0, 0.1, 'white');
    slab(b, fr, t, y0 + 0.07, w - 0.14, y1 - y0 - 0.14, 0.14, 'glass');
    const yt = y0 + (y1 - y0) * 0.68;
    slab(b, fr, t, yt, w - 0.14, 0.07, 0.18, 'white');
    slab(b, fr, t, y0 + 0.07, 0.06, yt - y0 - 0.07, 0.18, 'white');
    for (const k of [-1, 0, 1]) slab(b, fr, t + k * (w - 0.14) / 4, yt + 0.07, 0.04, y1 - yt - 0.14, 0.18, 'white');
  };
  /** Window opening of n lights with a cream stone surround: lintel, sill and quoined jambs. */
  const opening = (fr: Frame, t: number, y0: number, y1: number, n: number, lw = 0.95, gap = 0.36) => {
    const W = n * lw + (n - 1) * gap;
    slab(b, fr, t, y1, W + 0.5, 0.32, 0.06, 'sandstone');
    slab(b, fr, t, y0 - 0.18, W + 0.4, 0.16, 0.08, 'sandstone');
    for (const s of [-1, 1]) for (let y = y0, k = 0; y < y1 - 0.1; y += 0.45, k++) slab(b, fr, t + s * (W / 2 + (k % 2 ? 0.1 : 0.14)), y, k % 2 ? 0.2 : 0.28, 0.32, 0.06, 'sandstone');
    for (let i = 0; i < n; i++) light(fr, t - W / 2 + lw / 2 + i * (lw + gap), y0, y1, lw);
    if (n > 1) for (let i = 1; i < n; i++) slab(b, fr, t - W / 2 + i * (lw + gap) - gap / 2, y0, gap - 0.04, y1 - y0, 0.06, 'sandstone');
  };

  // ---------- Mauritskade front ----------
  slab(b, f, 17.53, 0, 34.9, 0.6, 0.14, 'stone');
  const G1 = 0.0, G2 = 1.19, F1 = 7.94, F2 = 11.72;
  // wings: single ground-floor windows, paired first floor
  for (const px of [120, 240]) opening(f, T(px), G2 + 0.0, 5.82, 1, 1.35);
  for (const px of [1300, 1415, 1585]) opening(f, T(px), G2, 5.82, 1, 1.35);
  for (const px of [110, 250, 1300, 1440, 1590]) opening(f, T(px), F1, F2, 2);
  // pavilions and middle: paired windows on both storeys
  for (const px of [410, 550, 705, 845, 990, 1140]) { opening(f, T(px), G2, 5.82, 2); opening(f, T(px), F1, F2, 2); }
  void G1;
  // stone band between the storeys across the pavilions
  for (const [a, z] of [[300, 660], [900, 1250]] as [number, number][]) slab(b, f, (T(a) + T(z)) / 2, 7.15, T(z) - T(a), 0.2, 0.08, 'sandstone');
  // cream timber eave on brackets over the wings and the middle
  for (const [a, z] of [[10, 300], [660, 900], [1250, 1690]] as [number, number][]) {
    const t0 = T(a), t1 = T(z);
    slab(b, f, (t0 + t1) / 2, EAVE - 0.35, t1 - t0 - 0.1, 0.35, 0.75, 'concrete');
    for (let t = t0 + 0.4; t < t1 - 0.2; t += 0.9) slab(b, f, t, EAVE - 0.85, 0.14, 0.5, 0.6, 'concrete');
  }
  // the two gables: brick face with stepped stone coping, four arched lights under a segmental stone arch, scrolled finial
  for (const [a, z] of [[300, 660], [900, 1250]] as [number, number][]) {
    const t0 = T(a), t1 = T(z), c = (t0 + t1) / 2, hw = (t1 - t0) / 2;
    // stepped coping: shoulders at the eave, then five steps to the apex at 19.6 m
    const steps: [number, number][] = [[hw, EAVE + 0.4], [hw - 0.6, EAVE + 1.6], [hw - 1.3, EAVE + 2.6], [hw - 1.9, EAVE + 3.5], [hw - 2.6, EAVE + 4.4], [hw - 3.2, EAVE + 5.3]];
    // brick gable face over the 3DBAG gable (its LoD2 triangle is narrower than the stepped outline in the photo)
    {
      const out: [number, number][] = [];
      steps.forEach(([x, y], i) => { const yp = i ? steps[i - 1][1] : 0; out.push([x, yp - EAVE + (i ? 0 : 0)], [x, y - EAVE]); });
      out[0] = [hw, -0.05];
      const top = EAVE + 5.3;
      const right = out.concat([[steps[steps.length - 1][0] - 0.3, top - EAVE]]), left = right.slice().reverse().map(([x, y]) => [-x, y] as [number, number]);
      setSink(0); poly(b, f, c, EAVE, [...right, ...left], 0.04, 'brick', 0); setSink(0.05);
    }
    for (const [x, y] of steps) for (const s of [-1, 1]) slab(b, f, c + s * (x - 0.3), y - 0.25, 0.75, 0.3, 0.12, 'sandstone');
    slab(b, f, c, EAVE + 5.3, 0.9, 0.6, 0.14, 'sandstone');
    poly(b, f, c, EAVE + 5.9, [[-0.35, 0], [0.35, 0], [0.35, 0.4], [0, 0.75], [-0.35, 0.4]], 0.14, 'sandstone', 0);
    // stone corner piers of the pavilion up to the shoulders
    for (const s of [-1, 1]) slab(b, f, c + s * (hw - 0.5), 0.6, 0.44, EAVE - 0.2, 0.1, 'sandstone');
    // eave band across the pavilion foot
    slab(b, f, c, EAVE - 0.3, 2 * hw - 0.9, 0.3, 0.1, 'sandstone');
    // segmental stone arch with a roundel over the four lights
    archBand(b, f, c, EAVE - 0.1, 6.0, 3.2, 0.35, 0.14, 'sandstone', 0, 14);
    slab(b, f, c, EAVE + 2.3, 0.5, 0.5, 0.2, 'sandstone');
    for (const [dt, h] of [[-1.85, 1.5], [-0.62, 1.95], [0.62, 1.95], [1.85, 1.5]] as [number, number][]) {
      archSlab(b, f, c + dt, EAVE + 0.05, 1.05, h, 0.1, 'sandstone');
      archSlab(b, f, c + dt, EAVE + 0.1, 0.9, h - 0.15, 0.14, 'white');
      archSlab(b, f, c + dt, EAVE + 0.17, 0.76, h - 0.29, 0.18, 'glass');
      slab(b, f, c + dt, EAVE + 0.17, 0.05, h - 0.75, 0.22, 'white');
    }
  }

  // ---------- every other street wall in the brief: the same paired windows on the 3DBAG wall ----------
  const inv = inventory as unknown as {walls: {tag: string; bearing: number; centre: [number, number]}[]};
  const anchor = src.anchor;
  const toNative = (ll: [number, number]): [number, number] => [(ll[0] - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), -(ll[1] - anchor[1]) * 111320];
  const front = new Set<number>();
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(src as never, i);
    if (w.len < 3.2 || w.top < 7) return;
    const mid: [number, number] = [w.f.origin[0] + w.f.tangent[0] * w.len / 2, w.f.origin[1] + w.f.tangent[1] * w.len / 2];
    const onFront = Math.abs((mid[0] - f.origin[0]) * f.n[0] + (mid[1] - f.origin[1]) * f.n[1]) < 0.3 && Math.abs(w.f.n[0] * f.n[0] + w.f.n[1] * f.n[1]) > 0.99;
    if (onFront) { front.add(i); return; }
    // a wall the brief lists (bearing within 12 degrees, its centre near the wall line and within its span)
    const hit = inv.walls.find(iw => {
      const d = Math.abs(((iw.bearing - w.bearing + 540) % 360) - 180);
      if (d > 12) return false;
      const c = toNative(iw.centre), dx = c[0] - w.f.origin[0], dz = c[1] - w.f.origin[1];
      const along = dx * w.f.tangent[0] + dz * w.f.tangent[1], off = dx * w.f.n[0] + dz * w.f.n[1];
      return Math.abs(off) < 1.5 && along > -3 && along < w.len + 3;
    });
    if (!hit) return;
    const n = Math.max(1, Math.floor((w.len - 0.8) / 3.0));
    const pitch = w.len / n;
    const pair = pitch >= 2.9;
    // only where the whole opening, surround included, lies inside the 3DBAG wall polygon (t, y)
    const inside = (t: number, y: number) => {
      let c = false;
      for (let i = 0, j = w.poly.length - 1; i < w.poly.length; j = i++) {
        const [xi, yi] = w.poly[i], [xj, yj] = w.poly[j];
        if ((yi > y) !== (yj > y) && t < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const fits = (t: number, y0: number, y1: number, half: number) => [[t - half, y0 - 0.3], [t + half, y0 - 0.3], [t - half, y1 + 0.4], [t + half, y1 + 0.4]].every(([a, y]) => inside(a, y));
    for (let k = 0; k < n; k++) {
      const t = pitch * (k + 0.5), half = pair ? 1.45 : 0.85;
      if (fits(t, G2, 5.82, half)) opening(w.f as Frame, t, G2, 5.82, pair ? 2 : 1, pair ? 0.95 : 1.1);
      if (fits(t, F1, F2, half)) opening(w.f as Frame, t, F1, F2, pair ? 2 : 1, pair ? 0.95 : 1.1);
    }
  });
  setSink(sink0);
}
