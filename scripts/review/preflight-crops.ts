/** Run the crop usability preflight over cached facade crops.
 *
 * Reports how many crops are blank/flat, featureless or mostly sky, so the
 * pipeline can route them to another view or `unknown` before any model runs.
 * This is a diagnostic; it certifies nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { preflightCrop } from '../../src/canalRecall/facade/cropPreflight.ts';

const flag = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const DIR = flag('dir') ?? 'public/data/city-expansion/evidence';
const OUT = flag('out') ?? 'review-data/crop-preflight.json';
const LIMIT = Number(flag('limit') ?? 0);
const WORK_WIDTH = 64;

const files = (await fs.readdir(DIR)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).sort();
const selected = LIMIT > 0 ? files.slice(0, LIMIT) : files;

const reasons: Record<string, number> = {};
let usable = 0;
const unusable: { file: string; reasons: string[] }[] = [];
const rows: any[] = [];

for (const file of selected) {
  try {
    const decoded = await sharp(path.join(DIR, file)).greyscale().resize({ width: WORK_WIDTH }).raw().toBuffer({ resolveWithObject: true });
    const result = preflightCrop({ data: new Uint8Array(decoded.data), width: decoded.info.width, height: decoded.info.height });
    if (result.usable) usable += 1;
    else { unusable.push({ file, reasons: result.reasons }); for (const reason of result.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1; }
    rows.push({ file, usable: result.usable, reasons: result.reasons, metrics: result.metrics });
  } catch {
    unusable.push({ file, reasons: ['decode-failed'] });
    reasons['decode-failed'] = (reasons['decode-failed'] ?? 0) + 1;
  }
}

const report = { version: 1, kind: 'crop-preflight', generatedAt: new Date().toISOString(), directory: DIR, total: selected.length, usable, unusable: selected.length - usable, reasons, entries: rows };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: OUT, total: report.total, usable, unusable: report.unusable, reasons }, null, 2));
