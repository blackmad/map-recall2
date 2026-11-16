// `node --import tsx --test src/canalRecall/shopfrontIndex.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildShopfrontIndex, humanise, thumbFile, type ShopTemplateExtract } from './shopfrontIndex.js';

const extract: ShopTemplateExtract = {
  templates: ['ah', 'brownBar', 'supermarket', 'bakery'],
  buildings: {
    p1: [0, 4.90, 52.37, '', 1], p2: [0, 4.80, 52.30, '', 1],
    p3: [1, 4.89, 52.371, 'CAFE X', 1], p4: [1, 4.70, 52.30],
    p5: [2, 4.895, 52.370, '@lidl', 1], p6: [2, 4.9, 52.37, '@unknown', 1], p7: [2, 4.9, 52.37, '', 1],
  },
};
const idx = buildShopfrontIndex({
  extract, chainTemplates: ['ah'], chainTypeTemplates: ['supermarket'], chains: { lidl: { name: 'Lidl', template: 'supermarket' } },
  names: { ah: 'Albert Heijn' }, brandAccepted: k => k === 'ah', logoSource: (k, kind) => (k === 'lidl' && kind === 'chain' ? 'https://example.org/lidl' : undefined), thumbBase: 'https://x/',
});

test('chains, chain templates and generic templates are counted apart', () => {
  const by = Object.fromEntries(idx.map(e => [`${e.kind}:${e.id}`, e]));
  assert.deepEqual(Object.keys(by).sort(), ['chain:ah', 'chain:lidl', 'template:bakery', 'template:brownBar']);
  assert.equal(by['chain:ah'].pands, 2);
  assert.equal(by['template:brownBar'].pands, 2);
  assert.equal(by['chain:lidl'].pands, 1);
  assert.equal(by['template:bakery'].pands, 0);
  assert.equal(by['template:bakery'].example, null);
});
test('example is the pand nearest the centre; brand and logo flags carry through', () => {
  const by = Object.fromEntries(idx.map(e => [e.id, e]));
  assert.equal(by.ah.example?.pand, 'p1');
  assert.equal(by.brownBar.example?.pand, 'p3');
  assert.equal(by.ah.brandAccepted, true);
  assert.equal(by.lidl.logoSource, 'https://example.org/lidl');
  assert.equal(by.lidl.thumb, 'https://x/chain-lidl.webp');
  assert.equal(by.brownBar.thumb, 'https://x/generic-brownBar.webp');
});
test('sorted by pand count, helpers', () => {
  assert.ok(idx.every((e, i) => i === 0 || idx[i - 1].pands >= e.pands));
  assert.equal(humanise('brownBar'), 'Brown bar');
  assert.equal(thumbFile('template', 'bakery'), 'generic-bakery.webp');
});
