/** Look-pass components on Bilderdijkstraat (integrator review 2026-10-09): round-arched top storeys under a
 * wide parapet (081118, 087959), two-colour banding (079721), framed shopfronts with sign bands. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {compileBuilding, resolveIntent} from './compile.ts';
import type {BuildingFacts} from './facts.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const build = (id: string) => compileBuilding(resolveIntent(raw(id), raw), facts(id));
const names = (g: T.Object3D) => { const out: string[] = []; g.traverse(o => { if (o instanceof T.Mesh) out.push(o.name); }); return out; };

for (const id of ['bilder-081118', 'bilder-087959']) test(`${id}: round-arched top storey under a wide rounded parapet`, () => {
  const b = build(id), e = b.recipe.elevations[0], top = b.fit.fronts[0].storeyHeightsM.length - 1;
  const arched = e.openings.value.filter(o => o.id.startsWith(`s${top}-`) && o.head === 'segmental');
  assert.ok(arched.length >= 2, 'top-storey windows have heads');
  for (const o of arched) assert.ok(Math.abs(o.headRiseM! - o.widthM / 2) < 0.01, 'semicircular head');
  const xs = e.crown!.value.profile.filter(p => p[1] > b.fit.fronts[0].eavesM + 0.05).map(p => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > b.fit.fronts[0].widthM * 0.85, 'parapet spans the front');
  assert.ok(names(b.group).some(n => n.startsWith('ornament/arch-')), 'relieving arches');
});

test('bilder-079721: lintel bands are stripes of the band brick, not stone', () => {
  const b = build('bilder-079721');
  const stripes = b.recipe.elevations[0].bands!.value.filter(d => d.id.startsWith('lintel-'));
  assert.ok(stripes.length >= 3 && stripes.every(d => d.surface === 'accent'));
  assert.equal(b.recipe.palette.value.accent, '#8c3b2c');
});

test('shopfronts: piers, stall riser, framed glazing and a fascia with a lettering panel, in the shop paint', () => {
  const b = build('bilder-087959'), e = b.recipe.elevations[0], n = names(b.group);
  for (const id of ['shop-riser', 'fascia', 'fascia-lettering']) assert.ok(e.bands!.value.some(d => d.id === id), id);
  assert.ok(e.blocks!.value.filter(d => d.surface === 'shop').length === 2, 'two piers');
  const glass = e.openings.value.filter(o => o.id.startsWith('shop-'));
  assert.ok(glass.length && glass.every(o => o.frameSurface === 'shop'));
  assert.equal(b.recipe.palette.value.shop, '#1f2121');
  assert.ok(n.some(x => x.includes('shop-0/frame')));
});
