/**
 * Triangles per template front (lane shop-goods-20261116): the 9 m budget input of retailGround.test.ts and the 6 m
 * gallery input with retailReal on, so a props change reports its cost per front before and after.
 *   node --import tsx scripts/retail-ground/front-counts.ts [--real]
 */
const real = process.argv.includes('--real');
const G = globalThis as { __canalRecallRetailReal?: boolean; __canalRecallRetailBrand?: boolean };
if (real) { G.__canalRecallRetailReal = true; G.__canalRecallRetailBrand = true; }
const { retailFrontTris } = await import('../../src/canalRecall/retailFront.ts');
const { RETAIL_TEMPLATES } = await import('../../src/canalRecall/retailTemplates.ts');
const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
let total = 0;
const rows: string[] = [];
for (const t of RETAIL_TEMPLATES) {
  const n9 = retailFrontTris({ template: t, word: 'WINKEL', seed: 'x' }, e, 0, 9, 0, 3.6).length;
  const n6 = retailFrontTris({ template: t, word: 'WINKEL', seed: 'x', letters: 99, ...(real ? { goods: 120, faces: 130 } : {}) }, e, 0.3, 6.3, 0, 3.6).length;
  total += n9;
  rows.push(`${t}\t${n9}\t${n6}`);
}
console.log(`template\t9m\t6m${real ? ' real' : ''}\n${rows.join('\n')}\ntotal9m\t${total}`);
