// Usage: node scripts/landmarks/roof-heightmap.mjs <id> <out.png> [pxPerM=8]
// Plan heightmap of the 3DBAG LoD2.2 roof surfaces in scripts/landmarks/<id>-footprints.json (native x east, z south,
// heights above ground): colour by height (blue low .. red high), black contour every 2 m, white every 10 m, a 5 m grid
// labelled in native metres, and the BAG ring. For reading roof intent (ridges, eaves, towers) off the survey.
import fs from 'node:fs';
import sharp from 'sharp';
const [id, out, pxArg = '8'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const S = +pxArg, xs = src.nativeRing.map(p => p[0]), zs = src.nativeRing.map(p => p[1]);
const x0 = Math.floor(Math.min(...xs) / 5) * 5 - 5, z0 = Math.floor(Math.min(...zs) / 5) * 5 - 5;
const x1 = Math.ceil(Math.max(...xs) / 5) * 5 + 5, z1 = Math.ceil(Math.max(...zs) / 5) * 5 + 5;
const W = Math.round((x1 - x0) * S), H = Math.round((z1 - z0) * S);
const hm = new Float32Array(W * H).fill(NaN);
let top = 0;
for (const s of src.surfaces) {
  if (s.type !== 'RoofSurface') continue;
  const r = s.rings[0];
  // fan triangulation is fine for the (convex-ish) planar roof faces; use ear-free fan from vertex 0
  for (let i = 1; i < r.length - 1; i++) {
    const [a, b, c] = [r[0], r[i], r[i + 1]];
    const minx = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) * S)), maxx = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) * S));
    const minz = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) * S)), maxz = Math.min(H - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - z0) * S));
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-9) continue;
    for (let pz = minz; pz <= maxz; pz++) for (let px = minx; px <= maxx; px++) {
      const X = x0 + (px + .5) / S, Z = z0 + (pz + .5) / S;
      const u = ((b[2] - c[2]) * (X - c[0]) + (c[0] - b[0]) * (Z - c[2])) / den, v = ((c[2] - a[2]) * (X - c[0]) + (a[0] - c[0]) * (Z - c[2])) / den, w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const y = u * a[1] + v * b[1] + w * c[1], j = pz * W + px;
      if (!(hm[j] >= y)) hm[j] = y;
      top = Math.max(top, y);
    }
  }
}
const rgb = Buffer.alloc(W * H * 3, 255);
for (let j = 0; j < W * H; j++) {
  const y = hm[j];
  if (Number.isNaN(y)) continue;
  const t = Math.min(1, y / Math.max(top, 1));
  const h = (1 - t) * 240, l = .55;
  const f = n => { const k = (n + h / 30) % 12, a = .8 * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  rgb[j * 3] = f(0) * 255; rgb[j * 3 + 1] = f(8) * 255; rgb[j * 3 + 2] = f(4) * 255;
  const px = j % W, pz = (j / W) | 0;
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const k = (pz + dz) * W + px + dx;
    if (px + dx >= W || pz + dz >= H || Number.isNaN(hm[k])) continue;
    if (Math.floor(y / 10) !== Math.floor(hm[k] / 10)) rgb.fill(255, j * 3, j * 3 + 3);
    else if (Math.floor(y / 2) !== Math.floor(hm[k] / 2)) rgb.fill(0, j * 3, j * 3 + 3);
  }
}
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
for (let x = x0; x <= x1; x += 5) svg += `<line x1="${(x - x0) * S}" y1="0" x2="${(x - x0) * S}" y2="${H}" stroke="#888" stroke-width="${x % 10 ? .5 : 1}"/><text x="${(x - x0) * S + 2}" y="12" font-size="11">${x}</text>`;
for (let z = z0; z <= z1; z += 5) svg += `<line x1="0" y1="${(z - z0) * S}" x2="${W}" y2="${(z - z0) * S}" stroke="#888" stroke-width="${z % 10 ? .5 : 1}"/><text x="2" y="${(z - z0) * S - 2}" font-size="11">${z}</text>`;
svg += `<polygon points="${src.nativeRing.map(p => `${(p[0] - x0) * S},${(p[1] - z0) * S}`).join(' ')}" fill="none" stroke="black" stroke-width="1.5"/>`;
svg += `<text x="${W / 2}" y="${H - 6}" font-size="14">${id}: top ${top.toFixed(1)} m; contours 2 m (black), 10 m (white); N up</text></svg>`;
await sharp(rgb, {raw: {width: W, height: H, channels: 3}}).composite([{input: Buffer.from(svg)}]).png().toFile(out);
// Print a coarse height table (every 2 m) for numeric reading.
console.log(out, 'top', top.toFixed(1));
