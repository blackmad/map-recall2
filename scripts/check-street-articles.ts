// Street and square Wikipedia articles reach the ride card. Named regression
// (audit 2026-10-31): Zeedijk, Waterlooplein and Sarphatistraat are routable
// streets with Dutch Wikipedia articles and had no card, because
// street-knowledge.json came only from the 500-street quiz pool.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface Entry { id?: string; name: string; type?: string; wikipediaExtract?: string; wikipediaExtractLang?: string; wikipediaUrl?: string; wikipediaImageUrl?: string }
const knowledge = JSON.parse(readFileSync('public/data/extracts/amsterdam/street-knowledge.json', 'utf8')) as Entry[];
const byName = new Map(knowledge.map(e => [e.name.toLowerCase(), e]));
for (const name of ['Zeedijk', 'Waterlooplein', 'Sarphatistraat', 'Lindengracht', 'Kerkstraat', 'Reguliersdwarsstraat']) {
  const entry = byName.get(name.toLowerCase());
  assert.ok(entry, `${name} has a street card`);
  assert.ok(entry.wikipediaExtract && entry.wikipediaExtract.length >= 40, `${name} card has a lede`);
  assert.ok(!entry.wikipediaExtractLang || entry.wikipediaExtractLang === 'en', `${name} lede is English`);
  assert.match(entry.wikipediaUrl ?? '', /wikipedia\.org\/wiki\//, `${name} links its article`);
  assert.ok(entry.wikipediaExtract!.length <= 400, `${name} lede is card-sized`);
}
const fromArticles = knowledge.filter(e => String(e.id ?? '').startsWith('article_streets_'));
assert.ok(fromArticles.length >= 600, `street articles merged into the knowledge file (${fromArticles.length})`);
const dutch = fromArticles.filter(e => e.wikipediaExtractLang && e.wikipediaExtractLang !== 'en');
assert.ok(dutch.length <= 5, `street article ledes are English (${dutch.length} still Dutch: ${dutch.slice(0, 5).map(e => e.name).join(', ')})`);
// A street the quiz pool already cards is not duplicated by an article entry.
const names = new Map<string, number>();
for (const e of knowledge) if (e.type === 'street') names.set(e.name.toLowerCase(), (names.get(e.name.toLowerCase()) ?? 0) + 1);
const duplicates = [...names.entries()].filter(([, n]) => n > 1);
assert.equal(duplicates.length, 0, `one street card per name (${duplicates.slice(0, 5).map(([n]) => n).join(', ')})`);
process.stdout.write(`Street article checks passed (${fromArticles.length} article cards)\n`);
