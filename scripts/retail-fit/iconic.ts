// Lane retail-fit: the iconic street-level retail list joined to what the game draws there today, ranked for later lanes.
// Input: the verified research list (scripts/retail-fit/iconic-research.json: OSM, Wikidata, RCE numbers, current status
// with source URLs; open data and the businesses' own pages only). For each item: the pand under its point (building
// tiles), the model that hides it (covers.json), a measured hand front, a shop template, the market extract, the
// nearest routable street (ride visibility), then a score and the suggested route.
//   npx tsx scripts/retail-fit/iconic.ts [--in=scripts/retail-fit/iconic-research.json] [--out=docs/reports/iconic-retail-20261120.json]
import fs from 'node:fs';
import { grid, local, CELL, bagKey } from '../retail-ground/city.ts';
import { insideRing, segDist } from '../../src/canalRecall/retailHosting.ts';
import { FRONT_LIST } from '../../src/canalRecall/landmarkFrontData.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const IN = arg('in') ?? 'scripts/retail-fit/iconic-research.json', OUT = arg('out') ?? 'docs/reports/iconic-retail-20261120.json';
const X = 'public/data/extracts/amsterdam';
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const research = read(IN) as { items: Array<Record<string, any>>; sources: unknown };
const covers = read('public/canal-drive/models/covers.json') as { models: Record<string, { p: string[]; o?: string[] }>; buildingTypes: string[] };
const manual = new Map((read('src/canalRecall/landmarks/manualCatalogue.json') as Array<{ id: string; name: string; category?: string }>).map(m => [m.id, m]));
const tpl = read(`${X}/shop-templates.json`) as { templates: string[]; buildings: Record<string, [number, number, number, string?]> };
const mon = read(`${X}/monument-facts.json`).buildings as Record<string, { nr: string; elements?: { key: string }[] }>;
const markets = (read(`${X}/markets/market-lines.json`).markets as Array<{ id: string; name: string; sides: Array<{ kerb: [number, number][] }> }>);
const modelOf = new Map<string, string>();
for (const [id, m] of Object.entries(covers.models)) for (const p of [...m.p, ...(m.o ?? [])]) if (!modelOf.has(p) || !id.startsWith('chunk')) modelOf.set(p, id);
const hand = new Map<string, string>();
for (const f of FRONT_LIST) for (const id of f.ids) hand.set(bagKey(id), f.name);
// Routable streets (cycling corridor) for ride visibility.
const ways = read(`${X}/streets-routing.json`) as Array<{ highway?: string; name?: string; path: [number, number][] }>;
const segs: number[][] = [];
for (const w of ways) for (let i = 1; i < w.path.length; i++) { const a = local(w.path[i - 1][1], w.path[i - 1][0]), b = local(w.path[i][1], w.path[i][0]); segs.push([a[0], a[1], b[0], b[1]]); }
const streetM = (x: number, y: number) => segs.reduce((m, s) => Math.min(m, segDist(s[0], s[1], s[2], s[3], x, y)), Infinity);

const ROUTE_WEIGHT: Record<string, number> = { 'bespoke-landmark': 3, 'market-stall-kit': 3, 'ground-floor-fit': 2, 'historic-shopfront-kit': 2, 'chain-logo': 1, skip: 0 };
const rows = research.items.map(it => {
  if (typeof it.lat !== 'number') return { ...it, game: { located: false }, score: 0 };
  const [x, y] = local(it.lng, it.lat), gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  const cand = [] as Array<{ id: string; ring: [number, number][]; d: number }>;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const b of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
    const inside = insideRing(b.ring, x, y);
    let d = inside ? 0 : Infinity;
    if (!inside) for (let i = 1; i < b.ring.length; i++) d = Math.min(d, segDist(b.ring[i - 1][0], b.ring[i - 1][1], b.ring[i][0], b.ring[i][1], x, y));
    cand.push({ id: b.id, ring: b.ring, d });
  }
  const host = cand.filter(c => c.d < 12).sort((p, q) => p.d - q.d)[0];
  const pand = host ? bagKey(host.id) : null;
  const model = pand ? modelOf.get(pand) : undefined, mo = pand ? mon[`NL.IMBAG.Pand.${pand}`] : undefined;
  const t = pand ? tpl.buildings[`NL.IMBAG.Pand.${pand}`] : undefined;
  const market = markets.find(m => m.sides.some(s => s.kerb.some(([lng, lat]) => { const p = local(lng, lat); return Math.hypot(p[0] - x, p[1] - y) < 80; })));
  const draws = market ? `market kit (${market.id})` : model ? (manual.get(model)?.category === 'ordinary' || model.startsWith('ordinary') ? `recipe GLB ${model}` : model.startsWith('chunk') ? `block-face GLB ${model}` : `bespoke GLB ${model}`)
    : pand && covers.buildingTypes.includes(pand) ? 'building-type kit' : pand && hand.has(pand) ? `measured front "${hand.get(pand)}"` : t ? `template ${tpl.templates[t[0]]}${t[3] ? ` "${t[3]}"` : ''} on the generated wall` : pand ? 'generic generated facade' : 'no building (open space)';
  const tenantShows = market ? 'stalls' : model ? 'no (model hides the pand; tenant invisible)' : t ? 'template' : 'no';
  const sm = streetM(x, y);
  const visibility = sm < 12 ? 'on a ride street' : sm < 30 ? 'seen from a ride street' : 'off the corridor';
  const open = it.status === 'open-same-business' || it.status === 'same-building-new-tenant';
  const score = (ROUTE_WEIGHT[it.route] ?? 1) * (open ? 1 : 0.5) * (sm < 12 ? 3 : sm < 30 ? 2 : 1) * (it.verification === 'verified' ? 1.2 : it.verification === 'unverified' ? 0.5 : 1)
    * (model && !String(model).startsWith('chunk') && it.route === 'bespoke-landmark' ? 0.4 : 1) * (market ? 0.4 : 1) * (pand && hand.has(pand) ? 0.6 : 1) + (it.rijksmonument ? 0.5 : 0);
  return { ...it, game: { located: true, pand, monument: mo?.nr ?? null, registerPui: !!mo?.elements?.some(e => e.key === 'shopfront'), draws, tenantShows, streetM: Math.round(sm), visibility }, score: Math.round(score * 10) / 10 };
}).sort((a, b) => b.score - a.score);
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: '2026-11-20', lane: 'retail-fit-20261120', method: 'research list (open data, source URLs per item) joined to the game: pand under the point, covers.json model, measured fronts, shop templates, market extract, distance to the routing network; score = route weight x open x ride visibility x verification (+0.5 monument), x0.4 when a bespoke model or market kit already stands, x0.6 for a measured hand front', sources: research.sources, items: rows }, null, 1));
for (const r of rows.slice(0, 20)) console.log(`${r.score}\t${r.name}\t${r.route}\t${(r as any).game.draws}\t${(r as any).game.visibility}`);
