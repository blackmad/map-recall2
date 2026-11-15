import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, ringFrame, slab, setSink, getSink} from './nearbar-kit';
import {basin, offsetRing, post, prismRing, ringBand, tubePath, type XZ} from './pool-kit';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew';
import source from './noorderparkbad-footprints.json';

/**
 * NOORDERPARKBAD, Noorderpark (BAG pand 0363100012241531, bouwjaar 2015): the rounded indoor bath with its outdoor basins
 * south of it. Sources: BAG ring + 3DBAG LoD2.2 shell (CC0 / CC BY 4.0) via pool-site-prepare.ts; Gemeente Amsterdam
 * panoramas (CC BY 4.0) for the fronts; PDOK luchtfoto 2025 (Beeldmateriaal Nederland, CC BY 4.0) and OSM leisure=swimming_pool
 * a1009154122..130 (ODbL) for the basins. Per item in noorderparkbad-inventory.json.
 *  - Walls of pale and grey striped brick (w05-251, w08-358, w10-40), a deep grey eave band over the ground storey and a white
 *    edge on the set-back upper storey (the 3DBAG shell carries the set-back).
 *  - The signature: NOORDERPARKBAD laid in red brick into the striped ground storey along the north wall (w08-358, 2024 second
 *    view shows "ARKBA"), letters about 2.2 m tall, following the curve.
 *  - Entrance (w09-59): a glazed front between brick piers patterned with a red N and a red diamond lattice.
 *  - West service front (w05-251): four dark doors; east end (w10-40): a second diamond-lattice panel.
 *  - Outdoor: lap basin with six lanes, the teaching basin, two small paddling basins and the slide basin with its covered
 *    chute, each on its paved deck.
 */
type Src = {anchorRD: number[]; nativeRing: number[][]; surfaces: Surface[]; basins: {osm: string; ring: number[][]}[]};
export function buildNoorderparkbad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;
  addShell(b, src as never, {wall: 'greyBrick', roof: 'slate'});
  // deep grey eave band over the ground storey, standing 1.0 m proud of the wall
  ringBand(b, offsetRing(ring, 0.45), 1.1, 3.7, 4.5, 'concrete');

  const native = (lng: number, lat: number): XZ => { const p = lngLatToRd([lng, lat]); return [p.x - src.anchorRD[0], src.anchorRD[1] - p.y]; };
  const sink0 = getSink();
  setSink(0.03);
  // NOORDERPARKBAD in red brick, centred on the photographed north wall (w08-358)
  alongRing(b, ring, native(4.917929, 52.3982205), [...'NOORDERPARKBAD'].map(ch => ({ch, w: 6 * 0.31})), (f, t, ch) => letters(b, f, ch, t, 0.5, 0.02, 0.31, 0.04, 'red'));
  // entrance (w09-59): glass between two patterned piers
  const e = native(4.918796, 52.398247);
  alongRing(b, ring, e, Array.from({length: 9}, () => ({ch: '', w: 1.8})), (f, t) => slab(b, f, t, 0.1, 1.7, 3.5, 0.12, 'glass', 0.02));
  alongRing(b, ring, e, [{ch: 'N', w: 5.4}, {ch: 'X', w: 5.4}], (f, t, ch) => {
    slab(b, f, t, 0, 2.6, 3.6, 0.3, ch === 'N' ? 'white' : 'red', 0.02);
    letters(b, f, ch, t, 0.3, 0.32, 0.43, 0.04, ch === 'N' ? 'red' : 'white');
  });
  // west service front (w05-251): four dark doors between the brick piers
  alongRing(b, ring, native(4.9178565, 52.3978245), Array.from({length: 4}, () => ({ch: '', w: 3.0})), (f, t) => slab(b, f, t, 0.05, 2.2, 3.0, 0.1, 'dark', 0.02));
  // east end (w10-40): the second diamond-lattice panel, 3.5 m right of the wall centre
  alongRing(b, ring, native(4.9189925, 52.398108), [{ch: '', w: 4.4}, {ch: 'X', w: 2.6}], (f, t, ch) => {
    if (!ch) return;
    slab(b, f, t, 0, 2.5, 3.4, 0.3, 'red', 0.02);
    letters(b, f, ch, t, 0.3, 0.32, 0.4, 0.04, 'white');
  });
  setSink(sink0);

  // ---- outdoor basins on their decks ----
  const B = (id: string) => src.basins.find(x => x.osm === id)!.ring;
  prismRing(b, hull([...offsetRing(B('a1009154122'), 3.5), ...offsetRing(B('a1009154126'), 3.5)]), 0, 0.1, 'concrete');
  basin(b, B('a1009154122'), {lanes: 6, laneColour: 'blue'});
  basin(b, B('a1009154126'), {});
  prismRing(b, hull([...offsetRing(B('a1009154128'), 4), ...offsetRing(B('a1009154130'), 4)]), 0, 0.1, 'concrete');
  basin(b, B('a1009154128'), {});
  basin(b, B('a1009154130'), {});
  basin(b, B('a1009154124'), {deck: 2.5});
  // the covered chute running south-east out of the slide basin (orthophoto: x 10..15, z 86..99), on posts
  tubePath(b, [[12.3, 3.6, 99], [10.5, 2.4, 93], [8.2, 1.0, 87.5], [6.8, 0.5, 85]], 0.7, 'slate');
  for (const [x, z, h] of [[12.3, 99, 3.0], [11.1, 95, 2.4], [9.6, 90.5, 1.4]] as [number, number, number][]) post(b, [x, z], 0, h, 0.12, 'white');
}

/**
 * Lay items (each `w` metres wide) along the ring's outside, reading left to right from outside, centred on the ring point
 * nearest `c`; calls `put` with the frame of the edge under each item's centre.
 */
function alongRing(b: BuildingTools, ring: number[][], c: XZ, items: {ch: string; w: number}[], put: (f: ReturnType<typeof ringFrame>['f'], t: number, ch: string) => void) {
  void b;
  const flipped = ringFrame(ring, 0).f.origin[0] !== ring[0][0] || ringFrame(ring, 0).f.origin[1] !== ring[0][1];
  const ord = flipped ? [...ring].reverse() : ring;
  const S: number[] = [0];
  for (let i = 0; i < ord.length; i++) { const a = ord[i], q = ord[(i + 1) % ord.length]; S.push(S[i] + Math.hypot(q[0] - a[0], q[1] - a[1])); }
  const P = S[ord.length];
  let k0 = 0, best = Infinity;
  ord.forEach((p, i) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < best) { best = d; k0 = i; } });
  const total = items.reduce((s, it) => s + it.w, 0);
  let s = S[k0] - total / 2;
  for (const it of items) {
    const m = (((s + it.w / 2) % P) + P) % P;
    let j = 0; while (j < ord.length - 1 && S[j + 1] <= m) j++;
    put(ringFrame(ord, j).f, m - S[j], it.ch);
    s += it.w;
  }
}
/** Convex hull (monotone chain) of native points. */
function hull(pts: XZ[]): XZ[] {
  const p = [...pts].sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const cross = (o: XZ, a: XZ, c: XZ) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const lo: XZ[] = [], up: XZ[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo.at(-2)!, lo.at(-1)!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up.at(-2)!, up.at(-1)!, q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
