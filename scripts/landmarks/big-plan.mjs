// Usage: node scripts/landmarks/big-plan.mjs <id> <out.png> [scale=14]
// Plan view of a large building's 3DBAG walls: each wall segment labelled "index:topHeight", colour by height. North is up.
import fs from 'node:fs';
import sharp from 'sharp';
const [id, out, scale = '14'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const S = +scale, xs = src.nativeRing.map(p => p[0]), zs = src.nativeRing.map(p => p[1]);
const x0 = Math.min(...xs) - 8, z0 = Math.min(...zs) - 8, W = (Math.max(...xs) - x0 + 8) * S, H = (Math.max(...zs) - z0 + 8) * S;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="white"/>`;
svg += `<polygon points="${src.nativeRing.map(p => `${(p[0] - x0) * S},${(p[1] - z0) * S}`).join(' ')}" fill="#eee" stroke="black"/>`;
src.surfaces.forEach((s, i) => {
  if (s.type !== 'WallSurface') return;
  const r = s.rings[0], ys = r.map(p => p[1]);
  if (Math.max(...ys) < 1) return;
  let a = r[0], b = r[0], best = 0;
  for (const p of r) for (const q of r) { const d = Math.hypot(p[0] - q[0], p[2] - q[2]); if (d > best) { best = d; a = p; b = q; } }
  if (best < 2) return;
  const hmax = Math.max(...ys);
  svg += `<line x1="${(a[0] - x0) * S}" y1="${(a[2] - z0) * S}" x2="${(b[0] - x0) * S}" y2="${(b[2] - z0) * S}" stroke="hsl(${Math.min(hmax, 30) * 10},80%,40%)" stroke-width="4"/>`;
  svg += `<text x="${((a[0] + b[0]) / 2 - x0) * S}" y="${((a[2] + b[2]) / 2 - z0) * S}" font-size="13" fill="blue">${i}:${hmax.toFixed(0)}</text>`;
});
svg += `<text x="10" y="20" font-size="16">N up; x east, y south; ${id}</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);
