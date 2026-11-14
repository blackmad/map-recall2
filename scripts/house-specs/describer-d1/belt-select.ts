// D1 belt tranche (2026-11-14): pick the ordinary canal-belt pands to describe, ranked by where players ride.
//
// Candidates: BAG pands in the base tiles (bag-tiles/14) whose footprint centroid lies in a belt buurt (gebieden API buurten,
// cached at artifacts/coverage/raw/buurten.geojson), with a current address (PDOK BAG OGC verblijfsobject, cached under
// .cache/pand-reference, joined to the pand by point in polygon). Left out: any pand a placed model covers (covers.json:
// landmarks, bespoke, large/house recipes, ordinary GLBs, block-face chunks), building-type instances, held ordinary GLBs
// (held.json), named buildings (building-facts `n`), pands with a hand spec (scripts/house-specs/specs), AH07 (the pilot,
// staged already), pands the plan's curvature limit rules out (north-south residual of the linear origin projection > 0.4 m),
// and non-ordinary sizes (BAG year after 1940, height outside 6-30 m, footprint outside 25-900 m2).
//
// Rank: wijk tier (Grachtengordel-West and -Zuid, then Jordaan, then Burgwallen), then the street the pand's main address is
// on: the four main canals first (the belt's ride corridors), then the side canals, then other streets; whole street runs in
// house-number order so the row sheets see every front on a row. Writes <out>/belt-ids.txt (the top --n) and
// <out>/belt-select.json (every candidate with its rank keys, and the exclusion counts).
//
//   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference node --import tsx scripts/house-specs/describer-d1/belt-select.ts \
//     --out artifacts/describer-d1/belt-20261114 [--n 800]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cachedJson, http } from '../../pand-reference/core.ts';
import { lngLatToRd } from '../../../src/canalRecall/facade/rdNew.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(opt('out') ?? path.join(ROOT, 'artifacts/describer-d1/belt-20261114'));
const N = Number(opt('n') ?? 800);
http.userAgent = 'MapRecall-D1Belt/1.0 (+https://github.com/blackmad/map-recall2)';
http.minGapMs = 250;

/** Wijk tier: lower ranks first. */
export const WIJK_TIER: Record<string, number> = { AC: 0, AG: 0, AB: 1, AD: 2, AE: 2 };
/** Street tier inside a wijk: the main canals (ride corridors), then side canals, then everything else. */
export const MAIN_CANALS = ['Herengracht', 'Keizersgracht', 'Prinsengracht', 'Singel'];
export const SIDE_CANALS = ['Brouwersgracht', 'Leliegracht', 'Bloemgracht', 'Egelantiersgracht', 'Lauriergracht', 'Looiersgracht',
  'Leidsegracht', 'Reguliersgracht', 'Spiegelgracht', 'Oudezijds Voorburgwal', 'Oudezijds Achterburgwal', 'Nieuwezijds Voorburgwal',
  'Kloveniersburgwal', 'Raamgracht', 'Groenburgwal', 'Amstel', 'Rokin', 'Kattengat', 'Lijnbaansgracht'];
export const streetTier = (s: string) => MAIN_CANALS.includes(s) ? 0 : SIDE_CANALS.includes(s) ? 1 : 2;

/** North-south residual (m) of the generic layer's linear origin projection at a latitude (check-building-projection-scale.ts). */
export function curvatureResidualM(lat: number, originLat = 52.37): number {
  const R = 6_378_137, cos = Math.cos(originLat * Math.PI / 180), mpd = Math.PI * R / 180;
  const merc = (l: number) => R * Math.log(Math.tan(Math.PI / 4 + l * Math.PI / 360));
  return Math.abs((lat - originLat) * mpd - (merc(lat) - merc(originLat)) * cos);
}

type Ring = [number, number][];
const inRing = (p: [number, number], ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const areaM2 = (ring: Ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(a / 2); };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // ---- buurten
  const gj = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/coverage/raw/buurten.geojson'), 'utf8'));
  const buurten = (gj.features as any[]).filter(f => WIJK_TIER[String(f.properties.code).slice(0, 2)] !== undefined).map(f => ({
    code: String(f.properties.code), name: String(f.properties.naam),
    rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly: number[][][]) => poly[0] as Ring),
  }));
  const buurtOf = (p: [number, number]) => buurten.find(b => b.rings.some((r: Ring) => inRing(p, r)));
  let minLng = 99, minLat = 99, maxLng = -99, maxLat = -99;
  for (const b of buurten) for (const r of b.rings) for (const [x, y] of r) { minLng = Math.min(minLng, x); maxLng = Math.max(maxLng, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y); }

  // ---- exclusions
  const covers = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/covers.json'), 'utf8'));
  const modelled = new Set<string>(); for (const m of Object.values<any>(covers.models)) for (const p of m.p ?? []) modelled.add(String(p).replace('NL.IMBAG.Pand.', ''));
  const types = new Set<string>((JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/building-types/instances.json'), 'utf8')) as any[]).map(i => String(i.pand)));
  const held = new Set<string>(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/held.json'), 'utf8')).held).map(k => k.replace(/^ordinary-/, '')));
  const handSpecs = new Set(fs.readdirSync(path.join(ROOT, 'scripts/house-specs/specs')).map(f => f.replace('.json', '')));
  const ah07 = new Set(fs.readFileSync(path.join(ROOT, 'artifacts/describer-d1/ah07-ids.txt'), 'utf8').split(/\s+/).filter(Boolean));
  const named = new Set<string>();
  const factsRoot = path.join(ROOT, 'public/data/extracts/amsterdam/building-facts/14');
  for (const x of fs.readdirSync(factsRoot)) for (const f of fs.readdirSync(path.join(factsRoot, x))) {
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(factsRoot, x, f))).toString('utf8'));
    for (const [k, v] of Object.entries<any>(j.buildings ?? {})) if (Array.isArray(v) && v[3]?.n) named.add(k.replace(/^P/, ''));
  }

  // ---- pands in the belt
  type Pand = { id: string; ring: Ring; c: [number, number]; year?: number; height?: number; buurt: string; buurtName: string };
  const pands = new Map<string, Pand>();
  const tiles = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
  for (const x of fs.readdirSync(tiles).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(tiles, x)).filter(n => n.endsWith('.geojson.gz'))) {
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tiles, x, file))).toString('utf8')).features) {
      const id = String(f.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.') || f.geometry?.type !== 'Polygon') continue;
      const ring = f.geometry.coordinates[0] as Ring, n = ring.length - 1;
      const c: [number, number] = [ring.slice(0, n).reduce((a, p) => a + p[0], 0) / n, ring.slice(0, n).reduce((a, p) => a + p[1], 0) / n];
      if (c[0] < minLng || c[0] > maxLng || c[1] < minLat || c[1] > maxLat) continue;
      const b = buurtOf(c); if (!b) continue;
      const short = id.replace('NL.IMBAG.Pand.', '');
      if (!pands.has(short)) pands.set(short, { id: short, ring, c, year: Number(f.properties.year) || undefined, height: Number(f.properties.height) || undefined, buurt: b.code, buurtName: b.name });
    }
  }
  console.log(`belt pands in the base tiles: ${pands.size}`);

  // ---- addresses (PDOK verblijfsobject points in 400 m RD tiles; pand by point in polygon)
  const CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';
  const lo = lngLatToRd([minLng, minLat]), hi = lngLatToRd([maxLng, maxLat]);
  const rdRings = new Map<string, Ring>([...pands].map(([id, p]) => [id, p.ring.map(q => { const r = lngLatToRd(q); return [r.x, r.y] as [number, number]; })]));
  const grid = new Map<string, string[]>(); const G = 50;
  for (const [id, r] of rdRings) { const xs = r.map(p => p[0]), ys = r.map(p => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / G); gx <= Math.floor(Math.max(...xs) / G); gx++) for (let gy = Math.floor(Math.min(...ys) / G); gy <= Math.floor(Math.max(...ys) / G); gy++) { const k = `${gx}:${gy}`; grid.set(k, [...(grid.get(k) ?? []), id]); } }
  const addr = new Map<string, Array<{ street: string; n: number; letter: string | null; suffix: string | null; use: string }>>();
  const T = 400; let pages = 0, units = 0;
  const tilesRd: Array<[number, number]> = [];
  for (let x0 = Math.floor(lo.x / T) * T; x0 < hi.x; x0 += T) for (let y0 = Math.floor(lo.y / T) * T; y0 < hi.y; y0 += T) tilesRd.push([x0, y0]);
  // tiles in parallel (core.ts keeps at most 3 requests in flight); pages within a tile follow their `next` links
  await Promise.all(tilesRd.map(async ([x0, y0]) => {
    let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${x0},${y0},${x0 + T},${y0 + T}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
    for (let page = 0; url && page < 40; page++) {
      const json: any = await cachedJson(url); pages++;
      for (const f of json.features ?? []) {
        const p = f.properties, g = f.geometry?.coordinates;
        if (!g || /ingetrokken|niet gerealiseerd/i.test(String(p.status))) continue;
        const pt: [number, number] = Array.isArray(g[0]) ? g[0] : g;
        const hit = (grid.get(`${Math.floor(pt[0] / G)}:${Math.floor(pt[1] / G)}`) ?? []).find(id => inRing(pt, rdRings.get(id)!));
        if (!hit) continue;
        units++;
        addr.set(hit, [...(addr.get(hit) ?? []), { street: p.openbare_ruimte_naam, n: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, use: String(p.gebruiksdoel ?? '') }]);
      }
      url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
  }));
  console.log(`verblijfsobject pages ${pages}, units joined ${units}, pands with an address ${addr.size}; network requests ${http.requests}`);

  // ---- filter and rank
  const excluded: Record<string, number> = {};
  const ex = (why: string) => { excluded[why] = (excluded[why] ?? 0) + 1; return false; };
  type Cand = { pandId: string; buurt: string; buurtName: string; wijkTier: number; street: string; streetTier: number; number: number; addresses: string[]; year?: number; height?: number; areaM2: number; curvatureM: number; lngLat: [number, number] };
  const cands: Cand[] = [];
  for (const p of pands.values()) {
    const a = addr.get(p.id);
    const area = areaM2(rdRings.get(p.id)!), curv = curvatureResidualM(p.c[1]);
    const ok = (!ah07.has(p.id) || ex('AH07 pilot')) && (!modelled.has(p.id) || ex('placed model (covers.json)')) && (!types.has(p.id) || ex('building-type instance'))
      && (!held.has(p.id) || ex('held ordinary GLB')) && (!named.has(p.id) || ex('named building (building-facts)')) && (!handSpecs.has(p.id) || ex('hand spec'))
      && (!!a?.length || ex('no current address')) && (curv <= 0.4 || ex('curvature > 0.4 m'))
      && ((p.year ?? 0) <= 1940 || ex('built after 1940')) && ((p.height ?? 0) >= 6 && (p.height ?? 0) <= 30 || ex('height outside 6-30 m'))
      && (area >= 25 && area <= 900 || ex('footprint outside 25-900 m2'));
    if (!ok) continue;
    const counts = new Map<string, number>(); for (const u of a!) counts.set(u.street, (counts.get(u.street) ?? 0) + 1);
    const street = [...counts].sort((x, y) => streetTier(x[0]) - streetTier(y[0]) || y[1] - x[1])[0][0];
    const nums = a!.filter(u => u.street === street).map(u => u.n);
    cands.push({ pandId: p.id, buurt: p.buurt, buurtName: p.buurtName, wijkTier: WIJK_TIER[p.buurt.slice(0, 2)], street, streetTier: streetTier(street), number: Math.min(...nums),
      addresses: [...new Set(a!.filter(u => u.street === street).map(u => `${u.street} ${u.n}${u.letter ?? ''}`))].sort(), year: p.year, height: p.height, areaM2: Math.round(area), curvatureM: Number(curv.toFixed(3)), lngLat: [Number(p.c[0].toFixed(6)), Number(p.c[1].toFixed(6))] });
  }
  cands.sort((x, y) => x.wijkTier - y.wijkTier || x.streetTier - y.streetTier || MAIN_CANALS.indexOf(x.street) - MAIN_CANALS.indexOf(y.street) || x.street.localeCompare(y.street) || x.number - y.number);
  const pick = cands.slice(0, N);
  const byStreet: Record<string, number> = {}, byBuurt: Record<string, number> = {};
  for (const c of pick) { byStreet[c.street] = (byStreet[c.street] ?? 0) + 1; byBuurt[`${c.buurt} ${c.buurtName}`] = (byBuurt[`${c.buurt} ${c.buurtName}`] ?? 0) + 1; }
  fs.writeFileSync(path.join(OUT, 'belt-ids.txt'), `${pick.map(c => c.pandId).join('\n')}\n`);
  fs.writeFileSync(path.join(OUT, 'belt-select.json'), `${JSON.stringify({ v: 1, n: N, candidates: cands.length, picked: pick.length, excluded, byStreet, byBuurt, rows: cands.map((c, i) => ({ rank: i, picked: i < N, ...c })) }, null, 1)}\n`);
  console.log(JSON.stringify({ candidates: cands.length, excluded, byStreet, byBuurt }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
