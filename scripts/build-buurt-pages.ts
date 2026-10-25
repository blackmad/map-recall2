// Neighbourhood pages (GitHub #69): one static page per postcard neighbourhood,
// plus an index, under public/canal-drive/buurt/. The data logic is in
// src/canalRecall/buurtPages/ (data.ts picks what belongs where, template.ts
// renders it); this script only reads the extracts and catalogues and writes.
//
//   node --import tsx scripts/build-buurt-pages.ts            # write pages + shot plan
//   node --import tsx scripts/build-buurt-pages.ts --check    # exit 1 if a page is stale
//
// In-game frames come from scripts/capture-buurt-shots.mjs, which reads the shot
// plan this writes (buurt/shots/plan.json) and leaves buurt/shots/manifest.json;
// run this again afterwards so the pages pick the frames up.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBuurtPages, kitLabel, splitModelName,
  type AreaPhotoInput, type BoundaryInput, type BuildingInput, type EnrichmentInput, type FactSubjectInput,
  type HistoryInput, type KitInstanceInput, type LatLng, type NamedPlaceInput, type StoryInput, type StreetPoint,
} from '../src/canalRecall/buurtPages/data';
import { renderBuurtIndex, renderBuurtPage, type ShotManifest } from '../src/canalRecall/buurtPages/template';
import { HAND_KITS, kitIds } from '../src/canalRecall/landmarkKits';
import { describeRegisteredBridge, type BridgeRegisterFile } from '../src/canalRecall/bridgeRegister';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const CANAL = path.join(ROOT, 'public/canal-drive');
const OUT = path.join(CANAL, 'buurt');
const SHOTS = path.join(OUT, 'shots');
const check = process.argv.includes('--check');
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const ex = <T>(name: string): T => readJson<T>(path.join(EXTRACT, name));

type Located = { id: string; name: string; center?: LatLng; path?: LatLng[]; paths?: LatLng[][]; prominenceScore?: number; highway?: string };
const pointsOf = (f: Located, whole: boolean): LatLng[] => {
  if (!whole) return f.center ? [f.center] : [];
  const paths = f.paths?.length ? f.paths : f.path ? [f.path] : [];
  const pts = paths.flat();
  return pts.length ? pts : f.center ? [f.center] : [];
};

// --- Areas and their own text
const boundaries = ex<BoundaryInput[]>('boundaries.json');
const enrichments = ex<EnrichmentInput[]>('neighborhoods-enriched.json');
const stories = ex<{ entries: StoryInput[] }>('neighborhood-stories.json').entries;
const history = ex<{ neighborhoods: HistoryInput[] }>('neighborhood-history.json').neighborhoods;
const areaPhotos = ex<{ areas: Record<string, AreaPhotoInput[]> }>('area-photos.json').areas;
const placePhotos = ex<{ places: Record<string, AreaPhotoInput> }>('place-photos.json').places;

// --- Trivia subjects, located by the collection the fact's id names
const collections: Record<string, Located[]> = {
  landmarks: ex('landmarks.json'), bridges: ex('bridges.json'), water: ex('water.json'),
  streets: ex('streets.json'), parks: ex('parks.json'), squares: ex('squares.json'),
};
const byId = new Map<string, { f: Located; collection: string }>();
for (const [collection, list] of Object.entries(collections)) for (const f of list) byId.set(f.id, { f, collection });
const factFeatures = ex<{ features: { id: string; name: string; collection: string; facts?: { text: string; sourceUrl?: string }[] }[] }>('facts.json').features;
const subjects: FactSubjectInput[] = [];
for (const ff of factFeatures) {
  const hit = byId.get(ff.id);
  if (!hit || !ff.facts?.length) continue;
  const whole = ff.collection === 'streets' || ff.collection === 'water';
  subjects.push({ id: ff.id, name: ff.name, collection: ff.collection, points: pointsOf(hit.f, whole), facts: ff.facts });
}

// --- Street, canal and bridge names with their origins
const origins = new Map<string, string>();
for (const o of ex<{ origins: { name: string; kind: string; en?: string }[] }>('street-name-origins.json').origins) {
  if (o.en) origins.set(`${o.kind}:${o.name}`, o.en);
}
const register = ex<BridgeRegisterFile>('bridge-register.json').bridges;
const UNRIDEABLE = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'busway']);
const CAMERA_HIGHWAYS = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'cycleway', 'pedestrian', 'tertiary_link', 'secondary_link']);
const routing = ex<Located[]>('streets-routing.json');
const names: NamedPlaceInput[] = [];
const streetPoints: StreetPoint[] = [];
for (const w of routing) {
  const pts = pointsOf(w, true);
  if (w.highway && CAMERA_HIGHWAYS.has(w.highway)) for (const p of pts) streetPoints.push(p);
  const name = w.name?.trim();
  if (!name || UNRIDEABLE.has(w.highway ?? '')) continue;
  names.push({ name, kind: 'street', points: pts, origin: origins.get(`street:${name}`) });
}
for (const w of collections.water) names.push({ name: w.name, kind: 'water', points: pointsOf(w, true), origin: origins.get(`water:${w.name}`) });
for (const b of collections.bridges) {
  if (/^Brug \d+$/i.test(b.name) && !register[b.name]) continue;
  const reg = register[b.name];
  names.push({ name: b.name, kind: 'bridge', points: pointsOf(b, false), origin: origins.get(`bridge:${b.name}`), register: reg ? describeRegisteredBridge(reg) || undefined : undefined });
}

// --- Modelled buildings, as What's New lists them (whats-new.html init())
type Sig = { id: string; name?: string; landmarkId?: string; category?: string; buildingCategory?: string; held?: boolean; triangles?: number; placement?: { anchor?: [number, number] }; footprint?: { centre?: [number, number]; lengthMetres?: number; widthMetres?: number } };
const sig = readJson<{ models: Record<string, Sig> }>(path.join(CANAL, 'models/signature-landmarks.json')).models;
const landmarkName = new Map(collections.landmarks.map(l => [l.id, l]));
const buildings: BuildingInput[] = [];
const photoFor = (...keys: (string | undefined)[]) => {
  for (const k of keys) {
    const p = k ? placePhotos[k] : undefined;
    if (p?.imageUrl) return { url: p.imageUrl, credit: p.imageAttribution || 'Wikimedia Commons', sourceUrl: p.sourceUrl };
  }
  return undefined;
};
for (const [id, m] of Object.entries(sig)) {
  if (m.held) continue;
  const anchor = m.placement?.anchor ?? m.footprint?.centre;
  if (!anchor) continue;
  const isLandmark = (m.buildingCategory ?? (m.category && m.category !== 'landmark' ? m.category : m.landmarkId ? 'landmark' : 'ordinary')) === 'landmark';
  const lm = m.landmarkId ? landmarkName.get(m.landmarkId) : undefined;
  buildings.push({
    id, ...splitModelName(m.name || id), kind: isLandmark ? 'landmark' : 'building', lng: anchor[0], lat: anchor[1], triangles: m.triangles,
    gallery: isLandmark ? `../manual-landmarks.html?only=${encodeURIComponent(id)}` : `../manual-ordinary-buildings.html?only=${encodeURIComponent(id)}`,
    remotePhoto: photoFor(lm?.name, m.name), prominence: lm?.prominenceScore ?? 0,
    sizeM: m.footprint?.lengthMetres ? Math.max(m.footprint.lengthMetres, m.footprint.widthMetres ?? 0) : undefined,
  });
}
type Box = { min: number[]; max: number[] };
const boxSize = (b?: Box) => b ? Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) : undefined;
type Chunk = { id: string; bounds?: Box; replaces?: string[]; triangles?: number; instance?: { anchor?: [number, number] }; pands?: { address?: string }[] };
const chunkJson = readJson<{ chunks: Chunk[] }>(path.join(CANAL, 'ordinary-buildings-data/chunks.json'));
const replaced = new Set(chunkJson.chunks.flatMap(c => c.replaces ?? []));
for (const c of chunkJson.chunks) {
  const a = c.instance?.anchor;
  if (!a) continue;
  const face = c.id.replace(/^chunk-(face-)?/, '');
  const addresses = (c.pands ?? []).map(p => p.address).filter(Boolean) as string[];
  const thumb = `street-surveys-data/thumbs/${face}-model.webp`;
  buildings.push({
    id: c.id, kind: 'block-face', lng: a[0], lat: a[1], triangles: c.triangles, prominence: addresses.length, sizeM: boxSize(c.bounds),
    name: addresses.length > 1 ? `${addresses[0]} to ${addresses[addresses.length - 1].replace(/^.*?(\d)/, '$1')} (${addresses.length} houses)` : addresses[0] || face,
    gallery: `../street-surveys.html#${encodeURIComponent(c.id)}`,
    photo: existsSync(path.join(CANAL, thumb)) ? thumb : undefined,
  });
}
type Ord = { id: string; bounds?: Box; name?: string; category?: string; source?: string; anchor?: [number, number]; triangles?: number };
for (const m of readJson<{ models: Ord[] }>(path.join(CANAL, 'ordinary-buildings-data/catalogue.json')).models) {
  const category = m.category || (m.source === 'building-recipes' ? 'street-survey' : 'ordinary');
  if ((category === 'street-survey' && replaced.has(m.id)) || !m.anchor || sig[m.id]) continue;
  buildings.push({
    id: m.id, ...splitModelName(m.name || m.id), kind: category === 'street-survey' ? 'block-face' : 'building', lng: m.anchor[0], lat: m.anchor[1], triangles: m.triangles, sizeM: boxSize(m.bounds),
    gallery: category === 'street-survey' ? `../street-surveys.html#${encodeURIComponent(m.id)}` : `../manual-ordinary-buildings.html?only=${encodeURIComponent(m.id)}`,
  });
}
// Hand-modelled landmark kits: centred on their parts' footprints, found through kit-locations.json.
const kitTiles = ex<{ ids: Record<string, string> }>('kit-locations.json').ids;
const tileCache = new Map<string, Map<string, number[][][]>>();
const tileFeatures = (tile: string) => {
  let t = tileCache.get(tile);
  if (!t) {
    t = new Map();
    const file = path.join(EXTRACT, 'building-tiles/14', `${tile}.geojson.gz`);
    if (existsSync(file)) {
      for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')).features ?? []) {
        const g = f.geometry; if (!g) continue;
        t.set(String(f.properties?.id), g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: number[][][]) => p[0]) : []);
      }
    }
    tileCache.set(tile, t);
  }
  return t;
};
for (const kit of HAND_KITS) {
  const pts: number[][] = [];
  for (const id of new Set(kitIds(kit))) {
    const tile = kitTiles[id];
    if (tile) for (const ring of tileFeatures(tile).get(id) ?? []) pts.push(...ring);
  }
  if (!pts.length) continue;
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length, lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  buildings.push({ id: `kit-${kit.name}`, name: kit.name, kind: 'landmark-kit', lng, lat,
    gallery: `../landmark-gallery.html?kit=${encodeURIComponent(kit.name)}`, remotePhoto: photoFor(kit.name), prominence: 1 });
}
// Kit-type buildings (building-types/instances.json): counted per design, not listed one by one.
const typeLabels = new Map<string, string>();
const typesDir = path.join(ROOT, 'src/canalRecall/buildingTypes/types');
for (const f of readdirSync(typesDir)) if (f.endsWith('.json')) {
  const t = readJson<{ id: string; label?: string }>(path.join(typesDir, f));
  typeLabels.set(t.id, kitLabel(t.label ?? '', t.id));
}
const kitInstances: KitInstanceInput[] = readJson<{ unit: string; anchor: [number, number] }[]>(path.join(CANAL, 'building-types/instances.json'))
  .map(i => { const type = i.unit.split('__')[0]; return { unit: type, label: typeLabels.get(type) ?? kitLabel('', type), lng: i.anchor[0], lat: i.anchor[1] }; });

// --- Build
const pages = buildBuurtPages({ boundaries, enrichments, stories, history, areaPhotos, buildings, kitInstances, subjects, names, streetPoints });
const manifestFile = path.join(SHOTS, 'manifest.json');
const manifest: ShotManifest = existsSync(manifestFile) ? readJson<ShotManifest>(manifestFile) : { shots: {} };
// Only frames that are on disk.
for (const [slug, list] of Object.entries(manifest.shots)) manifest.shots[slug] = list.filter(s => existsSync(path.join(OUT, s.file)));

const files = new Map<string, string>();
for (const p of pages) files.set(`${p.slug}.html`, renderBuurtPage(p, manifest.shots[p.slug] ?? [], pages));
files.set('index.html', renderBuurtIndex(pages, manifest));
const plan = { generatedBy: 'scripts/build-buurt-pages.ts', pages: pages.map(p => ({ slug: p.slug, name: p.name, shots: p.shotPlan })) };
files.set('shots/plan.json', `${JSON.stringify(plan, null, 1)}\n`);

if (check) {
  const stale = [...files].filter(([f, body]) => !existsSync(path.join(OUT, f)) || readFileSync(path.join(OUT, f), 'utf8') !== body).map(([f]) => f);
  if (stale.length) { console.error(`buurt pages stale: ${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ` …(${stale.length})` : ''}\nrun: node --import tsx scripts/build-buurt-pages.ts`); process.exit(1); }
  console.log(`buurt pages up to date (${pages.length})`);
} else {
  mkdirSync(SHOTS, { recursive: true });
  const keep = new Set([...files.keys()].filter(f => !f.includes('/')));
  for (const f of readdirSync(OUT)) if (f.endsWith('.html') && !keep.has(f)) rmSync(path.join(OUT, f));
  for (const [f, body] of files) writeFileSync(path.join(OUT, f), body);
  // Coverage report: what each page has and lacks.
  const gaps = pages.map(p => {
    const shots = manifest.shots[p.slug]?.length ?? 0;
    const lacks = [!p.postcard && 'photo', p.postcard?.borrowedFrom && `photo borrowed from ${p.postcard.borrowedFrom}`, !p.intro && 'intro',
      !p.buildings.length && !p.kits.length && 'buildings', !p.subjects.length && !p.stories.length && 'trivia',
      !p.streets.some(s => s.origin) && !p.waters.some(s => s.origin) && 'name origins', !p.bridges.length && 'bridges', !shots && 'shots'].filter(Boolean);
    return { slug: p.slug, buildings: p.buildings.length, kits: p.kits.reduce((s, k) => s + k.count, 0), facts: p.subjects.reduce((s, x) => s + x.facts.length, 0) + p.stories.length,
      origins: [...p.streets, ...p.waters, ...p.bridges].filter(n => n.origin).length, bridges: p.bridges.length, shots, plan: p.shotPlan.length, lacks };
  });
  writeFileSync(path.join(OUT, 'shots/coverage.json'), `${JSON.stringify(gaps, null, 1)}\n`);
  console.log(`wrote ${pages.length} pages + index to ${path.relative(ROOT, OUT)}`);
  if (!process.env.QUIET) for (const g of gaps) console.log(`${g.slug.padEnd(28)} b${String(g.buildings).padStart(3)} k${String(g.kits).padStart(4)} f${String(g.facts).padStart(3)} o${String(g.origins).padStart(4)} br${String(g.bridges).padStart(3)} s${g.shots}/${g.plan}  ${g.lacks.join(', ')}`);
}
