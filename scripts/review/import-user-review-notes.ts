/** Import user review notes into a durable development set + failure taxonomy.
 *
 * The review-notes router writes to disposable `.cache`. Human review is project
 * data, so this copies the newest notes file to `review-data/` and classifies
 * each note so recurring failures can be prioritised.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const NOTES_DIR = '.cache/city-appearance/repair-preview-notes';
const OUT = 'review-data/user-review-2026-09-21.json';

const files = (await fs.readdir(NOTES_DIR)).filter((name) => name.endsWith('.json'));
if (!files.length) throw Error('No review-note files found');
const stats = await Promise.all(files.map(async (name) => ({ name, mtime: (await fs.stat(path.join(NOTES_DIR, name))).mtimeMs })));
stats.sort((a, b) => b.mtime - a.mtime);
const source = path.join(NOTES_DIR, stats[0].name);
const document = JSON.parse(await fs.readFile(source, 'utf8'));

type Category = 'missing-door' | 'missing-storefront' | 'missing-roof' | 'missing-floor' | 'missing-other'
  | 'centering-framing' | 'colour-material' | 'roof-shape' | 'occlusion-source' | 'other' | 'good';

const CATEGORY_RULES: [Category, RegExp][] = [
  ['missing-door', /\bdoor\b|no door/i],
  ['missing-storefront', /shop|storefront|business|display/i],
  ['missing-roof', /missing roof|no roof|missing roof detail/i],
  ['missing-floor', /missing .*floor|inferred .*floor|whole floor|first floor/i],
  ['colour-material', /colou?r|brick|paint|accent|cornice|material/i],
  ['centering-framing', /cent(e|re)r|overlap|taking in|off-centre|off-center|crop/i],
  ['roof-shape', /roof/i],
  ['occlusion-source', /occlud|tree|different photo|another year|photos/i],
  ['missing-other', /missing/i],
];

const classify = (text: string): Category => {
  const trimmed = text.trim();
  const isGood = /^good\b/i.test(trimmed);
  const target = isGood ? trimmed.replace(/^good\b[,.]?\s*/i, '').trim() : trimmed;
  if (isGood && target.length === 0) return 'good';
  for (const [category, re] of CATEGORY_RULES) if (re.test(target)) return category;
  return isGood ? 'good' : 'other';
};

const entries = Object.values(document.notes ?? {}) as { caseId: string; text: string; revision: number; updatedAt: string }[];
const cases = entries.map((note) => ({ caseId: note.caseId, text: note.text, category: classify(note.text), revision: note.revision, updatedAt: note.updatedAt }));
cases.sort((a, b) => a.caseId.localeCompare(b.caseId));

const byCategory: Record<string, string[]> = {};
for (const item of cases) (byCategory[item.category] ??= []).push(item.caseId);

const report = {
  version: 1,
  kind: 'user-review-development-set',
  importedAt: new Date().toISOString(),
  source,
  releaseId: document.releaseId,
  packetSha256: document.packetSha256,
  totalCases: cases.length,
  taxonomy: byCategory,
  cases,
};
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: OUT, cases: cases.length, taxonomy: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])) }, null, 2));
