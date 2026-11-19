/**
 * Design-units gate sheets (2026-11-19): one JPEG per block and device from house:frames' per-pand triple.jpg
 * (photo | today | designUnits=1), stacked in list order under a caption. Input: artifacts/design-units/gate/<device>/after/<key>/;
 * output: artifacts/design-units/gate/sheets/<device>-<key>.jpg. Usage: node --import tsx scripts/design-units/gate-sheets.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const G = 'artifacts/design-units/gate', OUT = path.join(G, 'sheets'), W = 1800;
fs.mkdirSync(OUT, { recursive: true });
const caption = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="40"><rect width="100%" height="100%" fill="#222"/><text x="10" y="27" font-family="Helvetica" font-size="22" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const report: Record<string, { framed: number; missing: string[] }> = {};
for (const device of ['desktop', 'iphone']) {
  for (const list of fs.readdirSync(path.join(G, 'lists')).filter(f => f.endsWith('.json')).sort()) {
    const key = list.replace(/\.json$/, ''), ids: string[] = JSON.parse(fs.readFileSync(path.join(G, 'lists', list), 'utf8')).map((x: string | { pandId: string }) => typeof x === 'string' ? x : x.pandId);
    const dir = path.join(G, device, 'after', key), parts: Array<{ input: Buffer; top: number; left: number }> = [];
    let y = 0;
    const missing: string[] = [];
    parts.push({ input: await sharp(caption(`${key} (${device}): photo | today (?world=live) | designUnits=1`, W)).png().toBuffer(), top: 0, left: 0 }); y += 40;
    for (const id of ids) {
      const f = path.join(dir, id, 'triple.jpg');
      if (!fs.existsSync(f)) { missing.push(id); continue; }
      const img = await sharp(f).resize({ width: W }).jpeg().toBuffer(), h = (await sharp(img).metadata()).height!;
      parts.push({ input: await sharp(caption(id.slice(-6), W)).png().toBuffer(), top: y, left: 0 }); y += 40;
      parts.push({ input: img, top: y, left: 0 }); y += h;
    }
    report[`${device}/${key}`] = { framed: ids.length - missing.length, missing };
    if (parts.length < 2) continue;
    await sharp({ create: { width: W, height: y, channels: 3, background: '#ffffff' } }).composite(parts).jpeg({ quality: 78 }).toFile(path.join(OUT, `${device}-${key}.jpg`));
  }
}
console.log(JSON.stringify(report));
