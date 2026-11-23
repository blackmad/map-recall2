/**
 * Iconic landmark targets (2026-11-23, landmarks r18): characterful buildings riders pass that are still drawn generic,
 * ranked by memorable street presence first, ride exposure second. Read-only except for its raw report.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/landmarks/landmark-targets-iconic.ts [--routes=1500] [--seed=7] [--top=120]
 *
 * Candidates come from two open sources, joined to BAG pands (bag-tiles z14):
 *  - the RCE register descriptions (scripts/data/amsterdam-monument-register/records.json.gz, CC0), joined through
 *    monument-facts.json (pand -> register nr), scored on presence words (koepel, torentje, jugendstil, Amsterdamse
 *    School, tegeltableau, luifel, markies, café, hotel, theater, afgeronde hoek, ...);
 *  - OSM (ODbL; the named-feature extract in .cache/landmark-identity/named.geojsonseq): named cafés, bars, hotels,
 *    theatres, cinemas, markets and shops, with a wikidata/wikipedia bonus (fame) and an awning/tile/dome tag bonus.
 * Excluded: pands in covers.json, near a signature-landmarks footprint, suppressed by the manual catalogue, or ruled in
 * (`--exclude` reports only annotate `listedIn`: an earlier list that was never modelled stays a candidate). Exposure is ride-visibility.ts (same seeded routes as earlier lists).
 * presence = Σ keyword weights (capped) + POI weights; rank = presence x log10(1 + exposure). The curated list
 * (docs/reports/landmark-targets-20261123-iconic.json) is read by hand from this raw list and the panorama crops.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';
import {loadFootprints, sampleRoutes, scorer, METHOD} from '../building-recipes/ride-visibility.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const PREFIX = 'NL.IMBAG.Pand.';
const DAM = {lng: 4.8932, lat: 52.3731};
const MAX_DAM_KM = Number(arg('max-km', '2.8'));
const j = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const NAMED = arg('named', '/Users/blackmad/Code/map-recall2/.cache/landmark-identity/named.geojsonseq');

/** Register presence words (Dutch, lower-case regex sources) and their weights. */
export const PRESENCE_WORDS: [RegExp, number, string][] = [
  [/koepel/, 3, 'dome'], [/torentje|hoektoren|torenvormig|dakruiter|lantaarn/, 2.5, 'turret'],
  [/jugendstil|art nouveau|nieuwe kunst/, 3, 'art nouveau'], [/amsterdamse school/, 3, 'Amsterdam School'],
  [/tegeltableau|tegelwerk|geglazuurde|tegels|majolica|mozaïek|mozaiek/, 2.5, 'tiles'],
  [/sgraffito|polychrom|geschilderd|beschilderd/, 1.5, 'painted'],
  [/markies|luifel|zonwering/, 2, 'awning/canopy'], [/afgeronde hoek|ronde hoek|gebogen gevel|halfrond/, 1.5, 'curved'],
  [/caf[eé]|koffiehuis|tapperij|proeflokaal|bierhuis/, 2.5, 'café'], [/hotel/, 2, 'hotel'],
  [/theater|schouwburg|bioscoop|cinema|concertzaal|variété/, 2.5, 'theatre'], [/markthal|winkelgalerij|passage/, 2, 'market/arcade'],
  [/winkelpui|winkelfront|etalage/, 1, 'shopfront'], [/erker/, 0.7, 'oriel'], [/beeldhouwwerk|beeldengroep|reliëf|relief/, 1, 'sculpture'],
  [/glas-in-lood|glas in lood/, 0.7, 'stained glass'], [/smeedijzer|gietijzer/, 0.5, 'ironwork'],
];

type Cand = {pand: string; names: string[]; reasons: Set<string>; presence: number; osm: string[]; tags: Record<string, string>; register?: string; desc?: string};

function pointInRing(x: number, y: number, r: number[][]) {
  let inside = false;
  for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
    const [xi, yi] = r[i], [xk, yk] = r[k];
    if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) inside = !inside;
  }
  return inside;
}

async function main() {
  const fp = loadFootprints();
  const pandAt = (lng: number, lat: number) => {
    const p = lngLatToRd([lng, lat]);
    const cand = fp.near([p.x - 2, p.y - 2, p.x + 2, p.y + 2]);
    return cand.find(id => fp.pands.get(id)!.polys.some(poly => pointInRing(p.x, p.y, poly[0]) && !poly.slice(1).some(h => pointInRing(p.x, p.y, h))));
  };
  const km = (lng: number, lat: number) => Math.hypot((lng - DAM.lng) * 68, (lat - DAM.lat) * 111.2);

  // already modelled / ruled
  const covered = new Set<string>();
  for (const m of Object.values(j('public/canal-drive/models/covers.json').models) as any[]) for (const p of m.p ?? []) covered.add(PREFIX + String(p).replace(PREFIX, ''));
  const cat = j('src/canalRecall/landmarks/manualCatalogue.json') as any[];
  const suppressedOsm = new Set<string>();
  for (const m of cat) for (const s of m.suppressOsmIds ?? []) { if (String(s).startsWith(PREFIX)) covered.add(s); else suppressedOsm.add(String(s).replace(/^way\//, 'w').replace(/^node\//, 'n')); }
  const sigPand = new Map<string, string>();
  for (const m of Object.values(j('public/canal-drive/models/signature-landmarks.json').models) as any[]) {
    const c = m.footprint?.centre; if (!c) continue;
    const p = lngLatToRd([c[0], c[1]]), r = Math.max(m.footprint.lengthMetres ?? 0, m.footprint.widthMetres ?? 0) / 2 * 0.7 + 2;
    for (const id of fp.near([p.x - r, p.y - r, p.x + r, p.y + r])) { const b = fp.pands.get(id)!.box; if (Math.hypot((b[0] + b[2]) / 2 - p.x, (b[1] + b[3]) / 2 - p.y) <= r) sigPand.set(id, m.id); }
  }
  const ruled = new Map<string, string>();
  for (const f of arg('exclude', '').split(',').filter(Boolean)) {
    const d = j(f);
    for (const r of [...(d.targets ?? []), ...(d.ruledOut ?? [])]) for (const p of String(r.pand ?? '').split(/[\s,]+/).filter(Boolean)) ruled.set(PREFIX + p.replace(PREFIX, ''), f);
  }

  const byPand = new Map<string, Cand>();
  const get = (pand: string) => {
    let c = byPand.get(pand);
    if (!c) { c = {pand, names: [], reasons: new Set(), presence: 0, osm: [], tags: {}}; byPand.set(pand, c); }
    return c;
  };

  // 1. register descriptions
  const monuments = j('public/data/extracts/amsterdam/monument-facts.json').buildings as Record<string, any>;
  const reg = JSON.parse(zlib.gunzipSync(fs.readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
  const rceText = new Map<string, string>();
  const address = new Map<string, string>();
  for (const r of reg.municipal) { const t = r.metadata?._links?.self?.title; if (t) address.set(String(r.monumentNumber), t); }
  for (const r of reg.rce) { const t = (r.descriptions ?? []).map((d: any) => d.text).join(' '); if (t) rceText.set(String(r.monumentNumber), t); }
  for (const [pand, m] of Object.entries(monuments)) {
    if (!fp.pands.has(pand)) continue;
    const text = rceText.get(String(m.nr)); if (!text) continue;
    const low = text.toLowerCase();
    let s = 0; const why: string[] = [];
    for (const [re, w, label] of PRESENCE_WORDS) if (re.test(low)) { s += w; why.push(label); }
    if (s < 2) continue;
    const c = get(pand);
    c.presence += Math.min(s, 7); why.forEach(w => c.reasons.add(`register: ${w}`));
    c.register = String(m.nr); c.desc = text.slice(0, 400); if (address.has(String(m.nr))) c.names.unshift(address.get(String(m.nr))!);
  }

  // 2. OSM named POIs (point features and building centroids)
  const POI_W: Record<string, number> = {cafe: 2, bar: 1.5, pub: 2, restaurant: 1, theatre: 3, cinema: 3, nightclub: 1.5, arts_centre: 2, marketplace: 2.5, hotel: 2, music_venue: 2.5, casino: 2};
  const rl = readline.createInterface({input: fs.createReadStream(NAMED), crlfDelay: Infinity});
  for await (const line of rl) {
    if (!line.includes('"name"')) continue;
    if (!/"(amenity|tourism|shop)"/.test(line)) continue;
    const f = JSON.parse(line), t = f.properties ?? {};
    const g = f.geometry; if (!g) continue;
    let lng: number, lat: number;
    if (g.type === 'Point') [lng, lat] = g.coordinates;
    else if (g.type === 'Polygon') { const r = g.coordinates[0]; lng = r.reduce((a: number, p: number[]) => a + p[0], 0) / r.length; lat = r.reduce((a: number, p: number[]) => a + p[1], 0) / r.length; }
    else continue;
    if (km(lng, lat) > MAX_DAM_KM) continue;
    const kind = t.amenity ?? t.tourism ?? (t.shop ? 'shop' : '');
    let w = POI_W[kind] ?? (t.shop ? 0.5 : 0);
    const fame = t.wikidata || t.wikipedia ? 2.5 : 0;
    if (t['brand:wikidata'] && !t.wikidata) w *= 0.3; // chain branches are not iconic
    w += fame;
    if (/awning|markies/.test(JSON.stringify(t))) w += 1.5;
    if (w < 1.5) continue;
    const pand = pandAt(lng, lat); if (!pand) continue;
    const c = get(pand);
    c.presence += Math.min(w, 5); c.names.push(t.name); c.osm.push(f.id);
    c.reasons.add(`osm: ${kind}${fame ? ' (wikidata)' : ''}`);
    for (const [k, v] of Object.entries(t)) c.tags[k] ??= String(v);
  }

  const routes = sampleRoutes(Number(arg('routes', '1500')), Number(arg('seed', '7')));
  const score = scorer(routes.samples, fp);
  const rows = [];
  for (const c of byPand.values()) {
    const b = fp.pands.get(c.pand)!.box;
    const modelled = covered.has(c.pand) ? 'covers' : sigPand.get(c.pand) ? `signature:${sigPand.get(c.pand)}` : c.osm.some(o => suppressedOsm.has(o)) ? 'suppressed' : null;
    if (modelled) continue;
    const v = score(c.pand) ?? {score: 0, routeMetres: 0, wallM: 0, routes: 0};
    if (!v.score) continue;
    const m = monuments[c.pand];
    rows.push({pand: c.pand.replace(PREFIX, ''), names: [...new Set(c.names)].slice(0, 4), presence: Math.round(c.presence * 10) / 10, reasons: [...c.reasons],
      exposure: Math.round(v.score), routeMetres: v.routeMetres, rank: Math.round(c.presence * Math.log10(1 + v.score) * 10) / 10,
      register: c.register ?? m?.nr ?? null, year: m?.coreDate?.from ?? null, type: m?.type?.term ?? null, wikidata: c.tags.wikidata ?? null,
      osm: c.osm.slice(0, 4), listedIn: ruled.get(c.pand) ?? null, desc: c.desc ?? null, box: b});
  }
  rows.sort((a, b) => b.rank - a.rank);
  const out = arg('out', 'docs/reports/landmark-targets-20261123-iconic-raw.json');
  fs.writeFileSync(out, JSON.stringify({generated: new Date().toISOString().slice(0, 10), method: METHOD, routes: routes.routes, candidates: rows.length, top: rows.slice(0, Number(arg('top', '120')))}, null, 1) + '\n');
  console.log(`open candidates ${rows.length} -> ${out}`);
  rows.slice(0, 80).forEach((r, i) => console.log(`${String(i + 1).padStart(3)} ${r.rank.toFixed(1).padStart(5)} p${r.presence} e${r.exposure} ${r.pand} ${(r.names[0] ?? r.type ?? '').slice(0, 30).padEnd(30)} ${r.reasons.join(',').slice(0, 70)}`));
}

await main();
