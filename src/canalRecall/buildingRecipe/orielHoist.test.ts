/**
 * Timber oriels (`bayWindows.oriel`) and hoist caps (`dormerCap`), buildingRecipe/orielHoist.ts, on the Bellamybuurt
 * tile-bay type at Hasebroekstraat 68 (086016, hasebroek-52-88; measured on the 2024-12-11 strip):
 *  - the oriel is 2.2 m wide on the middle of the wide axis (not the 4.4 m bay), three modules on storeys 1-3, three
 *    front lights; the top storey painted from 0.72 m over its foot; a white console under its foot;
 *  - one hoist cap, on the dormer over the oriel axis, flared at the top, in its measured tint; mirrored, it follows
 *    the dormer;
 *  - validation; a house without the keys builds none of it.
 *   node --import tsx --test src/canalRecall/buildingRecipe/orielHoist.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const PAND = '0363100012086016';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/hasebroek-52-88/pands/${PAND}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(o: {mirror?: boolean; strip?: boolean} = {}): CanalHouseIntent {
  const t = defaultTypeLoader('bellamy-1915-tile-bay')!;
  const design = resolvePlacement(t, {type: t.id, ...(o.mirror ? {mirror: true} : {})}, 'Hasebroekstraat').design;
  if (o.strip) for (const f of design.fronts) { delete f.bayWindows; delete f.dormerCap; }
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'hasebroek-086016', pandId: PAND, address: 'Hasebroekstraat 68', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}

test('validation: oriel fields, not with hood/finish; dormer cap indices', () => {
  const base = house();
  const front = (patch: object) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  const bw = base.fronts[0].bayWindows!;
  assert.throws(front({bayWindows: {...bw, oriel: {...bw.oriel!, span: 0.2}}}), /oriel.span/);
  assert.throws(front({bayWindows: {...bw, hood: true}}), /oriel: not together with hood/);
  assert.throws(front({bayWindows: {...bw, oriel: {...bw.oriel!, panels: {'4': {stallriser: 1}}}}}), /oriel.panels.4/);
  assert.throws(front({bayWindows: {...bw, oriel: {...bw.oriel!, paintedStoreys: undefined}}}), /oriel.paintFrom/);
  assert.throws(front({dormerCap: {kind: 'hoist', dormers: [2]}}), /dormerCap.dormers/);
  assert.throws(front({dormerCap: {kind: 'hoist', dormers: [1], colour: 'grey'}}), /dormerCap.colour/);
});

test('Hasebroekstraat 68: a 2.2 m oriel on the wide axis, painted top storey, console', async () => {
  const built = await compileBuilding(house(), facts);
  const e = built.fit.fronts[0].erker!;
  assert.ok(e.oriel, 'oriel report');
  assert.equal(e.widthM, 2.2);
  assert.deepEqual(e.oriel!.storeys, [1, 2, 3]);
  // On the wide axis: its centre right of the middle of the 6.46 m front (bayWidths [1, 2.1]: 0.66 of the width).
  const centre = e.leftM + e.widthM / 2, width = built.fit.fronts[0].widthM;
  assert.ok(Math.abs(centre / width - 0.66) < 0.03, `centre ${centre} of ${width}`);
  for (const s of [1, 2, 3]) assert.ok(meshes(built.group, new RegExp(`erker-s${s}/front/glass/`)).length, `storey ${s} glazing`);
  // Three front lights: two vertical bars per front face.
  assert.equal(meshes(built.group, /erker-s2\/front\/frame\/mullion$/).length, 2);
  assert.equal(meshes(built.group, /erker-s2\/front\/frame\/transom$/).length, 1);
  // Storey 3 is painted from 0.72 m up: its lower panel keeps the brick, a trim facing covers the rest.
  const lower3 = meshes(built.group, /erker-s3\/front\/wall\/lower$/)[0], paint3 = meshes(built.group, /erker-s3\/front\/trim\/paint$/)[0];
  assert.ok(lower3 && paint3, 'lower panel and its paint');
  assert.equal(lower3.userData.surface, 'wall');
  assert.equal(paint3.userData.surface, 'trim');
  assert.equal(meshes(built.group, /erker-s3\/front\/wall\/upper$/)[0].userData.surface, 'trim');
  assert.equal(meshes(built.group, /erker-s2\/front\/wall\/upper$/)[0].userData.surface, 'wall');
  assert.equal(meshes(built.group, /^oriel-console\//).length, 1);
});

test('hoist cap on the oriel-axis dormer, flared, measured tint; mirrored it follows the dormer', async () => {
  for (const mirror of [false, true]) {
    const built = await compileBuilding(house({mirror}), facts);
    const caps = meshes(built.group, /^hoist-caps\//);
    assert.equal(caps.length, 1);
    const m = caps[0].material as T.MeshStandardMaterial;
    assert.equal('#' + m.color.getHexString(), '#adad9d');
    assert.equal((m.userData as {tintSource?: string}).tintSource, 'measured');
    caps[0].geometry.computeBoundingBox();
    const b = caps[0].geometry.boundingBox!, e = built.fit.fronts[0].erker!, w = built.fit.fronts[0].widthM;
    // One cap (12 faces), over the oriel's axis: its centre within 0.3 m of the oriel's.
    assert.equal(caps[0].geometry.getAttribute('position').count, 36);
    const capCentre = (b.min.x + b.max.x) / 2, orielCentre = e.leftM + e.widthM / 2;
    assert.ok(Math.abs(capCentre - orielCentre) < 0.3, `mirror ${mirror}: cap ${capCentre}, oriel ${orielCentre} (front ${w})`);
    assert.ok(Math.abs(b.max.y - b.min.y - 1.2) < 0.01);
    assert.ok(b.max.x - b.min.x > 1.4, 'flared to the top');
  }
});

test('absent: no oriel, no console, no cap', async () => {
  const built = await compileBuilding(house({strip: true}), facts);
  assert.equal(built.fit.fronts[0].erker, undefined);
  assert.equal(meshes(built.group, /^(oriel-console|hoist-caps)\//).length, 0);
});
