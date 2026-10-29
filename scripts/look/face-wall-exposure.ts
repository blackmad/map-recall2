// Per-face wall exposure check for faces that are not installed yet (the numbers build-chunk-wall-exposure.ts would
// record once they are): the light-trim white and stripOverDrawn = lin(strip wall) / lin(drawn wall), per pand and the
// face median. A face whose median sits far from 1 draws its walls at the wrong tone for its photo; the sunny look then
// rescales the luminance, but not the hue (De Pijp's Bol 40-54: pale buff fronts drawn as orange brick, ~1.9).
//   node --import tsx scripts/look/face-wall-exposure.ts <face> [<face> ...]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureStripPalette} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {swatch} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {hexToRgb} from '../../src/canalRecall/look/palette.ts';
import {drawnWallLuma} from '../../src/canalRecall/look/drawnWall.ts';
import {srgbToLinear} from '../../src/canalRecall/look/sunny.ts';

const FACES = 'scripts/block-face/faces';
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const med = (a: number[]) => { const s = a.filter(Number.isFinite).sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
for (const face of process.argv.slice(2)) {
  const dir = path.join(FACES, face), strip = JSON.parse(fs.readFileSync(path.join(dir, 'strip.json'), 'utf8'));
  const file = [strip.image, `staging/block-face/${face}/strip.jpg`].find(f => f && fs.existsSync(f));
  if (!file) { console.log(`${face}: no strip image`); continue; }
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const intents = houseIntents(validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members));
  const rows: string[] = [], ratios: number[] = [], frames: number[][] = [];
  for (const s of strip.spans) {
    const facts = path.join(dir, 'pands', s.pandId, 'facts.json'), h = fs.existsSync(facts) ? JSON.parse(fs.readFileSync(facts, 'utf8')).heights : null;
    const p = measureStripPalette({rgb, width: info.width, height: info.height, x0: s.px[0], x1: s.px[1], pixelsPerMetre: strip.pixelsPerMetre, eavesM: h?.eavesM ?? h?.dak70pM ?? 14});
    const intent = intents.find(i => i.pandId === s.pandId);
    if (!intent) continue;
    const brick = (intent.palette.wallMaterial ?? 'brick') !== 'stucco';
    const drawn = drawnWallLuma({...intent.palette, brick: swatch(intent.palette.brick)});
    const wall = p.wall && !p.stucco && brick && p.shares.wall >= 0.3 ? luma(hexToRgb(p.wall)) : NaN;
    const ratio = srgbToLinear(wall) / srgbToLinear(drawn);
    if (p.frame) frames.push(hexToRgb(p.frame));
    ratios.push(ratio);
    rows.push(`  ${s.pandId.slice(-6)} wall ${p.wall ?? '-'} drawn ${intent.palette.brick} (${intent.palette.wallMaterial ?? 'brick'}) frame ${p.frame ?? '-'} ratio ${Number.isFinite(ratio) ? ratio.toFixed(2) : '-'}`);
  }
  const white = frames.length ? [0, 1, 2].map(i => Math.round(med(frames.map(f => f[i])))) : null;
  console.log(`${face}: stripOverDrawn ${white ? med(ratios).toFixed(3) : '- (no white)'} | white ${white?.join(',') ?? '-'}`);
  rows.forEach(r => console.log(r));
}
