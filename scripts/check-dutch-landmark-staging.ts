// Lane N1 (#323) unit check on the staged Dutch landmark facts: every new textNl
// has an nl.wikipedia URL and evidence, is not the English sentence, is a whole
// sentence, and the cached article really contains it.
//   npx tsx scripts/check-dutch-landmark-staging.ts
import fs from 'node:fs';
import { matchFact, splitSentences } from '../src/canalRecall/facts/dutchSentenceMatch.ts';

const DIR = 'public/data/extracts/amsterdam';
const staged = JSON.parse(fs.readFileSync(`${DIR}/staging/facts.dutch-20261109.json`, 'utf8'));
const published = JSON.parse(fs.readFileSync(`${DIR}/facts.json`, 'utf8'));
// The fetched articles live in the ignored .cache; without them the containment check is skipped.
const articles: Record<string, { url: string; text: string } | null> | null = fs.existsSync('.cache/n1/articles.json') ? JSON.parse(fs.readFileSync('.cache/n1/articles.json', 'utf8')) : null;
const pub = new Map<string, any>(published.features.map((f: any) => [f.id, f]));
const flat = (s: string) => s.replace(/\s+/g, ' ');
const problems: string[] = [];
let added = 0;

// matcher unit cases
const sample = splitSentences('Een zin. De Westerkerk is gebouwd in 1620 naar ontwerp van Hendrick de Keyser in Amsterdam.\n== Kop ==\nDit is een andere zin over de ca. 12 meter hoge toren in 1631.');
if (sample.some(s => s.startsWith('==')) || sample.length !== 2) problems.push(`splitSentences: ${JSON.stringify(sample)}`);
if (!matchFact('Hendrick de Keyser designed the Westerkerk in 1620.', sample)) problems.push('matchFact missed an obvious match');
if (matchFact('A bridge opened in 1999 near Utrecht.', sample)) problems.push('matchFact matched an unrelated sentence');

for (const feature of staged.features) {
  const before = pub.get(feature.id);
  feature.facts.forEach((fact: any, i: number) => {
    if (!fact.textNl || before?.facts[i]?.textNl) return;
    added += 1;
    const tag = `${feature.name}: ${fact.textNl.slice(0, 40)}`;
    if (!/^https:\/\/nl\.wikipedia\.org\/wiki\//.test(fact.textNlSourceUrl || '')) problems.push(`no nl URL: ${tag}`);
    if (!fact.textNlEvidence) problems.push(`no evidence: ${tag}`);
    if (fact.textNl === fact.text) problems.push(`Dutch equals English: ${tag}`);
    if (!/[.!?…]["”’)]?$/.test(fact.textNl)) problems.push(`not a whole sentence: ${tag}`);
    const art = articles?.[feature.id];
    if (articles && (!art || !flat(art.text).includes(fact.textNl))) problems.push(`not in the cached nl article: ${tag}`);
    if (art && art.url !== fact.textNlSourceUrl) problems.push(`URL differs from article: ${tag}`);
  });
  if (feature.openingNl && feature.openingNl === feature.opening) problems.push(`opening is English: ${feature.name}`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`staged Dutch landmark facts OK: ${added} new sentences checked`);
