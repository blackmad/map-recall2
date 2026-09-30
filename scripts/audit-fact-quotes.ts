/**
 * Read every published fact against the source quote it was written from, and
 * list the ones that say something the quote does not: a number the quote
 * lacks, or a capitalised name it lacks. Most hits are derived ("two days
 * later" → a date) or filled in from the article (a first name), so this is a
 * reading list for a person, not a gate. It found the inverted Python Bridge
 * sentence (see HISTORY, 2026-09-30).
 *
 * Usage: npx tsx scripts/audit-fact-quotes.ts [-- --city=amsterdam] [-- --names]
 */
import { readFileSync } from 'node:fs';
import type { FeatureFacts } from '../src/canalRecall/facts/factTypes';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const cities = argument('city') ? [argument('city')!] : ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'];
const withNames = process.argv.includes('--names');

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Numbers, with thousands separators dropped: "91,495" and "91.495" are 91495. */
const numbers = (text: string) => new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(value => value.replace(/(?<=\d)[.,](?=\d{3}\b)/g, '')));
// Capitalised words that are not names: pronouns, months, places every quote implies.
const COMMON = new Set(`The A An In It Its This That These Those He She They His Her Their Built Named Originally Today During
  After Before Since When While Although Despite Once Local Visitors Residents Designed Located Amsterdam Rotterdam Utrecht Hague
  Netherlands Dutch English German French World War January February March April May June July August September October November
  December Saint Street Church Canal Bridge Museum Park Square Palace Station Tower House Castle Island North South East West Old
  New Great Royal National City School Hotel King Queen Prince Princess Christmas Easter Catholic Protestant Jewish Reformed
  Roman Gothic Renaissance Baroque`.split(/\s+/));

let total = 0, flagged = 0;
for (const city of cities) {
  const { features } = JSON.parse(readFileSync(`public/data/extracts/${city}/facts.json`, 'utf8')) as { features: Array<FeatureFacts & { opening?: string }> };
  for (const feature of features) {
    for (const fact of feature.facts) {
      total++;
      const quote = `${fact.sourceQuote ?? ''} ${fact.sourceQuoteEnglish ?? ''} ${feature.name} ${feature.opening ?? ''}`;
      const quoted = numbers(quote);
      const missing = [...numbers(fact.text)].filter(value => !quoted.has(value) && !quoted.has(value.replace(',', '.')) && !quoted.has(value.replace('.', ',')));
      const names = withNames
        ? (fact.text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-zà-ÿ]{3,}\b/g) ?? []).filter(word => !COMMON.has(word) && !plain(quote).includes(plain(word).slice(0, -1)))
        : [];
      if (!missing.length && !names.length) continue;
      flagged++;
      process.stdout.write(`${city} · ${feature.name} [${[...missing, ...names].join(', ')}]\n  ${fact.text}\n  quote: ${(fact.sourceQuoteEnglish || fact.sourceQuote || '').slice(0, 240)}\n`);
    }
  }
}
process.stdout.write(`\n${flagged} of ${total} facts say something their quote does not${withNames ? ' (numbers and names)' : ' (numbers)'}.\n`);
