// Overlay a bay/storey grid on a rectified crop to count window axes: node grid.mjs <in.jpg> <out.jpg> <bays> [storeyLinesM comma] [ppm] [topM]
import sharp from 'sharp';
const [,, inp, out, bays, levels = '', ppm = '0', topM = '0'] = process.argv;
const img = sharp(inp), {width: w, height: h} = await img.metadata();
const n = Number(bays), lines = [];
for (let i = 0; i <= n; i++) { const x = Math.round(i * w / n); lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="red" stroke-width="2"/><text x="${x + 4}" y="20" fill="red" font-size="18">${i < n ? i : ''}</text>`); }
for (const z of levels.split(',').filter(Boolean).map(Number)) { const y = Math.round((Number(topM) - z) * Number(ppm)); lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="cyan" stroke-width="2"/>`); }
await img.composite([{input: Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`)}]).jpeg({quality: 82}).toFile(out);
