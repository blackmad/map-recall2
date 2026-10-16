/**
 * Overlay a metre grid on a rectified crop so positions can be read off by eye: thin lines every metre, thick every five,
 * labelled with the wall coordinate (u from `--u0` at the crop's left edge, increasing by `--du` = +1 or -1 per metre to
 * the right) and the height (top edge = `--top-m`).
 *
 *   node --import tsx scripts/mercatorplein/grid.ts <crop.jpg> <out.jpg> [--ppm=50] [--top-m=32] [--u0=0] [--du=1] [--x0=0 --x1=W --y0=0 --y1=H] [--scale=1]
 */
import sharp from 'sharp';
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const [file, out] = process.argv.slice(2);
const ppm = Number(arg('ppm', '50')), topM = Number(arg('top-m', '32')), u0 = Number(arg('u0', '0')), du = Number(arg('du', '1')), scale = Number(arg('scale', '1'));
const meta = await sharp(file).metadata();
const x0 = Number(arg('x0', '0')), x1 = Number(arg('x1', String(meta.width))), y0 = Number(arg('y0', '0')), y1 = Number(arg('y1', String(meta.height)));
const W = x1 - x0, H = y1 - y0;
const lines: string[] = [];
for (let m = Math.ceil(x0 / ppm); m * ppm <= x1; m++) {
  const x = (m * ppm - x0) * scale, u = u0 + du * m, thick = Math.round(u) % 5 === 0;
  lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H * scale}" stroke="${thick ? '#ff0' : '#0ff'}" stroke-opacity="${thick ? 0.8 : 0.45}" stroke-width="${thick ? 2 : 1}"/>`);
  lines.push(`<text x="${x + 2}" y="${12}" font-size="11" fill="#ff0" font-family="monospace">${u.toFixed(0)}</text>`);
}
for (let h = Math.ceil(topM - y1 / ppm); h <= topM - y0 / ppm; h++) {
  const y = ((topM - h) * ppm - y0) * scale, thick = h % 5 === 0;
  lines.push(`<line x1="0" y1="${y}" x2="${W * scale}" y2="${y}" stroke="${thick ? '#f0f' : '#0f0'}" stroke-opacity="${thick ? 0.8 : 0.45}" stroke-width="${thick ? 2 : 1}"/>`);
  lines.push(`<text x="2" y="${y - 2}" font-size="11" fill="#f0f" font-family="monospace">${h}</text>`);
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}">${lines.join('')}</svg>`);
await sharp(file).extract({left: x0, top: y0, width: W, height: H}).resize(Math.round(W * scale), Math.round(H * scale)).composite([{input: svg}]).jpeg({quality: 88}).toFile(out);
console.log('wrote', out);
