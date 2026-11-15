/**
 * Round 7 (lane retail-look-20261114): second sources for shop hosting, OSM staying the base (retailSources.ts).
 *   node --import tsx scripts/retail-ground/second-sources.ts --source=horeca|atp|overture [--apply]
 * Each source's records are hosted on the pand their point lies in (else hostOnFront from the point); the OSM nodes of
 * the same kind are hosted as build-templates.ts hosts them (with its address hosts). Per source it writes
 * data/retail-ground/sources/<source>.json (counts, every move and add, the OSM nodes the source does not list) and,
 * with --apply, merges its fixes into data/retail-ground/source-hosts.json, which build-templates.ts reads:
 *   hosts: OSM node -> the source's pand (a move; a BAG address host in address-hosts.json outranks it);
 *   adds:  businesses OSM lacks, as synthetic nodes with OSM-style tags (templateForTags decides if one draws).
 * A move or add is applied only when the source's point lies inside a pand with BAG shop or horeca space.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hostOnFront, insideRing } from '../../src/canalRecall/retailHosting.ts';
import { compareSources, nameTokens, sameName, MATCH_M, type OsmRec, type SourceRec } from '../../src/canalRecall/retailSources.ts';
import { rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';
import { nodes, local, near, facing, open, bagUses, bagKey, type Node } from './city.ts';
import { vbosNear } from './bag-vbo.ts';
import { addressPand, matchAddress, parseHouseNumber } from '../../src/canalRecall/retailAddress.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SOURCE = arg('source') ?? 'horeca', OUT = `data/retail-ground/sources/${SOURCE}.json`, HOSTS = 'data/retail-ground/source-hosts.json';
type Rec = SourceRec & { tags: Record<string, string>; inside: boolean; meta: Record<string, unknown> };

const shopSpace = (pand: string) => { const u = bagUses[pand]; return (u?.area.winkelfunctie ?? 0) + (u?.area.bijeenkomstfunctie ?? 0); };
/** The pand a point lies in (exact), else the host hostOnFront picks from it. */
function pandAt(lng: number, lat: number): { pand: string | null; inside: boolean } {
  const [x, y] = local(lng, lat), cands = near(x, y), inn = cands.find(c => insideRing(c.ring, x, y));
  if (inn) return { pand: bagKey(inn.id), inside: true };
  const h = hostOnFront(cands, x, y, id => bagUses[bagKey(id)], facing, open, true);
  return { pand: h ? bagKey(h.id) : null, inside: false };
}
const dist = (a: [number, number], b: [number, number]) => { const p = local(a[0], a[1]), q = local(b[0], b[1]); return Math.hypot(p[0] - q[0], p[1] - q[1]); };

// The address hosts build-templates.ts applies, so the OSM side is hosted as the game hosts it.
const addressHosts = new Map<string, string>(fs.existsSync('data/retail-ground/address-hosts.json') ? Object.entries((JSON.parse(fs.readFileSync('data/retail-ground/address-hosts.json', 'utf8')) as { hosts: Record<string, { pand: string }> }).hosts).map(([k, v]) => [k, v.pand]) : []);
function osmHost(n: Node): string | null {
  const a = addressHosts.get(String(n.id)); if (a) return a;
  const [x, y] = local(n.lon, n.lat), h = hostOnFront(near(x, y), x, y, id => bagUses[bagKey(id)], facing, open, true);
  return h ? bagKey(h.id) : null;
}

async function horeca(): Promise<{ src: Rec[]; kind: (n: Node) => boolean; provenance: string }> {
  const RAW = 'artifacts/terraces/raw', day = fs.readdirSync(RAW).sort().pop()!;
  const rows = fs.readdirSync(path.join(RAW, day)).flatMap(f => (JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(RAW, day, f))).toString()) as { _embedded: { exploitatievergunning: Array<Record<string, any>> } })._embedded.exploitatievergunning);
  const AMENITY: Record<string, string> = { 'Café': 'bar', 'Café met zaalverhuur': 'bar', 'Restaurant': 'restaurant', 'Restaurant met zaalverhuur': 'restaurant', 'Eethuis': 'restaurant', 'Fastfood': 'fast_food', 'Alcoholvrij': 'cafe', 'Coffeeshop': 'bar' };
  const src: Rec[] = [];
  for (const r of rows) {
    const amenity = AMENITY[r.zaakCategorie]; if (!amenity || !/^(Verleend|Deels verleend)$/.test(r.statusVergunning ?? '') || !r.locatie) continue;
    const [lng, lat] = rdToLngLat(r.locatie.coordinates[0], r.locatie.coordinates[1]), { pand, inside } = pandAt(lng, lat);
    const name = r.zaakCategorie === 'Coffeeshop' && !/coffee ?shop/i.test(r.zaaknaam) ? `Coffeeshop ${r.zaaknaam}` : String(r.zaaknaam);
    const m = /^(.*?)\s+(\d+\S*)\s+Amsterdam$/.exec(r.adres ?? '');
    src.push({ id: `horeca:${r.zaaknummer}`, name, at: [+lng.toFixed(6), +lat.toFixed(6)], pand, inside, tags: { amenity, name, ...(m ? { 'addr:street': m[1], 'addr:housenumber': m[2] } : {}) }, meta: { categorie: r.zaakCategorie, adres: r.adres } });
  }
  return { src, kind: n => /^(cafe|restaurant|bar|pub|fast_food)$/.test(n.tags?.amenity ?? ''), provenance: `Gemeente Amsterdam, horeca exploitatievergunningen (api.data.amsterdam.nl/v1/horeca/exploitatievergunning), CC BY 4.0, fetched ${day}` };
}

// All the Places (github.com/alltheplaces/alltheplaces, CC0 output): the Dutch chain spiders' latest run, cached under
// .cache/retail-ground/atp/<run>/<spider>.geojson (only these spiders' files, never the 2.7 GB bundle). A chain is
// matched by brand: an OSM node whose brand (else name) names the same chain.
export const ATP_SPIDERS = ['albert_heijn_nl', 'jumbo_nl', 'dirk_nl', 'plus_nl', 'spar_nl', 'vomar_nl', 'ekoplaza_nl', 'etos_nl', 'gall_and_gall_nl', 'primera_nl', 'bruna_nl', 'blokker_nl', 'xenos_nl', 'douglas_nl', 'praxis_nl', 'action', 'hema', 'zeeman', 'hunkemoller', 'rituals', 'new_york_pizza_nl_de', 'dominos_pizza_nl', 'kfc_nl'];
const BBOX = [4.75, 52.28, 5.05, 52.43];
async function atp(): Promise<{ src: Rec[]; kind: (n: Node) => boolean; provenance: string; nameOf: (n: Node) => string }> {
  const ROOT = '.cache/retail-ground/atp', run = fs.readdirSync(ROOT).sort().pop()!;
  const src: Rec[] = [], brands = new Set<string>(), empty: string[] = [];
  for (const sp of ATP_SPIDERS) {
    const f = path.join(ROOT, run, `${sp}.geojson`);
    if (!fs.existsSync(f) || !fs.statSync(f).size) { empty.push(sp); continue; }
    for (const ft of (JSON.parse(fs.readFileSync(f, 'utf8')) as { features: Array<{ geometry?: { type: string; coordinates: [number, number] }; properties: Record<string, string> }> }).features) {
      const c = ft.geometry?.type === 'Point' ? ft.geometry.coordinates : null;
      if (!c || c[0] < BBOX[0] || c[0] > BBOX[2] || c[1] < BBOX[1] || c[1] > BBOX[3]) continue;
      const p = ft.properties, brand = p.brand ?? p.name ?? sp; brands.add(brand);
      const { pand, inside } = pandAt(c[0], c[1]);
      const tags: Record<string, string> = Object.fromEntries(Object.entries(p).filter(([k]) => /^(shop|amenity|brand|brand:wikidata|name|cuisine)$/.test(k)));
      tags.name ??= brand;
      const m = /^(.*?)\s+(\d+\S*)$/.exec(p['addr:street_address'] ?? '');
      if (m) { tags['addr:street'] = m[1]; tags['addr:housenumber'] = m[2]; }
      src.push({ id: `atp:${sp}:${p.ref ?? `${c[0]},${c[1]}`}`, name: brand, at: [+c[0].toFixed(6), +c[1].toFixed(6)], pand, inside, tags, meta: { spider: sp, address: p['addr:street_address'] ?? p['addr:full'] ?? '', branch: p.branch ?? '' } });
    }
  }
  if (empty.length) console.log(`atp: no data in this run for ${empty.join(', ')}`);
  const names = [...brands];
  const nameOf = (n: Node) => n.tags?.brand ?? n.tags?.name ?? '';
  return { src, kind: n => names.some(b => sameName(b, nameOf(n))), nameOf, provenance: `All the Places run ${run} (alltheplaces-data.openaddresses.io, output CC0-1.0), spiders: ${ATP_SPIDERS.filter(s => !empty.includes(s)).join(', ')}; empty this run: ${empty.join(', ') || 'none'}` };
}

// Overture Maps places (scripts/retail-ground/overture-places.py, the Amsterdam bbox of one release, CDLA-Permissive-2.0):
// a second opinion on non-chain shops (OSM nodes with a shop tag and no brand). Only open records with confidence >=
// OVERTURE_MIN_CONF in shop, food and personal-care categories; none here come from OSM (checked: BrightQuery, Meta,
// Foursquare, Microsoft, ...), so agreement is independent. Records marked permanently_closed are kept apart: an OSM
// shop matching one is reported as possibly stale, never removed.
const OVERTURE_MIN_CONF = 0.6, OVERTURE_KINDS = /(_store|^shopping|restaurant|eatery|^bar|cafe|bakery|personal_or_beauty_service|^food)/;
let closed: Rec[] = [];
async function overture(): Promise<{ src: Rec[]; kind: (n: Node) => boolean; provenance: string }> {
  const ROOT = '.cache/retail-ground/overture', file = fs.readdirSync(ROOT).filter(f => f.startsWith('places-')).sort().pop()!;
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as { release: string; places: Array<{ id: string; name: string | null; cat: string | null; basic: string | null; status: string | null; brand: string | null; confidence: number; addr: string | null; src: string[]; lng: number; lat: number }> };
  const src: Rec[] = []; closed = [];
  for (const r of j.places) {
    if (!r.name || r.brand || !OVERTURE_KINDS.test(r.basic ?? '') || r.confidence < OVERTURE_MIN_CONF) continue;
    const { pand, inside } = pandAt(r.lng, r.lat);
    const rec: Rec = { id: `overture:${r.id}`, name: r.name, at: [+r.lng.toFixed(6), +r.lat.toFixed(6)], pand, inside, tags: { name: r.name, 'overture:category': r.cat ?? '' }, meta: { cat: r.cat, basic: r.basic, conf: r.confidence, addr: r.addr, src: r.src } };
    (r.status === 'permanently_closed' ? closed : src).push(rec);
  }
  return { src, kind: n => !!n.tags?.shop && !n.tags.brand, provenance: `Overture Maps places release ${j.release}, Amsterdam bbox only (CDLA-Permissive-2.0), read with DuckDB from the public parquet` };
}

const loaders: Record<string, () => Promise<{ src: Rec[]; kind: (n: Node) => boolean; provenance: string; nameOf?: (n: Node) => string }>> = { horeca, atp, overture };
if (!loaders[SOURCE]) throw new Error(`unknown --source=${SOURCE}`);
const { src, kind, provenance, nameOf } = await loaders[SOURCE]();
const osmNodes = (await nodes()).filter(n => Number(n.tags?.level ?? 0) <= 0 && kind(n));
const osm: (OsmRec & { node: Node })[] = osmNodes.map(n => ({ id: String(n.id), name: nameOf ? nameOf(n) : n.tags?.name ?? '', at: [n.lon, n.lat] as [number, number], pand: osmHost(n), node: n }));
// A coarse grid so each source record looks only at nearby OSM records.
const G = 0.002, cell = (a: [number, number]) => `${Math.floor(a[0] / G)},${Math.floor(a[1] / G)}`, idx = new Map<string, typeof osm>();
for (const o of osm) { const k = cell(o.at); (idx.get(k) ?? idx.set(k, []).get(k)!).push(o); }
const nearOsm = (a: [number, number]) => { const out: typeof osm = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(idx.get(`${Math.floor(a[0] / G) + dx},${Math.floor(a[1] / G) + dy}`) ?? [])); return out; };
const { verdicts, unmatched } = compareSources(src, osm, dist, nearOsm);
const count = verdicts.reduce((m, v) => (m[v.kind] = (m[v.kind] ?? 0) + 1, m), {} as Record<string, number>);
// ATP points are often geocoded (no address on Albert Heijn's): a chain store needs a chain-sized unit there.
const MIN_M2: Record<string, number> = { atp: 100 };
const usable = (r: Rec) => r.inside && !!r.pand && shopSpace(r.pand) > (MIN_M2[SOURCE] ?? 0);
// Round 7b (integrator): a name match alone moved the wrong business about 1 in 7 (Tensai Ramen / Ramen Bar). A move
// needs the source's own address to be a BAG unit inside the target pand, or (permits) the same name exactly; an ATP
// add needs the address too. Everything else keeps the OSM host and is listed.
const exactName = (a: string, b: string) => { const r = (v: string) => v.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''); return r(a) === r(b); };
async function addressIn(r: Rec): Promise<boolean> {
  const street = r.tags['addr:street'], nr = r.tags['addr:housenumber'];
  if (!street || !nr || !r.pand) return false;
  const vbos = await vbosNear(r.id, r.at[0], r.at[1]); if (!vbos) return false;
  const hits = matchAddress(street, nr, vbos); if (!hits.length) return false;
  const [x, y] = local(r.at[0], r.at[1]);
  const p = addressPand(hits.map(v => ({ ...v, at: local(v.at[0], v.at[1]) })), near(x, y), insideRing);
  return !!p && bagKey(p.id) === r.pand;
}
// The OSM node's own address, when it has one, must not name another place: another street, or a number more than
// ADDR_NUMBER_SLACK away (a shop over 29-33 is one place; Tensai Ramen at Reguliersdwarsstraat 49 is not the Ramen Bar
// at Geelvinckssteeg 4).
const ADDR_NUMBER_SLACK = 4;
function addrConflict(v: { source: Rec; osm: OsmRec }): boolean {
  const t = (v.osm as OsmRec & { node?: Node }).node?.tags ?? {}, a = parseHouseNumber(t['addr:housenumber']), b = parseHouseNumber(v.source.tags['addr:housenumber']);
  if (!t['addr:street'] || !a || !v.source.tags['addr:street'] || !b) return false;
  const st = (x: string) => nameTokens(x).join('');
  return st(t['addr:street']) !== st(v.source.tags['addr:street']) || Math.abs(a.nr - b.nr) > ADDR_NUMBER_SLACK;
}
const gate: Record<string, { move: (v: { source: Rec; osm: OsmRec }) => Promise<string | null>; add: (r: Rec) => Promise<string | null> }> = {
  horeca: { move: async v => addrConflict(v) ? null : exactName(v.source.name, v.osm.name) ? 'exact name' : await addressIn(v.source) ? 'BAG address' : null, add: async () => 'permit at a BAG horeca address' },
  atp: { move: async v => !addrConflict(v) && await addressIn(v.source) ? 'BAG address' : null, add: async r => await addressIn(r) ? 'BAG address' : null },
  overture: { move: async () => null, add: async () => null },
};
const why = new Map<string, string>();
for (const v of verdicts) {
  const r = v.source as Rec; if (!usable(r)) continue;
  if (v.kind === 'move') { const g = await gate[SOURCE].move({ source: r, osm: v.osm! }); if (g) why.set(r.id, g); }
  else if (v.kind === 'add' && !osm.some(o => o.pand === r.pand)) { const g = await gate[SOURCE].add(r); if (g) why.set(r.id, g); }
}
const moves = verdicts.filter(v => v.kind === 'move'), adds = verdicts.filter(v => v.kind === 'add');
// An add on a pand some OSM node of this kind already holds is the same place under another name (a rename, a
// second permit): it confirms the pand, not a new business.
const osmPands = new Set(osm.map(o => o.pand).filter(Boolean));
const realAdds = adds.filter(v => !osmPands.has(v.source.pand));
const report = {
  source: SOURCE, provenance, date: new Date().toISOString().slice(0, 10), matchM: MATCH_M,
  counts: { records: src.length, osm: osm.length, ...count, addsOnOsmPand: adds.length - realAdds.length, addsNew: realAdds.length, osmNotListed: unmatched.length, movesApplicable: moves.filter(v => why.has(v.source.id)).length, movesHeld: moves.filter(v => usable(v.source as Rec) && !why.has(v.source.id)).length, addsApplicable: realAdds.filter(v => why.has(v.source.id)).length },
  moves: moves.map(v => ({ applied: why.get(v.source.id) ?? null, osm: v.osm!.id, osmName: v.osm!.name, name: v.source.name, from: v.osm!.pand, to: v.source.pand, inside: (v.source as Rec).inside, shopM2: v.source.pand ? shopSpace(v.source.pand) : 0, d: +dist(v.osm!.at, v.source.at).toFixed(1), meta: (v.source as Rec).meta })),
  adds: realAdds.map(v => ({ applied: why.get(v.source.id) ?? null, id: v.source.id, name: v.source.name, pand: v.source.pand, inside: (v.source as Rec).inside, shopM2: v.source.pand ? shopSpace(v.source.pand) : 0, tags: (v.source as Rec).tags, at: v.source.at })),
  /** Listed only, never removed: a source's spider can miss a store. */
  osmNotListed: unmatched.map(o => ({ id: o.id, name: o.name, pand: o.pand, amenity: (o as typeof osm[number]).node.tags?.amenity })),
};
if (closed.length) {
  const c = compareSources(closed, osm, dist, nearOsm).verdicts.filter(v => v.osm);
  Object.assign(report.counts, { osmMatchingClosed: c.length });
  Object.assign(report, { possiblyClosed: c.map(v => ({ osm: v.osm!.id, name: v.osm!.name, overture: v.source.id, meta: (v.source as Rec).meta })) });
}
// The lists are capped in the staged report (counts stay whole); the full lists come back by re-running the script.
const CAP = 400, capped: Record<string, number> = {};
for (const k of ['moves', 'adds', 'osmNotListed', 'possiblyClosed'] as const) { const a = (report as Record<string, unknown>)[k] as unknown[] | undefined; if (a && a.length > CAP) { capped[k] = a.length; (report as Record<string, unknown>)[k] = a.slice(0, CAP); } }
if (Object.keys(capped).length) Object.assign(report, { capped: { at: CAP, lengths: capped } });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report));
console.log(`${SOURCE}: ${JSON.stringify(report.counts)} -> ${OUT}`);
if (process.argv.includes('--apply')) {
  const cur = fs.existsSync(HOSTS) ? JSON.parse(fs.readFileSync(HOSTS, 'utf8')) : { note: 'second-sources.ts --apply: OSM node hosts moved by a second source, and businesses OSM lacks', hosts: {}, adds: [], provenance: {} };
  for (const k of Object.keys(cur.hosts)) if (cur.hosts[k].source === SOURCE) delete cur.hosts[k];
  cur.adds = cur.adds.filter((a: { source: string }) => a.source !== SOURCE);
  for (const v of moves) if (why.has(v.source.id)) cur.hosts[v.osm!.id] = { pand: v.source.pand, at: v.source.at, source: SOURCE, name: v.source.name, was: v.osm!.pand, why: why.get(v.source.id) };
  for (const v of realAdds) if (why.has(v.source.id)) cur.adds.push({ id: v.source.id, lon: v.source.at[0], lat: v.source.at[1], tags: (v.source as Rec).tags, source: SOURCE });
  cur.provenance[SOURCE] = provenance;
  fs.writeFileSync(HOSTS, JSON.stringify(cur, null, 1));
  console.log(`applied: ${Object.values(cur.hosts).filter((h: any) => h.source === SOURCE).length} hosts, ${cur.adds.filter((a: any) => a.source === SOURCE).length} adds -> ${HOSTS}`);
}
