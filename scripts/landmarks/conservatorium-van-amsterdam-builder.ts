import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {disc, facePanel, getSink, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {wallsOf} from './worship-walls';
import {glyphRuns} from './mixed-case-glyphs';
import source from './conservatorium-van-amsterdam-footprints.json';

/**
 * CONSERVATORIUM VAN AMSTERDAM, Oosterdokskade 151 (BAG pand 0363100012164965, bouwjaar 2008; Frits van Dongen,
 * nl.wikipedia Conservatorium van Amsterdam). Massing is the 3DBAG LoD2.2 shell (conservatorium-van-amsterdam-footprints.json,
 * native east/south metres): a 73 x 22 m glass slab stepping 36.3 / 39.6 / 43.1 m from south to north, a 14.7 m block
 * at the north end. Detail from the Gemeente Amsterdam panoramas (CC BY 4.0), conservatorium-van-amsterdam-inventory.json:
 *  - the south front (ring vertices 2 .. 23, saw-toothed in 2.2 m steps; recording_2025-06-17_09-10-34_00583/00587,
 *    b_20241211_1256_Track02_Sphere_00003 2024): a dark green-grey curtain wall on a 2.2 m grid with storey transoms, the
 *    white two-line name "Conservatorium / van Amsterdam" with a white disc before it and a blue disc at the corner.
 *  - the west side (ring edge 0, 73 m; TMX7316010203-002856_pano_0008_000049 2022, b_20241211_1256_Track03_Sphere_00004):
 *    a screen of orange vertical fins over the upper storeys, glass with orange posts at the foot.
 *  - the east side (ring edge 24; b_20241211_1256_Track02_Sphere_00018): glass and concrete panel bands, transoms only.
 */
export function buildConservatoriumVanAmsterdam(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.1, true);
  const src = source as unknown as {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
  addShell(b, src as never, {wall: 'glass', roof: 'concrete'});
  b.mark?.('shell');
  const ring = src.nativeRing;
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface') as never;
  /** Wall top at frame position t: the roof height 0.6 m inside the face. */
  const topOf = (f: Frame, t: number) => {
    const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.6, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.6;
    return roofHeightAt(roofs, x, z) ?? 14.7;
  };
  /** Runs along a side (0.5 m samples) where the wall stands at least 0.5 m above y: a transom never crosses the sky. */
  const spans = (f: Frame, len: number, y: number) => {
    const out: [number, number][] = [];
    let start: number | null = null;
    for (let t = 0.2; t <= len - 0.2 + 1e-9; t += 0.5) {
      const ok = topOf(f, t) > y + 0.5;
      if (ok && start === null) start = t;
      if ((!ok || t + 0.5 > len - 0.2) && start !== null) { const end = ok ? t : t - 0.5; if (end - start > 1) out.push([start, end]); start = null; }
    }
    return out;
  };
  const STOREYS = [4.4, 8.6, 12.4, 16.2, 20.0, 23.8, 27.6, 31.4, 35.2, 39.0, 42.4];

  // ---- the south front: one frame across the saw-tooth (BAG vertices 2 .. 23), 0.3 m steps every 2.2 m ----
  {
    const p0 = ring[2], p1 = ring[23], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const tg: [number, number] = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
    // viewer's right facing the front from the south is east: t runs west to east, n points south (+z)
    const fixN: Frame = {origin: [p0[0], p0[1]], tangent: tg, n: [-tg[1], tg[0]]};
    const top = 36.0;
    for (let k = 0; k <= 10; k++) slab(b, fixN, 0.1 + (L - 0.2) * k / 10, 0, 0.14, top, 0.45, 'dark');
    for (const y of STOREYS) if (y < top) slab(b, fixN, L / 2, y, L - 0.1, 0.22, 0.42, 'dark');
    // the name, two lines, with the white disc before it and the blue disc at the west corner
    const lines: [string, number][] = [['Conservatorium', 25.0], ['van Amsterdam', 22.3]];
    const px = 0.19, x0 = 3.4;
    for (const [text, y] of lines) {
      const {runs} = glyphRuns(text, px);
      for (const r of runs) facePanel(b, fixN, x0 + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, 'stone', 0.5);
    }
    disc(b, fixN, x0 - 1.75, 24.0, 1.3, 0.05, 'stone', 0.46);
    disc(b, fixN, L - 0.9, 24.4, 0.75, 0.05, 'blue', 0.46);
  }

  // ---- the west side: orange fins over the upper storeys, orange posts at the foot ----
  {
    const {f, len} = ringFrame(ring, 0, 0.02);
    // where 3DBAG walls meet this face end-on (internal steps between the parts): no fin or post on them
    const [p0, p1] = [ring[0], ring[1]], L0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const ux = (p1[0] - p0[0]) / L0, uz = (p1[1] - p0[1]) / L0;
    const meets: number[] = [];
    for (const s of src.surfaces) if (s.type === 'WallSurface') for (const q of s.rings[0]) {
      const dx = q[0] - p0[0], dz = q[2] - p0[1], t = dx * ux + dz * uz;
      if (Math.abs(dx * uz - dz * ux) < 0.3 && t > 0.5 && t < L0 - 0.5 && !meets.some(m => Math.abs(m - t) < 0.2)) meets.push(t);
    }
    const clear = (t: number) => !meets.some(m => Math.abs(m - t) < 0.35);
    for (let t = 0.6; t < len - 0.4; t += 0.9) {
      if (!clear(t)) continue;
      const h = topOf(f, t);
      // no fin against a 3DBAG height step: its side would lie on the step's end wall
      if (Math.abs(topOf(f, t - 0.35) - topOf(f, t + 0.35)) > 1) continue;
      if (h > 20) slab(b, f, t, 9.0, 0.12, h - 9.3, 0.38, 'red');
    }
    for (let t = 1.2; t < len - 0.6; t += 2.4) if (clear(t)) slab(b, f, t, 0, 0.18, 8.6, 0.2, 'red');
    for (const y of STOREYS) for (const [a, c] of spans(f, len, y)) slab(b, f, (a + c) / 2, y, c - a, 0.2, 0.08, 'dark');
  }

  // ---- the east side: storey transoms on the glass ----
  {
    const {f, len} = ringFrame(ring, 24, 0.02);
    for (const y of STOREYS) for (const [a, c] of spans(f, len, y)) slab(b, f, (a + c) / 2, y, c - a, 0.2, 0.08, 'dark');
    for (let k = 0; k <= 30; k++) { const t = 0.15 + (len - 0.3) * k / 30, h = topOf(f, t); slab(b, f, t, 0, 0.1, h - 0.3, 0.1, 'dark'); }
  }
  // ---- the north face of the tall block over the 14.7 m north wing (3DBAG wall 29, its normal stored inward): glazed
  // storeys like the other faces (no capture of this face above the wing; inferred from the south and east fronts) ----
  {
    const w = wallsOf(src as never).find(x => x.index === 29)!;
    const end: [number, number] = [w.origin[0] + w.tangent[0] * w.length, w.origin[1] + w.tangent[1] * w.length];
    const f: Frame = {origin: end, tangent: [-w.tangent[0], -w.tangent[1]], n: [-w.n[0], -w.n[1]]};
    for (let y = 15.4; y + 2.6 < 42.8; y += 3.8) {
      facePanel(b, f, w.length / 2, y, w.length - 0.6, 2.6, 'glass', 0.06);
      slab(b, f, w.length / 2, y + 2.6, w.length - 0.4, 0.2, 0.1, 'dark');
    }
    for (let k = 0; k <= 10; k++) slab(b, f, 0.3 + (w.length - 0.6) * k / 10, 15.0, 0.12, 27.6, 0.12, 'dark');
  }
  setSink(sink0);
}
