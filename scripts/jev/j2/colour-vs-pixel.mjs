/** J2 colour: compare Jev's swatch choice, the H5 pixel brick hex (nearest swatch), and the hand label. node scripts/jev/j2/colour-vs-pixel.mjs */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE} from './lib.mjs';
import {A} from './labels.mjs';
const SW = {near_black_painted: '#2b2b2e', dark_brown_brick: '#4a3a34', red_brown_brick: '#8a4a3c', orange_brick: '#b8643c', pale_salmon_brick: '#c9937f', tan_yellow_brick: '#c4a574', white_plaster: '#e8e4da', grey_stone: '#8a8d8f'};
const COL = {nb: 'near_black_painted', db: 'dark_brown_brick', rb: 'red_brown_brick', ob: 'orange_brick', ps: 'pale_salmon_brick', ty: 'tan_yellow_brick', wp: 'white_plaster', gs: 'grey_stone'};
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const nearest = h => Object.entries(SW).map(([k, v]) => [k, Math.hypot(...rgb(v).map((x, i) => x - rgb(h)[i]))]).sort((a, b) => a[1] - b[1])[0][0];
const sets = JSON.parse(await fs.readFile(path.join(CACHE, 'sets.json'), 'utf8'));
let n = 0, jev = 0, pix = 0, both = 0, pixWrongJevRight = 0, jevWrongPixRight = 0, bothWrong = 0, jevSwitched = 0;
const rows = [];
for (const [i, p] of sets.A.entries()) {
  const spec = JSON.parse(await fs.readFile(`scripts/house-specs/generated/AB07/${p}.json`, 'utf8')), hex = spec.spec?.design?.palette?.brick;
  const j = JSON.parse(await fs.readFile(path.join(CACHE, 'runs/colour/r1', `${p}.json`), 'utf8')).response.answers.wall_colour.choice;
  if (!hex) continue;
  const t = COL[A[i].colour], px = nearest(hex); n++;
  const jr = j === t, pr = px === t; jev += jr; pix += pr; both += jr && pr; pixWrongJevRight += jr && !pr; jevWrongPixRight += pr && !jr; bothWrong += !jr && !pr; jevSwitched += j !== px;
  rows.push({i, hex, pixel: px, jev: j, truth: t});
}
console.log({n, jevAcc: +(jev / n).toFixed(3), pixelAcc: +(pix / n).toFixed(3), both, jevRightPixelWrong: pixWrongJevRight, pixelRightJevWrong: jevWrongPixRight, bothWrong, jevDiffersFromPixel: jevSwitched});
console.log('pixel-wrong, Jev-right:', rows.filter(r => r.jev === r.truth && r.pixel !== r.truth).map(r => `A${r.i} ${r.hex} px:${r.pixel} truth:${r.truth}`));
console.log('Jev-wrong, pixel-right:', rows.filter(r => r.pixel === r.truth && r.jev !== r.truth).map(r => `A${r.i} ${r.hex} jev:${r.jev} truth:${r.truth}`));
