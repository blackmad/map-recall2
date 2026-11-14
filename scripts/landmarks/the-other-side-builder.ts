import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf, type Wall} from './worship-walls';
import {frameOf, getSink, leanSlab, letters, put, ringSlab, sashWindows, setSink, slab, type Frame} from './nearbar-kit';
import {profiledRibs, type RibOpening} from '../../src/canalRecall/landmarks/profiledCladding';
import source from './the-other-side-footprints.json';

/**
 * THE OTHER SIDE, Rigakade 10 (BAG pand 0363100012133795, bouwjaar 1991; OSM venue n12269195215, building w57860087):
 * a club with a 1,000-person main room and an L-ISA spatial sound system, opened in a converted bicycle workshop in
 * the Houthavens (iamsterdam.com, djlifemag.com 2025-04). The pand is a 1991 business unit: a two-storey office
 * L of grey brick on the west and a 75 m single-storey hall of profiled steel sheet on the east. Massing is the 3DBAG
 * LoD2.2 shell in native east/south metres (the-other-side-footprints.json); detail from the Gemeente Amsterdam
 * panoramas (CC BY 4.0) and the PDOK 2025 orthophoto (CC BY 4.0), the-other-side-inventory.json:
 *  - hall SW end (#9, 25.5 m): black profiled sheet over a grey block plinth with two white ribbon windows, a dark
 *    central door with the white "cb" mark of the bicycle firm (ConnectBike) whose workshop it was, two roof vents, a
 *    white banner board at the west end and a blue one at the east end (2025_09_29_07_54_42_00205, 2025-09-29; the
 *    rectified recording_2024-10-09_07-48-40_00185 gives the positions at 50 px/m). The banners are drawn as plain
 *    panels: they are tenants' boards, not the building's name.
 *  - hall NW end bay (#39, 11.2 m): light grey sheet over the plinth, a glazed door, a window and a teal door (rectified
 *    TMX7316010203-002366_pano_0003_000138, 2021).
 *  - office SW front (#17, 20.8 m): seven bays of tall white-framed windows on both floors, and the open steel letter
 *    frame on the roof whose two posts run down the facade (rectified TMX7316010203-002216_pano_0002_000350, 2021;
 *    2025_09_29_07_54_42_00210/00213). The letters cannot be read at panorama resolution: drawn as the frame with a
 *    vertical and a diagonal stroke per letter cell.
 *  - office NW side (#35): the same window rhythm (2025_09_29_07_54_42_00213, oblique).
 *  - roofs: fifteen rooflights and the ridge light on the hall from the orthophoto.
 *  - no photo: the hall's NW long side over the private car park (#42), its SE side on the service lane (#5), its NE
 *    end (#52) and the office's NE/SE walls: inferred, the visible cladding and window rhythm carried round.
 */
export function buildTheOtherSide(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.05, true);
  const top = (s: {rings: number[][][]}) => Math.max(...s.rings[0].map(p => p[1]));
  const base = (s: {rings: number[][][]}) => Math.min(...s.rings[0].map(p => p[1]));
  // Wall colour by height band: links 3.8 m, hall 5.6 m (SW end black), ridge light 6.1 m, office 7.3 m, roof plant above.
  const wallColour = (s: {rings: number[][][]}, i: number) => {
    const h = top(s);
    if (h < 4.2) return 'greyBrick';
    if (h < 5.8) return i === 9 ? 'dark' : 'concrete';
    if (h < 6.3 && base(s) > 5.5) return 'frame';
    if (h < 7.6) return 'brick';
    return 'greyBrick';
  };
  for (const c of ['greyBrick', 'dark', 'concrete', 'frame', 'brick']) {
    addShell(b, source as never, {wall: c, roof: 'slate', skip: (s, i) => (s.type === 'RoofSurface' ? c !== 'brick' : wallColour(s, i) !== c),
      roofFor: s => (top(s) > 5.9 && top(s) < 6.3 ? 'frame' : top(s) > 6.3 ? 'sandstone' : 'slate')});
  }
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;

  /** Hall wall: block plinth, profiled sheet ribs in the wall colour, eaves trim. */
  const hall = (w: Wall, colour: 'dark' | 'concrete', plinth: number, openings: RibOpening[] = []) => {
    const f = frameOf(w);
    slab(b, f, w.length / 2, 0, w.length, plinth, 0.1, 'brick');
    for (const r of profiledRibs({length: w.length, y0: plinth, y1: 5.45, pitch: 0.4, rib: 0.1, openings, endMargin: 0.35})) leanSlab(b, f, (r.t0 + r.t1) / 2, r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.06, colour);
    slab(b, f, w.length / 2, 5.45, w.length, 0.35, 0.1, colour);
  };
  /** White ribbon window in the plinth: frame, glass and mullions about every 1.25 m. */
  const ribbon = (f: Frame, t0: number, t1: number, y0: number, y1: number) => {
    slab(b, f, (t0 + t1) / 2, y0 - 0.05, t1 - t0 + 0.1, y1 - y0 + 0.1, 0.14, 'white');
    slab(b, f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.2, 'glass');
    const n = Math.max(1, Math.round((t1 - t0) / 1.25));
    for (let k = 1; k < n; k++) slab(b, f, t0 + (t1 - t0) * k / n, y0, 0.07, y1 - y0, 0.26, 'white');
  };
  /** Roof vent standing `back` metres behind the wall line. */
  const vent = (w: Wall, t: number, back: number, roof: number) => {
    const x = w.origin[0] + w.tangent[0] * t - w.n[0] * back, z = w.origin[1] + w.tangent[1] * t - w.n[1] * back;
    b.add(new T.CylinderGeometry(0.22, 0.22, 0.55, 10).translate(0, 0.275, 0), 'stone' as never, x, roof - 0.08, z);
    b.add(new T.CylinderGeometry(0.36, 0.36, 0.12, 10).translate(0, 0.06, 0), 'stone' as never, x, roof + 0.47, z);
  };

  // ---- Hall SW end (#9), t from the W end ----
  {
    const w = wall(9), f = frameOf(w);
    const door = {t0: 12.3, t1: 15.1, y0: 0, y1: 3.0}, tp = {t0: 0.3, t1: 3.6, y0: 3.4, y1: 5.4}, vr = {t0: 22.0, t1: 25.2, y0: 3.6, y1: 5.3};
    hall(w, 'dark', 2.3, [door, tp, vr]);
    ribbon(f, 5.4, 12.2, 1.45, 2.18);
    ribbon(f, 15.4, 25.0, 1.45, 2.18);
    slab(b, f, 13.7, 0, 2.8, 3.0, 0.14, 'dark');
    slab(b, f, 13.7, 2.95, 3.0, 0.12, 0.2, 'dark');
    // the "cb" mark: two white rings and the stem of the b
    ringSlab(b, f, 13.3, 1.55, 0.24, 0.33, 0.08, 'white', 0.12);
    ringSlab(b, f, 14.1, 1.55, 0.24, 0.33, 0.08, 'white', 0.12);
    slab(b, f, 13.82, 1.4, 0.09, 1.0, 0.2, 'white');
    // tenants' boards, plain
    slab(b, f, (tp.t0 + tp.t1) / 2, tp.y0, tp.t1 - tp.t0, tp.y1 - tp.y0, 0.12, 'white');
    slab(b, f, (vr.t0 + vr.t1) / 2, vr.y0, vr.t1 - vr.t0, vr.y1 - vr.y0, 0.12, 'blue');
    // board lettering as photographed in 2025: purple TEMPORARY PALACES, plain capitals. The blue board's small white VIRTUAL REALITY EXPERIENCE is left off: at 0.024 m pixels audit:glb reads the glyph run as an overhanging opening.
    letters(b, f, 'TEMPORARY', (tp.t0 + tp.t1) / 2, 4.55, 0.12, 0.05, 0.03, 'pink');
    letters(b, f, 'PALACES', (tp.t0 + tp.t1) / 2, 3.95, 0.12, 0.05, 0.03, 'pink');
    vent(w, 11.4, 1.5, 5.62);
    vent(w, 16.2, 1.5, 5.62);
  }
  // ---- Hall NW end bay (#39), t from the NE end ----
  {
    const w = wall(39), f = frameOf(w);
    const glazedDoor = {t0: 3.2, t1: 4.5, y0: 0, y1: 2.3}, win = {t0: 4.6, t1: 6.2, y0: 0.8, y1: 2.1}, teal = {t0: 8.8, t1: 10.0, y0: 0, y1: 2.6};
    hall(w, 'concrete', 2.46, [teal]);
    slab(b, f, 3.85, 0, 1.4, 2.35, 0.14, 'dark');
    slab(b, f, 3.85, 0.05, 1.2, 2.2, 0.19, 'glass');
    ribbon(f, win.t0, win.t1, win.y0, win.y1);
    ribbon(f, 1.35, 3.0, 0.8, 2.1);
    slab(b, f, 9.4, 0, 1.2, 2.6, 0.2, 'green');
    void glazedDoor;
    vent(w, 8.3, 1.5, 5.62);
  }
  // ---- Hall long sides and NE end: no photo, the visible cladding carried round ----
  for (const i of [42, 5, 52]) hall(wall(i), 'concrete', 2.3);

  // ---- Office: tall white-framed windows, seven bays on the SW front ----
  const officeWindows = (f: Frame, ts: number[], wide: number[] = [], lower = true) => {
    for (const t of ts) {
      const w = wide.includes(t) ? 1.8 : 1.2, cols = wide.includes(t) ? 2 : 1;
      sashWindows(b, f, [t], {y: 4.2, w, h: 2.3, cols, rows: 3, frame: 'white', glass: 'glass'});
      if (lower) sashWindows(b, f, [t], {y: 0.6, w, h: 2.34, cols, rows: 3, frame: 'white', glass: 'glass'});
    }
  };
  {
    const w = wall(17), f = frameOf(w);
    officeWindows(f, [2.84, 5.61, 8.06, 10.51, 12.95, 15.4, 18.18], [2.84, 18.18]);
    slab(b, f, w.length / 2, 7.15, w.length + 0.04, 0.3, 0.08, 'greyBrick');
    // Open steel letter frame on the roof; its posts run down the front.
    const p0 = 6.8, p1 = 14.2, y0 = 7.45, y1 = 9.45;
    for (const t of [p0, p1]) slab(b, f, t, 0, 0.14, y1 + 0.05, 0.16, 'bronze');
    for (const y of [y0, y1 - 0.08]) slab(b, f, (p0 + p1) / 2, y, p1 - p0, 0.08, 0.12, 'bronze');
    const cells = 5, cw = (p1 - p0) / cells;
    for (let k = 0; k < cells; k++) {
      const c = p0 + cw * (k + 0.5), lx = c - cw * 0.3, rx = c + cw * 0.3;
      slab(b, f, lx, y0 + 0.08, 0.06, y1 - y0 - 0.16, 0.1, 'bronze');
      const len = Math.hypot(rx - lx, y1 - y0 - 0.16), ang = Math.atan2(y1 - y0 - 0.16, rx - lx);
      put(b, f, new T.BoxGeometry(len, 0.06, 0.1).rotateZ(k % 2 ? -ang : ang).translate(0, 0, 0.05), c, (y0 + y1) / 2, 0, 'bronze');
    }
  }
  {
    const w = wall(35), f = frameOf(w);
    officeWindows(f, [1.6, 4.05, 6.5, 8.95, 11.4, 13.85, 16.3, 18.75]);
    slab(b, f, w.length / 2, 7.15, w.length + 0.04, 0.3, 0.08, 'greyBrick');
  }
  // Inferred office walls: the same rhythm, both floors where the wall reaches the ground, upper floor over the link.
  for (const i of [21, 23, 45, 48]) {
    const w = wall(i), f = frameOf(w), ts: number[] = [];
    for (let t = 1.6; t < w.length - 1.0; t += 2.45) ts.push(+t.toFixed(2));
    officeWindows(f, ts, [], w.base < 1);
    slab(b, f, w.length / 2, 7.15, w.length + 0.04, 0.3, 0.08, 'greyBrick');
  }

  // ---- Hall rooflights (orthophoto 2025): 1.85 x 4.1 m domes along the hall axis ----
  {
    const ax = wall(5).tangent, ang = Math.atan2(ax[0], ax[1]);
    const at: [number, number][] = [[38, -26.1], [42.6, -23.7], [35.9, -21.5], [40.5, -19.2], [33.5, -17], [38.1, -14.7],
      [6.5, 19.8], [12.1, 22.6], [4.3, 24.3], [17.7, 25.5], [9.8, 27.1], [2, 28.8], [15.5, 29.9], [7.6, 31.6], [13.2, 34.4]];
    for (const [x, z] of at) b.box(x, 5.45, z, 1.85, 0.45, 4.1, 'frame', ang);
  }
  setSink(sink0);
}
