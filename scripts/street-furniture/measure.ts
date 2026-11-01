// Measurement crops for street furniture (lane #170): a narrow perspective view aimed at the object with a pixel grid,
// and the conversion from read pixel rows/columns to metres.
//
//   npx tsx scripts/street-furniture/measure.ts --at=<lng>,<lat> --pano=<pano id or nth> [--fov=30] [--pitch=-12] [--out=...]
//       writes the gridded crop; read top/bottom rows and left/right columns off it, then
//   npx tsx scripts/street-furniture/measure.ts --at=... --pano=... --fov=30 --pitch=-12 --rows=<top>,<bottom> --cols=<left>,<right>
//       prints height and width in metres at the panorama's ground distance to the object.
//
// Distance: the horizontal distance from the panorama to the record's point (API positions; the container point is
// the column centre). Height = D * (tan(e_top) - tan(e_bottom)) at the image's centre column; width = D * dx / f.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { panoBytes, pickPanos } from './pano.ts';
import { perspectiveCrop } from '../street-appearance/perspective.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SIZE = 800;

async function main(): Promise<void> {
  const [lng, lat] = arg('at').split(',').map(Number);
  const fov = Number(arg('fov', '30')), pitch = Number(arg('pitch', '-12'));
  const picks = await pickPanos(lng, lat, 2, 16);
  const p = arg('pano', '0');
  const pick = /^\d+$/.test(p) ? picks[Number(p)] : picks.find(x => x.panoId === p || x.panoId.endsWith(p));
  if (!pick) throw new Error('no panorama');
  const D = pick.distanceM, f = (SIZE / 2) / Math.tan(fov * Math.PI / 360);
  if (arg('rows')) {
    const [top, bottom] = arg('rows').split(',').map(Number), [left, right] = arg('cols', '0,0').split(',').map(Number);
    const elev = (y: number) => pitch * Math.PI / 180 + Math.atan((SIZE / 2 - y) / f);
    const h = D * (Math.tan(elev(top)) - Math.tan(elev(bottom)));
    const w = D * (right - left) / f;
    const camH = -D * Math.tan(elev(bottom));
    console.log(JSON.stringify({ panoId: pick.panoId, distanceM: D, heightM: +h.toFixed(2), widthM: +w.toFixed(2), impliedCameraHeightM: +camH.toFixed(2) }));
    return;
  }
  const jpeg = perspectiveCrop(await panoBytes(pick), pick.bearingDeg, SIZE, SIZE, fov, pitch);
  const lines: string[] = [];
  for (let v = 0; v <= SIZE; v += 25) {
    const major = v % 100 === 0;
    lines.push(`<line x1="${v}" y1="0" x2="${v}" y2="${SIZE}" stroke="${major ? '#ff0' : '#0ff'}" stroke-width="${major ? 1 : 0.5}" opacity="0.55"/>`);
    lines.push(`<line x1="0" y1="${v}" x2="${SIZE}" y2="${v}" stroke="${major ? '#ff0' : '#0ff'}" stroke-width="${major ? 1 : 0.5}" opacity="0.55"/>`);
    if (major) lines.push(`<text x="${v + 2}" y="12" font-size="11" fill="#ff0">${v}</text><text x="2" y="${v - 2}" font-size="11" fill="#ff0">${v}</text>`);
  }
  const svg = Buffer.from(`<svg width="${SIZE}" height="${SIZE}">${lines.join('')}</svg>`);
  const out = arg('out', `staging/street-furniture/measure-${pick.panoId}.jpg`);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(jpeg).composite([{ input: svg }]).jpeg({ quality: 88 }).toFile(out);
  writeFileSync(out.replace(/\.jpg$/, '.json'), JSON.stringify({ ...pick, fov, pitch, size: SIZE, focalPx: f }, null, 1));
  console.log(JSON.stringify({ ...pick, out }));
}
void main();
