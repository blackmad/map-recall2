// Usage: node scripts/landmarks/ring-plot.mjs <id> <out.png>
// Plan view of the BAG ring (blue, numbered vertices) plus the neighbouring BAG pands (grey) from PDOK, north up.
import fs from 'node:fs';
import sharp from 'sharp';
const [id, out] = process.argv.slice(2);
const f = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const [alo, ala] = f.anchor, mx = 111320 * Math.cos(ala * Math.PI / 180), my = 111320;
const loc = ([lo, la]) => [(lo - alo) * mx, (la - ala) * my];
const R = 90;
const bb = [alo - R / mx, ala - R / my, alo + R / mx, ala + R / my];
const near = (await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bb.join(',')}&f=json&limit=200`)).json()).features;
const S = 6, W = 2 * R * S, c = v => [(v[0] + R) * S, (R - v[1]) * S];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><rect width="100%" height="100%" fill="#fff"/>`;
for (const p of near) {
  const ring = p.geometry.coordinates[0].map(loc).map(c);
  const mine = p.properties.identificatie === f.bagId;
  svg += `<polygon points="${ring.map(q => q.join(',')).join(' ')}" fill="${mine ? '#cfe3ff' : '#ddd'}" stroke="${mine ? '#0050c8' : '#777'}" stroke-width="${mine ? 2 : 1}"/>`;
  if (!mine) { const q = ring[0]; svg += `<text x="${q[0]}" y="${q[1]}" font-size="11" fill="#555">${p.properties.identificatie.slice(-6)} ${p.properties.bouwjaar}</text>`; }
}
const mine = near.find(p => p.properties.identificatie === f.bagId).geometry.coordinates[0].map(loc).map(c);
mine.forEach((q, i) => { svg += `<text x="${q[0] + 3}" y="${q[1] - 3}" font-size="13" font-weight="bold" fill="#c00">${i}</text>`; });
svg += `<text x="10" y="20" font-size="16">N up, grid 10 m (${S}px/m)</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(out, W);
