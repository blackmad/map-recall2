// Lane shopfront-feedback-20261123 (David's 41 Shopfronts notes of 2026-11-23): accented letters draw their base glyph
// plus a mark, the chain goods kinds paint and have rooms and pane sets, own-front chains carry logos, and a chain's
// goods kind replaces its template's. `node --import tsx --test src/canalRecall/shopfrontFeedback.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCENT_SLOTS, GLYPH_CHARS, glyphLayout } from './retailLogos.js';
import { typeLayout } from './retailTypeFaces.js';
import { GOODS_KINDS, GOODS_LAYERS } from './retailGoods.js';
import { ROOM_FAMILY_OF } from './retailRoomTone.js';
import { PANE_SETS } from './shopVariety.js';
import { CHAINS_OWN_FRONT, RETAIL_CHAINS } from './retailChains.js';
import { chainLogo } from './retailChainLogos.js';
import { chainLook } from './retailFront.js';
import { REAL_ACCEPTED, TEMPLATE_LOOKS } from './retailTemplates.js';
import { retailPageCount } from './retailPages.js';

test('accent slots are free glyph slots past the character set', () => {
  for (const slot of Object.values(ACCENT_SLOTS)) assert.ok(slot >= GLYPH_CHARS.length && slot < 40, `slot ${slot}`);
});

test('CAFÉ lays out as CAFE plus an acute over the E that does not advance', () => {
  const plain = glyphLayout('CAFE'), acc = glyphLayout('CAFÉ');
  assert.equal(acc.width, plain.width);
  assert.equal(acc.quads.length, plain.quads.length + 1);
  const mark = acc.quads.find((q) => 'z' in q && q.z);
  assert.ok(mark, 'a raised mark quad');
  const e = plain.quads[3];
  assert.ok(mark!.a0 >= e.a0 - 0.05 && mark!.a1 <= e.a1 + 0.05, 'the mark sits over the E');
  assert.ok(mark!.z![0] > 0.8, 'the mark rides above the cap line');
});

test('umlaut and circumflex letters also gain marks; unknown letters still drop', () => {
  assert.equal(glyphLayout('HUNKEMÖLLER').quads.length, glyphLayout('HUNKEMOLLER').quads.length + 1);
  assert.equal(glyphLayout('FORÊT').quads.length, glyphLayout('FORET').quads.length + 2);
});

test('type faces fall back to the base letter for an accent they lack', () => {
  for (const face of ['serif', 'condensed', 'script'] as const) {
    const a = typeLayout(face, 'Café'), b = typeLayout(face, 'Cafe');
    assert.equal(a.quads.length, b.quads.length, face);
    assert.ok(Math.abs(a.width - b.width) < 0.5, `${face} width`);
  }
});

test('the chain goods kinds paint, have a room family and a pane set', () => {
  for (const k of ['sports', 'outdoor', 'luggage', 'lingerie'] as const) {
    assert.ok((GOODS_KINDS as readonly string[]).includes(k), k);
    assert.ok(ROOM_FAMILY_OF[k], `${k} room`);
    assert.ok(PANE_SETS[k], `${k} panes`);
  }
  assert.equal(GOODS_LAYERS, Math.ceil(GOODS_KINDS.length / 4));
  assert.ok(retailPageCount() > 0);
});

test('chain goods overrides land on the chains David named', () => {
  const want: Record<string, string> = { bever: 'sports', decathlon: 'sports', samsonite: 'luggage', timberland: 'outdoor', hunkemoller: 'lingerie' };
  for (const [key, goods] of Object.entries(want)) {
    const c = RETAIL_CHAINS[key];
    assert.ok(c, key);
    assert.equal(c!.goods, goods, key);
  }
});

test('a chain goods kind replaces the template goods only where the template shows goods', () => {
  const clothes = chainLook({ template: 'clothes', chain: { fascia: '#fff', letters: '#000', word: 'BEVER', goods: 'sports' } });
  assert.equal(clothes.goods, 'sports');
  assert.equal(chainLook({ template: 'clothes' }), TEMPLATE_LOOKS.clothes);
  const noGoods = (Object.keys(TEMPLATE_LOOKS) as (keyof typeof TEMPLATE_LOOKS)[]).find((t) => !TEMPLATE_LOOKS[t].goods);
  if (noGoods) assert.equal(chainLook({ template: noGoods, chain: { fascia: '#fff', letters: '#000', word: 'X', goods: 'sports' } }).goods, undefined);
});

test('every own-front chain David asked about has a logo', () => {
  for (const key of ['praxis', 'praxis-city', 'burger-king', 'kfc', 'pets-place', 'taco-mundo', 'beter-horen', 'dille-and-kamille', 'flying-tiger-copenhagen',
    'pipoos', 'specsavers', 'wagamama', 'beter-bed', 'dunkin', 'mediamarkt', 'intertoys', 'papa-john-s', 'vodafone', 'xenos', 'gwk-travelex']) {
    assert.ok(CHAINS_OWN_FRONT.has(key), `${key} own front`);
    assert.ok(chainLogo(key), `${key} logo`);
  }
  for (const key of ['anne-and-max', 'massimo-gelato', 'de-bakkerszonen', 'ekoplaza-foodmarqt', 'alexanderhoeve']) assert.ok(chainLogo(key), `${key} logo`);
});

test('Duck Store shows its goods; Atlas is not a chain', () => {
  assert.ok(REAL_ACCEPTED.has('duck'));
  assert.equal(RETAIL_CHAINS.atlas, undefined);
});
