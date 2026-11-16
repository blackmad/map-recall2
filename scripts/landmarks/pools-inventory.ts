/**
 * Inventory of the public swimming pools (and the David Lloyd clubs) in the municipality of Amsterdam, for the pools landmark lane.
 *
 *   node --import tsx scripts/landmarks/pools-inventory.ts [--pbf=.cache/osm-source/Amsterdam.osm.pbf] [--out=docs/reports/pools-20261115.json]
 *
 * Sources: OpenStreetMap (ODbL; the cached Geofabrik-style extract, filtered with osmium), the municipality boundary in
 * public/data/extracts/amsterdam/boundaries.json, BAG panden from PDOK BAG WFS (CC0), the Gemeente Amsterdam panorama
 * index (CC BY 4.0, listing only), covers.json + manualCatalogue.json for "already modelled", and streets-routing.json for
 * ride exposure (route metres within 60 m of the facility outline). Everything is cached; no LLM call.
 *
 * Facilities: leisure=sports_centre/fitness_centre/water_park with sport=swimming, a name with bad/zwem, or brand David Lloyd;
 * named leisure=swimming_pool areas not tagged private; amenity=public_bath. Basins: leisure=swimming_pool areas whose access is
 * not private/customers/no, inside or within 15 m of a facility. A basin under a BAG pand is indoor, else outdoor.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {cachedJson, http} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';
import {listPanos} from '../pand-reference/select.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
http.minGapMs = 150;
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const PBF = arg('pbf', '.cache/osm-source/Amsterdam.osm.pbf');
const OUT = arg('out', 'docs/reports/pools-20261115.json');
const STAGE = 'artifacts/pools';
fs.mkdirSync(STAGE, {recursive: true});

// ---- OSM ----
const filtered = path.join(STAGE, 'pools.osm.pbf'), seq = path.join(STAGE, 'pools.geojsonseq');
execFileSync('osmium', ['tags-filter', '-O', '-o', filtered, PBF, 'nwr/leisure=swimming_pool,water_park,sports_centre,fitness_centre', 'nwr/sport=swimming', 'nwr/brand=David Lloyd', 'nwr/amenity=public_bath']);
execFileSync('osmium', ['export', '-O', '-f', 'geojsonseq', '--add-unique-id=type_id', '-o', seq, filtered]);
type Feat = {id: string; properties: Record<string, string>; geometry: {type: string; coordinates: any}};
const feats: Feat[] = fs.readFileSync(seq, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l.replace(/^\x1e/, '')))
  .filter((f: Feat) => f.id.startsWith('n') || f.id.startsWith('a')); // closed ways come twice (w + a); keep the area

// ---- geometry helpers (local metres around Amsterdam) ----
const LAT0 = 52.37, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KY = 110540;
type P = [number, number];
const m = (lng: number, lat: number): P => [lng * KX, lat * KY];
const inRing = (p: P, r: P[]) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const segDist = (p: P, a: P, b: P) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const ringDist = (p: P, r: P[]) => { if (inRing(p, r)) return 0; let d = Infinity; for (let i = 0; i < r.length; i++) d = Math.min(d, segDist(p, r[i], r[(i + 1) % r.length])); return d; };
const area = (r: P[]) => Math.abs(r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;
const centroid = (r: P[]): P => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
/** Outer rings of a feature in metres (a node becomes a 1 m square). */
function rings(f: Feat): P[][] {
  const g = f.geometry;
  if (g.type === 'Point') { const [x, y] = m(g.coordinates[0], g.coordinates[1]); return [[[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]]]; }
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.map((pl: number[][][]) => pl[0].map(c => m(c[0], c[1])));
}

// ---- municipality ----
const bounds = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8'));
const muni = bounds.find((b: any) => b.kind === 'municipality' && b.name === 'Amsterdam');
const muniRings: P[][] = muni.geometry.map((poly: number[][][]) => poly[0].map(([lat, lng]) => m(lng, lat)));
const inMuni = (p: P) => muniRings.some(r => inRing(p, r));

// ---- facilities and basins ----
const t = (f: Feat) => f.properties;
/** `customers` is a paying public pool (Sportfondsenbad Oost, Flevoparkbad's basins); only private/no/members are closed. */
const blockedAccess = (f: Feat) => ['private', 'no', 'members'].includes(t(f).access ?? '');
const isDavidLloyd = (f: Feat) => /david lloyd/i.test(`${t(f).brand ?? ''} ${t(f).name ?? ''} ${t(f)['brand:wikidata'] === 'Q5236491' ? 'david lloyd' : ''}`);
const isFacility = (f: Feat) => {
  const p = t(f);
  if (isDavidLloyd(f)) return true;
  if (p.amenity === 'public_bath') return true;
  if (['sports_centre', 'fitness_centre', 'water_park'].includes(p.leisure ?? '')) return p.sport?.split(';').includes('swimming') || /bad\b|zwem|pool/i.test(p.name ?? '') || p.leisure === 'water_park';
  if (p.leisure === 'swimming_pool') return !!p.name && !blockedAccess(f) && !/peuter|kinder|pieren/i.test(p.name);
  // an outdoor bath drawn as a plain sport=swimming area with the bath's name (Sloterparkbad's outdoor half)
  if ((!p.leisure || p.leisure === 'recreation_ground') && p.sport === 'swimming' && /bad\b|sportplaza/i.test(p.name ?? '')) return true;
  return false;
};
const facilities = feats.filter(isFacility).filter(f => inMuni(centroid(rings(f)[0])));
const basins = feats.filter(f => t(f).leisure === 'swimming_pool' && f.id.startsWith('a') && !blockedAccess(f) && inMuni(centroid(rings(f)[0])));

// merge facility features that overlap or share a name within 150 m (a node + its area, an indoor and an outdoor area)
type Fac = {name: string; ids: string[]; feats: Feat[]; rings: P[][]};
const facs: Fac[] = [];
for (const f of facilities.sort((a, b) => (a.id.startsWith('a') ? 0 : 1) - (b.id.startsWith('a') ? 0 : 1))) {
  const rs = rings(f), c = centroid(rs[0]), nm = (t(f).name ?? '').trim();
  const norm = (s: string) => s.toLowerCase().replace(/\b(zwembad|sportcentrum|het|de)\b|[^a-z]/g, '');
  const hit = facs.find(F => F.rings.some(r => ringDist(c, r) < 5) || (nm && norm(F.name) && norm(F.name) === norm(nm) && F.rings.some(r => ringDist(c, r) < 150)));
  if (hit) { hit.ids.push(f.id); hit.feats.push(f); if (f.id.startsWith('a')) hit.rings.push(...rs); if (!hit.name && nm) hit.name = nm; }
  else facs.push({name: nm, ids: [f.id], feats: [f], rings: f.id.startsWith('a') ? rs : rs});
}

// ---- BAG panden per facility (PDOK WFS bbox, CC0) ----
type Pand = {id: string; ring: P[]; year: number | null; status: string};
async function pandsNear(rs: P[][], pad: number): Promise<Pand[]> {
  const all = rs.flat(); const xs = all.map(p => p[0] / KX), ys = all.map(p => p[1] / KY);
  const [x0, y0] = lngLatToRd(Math.min(...xs) - pad / KX, Math.min(...ys) - pad / KY), [x1, y1] = lngLatToRd(Math.max(...xs) + pad / KX, Math.max(...ys) + pad / KY);
  const url = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&count=500&bbox=${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)},EPSG:28992`;
  const j: any = await cachedJson(url);
  return j.features.map((f: any) => ({id: f.properties.identificatie, year: f.properties.bouwjaar ?? null, status: f.properties.status, ring: f.geometry.coordinates[0].map(([x, y]: number[]) => { const [lng, lat] = rdToLngLat(x, y); return m(lng, lat); })}));
}

// ---- ride exposure ----
type Seg = {a: P; b: P; len: number};
const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8'));
const segs: Seg[] = [];
for (const s of routing) for (let i = 1; i < s.path.length; i++) { const a = m(s.path[i - 1][1], s.path[i - 1][0]), b = m(s.path[i][1], s.path[i][0]); segs.push({a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1])}); }
function exposure(rs: P[][], R = 60) {
  const all = rs.flat(), x0 = Math.min(...all.map(p => p[0])) - R, x1 = Math.max(...all.map(p => p[0])) + R, y0 = Math.min(...all.map(p => p[1])) - R, y1 = Math.max(...all.map(p => p[1])) + R;
  let metres = 0;
  for (const s of segs) {
    if (Math.max(s.a[0], s.b[0]) < x0 || Math.min(s.a[0], s.b[0]) > x1 || Math.max(s.a[1], s.b[1]) < y0 || Math.min(s.a[1], s.b[1]) > y1) continue;
    const n = Math.max(1, Math.ceil(s.len / 5));
    for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, p: P = [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u]; if (rs.some(r => ringDist(p, r) <= R)) metres += s.len / n; }
  }
  return Math.round(metres);
}

// ---- hand notes: identity checks and the completeness pass (amsterdam.nl answers 403 to scripted reads; davidlloyd.nl club list read) ----
const NOTES: Record<string, string> = {
  'Swimgym': 'commercial swim school in the Wibauthuis block (Wibautstraat); not a municipal bath, no street identity of its own',
  'Windsurf– Sup– & Zwemvereniging Gaasperplas': 'club house on the Gaasperplas (open water); not a pool',
  'David Lloyd Clubs': 'David Lloyd Amsterdam, Overtoom 557 (davidlloyd.nl club page; the only Dutch club in Amsterdam): indoor 20 m pool inside the Autopon building, which is already the bespoke landmark `autopon`',
  'Amsterdeck Nieuwe Meer': 'floating pool deck on the Nieuwe Meer, no BAG pand, no route within 60 m',
  'Victoriabad': 'Weesp (in the municipality since 2022)',
  'Sportplaza Mercator': 'the former Jan van Galenbad site: Sportplaza Mercator (2006) kept the outdoor basin of the Jan van Galenbad',
};
const COMPLETENESS = {
  municipalPage: 'https://www.amsterdam.nl/sport/zwemmen-in-amsterdam/ returned HTTP 403 to every scripted read on 2026-11-15; the list below is the brief\'s list checked against OSM',
  briefNames: {
    'Flevoparkbad': 'found (outdoor)', 'Brediusbad': 'found (outdoor)', 'Noorderparkbad': 'found (indoor and outdoor)', 'Sloterparkbad': 'found (indoor and outdoor)',
    'De Mirandabad': 'found (indoor and outdoor)', 'Marnixbad': 'found as Het Marnix; already the bespoke landmark `marnixbad`', 'Zuiderbad': 'found; already the bespoke landmark `zuiderbad`',
    'Het Oosterbad': 'the only OSM Het Oosterbad (n1924077363, 4.7999 52.2861) is in Hoofddorp, Haarlemmermeer: outside the municipality. Amsterdam-Oost\'s bath is Sportfondsenbad Oost, already the bespoke landmark `sportfondsenbad-oost`',
    'Jan van Galenbad': 'no longer a separate bath: Sportplaza Mercator stands on the site and kept its outdoor basin (listed as Sportplaza Mercator)',
    'Bijlmer Sportcentrum': 'found as Zwembad Bijlmer (n13057635556)', 'Floriande': 'Hoofddorp, Haarlemmermeer: outside the municipality',
  },
  outsideMunicipality: ['Het Oosterbad (Hoofddorp)', 'Floriande (Hoofddorp)', 'Amstelbad (Amstelveen)', 'De Meerkamp (Amstelveen)', 'AGO-Zwembad (Diemen)', 'Sportcentrum Wethouder F.B. Duran (Diemen)', 'Zwembad De Breek (Landsmeer)'],
  excluded: 'open-water swimming spots (leisure=swimming_area / bathing_place: Sloterstrand, Gaasperplas, IJburg, Marineterrein, Borneokade) and wading pools (pierenbadjes) are not pools in this sense',
};

// ---- already modelled ----
const covers = JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8')).models as Record<string, {p: string[]; o: string[]}>;
const pandModel = new Map<string, string>(), osmModel = new Map<string, string>();
for (const [id, c] of Object.entries(covers)) { for (const p of c.p ?? []) pandModel.set(p, id); for (const o of c.o ?? []) osmModel.set(o, id); }
const catalogue = JSON.parse(fs.readFileSync('src/canalRecall/landmarks/manualCatalogue.json', 'utf8')) as any[];

const out: any[] = [];
for (const F of facs) {
  const areaRings = F.rings.filter(r => area(r) > 4);
  const geomRings = areaRings.length ? areaRings : F.rings;
  const fb = basins.filter(b => rings(b).some(r => geomRings.some(g => ringDist(centroid(r), g) < 15)) || F.ids.includes(b.id));
  const pands = (await pandsNear(geomRings, areaRings.length ? 5 : 25)).filter(p => p.status !== 'Pand gesloopt' && p.status !== 'Niet gerealiseerd pand');
  const own = pands.filter(p => (areaRings.length ? geomRings.some(g => inRing(centroid(p.ring), g)) : geomRings.some(g => inRing(centroid(g), p.ring))) && area(p.ring) > 25);
  const basinInfo = fb.map(b => {
    const r = rings(b)[0], c = centroid(r);
    const under = pands.find(p => inRing(c, p.ring));
    return {osm: b.id, name: t(b).name ?? null, areaM2: Math.round(area(r)), indoor: !!under || t(b).indoor === 'yes' || t(b).location === 'indoor', pand: under?.id ?? null};
  });
  const tags = Object.assign({}, ...F.feats.map(f => t(f)));
  const anyOutdoor = basinInfo.some(b => !b.indoor && b.areaM2 > 100) || F.feats.some(f => t(f).leisure === 'water_park');
  // indoor: a basin under a pand, an indoor-tagged pool, or a bath hall (a pand of 1,200 m2 or more) on the site
  const anyIndoor = basinInfo.some(b => b.indoor) || F.feats.some(f => t(f).location === 'indoor' || t(f).indoor === 'yes' || !!t(f).building) || own.some(p => area(p.ring) >= 1200) || (!anyOutdoor && own.length > 0);
  const modelled = [...new Set([...own.map(p => pandModel.get(p.id)), ...F.ids.map(i => osmModel.get(i.replace(/^a(\d+)$/, (_, n) => (Number(n) % 2 === 0 ? `w${Number(n) / 2}` : `r${(Number(n) - 1) / 2}`))))].filter(Boolean))];
  const nameHit = catalogue.filter(e => F.name && e.name && e.name.toLowerCase().includes(F.name.toLowerCase().replace(/^(zwembad|het|de) /, ''))).map(e => e.id);
  const main = own.sort((a, b) => area(b.ring) - area(a.ring))[0];
  const c = main ? centroid(main.ring) : centroid(geomRings[0]);
  const rd = lngLatToRd(c[0] / KX, c[1] / KY);
  let panos: any[] = [];
  try { panos = await listPanos({x: rd[0], y: rd[1]}, 60); } catch (e) { console.warn('pano list failed', F.name, String(e)); }
  const recent = panos.filter(p => Number(String(p.timestamp).slice(0, 4)) >= 2020);
  out.push({
    name: F.name || '(unnamed)', osm: F.ids, tags: pick(tags, ['leisure', 'sport', 'access', 'operator', 'brand', 'website', 'addr:street', 'addr:housenumber', 'indoor', 'opening_hours', 'fee', 'wikidata', 'heritage']),
    centre: [+(c[0] / KX).toFixed(6), +(c[1] / KY).toFixed(6)],
    kind: isDavidLloyd(F.feats[0]) || F.feats.some(isDavidLloyd) ? 'members-club' : anyIndoor && anyOutdoor ? 'both' : anyOutdoor ? 'outdoor' : 'indoor',
    basins: basinInfo,
    pands: own.map(p => ({id: p.id, year: p.year, areaM2: Math.round(area(p.ring)), modelledBy: pandModel.get(p.id) ?? null})),
    modelled: modelled.length ? modelled : nameHit.length ? nameHit : null,
    rideExposureM: exposure(geomRings),
    note: NOTES[F.name] ?? null,
    panoramas: {within60m: panos.length, since2020: recent.length, nearestIds: panos.slice(0, 3).map(p => p.pano_id ?? p.id)},
  });
  console.log(F.name.padEnd(40), out.at(-1).kind.padEnd(8), 'pands', String(own.length).padStart(2), 'basins', String(fb.length).padStart(2), 'ride', String(out.at(-1).rideExposureM).padStart(5), 'm', out.at(-1).modelled ?? '');
}
function pick(o: Record<string, string>, ks: string[]) { return Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]])); }

// an unnamed duplicate (a node on a named bath's pand) folds into the named row; other unnamed rows are wading pools or open water
for (let i = out.length - 1; i >= 0; i--) {
  const r = out[i];
  if (r.name !== '(unnamed)') continue;
  const twin = out.find(o => o !== r && o.name !== '(unnamed)' && o.pands.some((p: any) => r.pands.some((q: any) => q.id === p.id)));
  if (twin) { twin.osm.push(...r.osm); out.splice(i, 1); continue; }
  r.note = r.tags.leisure === 'water_park' ? 'unnamed wading pool (pierenbad) in a park: no building, basin under 400 m2 or not drawn in OSM; skipped' : 'unnamed swimming point on open water; skipped';
}
out.sort((a, b) => b.rideExposureM - a.rideExposureM);
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10), generator: 'scripts/landmarks/pools-inventory.ts', osmSource: `${PBF} (OSM, ODbL)`,
  completeness: COMPLETENESS, pools: out,
}, null, 1) + '\n');
console.log('wrote', OUT, out.length, 'facilities');
