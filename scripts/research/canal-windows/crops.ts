/**
 * List the survey crops (staging/pand-reference-walls/<bag>/reference.json) with date, size, wall length, BAG year and
 * register gable, and write staging/canal-windows/crops.json for the catalogue.
 *
 *   node --import tsx scripts/research/canal-windows/crops.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = 'staging/pand-reference-walls', pick = JSON.parse(fs.readFileSync('staging/canal-windows/pick.json', 'utf8')) as {bag: string; street: string}[];
const rows = [];
for (const bag of fs.readdirSync(root).filter(d => /^\d{16}$/.test(d)).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(root, bag, 'reference.json'), 'utf8'));
  const c = r.primary?.crop;
  rows.push({bag, street: pick.find(p => p.bag === bag)?.street, status: r.status, date: r.primary?.timestamp?.slice(0, 10), front: fs.existsSync(path.join(root, bag, 'front.jpg')), alt: fs.existsSync(path.join(root, bag, 'front-alt.jpg')),
    px: c ? `${c.width}x${c.height}` : null, wallM: r.wall?.lengthM, heightM: c?.wallHeightM, year: r.facts.buildYear, gable: r.facts.registerGableType, monument: r.facts.monument?.[0]?.name ?? ''});
}
fs.writeFileSync('staging/canal-windows/crops.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log([r.bag.slice(-6), r.street, r.year, r.status, r.date, r.px, r.wallM, r.gable, r.monument].join(' | '));
