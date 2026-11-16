/**
 * The node frame's fidelity study (lane node-world-frames): for each house:frames folder with a browser
 * likeness.png and a node likeness.node.png (node-frame.ts), per-pixel dE, sky IoU and edge IoU at 1440 x 900, and a
 * blind sheet for a judge: photo | A | B, A and B the two frames in an order drawn from the key (the answer key goes to
 * <out>/answers.json, never onto the sheet).
 *
 *   node --import tsx scripts/house-frames/node-frame-fidelity.ts <house:frames out dir> [--sheets <dir>]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { compareFrames } from '../../src/canalRecall/nodeFrame/compare.ts';

const dir = process.argv[2];
const si = process.argv.indexOf('--sheets'), sheets = si > 0 ? process.argv[si + 1] : path.join(dir, 'blind');
fs.mkdirSync(sheets, { recursive: true });
const raw = async (f: string, w: number, h: number) => { const { data, info } = await sharp(f).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { width: info.width, height: info.height, data: new Uint8Array(data), channels: 3 }; };
const rows: Record<string, unknown>[] = [], answers: Record<string, { A: string; B: string }> = {};
for (const key of fs.readdirSync(dir).sort()) {
  const k = path.join(dir, key), browser = ['likeness.png', 'aerial.png'].map(f => path.join(k, f)).find(f => fs.existsSync(f));
  const node = ['likeness.node.png', 'aerial.node.png'].map(f => path.join(k, f)).find(f => fs.existsSync(f));
  if (!browser || !node) continue;
  const W = 1440, H = Math.round(1440 * (await sharp(browser).metadata()).height! / (await sharp(browser).metadata()).width!);
  const d = compareFrames(await raw(browser, W, H), await raw(node, W, H));
  const nj = JSON.parse(fs.readFileSync(node.replace(/\.png$/, '.json'), 'utf8'));
  rows.push({ key, ...Object.fromEntries(Object.entries(d).map(([a, b]) => [a, +b.toFixed(3)])), cpuMs: nj.timings?.cpu, totalMs: nj.timings?.total });
  // Blind sheet: the order is fixed by the key's hash, so a rerun keeps it.
  const nodeFirst = createHash('sha1').update(key).digest()[0] % 2 === 0;
  answers[key] = nodeFirst ? { A: 'node', B: 'browser' } : { A: 'browser', B: 'node' };
  const photo = ['likeness-photo.jpg', 'photo.jpg'].map(f => path.join(k, f)).find(f => fs.existsSync(f));
  const h = 600, tiles = [photo, nodeFirst ? node : browser, nodeFirst ? browser : node].filter(Boolean) as string[];
  const bufs = await Promise.all(tiles.map(f => sharp(f).resize({ height: h }).toBuffer({ resolveWithObject: true })));
  let x = 0; const comp = bufs.map(b => { const c = { input: b.data, left: x, top: 0 }; x += b.info.width + 8; return c; });
  await sharp({ create: { width: x - 8, height: h, channels: 3, background: '#ffffff' } }).composite(comp).jpeg({ quality: 85 }).toFile(path.join(sheets, `${key}.jpg`));
}
fs.writeFileSync(path.join(dir, 'answers.json'), JSON.stringify(answers, null, 1));
fs.writeFileSync(path.join(dir, 'fidelity.json'), JSON.stringify(rows, null, 1));
console.log('| key | mean dE | p90 dE | >10 dE | sky IoU | edge IoU | cpu ms |\n|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.key} | ${r.meanDE} | ${r.p90DE} | ${r.shareOver10} | ${r.skyIoU} | ${r.edgeIoU} | ${r.cpuMs} |`);
