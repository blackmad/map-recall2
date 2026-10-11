import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, letters, put} from './nearbar-kit';
import {rawWall} from './big-kit';
import {ribbon, beginFacade, addShellTess, windowGrid, centredColumns, claimOpening} from './big-facade';
import raw from './vriesseveem-9-footprints.json';

/**
 * Piet Hein Buildings, Piet Heinkade 61-135 (BAG pand 0363100012239869 = Vriesseveem 9 / Piet Heinkade 67 / Blauwhoedenveem 4, BAG 2013, 11
 * bouwlagen, 71 verblijfsobjecten of which 63 offices, 42,143 m2). Hans van Heeswijk Architects, construction 2008, completed 2014: four units
 * on one underground garage beside the Passenger Terminal Amsterdam, glass-clad touring-car garage at ground level, 9-storey office blocks
 * with city views and a four-storey harbour-side block, linked by glazed bridges (heeswijk.nl). The pand's own 3DBAG massing: south front on
 * Piet Heinkade 33.4 m (11 storeys), harbour (north) side 22.5 m.
 * Facade rhythm read from the 2025-06-16 municipal panoramas (artifacts/landmark-lanes/vriesseveem-9/ref-*.jpg):
 *  - south front, ref-south.jpg: grey-green aluminium panel cladding with vertical window strips (about 2.3 m wide on a 4.4 m pitch) divided by
 *    horizontal transoms (about three lights per 3 m storey) and floor bands, from pavement to roof;
 *  - the main entrance (Piet Hein 81-95) is a tall curved glazed lobby behind round grey columns with the white PIET HEIN BUILDINGS lettering,
 *    ref-entrance.jpg; the east end carries glass-block walls and a diagonal steel grille on the garage, ref-east.jpg.
 * INFERRED: the harbour (north) front, the west end and every face above the panorama reach (about 20 m): same strip module as the south front;
 * the bridges and the inner courtyard walls are not modelled.
 */
const source = {...raw, surfaces: raw.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(p => [p[0], Math.max(0, p[1]), p[2]]))}))};
const surfaces = source.surfaces as {type: string; rings: number[][][]}[];
const ring = (source as {nativeRing: number[][]}).nativeRing;

function onPerimeter(mx: number, mz: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (mz - a[1]) * dz) / l2));
    if (Math.hypot(mx - (a[0] + t * dx), mz - (a[1] + t * dz)) < 0.6) return true;
  }
  return false;
}

const LOBBY = 53;
const STOREY = 3.04;

/**
 * The entrance lobby: a convex, full-height (three storeys, 9.1 m) glazed bow in plan, ref-entrance.jpg: one welded curved glass sheet
 * (so the audit reads it as the wall it is, not as a floating opening) with silver mullions about every 1.4 m and transoms about every
 * 1.3 m, a slab edge on top where the cladding starts, round grey columns on a concentric arc in front, and the white PIET HEIN
 * lettering (about 1.2 m cap height, mounted on stand-offs 0.4 m in front of the glass, drawn in a non-opening material).
 */
function lobby(b: BuildingTools, w: ReturnType<typeof rawWall>) {
  const t0 = 0.8, t1 = w.len - 0.8, tm = (t0 + t1) / 2, hc = (t1 - t0) / 2, bulge = 1.7, H = 3 * STOREY - 0.4;
  const out = (t: number) => bulge * (1 - ((t - tm) / hc) ** 2);
  const slope = (t: number) => Math.atan(-bulge * 2 * (t - tm) / (hc * hc));
  const N = Math.round((t1 - t0) / 1.4), pos: number[] = [], idx: number[] = [];
  for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; pos.push(t, 0.05, out(t), t, H, out(t)); }
  for (let k = 0; k < N; k++) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  put(b, w.f, g, 0, 0, 0, 'glass');
  const nm = N;
  for (let k = 0; k <= nm; k++) {
    const t = Math.min(t1 - 0.06, Math.max(t0 + 0.06, t0 + (t1 - t0) * k / nm)), ta = t - 0.045, tb = t + 0.045;
    const mg = new T.BufferGeometry();
    mg.setAttribute('position', new T.Float32BufferAttribute([ta, 0.05, out(ta) + 0.06, tb, 0.05, out(tb) + 0.06, ta, H, out(ta) + 0.06, tb, H, out(tb) + 0.06], 3));
    mg.setIndex([0, 1, 2, 2, 1, 3]); mg.computeVertexNormals();
    put(b, w.f, mg, 0, 0, 0, 'frame');
  }
  const rows = Math.round(H / 1.3);
  const strip = (y: number, h: number, o: number) => {
    const ps: number[] = [], ix: number[] = [];
    for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; ps.push(t, y, out(t) + o, t, y + h, out(t) + o); }
    for (let k = 0; k < N; k++) { const q = 2 * k; ix.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(ps, 3)); sg.setIndex(ix); sg.computeVertexNormals();
    put(b, w.f, sg, 0, 0, 0, 'frame');
  };
  for (let r = 1; r < rows; r++) strip(r * H / rows - 0.035, 0.07, 0.06);
  strip(0.05, 0.12, 0.06);
  // slab edge on top of the glass, from the wall plane to the arc
  const sh = new T.Shape();
  sh.moveTo(t0, 0);
  for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; sh.lineTo(t, -out(t) - 0.15); }
  sh.lineTo(t1, 0); sh.lineTo(t0, 0);
  put(b, w.f, new T.ExtrudeGeometry(sh, {depth: 0.5, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, H, 0), 0, 0, 0, 'greyBrick');
  for (const t of [tm - 5, tm, tm + 5]) {
    put(b, w.f, new T.CylinderGeometry(0.25, 0.25, H, 12).translate(0, H / 2, 0), t, 0, out(t) + 1.1, 'greyBrick');
  }
  letters(b, w.f, 'PIET', tm + 1.4, 5.3, out(tm + 1.4) + 0.4, 0.17, 0.05, 'concrete');
  letters(b, w.f, 'HEIN', tm + 1.4, 3.9, out(tm + 1.4) + 0.4, 0.17, 0.05, 'concrete');
}

export function buildVriesseveem9(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShellTess(b, source as never, {wall: 'greyBrick', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(source as never);
  setSink(0.3);
  const storey = 3.04;
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 2.4) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 3) return;
    const mx = w.f.origin[0] + w.f.tangent[0] * w.len / 2, mz = w.f.origin[1] + w.f.tangent[1] * w.len / 2;
    const perim = onPerimeter(mx, mz);
    const east = perim && w.bearing > 90 && w.bearing < 125;
    let y0 = 0.4;
    if (!perim) { y0 = Math.max(0.4, w.base + 0.4); } else if (i === LOBBY) {
      lobby(b, w);
      y0 = 3 * storey + 0.4;
    } else if (east && w.base < 0.5) {
      // glass-block garage wall (ground floor, to 6.6 m)
      for (let t = 0.6; t + 3 <= w.len - 0.4; t += 6.5) ribbon(b, w, t, Math.min(t + 6.3, w.len - 0.4), 0.4, 6.2, {ring: 0.05, frame: 'frame', glass: 'concrete'});
      y0 = 7.0;
    }
    const ww = Math.min(2.9, w.len - 0.9), c = centredColumns(w.len, 4.4, Math.max(1.6, ww / 2 + 0.5) > w.len / 2 ? ww / 2 + 0.25 : 1.6);
    const sills: number[] = [];
    for (let f = 0; f * storey + 0.5 < w.top - 1.2; f++) {
      for (let j = 0; j < 3; j++) {
        const y = f * storey + 0.4 + j * 0.88;
        if (y >= y0 && y + 0.82 <= w.top - 0.5) sills.push(+y.toFixed(2));
      }
    }
    const cw = ww / 2 - 0.1;
    for (const dt of [-ww / 4, ww / 4]) windowGrid(b, w, {t0: c.t0 + dt, pitch: c.pitch, n: c.n, w: cw, h: 0.82, sills, frame: 'frame', glass: 'glass', ring: 0.03});
    void claimOpening;
  });
  setSink(0);
}
