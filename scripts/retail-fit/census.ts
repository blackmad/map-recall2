// Retail-fit census (lane retail-fit-20261120): every shop pand the game hosts a front on (shop-templates.json and
// shopfronts.json), classified by what the building's own ground storey already is, and what draws there today.
//
//   bespoke-landmark  a hand-built GLB (manualCatalogue non-ordinary, signature models): the shown model hides the pand,
//                     so the template front hidden with it; the tenant is invisible (Hirschgebouw: uniform arcade glass)
//   block-face        a chunk-face GLB (one model over a block face): same, hidden
//   recipe-house      an ordinary-buildings catalogue GLB: same, hidden; the recipe brings its own ground floor
//   building-type     an instanced building-type kit: same, hidden
//   hand-front        a measured landmark front (landmarkFrontData / storefrontSpecs): the template is suppressed
//   ground-floor      a ground-floors.json record: inset mode under ?groundFloor=1, template fascia otherwise
//   monument          a Rijksmonument (monument-facts.json), split by whether the register names its pui
//   plain             none of the above: the template front on the generated wall
//
// Usage: npx tsx scripts/retail-fit/census.ts [--out=artifacts/retail-fit/census.json]
import fs from 'node:fs';
import { FRONT_LIST as LANDMARK_FRONTS } from '../../src/canalRecall/landmarkFrontData.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg('out') ?? 'artifacts/retail-fit/census.json';
const X = 'public/data/extracts/amsterdam';
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const short = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');

const tpl = read(`${X}/shop-templates.json`) as { templates: string[]; buildings: Record<string, [number, number, number, string?, number?]> };
const fronts = read(`${X}/shopfronts.json`) as { kinds: string[]; buildings: Record<string, number> };
const gf = read(`${X}/ground-floors.json`).buildings as Record<string, { openings: { head: string; kind: string }[] }>;
const mon = read(`${X}/monument-facts.json`).buildings as Record<string, { nr: string; elements?: { key: string; term: string }[]; type?: { key: string } }>;
const covers = read('public/canal-drive/models/covers.json') as { models: Record<string, { p: string[] }>; buildingTypes: string[] };
const manual = new Map((read('src/canalRecall/landmarks/manualCatalogue.json') as Array<{ id: string; name: string; category?: string }>).map(m => [m.id, m]));
const ordinary = new Map((read('public/canal-drive/ordinary-buildings-data/catalogue.json').models as Array<{ id: string; name: string }>).map(m => [m.id, m]));

type Host = 'bespoke-landmark' | 'block-face' | 'recipe-house' | 'building-type' | 'hand-front' | 'ground-floor' | 'monument-pui' | 'monument' | 'plain';
const model = new Map<string, { id: string; host: Host; name: string }>();
for (const [id, m] of Object.entries(covers.models)) {
  const man = manual.get(id), ord = ordinary.get(id);
  const host: Host = id.startsWith('chunk-face') ? 'block-face' : ord || man?.category === 'ordinary' ? 'recipe-house' : 'bespoke-landmark';
  for (const p of m.p) if (!model.has(p) || host === 'bespoke-landmark') model.set(p, { id, host, name: man?.name ?? ord?.name ?? id });
}
const types = new Set(covers.buildingTypes);
const hand = new Map<string, string>();
for (const f of LANDMARK_FRONTS) for (const id of f.ids) if (id.startsWith('NL.IMBAG')) hand.set(short(id), f.name);

const shops = new Map<string, { template?: string; word?: string; kind?: string }>();
for (const [id, row] of Object.entries(tpl.buildings)) shops.set(short(id), { template: tpl.templates[row[0]], ...(row[3] ? { word: row[3] } : {}) });
for (const [id, k] of Object.entries(fronts.buildings)) { const s = short(id), r = shops.get(s) ?? {}; shops.set(s, { ...r, kind: fronts.kinds[k] }); }

type Row = { pand: string; host: Host; model?: string; modelName?: string; template?: string; word?: string; kind?: string; monument?: string; registerPui?: boolean; gfHeads?: string[]; today: string };
const rows: Row[] = [];
for (const [pand, s] of shops) {
  const m = model.get(pand), mo = mon[`NL.IMBAG.Pand.${pand}`], pui = !!mo?.elements?.some(e => e.key === 'shopfront');
  const host: Host = m ? m.host : types.has(pand) ? 'building-type' : hand.has(pand) ? 'hand-front' : gf[pand] ? 'ground-floor' : mo ? (pui ? 'monument-pui' : 'monument') : 'plain';
  const today = m || types.has(pand) ? 'model shown, pand hidden: no tenant (the model\'s own ground storey, every opening alike)'
    : hand.has(pand) ? 'measured hand front; template suppressed'
    : host === 'ground-floor' ? 'template fascia by default; tenant in the record\'s openings under ?groundFloor=1'
    : s.template ? 'template front (fascia box, pui, goods) on the generated wall' : 'cell-painted shop bays (shopfronts.json kind)';
  rows.push({ pand, host, ...(m ? { model: m.id, modelName: m.name } : {}), ...s, ...(mo ? { monument: mo.nr, registerPui: pui } : {}), ...(gf[pand] ? { gfHeads: gf[pand].openings.map(o => o.head) } : {}), today });
}
const by = <K extends string>(f: (r: Row) => K) => rows.reduce((acc, r) => { const k = f(r); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {} as Record<string, number>);
const summary = {
  shopPands: rows.length, withTemplate: rows.filter(r => r.template).length,
  byHost: by(r => r.host),
  templatesByHost: by(r => (r.template ? r.host : 'no-template') as string),
  hiddenTenants: rows.filter(r => r.model || r.host === 'building-type').length,
  monumentsWithTemplate: rows.filter(r => r.monument && r.template && !r.model).length,
  registerPuiWithTemplate: rows.filter(r => r.registerPui && r.template && !r.model).length,
};
fs.mkdirSync('artifacts/retail-fit', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows: rows.sort((a, b) => a.host.localeCompare(b.host) || a.pand.localeCompare(b.pand)) }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const h of ['bespoke-landmark', 'block-face', 'recipe-house'] as Host[]) {
  console.log(`\n${h}:`); for (const r of rows.filter(r => r.host === h).slice(0, 60)) console.log(`  ${r.pand} ${r.modelName} — ${r.template ?? r.kind}${r.word ? ` "${r.word}"` : ''}`);
}
