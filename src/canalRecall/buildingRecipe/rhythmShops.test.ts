/**
 * Window rhythm and local-retail shopfronts (Bilderdijkstraat review 2026-10-10).
 * 087959 (Thai Thara): four window axes per storey with equal piers, a reduced top row on axes 0,1,3,
 * a low pointed pediment, a black fascia with gold lettering, a recessed central shop door and a separate
 * residential door at the right. The committed 087959 intent belongs to the block-face lane, so the tests
 * derive their variant from it in memory.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {compileBuilding} from './compile.ts';
import {mirrorIntent} from './instances.ts';
import {letteringGeometry} from './signage.ts';
import {cityDoorTint, hexToRgb, rgbToHsl} from './recipeLook.ts';
import type {BuildingFacts} from './facts.ts';

const H = 'scripts/building-recipes/houses/bilder-087959';
const base = JSON.parse(fs.readFileSync(`${H}/intent.json`, 'utf8'));
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${H}/facts.json`, 'utf8'));
const variant = (front: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({
  ...base,
  fronts: [{...base.fronts[0], axisGrid: 4, storeyAxes: {'4': [0, 1, 3]}, crownCap: 'pediment', crownCapSpan: 'medium', crownCapRise: 'low',
    shopfront: {colour: 'black', fascia: true, sign: {text: 'Thai Thara', textColour: '#c8a24a', span: 0.7}, entrance: 'centre-recessed', stallriser: 'low', residentialDoor: {side: 'right'}}, ...front}],
});
const centres = (b: ReturnType<typeof compileBuilding>, s: number) => b.recipe.elevations[0].openings.value
  .filter(o => new RegExp(`^s${s}-b\\d+$`).test(o.id)).map(o => ({c: o.leftM + o.widthM / 2, l: o.leftM, r: o.leftM + o.widthM, w: o.widthM}))
  .sort((a, b) => a.c - b.c);

test('window axes line up between storeys and the piers are equal', () => {
  const b = compileBuilding(variant(), facts), width = b.fit.fronts[0].widthM;
  const rows = [1, 2, 3].map(s => centres(b, s));
  for (const r of rows) assert.equal(r.length, 4);
  // Plain row (no balcony widening): outer piers equal the inner ones.
  const plain = rows[0], gaps = plain.slice(1).map((w, i) => w.l - plain[i].r);
  for (const g of [plain[0].l, width - plain[3].r, ...gaps]) assert.ok(Math.abs(g - gaps[0]) < 0.01, `pier ${g} vs ${gaps[0]}`);
  // Every storey's windows sit on the same axes (balcony windows only widen about their axis).
  for (const r of rows) r.forEach((w, i) => assert.ok(Math.abs(w.c - plain[i].c) < 0.01, 'axis'));
  // The reduced top row uses axes 0, 1 and 3.
  const top = centres(b, 4);
  assert.deepEqual(top.map(w => plain.findIndex(p => Math.abs(p.c - w.c) < 0.01)), [0, 1, 3]);
  // The balcony bay is wider than its neighbours, not narrower.
  const balcony = rows[1][1].w;
  assert.ok(balcony > rows[1][0].w);
});

test('a storey that cannot sit on the grid warns instead of drifting silently; storeyAxes must match the bay count', () => {
  const warn = compileBuilding(variant({storeyAxes: undefined}), facts).fit.warnings;
  assert.ok(warn.some(w => /storey 4 has 3 windows on a 4-axis front/.test(w)), warn.join('|'));
  assert.throws(() => variant({storeyAxes: {'4': [0, 1]}}), /storeyAxes/);
  assert.throws(() => variant({storeyAxes: {'4': [0, 1, 4]}}), /storeyAxes/);
  const centred = compileBuilding(variant({storeyAxes: undefined, bays: [4, 4, 4, 4, 2]}), facts);
  assert.equal(centres(centred, 4).length, 2);
  assert.deepEqual(centres(centred, 4).map(w => Math.round(w.c * 100)), [1, 2].map(i => Math.round(centres(centred, 1)[i].c * 100)));
});

test('low pointed pediment crown replaces the rounded cap', () => {
  const b = compileBuilding(variant(), facts), e = b.recipe.elevations[0], eaves = b.fit.fronts[0].eavesM;
  const peak = Math.max(...e.crown!.value.profile.map(p => p[1]));
  assert.ok(peak - eaves < 0.75 && peak - eaves > 0.3, `low cap rise ${peak - eaves}`);
  const apex = e.crown!.value.profile.filter(p => Math.abs(p[1] - peak) < 1e-6);
  assert.equal(apex.length, 1, 'a single point, not a rounded run');
  assert.throws(() => variant({crownCapRise: 'tall'}), /crownCapRise/);
});

test('shopfront: lettering, recessed shop door and separate residential door', () => {
  const b = compileBuilding(variant(), facts), e = b.recipe.elevations[0];
  const ids = e.openings.value.map(o => o.id);
  assert.ok(ids.includes('door') && ids.includes('shop-door'));
  const shopDoor = e.openings.value.find(o => o.id === 'shop-door')!, res = e.openings.value.find(o => o.id === 'door')!;
  assert.ok(shopDoor.recessM! > 0.3, 'recessed');
  assert.equal(shopDoor.paneSurface, 'glass');
  assert.ok(res.leftM > shopDoor.leftM + shopDoor.widthM, 'residential door at the right of the shop');
  const fascia = b.fit.fronts[0].fascia!;
  assert.ok(fascia.leftM + fascia.widthM < res.leftM + 0.2, 'fascia stops at the residential door');
  let tris = 0; b.group.traverse(o => { if (o.name === 'sign/lettering' && o instanceof T.Mesh) tris += o.geometry.getAttribute('position').count / 3; });
  assert.ok(tris > 30 && tris < 300, `lettering ${tris} triangles`);
  assert.ok(compileBuilding(variant({shopfront: {colour: 'black', fascia: true}}), facts).group.getObjectByName('sign/lettering') === undefined, 'no text invented without a sign');
  assert.equal(mirrorIntent(variant()), null, 'lettering never mirrors');
  assert.throws(() => variant({shopfront: {colour: 'black', fascia: true, sign: {text: '', textColour: 'black'}}}), /sign.text/);
});

test('lettering fits its box and reverses cleanly on a mirrored frame', () => {
  const a = letteringGeometry({text: 'Thai Thara', heightM: 0.34, maxWidthM: 3});
  assert.ok(a.widthM <= 3 + 1e-9 && a.heightM <= 0.34 + 1e-9);
  const m = letteringGeometry({text: 'Thai Thara', heightM: 0.34, maxWidthM: 3}, true);
  assert.equal(m.triangles, a.triangles);
  const cross = (p: number[], i: number) => (p[i + 3] - p[i]) * (p[i + 7] - p[i + 1]) - (p[i + 4] - p[i + 1]) * (p[i + 6] - p[i]);
  assert.ok(cross(a.positions, 0) > 0 && cross(m.positions, 0) > 0, 'both face the viewer');
});

test('authored near-black paint stays neutral and dark brown stays brown through the city door tint', () => {
  const [r, g, bl] = hexToRgb(cityDoorTint('#1e1e1e'));
  assert.ok(Math.abs(r - g) <= 1 && Math.abs(g - bl) <= 1, 'neutral');
  const [h] = rgbToHsl(hexToRgb(cityDoorTint('#4e3027')));
  assert.ok(h > 5 && h < 25, `brown hue ${h}`);
  assert.equal(cityDoorTint('#26392f'), '#26392f');
});
