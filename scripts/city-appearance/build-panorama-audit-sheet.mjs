import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { DEFAULT_AREA, selectPanoramaAudit } from './select-panorama-audit.mjs';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';

const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const area = await loadAreaConfig([`--area-config=${path.resolve(flag('area-config') ?? DEFAULT_AREA)}`]);
const selected = await selectPanoramaAudit(area, { cap: Number(flag('cap') ?? 24) });
const evidence = path.join(selected.destination, 'evidence'), manifest = JSON.parse(await fs.readFile(path.join(evidence, 'manifest.json')));
const width = 360, height = 300, columns = 4, rows = Math.ceil(manifest.records.length / columns);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const composites = [];
for (const [index, record] of manifest.records.entries()) {
  const x = index % columns * width, y = Math.floor(index / columns) * height;
  for (const [kind, top] of [['full', 44], ['ground', 170]]) {
    const image = await sharp(path.join(evidence, 'images', record.images[kind].file)).resize(350, 120, { fit: 'contain', background: '#20242a' }).jpeg({ quality: 84 }).toBuffer();
    composites.push({ input: image, left: x + 5, top: y + top });
  }
  const label = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#15181d" stroke="#59616c"/><style>text{fill:#fff;font-family:Arial,sans-serif;font-size:13px}.sub{fill:#aeb7c2;font-size:11px}</style><text x="8" y="17">${index + 1}. ${escape(record.address || record.street)}</text><text class="sub" x="8" y="34">${escape(record.id)} · ${record.wallWidthM.toFixed(1)} m</text><text class="sub" x="8" y="165">FULL</text><text class="sub" x="8" y="294">GROUND</text></svg>`;
  composites.unshift({ input: Buffer.from(label), left: x, top: y });
}
const output = path.join(selected.destination, 'source-audit-sheet.jpg');
await sharp({ create: { width: columns * width, height: rows * height, channels: 3, background: '#15181d' } }).composite(composites).jpeg({ quality: 88 }).toFile(output);
console.log(output);
