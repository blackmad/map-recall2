/** Look-pass components on Bilderdijkstraat (integrator review 2026-10-09): round-arched top storeys under a
 * wide parapet (081118), 087959's low pediment over a shared axis grid (photo proposal 2026-10-10), two-colour
 * banding (079721), framed shopfronts with sign bands. */
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

for (const id of ['bilder-081118']) test(`${id}: round-arched top storey under a wide rounded parapet`, () => {
  const b = build(id), e = b.recipe.elevations[0], top = b.fit.fronts[0].storeyHeightsM.length - 1;
  const arched = e.openings.value.filter(o => o.id.startsWith(`s${top}-`) && o.head === 'segmental');
  assert.ok(arched.length >= 2, 'top-storey windows have heads');
  for (const o of arched) assert.ok(Math.abs(o.headRiseM! - o.widthM / 2) < 0.01, 'semicircular head');
  const xs = e.crown!.value.profile.filter(p => p[1] > b.fit.fronts[0].eavesM + 0.05).map(p => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > b.fit.fronts[0].widthM * 0.85, 'parapet spans the front');
  assert.ok(names(b.group).some(n => n.startsWith('ornament/arch-')), 'relieving arches');
});

test('bilder-087959: low pediment over the middle, three arched top windows on axes 0, 1, 3 of the four-axis grid', () => {
  const b = build('bilder-087959'), e = b.recipe.elevations[0], f = b.fit.fronts[0], top = f.storeyHeightsM.length - 1;
  const arched = e.openings.value.filter(o => o.id.startsWith(`s${top}-`) && o.head === 'segmental');
  assert.equal(arched.length, 3);
  for (const o of arched) assert.ok(Math.abs(o.headRiseM! - o.widthM / 2) < 0.01, 'semicircular head');
  // Same axes as the storey below: the top storey skips axis 2 (the photo's gap), it does not re-space its three windows.
  const centres = (s: number) => e.openings.value.filter(o => new RegExp(`^s${s}-b\\d+$`).test(o.id)).map(o => o.leftM + o.widthM / 2).sort((a, c) => a - c);
  const below = centres(top - 1), above = centres(top);
  assert.equal(below.length, 4);
  for (const [k, axis] of [0, 1, 3].entries()) assert.ok(Math.abs(above[k] - below[axis]) < 0.02, `top window ${k} on axis ${axis}`);
  // Low pediment: one apex, about 0.4 m over the eaves, over the middle of the front only.
  const profile = e.crown!.value.profile, peak = Math.max(...profile.map(p => p[1]));
  assert.ok(peak - f.eavesM > 0.3 && peak - f.eavesM < 0.75, `cap rise ${peak - f.eavesM}`);
  const raised = profile.filter(p => p[1] > f.eavesM + 0.05).map(p => p[0]);
  assert.ok(Math.max(...raised) - Math.min(...raised) < f.widthM * 0.8, 'medium span, not a full-width parapet');
  // Thai Thara: recessed centre entrance, residential door at the right, lettering on the fascia.
  const shopDoor = e.openings.value.find(o => o.id === 'shop-door')!, res = e.openings.value.find(o => o.id === 'door')!;
  assert.ok(shopDoor.recessM! > 0.3);
  assert.ok(f.mirrored ? res.leftM < shopDoor.leftM : res.leftM > shopDoor.leftM, 'residential door on the viewer\'s right');
  assert.equal(f.signBand?.mount, 'fascia');
  assert.ok(names(b.group).includes('sign/lettering'));
});

test('bilder-079721: lintel bands are stripes of the band brick, not stone', () => {
  const b = build('bilder-079721');
  const stripes = b.recipe.elevations[0].bands!.value.filter(d => d.id.startsWith('lintel-'));
  assert.ok(stripes.length >= 3 && stripes.every(d => d.surface === 'accent'));
  assert.equal(b.recipe.palette.value.accent, '#8c3b2c');
});

test('shopfronts: piers, stall riser, framed glazing and a fascia with a lettering panel, in the shop paint', () => {
  const b = build('bilder-087959'), e = b.recipe.elevations[0], n = names(b.group);
  for (const id of ['shop-riser', 'fascia']) assert.ok(e.bands!.value.some(d => d.id === id), id);
  assert.ok(e.blocks!.value.filter(d => d.surface === 'shop').length === 2, 'two piers');
  const glass = e.openings.value.filter(o => o.id.startsWith('shop-'));
  assert.ok(glass.length && glass.every(o => o.frameSurface === 'shop'));
  assert.equal(b.recipe.palette.value.shop, '#1e1e1e');
  assert.ok(n.some(x => x.includes('shop-0/frame')));
});
