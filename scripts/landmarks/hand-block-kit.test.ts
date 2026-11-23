import assert from 'node:assert/strict';
import test from 'node:test';
import {risesAtBothEnds} from './hand-block-kit';

test('a stepped wall rises at both ends; a 3DBAG triangle rising from one end does not', () => {
  // Valkenburgerstraat-style step: flat foot 0..10 m, tops at 6 m (left) and 9 m (right)
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [10, 9], [0, 6]], 0, 10, 0), true);
  // a sloped top over a flat foot, both ends vertical
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [10, 20.5], [0, 6.1]], 0, 10, 0), true);
  // Westerdok 4 wall 163: foot 9.931 / 9.954 m, apex 20.776 m over the right end only
  assert.equal(risesAtBothEnds([[31.53, 9.931], [31.53, 20.776], [0, 9.954]], 0, 31.53, 9.931), false);
  // a top vertex 4 cm in from the end still counts as that end
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [9.96, 8], [0.04, 8]], 0, 10, 0), true);
});

// ---- zoned walls (lane hand-blocks-d-20261123) ----------------------------------------------------------------------
import type {BuildingTools} from './cultural-builders';
import {buildHandBlock, type BlockOpts, type Src} from './hand-block-kit';

/** One 12 m x 8 m box on the shell: four rectangular walls, a flat roof. */
function boxSrc(): Src {
  const [x0, x1, z0, z1, h] = [0, 12, 0, 6, 8];
  const wall = (a: number[], b: number[]) => ({type: 'WallSurface', rings: [[[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]]]});
  return {nativeRing: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], surfaces: [
    wall([x0, z0], [x1, z0]), wall([x1, z0], [x1, z1]), wall([x1, z1], [x0, z1]), wall([x0, z1], [x0, z0]),
    {type: 'RoofSurface', rings: [[[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]]]},
  ]} as unknown as Src;
}
/** Records every add as colour + rounded positions, so two runs compare exactly. */
function recorder() {
  const log: string[] = [], perColour = new Map<string, number>();
  const b = new Proxy({}, {get: (_t, k) => (g: {getAttribute?: (n: string) => {array: ArrayLike<number>}}, c: string, ...rest: number[]) => {
    const pos = g?.getAttribute?.('position')?.array;
    log.push(`${String(k)}:${c}:${pos ? Array.from(pos, v => v.toFixed(4)).join(',') : ''}:${rest.join(',')}`);
    if (pos) perColour.set(c, (perColour.get(c) ?? 0) + pos.length / 3);
  }}) as unknown as BuildingTools;
  return {b, log, perColour};
}
const base = (): BlockOpts => ({src: boxSrc(), fronts: [], wall: 'brick', roof: 'slate', ledge: 'concrete', setbackAbove: 99, gridDefaults: {edge: 0.06}});

test('zoned absent and zoned returning null draw the same inferred grid', () => {
  const a = recorder(), n = recorder();
  buildHandBlock(a.b, base());
  buildHandBlock(n.b, {...base(), zoned: () => null});
  assert.ok(a.log.length > 10);
  assert.deepEqual(n.log, a.log);
});

test('a zone draws its bands and spaces each row evenly along every wall', () => {
  const r = recorder(), seen: number[] = [];
  buildHandBlock(r.b, {...base(), zoned: w => {
    seen.push(+w.len.toFixed(2));
    return {bands: [[0.5, 'greyBrick'], [0.9, 'red'], [99, 'brick']], rows: [{y: [1.5, 3.5], pitch: 3, w: 1.2}]};
  }});
  assert.deepEqual(seen.sort((p, q) => p - q), [6, 6, 12, 12]);
  assert.ok((r.perColour.get('red') ?? 0) > 0, 'the red band is drawn');
  assert.ok((r.perColour.get('greyBrick') ?? 0) > 0, 'the plinth band is drawn');
  // no rows: no glass; with rows: glass in the openings
  const bare = recorder();
  buildHandBlock(bare.b, {...base(), zoned: () => ({bands: [[99, 'brick']], rows: []})});
  assert.equal(bare.perColour.get('glass') ?? 0, 0);
  assert.ok((r.perColour.get('glass') ?? 0) > 0);
});
