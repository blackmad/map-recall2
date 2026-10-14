/**
 * Photo | model | overlay sheet for one per-house recipe, at the rectified crop's scale (canal-window survey, 2026-10-14).
 *
 *   node --import tsx scripts/research/canal-windows/sheet.ts --house=<id> [--ground=<m>] [--caption=<text>] [--crop=staging/pand-reference-walls/<bag>] [--out=artifacts/canal-windows/<id>/sheet.png]
 * The photo is the intent's first source image (front.jpg or front-alt.jpg).
 *
 * Needs artifacts/building-recipes/<id>/{model.glb,report.json} (scripts/building-recipes/compile.ts --house=<id>).
 * The model is rendered orthographically along the crop's wall normal, x = the crop wall from start to end, y = 0 at
 * the crop's ground line, so the 50 % overlay shows window by window where the kit departs from the photo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderModels, closeRenderer} from '../../building-recipes/render.ts';
import {lngLatToRd} from '../../pand-reference/core.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function houseSheet(id: string, cropDir: string, out: string, caption = '', groundM = 0, alt = false) {
  const ref = JSON.parse(await fs.readFile(path.join(cropDir, 'reference.json'), 'utf8'));
  const report = JSON.parse(await fs.readFile(path.join('artifacts/building-recipes', id, 'report.json'), 'utf8'));
  const crop = (alt ? ref.alt : ref.primary).crop, ppm = crop.pixelsPerMetre, W = crop.width, H = crop.height;
  const a = lngLatToRd(ref.wall.startLngLat), b = lngLatToRd(ref.wall.endLngLat), anchor = report.anchorRD as number[];
  const la = [a.x - anchor[0], anchor[1] - a.y], lb = [b.x - anchor[0], anchor[1] - b.y];
  const len = Math.hypot(lb[0] - la[0], lb[1] - la[1]), u = [(lb[0] - la[0]) / len, (lb[1] - la[1]) / len];
  // Camera right must run start -> end: right = forward x up, so the outward normal is (-uz, ux).
  const nrm = [-u[1], u[0]], widthM = W / ppm, heightM = H / ppm;
  // The crop spans the wall (plus any margin) centred on its midpoint; ground at the bottom edge.
  const mid = [(la[0] + lb[0]) / 2, (la[1] + lb[1]) / 2];
  // `groundM`: where the street lies on the crop (metres above its bottom edge; the crop's ground estimate can sit 1-4 m low).
  const cy = heightM / 2 - groundM;
  const [model] = await renderModels([{file: path.join('artifacts/building-recipes', id, 'model.glb')}], [{eye: [mid[0] + nrm[0] * 200, cy, mid[1] + nrm[1] * 200], target: [mid[0], cy, mid[1]], fov: 30, width: W, height: H,
    ortho: [-widthM / 2, widthM / 2, heightM / 2, -heightM / 2], background: '#9fb8cf', noGround: true}]);
  await closeRenderer();
  const photo = await sharp(path.join(cropDir, alt ? 'front-alt.jpg' : 'front.jpg')).resize(W, H, {fit: 'fill'}).png().toBuffer();
  const modelPng = await sharp(model).resize(W, H, {fit: 'fill'}).png().toBuffer();
  // 50 % mix, pixel by pixel (the render already carries an opaque alpha channel, so ensureAlpha would not thin it).
  const [pr, mr] = await Promise.all([photo, modelPng].map(b => sharp(b).removeAlpha().raw().toBuffer()));
  const mix = Buffer.alloc(pr.length);
  for (let i = 0; i < pr.length; i++) mix[i] = (pr[i] + mr[i]) >> 1;
  const overlay = await sharp(mix, {raw: {width: W, height: H, channels: 3}}).png().toBuffer();
  // Three panels side by side, scaled so the sheet is 1280 px wide (read at 640 px in the gallery).
  const panelW = 420, scale = panelW / W, panelH = Math.round(H * scale), head = 40, foot = caption ? 56 : 0;
  const panels = await Promise.all([photo, modelPng, overlay].map(p => sharp(p).resize(panelW, panelH).png().toBuffer()));
  const titles = [`photo ${(alt ? ref.alt : ref.primary).timestamp?.slice(0, 10) ?? ''} (Gemeente Amsterdam, CC BY 4.0)`, `model · ${report.triangles} tris`, '50 % overlay'];
  const sheetW = panelW * 3 + 20, sheetH = panelH + head + foot;
  const svg = `<svg width="${sheetW}" height="${sheetH}"><style>text{font-family:Helvetica,Arial}</style>
    <text x="8" y="17" font-size="15" font-weight="bold" fill="#1f2328">${esc(id)}</text>
    ${titles.map((t, i) => `<text x="${i * (panelW + 10) + 4}" y="35" font-size="12" fill="#444">${esc(t)}</text>`).join('')}
    ${caption ? caption.match(/.{1,190}(\s|$)/g)!.slice(0, 3).map((line, i) => `<text x="8" y="${head + panelH + 16 + i * 16}" font-size="12" fill="#1f2328">${esc(line.trim())}</text>`).join('') : ''}</svg>`;
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp({create: {width: sheetW, height: sheetH, channels: 3, background: '#f4f4f2'}})
    .composite([...panels.map((input, i) => ({input, left: i * (panelW + 10), top: head})), {input: Buffer.from(svg), left: 0, top: 0}]).png().toFile(out);
  return out;
}

if (process.argv[1]?.endsWith('canal-windows/sheet.ts')) {
  const id = arg('house');
  if (!id) throw Error('--house=<id>');
  const intent = JSON.parse(await fs.readFile(path.join('scripts/building-recipes/houses', id, 'intent.json'), 'utf8'));
  const cropDir = arg('crop') ?? path.dirname(intent.sources[0].image);
  console.log(await houseSheet(id, cropDir, arg('out') ?? `artifacts/canal-windows/${id}/sheet.png`, arg('caption') ?? '', Number(arg('ground') ?? 0), intent.sources[0].image.endsWith('front-alt.jpg')));
}
