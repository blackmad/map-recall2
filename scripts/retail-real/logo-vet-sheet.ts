/** Vetting sheet: every fetched chain logo (data/retail-ground/chain-logos) on grey with its key and POI count. */
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const dir = 'data/retail-ground/chain-logos', prov = JSON.parse(fs.readFileSync(`${dir}/provenance.json`, 'utf8'));
const keys = Object.keys(prov).filter(k => fs.existsSync(`${dir}/${k}.png`)).sort();
const C = 8, W = 220, H = 120, c = createCanvas(C * W, Math.ceil(keys.length / C) * H), x = c.getContext('2d');
x.fillStyle = '#888'; x.fillRect(0, 0, c.width, c.height);
for (const [i, k] of keys.entries()) {
  const ox = (i % C) * W, oy = Math.floor(i / C) * H;
  try { const im = await loadImage(fs.readFileSync(`${dir}/${k}.png`)); const s = Math.min((W - 10) / im.width, (H - 30) / im.height); x.drawImage(im, ox + 5, oy + 5, im.width * s, im.height * s); } catch { x.fillStyle = '#f00'; x.fillText('BAD', ox + 10, oy + 40); }
  x.fillStyle = '#000'; x.font = '13px sans-serif'; x.fillText(`${k} (${prov[k].pois})`, ox + 4, oy + H - 8);
}
fs.writeFileSync(process.argv[2] ?? 'artifacts/retail-real/logo-vet.png', c.toBuffer('image/png'));
