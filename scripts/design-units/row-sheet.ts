/**
 * Design-unit row sheet (phase 1 iteration, Node only): one street row drawn today and under DESIGN_UNITS=1, as a front
 * elevation over the same stated front line (scripts/house-preview/preview.ts --wall line:…), stacked over the photo
 * strip when one is given. The browser stays out of the loop until the rows read right.
 *
 *   node --import tsx scripts/design-units/row-sheet.ts <row> [--photo <jpg>]
 *
 * Rows: ROWS below (front line left to right as seen from the street; a pand on it). Writes
 * artifacts/design-units/rows/<row>/{today,flag}/front.png + measure.json and <row>/sheet.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const ROWS: Record<string, { title: string; pand: string; units: string[]; line: [number, number, number, number] }> = {
  'van-ostadestraat': { title: 'Van Ostadestraat (ring 8815, 8794, 8792, 8793; 1901-1904)', pand: '0363100012153176', units: ['du:ring:8815', 'du:ring:8794', 'du:ring:8792', 'du:ring:8793'], line: [4.886872, 52.351586, 4.887972, 52.351732] },
  'rustenburgerstraat': { title: 'Rustenburgerstraat (ring 8276, 8275, 8274; 1896)', pand: '0363100012119632', units: ['du:ring:8276', 'du:ring:8275', 'du:ring:8274'], line: [4.896539, 52.352101, 4.895828, 52.352001] },
};
const argv = process.argv.slice(2);
const row = argv[0], photo = argv.includes('--photo') ? argv[argv.indexOf('--photo') + 1] : null;
const def = ROWS[row];
if (!def) { console.error(`rows: ${Object.keys(ROWS).join(', ')}`); process.exit(2); }
const out = path.join(ROOT, 'artifacts/design-units/rows', row);
// Every pand of the row's units (the staged index), drawn on the line.
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/design-units/staging/design-units.json'), 'utf8')).units as Array<{ id: string; members: string[] }>;
const rowIds = idx.filter(u => def.units.includes(u.id)).flatMap(u => u.members);
const verdict: Record<string, string> = {};
for (const [cond, env] of [['today', {}], ['flag', { DESIGN_UNITS: '1' }]] as const) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/house-preview/preview.ts', def.pand, '--wall', `line:${def.line.join(',')}`, '--out', path.join(out, cond)],
    { cwd: ROOT, env: { ...process.env, ...env, PREVIEW_ROW_IDS: rowIds.join(',') }, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
  verdict[cond] = (r.stdout.match(/render: (.*)/) ?? [])[1] ?? '';
}
const label = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="34"><rect width="100%" height="100%" fill="#222"/><text x="10" y="23" font-family="Helvetica" font-size="18" fill="#eee">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const strips: Array<{ file: string; text: string }> = [];
if (photo) strips.push({ file: photo, text: 'photo' });
strips.push({ file: path.join(out, 'today/front.png'), text: `today: ${verdict.today}` }, { file: path.join(out, 'flag/front.png'), text: `designUnits=1: ${verdict.flag}` });
const W = Math.max(...(await Promise.all(strips.map(s => sharp(s.file).metadata()))).map(m => m.width ?? 0));
const comps: sharp.OverlayOptions[] = [{ input: label(def.title, W), left: 0, top: 0 }];
let y = 40;
for (const s of strips) {
  const img = await sharp(s.file).resize({ width: W, withoutEnlargement: false }).png().toBuffer();
  const h = (await sharp(img).metadata()).height ?? 0;
  comps.push({ input: label(s.text, W), left: 0, top: y }, { input: img, left: 0, top: y + 34 });
  y += 34 + h + 10;
}
fs.mkdirSync(out, { recursive: true });
await sharp({ create: { width: W, height: y, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 85 }).toFile(path.join(out, 'sheet.jpg'));
console.log(path.relative(ROOT, path.join(out, 'sheet.jpg')), JSON.stringify(verdict));
