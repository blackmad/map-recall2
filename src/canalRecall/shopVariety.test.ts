// Lane shop-variety-20261120: the signature goods show once (or on most panes for stock shops) and the other panes take
// the kind's pane set; deterministic per pand; neighbours differ; no extra triangles; flag off byte-identical; the
// filler layers stay under the byte limit. `node --import tsx --test src/canalRecall/shopVariety.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOODS_KINDS, goodsCell, type GoodsKind } from './retailGoods.js';
import { FILLER_CELLS, FILLER_KINDS, FILLER_LAYERS, fillerCell } from './retailPaneFillers.js';
import { PANE_SETS, planPanes, shopVarietyEnabled, signatureTile, type PlanTile } from './shopVariety.js';
import { CHAIN_LOGO_BASE, VARIETY_BASE, retailPageCount } from './retailPages.js';
import { CHAIN_LOGO_PAGES } from './retailChainLogos.js';
import { retailLogoLayer } from './retailLogos.js';
import { retailFrontTris } from './retailFront.js';
import { RETAIL_TEMPLATES, TEMPLATE_LOOKS } from './retailTemplates.js';

const g = globalThis as { __canalRecallRetailReal?: boolean; __canalRecallShopVariety?: boolean };
const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
/** n tiles 1.15 m wide in bays of two, from 0.3 m. */
const row = (n: number): PlanTile[] => Array.from({ length: n }, (_, i) => ({ a0: 0.3 + i * 1.15, a1: 0.3 + (i + 1) * 1.15, bay: Math.floor(i / 2) }));

test('flag: default on (blind 2026-11-20); ?shopVariety=0 and SHOP_VARIETY=0 turn it off', () => {
  assert.equal(shopVarietyEnabled(null, null), true);
  assert.equal(shopVarietyEnabled(null, '0'), false);
  assert.equal(shopVarietyEnabled('?a=1&shopVariety=1', null), true);
  assert.equal(shopVarietyEnabled('?shopVariety=0', '1'), false);
  assert.equal(shopVarietyEnabled(null, '1'), true);
});

test('pane sets: every goods kind has one but the exempt automatiek and redWindow; fillers are known and distinct', () => {
  for (const k of GOODS_KINDS) {
    const set = PANE_SETS[k];
    if (k === 'automatiek' || k === 'redWindow') { assert.equal(set, undefined, k); continue; }
    assert.ok(set && set.fillers.length >= 2, `${k}: a pane set of two or more`);
    assert.equal(new Set(set.fillers).size, set.fillers.length, `${k}: distinct fillers`);
    for (const f of set.fillers) assert.ok((FILLER_KINDS as readonly string[]).includes(f), `${k}: ${f}`);
  }
  for (const f of FILLER_KINDS) assert.ok(Object.values(PANE_SETS).some(s => s!.fillers.includes(f)), `${f} is used`);
});

test('layers: the fillers come after the chain logos, only with the flag, and the last stays under 256', () => {
  assert.equal(VARIETY_BASE, CHAIN_LOGO_BASE + CHAIN_LOGO_PAGES);
  assert.equal(retailPageCount(true, false), VARIETY_BASE);
  assert.equal(retailPageCount(true, true), VARIETY_BASE + FILLER_LAYERS);
  assert.equal(retailPageCount(false, true), 2);
  const first = retailLogoLayer('bay')!;
  assert.ok(first + retailPageCount(true, true) - 1 < 256, `last layer ${first + retailPageCount(true, true) - 1}`);
  for (const c of FILLER_CELLS) assert.ok(fillerCell(c.family, c.filler).page < FILLER_LAYERS, `${c.family}/${c.filler}`);
});

test('doner: one spit, in the tile beside the door when the door is chosen; the rest fillers, no two neighbours alike', () => {
  const tiles = row(4), door: Array<[number, number]> = [[4.95, 5.95]];
  let beside = 0;
  for (let s = 0; s < 200; s++) {
    const plan = planPanes('doner', tiles, door, `pand${s}`);
    assert.equal(plan.filter(c => c.signature).length, 1, `pand${s}`);
    const sig = plan.findIndex(c => c.signature);
    if (sig === 3) beside++;
    for (let i = 1; i < plan.length; i++) {
      const a = plan[i - 1], b = plan[i];
      if (!a.signature && !b.signature) assert.notEqual(a.filler, b.filler, `pand${s} tiles ${i - 1},${i}`);
    }
    for (const c of plan) if (!c.signature) assert.ok(PANE_SETS.doner!.fillers.includes(c.filler));
    assert.deepEqual(planPanes('doner', tiles, door, `pand${s}`), plan, 'deterministic');
  }
  // Three in four beside the door, the rest the widest bay's middle (which may also be beside it).
  assert.ok(beside >= 130 && beside <= 200, `beside the door ${beside}/200`);
  assert.equal(signatureTile(tiles, [], 'x') >= 0, true);
});

test('neighbours of one template differ; one-tile fronts and exempt kinds keep the signature everywhere', () => {
  const tiles = row(4), door: Array<[number, number]> = [[4.95, 5.95]];
  const plans = new Set(Array.from({ length: 12 }, (_, s) => JSON.stringify(planPanes('gelato', tiles, door, `n${s}`))));
  assert.ok(plans.size >= 6, `${plans.size} distinct plans of 12 neighbours`);
  assert.deepEqual(planPanes('doner', row(1), door, 'x'), [{ signature: true }]);
  assert.ok(planPanes('automatiek', row(5), door, 'x').every(c => c.signature));
});

test("'most' kinds: the signature beside the door and on more tiles, at least one filler on three or more", () => {
  for (const kind of GOODS_KINDS.filter(k => PANE_SETS[k]?.signature === 'most') as GoodsKind[]) {
    let sigs = 0, n = 0;
    for (let s = 0; s < 60; s++) {
      const plan = planPanes(kind, row(5), [[6.1, 7.1]], `m${s}`);
      assert.ok(plan.some(c => c.signature) && plan.some(c => !c.signature), `${kind} m${s}`);
      sigs += plan.filter(c => c.signature).length; n += plan.length;
    }
    assert.ok(sigs / n > (PANE_SETS[kind]!.maxShare !== undefined ? 0.25 : 0.35), `${kind}: signature share ${(sigs / n).toFixed(2)}`);
  }
});

test('fronts: flag off byte-identical; on, the same triangles with filler tiles retextured; doner shows one spit tile', () => {
  g.__canalRecallRetailReal = true;
  try {
    for (const t of RETAIL_TEMPLATES) {
      const kind = TEMPLATE_LOOKS[t].goods;
      if (!kind) continue;
      const input = { template: t, seed: `v-${t}`, word: 'WINKEL', letters: 99, goods: 300, faces: 320, door: { a0: 4.9, a1: 5.9, depthM: 0.5 } };
      g.__canalRecallShopVariety = false;
      const off = retailFrontTris(input, e, 0, 7, 0, 3.6);
      assert.deepEqual(retailFrontTris({ ...input, variety: 330 }, e, 0, 7, 0, 3.6), off, `${t}: off ignores the layer`);
      g.__canalRecallShopVariety = true;
      assert.deepEqual(retailFrontTris(input, e, 0, 7, 0, 3.6), off, `${t}: on without the layer is unchanged`);
      const on = retailFrontTris({ ...input, variety: 330 }, e, 0, 7, 0, 3.6);
      assert.equal(on.length, off.length, `${t}: no extra triangles`);
      for (const [i, tri] of on.entries()) {
        assert.deepEqual(tri.p, off[i].p);
        // A filler tile keeps the tile's colour (round m: painted on the signature's family room, no tint).
        assert.equal(tri.hex, off[i].hex);
      }
      const sigPage = 300 + goodsCell(kind).page;
      const sigTiles = on.filter(tri => tri.layer === sigPage).length / 2, fillerTiles = on.filter(tri => (tri.layer ?? 0) >= 330).length / 2;
      if (PANE_SETS[kind] && off.filter(tri => tri.layer === sigPage).length / 2 >= 2) assert.ok(fillerTiles >= 1, `${t}: a filler tile`);
      if (PANE_SETS[kind]?.signature === 'once') assert.equal(sigTiles, 1, `${t}: one signature tile`);
    }
  } finally { delete g.__canalRecallRetailReal; delete g.__canalRecallShopVariety; }
});

test('gelato: the counter on at most half the panes (blind round 1: one in four diluted it; David: not in every window)', () => {
  for (let s = 0; s < 200; s++) for (const n of [2, 3, 4, 5, 6]) {
    const plan = planPanes('gelato', row(n), [[0.3 + n * 1.15 + 0.1, 0.3 + n * 1.15 + 1.1]], `g${s}`), sig = plan.filter(c => c.signature).length;
    assert.ok(sig >= 1 && sig <= Math.max(1, Math.round(n * 0.5)), `g${s} n${n}: ${sig}`);
  }
});
