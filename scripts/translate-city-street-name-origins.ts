/**
 * Translate a city's staged street-name origins into English with a local
 * model, keeping the name guard the Amsterdam pass uses.
 *
 *   npx tsx scripts/translate-city-street-name-origins.ts --city=rotterdam [--limit=50] [--model=qwen3.5:9b]
 *
 * Reads and rewrites `<extract>/staging/street-name-origins.json` (from
 * `fetch-city-street-name-origins.ts`). Resumable: entries that already have
 * English, or were refused, are skipped; progress is saved every 25 entries.
 *
 * Each text goes through `protectNames` (the street's own name is swapped for
 * a placeholder the model cannot translate, then restored) and then
 * `droppedProperNames` as the check that it worked; a translation that lost
 * the name, came back empty, still reads as Dutch or ballooned is recorded as
 * `refused` and never published. `enSource` records the model that made each
 * entry. A local model is acceptable for this volume only with a human
 * spot-check of a sample before publishing (see publish-city-street-name-origins.ts).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanTranslatorOutput, protectNames } from './lib/translation.ts';
import { refusalReason, type StagedCityOrigin } from './lib/cityStreetNameOrigins.ts';

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const city = argument('city');
if (!city) throw new Error('--city=<id> is required');
const model = argument('model') || process.env.OLLAMA_MODEL || 'qwen3.5:9b';
const endpoint = process.env.OLLAMA_CHAT_URL || 'http://127.0.0.1:11434/api/chat';
const limit = Number(argument('limit') || Infinity);
const stagingFile = path.resolve(`public/data/extracts/${city}/staging/street-name-origins.json`);

const SYSTEM = 'You translate Dutch street-name explanations from a municipal register into plain British English. '
  + 'Translate faithfully: add nothing, omit nothing, do not explain. Keep every proper name, street name, place name '
  + 'and invented capitalised word exactly as written. Output only the translation, as one paragraph.';

async function translate(text: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          model, stream: false, think: false, options: { temperature: 0 },
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }],
        }),
      });
      if (!response.ok) throw new Error(`ollama ${response.status}`);
      const data = await response.json() as { message?: { content?: string } };
      return cleanTranslatorOutput(data.message?.content ?? '');
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return '';
}

const staged = JSON.parse(await readFile(stagingFile, 'utf8')) as { origins: StagedCityOrigin[] };
const todo = staged.origins.filter((origin) => !origin.en && !origin.refused).slice(0, limit);
process.stdout.write(`${todo.length} origins to translate with ${model}\n`);
let done = 0, refused = 0;
const started = Date.now();
const save = () => writeFile(stagingFile, `${JSON.stringify(staged, null, 1)}\n`);
for (const origin of todo) {
  const shield = protectNames(origin.nl, [origin.name]);
  const en = shield.restore(await translate(shield.text)).replace(/\s+/g, ' ').trim();
  const reason = refusalReason(origin.nl, en, origin.name);
  if (reason) { origin.refused = reason; refused++; }
  else { origin.en = en; origin.enSource = `ollama:${model}`; }
  done++;
  if (done % 25 === 0) {
    await save();
    const rate = (Date.now() - started) / done;
    process.stdout.write(`  ${done}/${todo.length} (${refused} refused), ~${Math.round(rate * (todo.length - done) / 60000)} min left\n`);
  }
}
await save();
process.stdout.write(`translated ${done - refused}, refused ${refused} → ${path.relative(process.cwd(), stagingFile)}\n`);
