// Lane 1: the row-front records the browser reads with `?rowFront=1` (houseLine/rowFront.ts loadRowFrontRecords).
// Lane 2's table (traces included) through the one adapter, plus lane 1's interim skyline read, written as the
// renderer's own slim records, so the page fetches ~1/10 of the table and runs no adapter.
//
//   node --import tsx scripts/house-line/row-front/publish-browser.ts \
//     [--table data/front-records/haarlemmerdijk-block.json] [--interim scripts/house-line/row-front/haarlemmerdijk-interim.json] \
//     [--out public/data/front-records/row-front.json]
import fs from 'node:fs';
import path from 'node:path';
import { rowFrontsFromFile, ROW_FRONT_BROWSER_PATH } from '../../../src/canalRecall/houseLine/rowFront.ts';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const table = opt('table', 'data/front-records/haarlemmerdijk-block.json');
const interimFile = opt('interim', 'scripts/house-line/row-front/haarlemmerdijk-interim.json');
const out = opt('out', path.join('public', ROW_FRONT_BROWSER_PATH));
const interim = read(interimFile);
const records = rowFrontsFromFile(read(table), interim.records ?? interim);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ schema: 'row-front-v1', source: [table, interimFile], records }) + '\n');
console.log(`${records.length} records -> ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KiB), ${records.filter(r => r.windows?.length).length} with traced windows`);
