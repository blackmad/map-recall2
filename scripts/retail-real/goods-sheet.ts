/**
 * Contact sheet of the window-goods cells (src/canalRecall/retailGoods.ts), each drawn at the tile's shape on the wall
 * (GOODS_W x GOODS_H) at `--px` per design unit, two tiles side by side (the second mirrored, as the mesher lays them).
 *   node --import tsx scripts/retail-real/goods-sheet.ts [--out=artifacts/retail-real/goods.png] [--cell=256]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { GOODS_KINDS, GOODS_H, GOODS_W, paintGoods, type Ctx2D } from '../../src/canalRecall/retailGoods.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg('out') ?? 'artifacts/retail-real/goods.png', CELL = Number(arg('cell') ?? 256);
const TW = Math.round(CELL * 0.62), TH = CELL, COLS = 6, PADH = 22;
const sheet = createCanvas(COLS * (2 * TW + 10), Math.ceil(GOODS_KINDS.length / COLS) * (TH + PADH));
const sx = sheet.getContext('2d');
sx.fillStyle = '#111'; sx.fillRect(0, 0, sheet.width, sheet.height);
const cell = createCanvas(CELL, CELL), cx = cell.getContext('2d');
GOODS_KINDS.forEach((k, i) => {
  cx.clearRect(0, 0, CELL, CELL); paintGoods(cx as unknown as Ctx2D, k, 0, 0, CELL);
  const x = (i % COLS) * (2 * TW + 10), y = Math.floor(i / COLS) * (TH + PADH);
  sx.drawImage(cell, x, y + PADH, TW, TH);
  sx.save(); sx.translate(x + 2 * TW, y + PADH); sx.scale(-1, 1); sx.drawImage(cell, 0, 0, TW, TH); sx.restore();
  sx.fillStyle = '#eee'; sx.font = '15px sans-serif'; sx.fillText(k, x + 4, y + 16);
});
void GOODS_W; void GOODS_H;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, sheet.toBuffer('image/png'));
console.log(OUT);
