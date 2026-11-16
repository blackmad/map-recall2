// Lane retail-real round 6: the sign-read correction layer. `node --import tsx --test src/canalRecall/retailSignReads.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READ_MIN_CONF, correctionFor, readTags, type SignRead } from './retailSignReads.js';
import { templateForTags } from './retailTemplates.js';
import { decorateShopTemplate, setShopTemplates } from './shopfronts.js';

const read = (v: SignRead['v'], conf = 0.9, tag?: string, name?: string): SignRead => ({ node: 1, pano: 'p', date: '2025-07-03', reader: 'opus', v, conf, ...(tag ? { tag } : {}), ...(name ? { name } : {}) });

test('sign reads: below the confidence floor, a match or an occluded front keeps the OSM template', () => {
  assert.deepEqual(correctionFor(read('noShop', READ_MIN_CONF - 0.01), templateForTags), { action: 'keep' });
  assert.deepEqual(correctionFor(read('match'), templateForTags), { action: 'keep' });
  assert.deepEqual(correctionFor(read('occluded'), templateForTags), { action: 'keep' });
  assert.deepEqual(correctionFor(undefined, templateForTags), { action: 'keep' });
  assert.deepEqual(correctionFor(read('noShop', 0.6), templateForTags, 0.6), { action: 'quiet' });
});

test('sign reads: no shop goes quiet; vacant and unreadable take the neutral front', () => {
  assert.deepEqual(correctionFor(read('noShop'), templateForTags), { action: 'quiet' });
  assert.deepEqual(correctionFor(read('vacant'), templateForTags), { action: 'neutral' });
  assert.deepEqual(correctionFor(read('unreadable', 0.8), templateForTags), { action: 'neutral' });
});

test('sign reads: another business takes its tag\'s template, else the neutral front', () => {
  assert.deepEqual(readTags({ tag: 'amenity=pub', name: 'Café Hoppe' }), { amenity: 'pub', name: 'Café Hoppe' });
  const c = correctionFor(read('other', 0.9, 'amenity=pub', 'Café Hoppe'), templateForTags);
  assert.equal(c.action, 'template'); assert.equal(c.action === 'template' && c.template, 'brownBar');
  assert.deepEqual(correctionFor(read('other', 0.9, 'shop=art', 'Galerie X'), templateForTags), { action: 'neutral' });
  assert.deepEqual(correctionFor(read('other', 0.9, 'a gallery'), templateForTags), { action: 'neutral' });
});

test('sign reads: the extract stamps the neutral front and the quiet pand; nothing without the lists', () => {
  const f = (id: string) => ({ type: 'Feature' as const, properties: { id } as Record<string, unknown>, geometry: null as unknown });
  setShopTemplates({ version: 1, templates: ['ah'], buildings: {}, neutral: ['n1'], quiet: ['q1'] });
  assert.equal(decorateShopTemplate(f('n1')).properties.shopKind, 'groundShop');
  assert.equal(decorateShopTemplate(f('q1')).properties.shopQuiet, true);
  assert.deepEqual(decorateShopTemplate(f('x')).properties, { id: 'x' });
  setShopTemplates(null);
});
