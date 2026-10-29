/**
 * Landmark target list by ride visibility (issue #104): named, unmodelled or generic-only buildings ranked by the
 * ride-visibility score of ride-visibility.ts, from the dominant-building backlog and the landmark (POI) backlog, plus the
 * existing bespoke models ranked the same way as context. Read-only; writes artifacts/ and docs/reports/ JSON.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/building-recipes/landmark-targets.ts [--routes=2000] [--seed=7]
 */
import fs from 'node:fs';
import {loadFootprints, sampleRoutes, scorer, METHOD, type RideVisibility} from './ride-visibility.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {footprintOcclusion} from '../da-costa-block/neighbourhood-core.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const PREFIX = 'NL.IMBAG.Pand.';
const j = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

const fp = loadFootprints();
const routes = sampleRoutes(Number(arg('routes', '2000')), Number(arg('seed', '7')));
const score = scorer(routes.samples, fp);
const area = (id: string) => { const p = fp.pands.get(id)!; return p.polys.reduce((t, poly) => { let a = 0; const r = poly[0]; for (let i = 0; i < r.length; i++) { const u = r[i], v = r[(i + 1) % r.length]; a += u[0] * v[1] - v[0] * u[1]; } return t + Math.abs(a) / 2; }, 0); };

/** Pands of a point: the containing pand, plus pands ≥ 200 m² whose box is within 25 m (a campus or a complex), nearest first, max 6. */
function pandsAt(lat: number, lng: number, complex = true): string[] {
  const p = lngLatToRd([lng, lat]);
  const cand = fp.near([p.x - 25, p.y - 25, p.x + 25, p.y + 25]);
  const inside = cand.filter(id => footprintOcclusion([p.x - 0.01, p.y], [p.x + 0.01, p.y], fp.pands.get(id)!.polys).blocked);
  const d = (id: string) => { const b = fp.pands.get(id)!.box; return Math.hypot((b[0] + b[2]) / 2 - p.x, (b[1] + b[3]) / 2 - p.y); };
  const rest = cand.filter(id => !inside.includes(id) && area(id) >= 200).sort((a, b) => d(a) - d(b));
  if (!complex) return inside.length ? inside : cand.length ? [cand.sort((a, b) => d(a) - d(b))[0]] : [];
  return [...inside, ...rest].slice(0, 6);
}
const sum = (ids: string[]): RideVisibility => ids.map(i => score(i) ?? {score: 0, routeMetres: 0, wallM: 0, routes: 0})
  .reduce((t, r) => ({score: t.score + r.score, routeMetres: Math.max(t.routeMetres, r.routeMetres), wallM: t.wallM + r.wallM, routes: Math.max(t.routes, r.routes)}), {score: 0, routeMetres: 0, wallM: 0, routes: 0});

const backlog = j('public/canal-drive/dominant-building-backlog.json').candidates as any[];
const lm = j('public/canal-drive/landmark-backlog.json').destinations as any[];
const cat = j('public/canal-drive/ordinary-buildings-data/catalogue.json').models as any[];
const kitPands = new Set(Object.keys(j('public/data/extracts/amsterdam/kit-pands.json').pands).map(i => PREFIX + i));
const held = new Set(Object.keys(j('scripts/building-recipes/held-installs.json').held ?? {}));
const recipeOf = new Map<string, string>();
for (const m of cat) for (const id of [m.buildingId, ...(m.suppress ?? [])]) if (id) recipeOf.set(id, `${m.source}:${m.id}`);

// bespoke models: every signature GLB (signature-landmarks.json) covers the pands whose centre lies within ~0.8 x its half-extent
// (+3 m) of its footprint centre; landmark-backlog manual-model entries add the pands under their POI point.
const sig = Object.values(j('public/canal-drive/models/signature-landmarks.json').models) as any[];
const bespoke: {name: string; modelId: string; pands: string[]}[] = [];
for (const m of sig) {
  const c = m.footprint?.centre; if (!c) continue;
  const p = lngLatToRd([c[0], c[1]]), r = Math.max(m.footprint.lengthMetres ?? 0, m.footprint.widthMetres ?? 0) / 2 * 0.8 + 3;
  const ids = fp.near([p.x - r, p.y - r, p.x + r, p.y + r]).filter(id => { const b = fp.pands.get(id)!.box; return Math.hypot((b[0] + b[2]) / 2 - p.x, (b[1] + b[3]) / 2 - p.y) <= r && area(id) >= 30; });
  bespoke.push({name: m.name, modelId: m.id, pands: ids.slice(0, 8)});
}
for (const d of lm.filter(d => d.status === 'manual-model')) {
  const e = bespoke.find(b => b.modelId === d.modelId); const ids = pandsAt(d.lat, d.lng, d.treatment === 'complex');
  if (e) e.pands = [...new Set([...e.pands, ...ids])]; else bespoke.push({name: d.name, modelId: d.modelId, pands: ids});
}
const bespokePand = new Map<string, string>();
for (const b of bespoke) for (const p of b.pands) if (!bespokePand.has(p)) bespokePand.set(p, b.name);

const stateOf = (ids: string[]) => {
  if (ids.some(i => held.has(i))) return 'held';
  const b = ids.map(i => bespokePand.get(i)).find(Boolean); if (b) return `bespoke (${b})`;
  const r = ids.map(i => recipeOf.get(i)).find(Boolean); if (r) return `large-recipe (${r})`;
  if (ids.some(i => kitPands.has(i))) return 'kit';
  return 'generic';
};

type Row = {name: string; pandIds: string[]; score: number; routeMetres: number; wallM: number; routes: number; state: string; source: string[]; footprintM2: number; heightM: number | null; notable: string; tier?: string; monument?: string | null};
const rows = new Map<string, Row>();
const add = (r: Row) => { const k = r.pandIds[0]; const e = rows.get(k); if (!e) rows.set(k, r); else { e.source = [...new Set([...e.source, ...r.source])]; if (r.name && (!e.name || e.name.startsWith('(unnamed'))) e.name = r.name; if (r.notable.length > e.notable.length) e.notable = r.notable; e.monument ??= r.monument; } };

for (const c of backlog) {
  const nm = c.name ?? c.poiNames?.[0]; if (!nm) continue;
  const m = c.identity?.monument; const ids = [c.id];
  add({name: nm, pandIds: ids, ...sum(ids), state: stateOf(ids), source: ['dominant-backlog'], footprintM2: c.footprintSquareMetres, heightM: c.heightMetres ?? null,
    notable: [m ? `${m.status} ${m.number}${m.yearFrom ? ` (${m.yearFrom})` : ''}` : '', c.function, c.identity?.osmTags?.tourism, c.identity?.osmTags?.amenity, c.fidelity?.reasons?.join(', ')].filter(Boolean).join('; '), monument: m ? `${m.status} ${m.number}` : null});
}
for (const d of lm) {
  if (d.status === 'manual-model' || d.treatment === 'area' || d.treatment === 'landscape') continue;
  const ids = pandsAt(d.lat, d.lng, d.treatment === 'complex'); if (!ids.length) continue;
  add({name: d.name, pandIds: ids, ...sum(ids), state: d.status === 'procedural-kit' ? `kit (${d.kitName})` : stateOf(ids), source: ['landmark-backlog'], footprintM2: Math.round(ids.reduce((t, i) => t + area(i), 0)),
    heightM: null, notable: [d.type, d.prominence ? `prominence ${d.prominence}` : '', d.taskNote, d.publicBuilding ? 'public building' : ''].filter(Boolean).join('; ')});
}
// pands of the landmark rows can also be dominant candidates: merge by any shared pand id
const all = [...rows.values()], byPand = new Map<string, Row>(), out: Row[] = [];
for (const r of all.sort((a, b) => b.pandIds.length - a.pandIds.length)) {
  const hit = r.pandIds.map(p => byPand.get(p)).find(Boolean);
  if (hit) { hit.source = [...new Set([...hit.source, ...r.source])]; if (r.notable.length > hit.notable.length) hit.notable = r.notable; hit.monument ??= r.monument; if (hit.name.length < r.name.length && r.source.includes('landmark-backlog')) hit.name = r.name; continue; }
  out.push(r); for (const p of r.pandIds) byPand.set(p, r);
}
const byName = new Map<string, Row>(), merged: Row[] = [];
for (const r of out.sort((a, b) => b.score - a.score)) {
  const k = r.name.toLowerCase().replace(/\s*\(.*\)/, '').trim(), h = byName.get(k);
  if (!h) { byName.set(k, r); merged.push(r); continue; }
  h.pandIds.push(...r.pandIds); h.score += r.score; h.wallM += r.wallM; h.routes = Math.max(h.routes, r.routes); h.routeMetres = Math.max(h.routeMetres, r.routeMetres); h.footprintM2 += r.footprintM2; h.source = [...new Set([...h.source, ...r.source])]; h.monument ??= r.monument;
}
const NOT_BUILDING = /sculpture|plaque|memorial|installation|gedenk|grenspaal|monument voor|bevrijdingslinde|statue/i;
const open = merged.filter(r => (r.state === 'generic' || r.state.startsWith('kit') || r.state === 'held') && !(r.source.length === 1 && r.source[0] === 'landmark-backlog' && (NOT_BUILDING.test(r.notable) || NOT_BUILDING.test(r.name) || r.footprintM2 < 400)))
  .sort((a, b) => b.score - a.score);
const nonBuildings = merged.filter(r => r.state === 'generic' && r.source.length === 1 && r.source[0] === 'landmark-backlog' && (NOT_BUILDING.test(r.notable) || NOT_BUILDING.test(r.name) || r.footprintM2 < 400)).sort((a, b) => b.score - a.score).slice(0, 10)
  .map(r => ({name: r.name, score: r.score, routes: r.routes, note: 'small monument / sculpture / plaque: a prop or sign tier, not a building'}));
const FN: Record<string, string> = {woonfunctie: 'housing', kantoorfunctie: 'offices', winkelfunctie: 'shops', onderwijsfunctie: 'education', bijeenkomstfunctie: 'assembly/events', industriefunctie: 'industry', logiesfunctie: 'lodging', gezondheidszorgfunctie: 'healthcare', sportfunctie: 'sport', overige_gebruiksfunctie: 'other use', 'overige gebruiksfunctie': 'other use'};
const english = (t: string) => t.replace(/\b(woonfunctie|kantoorfunctie|winkelfunctie|onderwijsfunctie|bijeenkomstfunctie|industriefunctie|logiesfunctie|gezondheidszorgfunctie|sportfunctie|overige gebruiksfunctie)\b/g, m => FN[m]);
/** Tier: monument/landmark-grade architecture or a skyline icon -> bespoke; large or tall but ordinary-looking -> large recipe; else building type. */
const tierOf = (r: Row) => {
  const heritage = !!r.monument, big = r.footprintM2 >= 1200 || (r.heightM ?? 0) >= 25, tall = (r.heightM ?? 0) >= 60;
  if (r.state.startsWith('kit')) return 'finish the kit (already authored), no new bespoke';
  if (tall) return 'large recipe (tall); bespoke only if it is a recognised skyline icon';
  if (heritage && /Rijksmonument/.test(r.monument!)) return 'bespoke: Rijksmonument, ornament carries the likeness';
  if (heritage) return 'large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture';
  if (big) return 'large recipe';
  return 'building type / ordinary kit';
};
const final = open.slice(0, 40).map((r, i) => ({rank: i + 1, name: r.name, pandIds: r.pandIds.map(x => x.replace(PREFIX, '')), score: r.score, routes: r.routes, routeMetres: r.routeMetres, state: r.state, sources: r.source, footprintM2: r.footprintM2, heightM: r.heightM, monument: r.monument ?? null, notable: english(r.notable), tier: tierOf(r)}));
const ctx = bespoke.filter(b => b.pands.length).map(b => ({name: b.name, modelId: b.modelId, pandIds: b.pands.map(x => x.replace(PREFIX, '')), ...sum(b.pands)})).sort((a, b) => a.score - b.score);
fs.mkdirSync('docs/reports', {recursive: true});
fs.writeFileSync('docs/reports/landmark-targets-20261029.json', JSON.stringify({method: METHOD, routes: routes.routes, routeKm: Math.round(routes.metres / 1000), generatedBy: 'scripts/building-recipes/landmark-targets.ts', openCandidates: open.length, targets: final, notBuildings: nonBuildings, bespokeLowVisibility: ctx.slice(0, 40), bespokeZeroScore: ctx.filter(c => !c.score).length, bespokeTotal: ctx.length}, null, 1) + '\n');
fs.mkdirSync('artifacts/building-recipes', {recursive: true});
fs.writeFileSync('artifacts/building-recipes/landmark-targets-raw.json', JSON.stringify({method: METHOD, routes: routes.routes, open: open.slice(0, 120)}, null, 1));
console.log(`open ${open.length}; bespoke ${ctx.length}; zero-score bespoke ${ctx.filter(c => !c.score).length}`);
open.slice(0, 60).forEach((r, i) => console.log(`${i + 1}. ${r.name.slice(0, 36).padEnd(36)} ${String(r.score).padStart(8)} ${r.routes} ${r.state.slice(0, 22).padEnd(22)} ${r.footprintM2} m2 h${r.heightM} ${r.source.join('+')} | ${r.notable.slice(0, 70)}`));
