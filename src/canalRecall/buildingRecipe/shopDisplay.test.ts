/**
 * Luxury shopfronts (PC Hooftstraat 80-112, 2026-11-22): `shopfront.display` (a lit display's measured glass tint) and
 * `shopfront.head` (round or segmental display heads, Dior at 100-102); validation; drawn on PC Hooftstraat 102, and
 * absent = the stock shop glass with square heads, byte-identical.
 *   node --import tsx --test src/canalRecall/buildingRecipe/shopDisplay.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createHash} from 'node:crypto';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {shopDisplay} from './fit.ts';

const FACE = 'scripts/block-face/faces/hooft-80-112', PAND = '0363100012161527';
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const face = JSON.parse(fs.readFileSync(`${FACE}/intent.json`, 'utf8'));
  const h = face.houses.find((x: any) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `shop-${PAND.slice(-6)}`, pandId: PAND, address: h.address, sources: face.sources, ...design, notes: []} as CanalHouseIntent);
}
const hashOf = (g: T.Object3D) => { const h = createHash('sha256'); g.traverse(o => { if (o instanceof T.Mesh) { h.update(o.name); h.update(Buffer.from(new Float32Array(Array.from(o.geometry.getAttribute('position').array as ArrayLike<number>)).buffer)); const m = o.material as T.MeshStandardMaterial; h.update(m.color?.getHexString() ?? ''); } }); return h.digest('hex'); };

test('shopDisplay: tint and arched heads; absent = nothing', () => {
  assert.deepEqual(shopDisplay({}, 3, 3), {});
  assert.deepEqual(shopDisplay({display: '#E2CF9A'}, 3, 3), {paneTint: '#e2cf9a'});
  const round = shopDisplay({head: 'round'}, 3, 4);
  assert.equal(round.head, 'segmental');
  assert.equal(round.headRiseM, 1.42); // half the pane (3 - 0.16)
  assert.equal(shopDisplay({head: 'round'}, 3, 2).headRiseM, 0.9); // capped at 0.45 of the opening's height
  assert.equal(shopDisplay({head: 'segmental'}, 3, 4).headRiseM, 0.54);
});

test('validation: display is a colour, head one of round | segmental', () => {
  assert.throws(() => house(f => { (f.shopfront as any).display = 'gold'; }), /shopfront\.display/);
  assert.throws(() => house(f => { (f.shopfront as any).head = 'gothic'; }), /shopfront\.head/);
  assert.doesNotThrow(() => house());
});

test('PC Hooftstraat 102 (Dior): lit round-headed display; absent = stock glass, byte-identical', async () => {
  const f = facts();
  const strip = (fr: FrontIntent) => { delete (fr.shopfront as any).display; delete (fr.shopfront as any).head; };
  const plain = await compileBuilding(house(strip), f);
  const again = await compileBuilding(house(strip), f);
  assert.equal(hashOf(again.group), hashOf(plain.group));
  const lit = await compileBuilding(house(), f);
  assert.notEqual(hashOf(lit.group), hashOf(plain.group));
  const mats = new Set<T.Material>();
  lit.group.traverse(o => { if (o instanceof T.Mesh) for (const m of [o.material].flat()) if ((m as any).userData?.tintSource === 'measured' && (m as T.MeshStandardMaterial).color?.getHexString() === 'e2cf9a') mats.add(m); });
  assert.ok(mats.size > 0, 'the lit display keeps its measured tint');
  const plainMeasured: T.Material[] = [];
  plain.group.traverse(o => { if (o instanceof T.Mesh) for (const m of [o.material].flat()) if ((m as T.MeshStandardMaterial).color?.getHexString() === 'e2cf9a') plainMeasured.push(m); });
  assert.equal(plainMeasured.length, 0);
});
