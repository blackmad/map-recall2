// Lane retail-real-20261115: the retail layers stay under the byte limit, the flag off is round n, goods tiles bound
// the triangle cost, and chains resolve from tags. `node --import tsx --test src/canalRecall/retailPages.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHAIN_LOGO_BASE, GOODS_BASE, TYPE_BASE, retailPageCount, retailRealEnabled } from './retailPages.js';
import { retailLogoLayer } from './retailLogos.js';
import { GOODS_KINDS, GOODS_LAYERS, GOODS_TILE_M, goodsCell, goodsTiles } from './retailGoods.js';
import { CHAIN_LOGO_PAGES, chainLogo } from './retailChainLogos.js';
import { RETAIL_CHAINS, chainForTags, chainOfWord } from './retailChains.js';
import { REAL_ONLY_TEMPLATES, RETAIL_TEMPLATES, TEMPLATE_LOOKS } from './retailTemplates.js';
import { retailFrontTris } from './retailFront.js';
import { PROP_COST } from './shopProps/props.js';

const g = globalThis as { __canalRecallRetailReal?: boolean };
const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 }, rect = [0.08, 0.155, 0.92, 0.56] as const;

test('flag: default on, ?retailReal=0 and RETAIL_REAL=0 turn it off', () => {
  assert.equal(retailRealEnabled(null, null), true);
  assert.equal(retailRealEnabled('?a=1&retailReal=0', '1'), false);
  assert.equal(retailRealEnabled(null, '0'), false);
});

test('layers: the last retail page stays under 256 (facade layers are bytes); off takes the two logo pages', () => {
  const first = retailLogoLayer('bay')!;
  assert.ok(first + retailPageCount(true) - 1 < 256, `last layer ${first + retailPageCount(true) - 1}`);
  assert.equal(retailPageCount(false), 2);
  assert.equal(TYPE_BASE, GOODS_BASE + GOODS_LAYERS); assert.equal(CHAIN_LOGO_BASE, TYPE_BASE + 3);
  for (const k of GOODS_KINDS) { const c = goodsCell(k); assert.ok(c.page >= 0 && c.page < GOODS_LAYERS, k); }
  for (const key of Object.keys(RETAIL_CHAINS)) { const l = chainLogo(key); if (l) assert.ok(l.page < CHAIN_LOGO_PAGES, key); }
});

test('flag off: no template carries goods or a face, so fronts draw as round n', () => {
  g.__canalRecallRetailReal = false;
  try {
    for (const t of RETAIL_TEMPLATES) { assert.equal(TEMPLATE_LOOKS[t].goods, undefined, t); assert.equal(TEMPLATE_LOOKS[t].face, undefined, t); }
  } finally { delete g.__canalRecallRetailReal; }
});

test('goods tiles: about one per 1.15 m of pane, alternate tiles mirrored; a goods front stays within 160 tris on 6 m', () => {
  const tiles = goodsTiles(0, 4.6);
  assert.equal(tiles.length, Math.round(4.6 / GOODS_TILE_M));
  assert.ok(tiles.some(t => t.flip) && tiles.some(t => !t.flip));
  g.__canalRecallRetailReal = true;
  try {
    for (const t of RETAIL_TEMPLATES) {
      // Lane shop-goods: the hairdresser's salon props are budgeted with the other props (retailGround.test.ts).
      if (['bike', 'greengrocer', 'florist', 'hairdresser', 'tobacco', 'febo', 'smartshop', 'brownBar', 'redLight'].includes(t)) continue;
      const tris = retailFrontTris({ template: t, seed: 'x', word: 'VERHAGEN', letters: 99, interior: { layer: 7, rect }, goods: 300 }, e, 0.3, 6.3, 0, 3.6);
      // Round t: postcard stands (racks) are props, default since their blind: within 220.
      assert.ok(tris.length <= (TEMPLATE_LOOKS[t].pavement === 'racks' ? 160 + 2 * PROP_COST.postcardSpinner : TEMPLATE_LOOKS[t].pavement === 'promo' ? 220 : 160), `${t}: ${tris.length} tris`);
      if (TEMPLATE_LOOKS[t].goods) assert.ok(tris.some(tri => (tri.layer ?? 0) >= 300), `${t}: goods tiles drawn`);
    }
  } finally { delete g.__canalRecallRetailReal; }
});

test('chains: brand:wikidata or name picks the chain; the extract word round-trips; real-only templates are listed', () => {
  const lidl = Object.entries(RETAIL_CHAINS).find(([k]) => k === 'lidl');
  assert.ok(lidl, 'lidl tabled');
  if (lidl![1].wikidata) assert.equal(chainForTags({ shop: 'supermarket', 'brand:wikidata': lidl![1].wikidata }), 'lidl');
  assert.equal(chainForTags({ shop: 'supermarket', name: 'Lidl' }), 'lidl');
  assert.equal(chainForTags({ shop: 'bakery', name: 'Bakkerij Verhagen' }), null);
  assert.equal(chainOfWord('@lidl'), 'lidl'); assert.equal(chainOfWord('VERHAGEN'), null);
  assert.ok(REAL_ONLY_TEMPLATES.includes('tattoo') && REAL_ONLY_TEMPLATES.includes('snackbar'));
});

test('chain-logos2: own-front chains of a real-only type have a logo; a chain frame and awning reach the front; a widened mark fits the board', async () => {
  const { CHAINS_OWN_FRONT } = await import('./retailChains.js');
  const { retailFrontTris } = await import('./retailFront.js');
  for (const k of ['new-york-pizza', 'domino-s', 'subway', 'de-pizzabakkers', 'pearle', 'odido', 'grapedistrict', 'gamma', 'blokker']) {
    assert.ok(CHAINS_OWN_FRONT.has(k) && RETAIL_CHAINS[k], k);
    assert.ok(REAL_ONLY_TEMPLATES.includes(RETAIL_CHAINS[k].template), `${k}: a real-only type`);
    assert.ok(chainLogo(k), `${k}: logo packed`);
  }
  // Simon Meijssen's amber-glazed pilasters and brown awning (pano recording_2025-07-30_08-35-53_00865); its frieze is wide.
  const sm = RETAIL_CHAINS['simon-meijssen'];
  assert.equal(sm.frame, '#b5792c'); assert.equal(sm.awning, '#6b4636'); assert.ok(chainLogo('simon-meijssen')!.aspect > 6);
  // Lidl's square mark is packed in a 2:1 cell, so it draws inside the 0.6 m board, not as a 0.95 m lightbox.
  assert.ok(Math.abs(chainLogo('lidl')!.aspect - 2) < 0.05);
  const g = globalThis as { __canalRecallRetailReal?: boolean }; g.__canalRecallRetailReal = true;
  try {
    const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 }, l = chainLogo('lidl')!;
    const base = { template: 'supermarket' as const, seed: 'lidl-fit', letters: 207, goods: 209, chain: { fascia: '#0050aa', letters: '#fff000', word: 'Lidl' } };
    const tris = retailFrontTris({ ...base, logo: { layer: 300, rect: l.rect, aspect: l.aspect } }, e, 0, 6, 0, 3.2);
    const logoZ = tris.filter(t => t.layer === 300).flatMap(t => t.p.map(p => p[2]));
    const boardTop = Math.max(...tris.filter(t => t.hex === '#0050aa').flatMap(t => t.p.map(p => p[2])));
    assert.ok(Math.max(...logoZ) <= boardTop + 1e-6, `logo top ${Math.max(...logoZ)} under the board top ${boardTop}`);
    // Absent frame / awning: unchanged; present: the awning slope and frame take the chain's colours.
    const plain = retailFrontTris({ template: 'bakery', seed: 's', letters: 207 }, e, 0, 6, 0, 3.2);
    const dressed = retailFrontTris({ template: 'bakery', seed: 's', letters: 207, awning: sm.awning, frameHex: sm.frame }, e, 0, 6, 0, 3.2);
    assert.ok(!plain.some(t => t.hex === sm.awning) && dressed.some(t => t.hex === sm.awning) && dressed.some(t => t.hex === sm.frame));
  } finally { delete g.__canalRecallRetailReal; }
});

test('De Wallen audit (lane R, 394d2f52b): 27 measured window fronts staged with their span, 21 marked not drawn; the stamp carries them', async () => {
  const fs = await import('node:fs');
  const { decorateShopTemplate, setShopTemplates } = await import('./shopfronts.js');
  const ex = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8'));
  const rows = Object.entries(ex.buildings) as Array<[string, unknown[]]>;
  const audited = rows.filter(([, r]) => (r[5] as { s?: unknown } | undefined)?.s), off = rows.filter(([, r]) => (r[5] as { x?: unknown } | undefined)?.x);
  assert.equal(audited.length, 27); assert.equal(off.length, 21);
  // 0363100012165090: 4.72 m front, the window over 0.05-0.8 of it, three doors, no tube, curtains gathered.
  const k = rows.find(([id]) => id.endsWith('0363100012165090'))!;
  assert.deepEqual({ ...(k[1][5] as object), s: undefined }, { s: undefined, d: 3, t: 'none', c: 'gathered', f: '#2e2622' });
  setShopTemplates(ex);
  try {
    const f = decorateShopTemplate({ type: 'Feature', properties: { id: k[0] }, geometry: null } as never) as { properties: { shopTemplate: unknown[] } };
    assert.equal(f.properties.shopTemplate[0], 'redLight'); assert.deepEqual(f.properties.shopTemplate[5], k[1][5]);
  } finally { setShopTemplates(null); }
});

test('acceptance: only blind winners take the real look', async () => {
  const { REAL_ACCEPTED } = await import('./retailTemplates.js');
  const gg = globalThis as { __canalRecallRetailReal?: boolean };
  gg.__canalRecallRetailReal = true;
  try {
    assert.ok(REAL_ACCEPTED.has('redLight') && REAL_ACCEPTED.has('brownBar') && !REAL_ACCEPTED.has('butcher'));
    assert.equal(TEMPLATE_LOOKS.cheese.goods, 'cheese');
    assert.equal(TEMPLATE_LOOKS.butcher.goods, undefined); assert.equal(TEMPLATE_LOOKS.butcher.face, undefined);
    assert.equal(TEMPLATE_LOOKS.florist.goods, undefined);
  } finally { delete gg.__canalRecallRetailReal; }
});
