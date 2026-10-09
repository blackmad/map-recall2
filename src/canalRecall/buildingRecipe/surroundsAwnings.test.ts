/** Stone surrounds, quoins and awnings (2026-10-09). Evidence: bilder 153622/153782/152669 front.jpg keystones;
 * 156287 front-alt.jpg stone lintels and a black straight awning over the left shop. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {compileBuilding, resolveIntent} from './compile.ts';
import {validateIntent} from './intent.ts';
import type {BuildingFacts} from './facts.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const withFront = (patch: Record<string, unknown>) => { const i = raw('bilder-153622'); Object.assign(i.fronts[0], patch); return i; };
const tris = (g: T.Object3D) => { let n = 0; g.traverse(o => { if (o instanceof T.Mesh) n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return n; };

test('intent schema: surround, quoin and awning fields validate and reject junk', () => {
  validateIntent(withFront({windowSurround: 'full-frame', quoins: 'stone', surroundStoreys: [1, 2]}));
  validateIntent(withFront({shopfront: {colour: 'dark-blue', fascia: true, awning: {style: 'fabric-dutch', colour: 'dark-green', extent: {from: 0, to: 0.5}}}}));
  assert.throws(() => validateIntent(withFront({windowSurround: 'gold'})), /windowSurround/);
  assert.throws(() => validateIntent(withFront({quoins: 'brick'})), /quoins/);
  assert.throws(() => validateIntent(withFront({shopfront: {colour: 'dark-blue', fascia: true, awning: {style: 'fabric-straight', colour: 'puce'}}})), /colour/);
  assert.throws(() => validateIntent(withFront({shopfront: {colour: 'dark-blue', fascia: true, awning: {style: 'fabric-straight', colour: 'black', extent: {from: 0.9, to: 0.95}}}})), /extent/);
  assert.throws(() => validateIntent(withFront({awning: {style: 'fabric-straight', colour: 'black'}})), /shopfront\.awning/);
});

test('surrounds, quoins and awnings are deterministic and sit on the wall plane', () => {
  const i = withFront({windowSurround: 'full-frame', quoins: 'stone', shopfront: {colour: 'dark-blue', fascia: true, awning: {style: 'fabric-dutch', colour: 'dark-green', extent: {from: 0, to: 0.5}}}});
  const f = facts('bilder-153622'), a = compileBuilding(resolveIntent(i, raw), f), b = compileBuilding(resolveIntent(i, raw), f);
  const d = a.recipe.elevations[0].dressings!.value;
  assert.ok(d.some(x => x.id.startsWith('lintel-')) && d.some(x => x.id.startsWith('jamb-l-')) && d.some(x => x.id.startsWith('quoin-l')) && d.some(x => x.kind === 'awning'));
  assert.deepEqual(d, b.recipe.elevations[0].dressings!.value);
  a.group.updateMatrixWorld(true);
  const dress: T.Mesh[] = [];
  a.group.traverse(o => { if (o instanceof T.Mesh && o.name.startsWith('dressing/')) dress.push(o); });
  assert.ok(dress.length >= d.length);
  // Back face of every dressing in facade-local z: within 1 cm of the wall plane (the <= 5 cm attachment budget).
  for (const m of dress) {
    m.geometry.computeBoundingBox(); const box = m.geometry.boundingBox!;
    assert.ok(Math.abs(box.min.z) <= 0.011, `${m.name} back face ${box.min.z}`);
  }
  assert.ok(tris(a.group) < 3000);
});

test('bilder-156287: awning has its own palette colour and the house stays under budget', () => {
  const b = compileBuilding(resolveIntent(raw('bilder-156287'), raw), facts('bilder-156287'));
  const aw = b.recipe.elevations[0].dressings!.value.find(x => x.kind === 'awning')!;
  assert.equal(aw.surface, 'awning');
  assert.equal(b.recipe.palette.value.awning, '#1f2121');
  assert.ok(tris(b.group) < 3000);
});
