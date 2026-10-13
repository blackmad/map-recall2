import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {bar} from './gothic-kit';
import {facePoly} from './worship-kit';
import source from './scheepvaartmuseum-footprints.json';

/**
 * Het Scheepvaartmuseum, 's Lands Zeemagazijn (Daniel Stalpaert, 1656), Kattenburgerplein 1. One BAG pand: a four-winged block of
 * pale stone round a courtyard (28 m, glass-roofed since 2011), a hipped slate roof with dormers and chimneys, and a pedimented
 * pavilion in the middle of each side. Massing is the 3DBAG LoD2.2 shell (wing walls 17.4 m, pavilions 20 m, pediments 22.9 m);
 * the openings are measured by eye from the municipal panoramas (2017-2025) and laid out per facade along the wing plane:
 *  - NW (water, 331.8 degrees, 64.7 m): 10 axes per wing 'wwAwwAwwA w' counted from the pavilion; 5-axis pavilion with three
 *    arched windows over a three-arch ground arcade and three plaques (photo ref-nw.jpg, 2021);
 *  - SE (Kattenburgerplein, 151.8 degrees, 64.7 m): entrance pavilion with a round-headed door, arched windows, a relief cartouche
 *    over it; wings 'wwwwAwwwwAww' (photo ref-se.jpg, 2025; the outer wing axes beyond the photographed five are repeated);
 *  - NE (61.9 degrees, 57.8 m) and SW (241.9 degrees, 57.8 m): 12.6 m pavilions between wings of 11 axes 'AwwwAwwwAww'; the SW
 *    face is hidden behind the moored ship Amsterdam in every panorama, so it repeats the NE layout (inferred).
 * A tall arched opening ('A') is a shuttered hoist door: dark in the two upper storeys, glazed on the ground floor.
 * Rows (sill, height) above the street: basement 0.75/0.6, ground 2.45/2.2, mezzanine 6.1/0.85, third 8.9/2.1, fourth 13.1/2.1;
 * the pavilions run each row a little higher (ground 2.8, mezzanine 7.5, third 11.0, fourth 16.0).
 */
type Row = {y: number; h: number; ah: number};
const WING: Record<string, Row> = {
  base: {y: 0.75, h: 0.6, ah: 0.9}, ground: {y: 2.45, h: 2.2, ah: 2.9}, mezz: {y: 6.1, h: 0.85, ah: 0}, r3: {y: 8.9, h: 2.1, ah: 3.1}, r4: {y: 13.1, h: 2.1, ah: 3.2},
};
const PAV: Record<string, Row> = {
  ground: {y: 2.8, h: 2.3, ah: 3.0}, mezz: {y: 7.5, h: 0.85, ah: 0}, r3: {y: 11.0, h: 2.5, ah: 2.5}, r4: {y: 16.0, h: 2.5, ah: 2.6},
};
type Face = {
  name: string; brg: number; t0: number; c: number; pw: number; tEnd: number; d1: number; d2: number; dp: number;
  wingAxes: string; pavGround: string; pavUpper: string; pavAxes: number[];
};
// t0/tEnd/c: tangent coordinates (global, from the anchor) of the facade ends and the pavilion centre; d1/d2/dp: wall-plane
// distances along the outward normal of the left wing, right wing and pavilion front, all read from the 3DBAG wall surfaces.
const FACES: Face[] = [
  {name: 'NW', brg: 331.8, t0: -32.6, c: -0.15, pw: 15.3, tEnd: 32.1, d1: 28.97, d2: 28.97, dp: 32.14, wingAxes: 'wwAwwAwwAw', pavGround: 'waaaw', pavUpper: 'waaaw', pavAxes: [-6.0, -3.1, 0, 3.1, 6.0]},
  {name: 'SE', brg: 151.8, t0: -32.0, c: 0.05, pw: 15.5, tEnd: 32.5, d1: 29.0, d2: 28.79, dp: 32.01, wingAxes: 'wwwwAwwwwAww', pavGround: 'waDaw', pavUpper: 'waaaw', pavAxes: [-6.0, -3.1, 0, 3.1, 6.0]},
  {name: 'NE', brg: 61.9, t0: -28.2, c: 0.05, pw: 12.5, tEnd: 29.0, d1: 32.55, d2: 32.55, dp: 35.1, wingAxes: 'AwwwAwwAw', pavGround: 'aaDaa', pavUpper: 'aaAaa', pavAxes: [-4.9, -3.0, 0, 3.1, 4.9]},
  {name: 'SW', brg: 241.9, t0: -28.5, c: 0.1, pw: 12.6, tEnd: 29.1, d1: 32.12, d2: 32.12, dp: 34.83, wingAxes: 'AwwwAwwAw', pavGround: 'aaAaa', pavUpper: 'aaAaa', pavAxes: [-4.9, -3.0, 0, 3.1, 4.9]},
];

export function buildScheepvaartmuseum(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.2);
  addShell(b, source as never, {wall: 'stone', roof: 'slate'});
  b.mark?.('shell');

  /** Flat coloured quad in the wall plane, `out` metres proud of it. */
  const quad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) =>
    put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
  const archShape = (w: number, h: number) => {
    const s = new T.Shape(), r = w / 2;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
    return new T.ShapeGeometry(s, 6);
  };
  const archQuad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) =>
    put(b, f, archShape(w, h), t, y, out, colour);

  /** Rectangular sash window: framed box with glass, a centre post and two transoms, stone sill. */
  const sash = (f: Frame, t: number, y: number, w: number, h: number, glass = 'glass') => {
    slab(b, f, t, y - 0.07, w + 0.24, h + 0.14, 0.06, 'frame');
    quad(f, t, y, w, h, 0.10, glass);
    quad(f, t, y, 0.05, h, 0.13, 'frame');
    for (const k of [1 / 3, 2 / 3]) quad(f, t, y + h * k - 0.025, w, 0.05, 0.13, 'frame');
    slab(b, f, t, y - 0.17, w + 0.5, 0.1, 0.2, 'white');
  };
  /** Round-headed window or door opening with a pale surround. */
  const arch = (f: Frame, t: number, y: number, w: number, h: number, glass: string, bars = true) => {
    archQuad(f, t, y - 0.06, w + 0.36, h + 0.2, 0.05, 'white');
    archQuad(f, t, y, w, h, 0.10, glass);
    if (bars) {
      quad(f, t, y, 0.05, h - w / 2, 0.13, 'frame');
      quad(f, t, y + (h - w / 2) * 0.5, w, 0.05, 0.13, 'frame');
    }
    slab(b, f, t, y - 0.16, w + 0.5, 0.1, 0.2, 'white');
  };
  const plaque = (f: Frame, t: number, y: number, w: number, h: number) => {
    slab(b, f, t, y, w + 0.3, h + 0.3, 0.08, 'white');
    quad(f, t, y + 0.15, w, h, 0.12, 'sandstone');
  };

  for (const F of FACES) {
    const nrm: [number, number] = [Math.sin(F.brg * Math.PI / 180), -Math.cos(F.brg * Math.PI / 180)];
    const tan: [number, number] = [nrm[1], -nrm[0]];
    const mk = (d: number): Frame => ({origin: [nrm[0] * d + tan[0] * F.t0, nrm[1] * d + tan[1] * F.t0], tangent: tan, n: nrm});
    const f1 = mk(F.d1), f2 = mk(F.d2), fp = mk(F.dp);
    const pc = F.c - F.t0, pw = F.pw, w1 = pc - pw / 2, p1 = pc + pw / 2, w2 = F.tEnd - F.t0 - p1;
    // cornices: wings at 17.4, pavilion at 20
    for (const [f, t, len] of [[f1, w1 / 2, w1], [f2, p1 + w2 / 2, w2]] as [Frame, number, number][]) {
      slab(b, f, t, 16.95, len + 0.2, 0.5, 0.5, 'white');
      slab(b, f, t, 16.55, len + 0.2, 0.18, 0.3, 'white');
    }
    slab(b, fp, pc, 19.45, pw + 0.2, 0.5, 0.55, 'white');
    // pediment: a stone plate up to the true apex (3DBAG trims the gable peak), raking cornices, recessed tympanum with a low relief
    const half = pw / 2;
    poly(b, fp, pc, 19.97, [[-half + 0.06, 0], [half - 0.06, 0], [0, 3.0]], 0.3, 'stone');
    for (const s of [-1, 1]) bar(b, fp, pc + s * (half - 0.15), 20.1, pc, 22.85, 0.34, 0.2, 'white', 0.3);
    poly(b, fp, pc, 20.6, [[-half + 1.2, 0], [half - 1.2, 0], [0, 1.8]], 0.08, 'sandstone', 0.3);
    for (const [dx, dh] of [[-2.4, 0.5], [-1.2, 0.8], [0, 1.0], [1.2, 0.7], [2.4, 0.45]]) slab(b, fp, pc + dx, 20.68, 0.85, dh, 0.14, 'white', 0.38);

    // wings: axes counted from the pavilion outward
    const wing = (f: Frame, axes: string, len: number, startT: number, dir: 1 | -1) => {
      const n = axes.length, pitch = (len - 1.8) / (n - 1);
      axes.split('').forEach((c, k) => {
        const t = startT + dir * (0.9 + k * pitch);
        const arched = c === 'A';
        if (arched) arch(f, t, WING.base.y, 0.8, WING.base.ah, 'dark', false); else sash(f, t, WING.base.y, 0.7, WING.base.h);
        if (arched) arch(f, t, WING.ground.y, 1.3, WING.ground.ah, 'glass'); else sash(f, t, WING.ground.y, 1.0, WING.ground.h);
        if (arched) plaque(f, t, WING.mezz.y, 1.2, 0.5); else sash(f, t, WING.mezz.y, 0.8, WING.mezz.h);
        for (const r of ['r3', 'r4']) {
          if (arched) arch(f, t, WING[r].y, 1.3, WING[r].ah, 'dark', false); else sash(f, t, WING[r].y, 1.0, WING[r].h);
        }
      });
    };
    wing(f1, F.wingAxes, w1, w1, -1);
    wing(f2, F.wingAxes, w2, p1, 1);

    // pavilion: five axes
    F.pavAxes.forEach((dx, k) => {
      const t = pc + dx, g = F.pavGround[k], outer = k === 0 || k === 4;
      if (g === 'D') arch(fp, t, 0.9, 1.7, 3.3, 'dark');
      else if (g === 'A') arch(fp, t, PAV.ground.y, 1.9, PAV.ground.ah + 0.4, 'glass');
      else if (g === 'a') arch(fp, t, PAV.ground.y, 1.3, PAV.ground.ah, 'glass');
      else sash(fp, t, PAV.ground.y, 1.0, PAV.ground.h);
      if (k === 2 || (F.name === 'NW' && !outer)) plaque(fp, t, PAV.mezz.y - 0.05, 1.5, 0.6);
      else sash(fp, t, PAV.mezz.y, 0.85, PAV.mezz.h);
      for (const r of ['r3', 'r4'] as const) {
        const u = F.pavUpper[k];
        if (u === 'w') sash(fp, t, PAV[r].y, 1.0, PAV[r].h);
        else if (u === 'A') arch(fp, t, PAV[r].y, 1.9, PAV[r].ah + 0.5, 'glass');
        else arch(fp, t, PAV[r].y, 1.25, PAV[r].ah, 'glass');
      }
    });

    // windows on the pavilion's two side returns (one per storey): photographed only on the SE (entrance) pavilion, so only drawn there
    if (F.name === 'SE') {
      const dm = (F.dp - F.d1) / 2, dn = (F.dp - F.d2) / 2;
      const L: Frame = {origin: [nrm[0] * F.d1 + tan[0] * (F.t0 + w1), nrm[1] * F.d1 + tan[1] * (F.t0 + w1)], tangent: nrm, n: [-tan[0], -tan[1]]};
      const R: Frame = {origin: [nrm[0] * F.dp + tan[0] * (F.t0 + p1), nrm[1] * F.dp + tan[1] * (F.t0 + p1)], tangent: [-nrm[0], -nrm[1]], n: tan};
      for (const [rf, tt] of [[L, dm], [R, dn]] as [Frame, number][]) {
        sash(rf, tt, PAV.ground.y, 0.9, PAV.ground.h);
        sash(rf, tt, PAV.mezz.y, 0.8, PAV.mezz.h);
        sash(rf, tt, 11.0, 0.9, 2.1);
        sash(rf, tt, 14.5, 0.9, 2.1);
      }
    }

    // dormers above the tall arched axes of the wings (hipped slate roof, pitch 0.6, dormer fronts 2.4 m behind the wall plane)
    const dormers = (f: Frame, axes: string, len: number, startT: number, dir: 1 | -1) => {
      const pitch = (len - 1.8) / (axes.length - 1);
      axes.split('').forEach((c, k) => {
        if (c !== 'A') return;
        const off = 0.9 + k * pitch;
        if (off < 3.0 || len - off < 9.5) return;   // the hipped ends of the roof (half a wing deep) carry no dormers here
        const t = startT + dir * off;
        const W = (dt: number, y: number, out: number) => [f.origin[0] + f.tangent[0] * (t + dt) + f.n[0] * out, y, f.origin[1] + f.tangent[1] * (t + dt) + f.n[1] * out];
        // the 3DBAG roof here is steep (about 50 degrees: 17.6 m at the wall, 20.5 m 2.4 m back, ridge 22.5 m 4 m back)
        slab(b, f, t, 18.0, 1.3, 3.1, 2.0, 'stone', -3.4);
        quad(f, t, 19.45, 0.85, 1.15, -1.37, 'glass');
        quad(f, t, 19.45, 0.05, 1.15, -1.33, 'frame');
        quad(f, t, 19.95, 0.85, 0.05, -1.33, 'frame');
        facePoly(b, [W(-0.75, 21.1, -1.4), W(0.75, 21.1, -1.4), W(0, 21.65, -1.4)], 'stone', [f.n[0], 0, f.n[1]]);
        for (const s of [-1, 1]) facePoly(b, [W(s * 0.85, 21.05, -1.3), W(0, 21.7, -1.3), W(0, 21.2, -3.4), W(s * 0.85, 20.6, -3.4)], 'slate', [s * f.tangent[0] * 0.5, 1, s * f.tangent[1] * 0.5], 'roof');
      });
    };
    dormers(f1, F.wingAxes, w1, w1, -1);
    dormers(f2, F.wingAxes, w2, p1, 1);
  }

  // 2011 glass roof over the courtyard (hole of the BAG ground surface), flat at the inner eaves
  {
    const hole = (source as never as {surfaces: {type: string; rings: number[][][]}[]}).surfaces.find(s => s.type === 'GroundSurface')!.rings[1];
    const cx = hole.reduce((s, p) => s + p[0], 0) / hole.length, cz = hole.reduce((s, p) => s + p[2], 0) / hole.length;
    const pts = hole.map(p => { const dx = p[0] - cx, dz = p[2] - cz, l = Math.hypot(dx, dz); return [p[0] + dx / l * 0.05, 17.1, p[2] + dz / l * 0.05]; });
    facePoly(b, pts, 'glass', [0, 1, 0], 'roof');
  }
  setSink(0);
}
