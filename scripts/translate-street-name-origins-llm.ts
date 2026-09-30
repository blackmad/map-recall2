/**
 * A second English for the street-name origins, from a language model through
 * OpenRouter, to replace the on-device `trn` translations.
 *
 * Why: `trn` translates sentence by sentence with no idea what the text is
 * about, so it renders words, not meaning. Reading turned up hundreds of
 * literal slips ("vaste brug" as "permanent bridge", "Meer" as "More",
 * "buurtschap" as "neighbourhood", the Eerste Kamer as "the House of
 * Representatives"); see HISTORY, 2026-09-30. `ORIGIN_GLOSSARY` patches the
 * ones found, but most are not found yet. A model told what the texts are,
 * and warned of the traps found so far, translates the meaning.
 *
 * Resumable like the `trn` pass. Results go to
 * `scripts/street-name-origin-translations-llm.json`, keyed by the same hash
 * as `street-name-origin-translations.json` (name + Dutch). Each distinct
 * Dutch text is translated once. `publish:street-name-origins` prefers this
 * file where it has an entry.
 *
 * Usage: OPENROUTER_API_KEY=… npx tsx scripts/translate-street-name-origins-llm.ts
 *          [-- --limit=40] [-- --model=anthropic/claude-opus-5.5] [-- --batch=12]
 *          [-- --concurrency=6] [-- --names=Rokin,Singel]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = argument('model') || 'anthropic/claude-opus-5.5';
const limit = Number(argument('limit') || Infinity);
const batchSize = Math.max(1, Number(argument('batch') || 12));
const concurrency = Math.max(1, Number(argument('concurrency') || 6));
const onlyNames = argument('names')?.split(',').map(name => name.trim()).filter(Boolean);
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('OPENROUTER_API_KEY is required');

const sourceFile = path.resolve('scripts/street-name-origin-translations.json');
const cacheFile = path.resolve(argument('cache') || 'scripts/street-name-origin-translations-llm.json');

interface SourceEntry { name: string; hash: string; nl?: string; en: string; source: string }
export interface LlmEntry { name: string; hash: string; nlHash: string; en: string; source: string }

const sha = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

export const SYSTEM_PROMPT = `You translate Dutch explanations of Amsterdam street, bridge and water names into English for a geography-learning game. Each text explains the name given as "name". Readers are English speakers learning the city.

Rules:
- Translate faithfully and completely. Do not add facts, drop sentences, summarise, or "correct" the source. Keep every year and number exactly.
- Write natural, plain English, not word-for-word Dutch. Rebuild Dutch sentence order where English needs it.
- Keep Dutch proper names as they are: streets, canals, bridges, locks (Hoge Sluis, Oranjesluizen), buildings (Paleis voor Volksvlijt, Tolhuis), districts, polders, institutions, ships, titles of books and plays. Where a Dutch title or term matters, you may add a short English gloss in parentheses once, e.g. 'Afke's tiental' (Afke's ten). Never translate a name into an English word ("Hoge Sluis" is not "High Lock").
- The name being explained must appear exactly as written wherever the Dutch uses it.
- Keep Dutch words that are the point of the explanation (the word the street is named after), with the English meaning, e.g. "A bongerd is an orchard".
- "Rb." or "Rb. 21-3-1894" means a council decision (raadsbesluit) of that date; write "council decision of 21 March 1894".
- Output English spelling of dates ("21 March 1894").
- If a Dutch sentence is clumsy, still produce a clean English sentence with the same meaning; never leave inserted clauses like "Despite her, by her upbringing determined, ...".

Terms the previous machine translation got wrong. Use a meaning below only when that Dutch word is actually in the text; never bring a term, or anything it implies, into a text that does not contain it:
vaste brug = fixed bridge (not movable), ophaalbrug = drawbridge/lift bridge, basculebrug = bascule bridge; buurtschap = hamlet; gehucht = hamlet; kern (of a municipality) = village; meer = lake; plas = lake; zijrivier = tributary; waterstroom = stream; wetering = drainage canal (keep the name); tocht = drainage channel; vaart = canal; zeegat = tidal inlet; stroomgeul = tidal channel; zeestraat = strait; kwelder = salt marsh; aanslibbing = silting; aangeplempt = built up with fill / reclaimed; gedempt = filled in (a canal); droogmakerij = drained lake; afzanding = land dug out for sand; oeverafslag = erosion of the bank; inlaagdijk = a dike set back behind the original one; kadijk = quay dike; uitspanning = roadside inn; herenhuis = country house / mansion; hofstede = country estate; buitenplaats / buiten = country house (estate); ridderhofstad = knightly manor; edelmanshuis = nobleman's house; geamoveerd = demolished; vernoemd in X = renamed X; vervallen (of a street name) = abolished; Eerste Kamer = Senate; Tweede Kamer = House of Representatives; wethouder = alderman; vroedschap = city council; burgemeester (historic) = burgomaster; baljuw = bailiff; schout = sheriff; jonkheer = jonkheer (not baron); predikant = minister (clergyman); onderwijzer = primary-school teacher; leraar = teacher; waterbouwkundige = hydraulic engineer; natuurkundige = physicist; toonkunstenaar = musician; graficus = graphic artist; geuzen = Sea Beggars (geuzenkapitein = Sea Beggar captain); knokploeg = armed resistance squad; bonkaarten = ration cards; gefusilleerd = executed by firing squad; zwaarden (on a ship) = leeboards; walvisachtige = cetacean; breeuwer = caulker; laken = woollen cloth (not linen); lakenverver = cloth dyer; passeren (leather) = dressing Spanish leather; huidenhandel = hide trade; kuiperij = cooperage; geschut = ordnance, guns (not gunpowder); schepraderen = paddle wheels; spinnaker is set before the wind (downwind); koolwaterstof = hydrocarbon; paddensoort = toad species; plant families: anjerfamilie = pink family, schermbloemenfamilie = carrot (umbellifer) family, vlinderbloemfamilie = pea family, composietenfamilie = daisy family, ranonkelfamilie = buttercup family, kruisbloemigen = cabbage family, sterbladigen = bedstraw family, helmkruidfamilie = figwort family, lipbloemigen = mint family, heidefamilie = heath family; gierzwaluw = swift; goudvink = bullfinch; distelvink/putter = goldfinch; tuimelaar = bottlenose dolphin; lepelaar = spoonbill; eidereend = eider; mees = tit; vossenbes = lingonberry; klaproos/papaver = poppy; kaasjeskruid = mallow; monnikskap = monkshood; zilverschoon = silverweed; Naar ... (at the start) = Named after ...; Herinnert aan = Recalls; onder (a village) = near / in the municipality of.

Answer with JSON only: {"translations":[{"id":"...","en":"..."}]} with one entry per input id.`;

async function translateBatch(items: Array<{ id: string; name: string; nl: string }>): Promise<Map<string, string>> {
  const body = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ texts: items }) },
    ],
  };
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const raw = data.choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, '');
      const parsed = JSON.parse(raw) as { translations: Array<{ id: string; en: string }> };
      return new Map(parsed.translations.map(entry => [String(entry.id), String(entry.en || '').trim()]));
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/** Years and numbers of the Dutch, all present in the English. */
export function keepsNumbers(nl: string, en: string): boolean {
  const numbers = (text: string) => (text.match(/\d{3,4}/g) ?? []);
  const english = new Set(numbers(en));
  return numbers(nl).every(value => english.has(value));
}

const source = JSON.parse(await readFile(sourceFile, 'utf8')) as SourceEntry[];
let cache: LlmEntry[] = [];
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) as LlmEntry[]; } catch { /* first run */ }
const doneByNl = new Map(cache.map(entry => [entry.nlHash, entry]));
const cachedHashes = new Set(cache.map(entry => entry.hash));

// Distinct Dutch texts still missing, with the first name that uses each.
const pending = new Map<string, { id: string; name: string; nl: string; entries: SourceEntry[] }>();
for (const entry of source) {
  if (!entry.nl || cachedHashes.has(entry.hash)) continue;
  if (onlyNames && !onlyNames.includes(entry.name)) continue;
  const nlHash = sha(entry.nl);
  const done = doneByNl.get(nlHash);
  if (done) { cache.push({ ...done, name: entry.name, hash: entry.hash }); cachedHashes.add(entry.hash); continue; }
  const group = pending.get(nlHash) ?? { id: nlHash, name: entry.name, nl: entry.nl, entries: [] };
  group.entries.push(entry);
  pending.set(nlHash, group);
}
const groups = [...pending.values()].slice(0, limit);
const batches: typeof groups[] = [];
for (let i = 0; i < groups.length; i += batchSize) batches.push(groups.slice(i, i + batchSize));
process.stdout.write(`${groups.length} distinct Dutch texts to translate in ${batches.length} batches with ${model}\n`);

let translated = 0, refused = 0, since = 0;
const save = () => writeFile(cacheFile, `${JSON.stringify(cache.sort((a, b) => a.name.localeCompare(b.name, 'nl')), null, 1)}\n`);
let next = 0;
async function worker() {
  while (next < batches.length) {
    const batch = batches[next++];
    let results: Map<string, string>;
    try {
      results = await translateBatch(batch.map(({ id, name, nl }) => ({ id, name, nl })));
    } catch (error) {
      process.stdout.write(`batch failed: ${String(error).slice(0, 200)}\n`);
      refused += batch.length;
      continue;
    }
    for (const group of batch) {
      const en = results.get(group.id) ?? '';
      if (!en || !keepsNumbers(group.nl, en)) { refused++; process.stdout.write(`refused ${group.name}\n`); continue; }
      for (const entry of group.entries) cache.push({ name: entry.name, hash: entry.hash, nlHash: group.id, en, source: model });
      translated++;
    }
    if ((since += batch.length) >= 60) { since = 0; await save(); process.stdout.write(`${translated} translated, ${refused} refused\n`); }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
await save();
process.stdout.write(`done: ${translated} translated, ${refused} refused; ${cache.length} entries in ${path.relative(process.cwd(), cacheFile)}\n`);
