import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, ringFrame, segBand, setSink, slab} from './nearbar-kit';
import {pointedGable, reshapeShell, type FrontClamp} from './shell-gable-fit';
import source from './school-marnixstraat-2-footprints.json';

/**
 * SCHOOL, Marnixstraat 2 (BAG pand 0363100012168723, 1883; rijksmonument 518500): a two-storey banded-brick school on
 * the Haarlemmerplein corner, its walled playground on the north-west. Massing: the 3DBAG LoD2.2 shell
 * (school-marnixstraat-2-footprints.json, bag-shell-prepare.ts). The playground wall and its gate pavilion stand outside the
 * pand (the BAG footprint is the school body only: the rectified w03/w04 crops put the school front on the footprint edge
 * with the wall several metres in front), so they are not drawn here.
 * Drawn from rectified Gemeente Amsterdam panoramas (CC BY 4.0; 50 px/m crops of the brief), per item in
 * school-marnixstraat-2-inventory.json:
 *  - dark purple-brown brick with a red course at the first-floor line and a stone plinth;
 *  - ground-floor windows under red segment heads; first-floor windows under round arches with patterned ochre tympana;
 *  - a patterned ochre frieze with white consoles under a white cornice;
 *  - pointed topgevels with an oculus, stone copings, foot pinnacles and a finial on every pavilion face (w02, w03, w04, w05,
 *    w06, w07). The 3DBAG draws them as lopsided half-gables or a 18.7 m corner peak; those faces are clamped to the eaves
 *    line (shell-gable-fit reshapeShell) and the symmetric gable is drawn in front.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
type C = Parameters<BuildingTools['add']>[1];
const c = (s: string) => s as unknown as C;

type Win = {t: number; w?: number};
type Edge = {e: number; eaves: number; up: Win[]; low: Win[]; plain?: boolean; door?: number; gable?: {axis: number; half: number; apex: number}; clamp?: [number, number]};

/** Facade layout per ring edge (t from the viewer's left; photo positions read off the crops at 50 px/m). */
const EDGES: Edge[] = [
  // w02-112, Marnixstraat front, 19.2 m: six bays on a 2.33 m pitch, the north pavilion with its gable
  {e: 13, eaves: 11.6, up: [2.45, 4.8, 7.1, 9.4, 11.7, 14.1, 17.6].map(t => ({t})), low: [2.45, 4.8, 7.1, 9.4, 11.7, 14.1, 17.6].map(t => ({t})), gable: {axis: 17.6, half: 1.5, apex: 15.5}},
  // w05-22, the north pavilion's front, 9.5 m
  {e: 0, eaves: 11.2, up: [1.9, 4.0, 7.3].map(t => ({t})), low: [1.9, 4.0, 7.3].map(t => ({t})), gable: {axis: 4.0, half: 1.5, apex: 15.0}, clamp: [2.2, 5.8]},
  // w04-292, playground side, 15.9 m: the pavilion gable at the north end
  {e: 1, eaves: 11.6, up: [1.6, 6.6, 10.1, 13.9].map(t => ({t})), low: [1.6, 6.6, 10.1, 13.9].map(t => ({t})), gable: {axis: 1.6, half: 1.5, apex: 15.5}},
  // w03-21, playground side, 18.7 m: louvred pair at the east end, five bays, the corner pavilion gable at the west end
  {e: 2, eaves: 11.6, up: [{t: 1.6, w: 1.2}, ...[4.7, 7.0, 9.3, 11.6, 13.8, 17.1].map(t => ({t}))], low: [1.6, 4.7, 7.0, 9.3, 11.6, 13.8, 17.1].map(t => ({t})), gable: {axis: 17.1, half: 1.35, apex: 16.0}, clamp: [14.5, 18.7]},
  // w07-292, the corner pavilion's west face, 4.9 m
  {e: 5, eaves: 11.6, up: [{t: 2.45}], low: [{t: 2.45}], gable: {axis: 2.45, half: 2.2, apex: 16.0}, clamp: [0, 4.9]},
  // south face of the corner pavilion, 5.6 m (not photographed square-on: two bays as on the other faces)
  {e: 8, eaves: 11.0, up: [1.5, 4.1].map(t => ({t})), low: [1.5, 4.1].map(t => ({t}))},
  // w01-201, the back over the yard, 23.6 m (largely hidden by a fence and trees): plain windows under the low eaves
  {e: 10, eaves: 10.45, plain: true, up: Array.from({length: 9}, (_, i) => ({t: 1.4 + i * 2.33})), low: Array.from({length: 9}, (_, i) => ({t: 1.4 + i * 2.33}))},
  // w06-112, the south pavilion's gable face, 5.9 m: wide centre window over the door, narrow side windows
  {e: 11, eaves: 11.7, up: [{t: 1.45, w: 0.7}, {t: 2.95, w: 1.5}, {t: 4.6, w: 0.7}], low: [{t: 1.45, w: 0.7}, {t: 4.6, w: 0.7}], door: 2.95, gable: {axis: 2.95, half: 2.6, apex: 15.0}},
];

export function buildSchoolMarnixstraat2(_w: number, _d: number, b: BuildingTools) {
  const raw = source as unknown as Src;
  const ring = raw.facadeRing;
  const fronts: FrontClamp[] = EDGES.filter(E => E.clamp).map(E => ({frame: ringFrame(ring, E.e).f, t0: E.clamp![0], t1: E.clamp![1], front: 0.6, eaves: E.eaves, reach: 8}));
  const surfaces = reshapeShell(raw.surfaces, {fronts});
  addShell(b, {...raw, surfaces} as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);

  for (const E of EDGES) {
    const {f, len} = ringFrame(ring, E.e);
    // plinth, red course at the first-floor line, stone sill band
    slab(b, f, len / 2, 0, len - 0.1, 0.8, 0.06, 'stone');
    slab(b, f, len / 2, 5.45, len - 0.1, 0.25, 0.06, 'red');
    slab(b, f, len / 2, 6.0, len - 0.1, 0.12, 0.1, 'stone');
    // ground floor: windows (or the door) under red segment heads
    for (const {t, w = 1.4} of E.low) {
      slab(b, f, t, 1.45, w + 0.12, 3.6, 0.08, 'frame');
      slab(b, f, t, 1.5, w, 3.5, 0.12, 'glass');
      slab(b, f, t, 1.5, 0.06, 3.5, 0.16, 'frame');
      slab(b, f, t, 3.9, w, 0.07, 0.16, 'frame');
      segBand(b, f, t, 5.3, w + 0.3, 0.18, 0.24, 0.12, 'red');
    }
    if (E.door !== undefined) {
      slab(b, f, E.door, 0.0, 1.2, 4.95, 0.1, 'frame');
      slab(b, f, E.door, 0.05, 1.05, 2.55, 0.14, 'dark');
      slab(b, f, E.door, 2.7, 1.05, 2.2, 0.14, 'glass');
      segBand(b, f, E.door, 5.3, 1.5, 0.18, 0.24, 0.12, 'red');
    }
    // first floor: windows; round arches with patterned tympana where the eaves allow
    for (const {t, w = 1.4} of E.up) {
      const top = E.plain ? 9.3 : 9.65;
      slab(b, f, t, 6.15, w + 0.12, top - 6.15, 0.08, 'frame');
      slab(b, f, t, 6.2, w, top - 6.25, 0.12, 'glass');
      slab(b, f, t, 6.2, 0.06, top - 6.25, 0.16, 'frame');
      slab(b, f, t, 8.4, w, 0.07, 0.16, 'frame');
      if (E.plain) segBand(b, f, t, top + 0.25, w + 0.3, 0.15, 0.22, 0.12, 'red');
      else {
        archSlab(b, f, t, top - 0.02, w + 0.1, (w + 0.1) / 2 + 0.06, 0.05, 'ochre');
        archBand(b, f, t, top - 0.05, w + 0.5, (w + 0.5) / 2 + 0.08, 0.2, 0.1, 'red');
      }
    }
    // frieze, white consoles and cornice under the eaves (the gable feet stand in the cornice)
    if (!E.plain) {
      slab(b, f, len / 2, E.eaves - 0.85, len - 0.1, 0.5, 0.06, 'ochre');
      for (let t = 0.6; t <= len - 0.5; t += 1.17) slab(b, f, t, E.eaves - 0.9, 0.18, 0.6, 0.18, 'sandstone');
    }
    slab(b, f, len / 2, E.eaves - 0.35, len - 0.2, 0.38, 0.3, 'sandstone');
  }

  // the pointed topgevels: brick wall, stone copings, foot pinnacles, finial, and an oculus (w02, w06)
  for (const E of EDGES) {
    if (!E.gable) continue;
    const {f} = ringFrame(ring, E.e);
    const g = E.gable;
    pointedGable(b, f, {axis: g.axis, half: g.half, footY: E.eaves - 0.1, apexY: g.apex}, {wall: c('brick'), coping: c('sandstone'), thick: 0.45, out: 0.05});
    const oy = E.eaves + (g.apex - E.eaves) * 0.33;
    disc(b, f, g.axis, oy, 0.42, 0.09, 'sandstone', 0.03);
    disc(b, f, g.axis, oy, 0.28, 0.16, 'glass', 0);
  }
  setSink(sink0);
}
