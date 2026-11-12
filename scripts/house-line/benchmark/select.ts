/**
 * Facade benchmark (lane F4, #379): the pands of each benchmark group, from BAG addresses.
 *
 *   node --import tsx scripts/house-line/benchmark/select.ts [--groups scripts/house-line/benchmark/groups-v1.json] [--out <file>]
 *
 * A group is a contiguous run on one street ({street, from, to, parity}) or a corner block ({streets, at, radiusM}: every pand
 * with an address on one of `streets` within radiusM of the address `at`). Source: PDOK locatieserver (the run's ends) and
 * PDOK BAG OGC API v2 verblijfsobject + pand in a bbox around them, cached under .cache/pand-reference. Writes the candidate
 * list (pandId, addresses, build year, BAG status, ground uses) that benchmark-v1.json is labelled from; no labels here.
 */
import fs from 'node:fs';
import { cachedJson, lngLatToRd } from '../../pand-reference/core.ts';

export type Group =
  | { id: string; kind: string; street: string; from: number; to: number; parity?: 'even' | 'odd' | 'both'; minYear?: number; maxYear?: number; why: string }
  | { id: string; kind: string; streets: string[]; at: string; radiusM: number; why: string };
type Unit = { street: string; number: number; letter: string | null; suffix: string | null; use: string; pandHref: string; rd: [number, number] };
export type Candidate = { pandId: string; group: string; addresses: string[]; street: string; numbers: number[]; buildYear: number | null; status: string; groundUses: string[] };

const CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

const LS = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const rdOf = (wkt: string) => { const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(wkt)!; return { x: Number(m[1]), y: Number(m[2]) }; };

async function geocode(q: string): Promise<{ x: number; y: number }> {
  const doc = (await cachedJson(`${LS}?q=${encodeURIComponent(q)}&fq=type:adres&fq=woonplaatsnaam:Amsterdam&rows=1&fl=centroide_rd,weergavenaam`)).response?.docs?.[0];
  if (!doc) throw new Error(`no address for ${q}`);
  return rdOf(doc.centroide_rd);
}

/** Address points of a street in a number range (PDOK locatieserver, paged). */
async function addressPoints(street: string, from: number, to: number): Promise<Array<{ n: number; x: number; y: number }>> {
  const out: Array<{ n: number; x: number; y: number }> = [];
  for (let start = 0; start < 5000; start += 100) {
    const url = `${LS}?q=${encodeURIComponent(street)}&fq=type:adres&fq=woonplaatsnaam:Amsterdam&fq=straatnaam:${encodeURIComponent(`"${street}"`)}&fq=huisnummer:${encodeURIComponent(`[${from} TO ${to}]`)}&rows=100&start=${start}&fl=huisnummer,centroide_rd`;
    const r = (await cachedJson(url)).response;
    for (const d of r?.docs ?? []) out.push({ n: d.huisnummer, ...rdOf(d.centroide_rd) });
    if (!r || start + 100 >= r.numFound) break;
  }
  return out;
}

/** Verblijfsobjecten in small bboxes (120 m cells holding the points, +10 m), so a long street never pages past PDOK's limit. */
async function unitsNear(points: Array<{ x: number; y: number }>): Promise<Unit[]> {
  const cells = new Set(points.map(p => `${Math.floor(p.x / 120)},${Math.floor(p.y / 120)}`)), out: Unit[] = [];
  for (const c of cells) {
    const [i, j] = c.split(',').map(Number);
    out.push(...await unitsIn([i * 120 - 10, j * 120 - 10], [i * 120 + 130, j * 120 + 130]));
  }
  const seen = new Set<string>();
  return out.filter(u => { const k = `${u.street}|${u.number}|${u.letter}|${u.suffix}|${u.pandHref}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

async function unitsIn(min: [number, number], max: [number, number]): Promise<Unit[]> {
  const out: Unit[] = [];
  let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
  for (let page = 0; url && page < 30; page++) {
    const json: any = await cachedJson(url);
    for (const f of json.features ?? []) {
      const p = f.properties, href = (p['pand.href'] ?? [])[0];
      if (!href || /ingetrokken|niet gerealiseerd/i.test(String(p.status))) continue;
      out.push({ street: p.openbare_ruimte_naam, number: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, use: String(p.gebruiksdoel ?? ''), pandHref: href, rd: f.geometry?.coordinates ?? [NaN, NaN] });
    }
    url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  return out;
}

export async function selectGroup(g: Group): Promise<Candidate[]> {
  let units: Unit[];
  if ('street' in g) {
    const pts = await addressPoints(g.street, g.from, g.to);
    if (!pts.length) throw new Error(`no ${g.street} addresses ${g.from}-${g.to}`);
    units = (await unitsNear(pts)).filter(u => u.street === g.street && u.number >= g.from && u.number <= g.to && (g.parity === 'even' ? u.number % 2 === 0 : g.parity === 'odd' ? u.number % 2 === 1 : true));
  } else {
    const c = await geocode(g.at), r = g.radiusM;
    units = (await unitsIn([c.x - r - 10, c.y - r - 10], [c.x + r + 10, c.y + r + 10])).filter(u => g.streets.includes(u.street) && Math.hypot(u.rd[0] - c.x, u.rd[1] - c.y) <= r);
  }
  const byHref = new Map<string, Unit[]>();
  for (const u of units) byHref.set(u.pandHref, [...(byHref.get(u.pandHref) ?? []), u]);
  const out: Candidate[] = [];
  for (const [href, list] of byHref) {
    const item: any = await cachedJson(`${href}${href.includes('?') ? '&' : '?'}f=json`);
    const year = item.properties.bouwjaar ?? null;
    if ('minYear' in g && g.minYear && (year == null || year < g.minYear)) continue;
    if ('maxYear' in g && g.maxYear && (year == null || year > g.maxYear)) continue;
    const numbers = [...new Set(list.map(u => u.number))].sort((x, y) => x - y), street = list[0].street;
    out.push({
      pandId: String(item.properties.identificatie), group: g.id, street, numbers,
      addresses: [...new Set(list.map(u => `${u.street} ${u.number}${u.letter ?? ''}`))].sort(),
      buildYear: year, status: String(item.properties.status), groundUses: [...new Set(list.filter(u => !u.suffix || /^(H|huis)$/i.test(u.suffix)).map(u => u.use))],
    });
  }
  return out.sort((x, y) => x.street.localeCompare(y.street) || x.numbers[0] - y.numbers[0]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const groups: Group[] = JSON.parse(fs.readFileSync(arg('groups') ?? 'scripts/house-line/benchmark/groups-v1.json', 'utf8')).groups;
  const all: Candidate[] = [];
  for (const g of groups) {
    const c = (await selectGroup(g)).filter(x => !all.some(y => y.pandId === x.pandId));
    console.log(`${g.id.padEnd(18)} ${String(c.length).padStart(3)} pands  ${c.map(x => x.numbers[0]).join(' ')}`);
    all.push(...c);
  }
  const out = arg('out') ?? 'artifacts/critic/benchmark-candidates.json';
  fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(all, null, 1) + '\n');
  console.log(`${all.length} pands -> ${out}`);
}
