// Painted house numbers on a blank base (lane houthavens-memel-wiborg-20261120): `signage.up` sizes wall lettering to a
// band of the panel's height (Danzigerbocht 45's two-metre yellow 45), instead of one strip between storeys.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';

const DIR = 'scripts/building-recipes/houses/houthavens-249737';
const raw = (): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${DIR}/facts.json`, 'utf8'));
// the sign under test is the only one on the building (walls[0], the panel with the 45)
const withSign = (sign: Record<string, unknown>) => { const i = raw(); i.walls = i.walls.map((w, k) => { const {signage: _, ...rest} = w; return k === 0 ? {...rest, signage: sign as never} : rest; }); return i; };

test('signage.up: validated, only with along, 0.05..0.6 of the height', () => {
  assert.doesNotThrow(() => validateLargeIntent(withSign({text: '45', colour: '#c8a830', mount: 'wall', along: [0.1, 0.5], up: [0.5, 0.75]})));
  assert.throws(() => validateLargeIntent(withSign({text: '45', mount: 'wall', up: [0.5, 0.75]})), /signage.up: only with along/);
  assert.throws(() => validateLargeIntent(withSign({text: '45', mount: 'wall', along: [0.1, 0.5], up: [0.1, 0.95]})), /signage.up/);
});

const signHeight = (g: T.Object3D) => {
  const box = new T.Box3(); g.updateMatrixWorld(true);
  g.traverse(o => { const m = o as T.Mesh; if (m.isMesh && /sign/.test(m.name)) box.expandByObject(m); });
  return box.isEmpty() ? 0 : box.max.y - box.min.y;
};

test('signage.up: the number fills that band of the base, taller than the storey-strip lettering', () => {
  const opts = {budget: 1e9} as never;
  const up = compileLargeBuilding(validateLargeIntent(withSign({text: '45', colour: '#c8a830', mount: 'wall', along: [0.02, 0.98], up: [0.5, 0.75]})), facts(), opts);
  const strip = compileLargeBuilding(validateLargeIntent(withSign({text: '45', colour: '#c8a830', mount: 'wall', along: [0.02, 0.98]})), facts(), opts);
  const hu = signHeight(up.group), hs = signHeight(strip.group);
  assert.ok(hs > 0 && hu > 1.5 && hu > hs * 1.5, `up ${hu.toFixed(2)} m vs strip ${hs.toFixed(2)} m`);
});
