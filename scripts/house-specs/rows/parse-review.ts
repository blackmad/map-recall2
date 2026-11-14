/** node --import tsx scripts/house-specs/rows/parse-review.ts <answer.txt> [--houses 110,108,...]  prints the verdict; exit 1 unless pass or pass-with-fails */
import fs from 'node:fs';
import { parseReview, formatReview } from '../../../src/canalRecall/houseSpec/rowReview.ts';
const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('usage: parse-review.ts <answer.txt> [--houses a,b,c]'); process.exit(2); }
const hi = rest.indexOf('--houses');
const r = parseReview(fs.readFileSync(file, 'utf8'), hi >= 0 ? rest[hi + 1].split(',') : undefined);
console.log(formatReview(r));
process.exit(r.verdict === 'pass' || r.verdict === 'pass-with-fails' ? 0 : 1);
