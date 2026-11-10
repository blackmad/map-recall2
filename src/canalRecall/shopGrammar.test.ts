import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STOREFRONT_SPECS } from './storefrontSpecs.js';
import { STOREFRONT_WALLS } from './storefrontWalls.generated.js';
import { SHOP_GROUND_PAINTS, derivePalette, shopGroundHex, shopGrammarEnabled } from './shopGrammar.js';
import { bayLookFor, BAY_LAYER_COUNT } from './bayLook.js';
import { withWorkerFlags } from './engine/workerPool.js';

const extract = JSON.parse(fs.readFileSync(new URL('../../public/data/extracts/amsterdam/shopfronts.json', import.meta.url), 'utf8'));
const measured = (): string[] => {
  const out: string[] = [];
  for (const [k, s] of Object.entries(STOREFRONT_SPECS)) {
    const w = (STOREFRONT_WALLS as Record<string, { pand: string }>)[k];
    const kind = s && w ? extract.kinds[extract.buildings[w.pand]] : undefined;
    if (['shopCafe', 'shopBar', 'shopDeli'].includes(kind) && typeof s!.wall === 'string') out.push(s!.wall);
  }
  return out;
};

test('SHOP_GROUND_PAINTS is the class-median table of the measured panorama specs', () => {
  const d = derivePalette(measured());
  assert.equal(d.reduce((s, p) => s + p.n, 0), 299);
  assert.deepEqual(SHOP_GROUND_PAINTS.map(p => [p.hex, p.weight]), d.map(p => [p.hex, p.n]));
});

test('shopGroundHex is stable per building and follows the weights', () => {
  assert.equal(shopGroundHex('a', 'photo'), shopGroundHex('a', 'photo'));
  const counts = new Map<string, number>();
  for (let i = 0; i < 4000; i++) { const h = shopGroundHex('b' + i, 'photo'); counts.set(h, (counts.get(h) ?? 0) + 1); }
  const pale = counts.get(SHOP_GROUND_PAINTS[0].hex)! / 4000;
  assert.ok(Math.abs(pale - 105 / 299) < 0.03, `pale share ${pale}`);
});

test('flag off: bayLookFor unchanged and layer count the same; on: only the groundHex of shops moves', () => {
  assert.equal(shopGrammarEnabled(), false);
  const g = globalThis as { __canalRecallShopGrammar?: boolean };
  const off = Array.from({ length: 40 }, (_, i) => bayLookFor('s' + i, 1900, 15, 'photo', 'shopCafe'));
  const quietOff = bayLookFor('q', 1900, 15, 'photo', 'quiet');
  const layers = BAY_LAYER_COUNT;
  g.__canalRecallShopGrammar = true;
  try {
    const on = Array.from({ length: 40 }, (_, i) => bayLookFor('s' + i, 1900, 15, 'photo', 'shopCafe'));
    assert.equal(BAY_LAYER_COUNT, layers);
    off.forEach((o, i) => assert.deepEqual({ ...on[i], groundHex: 0 }, { ...o, groundHex: 0 }));
    assert.ok(off.some((o, i) => o.groundHex !== on[i].groundHex));
    assert.deepEqual(bayLookFor('q', 1900, 15, 'photo', 'quiet'), quietOff);
  } finally { delete g.__canalRecallShopGrammar; }
});

test('the worker receives ?shopGrammar', () => {
  assert.match(withWorkerFlags('w.js', '?shopGrammar=1'), /shopGrammar=1/);
});
