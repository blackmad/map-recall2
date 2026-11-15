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
 *  - paired tall windows with flat stone lintels with ears, sills and impost blocks over continuous sill and lintel
 *    courses; pale stone reveals round dark green-black frames (repainted for the hotel: w08-329 2025, w23-59 2024); single
 *    wide ground-floor windows in the wings; a grey stone basement plinth with small basement lights;
 *  - the cream timber eave on brackets over the wings and the middle; a grey stone plinth.
 * Every other outer wall gets single windows at the w08-329 pitch and the string courses on the 3DBAG wall.
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
  /** One light (w08-329 2025, w23-59 2024): a pale stone reveal round a dark green-black sash frame, dark glass, a
   *  transom at 68 %, `bars` fine uprights. Layers 4 cm apart: reveal 0.10, frame 0.14,
   *  glass 0.18, bars 0.22. */
  const light = (fr: Frame, t: number, y0: number, y1: number, w: number, bars = 1) => {
    slab(b, fr, t, y0, w, y1 - y0, 0.1, 'sandstone');
    slab(b, fr, t, y0 + 0.08, w - 0.16, y1 - y0 - 0.16, 0.14, 'dark');
    slab(b, fr, t, y0 + 0.14, w - 0.28, y1 - y0 - 0.28, 0.18, 'glass');
    const yt = y0 + (y1 - y0) * 0.68, wi = w - 0.28;
    slab(b, fr, t, yt, wi, 0.07, 0.22, 'dark');
    // fine glazing bars (blind review 2026-11-15: the 5 cm cross read as heavy casement bars): uprights in the tall lower sash
    // and the shorter upper light, no cross bar
    for (let k = 1; k <= bars; k++) slab(b, fr, t - wi / 2 + (k * wi) / (bars + 1), y0 + 0.14, 0.03, y1 - y0 - 0.28, 0.22, 'dark');
  };
  /** Window of n lights: a flat stone lintel with ears, a stone sill, small impost blocks at the jambs, stone mullions
   *  between the lights (w01-59: lights 0.94-0.98 m, mullion 0.2 m; no quoined surround, blind re-read 2026-11-15). */
  const opening = (fr: Frame, t: number, y0: number, y1: number, n: number, lw = 0.98, gap = 0.22, bars = 1) => {
    const W = n * lw + (n - 1) * gap;
    slab(b, fr, t, y1 - 0.02, W + 0.5, 0.34, 0.09, 'sandstone');
    slab(b, fr, t, y0 - 0.16, W + 0.3, 0.16, 0.08, 'sandstone');
    for (const s of [-1, 1]) slab(b, fr, t + s * (W / 2 + 0.1), y0 + (y1 - y0) * 0.62, 0.2, 0.22, 0.06, 'sandstone');
    for (let i = 0; i < n; i++) light(fr, t - W / 2 + lw / 2 + i * (lw + gap), y0, y1, lw, bars);
    for (let i = 1; i < n; i++) slab(b, fr, t - W / 2 + i * (lw + gap) - gap / 2, y0, gap, y1 - y0, 0.06, 'sandstone');
  };
  /** Continuous stone string courses at sill and lintel level (w08-329, w23-59): 4 cm proud, under the 8-9 cm sills and lintels. */
  const courses = (fr: Frame, t0: number, t1: number, ok: (y: number, h: number) => boolean = () => true) => {
    for (const [y, h] of [[G2 - 0.14, 0.12], [5.82, 0.3], [F1 - 0.14, 0.12], [F2, 0.3]] as [number, number][]) if (ok(y, h)) slab(b, fr, (t0 + t1) / 2, y, t1 - t0, h, 0.04, 'sandstone');
  };

  // ---------- Mauritskade front ----------
  // grey stone basement plinth to 1.0 m with small basement lights under the windows (mk61-nw, above the 2022 hoarding)
  slab(b, f, 17.53, 0, 34.9, 0.98, 0.14, 'stone');
  const basement = (fr: Frame, t: number, n: number, lw = 0.95, gap = 0.36) => {
    const W = n * lw + (n - 1) * gap;
    for (let i = 0; i < n; i++) { const tc = t - W / 2 + lw / 2 + i * (lw + gap); slab(b, fr, tc, 0.32, lw - 0.1, 0.5, 0.18, 'dark'); slab(b, fr, tc, 0.38, lw - 0.24, 0.38, 0.22, 'glass'); }
  };
  for (const px of [125, 240, 1305, 1420, 1585]) basement(f, T(px), 1, 1.6);
  for (const px of [407, 547, 705, 845, 997, 1137]) basement(f, T(px), 2, 0.98, 0.22);
  const G1 = 0.0, G2 = 1.19, F1 = 7.94, F2 = 11.72;
  // wings: single ground-floor windows, paired first floor
  // wings: single ground-floor windows 1.64 m wide (w01-59: 80 px), two uprights
  for (const px of [125, 240, 1305, 1420, 1585]) opening(f, T(px), G2, 5.82, 1, 1.6, 0.22, 2);
  for (const px of [110, 252, 1292, 1432, 1587]) opening(f, T(px), F1, F2, 2);
  courses(f, 0.1, 34.96);
  // pavilions and middle: paired windows on both storeys
  for (const px of [407, 547, 705, 845, 997, 1137]) { opening(f, T(px), G2, 5.82, 2); opening(f, T(px), F1, F2, 2); }
  void G1;
  // stone band between the storeys across the pavilions
  for (const [a, z] of [[300, 660], [900, 1250]] as [number, number][]) slab(b, f, (T(a) + T(z)) / 2, 7.15, T(z) - T(a), 0.2, 0.08, 'sandstone');
  // cream timber eave on brackets over the wings and the middle
  for (const [a, z] of [[10, 300], [660, 900], [1250, 1690]] as [number, number][]) {
    const t0 = T(a), t1 = T(z);
    slab(b, f, (t0 + t1) / 2, EAVE - 0.25, t1 - t0 - 0.1, 0.25, 0.45, 'concrete');
    for (let t = t0 + 0.4; t < t1 - 0.2; t += 1.2) slab(b, f, t, EAVE - 0.6, 0.1, 0.35, 0.38, 'concrete');
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
    // (no stone corner piers: the pavilions are brick to the eave, blind review 2026-11-15)
    // eave band across the pavilion foot
    slab(b, f, c, EAVE - 0.3, 2 * hw - 0.9, 0.3, 0.1, 'sandstone');
    // segmental stone arch with a roundel over the four lights
    archBand(b, f, c, EAVE - 0.1, 6.0, 3.2, 0.35, 0.14, 'sandstone', 0, 14);
    slab(b, f, c, EAVE + 2.3, 0.5, 0.5, 0.2, 'sandstone');
    for (const [dt, h] of [[-1.85, 1.5], [-0.62, 1.95], [0.62, 1.95], [1.85, 1.5]] as [number, number][]) {
      archSlab(b, f, c + dt, EAVE + 0.05, 1.05, h, 0.1, 'sandstone');
      archSlab(b, f, c + dt, EAVE + 0.1, 0.9, h - 0.15, 0.14, 'dark');
      archSlab(b, f, c + dt, EAVE + 0.17, 0.76, h - 0.29, 0.18, 'glass');
      slab(b, f, c + dt, EAVE + 0.17, 0.05, h - 0.75, 0.22, 'dark');
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
    if (w.len < 2.4 || w.top < 7) return;
    const mid: [number, number] = [w.f.origin[0] + w.f.tangent[0] * w.len / 2, w.f.origin[1] + w.f.tangent[1] * w.len / 2];
    const onFront = Math.abs((mid[0] - f.origin[0]) * f.n[0] + (mid[1] - f.origin[1]) * f.n[1]) < 0.3 && Math.abs(w.f.n[0] * f.n[0] + w.f.n[1] * f.n[1]) > 0.99;
    if (onFront) { front.add(i); return; }
    // a wall the brief lists (bearing within 12 degrees, its centre near the wall line and within its span)
    // the building stands free on the Oosterpark edge: every outer wall is a street wall (mk61-nw: the NW bays have
    // three tall windows per storey), so a listed wall is preferred but not required
    const hit = !!inv.walls.find(iw => {
      const d = Math.abs(((iw.bearing - w.bearing + 540) % 360) - 180);
      if (d > 12) return false;
      const c = toNative(iw.centre), dx = c[0] - w.f.origin[0], dz = c[1] - w.f.origin[1];
      const along = dx * w.f.tangent[0] + dz * w.f.tangent[1], off = dx * w.f.n[0] + dz * w.f.n[1];
      return Math.abs(off) < 1.5 && along > -3 && along < w.len + 3;
    });
    void hit;
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
    // side walls (w08-329 2025: single windows 1.5 m wide at a 2.35 m pitch, centred, three on the 9.7 m wall); a narrow
    // bay (2.4-4 m) takes one window; the string courses run across the wall where they fit inside its polygon
    const n = w.len < 4 ? 1 : Math.max(1, Math.floor((w.len - 1.2) / 2.35));
    const lw = w.len < 4 ? Math.min(1.3, w.len - 1.0) : 1.45, half = lw / 2 + 0.35;
    for (let k = 0; k < n; k++) {
      const t = w.len / 2 + (k - (n - 1) / 2) * 2.35;
      if (fits(t, G2, 5.82, half)) opening(w.f as Frame, t, G2, 5.82, 1, lw, 0.22, 1);
      if (fits(t, F1, F2, half)) opening(w.f as Frame, t, F1, F2, 1, lw, 0.22, 1);
    }
    courses(w.f as Frame, 0.1, w.len - 0.1, (y, h) => [[0.1, y], [w.len - 0.1, y], [0.1, y + h], [w.len - 0.1, y + h]].every(([a, yy]) => inside(a, yy)));
  });
  setSink(sink0);
}
