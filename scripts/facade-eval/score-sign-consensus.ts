/**
 * Score the sign vote against hand-transcribed crops.
 *
 * `signConsensus.ts` was built and tuned against the readings themselves, which
 * is exactly the mistake that produced confident wrong verdicts in the roofline
 * and opening-detector lanes: a signal judged against no independent reference.
 * This is that reference. Each crop in `review-data/sign-gold/v1` was
 * transcribed by looking at it, without consulting reader output, so the two are
 * independent.
 *
 * The comparison that matters is not "is the vote good" but "is the vote better
 * than doing nothing", so every run reports both:
 *
 *   baseline   the longest reading in each cluster, which is what a pipeline
 *              without a vote would publish
 *   consensus  the voted string
 *
 * A name counts as recovered when some published sign matches it after case and
 * punctuation folding. A published string matching neither a name nor the
 * crop's other legible text is an invention, and is the number that governs how
 * broadly tier 2 can ship.
 *
 * Usage: npx tsx scripts/facade-eval/score-sign-consensus.ts [--verbose]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { consensusSigns, type SignReading } from '../../src/canalRecall/facade/signConsensus.ts';

const VERBOSE = process.argv.includes('--verbose');
const GOLD = 'review-data/sign-gold/v1/transcriptions.json';
const CACHE = '.cache/facade-eval';

interface Crop { surfaceId: string; names: string[]; alsoLegible: string[]; comment?: string }
const gold = JSON.parse(readFileSync(GOLD, 'utf8')) as { crops: Crop[] };

const records = new Map<string, any>();
for (const file of readdirSync(CACHE).filter(f => f.startsWith('vision-ocr-') && f.endsWith('.json'))) {
  try {
    const doc = JSON.parse(readFileSync(`${CACHE}/${file}`, 'utf8'));
    for (const record of doc.records ?? []) if (record.surfaceId) records.set(record.surfaceId, record);
  } catch { /* a partial cache file is not a reason to fail the score */ }
}

const fold = (text: string) => text.toUpperCase().replace(/[^0-9A-ZÀ-ɏ]+/g, '');

/** Close enough to be the same words, allowing a fifth of the characters to be wrong. */
function matches(published: string, truth: string): boolean {
  const a = fold(published);
  const b = fold(truth);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const distance = (() => {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = current;
    }
    return previous[b.length];
  })();
  return distance <= Math.floor(0.2 * Math.max(a.length, b.length));
}

interface Tally { recovered: number; exact: number; invented: number; published: number }
const empty = (): Tally => ({ recovered: 0, exact: 0, invented: 0, published: 0 });
const baseline = empty();
const consensus = empty();
let expectedNames = 0;

for (const crop of gold.crops) {
  const record = records.get(crop.surfaceId);
  if (!record?.signs?.length) { console.log(`  (no cached readings for ${crop.surfaceId})`); continue; }
  const readings: SignReading[] = record.signs.map((s: any) => ({
    text: s.text, confidence: s.confidence, box: s.boxWallM, viewId: record.surfaceId, year: record.year ?? null,
  }));
  const signs = consensusSigns(readings);
  expectedNames += crop.names.length;

  const sets = {
    baseline: signs.map(sign => sign.variants.slice().sort((a, b) => fold(b).length - fold(a).length)[0]),
    consensus: signs.map(sign => sign.text),
  };

  for (const [label, published] of Object.entries(sets)) {
    const tally = label === 'baseline' ? baseline : consensus;
    tally.published += published.length;
    for (const name of crop.names) {
      if (published.some(text => matches(text, name))) tally.recovered += 1;
      if (published.some(text => fold(text) === fold(name))) tally.exact += 1;
    }
    for (const text of published) {
      const real = [...crop.names, ...crop.alsoLegible].some(truth => matches(text, truth));
      if (!real) tally.invented += 1;
    }
  }

  if (VERBOSE) {
    console.log(`\n${crop.surfaceId}`);
    console.log(`  truth      ${JSON.stringify(crop.names)}`);
    console.log(`  baseline   ${JSON.stringify(sets.baseline)}`);
    console.log(`  consensus  ${JSON.stringify(sets.consensus)}`);
  }
}

const line = (label: string, t: Tally) =>
  `  ${label.padEnd(10)} recovered ${String(t.recovered).padStart(2)}/${expectedNames}`
  + `   exact ${String(t.exact).padStart(2)}/${expectedNames}`
  + `   invented ${String(t.invented).padStart(3)}/${t.published}`;

console.log(`\n${gold.crops.length} transcribed crops, ${expectedNames} names to recover\n`);
console.log(line('baseline', baseline));
console.log(line('consensus', consensus));
console.log('\n"recovered" allows a fifth of the characters to be wrong; "exact" does not.');
console.log('"invented" counts published strings matching no legible text in the crop.');
