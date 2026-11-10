/**
 * Contact sheets for the suppressed-face audit (issue #341). Run after suppressed-faces.ts and the preview rows exist.
 *   --rows (default): the top 20 blank walls and the three stops-short examples, one row each: the preview framed on the
 *                     flagged wall (scripts/house-preview/preview.ts --wall <edge>: front and 3/4), labelled with route,
 *                     class, edge and landmark placement offset. Writes artifacts/house-audit/contact-rows-1.jpg and -2.jpg.
 *   --ride:           the game's own chase frames of the audit spots (tests/e2e/demo-shots.spec.ts, names audit-*), read from
 *                     artifacts/house-audit/ride. Writes artifacts/house-audit/contact-ride.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const HELP = `node --import tsx scripts/house-audit/contact-sheet.ts [--rows] [--ride]

Builds the audit's contact sheets from artifacts/house-audit/suppressed-faces.json and the frames under
artifacts/house-audit/sheet2 (preview rows) and artifacts/house-audit/ride (ride frames). Writes contact-rows.jpg and
contact-ride.jpg in artifacts/house-audit.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dir = path.join(ROOT, 'artifacts/house-audit');
const TILE = 360, H = 300, LABEL = 46, COLS = 2;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** One frame, scaled into a TILE x H box, with its label above it. */
async function tile(file: string, label: string[]): Promise<Buffer> {
  const img = await sharp(file).resize({ width: TILE, height: H, fit: 'inside', background: '#f4f1ea' }).flatten({ background: '#f4f1ea' }).jpeg({ quality: 72 }).toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${LABEL}"><rect width="100%" height="100%" fill="#f4f1ea"/>${label.map((t, i) => `<text x="4" y="${14 + i * 15}" font-family="Helvetica" font-size="12" fill="#222">${esc(t)}</text>`).join('')}</svg>`);
  return sharp({ create: { width: TILE, height: H + LABEL, channels: 3, background: '#f4f1ea' } })
    .composite([{ input: svg, left: 0, top: 0 }, { input: img, left: 0, top: LABEL }]).jpeg({ quality: 72 }).toBuffer();
}

/** Lay tiles out COLS to a row under a one-line title, and write the JPEG. Returns its size in bytes. */
async function grid(out: string, title: string, tiles: Buffer[]): Promise<number> {
  const rows = Math.ceil(tiles.length / COLS), rowH = H + LABEL + 6, TITLE = 36;
  const W = COLS * TILE, HT = TITLE + rows * rowH;
  const titleSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TITLE}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="6" y="24" font-family="Helvetica" font-size="15" fill="#222">${esc(title)}</text></svg>`);
  const placed = [{ input: titleSvg, left: 0, top: 0 }, ...tiles.map((t, i) => ({ input: t, left: (i % COLS) * TILE, top: TITLE + Math.floor(i / COLS) * rowH }))];
  await sharp({ create: { width: W, height: HT, channels: 3, background: '#f4f1ea' } }).composite(placed).jpeg({ quality: 72 }).toFile(out);
  return fs.statSync(out).size;
}

async function rows(): Promise<void> {
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'suppressed-faces.json'), 'utf8'));
  const list = [
    ...report.top20RidePriority.map((w: Record<string, unknown>, i: number) => ({ w, tag: `blank ${String(i + 1).padStart(2, '0')}`, key: `blank-${String(i + 1).padStart(2, '0')}` })),
    ...report.stopsShortTop.map((w: Record<string, unknown>, i: number) => ({ w, tag: `stops-short ${String(i + 1).padStart(2, '0')}`, key: `short-${String(i + 1).padStart(2, '0')}` })),
  ];
  const tiles: Buffer[] = [];
  for (const { w, tag, key } of list) {
    const pand = String(w.pand), model = String(w.model), kind = String(w.kind);
    const d = path.join(dir, 'sheet2', `${key}-${pand.slice(-6)}`);
    const meas = JSON.parse(fs.readFileSync(path.join(d, 'measure.json'), 'utf8'));
    const route = String(meas.route ?? '');
    const off = report.landmarkPlacementCheck?.[model]?.offsetM;
    const lab = [`${tag}: ${pand} ${w.street} ${w.lengthM} m edge ${w.edge} (${w.cls})`, `${model}  route ${route.split(' ')[0]}${kind === 'landmark' && route.startsWith('generic') ? ': landmark not drawn' : ''}`, kind === 'landmark' ? `landmark placement offset ${off ?? 'n/a'} m` : 'chunk/ordinary placement'];
    tiles.push(await tile(path.join(d, 'front.png'), [...lab, 'front, framed on the wall']));
    tiles.push(await tile(path.join(d, 'threeq.png'), [...lab, '3/4 view']));
  }
  // Two sheets of 12 rows each, to stay under the screenshots repo's 400 kB limit.
  const PER = 12 * COLS;
  for (let part = 0; part * PER < tiles.length; part++) {
    const name = `contact-rows-${part + 1}.jpg`, slice = tiles.slice(part * PER, (part + 1) * PER);
    const bytes = await grid(path.join(dir, name), `Suppressed-face audit (#341): blank walls (rows 1-20) and stops-short examples (1-3); each preview framed on the flagged wall. Sheet ${part + 1}`, slice);
    console.log(`wrote ${name}: ${slice.length / COLS} rows, ${bytes} bytes`);
  }
}

async function ride(): Promise<void> {
  const d = path.join(dir, 'ride');
  const files = fs.readdirSync(d).filter(f => f.endsWith('.png')).sort();
  const tiles: Buffer[] = [];
  for (const f of files) tiles.push(await tile(path.join(d, f), [f.replace(/\.png$/, ''), 'game chase frame, fixed pose']));
  const bytes = await grid(path.join(dir, 'contact-ride.jpg'), 'Ride frames (chase camera, fixed pose): audit spots', tiles);
  console.log(`wrote contact-ride.jpg: ${files.length} frames, ${bytes} bytes`);
}

async function main() {
  if (process.argv.includes('--help')) { console.log(HELP); return; }
  if (process.argv.includes('--ride')) await ride();
  else await rows();
}
main().catch(e => { console.error(e); process.exit(1); });
