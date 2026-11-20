// The mean colour of every goods cell and pane filler as painted (room-tones.ts, retailRoomTone.test.ts).
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { GOODS_KINDS, GOODS_LAYERS, goodsCellPx, paintGoodsLayer } from '../../src/canalRecall/retailGoods.ts';
import { FILLER_KINDS, FILLER_LAYERS, fillerCellPx, paintFillerLayer } from '../../src/canalRecall/retailPaneFillers.ts';

export const ROOM_TONE_FILE = fileURLToPath(new URL('../../src/canalRecall/retailRoomTone.ts', import.meta.url));
const SIZE = 512;
type Box = { page: number; x: number; y: number; w: number };
export type RoomTones = { goods: Record<string, string>; fillers: Record<string, string> };

function means(layers: number, paint: (ctx: never, page: number, size: number) => void, kinds: readonly string[], box: (k: never, size: number) => Box): Record<string, string> {
  const pages = Array.from({ length: layers }, (_, page) => {
    const c = createCanvas(SIZE, SIZE), ctx = c.getContext('2d'); paint(ctx as never, page, SIZE);
    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  });
  const out: Record<string, string> = {};
  for (const k of kinds) {
    const b = box(k as never, SIZE), d = pages[b.page], inset = Math.round(b.w * 0.03), sum = [0, 0, 0];
    let n = 0;
    for (let y = Math.round(b.y) + inset; y < Math.round(b.y + b.w) - inset; y++) for (let x = Math.round(b.x) + inset; x < Math.round(b.x + b.w) - inset; x++) {
      const i = (y * SIZE + x) * 4; sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++;
    }
    out[k] = '#' + sum.map(s => Math.round(s / n).toString(16).padStart(2, '0')).join('');
  }
  return out;
}

export async function measureRoomTones(): Promise<RoomTones> {
  return {
    goods: means(GOODS_LAYERS, paintGoodsLayer as never, GOODS_KINDS, goodsCellPx as never),
    fillers: means(FILLER_LAYERS, paintFillerLayer as never, FILLER_KINDS, fillerCellPx as never),
  };
}

const rows = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}: '${v}'`).reduce<string[]>((lines, cell) => {
  const last = lines[lines.length - 1];
  if (last !== undefined && last.length + cell.length + 2 <= 116) lines[lines.length - 1] = `${last}, ${cell}`; else lines.push(cell);
  return lines;
}, []).map(l => `  ${l},`).join('\n');
export function renderRoomToneTable(t: RoomTones): string {
  return `/** Each goods cell's mean colour as painted. */\nexport const GOODS_ROOM_TONE: Readonly<Record<GoodsKind, string>> = {\n${rows(t.goods)}\n};\n`
    + `/** Each pane filler's mean colour as painted. */\nexport const FILLER_ROOM_TONE: Readonly<Record<FillerKind, string>> = {\n${rows(t.fillers)}\n};\n`;
}
