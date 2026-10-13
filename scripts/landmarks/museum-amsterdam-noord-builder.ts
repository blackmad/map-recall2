import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {bar, edgeBox, edgeDoor, edgesOf, edgeWindow, hipRoof, p3, ringPoints, walls} from './civic-kit';
import source from './museum-amsterdam-noord-footprints.json';

/**
 * Former municipal bath house of Vogeldorp (1919): a single-storey buff-brick
 * block under a steep pantile hip roof with white fascia and three white
 * dormers. BAG pand 0363100012158267; 3DBAG: ridge ~6.7 m, chimney top ~9.4 m.
 * Window/door positions are simplified from one 2025 panorama (not measured).
 */
export const NOORD_HEIGHTS = {wall: 3.25, ridge: 6.7, chimney: 9.3};
export function buildMuseumAmsterdamNoord(_w: number, _d: number, b: BuildingTools) {
  const pts = ringPoints(source.pands[0].localRing);
  const es = edgesOf(pts);
  const {wall, ridge, chimney} = NOORD_HEIGHTS;
  walls(b, pts, 0, wall, 'brick');
  // Darker brick plinth and a white string course under the eaves.
  for (const e of es) {
    edgeBox(b, e, e.len / 2, 0, e.len + .1, .55, .1, .03, 'greyBrick');
    edgeBox(b, e, e.len / 2, wall - .2, e.len + .08, .2, .09, .025, 'white');
  }
  hipRoof(b, pts, wall + .05, ridge, 'slate', {overhang: .55, ridgeHalf: .5, sag: .0});
  // White fascia board and dark bracket ends under the overhang.
  for (const e of es) {
    edgeBox(b, e, e.len / 2, wall - .02, e.len + 1.3, .24, .08, .55, 'white');
    for (let t = .5; t < e.len; t += .9) edgeBox(b, e, t, wall - .2, .1, .2, .5, .3, 'dark');
  }
  // Doors (green) and paned windows; two doors per long run, as seen from the park side.
  es.forEach((e, i) => {
    const L = e.len;
    edgeDoor(b, e, L * .2, .0, 1.0, 2.2, 'green', 'white');
    edgeWindow(b, e, L * .42, 1.0, 1.7, 1.4, {frame: 'green', mullions: 2});
    edgeWindow(b, e, L * .64, 1.0, 1.7, 1.4, {frame: 'green', mullions: 2});
    if (i % 2 === 0) edgeDoor(b, e, L * .84, .0, 1.0, 2.2, 'green', 'white');
    else edgeWindow(b, e, L * .84, 1.0, 1.0, 1.4, {frame: 'green', mullions: 1});
  });
  // Dormers: one per slope, two on the first (the photographed side).
  const c0 = pts.reduce((s, p) => s.add(p), new T.Vector2()).divideScalar(pts.length);
  const slope = (ridge - wall) / 4.6; // rise per metre inward (approx, hip with short ridge)
  es.forEach((e, i) => {
    const spots = i === 0 ? [.3, .72] : [.5];
    for (const f of spots) {
      const inward = 1.9, t = e.len * f;
      const base = wall + inward * slope - .22;
      edgeBox(b, e, t, base, 1.7, 1.3, .9, -inward - .35, 'white');
      edgeBox(b, e, t, base + .2, 1.1, .85, .06, -inward + .13, 'glass');
      edgeBox(b, e, t, base + .2, .05, .85, .08, -inward + .14, 'white');
      edgeBox(b, e, t, base + 1.3, 2.0, .1, 1.3, -inward - .3, 'slate');
    }
  });
  // Brick chimney near the ridge with a stone cap.
  const ch = c0.clone().add(new T.Vector2(.9, -.6));
  b.box(ch.x, wall, ch.y, 1.0, chimney - wall - .12, 1.0, 'brick', es[0].angle);
  b.box(ch.x, chimney - .12, ch.y, 1.25, .12, 1.25, 'stone', es[0].angle);
  void p3; void bar;
}
