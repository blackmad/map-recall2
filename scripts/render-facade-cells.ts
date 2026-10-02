// Contact sheet of the facade cells, tinted as the shader would, plus a
// composed storey stack per style so alignment can be judged by eye.
//   npx tsx scripts/render-facade-cells.ts [out.png]
import sharp from 'sharp';
import { CELL_KINDS, CELL_PX, paintCell, STYLE_DIMS } from '../src/canalRecall/facadeCells.ts';
import { layoutWall } from '../src/canalRecall/facadeLayout.ts';
import { FACADE_STYLES, FACADE_STYLE_COLOURS } from '../src/canalRecall/genericFacades.ts';
import { CONTEXTUAL_BUILDING_COLOURS } from '../src/canalRecall/cityAppearancePalette.ts';
import { mutedWallHex } from '../src/canalRecall/genericFacades.ts';

const out = process.argv[2] ?? 'facade-cells.png';
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const shaded = (px: Uint8ClampedArray, i: number, tint: number[]) => {
  const a = px[i + 3] / 255;
  return [0, 1, 2].map(c => Math.round(px[i + c] * (1 + (tint[c] / 255 - 1) * a)));
};

const store = new Map<string, Uint8ClampedArray>();
// Row per style: three cells side by side, then a 2-bay x 3-storey wall with a door.
const SCALE = 1;
const bayPx = 200;
const rows = FACADE_STYLES.length;
const colsPx = CELL_KINDS.length * CELL_PX + 20 + 3 * bayPx + 40;
const sheet = Buffer.alloc(colsPx * rows * CELL_PX * 3, 245);
FACADE_STYLES.forEach((style, row) => {
  const tint = hex(mutedWallHex(CONTEXTUAL_BUILDING_COLOURS[FACADE_STYLE_COLOURS[style][0]]));
  const put = (x: number, y: number, rgb: number[]) => { const i = ((row * CELL_PX + y) * colsPx + x) * 3; sheet[i] = rgb[0]; sheet[i + 1] = rgb[1]; sheet[i + 2] = rgb[2]; };
  CELL_KINDS.forEach((kind, k) => {
    const px = paintCell(style, kind, Number(process.env.VARIANT ?? 0));
    for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) put(k * CELL_PX + x, CELL_PX - 1 - y, shaded(px, (y * CELL_PX + x) * 4, tint));
  });
  // Composed wall: 3 bays wide, ground row (door in bay `door`), then 2 storeys; scale to fit the row.
  const dims = STYLE_DIMS[style];
  const layout = layoutWall(style, dims.bay * 3, dims.ground + dims.storey * 2, 0.1)!;
  const x0 = CELL_KINDS.length * CELL_PX + 20, widthPx = 3 * bayPx;
  const totalM = layout.groundM + layout.storeys * layout.storeyM, ppm = (CELL_PX - 8) / totalM;
  const doors = new Set(layout.doorBays);
  for (let sy = 0; sy < Math.round(totalM * ppm); sy++) for (let sx = 0; sx < widthPx; sx++) {
    const my = (sy + 0.5) / ppm, bay = Math.min(layout.bays - 1, Math.floor(sx / bayPx)), u = (sx % bayPx) / bayPx;
    const ground = my < layout.groundM;
    const kind = ground ? (doors.has(bay) ? 'door' : 'ground') : 'upper';
    const v = ground ? my / layout.groundM : ((my - layout.groundM) / layout.storeyM) % 1;
    const px = cache(style, kind);
    const ix = Math.min(CELL_PX - 1, Math.floor(u * CELL_PX)), iy = Math.min(CELL_PX - 1, Math.floor(v * CELL_PX));
    put(x0 + sx, CELL_PX - 4 - Math.round(my * ppm) + 0, shaded(px, (iy * CELL_PX + ix) * 4, tint));
  }
});
function cache(style: (typeof FACADE_STYLES)[number], kind: (typeof CELL_KINDS)[number]) {
  const key = `${style}/${kind}`;
  let v = store.get(key); if (!v) store.set(key, v = paintCell(style, kind, Number(process.env.VARIANT ?? 0))); return v;
}
await sharp(sheet, { raw: { width: colsPx, height: rows * CELL_PX, channels: 3 } }).png().toFile(out);
console.log('wrote', out, colsPx, 'x', rows * CELL_PX);
