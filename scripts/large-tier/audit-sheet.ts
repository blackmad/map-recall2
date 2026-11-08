// Lane blank-installs audit (#264): contact sheets of the low-glass installs, 12 rows per sheet, 4 columns:
// the installed model as the player sees it (`main`), the generic facade at the same pose (`?blankInstall=<id>`), the
// PDOK 8 cm orthophoto of the pand (footprint outlined) and a label (share, m2, verdict).
//
//   node --import tsx scripts/large-tier/audit-sheet.ts --frames=artifacts/blank-audit --out=<dir> [--verdicts=<json>]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OrthoTiles, ORTHO_ATTRIBUTION } from '../own-ground/ortho.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const FRAMES = arg('frames', 'artifacts/blank-audit'), OUT = arg('out', 'artifacts/blank-audit/sheets'), VERDICTS = arg('verdicts', '');
const MAIN = arg('main', 'main'), ALT = arg('alt', 'generic');
const spots = JSON.parse(fs.readFileSync('artifacts/large-tier/audit-spots.json', 'utf8')) as Array<{ name: string; id: string }>;
const table = new Map((JSON.parse(fs.readFileSync('artifacts/large-tier/audit-spots-table.json', 'utf8')) as any[]).map(t => [t.id, t]));
const catalogue = new Map((JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8')).models as any[]).map(m => [m.id, m]));
const verdicts: Record<string, string> = VERDICTS ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};
const only = arg('only', '');
const list = spots.filter(s => (!only || only.split(',').includes(s.name)) && fs.existsSync(`${FRAMES}/${s.name}-${MAIN}.png`));
const W = 420, H = 243, LABEL = 300, ROWS = 12;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ortho = new OrthoTiles();

async function orthoCell(id: string): Promise<Buffer> {
  const m = catalogue.get(id), fp = typeof m.footprint === 'string' ? JSON.parse(m.footprint.replace(/'/g, '"')) : m.footprint;
  const ring: number[][] = (fp.type === 'MultiPolygon' ? fp.coordinates[0][0] : fp.coordinates[0]).map((p: number[]) => toLocal(p[0], p[1]));
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), pad = 15;
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  // Fit the cell's aspect.
  const want = W / H, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < want) w = h * want; else h = w / want;
  x0 = cx - w / 2; y0 = cy - h / 2;
  const res = w / W, rgb = await ortho.crop(x0, y0, W, H, res);
  const pts = ring.map(p => `${((p[0] - x0) / res).toFixed(1)},${(H - (p[1] - y0) / res).toFixed(1)}`).join(' ');
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="none" stroke="#ff2bd6" stroke-width="2"/></svg>`;
  return sharp(Buffer.from(rgb), { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

const frame = async (file: string) => fs.existsSync(file) ? sharp(file).resize(W, H, { fit: 'cover' }).png().toBuffer()
  : sharp({ create: { width: W, height: H, channels: 3, background: '#333' } }).png().toBuffer();

fs.mkdirSync(OUT, { recursive: true });
for (let s = 0; s * ROWS < list.length; s++) {
  const rows = list.slice(s * ROWS, (s + 1) * ROWS), comps: sharp.OverlayOptions[] = [], TOP = 28;
  const head = `<svg width="${3 * W + LABEL}" height="${TOP}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="8" y="19" font-family="Helvetica" font-size="14" fill="#eee">installed (${MAIN})</text><text x="${W + 8}" y="19" font-family="Helvetica" font-size="14" fill="#eee">generic facade (${ALT})</text><text x="${2 * W + 8}" y="19" font-family="Helvetica" font-size="14" fill="#eee">orthophoto (PDOK, CC BY 4.0)</text><text x="${3 * W + 8}" y="19" font-family="Helvetica" font-size="14" fill="#eee">install / share / verdict</text></svg>`;
  comps.push({ input: Buffer.from(head), left: 0, top: 0 });
  for (const [i, spot] of rows.entries()) {
    const t = table.get(spot.id), top = TOP + i * H;
    comps.push({ input: await frame(`${FRAMES}/${spot.name}-${MAIN}.png`), left: 0, top });
    comps.push({ input: await frame(`${FRAMES}/${spot.name}-${ALT}.png`), left: W, top });
    comps.push({ input: await orthoCell(spot.id), left: 2 * W, top });
    const name = String(t.name).split(':')[0].split(' (')[0];
    const words = name.split(' '), lines: string[] = [''];
    for (const wd of words) { if ((lines[lines.length - 1] + ' ' + wd).length > 34) lines.push(wd); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + wd).trim(); }
    const v = verdicts[spot.id] ?? '';
    const label = `<svg width="${LABEL}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1b1b1b"/>`
      + `<text x="10" y="24" font-family="Helvetica" font-size="15" font-weight="bold" fill="#fff">${esc(spot.name)}</text>`
      + lines.slice(0, 4).map((l, k) => `<text x="10" y="${48 + k * 18}" font-family="Helvetica" font-size="13" fill="#ccc">${esc(l)}</text>`).join('')
      + `<text x="10" y="${140}" font-family="Helvetica" font-size="13" fill="#ccc">glass ${t.glassM2} / wall ${t.wallM2} m2 = ${t.glassShare}${t.textured ? ' (textured)' : ''}</text>`
      + `<text x="10" y="${160}" font-family="Helvetica" font-size="13" fill="#ccc">footprint ${t.footprintM.join(' x ')} m, h ${Math.round(t.height)} m</text>`
      + `<text x="10" y="${200}" font-family="Helvetica" font-size="20" font-weight="bold" fill="${v.startsWith('FLAT') ? '#ff6b6b' : v.startsWith('TEXTURED') || v.startsWith('OK') ? '#7bd88f' : '#f5c242'}">${esc(v.split(':')[0])}</text>`
      + `<text x="10" y="${222}" font-family="Helvetica" font-size="11" fill="#aaa">${esc((v.split(':')[1] ?? '').trim().slice(0, 48))}</text></svg>`;
    comps.push({ input: Buffer.from(label), left: 3 * W, top });
  }
  const file = path.join(OUT, `sheet-${String(s + 1).padStart(2, '0')}.png`);
  await sharp({ create: { width: 3 * W + LABEL, height: TOP + rows.length * H, channels: 3, background: '#000' } }).composite(comps).png().toFile(file);
  console.log(file, rows.map(r => r.name).join(' '));
}
console.log(ORTHO_ATTRIBUTION);
