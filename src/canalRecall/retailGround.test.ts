// Lane retail-ground (2026-11-14): the template classifier, the front geometry, the measured pui and the flag's
// byte-identity when off. `node --import tsx --test src/canalRecall/retailGround.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RETAIL_TEMPLATES, TEMPLATE_LOOKS, retailGroundEnabled, signWord, templateForTags } from './retailTemplates.js';
import { FRONT, retailFrontTris } from './retailFront.js';
import { decorateShopfront, setShopfronts, setShopTemplates } from './shopfronts.js';
import { bayTextures, type BayVariant } from './bayTextures.js';
import { insideCentre } from './retailArea.js';

const g = globalThis as { __canalRecallRetailGround?: boolean };

test('flag: off by default, URL beats env', () => {
  assert.equal(retailGroundEnabled(null, null), false);
  assert.equal(retailGroundEnabled('?retailGround=1', null), true);
  assert.equal(retailGroundEnabled('?retailGround=0', '1'), false);
  assert.equal(retailGroundEnabled('', '1'), true);
});

test('templates from OSM tags (2026-11-14 Overpass samples)', () => {
  const cases: Array<[Record<string, string>, string | null]> = [
    [{ shop: 'supermarket', brand: 'Albert Heijn', 'brand:wikidata': 'Q1653985', name: 'Albert Heijn' }, 'ah'],
    [{ shop: 'convenience', brand: 'Albert Heijn to go', 'brand:wikidata': 'Q77971185' }, 'ah'],
    [{ shop: 'florist', name: 'Jumbo' }, 'jumbo'],
    [{ amenity: 'restaurant', name: 'Chinees restaurant Jumbo' }, null],
    [{ shop: 'chemist', brand: 'Etos', 'brand:wikidata': 'Q2609459' }, 'etos'],
    [{ amenity: 'fast_food', brand: 'FEBO', cuisine: 'friture' }, 'febo'],
    [{ shop: 'books', brand: 'Bruna', 'brand:wikidata': 'Q3317555' }, 'bruna'],
    [{ shop: 'newsagent', name: 'Bestseller' }, 'bestseller'],
    [{ shop: 'gift', name: 'Amsterdam Duck Store' }, 'duck'],
    [{ shop: 'cannabis', name: 'Rockland' }, 'coffeeshop'],
    [{ shop: 'cannabis', name: 'Head Shop' }, 'smartshop'],
    [{ amenity: 'bar', name: "Barney's Farm" }, null],
    [{ amenity: 'pub', name: 'Café Wiener' }, 'brownBar'],
    [{ amenity: 'bar', name: 'Cocktail Lounge X' }, null],
    [{ amenity: 'cafe', name: 'Café Brel' }, 'brownBar'],
    [{ shop: 'bicycle', name: 'iBike', 'service:bicycle:rental': 'yes' }, 'bike'],
    [{ amenity: 'brothel' }, 'redLight'],
    [{ amenity: 'brothel', name: 'Boysclub 21' }, null],
    [{ amenity: 'fast_food', cuisine: 'kebab', name: 'Durum Doner Center' }, 'doner'],
    [{ amenity: 'restaurant', cuisine: 'surinamese', name: 'Seth takeout' }, 'toko'],
    [{ amenity: 'restaurant', name: 'Toko Restu' }, 'toko'],
    [{ shop: 'butcher', name: 'Slagerij ten Wolde' }, 'butcher'],
    [{ shop: 'greengrocer' }, 'greengrocer'],
    [{ shop: 'bakery', name: 'Bakkerij Kara Firin' }, 'turkishBakery'],
    [{ shop: 'bakery', name: 'Bakkerij Jan' }, null],
    [{ shop: 'cheese', name: 'Kaasland' }, 'cheese'],
    [{ shop: 'confectionery', name: 'Van Wonderen Stroopwafels' }, 'waffle'],
    [{ amenity: 'restaurant', cuisine: 'pancake' }, 'pancake'],
    [{ shop: 'gift', name: 'Amsterdam is My Style' }, 'souvenir'],
    [{ shop: 'books', name: 'Athenaeum Boekhandel' }, 'books'],
    [{ shop: 'mobile_phone' }, 'phone'],
    [{ amenity: 'fast_food', name: 'Pizzeria Ria' }, null],
    [{ shop: 'clothes', name: 'Zara' }, null],
  ];
  for (const [tags, want] of cases) assert.equal(templateForTags(tags), want, JSON.stringify(tags));
});

test('sign words fold to the block alphabet', () => {
  assert.equal(signWord('Café Wiener'), 'WIENER');
  assert.equal(signWord("Cuckoo's Nest"), 'CUCKOO S NEST');
  assert.equal(signWord('Coffeeshop 420'), '420');
  assert.ok(signWord('A very long business name indeed').length <= 14);
});

test('every template builds a front on its wall, within the plot line rules', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  for (const t of RETAIL_TEMPLATES) {
    const tris = retailFrontTris({ template: t, word: 'TEST', seed: 'x' }, e, 0.3, 6.3, 0, 3.6);
    assert.ok(tris.length > 10, t);
    for (const tri of tris) for (const [x, y, z] of tri.p) {
      assert.ok(x >= 0.2 && x <= 6.4, `${t}: along ${x}`);
      // Out from the wall (y = -outward): the fascia 0.12 m, an awning or pavement goods at most 1.1 m.
      assert.ok(-y >= -0.01 && -y <= 1.11, `${t}: out ${-y}`);
      assert.ok(z >= 0 && z <= 4.6, `${t}: up ${z}`);
    }
    assert.equal(retailFrontTris({ template: t, seed: 'x' }, e, 0, 1, 0, 3.6).length, 0);
  }
  assert.ok(FRONT.maxSpanM <= 14);
});

test('the template extract stamps only once installed', () => {
  const f: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown } = { type: 'Feature', properties: { id: 'NL.IMBAG.Pand.1' }, geometry: null };
  setShopfronts(null); setShopTemplates(null);
  assert.equal(decorateShopfront(f), f);
  setShopTemplates({ version: 1, templates: ['ah'], buildings: { 'NL.IMBAG.Pand.1': [0, 4.9, 52.37] } });
  assert.deepEqual(decorateShopfront(f).properties.shopTemplate, ['ah', 4.9, 52.37]);
  setShopTemplates(null);
  assert.equal(decorateShopfront(f), f);
});

function paintCalls(v: BayVariant): string[] {
  const calls: string[] = [];
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop: (...a: unknown[]) => calls.push(`stop${JSON.stringify(a)}`) }) }, {
    get(target, key) { if (key in target) return target[key as keyof typeof target]; return (...a: unknown[]) => calls.push(`${String(key)}${JSON.stringify(a)}`); },
    set(_t, key, value) { calls.push(`${String(key)}=${String(value)}`); return true; },
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  try { bayTextures(v, {} as CanvasImageSource, 'photo'); } finally { globalThis.document = previous; }
  return calls;
}

test('shop cells: the pui with the flag on (no props), unchanged with it off', () => {
  const kinds = ['groundShop', 'shopCafe', 'shopWindow', 'shopBar', 'shopDeli', 'shopFlorist', 'shopBike'] as const;
  for (const kind of kinds) {
    const v: BayVariant = { archetype: 'canal', kind, windows: 2, shape: 'rect', shutters: false, paintedFrames: false };
    g.__canalRecallRetailGround = false;
    const off = paintCalls({ ...v });
    g.__canalRecallRetailGround = true;
    const on = paintCalls({ ...v, windows: 3 });
    g.__canalRecallRetailGround = false;
    const offAgain = paintCalls({ ...v, windows: 1 });
    assert.ok(!on.some(c => c.startsWith('arc') || c.startsWith('ellipse')), `${kind}: no scallops, tables, flowers or wheels`);
    assert.notDeepEqual(on, off, kind);
    // The off painting does not depend on the flag having been on in between (cache keys differ).
    assert.deepEqual(offAgain.filter(c => !c.startsWith('width') && !c.startsWith('height')), off.filter(c => !c.startsWith('width') && !c.startsWith('height')), kind);
  }
  delete g.__canalRecallRetailGround;
});

test('the census centre polygon holds the Dam and not Sloterdijk', () => {
  assert.ok(insideCentre(4.8926, 52.3731));
  assert.ok(!insideCentre(4.838, 52.389));
});

test('looks: every template has one', () => {
  for (const t of RETAIL_TEMPLATES) assert.ok(TEMPLATE_LOOKS[t], t);
});
