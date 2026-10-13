import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {leanSlab, poly, put, ringFrame, roofHeightAt, setSink, slab, wallProbe} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './american-hotel-footprints.json';
import facades from './american-hotel-facades.json';
import {raisedLettering} from './ornament-kit';

/**
 * American Hotel (Leidseplein 28 / Leidsekade 97; Willem Kromhout and H.G. Jansen 1900-02, canal block 1927-28):
 * the 3DBAG LoD2.2 shell of BAG 0363100012168734 in native east/south metres, with every photographed front drawn in
 * its own ring-edge frame from the measurements in scripts/landmarks/american-hotel-facades.json (rectified panorama
 * crops of landmark-brief.ts read on the metre grid of elevation-grid.ts; pitched tower views of pano-look.ts):
 *  - the round corner tower (3DBAG's tower block is cut at 28 m and capped): drum, window groups, the AMERICAN HOTEL
 *    mosaic panel, cornice, open arcaded belfry, square clock stage with four gilt dials, cap;
 *  - the curved 1927 Leidsekade block: plinth with barred basement windows, ten bays of segmental ground windows under
 *    striped hoods, the arcade storey (paired round-headed windows, caryatid piers, hanging brackets and the projecting
 *    arched corbel table on the measured 2.34 m bay), brick band, six canted oriels on three storeys, AMERICAN HOTEL roof sign;
 *  - the Jugendstil gable front on the Leidsekade (ring edges 38 + 39): five bays of paired windows with fanlights, the
 *    five-arch arcade under ring tracery, balustrade, alternating windows, dormer row, blue zig-zag band;
 *  - the Marnixstraat corner pavilion (NE): the three-light two-storey arched window, three-arch loggia on columns,
 *    disc balustrade, upper rows, six small arched windows, blue zig-zag frieze, the big gable and two star gablets;
 *  - the Leidseplein front (SE): BAR AMERICAIN canopy, entrance arch and three cafe arches on the measured 6.05 m pitch,
 *    the loggia with striped awnings in its arches, balustrades, seven upper axes, stepped dormer gables.
 * Opening layers stand >= 5 cm apart (glass +0.06, frame and bars +0.11/+0.12, stone surround +0.19) so no two
 * same-facing faces share a plane (geometry audit z-fight gate).
 */

/** Depth parts reach behind their wall plane: 3 cm, so their open back edges lie on the wall (geometry audit hole check). */
const SINK = 0.03, CS = 4;
type Col = string;
type Head = 'round' | 'flat' | {seg: number};

/** Opening outline, centred on x = 0, bottom at y = 0, grown by g on every side. */
function outline(w: number, h: number, head: Head, g = 0): T.Vector2[] {
  const r = w / 2, R = r + g, pts: T.Vector2[] = [new T.Vector2(-R, -g), new T.Vector2(R, -g)];
  if (head === 'round') {
    const cy = h - r;
    for (let k = 0; k <= CS; k++) { const a = Math.PI * k / CS; pts.push(new T.Vector2(R * Math.cos(a), cy + R * Math.sin(a))); }
  } else if (head === 'flat') {
    pts.push(new T.Vector2(R, h + g), new T.Vector2(-R, h + g));
  } else {
    const rise = head.seg, spring = h - rise, Rc = (r * r + rise * rise) / (2 * rise), cy = spring + rise - Rc, a0 = Math.asin(r / Rc);
    // arc through (+-r, spring) and (0, h); grown arc keeps the centre
    for (let k = 0; k <= 6; k++) { const a = -a0 + 2 * a0 * k / 6; pts.push(new T.Vector2((Rc + g) * Math.sin(-a), cy + (Rc + g) * Math.cos(a))); }
    pts[2].x = R; pts[pts.length - 1].x = -R;
    pts.splice(2, 0, new T.Vector2(R, spring));
    pts.push(new T.Vector2(-R, spring));
  }
  return pts;
}

/**
 * Prism of a 2D outline (optional hole): front face at z = depth, sides back to z = -SINK (just inside the wall) or to the
 * z given per loop (a frame ring's inner sides stop on the glass, a surround's on the frame ring), false for none. No back
 * face: every open back edge lies on the surface behind it (the geometry audit's hole check).
 */
function prism(contour0: T.Vector2[], depth: number, hole0?: T.Vector2[], sides: {outer?: boolean | number; inner?: boolean | number; closed?: boolean} = {}): T.BufferGeometry {
  const dedupe = (pts: T.Vector2[]) => pts.filter((p, i) => p.distanceTo(pts[(i + 1) % pts.length]) > 1e-4);
  const contour = dedupe(contour0), hole = hole0 ? dedupe(hole0) : undefined;
  const area = T.ShapeUtils.area(contour);
  const c = area < 0 ? [...contour].reverse() : contour;
  const h = hole ? (T.ShapeUtils.area(hole) > 0 ? [...hole].reverse() : hole) : undefined;
  const all = h ? [...c, ...h] : c;
  const tris = T.ShapeUtils.triangulateShape(c, h ? [h] : []);
  if (!tris.length) return new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([], 3));
  const out: number[] = [];
  for (const [a, b, d] of tris) for (const i of [a, b, d]) out.push(all[i].x, all[i].y, depth);
  const side = (loop: T.Vector2[], flip: boolean, z0: number) => {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      const A = [p.x, p.y, z0], B = [q.x, q.y, z0], C = [q.x, q.y, depth], D = [p.x, p.y, depth];
      if (!flip) out.push(...A, ...B, ...C, ...A, ...C, ...D); else out.push(...A, ...C, ...B, ...A, ...D, ...C);
    }
  };
  const z0 = (v: boolean | number | undefined) => (typeof v === 'number' ? v : -SINK);
  if (sides.outer !== false) side(c, false, z0(sides.outer));
  if (h && sides.inner !== false) side(h, true, z0(sides.inner));
  if (sides.closed) for (const [a, b, d] of tris) for (const i of [a, d, b]) out.push(all[i].x, all[i].y, z0(sides.outer));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

/** Frame tangent to a circle (centre c, radius r) facing bearing deg (0 = north, 90 = east); t = 0 at the tangent point. */
function cylFrame(c: [number, number], r: number, bearingDeg: number, extra = 0): Frame {
  const a = bearingDeg * Math.PI / 180, n: [number, number] = [Math.sin(a), -Math.cos(a)];
  return own({origin: [c[0] + n[0] * (r + extra), c[1] + n[1] * (r + extra)], n, tangent: [n[1], -n[0]]});
}
const shift = (f: Frame, out: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * out, f.origin[1] + f.n[1] * out]});
/** A frame on geometry this builder draws (a wall skin, the tower drum, an oriel front): openings on it are not snapped to the 3DBAG shell. */
const own = (f: Frame): Frame => Object.assign({...f}, {own: true});

/** Surfaces of the 3DBAG tower block (corner mass up to 39.4 m). Cut at TOWER_CUT and capped; the drawn tower stands in it. */
const TOWER_WALLS = new Set([33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 83, 115, 200, 320, 323, 324, 325]);
const TOWER_DROP = new Set([35, 49, 114, 488, 496, 511]);
const TOWER_CUT = 28.0;

type Ring3 = number[][];
function clipBelow(ring: Ring3, Y: number): Ring3 {
  const out: Ring3 = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ia = a[1] <= Y, ib = b[1] <= Y;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (Y - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), Y, a[2] + t * (b[2] - a[2])]); }
  }
  return out;
}

export function buildAmericanHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const F = facades.walls;
  // ---------------------------------------------------------------- shell
  // The 1927 canal block (ring edges 30-37, x < -19.9) is dark brown brick; the rest is the buff Jugendstil hotel.
  const brown = (s: Surface) => { const r = s.rings[0]; return r.reduce((a, p) => a + p[0], 0) / r.length < -19.9; };
  const surfaces = (source.surfaces as unknown as Surface[]).map((s, i) => {
    if (TOWER_DROP.has(i)) return {...s, type: 'GroundSurface'} as Surface;   // addShell skips ground surfaces
    if (TOWER_WALLS.has(i)) { const r = clipBelow(s.rings[0], TOWER_CUT); return r.length >= 3 ? {...s, rings: [r]} : {...s, type: 'GroundSurface'} as Surface; }
    return s;
  });
  const src = {...source, surfaces} as never;
  const shellGeoms: T.BufferGeometry[] = [];
  const bs = {...b, add: (g: T.BufferGeometry, c: never, x?: number, y?: number, z?: number, a?: number) => { b.add(g, c, x, y, z, a); shellGeoms.push(g.clone()); }} as BuildingTools;
  addShell(bs, src, {wall: 'sandstone', roof: 'slate', skip: (s) => s.type === 'WallSurface' && brown(s)});
  addShell(bs, src, {wall: 'greyBrick', roof: 'slate', skip: (s) => s.type !== 'WallSurface' || !brown(s)});
  // cap over the cut tower block: the section of the cut walls at TOWER_CUT, chained into a loop
  {
    const segs: [number, number][][] = [];
    (source.surfaces as unknown as Surface[]).forEach((s, i) => {
      if (!TOWER_WALLS.has(i)) return;
      const r = s.rings[0], pts: [number, number][] = [];
      for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; if ((a[1] - TOWER_CUT) * (c[1] - TOWER_CUT) < 0) { const t = (TOWER_CUT - a[1]) / (c[1] - a[1]); pts.push([a[0] + t * (c[0] - a[0]), a[2] + t * (c[2] - a[2])]); } }
      if (pts.length >= 2) segs.push(pts.slice(0, 2));
    });
    const loop: [number, number][] = [...segs.shift()!];
    while (segs.length) {
      const end = loop[loop.length - 1];
      let best = -1, bestD = 1e9, flip = false;
      segs.forEach((s, k) => { const d0 = Math.hypot(s[0][0] - end[0], s[0][1] - end[1]), d1 = Math.hypot(s[1][0] - end[0], s[1][1] - end[1]); if (d0 < bestD) { bestD = d0; best = k; flip = false; } if (d1 < bestD) { bestD = d1; best = k; flip = true; } });
      const s = segs.splice(best, 1)[0];
      loop.push(flip ? s[0] : s[1]);
    }
    const shape = new T.Shape(loop.map(([x, z]) => new T.Vector2(x, -z)));
    const g = new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, TOWER_CUT, 0);
    bs.add(g, 'slate' as never);
  }
  const probe = wallProbe(shellGeoms);
  b.mark?.('shell');   // everything added after this is detail that scripts/check-landmark-attachment.ts holds to the shell
  setSink(SINK);
  const ring = (source.nativeRing as number[][]).slice(0, -1);
  const fr = (i: number, off = 0) => ringFrame(ring, i, off);
  /** Frame of ring edge i moved onto the shell wall measured at (t, y) (median of a few probes). */
  const onWall = (i: number, ts: number[], y: number, extra = 0): Frame => {
    const {f} = fr(i);
    const offs = ts.map(t => probe.offset(f, t, y)).filter((o): o is number => o !== null).sort((a, c) => a - c);
    return shift(f, (offs.length ? offs[Math.floor(offs.length / 2)] : 0) + extra);
  };

  // ---------------------------------------------------------------- opening kit
  const add = (f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(b, f, g, t, y, out, c);
  type WinOpts = {head?: Head; bars?: number; rows?: number; frame?: Col; glass?: Col; surround?: Col | false; sth?: number; sill?: Col | false; springBars?: boolean};
  /** Opening: glass +0.06, frame ring (7 cm) +0.12, glazing bars +0.11 inside the glass only, stone surround +0.19, sill +0.24. */
  /** Shell frame moved onto the shell wall right behind (t, y): the 3DBAG walls are uneven by several cm. */
  const snapAt = (f: Frame, t: number, y: number): Frame => {
    if ((f as {own?: boolean}).own) return f;
    const off = probe.offset(f, t, y);
    return off !== null && Math.abs(off) < 0.25 ? shift(f, off) : f;
  };
  const win = (f0: Frame, t: number, y: number, w: number, h: number, o: WinOpts = {}) => {
    const head = o.head ?? 'round', fw = 0.07, f = snapAt(f0, t, y + h / 2);
    add(f, prism(outline(w, h, head), 0.06, undefined, {outer: false}), t, y, 0, o.glass ?? 'glass');
    add(f, prism(outline(w, h, head, fw), 0.12, outline(w, h, head), {outer: o.surround === false, inner: 0.06}), t, y, 0, o.frame ?? 'frame');
    const straight = head === 'round' ? h - w / 2 : head === 'flat' ? h : h - head.seg;
    const bars = o.bars ?? 1, rows = o.rows ?? 1;
    for (let k = 1; k <= bars; k++) leanSlab(b, f, t - w / 2 + w * k / (bars + 1), y, 0.05, head === 'flat' ? h : straight, 0.045, o.frame ?? 'frame', 0.065);
    for (let k = 1; k <= rows; k++) leanSlab(b, f, t, y + straight * k / (rows + 1), w, 0.05, 0.045, o.frame ?? 'frame', 0.065);
    if (o.surround !== false) {
      const sth = o.sth ?? 0.16;
      add(f, prism(outline(w, h, head, fw + sth), 0.19, outline(w, h, head, fw), {inner: 0.12}), t, y, 0, o.surround ?? 'stone');
    }
    if (o.sill !== false) leanSlab(b, f, t, y - fw - 0.1, w + 2 * fw + 0.36, 0.1, 0.24, o.sill ?? 'stone');
  };
  /** Projecting arch band (voussoirs) without the opening: a round or segmental hood, front at +d. */
  const hood = (f0: Frame, t: number, y: number, w: number, h: number, head: Head, th: number, d: number, c: Col, out = 0) => {
    const f = snapAt(f0, t, y + h - 0.1);
    const inner = outline(w, h, head), outer = outline(w, h, head, th);
    // keep only the arch part: cut the outline at the springing by dropping the straight legs below it
    const spring = head === 'round' ? h - w / 2 : head === 'flat' ? h : h - head.seg;
    const clip = (pts: T.Vector2[]) => pts.filter(p => p.y >= spring - 1e-6);
    const o2 = clip(outer).map(p => p.clone()), i2 = clip(inner).map(p => p.clone()).reverse();
    o2[0].y = spring; o2[o2.length - 1].y = spring;
    add(f, prism([...o2.slice(0), ...i2].map(p => new T.Vector2(p.x, p.y - spring)), d, undefined, {closed: out !== 0 || (f as {own?: boolean}).own === true}), t, y + spring, out, c);
  };
  const band = (f: Frame, t0: number, t1: number, y: number, h: number, d: number, c: Col = 'stone') => slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, d + 0.3, c, -0.3);
  /** Gable-shaped plate. */
  const plate = (f: Frame, t: number, y: number, pts: [number, number][], d: number, c: Col, out = 0) => add(f, prism(pts.map(([x, z]) => new T.Vector2(x, z)), d, undefined, {closed: true}), t, y, out, c);
  /** Eight-point star tile. */
  const star = (f: Frame, t: number, y: number, r: number, d: number, c: Col, out = 0) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 16; k++) { const a = Math.PI * k / 8, rr = k % 2 ? r * 0.45 : r; pts.push([rr * Math.sin(a), rr * Math.cos(a)]); }
    plate(f, t, y, pts, d, c, out);
  };
  /** Zig-zag ceramic strip: a row of diamonds between two thin bands. */
  const zigzag = (f: Frame, t0: number, t1: number, y: number, h: number, c: Col, out = 0) => {
    const n = Math.max(2, Math.round((t1 - t0) / (h * 1.3)));
    const dw = (t1 - t0) / n;
    for (let k = 0; k < n; k++) plate(f, t0 + dw * (k + 0.5), y, [[0, 0], [dw * 0.42, h / 2], [0, h], [-dw * 0.42, h / 2]], 0.06, c, out);
  };

  // =============================================================== Leidseplein front (SE, ring edge 58)
  b.mark?.('se-front');
  {
    const W = F['w01-143'], s0 = W.edges['58'], T0 = (s: number) => s - s0;
    const f = onWall(58, [3, 12, 20, 26, 32], 4), L = 35.6;
    band(f, 0.2, L, 0, 0.9, 0.18);                                         // stone plinth
    // left wing: Bar Americain canopy with its lettering, shopfront, the five small arched windows over it
    for (let k = 0; k < 6; k++) { const t = T0(0.9 + 1.7 * k); slab(b, f, t, 0.9, 1.3, 1.1, 0.06, 'glass'); }
    {
      const c0 = T0(W.canopy.s[0]) + 0.3, c1 = T0(W.canopy.s[1]), cw = c1 - c0, tc = (c0 + c1) / 2;
      const cloth = new T.BoxGeometry(cw, 0.05, 1.9).translate(0, 0, 0.95).rotateX(0.32);
      add(f, cloth, tc, 3.3, 0.0, 'white');
      slab(b, f, tc, 2.55, cw, 0.42, 0.12, 'white', 1.8);                   // valance
      const txt = raisedLettering({text: 'BAR AMERICAIN', heightM: 0.3, maxWidthM: 4.2, depthM: 0.04});
      add(f, txt.geometry.translate(0, 0.21, 0), tc - 1.2, 2.55, 1.92, 'red');
    }
    for (const s of W.smallArched.s) win(f, T0(s), W.smallArched.y[0], 0.9, W.smallArched.y[1] - W.smallArched.y[0], {bars: 1, rows: 1});
    // entrance bay: big round arch with the door arch and side lights
    {
      const t = T0((W.entrance.s[0] + W.entrance.s[1]) / 2), ow = W.entrance.s[1] - W.entrance.s[0];
      hood(f, t, 0.9, ow - 0.5, W.entrance.crown - 0.9, 'round', 0.32, 0.22, 'stone');
      add(f, prism(outline(ow - 0.5, W.entrance.crown - 0.9, 'round'), 0.05), t, 0.9, 0, 'greyBrick');      // recessed porch field
      const dw = W.entrance.door.s[1] - W.entrance.door.s[0], fe = own(shift(f, 0.2));
      win(fe, t, 0.15, dw, W.entrance.door.top - 0.15, {glass: 'bronze', bars: 1, rows: 0, sill: false});
      for (const [a, c] of W.entrance.sideLights) win(fe, T0((a + c) / 2), 2.5, c - a, 3.0, {head: 'flat', bars: 0, rows: 1, sill: false});
      for (let s = 0; s < 3; s++) slab(b, f, t, 0.0 + s * 0.15, 3.2 - s * 0.4, 0.15, 0.6 - s * 0.2, 'stone');
    }
    // three cafe windows: segmental arch, two narrow side lights, a wide centre light with a transom of small panes
    for (const s of W.cafeArches.centres) {
      const t = T0(s), gw = W.cafeArches.glass, h = W.cafeArches.crown - W.cafeArches.sill - 0.3, rise = W.cafeArches.crown - W.cafeArches.springing - 0.3;
      const fc = snapAt(f, t, W.cafeArches.sill + h / 2);
      win(fc, t, W.cafeArches.sill, gw, h, {head: {seg: rise}, bars: 2, rows: 1, surround: 'stone', sth: 0.24, frame: 'white', sill: false});
      for (let k = 1; k <= 4; k++) leanSlab(b, fc, t - 0.9 + 1.8 * k / 5, W.cafeArches.transom, 0.05, 0.9, 0.045, 'white', 0.065);
      leanSlab(b, fc, t, W.cafeArches.transom, gw, 0.06, 0.045, 'white', 0.065);
    }
    // first-floor balcony balustrade over the whole front
    const bal = (t0: number, t1: number, y: number, h: number, out: number) => {
      slab(b, f, (t0 + t1) / 2, y - 0.14, t1 - t0, 0.14, out + 0.2, 'stone');
      for (let t = t0 + 0.25; t < t1 - 0.1; t += 0.7) slab(b, f, t, y, 0.14, h - 0.12, 0.14, 'stone', out);
      slab(b, f, (t0 + t1) / 2, y + h - 0.12, t1 - t0, 0.12, 0.2, 'stone', out);
    };
    bal(0.2, L, W.balcony.y[0] + 0.14, W.balcony.y[1] - W.balcony.y[0] - 0.14, 0.45);
    // loggia: one segmental arch per cafe bay (and the entrance bay) on piers, the striped awnings hanging in the arches,
    // the glazed back wall 1.5 m in (inferred depth)
    // (the loggia's depth cannot be cut out of the shell: its arches and piers stand 0.4 m in front of a darker back field)
    const Lg = own(shift(f, 0.05));
    for (const s of [14.55, ...W.cafeArches.centres]) {
      const t = T0(s), aw = 5.4;
      add(f, prism(outline(aw, 2.9, 'flat'), 0.05), t, 8.9, 0, 'greyBrick');
      for (const dx of [-1.75, 0, 1.75]) win(Lg, t + dx, 9.0, 1.0, 2.4, {bars: 1, rows: 1, surround: false, sill: false, frame: 'white'});
      hood(f, t, 8.9, aw, 3.0, {seg: 1.1}, 0.4, 0.3, 'stone', 0.4);
      slab(b, f, t - 3.025, 8.9, 0.6, 2.0, 0.7, 'stone');   // one pier between neighbouring arches
      // striped awning in the arch: eight sloping strips
      for (let k = 0; k < 6; k++) {
        const strip = new T.BoxGeometry(aw / 6, 0.04, 1.5).translate(0, 0, 0.75).rotateX(0.6);
        add(f, strip, t - aw / 2 + aw * (k + 0.5) / 6, W.loggia.awnings.y[1] + 0.25, 0.08, k % 2 ? 'stone' : 'ochre');
      }
    }
    // eaves balustrade
    bal(4.5, L, W.eavesBalustrade[0] + 0.14, W.eavesBalustrade[1] - W.eavesBalustrade[0] - 0.14, 0.3);
    // The two storeys over the eaves balustrade: the 3DBAG shell is a jumble 0.1-2 m behind the ring line here, so a real
    // wall stands 8 cm proud of the ring line and carries seven axes (over every arch and midway) of one size per row.
    const fW = own(shift(fr(58).f, 0.08));
    slab(b, fW, (1.7 + L) / 2, 13.3, L - 1.7, 5.9, 1.9, 'sandstone', -1.9);
    slab(b, fW, (1.7 + L) / 2, 19.2, L - 1.7, 0.22, 0.34, 'stone');
    for (let t = 7.0; t < L - 0.4; t += 0.64) leanSlab(b, fW, t, 19.42, 0.34, 0.3, 0.22, 'stone');
    const axes = Array.from({length: W.upperAxes.n}, (_, k) => T0(W.upperAxes.first + k * W.upperAxes.pitch));
    for (const t of [...axes, T0(3.0), T0(6.0), T0(9.0)]) for (const [y0, y1] of W.upperRows) win(fW, t, y0, 0.95, y1 - y0, {bars: 1, rows: 1});
    // left wing storeys between the canopy and the eaves on its three axes
    for (const t of [T0(3.0), T0(6.0), T0(9.0)]) { win(f, t, 9.0, 1.0, 2.2, {bars: 1, rows: 1}); }
  }

  // =============================================================== round corner tower
  b.mark?.('tower');
  {
    const P = F.tower, C = P.plan.centre as [number, number], R = 1.75;
    const cyl = (r: number, y0: number, y1: number, c: Col, seg = 22) => b.add(new T.CylinderGeometry(r, r, y1 - y0, seg, 1, true).translate(C[0], (y0 + y1) / 2, C[1]), c as never);
    const disk = (r: number, y: number, h: number, c: Col, seg = 22) => b.add(new T.CylinderGeometry(r, r, h, seg).translate(C[0], y + h / 2, C[1]), c as never);
    cyl(R, 0, P.shaft[1], 'sandstone');
    disk(R + 0.06, 0, 0.9, 'stone');                                            // plinth ring
    // string courses round the drum
    for (const y of [4.6, 8.6, 15.8, 22.6]) disk(R + 0.07, y, 0.2, 'stone');
    // pierced balustrade on the exposed arc at the first floor: posts and a rail on a curved slab
    {
      const a0 = (110) * Math.PI / 180, a1 = (270) * Math.PI / 180;
      for (let k = 0; k <= 12; k++) {
        const br = a0 + (a1 - a0) * k / 12, n = [Math.sin(br), -Math.cos(br)];
        b.add(new T.BoxGeometry(0.14, 0.75, 0.14).rotateY(Math.atan2(n[0], n[1])).translate(C[0] + n[0] * (R + 0.42), 8.95 + 0.37, C[1] + n[1] * (R + 0.42)), 'stone' as never);
      }
      // slab and rail: partial rings (three.js theta 0 at +z, counter-clockwise seen from above)
      const th = (br: number) => Math.atan2(Math.sin(br), -Math.cos(br));
      const ts = th(a1), tl = a1 - a0;
      b.add(new T.CylinderGeometry(R + 0.55, R + 0.55, 0.16, 20, 1, false, ts, tl).translate(C[0], 8.88, C[1]), 'stone' as never);
      b.add(new T.CylinderGeometry(R + 0.5, R + 0.5, 0.12, 20, 1, false, ts, tl).translate(C[0], 9.72, C[1]), 'stone' as never);
    }
    // windows: single arched windows low down, groups of three narrow lights higher up, all on the exposed arc
    // below the 28 m cut the drum stands inside the faceted 3DBAG block; its south face (ring edge 51) carries the low arched window
    win(fr(51).f, 0.8, 9.9, 0.9, 2.5, {bars: 1, rows: 1});
    for (const g of P.windowGroups) for (const br of [150, 190, 230]) {
      const fg = cylFrame(C, R, br, -0.02);
      for (const dx of [-0.42, 0, 0.42]) win(fg, dx, g.y[0], 0.3, g.y[1] - g.y[0], {head: 'flat', bars: 0, rows: 1, surround: false, sill: false});
      slab(b, fg, 0, g.y[0] - 0.2, 1.5, 0.14, 0.2, 'stone'); slab(b, fg, 0, g.y[1] + 0.07, 1.5, 0.16, 0.2, 'stone');
    }
    for (const [br, y] of [[140, 11.6], [140, 18.2], [240, 18.2]]) win(cylFrame(C, R, br, 0.04), 0, y, 0.55, 1.4, {bars: 0, rows: 1, surround: false});
    // AMERICAN HOTEL mosaic panel (dark tile frame, pale letters), facing the canal
    {
      // Below the 28 m cut the visible tower is the faceted 3DBAG shell around the drum: the flat tile panel stands
      // proud of the shell across its whole width, its body reaching back behind the furthest facet.
      const f0 = cylFrame(C, R, P.mosaicPanel.facing, 0);
      const pw = P.mosaicPanel.w, py = P.mosaicPanel.y, ph = py[1] - py[0];
      const offs = [-pw / 2, 0, pw / 2].flatMap(t => [py[0] + 0.2, py[1] - 0.2].map(y => probe.offset(f0, t, y) ?? 0));
      const hi = Math.max(0, ...offs), lo = Math.min(0, ...offs), fp = own(shift(f0, hi + 0.04));
      slab(b, fp, 0, py[0], pw, ph, hi - lo + 0.1, 'blue', -(hi - lo + 0.04));   // not 'dark': dark reads as an opening
      for (const [line, y] of [['AMERICAN', py[1] - 0.6], ['HOTEL', py[0] + 0.22]] as [string, number][]) {
        const tx = raisedLettering({text: line, heightM: 0.34, maxWidthM: pw - 0.3, depthM: 0.04});
        add(fp, tx.geometry.translate(0, 0.17, 0), 0, y, 0.06, 'ochre');
      }
    }
    // cornice, open belfry, cornice
    disk(R + 0.25, P.cornice[0], P.cornice[1] - P.cornice[0], 'stone');
    const bf = P.belfry, nb = bf.openings;
    disk(R - 0.35, bf.y[0], bf.y[1] - bf.y[0], 'dark', 20);                      // the dark void behind the openings
    for (let k = 0; k < nb; k++) {
      const br = (360 * k / nb + 18) * Math.PI / 180, n = [Math.sin(br), -Math.cos(br)];
      b.add(new T.BoxGeometry(0.34, bf.y[1] - bf.y[0], 0.4).rotateY(Math.atan2(n[0], n[1])).translate(C[0] + n[0] * (R - 0.2), (bf.y[0] + bf.y[1]) / 2, C[1] + n[1] * (R - 0.2)), 'stone' as never);
    }
    for (let k = 0; k < nb; k++) {
      const brg = 360 * (k + 0.5) / nb + 18, chord = 2 * (R - 0.02) * Math.sin(Math.PI / nb);
      const fa = cylFrame(C, (R - 0.02) * Math.cos(Math.PI / nb), brg, 0);
      hood(fa, 0, bf.y[1] - 1.6, chord - 0.34, 1.35, 'round', 0.14, 0.4, 'stone', -0.2);
    }
    disk(R + 0.2, bf.y[1], 0.32, 'stone');
    // square clock stage turned to the two streets (faces 143 / 233 deg), four gilt dials, cap
    const cs = P.clockStage, side = 3.2, yc = (cs.y[0] + cs.y[1]) / 2, rot = Math.atan2(Math.sin(143 * Math.PI / 180), -Math.cos(143 * Math.PI / 180));
    b.add(new T.BoxGeometry(side, cs.y[1] - cs.y[0], side).rotateY(rot).translate(C[0], yc, C[1]), 'stone' as never);
    b.add(new T.BoxGeometry(side + 0.3, P.cap[1] - P.cap[0], side + 0.3).rotateY(rot).translate(C[0], (P.cap[0] + P.cap[1]) / 2, C[1]), 'stone' as never);
    b.add(new T.ConeGeometry((side + 0.3) * 0.7, 0.45, 4, 1).rotateY(Math.PI / 4 + rot).translate(C[0], P.cap[1] + 0.22, C[1]), 'slate' as never);
    for (const br of [53, 143, 233, 323]) {
      const fd = cylFrame(C, side / 2, br, 0);
      add(fd, new T.CylinderGeometry(cs.dialRadius + 0.12, cs.dialRadius + 0.12, 0.08 + SINK, 14).rotateX(Math.PI / 2).translate(0, 0, (0.08 - SINK) / 2), 0, cs.dialCentre, 0, 'dark');
      add(fd, new T.CylinderGeometry(cs.dialRadius, cs.dialRadius, 0.14 + SINK, 14).rotateX(Math.PI / 2).translate(0, 0, (0.14 - SINK) / 2), 0, cs.dialCentre, 0, 'gold');
      for (let h = 0; h < 12; h += 3) {
        const a = h * Math.PI / 6;
        add(fd, new T.BoxGeometry(0.08, 0.26, 0.05).translate(0, cs.dialRadius - 0.2, 0.025).rotateZ(a), 0, cs.dialCentre, 0.14, 'dark');
      }
      add(fd, new T.BoxGeometry(0.07, 0.75, 0.04).translate(0, 0.33, 0.02).rotateZ(-0.6), 0, cs.dialCentre, 0.19, 'dark');
      add(fd, new T.BoxGeometry(0.09, 0.5, 0.04).translate(0, 0.22, 0.02).rotateZ(1.9), 0, cs.dialCentre, 0.19, 'dark');
      // panel band under the dial
      slab(b, fd, 0, cs.y[0] + 0.25, side - 0.6, 0.5, 0.08, 'sandstone');
    }
  }

  // =============================================================== curved canal block (SW), ring edges 31-37
  b.mark?.('canal-curve');
  {
    const W = F['w03-220'];
    const edges = [31, 32, 33, 34, 35, 36, 37];
    const fs = edges.map(i => {
      const {f, len} = fr(i);
      const offs = [0.25, 0.5, 0.75].map(k => probe.offset(f, len * k, 3)).filter((o): o is number => o !== null).sort((a, c) => a - c);
      return {f: shift(f, offs.length ? offs[1] ?? offs[0] : 0), len};
    });
    const total = fs.reduce((a, e) => a + e.len, 0);
    const at = (u: number) => {
      let acc = 0;
      for (const e of fs) { if (u <= acc + e.len || e === fs[fs.length - 1]) return {f: e.f, t: u - acc}; acc += e.len; }
      return {f: fs[0].f, t: 0};
    };
    // courses edge by edge
    fs.forEach(({f, len}) => {
      band(f, 0, len, 0, W.plinth[1], 0.22);
      for (const y of [0.65, 1.3]) band(f, 0, len, y, 0.05, 0.27);
      band(f, 0, len, W.plinth[1], 0.22, 0.3);
      band(f, 0, len, W.string[0], 0.12, 0.2);
      band(f, 0, len, W.ledge[0], W.ledge[1] - W.ledge[0], 0.4);
      band(f, 0, len, W.parapet[0], 0.3, 0.45);
    });
    const P = W.bay.pitch, u0 = W.bay.firstCentreU;
    for (let k = 0; k < W.bay.count; k++) {
      const u = u0 + P * k, {f, t} = at(u);
      // basement window, ground window under its striped hood (door in the door bay)
      win(own(shift(f, 0.22)), t, W.basementWindows.y[0], W.basementWindows.w, W.basementWindows.y[1] - W.basementWindows.y[0], {head: 'flat', bars: 3, rows: 0, glass: 'dark', frame: 'dark', surround: false, sill: false});
      if (k === W.bay.doorBay) {
        win(f, t, 2.1, 1.3, 2.3, {head: {seg: 0.3}, bars: 1, rows: 0, glass: 'dark', frame: 'dark', sill: false});
      } else {
        win(f, t, W.groundWindow.y[0], W.groundWindow.w, W.groundWindow.y[1] - W.groundWindow.y[0] + 0.25, {head: {seg: 0.25}, bars: 0, rows: 1, surround: false});
      }
      // striped hood: alternating cream / orange voussoirs
      const hw = W.groundWindow.hood.w, hy = W.groundWindow.y[1] - 0.15;
      for (let v = 0; v < 3; v++) {
        const a0 = -0.75 + 1.5 * v / 3, a1 = -0.75 + 1.5 * (v + 1) / 3, r0 = hw / 2 / Math.sin(0.75), r1 = r0 + 0.32, cy = hy + 0.4 - r0;
        const pts: [number, number][] = [[r0 * Math.sin(a0), cy + r0 * Math.cos(a0)], [r0 * Math.sin(a1), cy + r0 * Math.cos(a1)], [r1 * Math.sin(a1), cy + r1 * Math.cos(a1)], [r1 * Math.sin(a0), cy + r1 * Math.cos(a0)]];
        plate(f, t, 0, pts, 0.22, v % 2 ? 'ochre' : 'stone');
      }
      // arcade storey: paired round-headed windows, the hanging bracket between them
      const aw = W.arcade.windows;
      for (const dx of [-aw.offset, aw.offset]) { const p = at(u + dx); win(p.f, p.t, aw.y[0], aw.w, aw.y[1] - aw.y[0], {bars: 1, rows: 2, frame: 'dark', surround: false, sill: false}); }
      // striped brick: stone bands on the brick strips between the windows and the caryatid piers
      for (const dx of [-0.87, 0.87]) { const p = at(u + dx); leanSlab(b, p.f, p.t, 6.0, 0.16, 0.2, 0.05, 'stone'); }
      const br = W.arcade.bracket;
      leanSlab(b, f, t, br.y[0] + 0.5, br.w, br.y[1] - br.y[0] - 0.5, 0.45, 'stone');
      poly(b, f, t, br.y[0], [[-br.w / 2, 0.5], [br.w / 2, 0.5], [0, 0]], 0.3, 'stone');
      // projecting arched corbel table: two arches per bay from the pier capitals to the bracket
      const ar = W.arcade.arches, span = P / 2 - (W.arcade.piers.capital.w / 2 + br.w / 2);
      for (const side of [-1, 1]) {
        const uc = u + side * (br.w / 2 + span / 2), p = at(uc);
        hood(p.f, p.t, ar.springing - 0.5, span, 0.5 + span / 2, 'round', 0.18, ar.projection, 'stone');
        leanSlab(b, p.f, p.t, ar.crown + 0.18, span + 0.2, 0.25, ar.projection, 'greyBrick');
      }
    }
    // caryatid piers between the bays: pier, figure (robe, shoulders, head), capital block
    const pc = W.arcade.piers;
    for (let k = 0; k <= W.bay.count; k++) {
      const u = Math.max(0.3, u0 + P * (k - 0.5));
      if (u > total - 0.5) continue;   // the curve ends at the gable front's corner
      const {f, t} = at(u);
      leanSlab(b, f, t, W.string[1], pc.w + 0.1, pc.figure.y[0] - W.string[1] + 0.05, 0.12, 'stone');
      const fy = pc.figure.y[0], fh = pc.figure.y[1] - fy;
      add(f, new T.CylinderGeometry(0.17, 0.24, fh * 0.72, 6, 1, true).translate(0, fh * 0.36, 0.22), t, fy, 0, 'stone');      // robe
      add(f, new T.BoxGeometry(0.42, 0.2, 0.32).translate(0, fh * 0.72 + 0.1, 0.2), t, fy, 0, 'stone');                        // shoulders and arms
      add(f, new T.OctahedronGeometry(0.14).scale(0.9, 1.1, 0.9).translate(0, fh * 0.72 + 0.34, 0.24), t, fy, 0, 'stone');   // head
      leanSlab(b, f, t, fy, pc.w, fh, 0.08, 'stone');                                                                              // pier behind the figure
      leanSlab(b, f, t, pc.capital.y[0], pc.capital.w, pc.capital.y[1] - pc.capital.y[0], W.arcade.arches.projection + 0.05, 'stone');
    }
    // oriels: canted three-light bays on three storeys
    for (const uc of W.oriels.centresU) {
      const {f, t} = at(uc), ow = W.oriels.w, pj = W.oriels.projection;
      W.oriels.storeys.forEach(([y0, y1], si) => {
        const [g0, g1] = W.oriels.glass[si];
        // body: brick block with the plan of a canted bay (built as an extrusion upwards)
        const sh = new T.Shape([new T.Vector2(-ow / 2, 0), new T.Vector2(ow / 2, 0), new T.Vector2(ow / 2 - 0.45, -pj), new T.Vector2(-ow / 2 + 0.45, -pj)]);
        const body = new T.ExtrudeGeometry(sh, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2);
        add(f, body, t, y0, 0, 'greyBrick');
        // three lights: front and two cants, stone mullion posts, a stone hood slab and sill slab
        const front = own(shift({...f, origin: [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t]}, pj));
        win(front, 0, g0, ow - 1.2, g1 - g0, {head: 'flat', bars: 2, rows: 1, frame: 'white', surround: false, sill: false});
        for (const sgn of [-1, 1]) {
          const ang = Math.atan2(pj, 0.45) * sgn;
          const nx = f.n[0] * Math.cos(ang) + f.tangent[0] * Math.sin(ang), nz = f.n[1] * Math.cos(ang) + f.tangent[1] * Math.sin(ang);
          const mid: [number, number] = [f.origin[0] + f.tangent[0] * (t + sgn * (ow / 2 - 0.225)) + f.n[0] * pj / 2, f.origin[1] + f.tangent[1] * (t + sgn * (ow / 2 - 0.225)) + f.n[1] * pj / 2];
          const cf = own({origin: mid, n: [nx, nz], tangent: [nz, -nx]});
          win(cf, 0, g0, 0.32, g1 - g0, {head: 'flat', bars: 0, rows: 0, frame: 'white', surround: false, sill: false});
        }
        leanSlab(b, front, 0, g1 + 0.1, ow - 0.6, 0.22, 0.25, 'stone');
        leanSlab(b, front, 0, g0 - 0.3, ow - 0.6, 0.18, 0.2, 'stone');
        for (const dx of [-(ow - 1.2) / 2 - 0.1, (ow - 1.2) / 2 + 0.1]) leanSlab(b, front, dx, g0 - 0.12, 0.2, g1 - g0 + 0.22, 0.2, 'stone');
      });
    }
    // AMERICAN HOTEL sign standing on the roof over the curve
    for (const [word, uc] of [['AMERICAN', 9.5], ['HOTEL', 16.8]] as [string, number][]) {
      const {f, t} = at(uc), back = shift(f, -2.2);
      const x = back.origin[0] + back.tangent[0] * t, z = back.origin[1] + back.tangent[1] * t;
      const ry = roofHeightAt(source.surfaces as unknown as Surface[], x, z) ?? 23.5;
      const tx = raisedLettering({text: word, heightM: 1.0, maxWidthM: word.length * 0.85, depthM: 0.12});
      add(back, tx.geometry.translate(0, 0.5, 0), t, ry + 0.6, 0, 'stone');
      for (const dx of [-tx.widthM / 3, 0, tx.widthM / 3]) slab(b, back, t + dx, ry - 0.3, 0.08, 1.0, 0.08, 'slate', -0.09);
      slab(b, back, t, ry + 0.5, tx.widthM, 0.1, 0.08, 'slate', -0.09);
    }
  }

  // =============================================================== Leidsekade gable front (SW, ring edges 38 + 39)
  b.mark?.('gable-front');
  {
    const W = F['w05-227 + w06-234'];
    // one frame from the start of edge 38 to the end of edge 39 (3 deg apart), on the shell wall
    const a = fr(38).f, e39 = fr(39);
    const A0 = a.origin, A1: [number, number] = [e39.f.origin[0] + e39.f.tangent[0] * e39.len, e39.f.origin[1] + e39.f.tangent[1] * e39.len];
    const len = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]), tg: [number, number] = [(A1[0] - A0[0]) / len, (A1[1] - A0[1]) / len];
    const base: Frame = {origin: A0, tangent: tg, n: [-tg[1], tg[0]]};
    const offs = [1, 3, 5, 7, 9].map(t => probe.offset(base, t, 7)).filter((o): o is number => o !== null).sort((x, y) => x - y);
    const f = shift(base, offs.length ? offs[Math.floor(offs.length / 2)] : 0);
    band(f, 0, len, 0, 1.0, 0.2);
    for (const u of W.bays.u) {
      // ground storey: tall windows (door on the second bay), storey 2: paired lights with fanlights
      win(f, u, 1.3, 1.5, 3.0, {head: 'flat', bars: 1, rows: 1});
      for (const dx of [-0.42, 0.42]) win(f, u + dx, W.storey2.y[0], 0.62, W.storey2.fanlight[0] - W.storey2.y[0], {head: 'flat', bars: 0, rows: 1, surround: false, sill: false});
      win(f, u, W.storey2.fanlight[0] + 0.12, 1.5, W.storey2.fanlight[1] - W.storey2.fanlight[0] + 0.15, {head: {seg: 0.25}, bars: 3, rows: 0, surround: 'stone', sth: 0.12, sill: false});
      slab(b, f, u, W.storey2.y[0] - 0.25, 1.9, 0.14, 0.24, 'stone');
    }
    band(f, 0, len, 4.6, 0.25, 0.3);
    band(f, 0, len, W.band[0], W.band[1] - W.band[0], 0.3);
    // arcade: five round arches on colonnettes, ring tracery over them up to the balustrade
    const pitch = W.bays.pitch;
    for (const u of W.bays.u) {
      win(f, u, W.arcade.y[0], pitch - 0.4, W.arcade.y[1] - W.arcade.y[0] + 0.5, {bars: 1, rows: 1, surround: false, sill: false, frame: 'white'});
      hood(f, u, W.arcade.y[0], pitch - 0.4 + 0.14, W.arcade.y[1] - W.arcade.y[0] + 0.57, 'round', 0.14, 0.22, 'stone');
      add(f, new T.TorusGeometry(W.arcade.tracery.ring, 0.07, 3, 8).translate(0, 0, 0.12), u, 13.75, 0, 'stone');
      for (const dx of [-0.55, 0.55]) add(f, new T.TorusGeometry(0.28, 0.06, 3, 6).translate(0, 0, 0.12), u + dx, 12.85, 0, 'stone');
      add(f, new T.TorusGeometry(0.22, 0.05, 3, 6).translate(0, 0, 0.12), u + pitch / 2, 14.15, 0, 'stone');
    }
    for (let k = 0; k <= W.bays.u.length; k++) slab(b, f, W.bays.u[0] - pitch / 2 + k * pitch, W.arcade.y[0], 0.2, W.arcade.springing - W.arcade.y[0], 0.26, 'stone');
    // balustrade
    slab(b, f, len / 2, W.balustrade[0], len, 0.16, 0.42, 'stone');
    for (let t = 0.3; t < len - 0.15; t += 0.55) slab(b, f, t, W.balustrade[0] + 0.16, 0.16, W.balustrade[1] - W.balustrade[0] - 0.3, 0.2, 'stone', 0.18);
    slab(b, f, len / 2, W.balustrade[1] - 0.14, len, 0.14, 0.42, 'stone');
    // two storeys: arched windows on the outer axes of each half, narrow square-headed between
    for (const r of W.rows) {
      for (const [u, kind] of [[0.85, 'A'], [2.6, 'n'], [5.0, 'A'], [6.8, 'n'], [8.6, 'A']] as [number, string][]) {
        if (kind === 'A') win(f, u, r.y[0], 1.0, r.head - r.y[0], {bars: 1, rows: 1});
        else win(f, u, r.y[0], 0.75, r.head - r.y[0] - 0.1, {head: 'flat', bars: 0, rows: 1});
      }
    }
    band(f, 0, len, 21.4, 0.22, 0.32);
    // dormer row of four arched windows on the right half (under the gable), the zig-zag band and the lunette
    const gx = 6.9;
    for (const dx of [-2.175, -0.725, 0.725, 2.175]) win(f, gx + dx, W.dormerRow.y[0], W.dormerRow.w, W.dormerRow.y[1] - W.dormerRow.y[0] + 0.2, {bars: 1, rows: 1});
    zigzag(f, 3.9, len - 0.3, W.zigzag[0] + 0.3, W.zigzag[1] - W.zigzag[0] - 0.3, 'blue', 0.12);
    win(own(shift(f, probe.offset(f, 8.4, W.lunette.y[0] + 0.7) ?? 0.1)), 8.4, W.lunette.y[0], 2.4, W.lunette.y[1] - W.lunette.y[0] + 0.2, {head: {seg: 0.6}, bars: 3, rows: 0, frame: 'white', surround: false, sill: false});
    // the gable over the right half: stone coping along the two rakes of the 3DBAG gable wall (apex u 8.64, 28.8 m), finial
    {
      const ax = 8.64, ay = 28.8, l: [number, number] = [3.7, 24.1], r: [number, number] = [len, 27.3];
      for (const [px, py] of [l, r]) {
        const dx = ax - px, dy = ay - py, ln = Math.hypot(dx, dy);
        add(f, new T.BoxGeometry(ln, 0.35, 0.3).translate(0, 0, 0.15).rotateZ(Math.atan2(dy, dx)).translate((px + ax) / 2, (py + ay) / 2, 0), 0, 0, 0.0, 'stone');
      }
      plate(f, ax, ay - 0.2, [[-0.25, 0], [0.25, 0], [0.18, 1.2], [0, 1.9], [-0.18, 1.2]], 0.4, 'stone');
    }
  }

  // the narrow bay between the gable front and the tower (edge 43): entrance, pierced balustrade, arched windows
  {
    const W = F['w08-233'], s0 = W.edges['43'], T0 = (s: number) => s - s0;
    const f = onWall(43, [0.6, 1.2, 1.8], 6);
    win(f, T0(3.0), W.door.y[0], W.door.s[1] - W.door.s[0], W.door.y[1] - W.door.y[0], {head: 'flat', bars: 1, rows: 0, glass: 'dark', frame: 'dark'});
    win(f, T0(0.85), W.groundArches.y[0], 0.75, 1.6, {head: {seg: 0.25}, bars: 0, rows: 1});
    win(f, T0(3.2), W.groundArches.y[0], 1.8, 1.6, {head: {seg: 0.4}, bars: 1, rows: 1, surround: false});
    hood(f, T0(3.2), W.groundArches.y[0], 1.94, 1.67, {seg: 0.4}, 0.3, 0.24, 'stone');
    for (const s of [1.55, 4.6]) for (let k = 0; k < 6; k++) slab(b, f, T0(s), 4.4 + k * 0.7, k % 2 ? 0.4 : 0.55, 0.6, 0.28, 'stone');
    slab(b, f, 2.75, W.balustrade.y[0], 5.5, 0.15, 0.6, 'stone');
    for (let t = 0.25; t < 5.4; t += 0.5) slab(b, f, t, W.balustrade.y[0] + 0.15, 0.16, 0.7, 0.18, 'stone', 0.35);
    slab(b, f, 2.75, W.balustrade.y[1] - 0.15, 5.5, 0.15, 0.6, 'stone');
    win(f, T0(3.05), 9.9, 1.6, 2.8, {bars: 1, rows: 2});
    for (const y of [15.0, 19.2]) win(f, T0(3.1), y, 1.3, 2.5, {bars: 1, rows: 1});
    band(f, 0, 5.5, W.cornice[0], W.cornice[1] - W.cornice[0], 0.45);
  }

  // =============================================================== Marnixstraat corner pavilion (NE, edges 10-16)
  b.mark?.('ne-pavilion');
  {
    const W = F['w02-53'];
    const E = W.edges as Record<string, number>;
    const fL = onWall(10, [0.6, 1.2, 1.8], 3), fC = onWall(12, [1, 4, 7], 3), fR = onWall(14, [0.6, 1.2, 1.8], 3), fD = onWall(16, [0.4, 1.0], 3);
    const tL = (s: number) => s - E['10'], tC = (s: number) => s - E['12'], tR = (s: number) => s - E['14'], tD = (s: number) => s - E['16'];
    for (const [f, t0, t1] of [[fL, 0, 2.4], [fC, -0.2, 8.85], [fR, 0, 2.47]] as [Frame, number, number][]) {
      band(f, t0, t1, 0, W.plinth[1], 0.22);
      band(f, t0, t1, W.plinth[1], 0.18, 0.3);
    }
    // side bays: ground window, row of narrow lights, three windows, star gablet
    for (const [f, bay, tt] of [[fL, W.leftBay, tL], [fR, W.rightBay, tR]] as [Frame, typeof W.leftBay, (s: number) => number][]) {
      const ax = tt(bay.axis), gw = bay.groundWindow;
      win(f, tt((gw.s[0] + gw.s[1]) / 2), gw.y[0], gw.s[1] - gw.s[0], gw.y[1] - gw.y[0], {bars: 1, rows: 1});
      win(own(shift(f, 0.22)), tt((gw.s[0] + gw.s[1]) / 2), 0.4, 1.2, 0.6, {head: 'flat', bars: 3, rows: 0, glass: 'dark', frame: 'dark', surround: false, sill: false});
      const n = bay.lights.n, lw = (bay.lights.s[1] - bay.lights.s[0]) / n;
      for (let k = 0; k < n; k++) win(f, tt(bay.lights.s[0] + lw * (k + 0.5)), bay.lights.y[0], lw - 0.18, bay.lights.y[1] - bay.lights.y[0], {bars: 0, rows: 1, surround: false, sill: false, frame: 'stone'});
      slab(b, f, tt((bay.lights.s[0] + bay.lights.s[1]) / 2), bay.lights.y[0] - 0.25, bay.lights.s[1] - bay.lights.s[0] + 0.2, 0.18, 0.25, 'stone');
      for (const [y0, y1] of bay.windows) win(f, ax, y0, bay.windowWidth, y1 - y0, {bars: 1, rows: 1});
      const gb = bay.gablet, gw2 = (gb.s[1] - gb.s[0]) / 2, gc = tt((gb.s[0] + gb.s[1]) / 2);
      const pf = shift(f, probe.offset(f, gc, gb.base - 0.6) ?? 0);
      plate(pf, gc, gb.base, [[-gw2, 0], [gw2, 0], [0, gb.apex - gb.base]], 0.3, 'stone');
      plate(pf, gc, gb.base + 0.12, [[-gw2 + 0.35, 0], [gw2 - 0.35, 0], [0, gb.apex - gb.base - 0.45]], 0.36, 'blue');
      star(pf, gc, gb.base + (gb.apex - gb.base) * 0.38, 0.35, 0.42, 'gold');
    }
    // piers with pinnacles between the bays
    for (const p of W.piers) {
      const fp = p.s[0] < 5 ? fC : fC, t = tC((p.s[0] + p.s[1]) / 2);
      slab(b, fp, t, W.plinth[1], p.s[1] - p.s[0], p.top - W.plinth[1], 0.3, 'stone');
      plate(fp, t, p.top, [[-0.3, 0], [0.3, 0], [0, 0.9]], 0.32, 'stone');
    }
    // centre bay
    const C = W.centreBay;
    {
      const ba = C.bigArch, t = tC((ba.outer[0] + ba.outer[1]) / 2), ow = ba.outer[1] - ba.outer[0] - 0.7;
      // the arch field (sandstone tympanum 6 cm proud) carries three white-framed lights: round-headed side lights, a tall
      // square-headed centre light; stone mullion piers between them
      add(fC, prism(outline(ow, ba.crown - ba.sill, {seg: ba.crown - ba.springing}), 0.06), t, ba.sill, 0, 'sandstone');
      hood(fC, t, ba.sill, ow, ba.crown - ba.sill, {seg: ba.crown - ba.springing}, 0.35, 0.22, 'stone');
      const fa = own(shift(fC, 0.06));
      ba.lights.forEach(([a, c], i) => {
        const lt = tC((a + c) / 2), lw = c - a - 0.15;
        if (i === 1) win(fa, lt, ba.sill, lw, ba.centreLightTop - ba.sill, {head: 'flat', bars: 2, rows: 2, frame: 'white', surround: false, sill: false});
        else win(fa, lt, ba.sill, lw, ba.springing + 0.9 - ba.sill, {bars: 1, rows: 2, frame: 'white', surround: false, sill: false});
      });
      for (const s of [5.3, 8.15]) leanSlab(b, fC, tC(s), ba.sill, 0.35, ba.springing - ba.sill + 1.0, 0.16, 'stone');
      slab(b, fC, t, ba.sill - 0.15, ow + 0.6, 0.15, 0.3, 'stone');
    }
    // loggia: three arches on four columns, back wall 1.5 m in with windows (inferred depth)
    {
      // the loggia's back wall is the shell wall (its depth cannot be cut out of the shell): a darker field with the three
      // windows, the arches and columns standing 0.45-0.75 m in front of it
      const lg = C.loggia, back = own(shift(fC, 0.05));
      add(fC, prism(outline(7.9, lg.y[1] - lg.y[0], 'flat'), 0.05), tC(6.8), lg.y[0], 0, 'greyBrick');
      for (const s of [4.0, 6.75, 9.5]) win(back, tC(s), lg.y[0] + 0.2, 1.0, 2.0, {bars: 1, rows: 1, surround: false, sill: false});
      slab(b, fC, tC(6.8), lg.y[0] - 0.2, 8.1, 0.2, 0.8, 'stone');
      for (const [a, c] of lg.arches) hood(fC, tC((a + c) / 2), lg.y[0], c - a - 0.25, lg.y[1] - lg.y[0], 'round', 0.22, 0.3, 'stone', 0.45);
      for (const s of lg.columns) {
        add(fC, new T.CylinderGeometry(lg.columnDiameter / 2, lg.columnDiameter / 2, lg.springing - lg.y[0], 8).translate(0, (lg.springing - lg.y[0]) / 2, 0.6), tC(s), lg.y[0], 0, 'stone');
        slab(b, fC, tC(s), lg.springing - 0.3, 0.5, 0.3, 0.8, 'stone');
      }
    }
    // disc balustrade
    {
      const bl = C.balustrade, t0 = tC(bl.s[0]), t1 = tC(bl.s[1]);
      slab(b, fC, (t0 + t1) / 2, bl.y[0], t1 - t0, 0.15, 0.55, 'stone');
      slab(b, fC, (t0 + t1) / 2, bl.y[0] + 0.15, t1 - t0, bl.y[1] - bl.y[0] - 0.3, 0.3, 'stone', 0.15);
      for (let k = 0; k < bl.discs; k++) add(fC, new T.CylinderGeometry(0.18, 0.18, 0.06, 8).rotateX(Math.PI / 2).translate(0, 0, 0.03), t0 + (t1 - t0) * (k + 0.5) / bl.discs, (bl.y[0] + bl.y[1]) / 2, 0.45, 'blue');
      slab(b, fC, (t0 + t1) / 2, bl.y[1] - 0.15, t1 - t0, 0.15, 0.55, 'stone');
    }
    for (const s of C.axes) for (const [y0, y1] of C.rows) win(fC, tC(s), y0, C.windowWidth, y1 - y0, {bars: 1, rows: 1});
    for (const s of C.smallRow.s) win(fC, tC(s), C.smallRow.y[0], C.smallRow.w, C.smallRow.y[1] - C.smallRow.y[0], {bars: 1, rows: 1, sth: 0.1});
    // blue zig-zag frieze, big gable with lunette, star and finial
    const fq = shift(fC, probe.offset(fC, tC(C.gableAxis), C.frieze.y[0] + 0.5) ?? 0);
    zigzag(fq, tC(2.6), tC(10.9), C.frieze.y[0], C.frieze.y[1] - C.frieze.y[0], 'blue', 0.02);
    {
      const g = C.gable, gc = tC(C.gableAxis), hw = (g.s[1] - g.s[0]) / 2, gh = g.apex - g.base;
      const fg = shift(fC, probe.offset(fC, gc, g.base + 1.0) ?? 0);
      // coping strips along the two rakes and a buff field
      const rake = Math.atan2(gh, hw), rl = Math.hypot(hw, gh);
      for (const sgn of [-1, 1]) add(fg, new T.BoxGeometry(rl, 0.35, 0.3).translate(0, 0, 0.15).rotateZ(-sgn * rake).translate(sgn * hw / 2, gh / 2, 0), gc, g.base, 0.06, 'stone');
      win(fg, gc, g.lunette.y[0], g.lunette.s[1] - g.lunette.s[0], g.lunette.y[1] - g.lunette.y[0], {head: {seg: 0.9}, bars: 3, rows: 0, glass: 'dark', frame: 'stone'});
      star(fg, gc, (g.star.y[0] + g.star.y[1]) / 2, 0.45, 0.16, 'blue');
      plate(fg, gc, g.apex - 0.2, [[-0.25, 0], [0.25, 0], [0.18, 1.4], [0, g.finialTop - g.apex + 0.2], [-0.18, 1.4]], 0.4, 'stone');
    }
    // narrow door bay: door, tile panel
    {
      const db = W.doorBay;
      win(own(shift(fR, 0.32)), 2.05, db.door[0], 0.6, db.door[1] - db.door[0], {head: 'round', bars: 0, rows: 0, glass: 'dark', frame: 'dark', surround: false, sill: false});
      slab(b, fD, tD(15.3), db.tilePanel[0], 0.5, db.tilePanel[1] - db.tilePanel[0], 0.05, 'blue');
    }
  }

  // =============================================================== Marnixstraat main block, staircase tower, east wing (NE)
  b.mark?.('ne-street');
  {
    const {f} = fr(19, 0.3), L = 12.1;
    const fs = shift(f, probe.offset(f, 6, 3) ?? 0);
    band(fs, -0.5, L + 5.8, 0, 1.5, 0.3);
    for (const t of [1.55, 4.65, 7.75, 10.85]) {
      hood(fs, t, 1.75, 2.4, 5.9 + 0.4, {seg: 0.7}, 0.3, 0.2, 'stone');
      win(snapAt(fs, t, 4.7), t, 1.75, 2.3, 5.9, {head: 'flat', bars: 2, rows: 3, surround: false});
      win(own(shift(fs, 0.3)), t, 0.45, 0.9, 0.55, {head: 'flat', bars: 0, rows: 0, glass: 'dark', surround: false, sill: false});
      win(snapAt(fs, t, 12.3), t, 10.1, 2.2, 4.4, {bars: 1, rows: 2});
      for (let k = 1; k <= 4; k++) { const a = Math.PI * k / 5, r = 0.95; add(fs, new T.BoxGeometry(r, 0.05, 0.05).translate(r / 2, 0, 0.025).rotateZ(a), t, 10.1 + 4.4 - 1.1, 0.09, 'frame'); }
    }
    win(snapAt(fs, 13.95, 12.3), 13.95, 10.1, 2.2, 4.4, {bars: 1, rows: 2});
    for (let k = 0; k < 7; k++) {
      const t = 0.8 + 10.5 * k / 6;
      for (const [y, h] of [[15.35, 1.35], [17.05, 1.2]] as const) win(own(shift(fs, (probe.offset(fs, t, y + 0.05) ?? 0) + 0.03)), t, y, 1.2, h, {head: 'flat', bars: 1, rows: 1, frame: 'white', surround: false});   // 3DBAG slopes the top storeys back (mansard face): stand off from the face at the sill
    }
    band(fs, -0.5, L + 5.8, 8.3, 0.5, 0.35);
    band(fs, -0.5, L + 5.8, 14.95, 0.3, 0.3);
    band(fs, -0.5, L + 5.8, 18.6, 0.5, 0.45);
    for (const t of [14.2, 16.7, 19.2]) {
      const s = probe.snap(f, t, 5);
      win(s, t, 3.2, 1.4, 3.6, {bars: 1, rows: 2});
      slab(b, s, t, 1.5, 1.6, 1.5, 0.08, t === 16.7 ? 'slate' : 'white');
    }
    for (const t of [12.9, 15.45, 17.95, 20.4]) slab(b, probe.snap(f, t, 5), t, 1.5, 0.45, 5.4, 0.25, 'stone');
    // staircase tower (edge 16): one arched window per landing and the canted oriel
    const g = fr(16, 0.3).f, gs = shift(g, probe.offset(g, 1.0, 8) ?? 0);
    for (const y of [9.5, 13.1, 16.7]) win(gs, 1.4, y, 0.9, 2.0, {bars: 1, rows: 1});
    slab(b, gs, 0.6, 19.6, 2.6, 0.5, 0.45, 'stone');
    poly(b, gs, 2.3, 4.5, [[-1.0, 0], [1.0, 0], [1.0, 5.0], [-1.0, 5.0]], 0.6, 'sandstone');
    for (const dx of [-0.55, 0, 0.55]) win(gs, 2.3 + dx, 5.4, 0.35, 1.8, {bars: 0, rows: 1, glass: 'copper', surround: false, sill: false}, );
    slab(b, gs, 2.3, 9.5, 2.4, 0.3, 0.8, 'stone');
  }
  // the Leidseplein-side shopfront return was covered above; the low east wing (edge 12's neighbour) is the pavilion now.

  // =============================================================== roofline: stepped dormer gables, turret, chimney
  b.mark?.('roofline');
  {
    const Fd = own(shift(fr(58).f, -2.0)), Fb = own(shift(fr(58).f, -1.55)), Fg = own(shift(fr(58).f, -1.6));
    const stepGable = (hw: number, sh: number, n: number): [number, number][] => {
      const right: [number, number][] = [[hw, 0]];
      let w = hw;
      for (let k = 0; k < n; k++) { right.push([w, (k + 1) * sh]); w -= hw / n; if (k < n - 1) right.push([w, (k + 1) * sh]); }
      right.push([0.0, n * sh]);
      const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number]);
      return [[-hw, 0], ...right, ...left];
    };
    for (const c of [8.4, 15.9, 21.0, 26.8, 32.7]) {
      slab(b, Fd, c, 19.4, c < 10 ? 3.2 : 3.6, 2.15, 0.95, 'sandstone', -0.5);
      for (const dx of [-1, 0, 1].map(k => k * (c < 10 ? 0.9 : 1.05))) win(Fb, c + dx, 20.1, 0.6, 1.45, {bars: 0, rows: 1, frame: 'white', surround: false});
      const sil = stepGable(1.75, 0.8, 5);
      plate(Fd, c, 21.55, sil, 0.28, 'stone');
      plate(Fd, c, 21.6, sil.map(([x, y]) => [x * 0.8, y * 0.86] as [number, number]), 0.46, 'sandstone', -0.06);
      for (const dx of [-0.42, 0.42]) win(Fg, c + dx, 22.3, 0.38, 1.25, {bars: 0, rows: 0, glass: 'dark', frame: 'white', surround: false, sill: false});
      slab(b, Fd, c, 25.5, 0.45, 1.2, 0.4, 'stone');
      slab(b, Fd, c, 26.7, 0.62, 0.18, 0.5, 'stone');
      slab(b, Fd, c, 26.88, 0.05, 3.2, 0.05, 'stone', 0.18);
    }
    const Ft = fr(58).f;
    const tcx = Ft.origin[0] + Ft.tangent[0] * 4.7 + Ft.n[0] * -3.4, tcz = Ft.origin[1] + Ft.tangent[1] * 4.7 + Ft.n[1] * -3.4;
    const r = 1.15, y0 = 24.5, h = 6.4;
    b.add(new T.CylinderGeometry(r, r, h, 14, 1, true).translate(tcx, y0 + h / 2, tcz), 'stone' as never);
    b.add(new T.SphereGeometry(r * 1.05, 14, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(tcx, y0 + h, tcz), 'slate' as never);
    b.add(new T.SphereGeometry(0.16, 8, 6).translate(tcx, y0 + h + r * 0.74 + 0.1, tcz), 'stone' as never);
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * Math.PI / 4;
      b.add(new T.BoxGeometry(0.14, 1.2, 0.14).rotateY(-a).translate(tcx + Math.cos(a) * (r + 0.05), y0 + h - 1.2, tcz + Math.sin(a) * (r + 0.05)), 'dark' as never);
    }
    const cx = Ft.origin[0] + Ft.tangent[0] * 7.6 + Ft.n[0] * -3.6, cz = Ft.origin[1] + Ft.tangent[1] * 7.6 + Ft.n[1] * -3.6;
    b.add(new T.BoxGeometry(1.0, 4.6, 1.0).translate(cx, 26.3, cz), 'sandstone' as never);
    for (const dx of [-0.25, 0.25]) b.add(new T.BoxGeometry(0.14, 0.9, 1.08).translate(cx + dx, 28.0, cz), 'dark' as never);
    b.add(new T.BoxGeometry(1.3, 0.2, 1.3).translate(cx, 28.7, cz), 'stone' as never);
  }
}
