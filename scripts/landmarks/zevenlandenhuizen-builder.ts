import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {archBand, archSlab, poly, put, ringFrame, setSink, slab, wallProbe} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {archRing, archedWindow, carve, cyl, horseshoeSlab, ogeeSlab, onion, oriel, pointedSlab, pyramid, shapeSlab} from './zevenlandenhuizen-kit';
import source from './zevenlandenhuizen-footprints.json';

/**
 * Zevenlandenhuizen, Roemer Visscherstraat 20-30a (Tjeerd Kuipers, 1894): seven neighbouring panden, each a
 * house "in the style of" one country, built as one row. One GLB covers the seven 3DBAG LoD2.2 shells
 * (west to east: England 30a, Netherlands 30, Russia 28, Italy 26, Spain 24, France 22, Germany 20). The row
 * runs ENE-WSW and faces SSE (bearing 156), so every front is authored on the shared row frame:
 * u along the row (east, viewer's right), v out of the front, t = u - the house's west party wall.
 *
 * Front compositions are measured by eye from the RCE frontal photographs of 2003 (20350174-20350181) and the
 * 2008/2016 Commons views; heights are scaled to the 3DBAG wall tops. Lettering is the carved country name
 * on each front (an architectural feature of the row), set in an approximate pixel-capital match.
 *
 * Palette (repurposed, see the spec's materialOverrides): brick = Dutch brown brick, red = German/English red
 * brick, greyBrick = dark engobed brick, stone = white trim/stucco, white = Italian cream, concrete = French
 * cream, pink = Spanish red stripes, bronze = French window green, green = Russian onion verdigris,
 * blue = scaled blue-grey domes, gold = ochre brick infill and finials, ochre = dark red-brown joinery,
 * copper = grey plinth stone, slate, glass, frame (window white), dark (ironwork/doors), red also tile roofs.
 */
const DX = 0.914, DZ = -0.407, NX = 0.407, NZ = 0.914;
const frameAt = (u: number, v: number): Frame => ({origin: [u * DX + v * NX, u * DZ + v * NZ], tangent: [DX, DZ], n: [NX, NZ]});

type H = {key: string; i: number; u0: number; W: number; wall: string; roof: string};
const HOUSES: H[] = [
  {key: 'de', i: 0, u0: 11.93, W: 5.55, wall: 'red', roof: 'red'},
  {key: 'fr', i: 1, u0: 5.95, W: 6.05, wall: 'concrete', roof: 'slate'},
  {key: 'es', i: 2, u0: -0.2, W: 6.2, wall: 'stone', roof: 'slate'},
  {key: 'it', i: 3, u0: -5.87, W: 5.7, wall: 'white', roof: 'slate'},
  {key: 'ru', i: 4, u0: -12.17, W: 6.4, wall: 'stone', roof: 'slate'},
  {key: 'nl', i: 5, u0: -17.9, W: 5.8, wall: 'brick', roof: 'red'},
  {key: 'en', i: 6, u0: -23.78, W: 5.95, wall: 'red', roof: 'red'},
];
const house = (k: string) => HOUSES.find(h => h.key === k)!;

export function buildZevenlandenhuizen(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const shell: T.BufferGeometry[] = [];
  const shellTools = {...b, add: (g: T.BufferGeometry, c: never, x?: number, y?: number, z?: number, a?: number) => { shell.push(g.clone()); b.add(g, c, x, y, z, a); }} as BuildingTools;
  const homes = (source as {houses: {surfaces: Surface[]; nativeRing: number[][]}[]}).houses;
  for (const h of HOUSES) {
    const src = patchedSource(h, homes[h.i]);
    addShell(shellTools, src as never, {wall: h.wall, roof: h.roof, skip: (_s, k) => h.key === 'fr' || (SKIP[h.key]?.has(k) ?? false)});
  }
  frenchShell(shellTools, homes[1].nativeRing);
  b.mark?.('shell');
  setSink(0.3);
  const probe = wallProbe(shell);
  // Foundation bars straddling each party wall (hidden inside the row): the BAG panden stand a few cm apart,
  // so the seven shells would otherwise audit as seven detached bodies instead of one terrace.
  for (let k = 0; k + 1 < HOUSES.length; k++) {
    const u = HOUSES[k].u0, vmid = -1.5, cx = u * DX + vmid * NX, cz = u * DZ + vmid * NZ;
    b.box(cx, 0, cz, 0.6, 0.25, 14.4, 'dark', 0.4194);
  }

  /** Bind the kit to one house: t is metres from its west party wall, shapes snap onto the real shell wall. */
  const on = (h: H) => {
    const f0 = frameAt(h.u0, 5.6);
    const fixed = FIXED_ABOVE[h.key];
    const fFixed = fixed ? frameAt(h.u0, fixed[1]) : f0;
    const fr = (t: number, y: number): Frame => { if (fixed && y >= fixed[0]) return fFixed; const o = probe.offset(f0, t, y); return o === null || Math.abs(o) > 1.6 ? f0 : probe.snap(f0, t, y); };
    return {
      h, f0, fr,
      slab: (t: number, y: number, w: number, hh: number, d: number, c: string, out = 0) => slab(b, fr(t, y + hh / 2), t, y, w, hh, d, c, out),
      archSlab: (t: number, y: number, w: number, hh: number, d: number, c: string, out = 0) => archSlab(b, fr(t, y + hh / 2), t, y, w, hh, d, c, out),
      archBand: (t: number, y: number, w: number, hh: number, th: number, d: number, c: string, out = 0) => archBand(b, fr(t, y + hh / 2), t, y, w, hh, th, d, c, out),
      poly: (t: number, y: number, pts: [number, number][], d: number, c: string, out = 0) => poly(b, fr(t, y + 1), t, y, pts, d, c, out),
      pointed: (t: number, y: number, w: number, hh: number, d: number, c: string, out = 0) => pointedSlab(b, fr(t, y + hh / 2), t, y, w, hh, d, c, out),
      horseshoe: (t: number, y: number, w: number, hh: number, d: number, c: string, out = 0) => horseshoeSlab(b, fr(t, y + hh / 2), t, y, w, hh, d, c, out),
      ogee: (t: number, y: number, w: number, hh: number, d: number, c: string, out = 0, h0?: number) => ogeeSlab(b, fr(t, y + hh / 2), t, y, w, hh, d, c, out, h0),
      arched: (kind: 'pointed' | 'horseshoe' | 'ogee' | 'round', t: number, y: number, w: number, hh: number, o: Parameters<typeof archedWindow>[7] = {}) => archedWindow(b, fr(t, y + hh / 2), kind, t, y, w, hh, o),
      ring: (kind: 'pointed' | 'horseshoe' | 'ogee' | 'round', t: number, y: number, w: number, hh: number, th: number, d: number, c: string, out = 0) => archRing(b, fr(t, y + hh / 2), kind, t, y, w, hh, th, d, c, out),
      cyl: (t: number, y: number, out: number, r: number, hh: number, c: string, rTop = r) => cyl(b, fr(t, y + hh / 2), t, y, out, r, hh, c, rTop),
      pyramid: (t: number, y: number, out: number, sx: number, sz: number, hh: number, c: string) => pyramid(b, fr(t, y + 1), t, y, out, sx, sz, hh, c),
      carve: (text: string, t: number, y: number, px: number, c: string, out = 0.04) => carve(b, fr(t, y + 0.1), text, t, y, px, 0.05, c, out),
      /** Rectangular sash window: white frame, glazing bars, optional sill/lintel. */
      sash: (t: number, y: number, w: number, hh: number, o: {cols?: number; rows?: number; frame?: string; sill?: string; lintel?: string; out?: number} = {}) => {
        const f = fr(t, y + hh / 2), frame = o.frame ?? 'frame', cols = o.cols ?? 2, rows = o.rows ?? 3, out = o.out ?? 0;
        slab(b, f, t, y - 0.06, w + 0.22, hh + 0.12, 0.07, frame, out);
        slab(b, f, t, y, w, hh, 0.1, 'glass', out);
        for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + w * k / cols, y, 0.045, hh, 0.13, frame, out);
        for (let r = 1; r < rows; r++) slab(b, f, t, y + hh * r / rows - 0.02, w, 0.045, 0.13, frame, out);
        if (o.sill) slab(b, f, t, y - 0.16, w + 0.45, 0.1, 0.2, o.sill, out);
        if (o.lintel) slab(b, f, t, y + hh + 0.06, w + 0.4, 0.14, 0.14, o.lintel, out);
      },
    };
  };

  // ================= 20 GERMANY: red brick, pointed-arch Gothic bay, octagonal oriel =================
  {
    const g = on(house('de'));
    // Narrow west column (t 0-2.25): door under a pointed hood lettered DUITSCHLAND, two tall windows, the oriel turret.
    g.arched('round', 1.0, 0, 0.95, 2.45, {frame: 'dark', glass: 'dark', bars: 0, rows: 0, out: 0.04});
    g.pointed(1.0, 2.55, 1.6, 1.0, 0.1, 'stone');
    g.carve('DUITSCHLAND', 1.0, 2.95, 0.017, 'dark', 0.1);
    g.ring('pointed', 1.0, 0.0, 1.55, 3.6, 0.17, 0.12, 'stone');
    for (const [y, hh] of [[4.3, 3.3], [9.5, 2.5]] as [number, number][]) {
      g.sash(1.05, y, 0.95, hh, {cols: 1, rows: 3, frame: 'frame', sill: 'stone', lintel: 'stone'});
      g.slab(1.05, y + hh + 0.22, 1.5, 0.12, 0.2, 'stone');
    }
    {
      const f = g.fr(1.1, 14.5);
      oriel(b, f, 1.1, 0.35, 12.45, {r: 0.95, corbel: 1.05, body: 3.0, wall: 'stone', trim: 'stone', glass: 'glass', frame: 'frame', dome: 'blue', finial: 'gold', domeH: 1.15});
    }
    // East bay (t 2.25-5.55): white, two storeys of three-light windows between tracery panels, Gothic lancets above.
    const c = 3.9;
    g.slab(c, 3.0, 3.3, 11.45, 0.1, 'stone');
    for (const e of [2.35, 5.45]) g.slab(e, 3.0, 0.22, 11.45, 0.2, 'stone');
    g.slab(c, 2.95, 3.4, 0.35, 0.3, 'stone');
    for (let k = 0; k < 5; k++) g.slab(2.55 + 0.65 * k, 2.45, 0.2, 0.6, 0.22, 'dark');
    for (const [y0, y1] of [[3.35, 4.45], [8.55, 9.7]] as [number, number][]) {
      g.slab(c, y0, 3.0, y1 - y0, 0.04, 'frame', 0.08);
      for (let k = 0; k < 3; k++) {
        g.pointed(2.95 + 0.95 * k, y0 + 0.12, 0.7, y1 - y0 - 0.24, 0.03, 'stone', 0.14);
        g.slab(2.95 + 0.95 * k, y0 + 0.12, 0.86, 0.08, 0.06, 'stone', 0.12);
      }
    }
    // floor 1: three tall lights in white frames separated by heavy mullions, transom at two thirds
    g.slab(c, 4.45, 2.55, 4.05, 0.08, 'frame', 0.05);
    for (const k of [-1, 0, 1]) {
      g.slab(c + k * 0.82, 4.62, 0.62, 3.7, 0.1, 'glass', 0.1);
      g.slab(c + k * 0.82, 4.62 + 2.45, 0.7, 0.08, 0.14, 'frame', 0.1);
    }
    for (const x of [c - 1.23, c - 0.41, c + 0.41, c + 1.23]) g.slab(x, 4.5, 0.2, 3.95, 0.14, 'frame', 0.1);
    // floor 2: three pointed lancets under one traceried pointed arch, ring and circle above
    g.ring('pointed', c, 9.85, 2.7, 4.35, 0.14, 0.14, 'stone', 0.1);
    for (const k of [-1, 0, 1]) g.arched('pointed', c + k * 0.8, 10.0, 0.64, 3.0, {frame: 'frame', bars: 0, rows: 1, out: 0.12});
    g.ring('pointed', c, 13.35, 2.6, 1.15, 0.1, 0.12, 'stone', 0.08);
    g.slab(c, 14.2, 3.6, 0.3, 0.34, 'stone');
    // dormer over the bay: white box, two lights, tile pyramid roof
    g.slab(c, 14.5, 2.0, 1.55, 0.7, 'stone', 0.0);
    for (const k of [-1, 1]) g.slab(c + k * 0.45, 14.85, 0.55, 0.9, 0.1, 'glass', 0.7);
    g.pyramid(c, 16.0, 0.0, 2.3, 1.5, 0.9, 'red');
    // Three pointed lancets at street level under the bracket fringe.
    for (const x of [2.72, 3.7, 4.63]) { g.arched('pointed', x, 0.7, 0.62, 1.75, {frame: 'frame', ring: 'stone', ringTh: 0.1, bars: 0, rows: 1, out: 0.05}); }
  }

  // ================= 22 FRANCE: cream stone, three-facet bay, green sashes, iron balconies, mansard =================
  {
    const ring = homes[1].nativeRing;
    const facets = [8, 12, 16];
    facets.forEach((ei, fi) => {
      const {f, len: fullLen} = ringFrame(ring, ei), c = fullLen / 2, len = fullLen - 0.06;
      // plinth, sashes per floor, balcony, balustrade
      slab(b, f, c, 0, len, 0.85, 0.12, 'copper');
      slab(b, f, c, 0.85, len, 0.08, 0.14, 'stone');
      if (fi < 2) {
        const sashF = (y: number, hh: number, w: number) => {
          slab(b, f, c, y - 0.05, w + 0.3, hh + 0.1, 0.08, 'stone');
          slab(b, f, c, y, w, hh, 0.11, 'glass');
          slab(b, f, c, y, 0.06, hh, 0.14, 'bronze');
          slab(b, f, c, y + hh * 0.62, w, 0.06, 0.14, 'bronze');
          for (const s of [-1, 1]) slab(b, f, c + s * w / 2, y, 0.06, hh, 0.14, 'bronze');
          slab(b, f, c, y + hh - 0.03, w, 0.06, 0.14, 'bronze');
        };
        sashF(1.25, 1.55, 1.0);
      } else {
        slab(b, f, c - 0.1, 0.2, 0.95, 2.55, 0.1, 'bronze');
        slab(b, f, c - 0.1, 0.3, 0.75, 2.2, 0.14, 'glass');
        slab(b, f, c - 0.1, 2.5, 0.95, 0.12, 0.14, 'stone');
        carve(b, f, 'FRANKRIJK', c, 3.0, 0.024, 0.05, 'dark', 0.04);
      }
      // floor 1: tall windows opening onto iron balconies
      slab(b, f, c, 3.5, len, 0.16, 0.5, 'stone');
      for (let k = 0; k < 2; k++) slab(b, f, c - len / 2 + 0.12 + k * (len - 0.24), 3.66, 0.05, 0.9, 0.05, 'dark', 0.45);
      slab(b, f, c, 4.52, len - 0.1, 0.05, 0.05, 'dark', 0.45);
      for (let k = 0; k < 9; k++) slab(b, f, c - len / 2 + 0.2 + k * (len - 0.4) / 8, 3.66, 0.025, 0.86, 0.025, 'dark', 0.46);
      const w1 = 1.0;
      slab(b, f, c, 3.9, w1 + 0.3, 2.85, 0.08, 'stone');
      slab(b, f, c, 3.95, w1, 2.7, 0.11, 'glass');
      slab(b, f, c, 3.95, 0.06, 2.7, 0.14, 'bronze');
      slab(b, f, c, 5.5, w1, 0.06, 0.14, 'bronze');
      for (const s of [-1, 1]) slab(b, f, c + s * w1 / 2, 3.95, 0.06, 2.7, 0.14, 'bronze');
      slab(b, f, c, 6.65, w1 + 0.55, 0.28, 0.3, 'stone');
      // floor 2: stone balustrade with rosettes, then windows
      slab(b, f, c, 7.0, len, 0.16, 0.4, 'stone');
      slab(b, f, c, 7.16, len - 0.1, 0.12, 0.3, 'stone');
      for (let k = 0; k < 2; k++) put(b, f, new T.CylinderGeometry(0.2, 0.2, 0.12, 16).rotateX(Math.PI / 2).translate(0, 0, 0.06), c - len / 4 + k * len / 2, 7.55, 0.36, 'stone');
      slab(b, f, c, 7.28, len - 0.1, 0.1, 0.34, 'stone');
      slab(b, f, c, 7.95, 1.3, 2.35, 0.08, 'stone');
      slab(b, f, c, 8.0, 1.0, 2.25, 0.11, 'glass');
      slab(b, f, c, 8.0, 0.06, 2.25, 0.14, 'bronze');
      slab(b, f, c, 9.45, 1.0, 0.06, 0.14, 'bronze');
      // cornice
      slab(b, f, c, 10.3, len + 0.1, 0.3, 0.3, 'stone');
      slab(b, f, c, 10.65, len + 0.2, 0.25, 0.42, 'stone');
      if (fi === 1) {
        // stone dormer rising out of the mansard on the centre facet: pedimented, one casement
        slab(b, f, c, 10.9, 1.9, 2.55, 0.5, 'stone', -0.05);
        slab(b, f, c, 11.45, 0.95, 1.5, 0.1, 'glass', 0.46);
        slab(b, f, c, 11.4, 0.06, 1.6, 0.14, 'bronze', 0.46);
        slab(b, f, c, 11.4, 1.1, 0.06, 0.14, 'bronze', 0.46);
        slab(b, f, c, 12.98, 1.15, 0.1, 0.16, 'bronze', 0.46);
        slab(b, f, c, 13.35, 2.25, 0.18, 0.62, 'stone', -0.05);
        poly(b, f, c, 13.5, [[-1.0, 0], [1.0, 0], [0, 0.9]], 0.5, 'stone', -0.05);
        slab(b, f, c, 14.15, 0.35, 0.3, 0.3, 'stone', 0.2);
      }
    });
  }

  // ================= 24 SPAIN: red/white striped Moorish villa, horseshoe arches, corner tower =================
  {
    const g = on(house('es'));
    // The shell's own tower wall already stands 0.5 m proud of the main block, so t alone places tower items.
    const stripes = (t0: number, t1: number, ytop: number) => {
      for (let y = 0.3; y + 0.3 <= ytop; y += 0.6) g.slab((t0 + t1) / 2, y, t1 - t0, 0.3, 0.05, 'pink', 0.0);
    };
    g.slab(4.92, 0.0, 2.45, 15.0, 0.06, 'stone', 0.0);
    stripes(0.05, 3.6, 11.4);
    stripes(3.7, 6.12, 14.6);
    // tower: horseshoe doorway, lettered lintel, window, lobed ogee tympanum, belfry slits
    g.slab(4.9, 0, 2.2, 4.2, 0.06, 'stone', 0.05);
    g.horseshoe(4.75, 0, 1.5, 3.0, 0.06, 'dark', 0.1);
    g.ring('horseshoe', 4.75, 0, 1.9, 3.3, 0.22, 0.12, 'stone', 0.08);
    g.slab(4.9, 3.45, 1.7, 0.45, 0.08, 'stone', 0.08);
    g.carve('SPANJE', 4.9, 3.55, 0.026, 'dark', 0.14);
    g.slab(4.85, 4.8, 1.9, 3.2, 0.05, 'stone', 0.05);
    g.arched('horseshoe', 4.85, 4.95, 1.25, 2.9, {frame: 'stone', glass: 'glass', ring: 'pink', ringTh: 0.18, bars: 1, rows: 0, out: 0.08});
    g.slab(4.9, 8.05, 2.1, 0.7, 0.06, 'stone', 0.05);
    g.slab(4.85, 9.15, 1.3, 1.6, 0.1, 'glass', 0.1);
    g.slab(4.85, 9.05, 1.5, 0.12, 0.14, 'stone', 0.1);
    g.slab(4.85, 10.75, 1.5, 0.12, 0.14, 'stone', 0.1);
    for (const s of [-1, 1]) g.slab(4.85 + s * 0.7, 9.05, 0.12, 1.8, 0.14, 'stone', 0.1);
    g.slab(4.85, 9.9, 1.3, 0.06, 0.12, 'frame', 0.1);
    g.ogee(4.85, 10.85, 1.9, 1.75, 0.08, 'stone', 0.05, 0.9);
    g.ogee(4.85, 11.1, 1.4, 1.2, 0.06, 'pink', 0.12, 0.6);
    for (const x of [4.5, 5.25]) g.arched('horseshoe', x, 13.2, 0.42, 1.15, {frame: 'stone', bars: 0, rows: 0, out: 0.06});
    for (const x of [4.45, 4.9, 5.35]) g.slab(x, 14.75, 0.2, 0.32, 0.06, 'dark', 0.05);
    // tower roof: wide hipped eave with fretwork fascia, slate hip, blue scaled cap
    g.slab(4.9, 15.0, 3.7, 0.3, 1.2, 'stone', -0.2);
    for (let k = 0; k < 14; k++) g.slab(3.2 + k * 0.245, 14.78, 0.14, 0.24, 0.06, 'stone', 1.0);
    g.pyramid(4.9, 15.3, 0.3, 3.4, 2.4, 0.9, 'slate');
    {
      const f = g.fr(4.9, 16);
      put(b, f, new T.SphereGeometry(0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 0.8), 4.9, 16.1, 0.65, 'blue');
    }
    // main block: ground horseshoe windows, carved wooden balcony on slim paired columns, big horseshoe window in a scalloped surround
    for (const x of [1.0, 2.45]) g.arched('horseshoe', x, 1.05, 0.95, 1.7, {frame: 'stone', glass: 'glass', ring: 'stone', ringTh: 0.14, bars: 0, rows: 1, out: 0.04});
    g.slab(1.85, 3.05, 2.8, 0.18, 0.9, 'dark', 0.1);
    for (let k = 0; k < 12; k++) g.slab(0.5 + k * 0.25, 3.25, 0.05, 0.9, 0.05, 'dark', 0.88);
    g.slab(1.85, 4.12, 2.8, 0.07, 0.07, 'dark', 0.88);
    g.slab(1.85, 3.65, 2.8, 0.05, 0.05, 'dark', 0.88);
    for (const s of [0.28, 3.1]) for (const d of [-0.1, 0.1]) g.cyl(s + d, 3.2, 0.12, 0.07, 1.8, 'stone');
    g.ring('horseshoe', 1.95, 4.55, 2.9, 4.1, 0.28, 0.1, 'stone', 0.06);
    g.arched('horseshoe', 1.95, 4.75, 2.1, 3.2, {frame: 'ochre', glass: 'glass', bars: 2, rows: 1, out: 0.06});
    for (const x of [1.2, 2.8]) g.arched('horseshoe', x, 8.9, 0.95, 2.6, {frame: 'ochre', glass: 'glass', ring: 'stone', ringTh: 0.14, bars: 1, rows: 1, out: 0.04});
    for (let k = 0; k < 9; k++) g.slab(0.2 + k * 0.4, 11.55, 0.24, 0.35, 0.16, 'stone');
    g.slab(1.8, 11.9, 3.7, 0.28, 0.4, 'stone');
    g.slab(1.8, 11.45, 3.7, 0.1, 0.2, 'stone');
  }

  // ================= 26 ITALY: cream palazzo, rusticated base, columns, balustraded attic =================
  {
    const g = on(house('it'));
    // diamond-point rustication on the corner piers
    for (const x0 of [0.3, 5.4]) for (let j = 0; j < 11; j++) for (let k = 0; k < 2; k++) g.pyramid(x0 - 0.15 + 0.32 * k, 0.1 + 0.31 * j, 0.0, 0.3, 0.3, 0.1, 'stone');
    g.slab(2.85, 0.0, 3.8, 0.12, 0.12, 'stone');
    g.archSlab(1.55, 0, 1.15, 2.8, 0.08, 'dark');
    g.archBand(1.55, 0, 1.55, 3.15, 0.2, 0.12, 'stone');
    g.arched('round', 4.15, 1.15, 1.1, 1.65, {frame: 'frame', glass: 'glass', ring: 'stone', ringTh: 0.14, bars: 2, rows: 2});
    // wrought-iron balcony on a fluted urn bracket
    {
      const f = g.fr(2.85, 3.4);
      put(b, f, new T.CylinderGeometry(0.85, 0.12, 0.8, 12).translate(0, 0.4, 0), 2.85, 2.7, 0.55, 'stone');
      slab(b, f, 2.85, 3.5, 2.0, 0.1, 0.85, 'dark');
      for (let k = 0; k < 11; k++) slab(b, f, 1.9 + k * 0.19, 3.6, 0.03, 0.8, 0.03, 'dark', 0.82);
      slab(b, f, 2.85, 4.4, 2.0, 0.05, 0.05, 'dark', 0.82);
      for (const s of [-1, 1]) slab(b, f, 2.85 + s * 0.98, 3.6, 0.03, 0.8, 0.8, 'dark', 0.0);
    }
    // piano nobile and second floor: tall windows, engaged column pairs, lettered string course
    const xs = [1.45, 2.85, 4.3], ws = [0.85, 1.15, 0.85];
    xs.forEach((x, k) => {
      g.sash(x, 4.2, ws[k], 3.1, {cols: ws[k] > 1 ? 2 : 1, rows: 4, sill: 'stone', lintel: 'stone'});
      g.sash(x, 8.55, ws[k], 2.5, {cols: ws[k] > 1 ? 2 : 1, rows: 3, sill: 'stone', lintel: 'stone'});
      g.slab(x, 11.3, ws[k] + 0.7, 0.18, 0.28, 'stone');
    });
    for (const x of [2.1, 3.6]) { g.cyl(x, 4.1, 0.14, 0.1, 3.1, 'stone'); g.slab(x, 7.15, 0.3, 0.12, 0.3, 'stone'); g.slab(x, 4.0, 0.3, 0.1, 0.3, 'stone'); }
    g.slab(2.85, 7.5, 5.4, 0.2, 0.2, 'stone');
    g.carve('ITALIE', 2.85, 7.78, 0.028, 'dark');
    g.slab(2.85, 8.2, 5.0, 0.1, 0.12, 'stone');
    // heavy dentil cornice, balustraded attic with obelisks and urns
    for (let k = 0; k < 10; k++) g.slab(0.35 + k * 0.55, 12.35, 0.22, 0.32, 0.2, 'stone');
    g.slab(2.85, 12.65, 5.8, 0.36, 0.5, 'stone');
    g.slab(2.85, 13.0, 4.7, 0.9, 0.18, 'white');
    for (const x of [1.2, 2.85, 4.5]) for (const d of [-0.35, 0.35]) g.slab(x + d, 13.25, 0.28, 0.45, 0.2, 'dark', 0.1);
    for (const x of [0.3, 5.4]) { g.slab(x, 13.0, 0.4, 0.45, 0.4, 'stone'); g.pyramid(x, 13.45, 0.2, 0.3, 0.3, 1.5, 'stone'); }
    for (const x of [1.75, 3.95]) { g.cyl(x, 13.9, 0.1, 0.12, 0.2, 'stone'); { const f = g.fr(x, 14.2); put(b, f, new T.SphereGeometry(0.2, 10, 8).translate(0, 0.2, 0), x, 14.1, 0.1, 'stone'); } }
  }

  // ================= 28 RUSSIA: cream stone onion-domed tower, ogee kokoshnik arches, ochre brick panels =================
  {
    const g = on(house('ru'));
    const tc = 1.35;
    // tower (the shell tower wall is already 0.5 m proud): porch with ogee hood, tall windows, drum and onion dome
    g.slab(tc, 0.0, 2.45, 15.0, 0.06, 'stone', 0.0);
    g.slab(tc, 4.6, 1.9, 1.6, 0.05, 'gold', 0.04);
    g.slab(tc, 9.4, 1.9, 0.9, 0.05, 'gold', 0.04);
    g.archSlab(tc + 0.1, 0, 1.2, 2.7, 0.08, 'dark', 0.06);
    g.archBand(tc + 0.1, 0, 1.8, 3.2, 0.25, 0.14, 'stone', 0.04);
    g.ogee(tc + 0.1, 3.0, 2.0, 1.6, 0.12, 'stone', 0.04, 0.5);
    g.ogee(tc + 0.1, 3.3, 1.3, 1.0, 0.05, 'gold', 0.14, 0.4);
    for (const x of [0.12, 2.55]) { g.cyl(x, 0.1, 0.35, 0.2, 1.0, 'dark', 0.15); g.slab(x, 0, 0.5, 0.12, 0.5, 'stone', 0.02); }
    g.sash(tc + 0.05, 6.4, 0.95, 2.8, {cols: 1, rows: 4, frame: 'ochre', sill: 'stone', lintel: 'stone', out: 0.04});
    g.sash(tc + 0.05, 10.3, 0.95, 1.95, {cols: 1, rows: 3, frame: 'ochre', sill: 'stone', lintel: 'stone', out: 0.04});
    g.arched('round', tc + 0.05, 13.0, 0.8, 1.45, {frame: 'ochre', glass: 'glass', ring: 'stone', ringTh: 0.12, bars: 1, rows: 1, out: 0.04});
    g.ogee(tc, 4.3, 0.5, 0.45, 0.06, 'stone', 0.1, 0.2);
    g.slab(tc, 14.7, 2.7, 0.42, 0.5, 'stone', -0.1);
    g.slab(tc, 14.35, 2.5, 0.2, 0.34, 'stone', -0.05);
    {
      const f = g.fr(tc, 15.2);
      cyl(b, f, tc, 15.0, 0.1, 0.58, 1.3, 'stone', 0.58, 12);
      cyl(b, f, tc, 16.25, 0.1, 0.7, 0.16, 'stone', 0.7, 12);
      for (let k = -1; k <= 1; k++) { const a = k * Math.PI / 4; const gg = new T.BoxGeometry(0.2, 0.62, 0.05).rotateY(a).translate(Math.sin(a) * 0.56, 0.5, Math.cos(a) * 0.56); put(b, f, gg, tc, 15.4, 0.1, 'dark'); }
      onion(b, f, tc, 16.4, 0.1, 0.78, 1.45, 'green');
      cyl(b, f, tc, 17.8, 0.1, 0.04, 0.8, 'gold', 0.02);
      slab(b, f, tc, 18.35, 0.1, 0.05, 0.04, 'gold', 0.1);
      slab(b, f, tc, 18.2, 0.2, 0.05, 0.04, 'gold', 0.1);
    }
    // main block (t 2.7-6.4): ground arches, balconied arched window, twin ogee-hooded windows
    for (const x of [3.5, 5.4]) g.arched('round', x, 0.9, 0.95, 1.9, {frame: 'frame', glass: 'glass', ring: 'stone', ringTh: 0.13, bars: 1, rows: 1, out: 0.04});
    g.slab(4.55, 4.2, 3.0, 0.14, 0.85, 'ochre', 0.0);
    for (let k = 0; k < 12; k++) g.slab(3.1 + k * 0.27, 4.34, 0.05, 0.85, 0.05, 'ochre', 0.8);
    g.slab(4.55, 5.18, 3.0, 0.07, 0.07, 'ochre', 0.8);
    g.ring('round', 4.55, 4.85, 2.65, 3.4, 0.2, 0.14, 'stone', 0.06);
    g.arched('round', 4.55, 4.95, 2.2, 2.95, {frame: 'ochre', glass: 'glass', bars: 3, rows: 1, out: 0.06});
    g.ogee(4.55, 8.3, 0.7, 0.55, 0.05, 'stone', 0.06, 0.25);
    for (const x of [3.8, 5.15]) {
      g.ogee(x, 9.0, 1.35, 2.7, 0.08, 'stone', 0.04, 1.9);
      g.arched('round', x, 9.1, 0.95, 1.9, {frame: 'ochre', glass: 'glass', bars: 1, rows: 1, out: 0.1});
    }
    g.slab(4.55, 11.95, 3.5, 0.55, 0.06, 'gold', 0.06);
    for (let k = 0; k < 9; k++) put(b, g.fr(3 + k * 0.38, 12.2), new T.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03), 2.95 + k * 0.4, 12.1, 0.12, 'stone');
    g.slab(4.55, 12.5, 3.8, 0.32, 0.38, 'stone');
  }

  // ================= 30 NETHERLANDS: brown brick, white bands, Renaissance stepped gable =================
  {
    const g = on(house('nl'));
    g.slab(2.9, 0, 5.8, 0.55, 0.06, 'copper', 0.05);
    for (const x of [1.15, 3.2]) { g.sash(x, 1.2, 1.1, 1.75, {cols: 2, rows: 3, sill: 'stone'}); g.slab(x, 3.0, 1.5, 0.2, 0.14, 'stone'); }
    g.archSlab(5.05, 0, 0.9, 2.4, 0.08, 'dark');
    g.archBand(5.05, 0, 1.2, 2.75, 0.14, 0.1, 'stone');
    // white bay-balcony box over the ground floor, lettered NEDERLAND
    g.slab(3.9, 3.45, 3.2, 1.2, 0.55, 'stone', 0.0);
    for (const s of [-1, 1]) g.slab(3.9 + s * 1.2, 2.9, 0.22, 0.6, 0.3, 'stone');
    g.carve('NEDERLAND', 3.9, 3.78, 0.022, 'dark', 0.56);
    g.slab(3.9, 4.65, 3.3, 0.1, 0.62, 'stone');
    for (let k = 0; k < 7; k++) g.slab(2.5 + k * 0.4, 4.75, 0.04, 0.3, 0.04, 'stone', 0.58);
    // first floor: narrow, wide two-light, narrow
    g.sash(1.35, 5.0, 0.85, 3.0, {cols: 1, rows: 4, sill: 'stone', lintel: 'stone'});
    g.sash(3.1, 5.0, 1.4, 3.0, {cols: 2, rows: 4, sill: 'stone', lintel: 'stone'});
    g.sash(4.75, 5.0, 0.75, 3.0, {cols: 1, rows: 4, sill: 'stone', lintel: 'stone'});
    // lozenge frieze (white and dark engobed bricks), second floor with the sunburst cartouche between the windows
    for (let k = 0; k < 15; k++) g.poly(0.3 + k * 0.36, 8.4, [[0.15, 0], [0.3, 0.25], [0.15, 0.5], [0, 0.25]], 0.05, k % 2 ? 'stone' : 'greyBrick', 0.05);
    g.sash(1.65, 9.4, 1.4, 2.4, {cols: 2, rows: 3, sill: 'stone', lintel: 'stone'});
    g.sash(4.3, 9.4, 1.4, 2.4, {cols: 2, rows: 3, sill: 'stone', lintel: 'stone'});
    g.slab(2.95, 10.4, 0.7, 0.95, 0.1, 'stone');
    for (const y of [3.3, 8.0]) g.slab(2.9, y, 5.8, 0.14, 0.1, 'stone', 0.04);
    g.slab(2.9, 12.0, 5.8, 0.55, 0.3, 'stone');
    // stepped gable: five tiers of brick with white edge strips, balustraded attic window, volutes
    const tiers: [number, number, number][] = [[12.55, 14.35, 5.5], [14.35, 15.3, 4.0], [15.3, 16.1, 2.85], [16.1, 16.85, 1.75], [16.85, 17.5, 0.85]];
    for (const [y0, y1, w] of tiers) {
      g.slab(2.9, y0, w, y1 - y0, 0.3, 'brick', 0.0);
      g.slab(2.9, y1 - 0.12, w + 0.3, 0.14, 0.34, 'stone', 0.0);
      for (const s of [-1, 1]) g.slab(2.9 + s * (w / 2 - 0.05), y0, 0.14, y1 - y0, 0.34, 'stone', 0.0);
    }
    for (const s of [-1, 1]) g.poly(2.9 + s * 2.65, 12.55, [[0, 0], [s * 0.45, 0.2], [s * 0.45, 0.75], [0, 0.95]], 0.3, 'stone');
    g.cyl(2.9, 17.5, 0.15, 0.2, 0.3, 'stone');
    g.sash(2.85, 13.1, 0.95, 1.2, {cols: 1, rows: 2, frame: 'frame', lintel: 'stone', out: 0.3});
    for (let k = 0; k < 6; k++) g.cyl(2.4 + k * 0.2, 12.4, 0.4, 0.05, 0.6, 'stone');
    g.slab(2.9, 12.95, 1.4, 0.07, 0.5, 'stone');
    g.slab(2.9, 12.4, 1.4, 0.07, 0.5, 'stone');
    g.slab(2.9, 16.35, 0.35, 0.35, 0.34, 'red', 0.0);
    for (const k of [-1, 1]) g.ogee(2.9 + k * 1.1, 14.55, 0.5, 0.45, 0.06, 'stone', 0.3, 0.2);
  }

  // ================= 30a ENGLAND: red/blue-grey brick, projecting bay, half-timbered gable =================
  {
    const g = on(house('en'));
    // ground: shop window, round-headed door under a dark brick hood
    g.slab(2.25, 0, 5.9, 0.45, 0.06, 'copper', 0.05);
    g.slab(2.25, 0.7, 1.8, 2.0, 0.1, 'frame');
    g.slab(2.25, 0.8, 1.6, 1.8, 0.12, 'glass');
    g.slab(2.25, 2.65, 2.0, 0.25, 0.2, 'stone');
    g.archSlab(4.6, 0, 1.4, 3.1, 0.1, 'frame');
    g.archSlab(4.6, 0.1, 1.15, 2.6, 0.13, 'glass');
    for (let k = 1; k <= 2; k++) g.slab(4.6 - 0.575 + 1.15 * k / 3, 0.1, 0.05, 1.8, 0.16, 'frame');
    g.slab(4.6, 1.2, 1.15, 0.05, 0.16, 'frame');
    g.archBand(4.6, 0, 1.9, 3.4, 0.3, 0.14, 'greyBrick');
    g.slab(4.6, 3.35, 0.3, 0.3, 0.12, 'stone');
    // bay: lettered white hood, blue-grey brick piers, four tall white windows, white battlemented cornice
    g.slab(2.45, 2.95, 4.8, 1.15, 0.7, 'stone', 0.0);
    g.slab(2.45, 4.0, 5.0, 0.12, 0.8, 'stone');
    g.carve('ENGELAND', 2.45, 3.3, 0.026, 'dark', 0.7);
    g.slab(2.45, 4.1, 4.9, 5.0, 0.4, 'greyBrick', 0.0);
    for (const x of [0.2, 4.7]) g.slab(x, 4.1, 0.35, 5.1, 0.55, 'greyBrick');
    for (const x of [1.3, 2.4, 3.5]) g.slab(x, 4.7, 0.3, 4.1, 0.5, 'greyBrick', 0.0);
    for (const [x, w, hh] of [[0.78, 0.5, 3.9], [1.85, 0.62, 4.0], [2.95, 0.62, 4.0], [4.1, 0.5, 3.9]] as [number, number, number][]) {
      g.slab(x, 4.7, w + 0.14, hh + 0.1, 0.1, 'frame', 0.55);
      g.slab(x, 4.78, w, hh - 0.1, 0.12, 'glass', 0.55);
      g.slab(x, 7.7, w, 0.05, 0.14, 'frame', 0.55);
    }
    g.slab(2.45, 9.0, 5.0, 0.35, 0.65, 'stone');
    for (let k = 0; k < 6; k++) g.slab(0.45 + k * 0.9, 9.35, 0.45, 0.4, 0.6, 'greyBrick');
    g.slab(2.45, 9.35, 5.0, 0.1, 0.65, 'stone');
    // first floor above the bay: two casements, brick parapet
    g.sash(1.75, 10.8, 1.15, 2.0, {cols: 2, rows: 3, sill: 'stone', lintel: 'stone'});
    g.sash(4.0, 10.8, 1.15, 2.0, {cols: 2, rows: 3, sill: 'stone', lintel: 'stone'});
    g.slab(2.9, 12.95, 4.8, 0.3, 0.12, 'stone');
    for (let k = 0; k < 10; k++) g.slab(0.8 + k * 0.4, 13.2, 0.26, 0.35, 0.14, 'greyBrick');
    g.slab(2.9, 13.2, 5.9, 0.1, 0.2, 'stone');
    // half-timbered upper storey with the projecting leaded oriel, then the leaf-pattern gable
    g.slab(2.95, 13.75, 5.85, 2.6, 0.12, 'stone');
    for (const x of [0.2, 1.3, 4.65, 5.7]) g.slab(x, 13.75, 0.14, 2.6, 0.2, 'copper');
    g.slab(2.95, 15.0, 5.85, 0.1, 0.2, 'copper');
    g.slab(3.0, 14.1, 2.0, 2.15, 0.7, 'stone', 0.0);
    for (const x of [2.5, 3.5]) for (const [y, hh] of [[14.3, 0.8], [15.2, 0.85]] as [number, number][]) { g.slab(x, y, 0.85, hh, 0.04, 'glass', 0.72); g.slab(x, y + hh / 2, 0.85, 0.04, 0.05, 'frame', 0.72); g.slab(x, y, 0.04, hh, 0.05, 'frame', 0.72); }
    g.slab(3.0, 16.1, 2.2, 0.2, 0.75, 'stone');
    g.sash(1.65, 14.6, 0.8, 1.5, {cols: 2, rows: 3, frame: 'frame'});
    g.sash(4.5, 14.6, 0.8, 1.5, {cols: 2, rows: 3, frame: 'frame'});
    g.poly(2.95, 16.4, [[-2.9, 0], [2.9, 0], [0, 3.4]], 0.3, 'stone');
    g.slab(2.95, 16.7, 0.14, 3.0, 0.34, 'copper');
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.poly(2.95, 16.9 + 0.65 * k, [[0, 0.0], [s * (0.55 + 0.55 * (2 - k) * 0.9), 0.35], [s * (0.55 + 0.55 * (2 - k) * 0.9), 0.5], [0, 0.18]], 0.34, 'copper');
    for (const s of [-1, 1]) g.poly(2.95, 16.3, [[s * 2.95, 0], [s * 2.95, 0.22], [0, 3.62], [0, 3.38]], 0.4, 'frame');
  }
  void archRing; void shapeSlab;
}

/** Above this height (y) the 3DBAG shell is not the real front, so details sit on a fixed front plane at v. */
const FIXED_ABOVE: Record<string, [number, number]> = {nl: [12.4, 5.78], en: [9.6, 6.3]};

/** 3DBAG surface indices (per house) the facade work replaces. */
const SKIP: Record<string, Set<number>> = {};

/**
 * LoD2.2 cannot express the Dutch stepped gable: it raises a 2.2 m piece of the front wall to 16.8 m (east of
 * centre) and a 5 m steep roof behind. Clip that front piece (and the cheek faces on it) to the 11.7 m cornice
 * so the real, symmetric stepped gable authored in the builder defines the silhouette; the steep tile roof
 * behind it is real and stays.
 */
const patchedSource = (h: H, src: {surfaces: Surface[]; nativeRing: number[][]}) => {
  if (h.key !== 'nl') return src;
  const clip = new Set([2, 4, 11, 14, 25]);
  return {...src, surfaces: src.surfaces.map((s, i) => (clip.has(i) ? {...s, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], 11.7), p[2]]))} : s))};
};

/**
 * No. 22 (France) has a steep mansard ("schilddak") that LoD2.2 flattens into a 14.7 m box. Rebuild its shell
 * from the BAG ring: cream front walls to the 10.9 m cornice, a slate mansard stepping back 2.1 m to a flat
 * crown at 14.75 m, party walls that follow that profile, and the 3DBAG rear height.
 */
function frenchShell(b: BuildingTools, ring: number[][]) {
  const H1 = 10.9, H2 = 14.75, SET = 2.1;
  const pts = ring.slice(0, -1);
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0);
  const face = (poly: number[][], want: number[], colour: string) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(poly.flat(), 3));
    const idx: number[] = [];
    for (let k = 1; k + 1 < poly.length; k++) idx.push(0, k, k + 1);
    g.setIndex(idx); g.computeVertexNormals();
    const n = g.getAttribute('normal');
    if (n.getX(0) * want[0] + n.getY(0) * want[1] + n.getZ(0) * want[2] < 0) { const ix = g.getIndex()!; for (let k = 0; k < ix.count; k += 3) { const t = ix.getX(k + 1); ix.setX(k + 1, ix.getX(k + 2)); ix.setX(k + 2, t); } g.computeVertexNormals(); }
    b.add(g, colour as never);
  };
  const mid = (a: number[], c: number[]) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const centroid = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const away = (a: number[], c: number[]): [number, number, number] => { const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1; let n: [number, number] = [dz / l, -dx / l]; const m = mid(a, c); if ((m[0] - centroid[0]) * n[0] + (m[1] - centroid[1]) * n[1] < 0) n = [-n[0], -n[1]]; return [n[0], 0, n[1]]; };
  // ring order: 0 east-rear, 1 west-rear, 2 west-front ... 21 east-front, then back to 0 (east party wall)
  const front = pts.slice(2);
  for (let i = 0; i + 1 < front.length; i++) {
    const a = front[i], c = front[i + 1];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.02) continue;
    face([[a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], H1, c[1]], [a[0], H1, a[1]]], away(a, c), 'concrete');
    const A = [a[0] - SET * NX, a[1] - SET * NZ], C = [c[0] - SET * NX, c[1] - SET * NZ];
    const wn = away(a, c);
    face([[a[0], H1, a[1]], [c[0], H1, c[1]], [C[0], H2, C[1]], [A[0], H2, A[1]]], [wn[0], 0.9, wn[2]], 'slate');
  }
  const fw = front[0], fe = front[front.length - 1];
  const sw = [fw[0] - SET * NX, fw[1] - SET * NZ], se = [fe[0] - SET * NX, fe[1] - SET * NZ];
  // party walls (west: ring 1->2, east: ring 20->0) with the mansard profile at the front end
  face([[pts[1][0], 0, pts[1][1]], [fw[0], 0, fw[1]], [fw[0], H1, fw[1]], [sw[0], H2, sw[1]], [pts[1][0], H2, pts[1][1]]], away(pts[1], fw), 'concrete');
  face([[fe[0], 0, fe[1]], [pts[0][0], 0, pts[0][1]], [pts[0][0], H2, pts[0][1]], [se[0], H2, se[1]], [fe[0], H1, fe[1]]], away(fe, pts[0]), 'concrete');
  // rear wall and flat crown
  face([[pts[0][0], 0, pts[0][1]], [pts[1][0], 0, pts[1][1]], [pts[1][0], H2, pts[1][1]], [pts[0][0], H2, pts[0][1]]], away(pts[0], pts[1]), 'concrete');
  face([[pts[1][0], H2, pts[1][1]], [pts[0][0], H2, pts[0][1]], [se[0], H2, se[1]], [sw[0], H2, sw[1]]], [0, 1, 0], 'slate');
}
