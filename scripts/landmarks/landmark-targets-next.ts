/**
 * Next bespoke landmark targets (2026-11-15): notable, unmodelled buildings on and just outside the canal belt, ranked by
 * ride exposure x recognisability. Read-only except for its report.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/landmarks/landmark-targets-next.ts [--routes=1500] [--seed=7] [--top=15]
 *
 * Candidates: OSM (Overpass, ODbL; cached in .cache/landmark-targets-next/overpass.json) buildings and POI nodes in the
 * belt bbox with wikidata / wikipedia / historic / tourism / amenity (theatre, place_of_worship, library, arts_centre,
 * cinema, townhall, courthouse, ...) / building (church, chapel, public, civic, ...) tags, mapped to BAG pands
 * (bag-tiles z14). Already modelled = a pand in covers.json `models[*].p`, a signature-landmarks footprint, or a
 * suppressOsmIds entry of manualCatalogue.json. Exposure: ride-visibility.ts (seeded bike routes between teachable
 * destinations, 5 m samples, walls visible within 60 m with a footprint sightline). Score = exposure x recognisability
 * (2 with a Wikipedia article, 1.4 with a wikidata id only (mostly register items), 1.2 with only a monument id, 1 otherwise), kept within `MAX_DAM_KM` of the Dam.
 * Writes docs/reports/landmark-targets-next-raw.json (top 60) for the hand-curated docs/reports/landmark-targets-20261115.json.
 */
import fs from 'node:fs';
import {loadFootprints, sampleRoutes, scorer, METHOD} from '../building-recipes/ride-visibility.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const PREFIX = 'NL.IMBAG.Pand.';
const UA = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const BBOX = [52.352, 4.866, 52.386, 4.928]; // canal belt and just outside it (S, W, N, E)
const MAX_DAM_KM = 2.6;
const DAM = {lng: 4.8932, lat: 52.3731};
const j = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

const CACHE = '.cache/landmark-targets-next/overpass.json';
async function overpass() {
  if (fs.existsSync(CACHE)) return j(CACHE);
  const bb = BBOX.join(',');
  const q = `[out:json][timeout:120];(
    nwr["building"]["wikidata"](${bb}); nwr["building"]["wikipedia"](${bb});
    nwr["building"]["historic"](${bb}); nwr["building"]["tourism"](${bb});
    nwr["building"]["amenity"~"theatre|place_of_worship|library|arts_centre|cinema|townhall|courthouse|music_venue|concert_hall|university|college|exhibition_centre"](${bb});
    nwr["building"~"church|chapel|cathedral|public|civic|government|museum|synagogue|mosque|temple|train_station|university|college"](${bb});
    node["wikidata"]["tourism"](${bb}); node["wikidata"]["amenity"](${bb}); node["wikidata"]["historic"](${bb});
  ); out tags center;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', headers: {'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(q)});
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const d = await r.json();
  fs.mkdirSync('.cache/landmark-targets-next', {recursive: true});
  fs.writeFileSync(CACHE, JSON.stringify(d));
  return d;
}

const osm = await overpass();
const fp = loadFootprints();
const area = (id: string) => fp.pands.get(id)!.polys.reduce((t, poly) => { let a = 0; const r = poly[0]; for (let i = 0; i < r.length; i++) { const u = r[i], v = r[(i + 1) % r.length]; a += u[0] * v[1] - v[0] * u[1]; } return t + Math.abs(a) / 2; }, 0);
const pandAt = (lat: number, lng: number) => {
  const p = lngLatToRd([lng, lat]);
  const cand = fp.near([p.x - 2, p.y - 2, p.x + 2, p.y + 2]);
  const inRing = (r: number[][]) => { let inside = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const [xi, yi] = r[i], [xk, yk] = r[k]; if ((yi > p.y) !== (yk > p.y) && p.x < ((xk - xi) * (p.y - yi)) / (yk - yi) + xi) inside = !inside; } return inside; };
  return cand.find(id => fp.pands.get(id)!.polys.some(poly => inRing(poly[0]) && !poly.slice(1).some(inRing)));
};

// already modelled
const covered = new Set<string>();
for (const m of Object.values(j('public/canal-drive/models/covers.json').models) as any[]) for (const p of m.p ?? []) covered.add(PREFIX + String(p).replace(PREFIX, ''));
const cat = j('src/canalRecall/landmarks/manualCatalogue.json') as any[];
const suppressedOsm = new Set<string>();
for (const m of cat) for (const s of m.suppressOsmIds ?? []) { if (String(s).startsWith(PREFIX)) covered.add(s); else suppressedOsm.add(String(s)); }
const sig = Object.values(j('public/canal-drive/models/signature-landmarks.json').models) as any[];
const sigPand = new Map<string, string>();
for (const m of sig) {
  const c = m.footprint?.centre; if (!c) continue;
  const p = lngLatToRd([c[0], c[1]]), r = Math.max(m.footprint.lengthMetres ?? 0, m.footprint.widthMetres ?? 0) / 2 * 0.7 + 2;
  for (const id of fp.near([p.x - r, p.y - r, p.x + r, p.y + r])) { const b = fp.pands.get(id)!.box; if (Math.hypot((b[0] + b[2]) / 2 - p.x, (b[1] + b[3]) / 2 - p.y) <= r) sigPand.set(id, m.id); }
}
const monuments = j('public/data/extracts/amsterdam/monument-facts.json').buildings as Record<string, any>;

type Cand = {name: string; osm: string[]; pand: string; tags: Record<string, string>; lat: number; lng: number};
const byPand = new Map<string, Cand>();
for (const e of osm.elements as any[]) {
  const t = e.tags ?? {}, lat = e.center?.lat ?? e.lat, lng = e.center?.lon ?? e.lon;
  if (lat == null) continue;
  const osmId = `${e.type[0]}${e.id}`;
  const pand = pandAt(lat, lng); if (!pand) continue;
  const name = t.name ?? t['name:en'] ?? t.wikipedia?.split(':').slice(1).join(':') ?? '';
  const cur = byPand.get(pand);
  if (cur) { cur.osm.push(osmId); for (const [k, v] of Object.entries(t)) cur.tags[k] ??= v as string; if (!cur.name && name) cur.name = name; continue; }
  byPand.set(pand, {name, osm: [osmId], pand, tags: {...t}, lat, lng});
}

const routes = sampleRoutes(Number(arg('routes', '1500')), Number(arg('seed', '7')));
const score = scorer(routes.samples, fp);
const km = (a: {lat: number; lng: number}) => { const dx = (a.lng - DAM.lng) * 68, dy = (a.lat - DAM.lat) * 111.2; return Math.hypot(dx, dy); };
const rows = [];
for (const c of byPand.values()) {
  const modelled = covered.has(c.pand) ? 'covers' : sigPand.get(c.pand) ? `signature:${sigPand.get(c.pand)}` : c.osm.some(o => suppressedOsm.has(o) || suppressedOsm.has(o.replace(/^w/, 'way/'))) ? 'suppressed' : null;
  const v = score(c.pand) ?? {score: 0, routeMetres: 0, wallM: 0, routes: 0};
  const mon = monuments[c.pand];
  const recog = c.tags.wikipedia ? 2 : c.tags.wikidata ? 1.4 : mon ? 1.2 : 1;
  rows.push({name: c.name || '(unnamed)', pand: c.pand.replace(PREFIX, ''), osm: c.osm, wikidata: c.tags.wikidata ?? null, wikipedia: c.tags.wikipedia ?? null,
    kind: [c.tags.amenity, c.tags.tourism, c.tags.historic, c.tags.building].filter(Boolean).join('/'), monument: mon?.nr ?? null, year: mon?.coreDate?.from ?? null,
    footprintM2: Math.round(area(c.pand)), damKm: Math.round(km(c) * 100) / 100, lat: c.lat, lng: c.lng, modelled,
    exposure: Math.round(v.score), routeMetres: v.routeMetres, routes: v.routes, recognisability: recog, rank: Math.round(v.score * recog)});
}
const open = rows.filter(r => !r.modelled && r.damKm <= MAX_DAM_KM && r.footprintM2 >= 80).sort((a, b) => b.rank - a.rank);
fs.mkdirSync('docs/reports', {recursive: true});
fs.writeFileSync('docs/reports/landmark-targets-next-raw.json', JSON.stringify({method: METHOD, routes: routes.routes, candidates: rows.length, open: open.length,
  modelledSkipped: rows.filter(r => r.modelled).length, top: open.slice(0, Number(arg('top', '60')))}, null, 1) + '\n');
console.log(`candidates ${rows.length}, modelled ${rows.filter(r => r.modelled).length}, open ${open.length}`);
open.slice(0, 60).forEach((r, i) => console.log(`${String(i + 1).padStart(2)} ${r.name.slice(0, 40).padEnd(40)} ${String(r.rank).padStart(9)} rm${String(r.routeMetres).padStart(6)} ${r.pand} ${r.kind.slice(0, 30).padEnd(30)} ${(r.wikipedia ?? r.wikidata ?? '-').slice(0, 34)} mon${r.monument ?? '-'} ${r.year ?? ''} ${r.footprintM2}m2`));
