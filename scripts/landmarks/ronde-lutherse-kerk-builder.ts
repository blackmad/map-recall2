import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {slab, setSink, type Frame} from './nearbar-kit';

/**
 * Ronde Lutherse Kerk (Koepelkerk), Singel 11 / Kattengat 2 (Adriaan Dortsman 1668-71; rebuilt 1823-26 after the 1822 fire with a
 * raised dome and Roman coffers; roof restored after the 1993 fire in copper colour): a round brick drum 26.6 m across carrying a
 * low copper dome and a colonnaded glass lantern with a swan vane.
 *
 * Measured from the BAG ring (circle fitted at centre (-3.0, -3.5) native m, radius 13.16) and the 3DBAG roof planes (heights above
 * ground): drum wall to 26.4 m, dome rising from 26.6 m at r 12.6 to 34.7 m at r 4.3, lantern to 40.8 m, cap and finial to 43.3 m,
 * vane tip 45.8 m. The "zijbeuk" (annex wrapping the rear, south-east half, roofs 17.4-20.4 m) and the lower houses at the
 * north-east tail are the BAG polygon clipped to the half-plane through the drum centre (bearing 30 to 210 degrees) so the
 * annex never cuts into the exposed drum arc.
 * Window bays: nine at 40 degrees, centred on bearings 237 + 40 k (read from the Commons photograph C messier 2016, camera about 276 deg),
 * two storeys of tall rectangular windows with stone surrounds; the lower tier is hidden behind the annex on the south-east side.
 */
type Pt = [number, number];
const C: Pt = [-3.0, -3.5];
const R = 13.3;
const DOME_TOP = 34.7;
const ANNEX_H = 20.4;
const ANNEX: Pt[] = [[16.50,-24.27],[10.99,-22.13],[10.69,-22.01],[10.53,-22.13],[9.18,-20.83],[6.00,-17.43],[4.68,-15.93],[4.03,-14.87],[3.68,-15.07],[-14.34,16.14],[-12.94,16.83],[-12.41,17.09],[-11.87,17.33],[-11.33,17.55],[-10.79,17.76],[-10.23,17.96],[-9.68,18.15],[-9.12,18.32],[-8.55,18.47],[-7.99,18.61],[-7.41,18.74],[-6.84,18.85],[-6.26,18.95],[-5.68,19.03],[-5.10,19.10],[-4.52,19.15],[-3.93,19.19],[-3.35,19.21],[-3.22,19.72],[-2.62,19.73],[-2.01,19.71],[-1.41,19.69],[-0.81,19.65],[-0.20,19.59],[0.40,19.52],[1.00,19.43],[1.59,19.33],[2.19,19.21],[2.78,19.08],[3.36,18.93],[3.95,18.77],[4.53,18.59],[5.10,18.39],[5.67,18.19],[6.23,17.96],[6.79,17.73],[7.34,17.48],[7.88,17.21],[8.42,16.93],[8.95,16.64],[9.47,16.34],[9.99,16.02],[10.49,15.68],[10.99,15.34],[11.48,14.98],[11.96,14.61],[12.43,14.23],[12.89,13.83],[13.34,13.43],[13.78,13.01],[14.21,12.58],[14.62,12.14],[15.03,11.69],[15.42,11.23],[15.80,10.76],[16.17,10.28],[16.50,9.83]];
const EAST: Pt[] = [[16.50,-3.75],[16.50,9.83],[16.53,9.79],[16.88,9.29],[17.21,8.79],[17.53,8.27],[17.84,7.75],[18.13,7.21],[18.41,6.67],[18.67,6.13],[18.92,5.58],[19.16,5.02],[19.38,4.46],[19.59,3.89],[19.78,3.31],[19.96,2.73],[20.12,2.15],[20.27,1.56],[20.41,0.97],[20.52,0.37],[20.63,-0.23],[20.72,-0.83],[20.79,-1.43],[20.85,-2.03],[20.89,-2.64],[20.91,-3.24],[20.91,-3.33],[20.89,-3.40],[20.86,-3.48],[20.82,-3.55],[20.77,-3.61],[20.71,-3.66],[20.64,-3.71],[20.57,-3.74],[20.50,-3.75]];
const TAIL: Pt[] = [[20.49,-3.75],[21.33,-11.38],[22.44,-11.25],[22.77,-14.04],[22.84,-14.63],[21.73,-14.76],[21.87,-15.99],[21.96,-16.75],[22.17,-18.49],[23.14,-26.72],[22.87,-26.76],[16.50,-24.27],[16.50,-3.75],[20.50,-3.75]];

const poly3 = (pts: Pt[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));

export function buildRondeLutherseKerk(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const cyl = (rTop: number, rBot: number, y0: number, h: number, colour: string, seg = 72) =>
    b.add(new T.CylinderGeometry(rTop, rBot, h, seg).translate(0, h / 2, 0), colour as never, C[0], y0, C[1]);
  const lathe = (prof: [number, number][], y0: number, colour: string, seg = 72) =>
    b.add(new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), seg), colour as never, C[0], y0, C[1]);
  const block = (pts: Pt[], h: number, colour: string) => {
    b.add(openTopPrism(poly3(pts), 0, h), colour as never);
    const cap = upwardRoofPlane(poly3(pts), h); cap.userData.role = 'roof'; b.add(cap, 'slate' as never);
  };

  // ---------------------------------------------------------------- massing
  cyl(R, R, 0, 26.4, 'brick');
  block(ANNEX, ANNEX_H, 'brick');
  block(EAST, ANNEX_H, 'brick');
  block(TAIL, 9.5, 'brick');
  // stone plinth, string courses, entablature and the green copper gutter band that carries the dome
  cyl(R + 0.2, R + 0.2, 0, 1.0, 'stone');
  cyl(R + 0.25, R + 0.25, 14.2, 0.45, 'stone');
  cyl(R + 0.35, R + 0.35, 19.0, 0.6, 'stone');
  cyl(R + 0.6, R + 0.6, 19.6, 0.7, 'stone');
  cyl(R + 0.4, R + 0.4, 24.4, 0.7, 'stone');
  cyl(R + 0.6, R + 0.6, 26.0, 0.4, 'green');
  // dome: copper, rising from r 12.9 to the lantern base at r 4.3
  lathe([[12.9, 26.4], [12.6, 26.8], [11.4, 27.7], [10, 29.3], [8, 31.7], [6, 33.5], [4.5, 34.5], [4.3, DOME_TOP]], 0, 'copper');
  // balustraded base of the lantern, lantern core and overhanging cornice, copper cap
  cyl(4.3, 4.3, 34.4, 1.6, 'stone');
  cyl(2.45, 2.45, 36.0, 4.3, 'glass', 32);
  cyl(3.1, 3.1, 40.3, 0.5, 'stone', 32);
  lathe([[3.0, 40.8], [2.9, 41.3], [2.2, 42.1], [1.2, 42.8], [0.3, 43.2], [0, 43.3]], 0, 'copper', 32);
  b.mark?.('shell');

  // ---------------------------------------------------------------- detail
  setSink(0.3);
  const bear = (deg: number) => deg * Math.PI / 180;
  const fr = (deg: number, r = R): Frame => {
    const s = Math.sin(bear(deg)), c = Math.cos(bear(deg));
    return {origin: [C[0] + r * s, C[1] - r * c], tangent: [-c, -s], n: [s, -c]};
  };
  const BAYS = Array.from({length: 9}, (_, k) => 237 + 40 * k);
  const exposed = (deg: number) => { const d = ((deg % 360) + 360) % 360; return d >= 225 || d <= 20; };
  const mullioned = (f: Frame, y: number, w: number, h: number, nv: number, nh: number, out: number) => {
    slab(b, f, 0, y, w, h, 0.05, 'glass', out);
    for (let i = 1; i <= nv; i++) slab(b, f, -w / 2 + w * i / (nv + 1), y, 0.07, h, 0.06, 'frame', out);
    for (let j = 1; j <= nh; j++) slab(b, f, 0, y + h * j / (nh + 1), w, 0.07, 0.06, 'frame', out);
  };
  for (const deg of BAYS) {
    const f = fr(deg);
    // upper tier, above the annex roof on every bay
    slab(b, f, 0, 20.5, 4.1, 3.7, 0.16, 'stone', 0);
    mullioned(f, 20.95, 3.3, 2.8, 2, 2, 0.16);
    slab(b, f, 0, 24.2, 4.1, 0.2, 0.3, 'stone', 0);
    if (!exposed(deg)) continue;
    // lower tier: tall window, stone surround, head course
    slab(b, f, 0, 4.9, 4.2, 9.0, 0.16, 'stone', 0);
    mullioned(f, 5.3, 3.4, 8.2, 3, 5, 0.16);
    slab(b, f, 0, 13.9, 4.6, 0.3, 0.3, 'stone', 0);
  }
  // pilasters on the exposed lower tier, between the bays
  for (const deg of [217, 257, 297, 337, 17]) slab(b, fr(deg), 0, 1.0, 0.9, 13.2, 0.3, 'stone', 0);
  // entrance in the base, left of the first bays as photographed
  {
    const f = fr(337);
    slab(b, f, 0, 0.9, 2.9, 4.0, 0.2, 'stone', 0);
    slab(b, f, 0, 0.9, 1.9, 3.2, 0.1, 'dark', 0.2);
  }
  // modillions under the entablature
  for (let k = 0; k < 72; k++) {
    const d = k * 5, f = fr(d, R + 0.3);
    slab(b, f, 0, 18.5, 0.45, 0.5, 0.3, 'stone', 0);
  }
  // dome ribs: sixteen thin copper-coloured strips along the profile
  {
    const prof: [number, number][] = [[12.6, 26.8], [11.4, 27.7], [10, 29.3], [8, 31.7], [6, 33.5], [4.5, 34.5]];
    for (let k = 0; k < 16; k++) {
      const th = (k + 0.5) * Math.PI / 8;
      for (let i = 0; i < prof.length - 1; i++) {
        const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
        const len = Math.hypot(r0 - r1, y0 - y1), beta = Math.atan2(y0 - y1, r0 - r1);   // slope against the outward radial
        const g = new T.BoxGeometry(0.34, 0.1, len);
        g.rotateX(-beta);
        g.rotateY(Math.PI - th);
        const mr = (r0 + r1) / 2 + 0.0, my = (y0 + y1) / 2 + 0.03;
        g.translate(C[0] + Math.sin(th) * mr, my, C[1] - Math.cos(th) * mr);
        b.add(g, 'copper' as never);
      }
    }
  }
  // lantern: eight columns with capitals and bases, gridded glazing, small cornice
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4, rr = 2.5;
    const x = C[0] + rr * Math.sin(th), z = C[1] - rr * Math.cos(th);
    b.add(new T.CylinderGeometry(0.2, 0.2, 4.3, 8).translate(0, 2.15, 0), 'stone' as never, x, 36.0, z);
    b.add(new T.BoxGeometry(0.5, 0.3, 0.5).rotateY(-th).translate(0, 0.15, 0), 'stone' as never, x, 40.0, z);
    b.add(new T.BoxGeometry(0.46, 0.2, 0.46).rotateY(-th).translate(0, 0.1, 0), 'stone' as never, x, 36.0, z);
  }
  for (let k = 0; k < 8; k++) {
    const th = (k + 0.5) * Math.PI / 4, rr = 2.45 * Math.cos(Math.PI / 8);   // glazing sits on the octagon faces
    const bar = (w: number, h: number, x: number, y: number) =>
      b.add(new T.BoxGeometry(w, h, 0.06).translate(x, y + h / 2, 0.03).rotateY(Math.PI - th), 'frame' as never, C[0] + rr * Math.sin(th), 36.3, C[1] - rr * Math.cos(th));
    // gridded glazing: three mullions and four transoms per face
    for (const dx of [-0.5, 0, 0.5]) bar(0.05, 3.6, dx * 1.2, 0);
    for (let j = 0; j < 5; j++) bar(1.5, 0.05, 0, j * 0.9);
  }
  // finial: ball, pole and the Lutheran swan vane
  b.add(new T.SphereGeometry(0.42, 10, 8).translate(0, 0.42, 0), 'green' as never, C[0], 43.3, C[1]);
  b.add(new T.CylinderGeometry(0.06, 0.06, 1.7, 6).translate(0, 0.85, 0), 'green' as never, C[0], 43.7, C[1]);
  b.add(new T.BoxGeometry(0.95, 0.38, 0.14).translate(0, 0.19, 0), 'bronze' as never, C[0], 45.1, C[1]);
  b.add(new T.BoxGeometry(0.14, 0.6, 0.12).translate(0.38, 0.3, 0), 'bronze' as never, C[0], 45.3, C[1]);
  setSink(0);
}
