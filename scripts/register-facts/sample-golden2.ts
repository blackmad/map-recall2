// Stratified golden batches for the remaining records (register-recipes lane): excludes records already in the golden,
// prints golden-shaped rows (parsed values, to be hand-checked against the text) with a running index.
//   npx tsx scripts/register-facts/sample-golden2.ts <perClass> [maxLen] > batch.jsonl
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseRegisterFacts } from '../../src/canalRecall/facade/registerFacts.ts';
const per = Number(process.argv[2] ?? 23), maxLen = Number(process.argv[3] ?? 560);
const golden = new Set((JSON.parse(readFileSync('fixtures/registerFacts.golden.json', 'utf8')).records as any[]).map(g => g.nr));
const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
const recs = snap.rce.filter((r: any) => r.descriptions.length).map((r: any) => ({ nr: r.monumentNumber, text: r.descriptions.map((d: any) => d.text).join(' ').replace(/\s+/g, ' ').trim() }))
  .filter((r: any) => r.text.length < maxLen && r.text.length > 40 && !golden.has(r.nr));
const CLASSES: Record<string, RegExp> = { date: /\d{4}|X[VIX]/, type: /pakhuis|koetshuis|woonhuis|winkel|hofje|kerk|school/i, gable: /gevel|top\b/i, style: /Lodewijk|classicis|neo-|eclectisch|Amsterdamse School|empire|rococo/i, finish: /pleister|siermetsel|steen|geschilderd|baksteen/i, elements: /hijsbalk|stoep|fronton|consoles|dakkapel|attiek|festoen|luiken|roeden|pilaster|kroonlijst|erker|balkon/i, alter: /verbouwd|gewijzigd|vernieuwd|gerestaureerd/i, storeys: /verdieping|bouwla|lagen|souterrain|kelder/i, bands: /speklaag|speklagen|banden/i };
const seen = new Set<string>(); let i = 0;
for (const [k, re] of Object.entries(CLASSES)) {
  const hits = recs.filter((r: any) => re.test(r.text) && !seen.has(r.nr));
  const n = k === 'bands' ? Math.min(per, 12) : per;
  for (let j = 0; j < n; j++) {
    const r = hits[Math.floor((j + 0.37) * hits.length / n)]; if (!r || seen.has(r.nr)) continue; seen.add(r.nr);
    const f: any = parseRegisterFacts(r.nr, r.text);
    console.log(JSON.stringify({ i: i++, cls: k, nr: r.nr, text: r.text, fd: f.facadeDate ? [f.facadeDate.from, f.facadeDate.to] : null, cd: f.coreDate ? [f.coreDate.from, f.coreDate.to] : null, type: f.type?.key ?? null, gable: f.gable ?? null, finish: f.finish ?? null, style: f.style ?? [], el: f.elements.map((e: any) => e.key), storeys: f.storeys ?? null, bands: !!f.stoneBands, basement: !!f.basement }));
  }
}
