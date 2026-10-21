/**
 * Haarlemmerweg corridor inventory, Molenwerf (west) to Solebaystraat / Nieuwpoortstraat (east), Amsterdam.
 *
 *   node --import tsx scripts/landmarks/haarlemmerweg-corridor-inventory.ts
 *
 * Writes scripts/landmarks/haarlemmerweg-corridor-inventory.json: one row per BAG pand that fronts that stretch of
 * Haarlemmerweg, with its addresses, footprint, height, storeys, use, street-facing walls, panorama coverage, current
 * model status and the lane classification (TRACK_M / STREET_SURVEY / TRACK_L / NO_EVIDENCE / ALREADY_MODELLED).
 *
 * The user typed "Haarlemmerdijk"; the screenshot they sent (Kennedy Van der Laan, WJ Digital Marketing, MB limousines
 * and Gymbase Westerpark on the north side; Stichting De Gibraltar, Amsterdam Skin care, Taco Lindo West and Dojo
 * Doorje on the south side) is this Haarlemmerweg stretch, and that is what is inventoried here.
 *
 * Open data only, queried 2026-10-20 and cached under .cache/haarlemmerweg-corridor:
 *  - PDOK BAG WFS 2.0 `bag:verblijfsobject`, one walk per `openbare_ruimte` (OGC filter; PDOK ignores CQL_FILTER and
 *    reports no page total, so the walk pages on startIndex and de-duplicates by identificatie).
 *  - PDOK BAG WFS 2.0 `bag:pand` by `identificatie` (bouwjaar, gebruiksdoel).
 *  - 3DBAG API `collections/pand/items` (RD bbox, 100 CityObjects per page via `offset`) for b3_bouwlagen,
 *    b3_h_dak_50p, b3_h_dak_max, b3_h_maaiveld and b3_dak_type.
 *  - The extraction's BAG footprint tiles `public/data/extracts/amsterdam/building-tiles/14/<x>/<y>.geojson.gz`, the
 *    same tiles `scripts/pand-reference/core.ts` reads. One pand may be several features (raised parts); every ring is
 *    kept and the footprint is their sum.
 *  - The road axis: the OSM `name=Haarlemmerweg` ways in `public/data/extracts/amsterdam/streets-routing.json`
 *    (openstreetmap.org, ODbL) clipped to the corridor window.
 *  - Coverage: manualCatalogue.json, ordinary-buildings-data/catalogue.json, models/covers.json and
 *    building-recipes/houses/<id>/{facts,intent}.json.
 *  - Panoramas: Gemeente Amsterdam (CC BY 4.0) through `scripts/pand-reference/all-walls.ts --pand=<id>`; the row is
 *    read back from `staging/pand-reference-walls/<pand>/walls.json` after that run.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

const CACHE = path.resolve('.cache/haarlemmerweg-corridor');
const OUT = 'scripts/landmarks/haarlemmerweg-corridor-inventory.json';
const QUERY_DATE = '2026-10-20';
const TILES = 'public/data/extracts/amsterdam/building-tiles/14';

/** The stretch. Molenwerf junction west, Solebaystraat junction east (+Nieuwpoortstraat, which is the next corner). */
const WINDOW = { west: 4.8462, east: 4.8582, south: 52.3836, north: 52.3864 };
const CORNER_STREETS = ['Gibraltarstraat', 'Van Gentstraat', 'Kijkduinstraat', 'Livornostraat', 'Solebaystraat',
  'Nieuwpoortstraat', 'Molenwerf'];
const STREETS = ['Haarlemmerweg', ...CORNER_STREETS];
/**
 * A pand fronts the corridor when one of its outline parts comes this close to the Haarlemmerweg road axis. The OSM
 * centreline of this stretch runs along the southern carriageway: the 1930s row on the south side fronts it at 6-7 m,
 * while the north side keeps a wide verge and service road in front of its office blocks (30-40 m). One threshold
 * would either drop the north front or swallow the second row, so the limit is per side.
 */
const FRONTAGE_M = 20;
const FRONTAGE_NORTH_M = 55;

const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const mPerDegLat = 111320;
const mPerDegLng = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180);
const round = (v: number, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

type Vbo = { id: string; street: string; number: number; label: string; use: string; area: number; pand: string;
  lng: number; lat: number };
type Pt = [number, number];

async function cached(key: string, url: string): Promise<any> {
  const file = path.join(CACHE, key + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'MapRecall-PandReference/1.0 (+open data)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const json = await res.json();
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (error) { last = error; await new Promise(r => setTimeout(r, 800 * 2 ** attempt)); }
  }
  throw last;
}

function wfsFilter(property: string, values: string[]): string {
  const equal = values.map(v => `<PropertyIsEqualTo><PropertyName>${property}</PropertyName>`
    + `<Literal>${v}</Literal></PropertyIsEqualTo>`).join('');
  return `<Filter>${values.length === 1 ? equal : `<Or>${equal}</Or>`}</Filter>`;
}

/** Walk one WFS attribute filter with startIndex (no totalFeatures, and startIndex is not perfectly stable). */
async function wfsValue(typeName: string, property: string, value: string, count = 500): Promise<any[]> {
  const out: any[] = [];
  for (let start = 0; start < 5000; start += count) {
    const query = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName,
      outputFormat: 'application/json', count: String(count), startIndex: String(start),
      filter: wfsFilter(property, [value]), srsName: 'EPSG:4326' });
    const json = await cached(`wfs-${typeName.replace(':', '-')}-${value.replace(/\W+/g, '_')}-${start}`,
      `${WFS}?${query}`);
    out.push(...(json.features ?? []));
    if (!(json.features ?? []).length) break;
  }
  return out;
}

async function wfsIds(typeName: string, property: string, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const query = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName,
      outputFormat: 'application/json', count: '500', filter: wfsFilter(property, batch), srsName: 'EPSG:4326' });
    const json = await cached(`wfs-ids-${typeName.replace(':', '-')}-${i}-${ids.length}`, `${WFS}?${query}`);
    out.push(...(json.features ?? []));
  }
  return out;
}

// ---- footprints from the extraction tiles (one pand may be several parts) ------------------------------------
const tileOf = (lng: number, lat: number) => {
  const n = 2 ** 14, s = Math.sin(lat * Math.PI / 180);
  return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) };
};
const parts = new Map<string, Pt[][]>();
{
  const a = tileOf(WINDOW.west, WINDOW.north), b = tileOf(WINDOW.east, WINDOW.south);
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
    const file = path.join(TILES, String(x), `${y}.geojson.gz`);
    if (!fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    const json = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
    for (const feature of json.features) {
      const id = String(feature.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      const geometry = feature.geometry;
      const polygons: Pt[][][] = geometry.type === 'Polygon' ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      const key = id.replace('NL.IMBAG.Pand.', '');
      const list = parts.get(key) ?? [];
      for (const polygon of polygons) list.push(polygon[0].map((p: number[]) => [p[0], p[1]] as Pt));
      parts.set(key, list);
    }
  }
}

// ---- the road axis: OSM Haarlemmerweg ways clipped to the window --------------------------------------------
const axis: Pt[] = [];
{
  const inWindow = (p: Pt) => p[0] >= WINDOW.west - 0.0008 && p[0] <= WINDOW.east + 0.0008
    && p[1] >= WINDOW.south - 0.0010 && p[1] <= WINDOW.north + 0.0010;
  const streets = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[];
  for (const way of streets) {
    if (way.name !== 'Haarlemmerweg') continue;
    if (/cycleway|footway|path|steps|service/.test(way.highway ?? '')) continue;
    for (const line of (way.paths ?? [way.path]) as number[][][]) {
      const points = line.map(p => [p[1], p[0]] as Pt);
      for (let i = 0; i + 1 < points.length; i++) if (inWindow(points[i]) && inWindow(points[i + 1]))
        axis.push(points[i], points[i + 1]);
    }
  }
}
if (axis.length < 8) throw new Error('no OSM Haarlemmerweg geometry in streets-routing.json');
const nearestOnAxis = (p: Pt) => {
  let best = { d: Infinity, lat: 0, lng: 0 };
  const kx = mPerDegLng(p[1]);
  for (let i = 0; i + 1 < axis.length; i += 2) {
    const a = axis[i], b = axis[i + 1];
    const ax = a[0] * kx, ay = a[1] * mPerDegLat, bx = b[0] * kx, by = b[1] * mPerDegLat;
    const px = p[0] * kx, py = p[1] * mPerDegLat;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    if (d < best.d) best = { d, lat: a[1] + (b[1] - a[1]) * t, lng: a[0] + (b[0] - a[0]) * t };
  }
  return best;
};

// ---- coverage: what already stands on this ground ---------------------------------------------------------
const pandPattern = /(\d{16})/;
const covered = new Map<string, string[]>();
function cover(id: string, source: string) {
  const list = covered.get(id) ?? [];
  if (!source || list.includes(source)) return;
  list.push(source);
  covered.set(id, list);
}
{
  const manual: any = JSON.parse(fs.readFileSync('src/canalRecall/landmarks/manualCatalogue.json', 'utf8'));
  const models: any[] = Array.isArray(manual) ? manual : (manual.models ?? manual.entries ?? Object.values(manual));
  for (const model of models) {
    if (!model?.id) continue;
    for (const value of [...(model.suppressOsmIds ?? []), model.pandId, model.buildingId].filter(Boolean) as string[]) {
      const m = String(value).match(pandPattern);
      if (m) cover(m[1], `landmark:${model.id}${model.status ? `(${model.status})` : ''}`);
    }
  }
  const ordinary = JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8'));
  for (const model of Object.values(ordinary.models ?? {}) as any[]) {
    const m = String(model.buildingId ?? '').match(pandPattern);
    if (m) cover(m[1], `ordinary:${model.id}`);
  }
  const coversFile = 'public/canal-drive/models/covers.json';
  if (fs.existsSync(coversFile)) {
    const covers = JSON.parse(fs.readFileSync(coversFile, 'utf8'));
    for (const [model, entry] of Object.entries(covers.models ?? {}) as [string, any][]) {
      for (const p of entry.p ?? []) {
        const m = String(p).match(pandPattern);
        if (m) cover(m[1], `installed:${model}`);
      }
    }
  }
  for (const house of fs.readdirSync('scripts/building-recipes/houses')) {
    for (const file of ['facts.json', 'intent.json']) {
      const f = path.join('scripts/building-recipes/houses', house, file);
      if (!fs.existsSync(f)) continue;
      try {
        const json = JSON.parse(fs.readFileSync(f, 'utf8'));
        const m = String(json.pandId ?? '').match(pandPattern);
        if (m) cover(m[1], `recipe:${house}`);
      } catch { /* drafts that do not parse are not coverage */ }
    }
  }
}

// ---- addresses -----------------------------------------------------------------------------------------------
const vbos = new Map<string, Vbo>();
for (const street of STREETS) {
  for (const feature of await wfsValue('bag:verblijfsobject', 'openbare_ruimte', street)) {
    const p = feature.properties ?? {};
    const point = feature.geometry?.coordinates;
    if (p.openbare_ruimte !== street || !point || vbos.has(p.identificatie)) continue;
    vbos.set(p.identificatie, { id: p.identificatie, street, number: Number(p.huisnummer),
      label: `${p.huisnummer}${p.huisletter ?? ''}${p.toevoeging ? `-${p.toevoeging}` : ''}`,
      use: p.gebruiksdoel ?? '', area: Number(p.oppervlakte) || 0, pand: String(p.pandidentificatie ?? '').replace(/\D/g, ''),
      lng: point[0], lat: point[1] });
  }
}
const vboList = [...vbos.values()];

// ---- scope: frontage, not address ----------------------------------------------------------------------------
const inScope = new Map<string, { distance: number; side: 'north' | 'south'; frontage: number }>();
for (const [id, ringParts] of parts) {
  let nearest = Infinity, frontage = 0, nearestLat = 0;
  for (const ring of ringParts) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const hitP = nearestOnAxis(p), hitQ = nearestOnAxis(q);
      if (hitP.d < nearest) { nearest = hitP.d; nearestLat = hitP.lat; }
      const len = Math.hypot((q[0] - p[0]) * mPerDegLng(p[1]), (q[1] - p[1]) * mPerDegLat);
      if (len < 3) continue;
      // Only a facet whose own normal points at the road is frontage; the rest is a flank or a party wall.
      const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const hit = nearestOnAxis(mid);
      const dx = (hit.lng - mid[0]) * mPerDegLng(mid[1]), dy = (hit.lat - mid[1]) * mPerDegLat;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = (q[1] - p[1]) * mPerDegLat, ny = -(q[0] - p[0]) * mPerDegLng(mid[1]);
      const nl = Math.hypot(nx, ny) || 1;
      const facesRoad = Math.abs(nx * dx + ny * dy) / (nl * distance) > 0.5;
      if (facesRoad && Math.max(hitP.d, hitQ.d) <= (mid[1] > hit.lat ? FRONTAGE_NORTH_M : FRONTAGE_M)) frontage += len;
    }
  }
  const centre = ringParts.flat().reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]) as Pt;
  const n = ringParts.reduce((s, r) => s + r.length, 0);
  const c: Pt = [centre[0] / n, centre[1] / n];
  const side: 'north' | 'south' = c[1] > nearestLat ? 'north' : 'south';
  if (nearest > (side === 'north' ? FRONTAGE_NORTH_M : FRONTAGE_M)) continue;
  if (c[0] < WINDOW.west - 0.0004 || c[0] > WINDOW.east + 0.0004) continue;
  if (c[1] < WINDOW.south - 0.0006 || c[1] > WINDOW.north + 0.0006) continue;
  inScope.set(id, { distance: round(nearest, 1), side, frontage: round(frontage, 1) });
}

// ---- BAG pand and 3DBAG facts --------------------------------------------------------------------------------
/** bag-facts mid descriptor (archetype, storeys, roof, eaves, ridge, year, terraced) as the storeys fallback. */
const descriptors = new Map<string, { archetype: string; storeys: number; year: number }>();
const ARCHETYPES = ['unknown', 'canal-house', 'c19-terrace', 'c19-house', 'school-block', 'modern-block', 'modern-house', 'tower', 'large-flat', 'outbuilding'];
{
  const a = tileOf(WINDOW.west, WINDOW.north), b = tileOf(WINDOW.east, WINDOW.south);
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
    const file = path.join('public/data/extracts/amsterdam/bag-facts/14', String(x), `${y}.json.gz`);
    if (!fs.existsSync(file)) continue;
    const json = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
    for (const [id, row] of Object.entries(json.pands ?? {}) as [string, number[]][])
      descriptors.set(id, { archetype: ARCHETYPES[row[0]] ?? 'unknown', storeys: row[1], year: row[5] });
  }
}

const pandFacts = new Map<string, any>();
for (const feature of await wfsIds('bag:pand', 'identificatie', [...inScope.keys()]))
  pandFacts.set(feature.properties.identificatie, feature.properties);
const b3 = new Map<string, any>();
{
  /** The items endpoint caps a page at 100 CityObjects and rejects offset=0, so a full cell is split in four. */
  const fetchBox = async (key: string, box: number[]) => {
    const json = await cached(`3dbag-${key}`, 'https://api.3dbag.nl/collections/pand/items?limit=1000&bbox='
      + box.map(v => Math.round(v)).join(','));
    let raw = 0;
    for (const feature of json.features ?? []) for (const [id, value] of Object.entries(feature.CityObjects ?? {})) {
      raw++;
      const attributes = (value as any)?.attributes;
      if (!attributes) continue;
      b3.set(String(id).replace('NL.IMBAG.Pand.', ''), attributes);
    }
    return raw;
  };
  const walk = async (box: number[], depth = 0): Promise<void> => {
    const raw = await fetchBox(`${Math.round(box[0])}-${Math.round(box[1])}-${Math.round(box[2])}-${Math.round(box[3])}`, box);
    // The endpoint caps a response at 100 CityObjects (pand parts included): a full cell may be truncated.
    if (raw < 100) return;
    if (depth > 5) throw new Error('3DBAG cell still full: shrink the corridor bbox');
    const [minX, minY, maxX, maxY] = box, midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    for (const cell of [[minX, minY, midX, midY], [midX, minY, maxX, midY], [minX, midY, midX, maxY],
      [midX, midY, maxX, maxY]]) await walk(cell, depth + 1);
  };
  const corners = [lngLatToRd([WINDOW.west, WINDOW.south]), lngLatToRd([WINDOW.east, WINDOW.north])];
  await walk([corners[0].x - 20, corners[0].y - 20, corners[1].x + 20, corners[1].y + 20]);
}

// ---- panorama availability, from any all-walls run already made ------------------------------------------------
function panorama(pand: string) {
  const file = path.join('staging/pand-reference-walls', pand, 'walls.json');
  const empty = { sampled: false, walls: 0, corridorWalls: 0, usable: 0, usableCorridor: 0, dates: [] as string[],
    panoramas: [] as string[], maxDistM: null as number | null };
  if (!fs.existsSync(file)) return empty;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list: any[] = Array.isArray(parsed) ? parsed : (parsed.walls ?? []);
    // A wall "faces the corridor" when its outward normal points at the nearest point of the road axis.
    const facesCorridor = (row: any) => {
      const normal = row.wallRD?.normal, centre = row.centre;
      if (!Array.isArray(normal) || !centre) return false;
      const hit = nearestOnAxis(centre as Pt);
      const at = lngLatToRd([hit.lng, hit.lat]);
      const from = lngLatToRd([centre[0], centre[1]]);
      const dx = at.x - from.x, dy = at.y - from.y, len = Math.hypot(dx, dy) || 1;
      return (normal[0] * dx + normal[1] * dy) / len > 0.5;
    };
    const usable = list.filter(row => row.panoId && row.crop);
    const corridor = usable.filter(facesCorridor);
    return {
      sampled: true, walls: list.length, corridorWalls: corridor.length, usable: usable.length,
      usableCorridor: corridor.length,
      dates: [...new Set(usable.map(row => String(row.capturedAt ?? '').slice(0, 10)).filter(Boolean))].sort() as string[],
      panoramas: [...new Set(corridor.map(row => String(row.panoId)))].slice(0, 4),
      maxDistM: corridor.length ? round(Math.max(...corridor.map(row => Number(row.cameraDistM) || 0)), 1) : null,
    };
  } catch { return empty; }
}

// ---- rows -----------------------------------------------------------------------------------------------------
const ringArea = (ring: Pt[]) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(sum) / 2 * mPerDegLat * mPerDegLng(52.385);
};

type Row = {
  pand: string; addresses: string[]; addressCount: number; side: 'north' | 'south'; footprintM2: number;
  heightM: number | null; roofMaxM: number | null; storeys: number | null; groundLevelM: number | null;
  roofType: string | null; builtYear: number | null; uses: string[]; streetWalls: number; corridorFrontageM: number;
  roadDistanceM: number; panorama: ReturnType<typeof panorama>;
  status: 'modelled' | 'recipe-house' | 'ordinary-catalogue' | 'installed' | 'grey';
  coveredBy: string[]; classification: string; reason: string; anchor: [number, number];
};
const rows: Row[] = [];
for (const pand of [...inScope.keys()].sort()) {
  const ringParts = parts.get(pand)!;
  const scope = inScope.get(pand)!;
  const related = vboList.filter(v => v.pand === pand);
  const points = ringParts.flat();
  const centre: Pt = [points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length];
  const facts = pandFacts.get(pand);
  const attributes = b3.get(pand);
  const coverage = covered.get(pand) ?? [];
  const status: Row['status'] = coverage.some(c => c.startsWith('landmark:')) ? 'modelled'
    : coverage.some(c => c.startsWith('recipe:')) ? 'recipe-house'
    : coverage.some(c => c.startsWith('ordinary:')) ? 'ordinary-catalogue'
    : coverage.some(c => c.startsWith('installed:')) ? 'installed' : 'grey';
  let walls = 0;
  for (const ring of ringParts) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (Math.hypot((b[0] - a[0]) * mPerDegLng(a[1]), (b[1] - a[1]) * mPerDegLat) >= 3) walls++;
  }
  rows.push({
    pand,
    addresses: [...new Set(related.map(v => `${v.street} ${v.label}`))]
      .sort((a, b) => a.localeCompare(b, 'nl', { numeric: true })),
    addressCount: related.length,
    side: scope.side,
    footprintM2: Math.round(ringParts.reduce((sum, ring) => sum + ringArea(ring), 0)),
    heightM: attributes?.b3_h_dak_50p != null ? round(Number(attributes.b3_h_dak_50p), 1) : null,
    roofMaxM: attributes?.b3_h_dak_max != null ? round(Number(attributes.b3_h_dak_max), 1) : null,
    storeys: attributes?.b3_bouwlagen != null ? Number(attributes.b3_bouwlagen)
      : (descriptors.get(pand)?.storeys ?? null),
    groundLevelM: attributes?.b3_h_maaiveld != null ? round(Number(attributes.b3_h_maaiveld), 2) : null,
    roofType: attributes?.b3_dak_type ?? null,
    builtYear: facts?.bouwjaar ? Number(facts.bouwjaar) : (descriptors.get(pand)?.year || null),
    archetype: descriptors.get(pand)?.archetype ?? null,
    uses: [...new Set(related.map(v => v.use).filter(Boolean))],
    streetWalls: walls,
    corridorFrontageM: scope.frontage,
    roadDistanceM: scope.distance,
    panorama: panorama(pand),
    status, coveredBy: coverage,
    classification: '', reason: '', anchor: [round(centre[0], 7), round(centre[1], 7)],
  });
}

// ---- classification ------------------------------------------------------------------------------------------
/**
 * TRACK_M        a grid-fronted block the `kind: "large"` recipe can carry: office/retail/meeting/education use or a
 *                modern flat-roof block, with a real repeating front and <= 12k triangles of geometry.
 * STREET_SURVEY  a repetitive residential row or a row of shops under flats: the block-face / block-kit street survey
 *                pipeline, not one bespoke model per address.
 * TRACK_L        an ornamented historic front (pre-1900 front, stone dressings, sculpted or stepped gable) that needs a
 *                bespoke builder.
 * NO_EVIDENCE    a corridor-facing wall was sampled and no usable panorama reaches it.
 * ALREADY_MODELLED  a landmark, ordinary model or installed recipe already stands on this ground.
 */
const CIVIC_USE = /^(kantoor|winkel|bijeenkomst|onderwijs|gezondheid|celfunctie|logies|industri|sport|overige)/;
for (const row of rows) {
  const factsLine = `${row.footprintM2} m2, ${row.storeys ?? '?'} storeys, ${row.builtYear ?? '?'}`
    + `${row.heightM != null ? `, ${row.heightM} m` : ''}, ${row.corridorFrontageM} m frontage, `
    + `${row.roadDistanceM} m off the road axis, ${row.side} side`;
  if (row.status !== 'grey') {
    row.classification = 'ALREADY_MODELLED';
    row.reason = `${factsLine}; already covered by ${row.coveredBy.join(', ')}`;
    continue;
  }
  const civic = row.uses.some(u => CIVIC_USE.test(u));
  const residentialOnly = row.uses.length > 0 && row.uses.every(u => u === 'woonfunctie');
  const flat = row.roofType === 'flat'
    || (row.roofMaxM != null && row.heightM != null && row.roofMaxM - row.heightM < 3.0);
  const big = row.footprintM2 >= 450 && row.corridorFrontageM >= 12;
  const modern = row.builtYear !== null && row.builtYear >= 1985;
  const evidence = row.panorama.usableCorridor > 0;
  const panoLine = row.panorama.sampled
    ? `${row.panorama.usableCorridor} corridor-facing wall(s) with a panorama${row.panorama.dates.length ? ` (${row.panorama.dates.join(', ')})` : ''}`
    : 'panorama not sampled yet';
  if (row.builtYear !== null && row.builtYear < 1900) {
    row.classification = evidence ? 'TRACK_L' : 'NO_EVIDENCE';
    row.reason = `${factsLine}; pre-1900 front — bespoke builder, the kit cannot draw an ornamented historic front; ${panoLine}`;
  } else if (big && (civic || (flat && modern)) && !residentialOnly) {
    row.classification = evidence ? 'TRACK_M' : 'NO_EVIDENCE';
    row.reason = `${factsLine}; ${row.uses.join('/') || 'no address'}; ${flat ? 'flat/low roof' : 'pitched roof'}; `
      + `${evidence ? '' : 'TRACK_M-shaped but '}${panoLine}`;
  } else {
    // A repetitive row house is surveyed on its block face, not pand by pand: its own party-walled sides are expected
    // to carry no panorama, so a missing crop here is not a NO_EVIDENCE verdict for the ground.
    row.classification = 'STREET_SURVEY';
    row.reason = `${factsLine}; ${row.uses.join('/') || 'no address'} — repetitive row, block-face survey; ${panoLine}`;
  }
}

const tally = rows.reduce((acc: Record<string, number>, row) => {
  acc[row.classification] = (acc[row.classification] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

const inventory = {
  schemaVersion: 2,
  corridor: 'Haarlemmerweg, Amsterdam — Molenwerf (west) to Solebaystraat (east), both sides, including the corner '
    + 'buildings that front Haarlemmerweg from Gibraltarstraat, Van Gentstraat, Kijkduinstraat, Livornostraat, '
    + 'Solebaystraat and Nieuwpoortstraat',
  userCorridorLabel: 'The user typed "Haarlemmerdijk"; the screenshot corridor (Kennedy Van der Laan, WJ Digital '
    + 'Marketing, MB limousines and Gymbase Westerpark to the north; Stichting De Gibraltar, Amsterdam Skin care, Taco '
    + 'Lindo West and Dojo Doorje to the south) is this Haarlemmerweg stretch, and that is what is inventoried.',
  queryDate: QUERY_DATE,
  window: WINDOW,
  frontageMetres: { south: FRONTAGE_M, north: FRONTAGE_NORTH_M },
  sources: {
    addresses: `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject`
      + `&outputFormat=application/json&count=500&startIndex=<n>&filter=<Filter><PropertyIsEqualTo>`
      + `<PropertyName>openbare_ruimte</PropertyName><Literal>Haarlemmerweg</Literal></PropertyIsEqualTo></Filter>`
      + ` — one walk per street in: ${STREETS.join(', ')}`,
    pands: `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json`
      + `&filter=<Filter><Or><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>0363…`
      + `</Or></Filter> (bouwjaar, gebruiksdoel)`,
    heights: 'https://api.3dbag.nl/collections/pand/items?limit=100&offset=<n>&bbox=118150,488380,118990,488960 '
      + '(b3_bouwlagen, b3_h_dak_50p, b3_h_dak_max, b3_h_maaiveld, b3_dak_type)',
    footprints: `${TILES}/<x>/<y>.geojson.gz (NL.IMBAG.Pand.* rings; the same tiles scripts/pand-reference/core.ts `
      + 'reads; all parts of a pand are kept)',
    axis: 'public/data/extracts/amsterdam/streets-routing.json, name=Haarlemmerweg, highway classes except '
      + 'cycleway/footway/path/steps/service (OpenStreetMap, ODbL)',
    coverage: ['src/canalRecall/landmarks/manualCatalogue.json', 'public/canal-drive/models/covers.json',
      'public/canal-drive/ordinary-buildings-data/catalogue.json',
      'scripts/building-recipes/houses/*/{facts,intent}.json'],
    panoramas: 'node --import tsx scripts/pand-reference/all-walls.ts --pand=<id> --min-len=8 --max=6 '
      + '(Gemeente Amsterdam panoramas, CC BY 4.0, via api.data.amsterdam.nl); read back from '
      + 'staging/pand-reference-walls/<pand>/walls.json',
  },
  tally,
  phase2: {
    note: 'The three TRACK_M pands with usable corridor-facing panorama evidence, taken in this lane.',
    candidates: rows.filter(row => row.classification === 'TRACK_M')
      .sort((a, b) => (b.panorama.usableCorridor - a.panorama.usableCorridor) || (b.footprintM2 - a.footprintM2))
      .map(row => ({ pand: row.pand, addresses: row.addresses.slice(0, 2), footprintM2: row.footprintM2,
        heightM: row.heightM, storeys: row.storeys, builtYear: row.builtYear, side: row.side,
        panorama: row.panorama })),
  },
  nextSteps: {
    STREET_SURVEY: 'The 1930s and 1980s rows on the south side (Haarlemmerweg 485-645 and the Gibraltarstraat / '
      + 'Van Gentstraat / Kijkduinstraat / Livornostraat / Solebaystraat corners) are repetitive frontages: they need '
      + 'the block-face / block-kit street survey (one rhythm per block face, shared facade recipe), not one large '
      + 'recipe or bespoke model per address. Those blocks carry the shopfronts the user photographed (Stichting De '
      + 'Gibraltar, Amsterdam Skin care, Taco Lindo West, Dojo Doorje).',
    TRACK_L: 'No pand in this window is a pre-1900 ornamented historic front, so this corridor produced no TRACK_L row. '
      + 'If the 1930s corner blocks at Haarlemmerweg 507-519 (decorative brick fronts over shopfronts) are judged '
      + 'ornamented enough to need a bespoke builder rather than the block-face survey, they are the only Track L '
      + 'candidates here and need a Track L lane with its own inventory and elevations.',
    NO_EVIDENCE: 'Molenwerf 1, Molenwerf 2 and Haarlemmerweg 518A are TRACK_M-shaped but no panorama reaches a '
      + 'corridor-facing wall (the Molenwerf blocks sit 29-38 m back behind their forecourt, and 518A is a 2023 tower '
      + 'whose road wall the 2022 capture does not cover). They stay unbuilt until a panorama, a Beeldbank photo or '
      + 'another open source shows the front.',
  },
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(inventory, null, 1) + '\n');
console.log(`wrote ${OUT}: ${rows.length} pands`, tally, `\n3DBAG facts: ${b3.size} pands`);
