import type {BuildingTools} from './cultural-builders';
import {setSink} from './nearbar-kit';
import {rawWall} from './big-kit';
import {ribbon, beginFacade, addShellTess, windowGrid, centredColumns, quad} from './big-facade';
import raw from './bercylaan-801-855-footprints.json';

/**
 * BOLD, Bercylaan 801-855 (BAG pand 0363100012250610, Overhoeks; BAG 2021, 27 bouwlagen, 359 woonfunctie units of about 21 m2 median plus a
 * shop, two sports and five other units; no pand name in BAG). The street lettering reads "BOLD Bercylaan 809 t/m 1215"; the press article
 * on stedenbouw.nl (2022-05-09) names the architect OZ (Chris Zwiers), 24 storeys and almost 80 m, 143 apartments plus 203 student
 * apartments. A 79 m tower at the south-east end with a curved nose stands on a 27 m shoulder and an 8 m low block to the north-west.
 * It is an ordinary large residential building (category ordinary, no POI card).
 * Rhythm read from the 2025-06-30 municipal panoramas (artifacts/landmark-lanes/bercylaan-801-855/ref-*.jpg):
 *  - graphite ceramic-panel facade with a regular grid of paired-sash windows (about 1.6 m wide, 1.9 m high, on a 3 m storey pitch and about
 *    2.7 m column pitch), set in panel frames; ground floor a double-height glazed front in dark piers under a louvre band, entrances B etc.;
 *  - the 8 m block on the north-west is grey metal panels with a few tall windows and roller doors.
 * INFERRED: every wall above 12 m: panoramas reach about 20 m, so upper floors repeat the photographed grid; the north-east long wall.
 * Not modelled: the solar-panel pattern, wooden balconies, the yellow soffit of the shoulder, signage.
 */
const source = {...raw, surfaces: raw.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(p => [p[0], Math.max(0, p[1]), p[2]]))}))};
const surfaces = source.surfaces as {type: string; rings: number[][][]}[];

export function buildBercylaan801855(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShellTess(b, source as never, {wall: 'slate', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(source as never);
  setSink(0.3);
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 3) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 3) return;
    const low = w.top < 10;
    if (w.base < 0.5) {
      // double-height glazed ground floor in dark piers, louvre band above it
      const gh = Math.min(w.top - 1.2, 4.6);
      for (let t = 0.6; t + 3.4 <= w.len - 0.4; t += 6.4) ribbon(b, w, t, Math.min(t + 5.4, w.len - 0.5), 0.5, gh, {ring: 0.06, frame: 'dark', glass: 'glass'});
      if (!low && w.top > 8) {
        for (let t = 0.6; t + 3.4 <= w.len - 0.4; t += 6.4) ribbon(b, w, t, Math.min(t + 5.4, w.len - 0.5), 0.5 + gh + 0.35, 0.9, {ring: 0.03, frame: 'dark', glass: 'dark'});
      }
    }
    if (low || w.top < 12) return;
    const c = centredColumns(w.len, 2.7, 1.3);
    const sills: number[] = [];
    for (let y = 7.4; y + 2.0 <= w.top - 0.6; y += 3.0) sills.push(+y.toFixed(2));
    windowGrid(b, w, {t0: c.t0, pitch: c.pitch, n: c.n, w: 1.6, h: 1.9, sills, frame: 'dark', glass: 'glass', ring: 0.08});
    void quad;
  });
  setSink(0);
}
