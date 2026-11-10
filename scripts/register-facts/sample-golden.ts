// Stratified sample for the parser golden (#316): records per step-1 class, deterministic by monument number.
//   npx tsx scripts/register-facts/sample-golden.ts <perClass>   prints {nr, text, parsed} rows to check by hand
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseRegisterFacts } from '../../src/canalRecall/facade/registerFacts.ts';
const per = Number(process.argv[2] ?? 4);
const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
const recs = snap.rce.filter((r: any) => r.descriptions.length).map((r: any) => ({ nr: r.monumentNumber, text: r.descriptions.map((d: any) => d.text).join(' ') }))
  .filter((r: any) => r.text.length < 420);
const CLASSES: Record<string, RegExp> = { date: /\d{4}|X[VIX]/, type: /pakhuis|koetshuis|woonhuis|winkel/i, gable: /gevel/i, style: /Lodewijk|classicis|neo-|eclectisch|Amsterdamse School/i, finish: /pleister|siermetsel|steen|geschilderd/i, elements: /hijsbalk|stoep|fronton|consoles|dakkapel|attiek|festoen|luiken|roeden/i, alter: /verbouwd|gewijzigd|vernieuwd/i };
const seen = new Set<string>();
for (const [k, re] of Object.entries(CLASSES)) {
  const hits = recs.filter((r: any) => re.test(r.text) && !seen.has(r.nr));
  for (let i = 0; i < per; i++) { const r = hits[Math.floor((i + 0.5) * hits.length / per)]; if (!r) continue; seen.add(r.nr); const f: any = parseRegisterFacts(r.nr, r.text); delete f.sourceText; delete f.sourceNr;
    console.log(JSON.stringify({ cls: k, nr: r.nr, text: r.text, parsed: { fd: f.facadeDate?.term, cd: f.coreDate?.term, type: f.type?.key, gable: f.gable, style: f.style, finish: f.finish, el: f.elements.map((e: any) => e.key), alt: f.altered ? 1 : undefined } })); }
}
