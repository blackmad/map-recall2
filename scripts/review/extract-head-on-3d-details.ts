/** Local diagnostic maps from generated facade strips. No source-photo geometry acceptance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const inputDir = path.resolve('.cache/facade-assessment/banana-head-on-v1');
const outDir = path.resolve('public/data/facade-review-galleries/head-on-3d-v1');
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const analysisWidth = 1024;
type Box = {x0: number; y0: number; x1: number; y1: number; darkPixels: number};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
async function textureWithoutSky(source: Buffer, width: number, height: number) {
  const rgb = await sharp(source).removeAlpha().raw().toBuffer();
  const pixels = width * height, sky = new Uint8Array(pixels), queue = new Int32Array(pixels);
  let head = 0, tail = 0;
  const white = (i: number) => rgb[i * 3] >= 245 && rgb[i * 3 + 1] >= 245 && rgb[i * 3 + 2] >= 245;
  const visit = (i: number) => {if (!sky[i] && white(i)) {sky[i] = 1; queue[tail++] = i;}};
  for (let x = 0; x < width; x++) {visit(x); visit((height - 1) * width + x);}
  for (let y = 0; y < height; y++) {visit(y * width); visit(y * width + width - 1);}
  while (head < tail) {
    const i = queue[head++], x = i % width, y = (i / width) | 0;
    if (x) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (y) visit(i - width);
    if (y + 1 < height) visit(i + width);
  }
  const rgba = Buffer.allocUnsafe(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = sky[i] ? 0 : 255;
  }
  return {png: await sharp(rgba, {raw: {width, height, channels: 4}}).png().toBuffer(), skyPixels: tail};
}
function extract(mask: Uint8Array, width: number, height: number): Box[] {
  const seen = new Uint8Array(mask.length), boxes: Box[] = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 0, x0 = width, y0 = height, x1 = 0, y1 = 0;
    queue[tail++] = start; seen[start] = 1;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = (pixel / width) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      for (const next of [x ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
        y ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
        if (next >= 0 && mask[next] && !seen[next]) {seen[next] = 1; queue[tail++] = next;}
      }
    }
    if (tail >= 20) boxes.push({x0, y0, x1, y1, darkPixels: tail});
  }
  // Adjacent panes of one opening are separated by thin mullions. Merge only near
  // pieces with substantial projection overlap; wider masonry gaps remain separate.
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const first = boxes[a], second = boxes[b];
      const xGap = Math.max(0, first.x0 - second.x1, second.x0 - first.x1);
      const yGap = Math.max(0, first.y0 - second.y1, second.y0 - first.y1);
      const xShared = overlap(first.x0, first.x1, second.x0, second.x1);
      const yShared = overlap(first.y0, first.y1, second.y0, second.y1);
      const nearHorizontal = xGap <= 5 && yShared >= 0.65 * Math.min(first.y1 - first.y0, second.y1 - second.y0);
      const nearVertical = yGap <= 5 && xShared >= 0.65 * Math.min(first.x1 - first.x0, second.x1 - second.x0);
      if (!nearHorizontal && !nearVertical) continue;
      boxes[a] = {x0: Math.min(first.x0, second.x0), y0: Math.min(first.y0, second.y0),
        x1: Math.max(first.x1, second.x1), y1: Math.max(first.y1, second.y1),
        darkPixels: first.darkPixels + second.darkPixels};
      boxes.splice(b, 1); changed = true; break outer;
    }
  }
  return boxes.filter(box => {
    const w = box.x1 - box.x0, h = box.y1 - box.y0, fill = box.darkPixels / (w * h);
    return w >= 9 && h >= 16 && w <= width * 0.22 && h <= height * 0.42 &&
      box.y0 >= height * 0.07 && box.y1 <= height * 0.96 &&
      (h / w >= 0.55 || w >= 45) && fill >= 0.24;
  }).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

await fs.mkdir(outDir, {recursive: true});
const output = [];
for (const number of [1, 2, 3]) {
  const id = `strip${number}`;
  const receiptBytes = await fs.readFile(path.join(inputDir, `${id}.json`));
  const receipt = JSON.parse(receiptBytes.toString());
  const source = await fs.readFile(path.join(inputDir, `${id}.png`));
  const sourceInfo = await sharp(source).metadata();
  if (receipt.status !== 'ok' || receipt.pngPath !== `${id}.png` || sha(source) !== receipt.pngSha256 ||
      sourceInfo.width !== receipt.width || sourceInfo.height !== receipt.height)
    throw Error(`Generated source changed for ${id}`);
  const texture = await textureWithoutSky(source, receipt.width, receipt.height);
  const {data, info} = await sharp(source).resize({width: analysisWidth, withoutEnlargement: true})
    .removeAlpha().raw().toBuffer({resolveWithObject: true});
  if (info.channels !== 3) throw Error('Expected RGB analysis image');
  const width = info.width, height = info.height;
  const dark = new Uint8Array(width * height), heights = new Uint8Array(width * height);
  for (let i = 0; i < dark.length; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const lum = (r * 54 + g * 183 + b * 19) / 256;
    const glassLike = lum >= 65 && lum <= 190 && Math.abs(r - g) < 16 &&
      Math.abs(g - b) < 21 && b >= r + 2;
    dark[i] = glassLike ? 1 : 0;
    // Neutral wall=128, darker apparent recesses and modest bright trim. This is
    // decorative bump relief only: pixel tones are not measured depth.
    heights[i] = lum > 225 ? 128 : clamp(Math.round(128 + (lum - 128) * 0.10 - (glassLike ? 28 : 0)), 65, 175);
  }
  const boxes = extract(dark, width, height);
  const candidates = boxes.map((box, i) => ({id: `${id}-candidate-${i + 1}`,
    kind: 'dark-glazing-candidate', status: 'unverified-heuristic',
    boundsAnalysisPx: [box.x0, box.y0, box.x1, box.y1],
    normalizedTopLeft: [box.x0 / width, box.y0 / height, box.x1 / width, box.y1 / height],
    uvBottomLeft: [box.x0 / width, 1 - box.y1 / height, box.x1 / width, 1 - box.y0 / height],
    darkPixelFraction: Number((box.darkPixels / ((box.x1 - box.x0) * (box.y1 - box.y0))).toFixed(3))}));
  // The 3D viewer receives only plausible upper-floor windows. Candidate JSON
  // retains lower storefront/door shapes for inspection, without extruding them.
  const features = candidates.filter(candidate => {
    const [x0, y0, x1, y1] = candidate.normalizedTopLeft;
    const w = x1 - x0, h = y1 - y0;
    return y1 <= 0.77 && h / w >= 0.8 && w <= 0.10;
  }).slice(0, 100).map(candidate => ({id: candidate.id,
    kind: 'window-recess-approximation', status: 'unverified-heuristic',
    normalizedBounds: candidate.normalizedTopLeft}));
  const bump = await sharp(heights, {raw: {width, height, channels: 1}}).png().toBuffer();
  const originalName = `${id}-texture.png`, bumpName = `${id}-bump.png`, overlayName = `${id}-candidates.png`;
  await fs.writeFile(path.join(outDir, originalName), texture.png);
  await fs.writeFile(path.join(outDir, bumpName), bump);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${boxes.map(box =>
    `<rect x="${box.x0}" y="${box.y0}" width="${box.x1 - box.x0}" height="${box.y1 - box.y0}" fill="none" stroke="#00ffea" stroke-width="2"/>`).join('')}</svg>`;
  const overlay = await sharp(source).resize({width}).composite([{input: Buffer.from(svg)}]).png().toBuffer();
  await fs.writeFile(path.join(outDir, overlayName), overlay);
  const record = {version: 1, id, policy: 'Derived from generated image only. No accepted source-photo openings, identities, geometry or metric depths.',
    source: {path: path.join(inputDir, `${id}.png`), sha256: sha(source), receiptSha256: sha(receiptBytes),
      width: receipt.width, height: receipt.height},
    analysis: {width, height, method: 'RGB near-neutral dark connected components with thin-mullion box grouping',
      glassLikeRule: 'luma 65–190, |R-G|<16, |G-B|<21, B>=R+2',
      bumpRule: 'neutral128 plus 10% luminance detail; subtract28 on glass-like pixels',
      candidateCount: candidates.length},
    artifacts: {texture: {path: originalName, sha256: sha(texture.png), skyPixelsTransparent: texture.skyPixels,
      skyRule: '4-connected from image border, every RGB channel >=245; other pixels retain source RGB and full opacity'},
      bump: {path: bumpName, sha256: sha(bump)}, overlay: {path: overlayName, sha256: sha(overlay)}},
    candidates};
  await fs.writeFile(path.join(outDir, `${id}-candidates.json`), JSON.stringify(record, null, 2) + '\n');
  const featuresName = `${id}-features.json`;
  await fs.writeFile(path.join(outDir, featuresName), JSON.stringify({version: 1, id,
    policy: 'Approximate upper-window quads inferred from generated pixels. No measured openings or georegistration.',
    sourceSha256: sha(source), coordinateFrame: 'full generated image, x-right/y-down, fractions 0..1',
    features}, null, 2) + '\n');
  output.push({id, sourceSha256: sha(source), textureSha256: sha(texture.png), skyPixelsTransparent: texture.skyPixels,
    candidateCount: candidates.length,
    featureCount: features.length, texture: originalName, bump: bumpName, overlay: overlayName,
    candidates: `${id}-candidates.json`, features: featuresName});
}
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({version: 1,
  policy: 'Unaccepted generated facade diagnostic for three visual comparison arms; not a BAG georegistration or measured facade texture.',
  uvContract: 'candidate normalizedTopLeft is x-right/y-down; uvBottomLeft is WebGL x-right/y-up. Texture and bump share full generated-image UVs.',
  strips: output}, null, 2) + '\n');
console.log(JSON.stringify({outDir, strips: output}));
