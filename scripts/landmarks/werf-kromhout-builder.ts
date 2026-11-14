import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {getSink, poly, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import source from './werf-kromhout-footprints.json';

/**
 * WERF 'T KROMHOUT, Hoogte Kadijk 147 (BAG pand 0363100012180688, the shipyard halls; museum of the Kromhout engine
 * works, nl.wikipedia Kromhout (bedrijf)). Massing is the 3DBAG LoD2.2 shell (werf-kromhout-footprints.json, native
 * east/south metres): two parallel pitched halls, ridges 12.6-13.0 m, eaves 7.2-8.0 m. Detail from the Gemeente Amsterdam
 * panoramas (CC BY 4.0), werf-kromhout-inventory.json:
 *  - the two gables on the Nieuwe Vaart (ring edge 16, 38.9 m; TMX7316010203-001983_pano_0001_000103, 2021-01-26): black
 *    boarded gables with white rakes, each filled by a huge yellow flattened arch over a glazed grid; "'T KROMHOUT" on the
 *    south-east arch with the blue MUSEUM board under it, "SCHEEPSWERF" on the north-west arch.
 *  - the water side to the north-west (w01-299, TMX7316010203-000353_pano_0003_000046 2017, TMX7316010203-001983_pano_0001_000074
 *    2021): an open steel-framed shed under the long corrugated roof, posts at about 6 m.
 *  - the south-west side stands behind the Hoogte Kadijk houses (other pands): shell only.
 */
export function buildWerfKromhout(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.15, true);
  const src = source as unknown as {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
  addShell(b, src as never, {wall: 'dark', roof: 'slate'});
  b.mark?.('shell');
  const ring = src.nativeRing;

  /** Flattened arch outline: vertical legs to `ys`, then a half-ellipse of half-width `a` and rise `r`, centred at x 0. */
  const archPts = (a: number, ys: number, r: number, n = 16): [number, number][] => {
    const pts: [number, number][] = [[-a, 0], [a, 0]];
    for (let i = 0; i <= n; i++) { const th = Math.PI * i / n; pts.push([a * Math.cos(th), ys + r * Math.sin(th)]); }
    return pts;
  };
  const archTop = (a: number, ys: number, r: number, x: number) => (Math.abs(x) >= a ? 0 : ys + r * Math.sqrt(1 - (x / a) ** 2));

  // ---- the two gables on the Nieuwe Vaart ----
  const {f: G} = ringFrame(ring, 16, 0.05);
  const gables = [
    {t0: 0.29, t1: 18.23, peak: 8.81, yl: 8.0, yr: 7.5, name: "'T KROMHOUT", museum: true},
    {t0: 18.23, t1: 38.9, peak: 28.05, yl: 7.5, yr: 7.2, name: 'SCHEEPSWERF', museum: false},
  ];
  const PEAK_Y = 12.6;
  for (const g of gables) {
    const tc = g.peak, a = Math.min(tc - g.t0, g.t1 - tc) - 0.55, ys = 5.4, rise = 4.6, th = 0.8;
    // glazed infill and its grid of iron glazing bars
    poly(b, G, tc, 0, archPts(a - th + 0.05, ys, rise - th + 0.05), 0.02, 'glass', 0);
    for (let x = -a + th + 1.0; x < a - th - 0.5; x += 1.0) slab(b, G, tc + x, 0, 0.08, archTop(a - th, ys, rise - th, x) - 0.02, 0.03, 'dark', 0.03);
    for (let y = 1.2; y < ys + rise - th - 0.3; y += 1.2) {
      const half = y <= ys ? a - th : (a - th) * Math.sqrt(Math.max(0, 1 - ((y - ys) / (rise - th)) ** 2));
      if (half > 0.3) slab(b, G, tc, y, 2 * half - 0.04, 0.08, 0.03, 'dark', 0.03);
    }
    // the yellow arch band
    const outer = archPts(a, ys, rise), inner = archPts(a - th, ys, rise - th);
    const band: [number, number][] = [[-a, 0], ...outer.slice(2).reverse(), [a, 0], [a - th, 0], ...inner.slice(2), [-(a - th), 0]];
    poly(b, G, tc, 0, band, 0.06, 'gold', 0.03);
    // the name along the band, letters turned with the curve
    const px = 0.075, {runs, width} = glyphRuns(g.name, px);
    const am = a - th / 2, rm = rise - th / 2;
    // arc-length table round the mid-line of the band
    const N = 400, s: number[] = [0];
    const at = (k: number) => { const t = Math.PI * k / N; return [am * Math.cos(t), ys + rm * Math.sin(t)]; };
    for (let k = 1; k <= N; k++) { const p = at(k), q = at(k - 1); s.push(s[k - 1] + Math.hypot(p[0] - q[0], p[1] - q[1])); }
    const pointAt = (len: number) => {
      // len measured from the left end (theta = pi) along the arc
      const target = s[N] - len; let k = 1; while (k < N && s[k] < target) k++;
      const u = (target - s[k - 1]) / (s[k] - s[k - 1]), p = at(k - 1), q = at(k);
      return {x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, ang: Math.atan2(p[1] - q[1], p[0] - q[0])};
    };
    const start = s[N] / 2 - width / 2;
    let cIdx = 0;
    for (const ch of g.name) {
      const one = glyphRuns(ch, px);
      const c0 = cIdx * 6 * px; cIdx++;
      if (!one.runs.length) continue;
      const mid = pointAt(start + c0 + 2.5 * px);
      for (const r of one.runs) {
        const geo = new T.BoxGeometry(r.t1 - r.t0, r.y1 - r.y0, 0.03)
          .translate((r.t0 + r.t1) / 2 - 2.5 * px, (r.y0 + r.y1) / 2 - 3.5 * px, 0.015)
          .rotateZ(mid.ang)
          .translate(mid.x, mid.y, 0);
        put(b, G, geo, tc, 0, 0.09, 'dark');
      }
    }
    void runs;
    if (g.museum) {
      slab(b, G, tc, 7.35, 2.9, 0.75, 0.05, 'blue', 0.03);
      const m = glyphRuns('MUSEUM', 0.075);
      for (const r of m.runs) slab(b, G, tc - m.width / 2 + (r.t0 + r.t1) / 2, 7.46 + r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.02, 'white', 0.08);
    }
    // white rakes along both slopes, inside the gable outline
    for (const [xe, ye] of [[g.t0 - tc, g.yl], [g.t1 - tc, g.yr]] as const) {
      const len = Math.hypot(xe, PEAK_Y - ye), ux = -xe / len, uy = (PEAK_Y - ye) / len;
      // start 0.6 m up the slope: at the valley the two gables' walls meet and a band to the eaves overhangs the joint
      const x0 = xe + ux * 0.6, y0 = ye + uy * 0.6;
      const [nx, ny] = x0 < 0 ? [uy, -ux] : [-uy, ux];
      const k0 = 0.06, k1 = 0.42;
      poly(b, G, tc, 0, [[x0 + nx * k0, y0 + ny * k0], [nx * k0, PEAK_Y + ny * k0], [nx * k1, PEAK_Y + ny * k1], [x0 + nx * k1, y0 + ny * k1]], 0.05, 'stone', 0.02);
    }
  }

  // ---- the open water side: steel posts and the eaves beam along ring edge 17 (50 m) ----
  {
    const {f, len} = ringFrame(ring, 17, 0.05);
    const n = 8;
    for (let k = 0; k <= n; k++) slab(b, f, 0.6 + (len - 1.2) * k / n, 0, 0.25, 6.9, 0.25, 'greyBrick');
    slab(b, f, len / 2, 6.9, len - 1.0, 0.4, 0.3, 'greyBrick');
  }
  setSink(sink0);
}
