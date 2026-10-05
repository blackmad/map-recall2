import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bayLookFor, BAY_LAYER_COUNT } from './bayLook.js';
import { recipeBayOpenings } from './facadeOpenings.js';
import { bayDoorGeometry, bayDoorWindowGeometry } from './bayTextures.js';
import { ExtraSink, wallExtras, type ExtraContext } from './facadeExtras.js';
import { raisedPilasterEntrance, doorSpan } from './facadeOrnaments.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';

const recipe: ArchitecturalRecipe = { family: 'masonry', period: 'c19', confidence: .8, entranceAssembly: 'raised-pilaster',
  frameHex: '#e6e1d4', frameColor: 'dark', paleAccents: true, sash: 'transom', lintel: 'arch', trimDensity: 'restrained',
  trim: { frames: .8, lintels: .7, cornice: .7, courses: .6, quoins: .65, arches: .25 } };
const context = (): ExtraContext => ({ id: 'raised-entry', style: 'c19', period: 'c19', wallKey: 'street',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 5.2 }, base: 0, top: 14,
  layout: { bays: 1, bayWidthM: 5.2, groundM: 3.4, storeys: 3, storeyM: 3.1, doorBays: [0] },
  wallHex: '#a46c56', accentHex: '#374236', groundLevel: true, streetSide: true, recipe,
  openings: recipeBayOpenings('raised-entry', recipe) });

test('source-supported raised entrance shares painted leaf, threshold and paired ground glazing', () => {
  for (const look of ['photo','storybook','cartoon'] as const) {
    const choice = bayLookFor('raised-entry', 1890, 14, look, undefined, recipe);
    assert.equal(choice.variant.entranceAssembly, 'raised-pilaster');
    const openings = recipeBayOpenings('raised-entry', recipe, look);
    const leaf = bayDoorGeometry({ ...choice.variant, kind: 'groundDoor' }), flank = bayDoorWindowGeometry({ ...choice.variant, kind: 'groundDoor' }, look);
    assert.equal(openings.door.bottom, leaf.bottom / 340);
    assert.equal(openings.door.axis, (leaf.x + leaf.width / 2) / 520);
    assert.equal(openings.doorWindow!.axes.length, 2);
    assert.ok(openings.doorWindow!.sill > openings.door.bottom + .10, 'raised residential sills stand above the landing');
    assert.deepEqual(openings.upper.axes, [.205,.53,.80], 'upper groups share entrance and paired ground axes');
    assert.equal(openings.doorWindow!.width, flank.width / 520);
    assert.ok(openings.door.bottom > .12 && openings.door.bottom < .25);
    assert.ok(openings.door.axis + openings.door.width / 2 < openings.doorWindow!.axes[0] - openings.doorWindow!.width / 2);
    const noAssembly = bayLookFor('raised-entry', 1890, 14, look, 'quiet', { ...recipe, entranceAssembly: undefined });
    assert.equal(noAssembly.variant.entranceAssembly, undefined, 'historic eligibility alone never invents this portal');
  }
  assert.ok(BAY_LAYER_COUNT + 64 <= 256, 'new bounded atlas fits procedural byte layers');
});

test('raised portal completes stairs, joined pale jambs, open pediment and floor course atomically', () => {
  const c = context(), sink = new ExtraSink(230), d = doorSpan(c)!;
  raisedPilasterEntrance(c, sink);
  assert.ok(sink.tris.length > 0 && sink.tris.length <= 90);
  const vertices = sink.tris.flatMap(t => t.p);
  assert.ok(vertices.some(p => Math.abs(p[2] - d.z0) < 1e-8 && -p[1] >= .3), 'stair landing reaches actual raised threshold');
  assert.ok(vertices.some(p => p[2] > d.z1 + .2 && p[0] === d.x), 'pediment peak is above the painted transom');
  assert.ok(vertices.some(p => p[0] === 0 && p[2] >= c.layout.groundM - .12), 'joined course spans the frontage');
  for (const p of vertices) assert.ok(p.every(Number.isFinite) && p[0] >= 0 && p[0] <= c.f.len && p[2] >= c.base && p[2] <= c.top);
  for (const altered of [{ shopfront: true }, { groundLevel: false }]) {
    const omitted = new ExtraSink(230); raisedPilasterEntrance({ ...c, ...altered }, omitted);
    assert.equal(omitted.tris.length, 0, 'preserve shops and upper-level parts');
  }
  const tiny = new ExtraSink(20); raisedPilasterEntrance(c, tiny);
  assert.equal(tiny.tris.length, 0, 'tight budgets never leave floating fragments');
  const full = new ExtraSink(230), used = wallExtras(c, full);
  assert.equal(used[0], 'raised-pilaster-entrance', 'defining assembly precedes probabilistic window dressing');
  assert.ok(!used.includes('door-surround') && !used.includes('stoop') && !used.includes('string-courses'));
  assert.ok(full.tris.length <= 180);
});
