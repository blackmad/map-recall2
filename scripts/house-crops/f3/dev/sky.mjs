import fs from 'node:fs'; import sharp from 'sharp';
import { skyline, classifySkyline } from '../../../../src/canalRecall/facade/skylineGable.ts';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(r => r.set === 'hand-set-v1').slice(0, 8);
const ARCH = '/Users/blackmad/Code/map-recall2-source-data-h5h'; const items = [];
for (const [i, r] of rows.entries()) { const f = `${ARCH}/pand-crops/${r.id}/front.jpg`; const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const c = { width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: r.ppm }; const s = skyline(c); const k = classifySkyline(c);
  const pts = s.top.map((t, x) => t === null ? '' : `${x},${info.height - t * r.ppm}`).filter(Boolean).join(' '); const out = `${process.env.TMPDIR}/sk${i}.png`;
  await sharp(f).composite([{ input: Buffer.from(`<svg width="${info.width}" height="${info.height}"><polyline points="${pts}" fill="none" stroke="red" stroke-width="2"/></svg>`) }]).png().toFile(out); items.push({ key: r.id + ' ' + r.truth + '>' + k.cls, file: out }); console.log(r.id, r.truth, k.cls, k.why, JSON.stringify(k.features)); }
fs.writeFileSync(process.env.TMPDIR + '/sk.json', JSON.stringify(items));
