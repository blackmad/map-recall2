/**
 * Builds public/data/extracts/amsterdam/explorer-looks.json, the buurt-look view of the neighbourhood explorer
 * (canal-drive/explore.html?buurt=<slug>): per municipal buurt with its own look, the recipes that draw it (house
 * types, Nieuw-West designs, measured faces) with swatches, kit keys and the GLB box to frame; see
 * src/canalRecall/explorer/looks.ts.
 *
 * Sources: coverage-v1/buurten.json (own-look tally and content ids per buurt, outlines) and contents.json (type
 * catalogue, look thumbnails), scripts/block-face/types (via scripts/coverage/ownLook.ts), the face intents, the
 * building-type designs (src/canalRecall/buildingTypes/types), explorer-index.json and boundaries.json.
 *
 *   node --import tsx scripts/explorer/build-looks.ts [--out <path>] [--check]
 *
 * --check exits 1 if the published file differs from a fresh build (ignoring generatedAt).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fullPandId } from '../../src/canalRecall/bagTiles';
import { paletteSwatches, typeKitKeys, type ContentItems } from '../../src/canalRecall/coverage/contents';
import { SWATCHES } from '../../src/canalRecall/buildingRecipe/intent';
import { PHOTO_WALLS, CITY_ROOF } from '../../src/canalRecall/look/palette';
import { buurtFor, prepareBoundaries, type Boundary } from '../../src/canalRecall/explorer/indexBuilder';
import {
  inGeometry, paletteSwatch, slugify, typeRun,
  type ExplorerLooks, type LookBuurt, type LookRecipe, type LookUse, type Swatch,
} from '../../src/canalRecall/explorer/looks';
import type { ExplorerIndex, LngLat } from '../../src/canalRecall/explorer/types';
import { readOwnLookSources } from '../coverage/ownLook';

const root = path.resolve(import.meta.dirname, '../..');
const canal = path.join(root, 'public/canal-drive');
const extract = path.join(root, 'public/data/extracts/amsterdam');
const args = process.argv.slice(2);
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(extract, 'explorer-looks.json');
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

type Tally = [string, number];
type Feature = {
  geometry: { type: string; coordinates: unknown };
  properties: {
    code: string; name: string; wijk?: string; pands: number;
    look?: { status: 'drawn' | 'authored' | 'none'; pands: number; share: number; types: Tally[]; designs: Tally[]; faces: Tally[]; districts: string[] };
    content: { types: Tally[]; faces: Tally[]; designs: Tally[] };
  };
};
const features = json<{ features: Feature[] }>(path.join(extract, 'coverage-v1/buurten.json')).features;
const items = json<{ items: ContentItems }>(path.join(extract, 'coverage-v1/contents.json')).items;
const index = json<ExplorerIndex>(path.join(extract, 'explorer-index.json'));
const explorerIds = new Set(index.models.map(m => m.id));
const explorerNames = new Set(index.buurten.map(b => b.name));
const osm = prepareBoundaries(json<Boundary[]>(path.join(extract, 'boundaries.json')).filter(b => b.kind !== 'municipality'));
const sources = readOwnLookSources(root);

const typesDir = path.join(root, 'scripts/block-face/types');
const typeFiles = new Map<string, Record<string, unknown>>();
for (const district of readdirSync(typesDir)) {
  const dir = path.join(typesDir, district);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) { const t = json<Record<string, unknown>>(path.join(dir, f)); typeFiles.set(String(t.id ?? f.replace(/\.json$/, '')), t); }
}
const designsDir = path.join(root, 'src/canalRecall/buildingTypes/types');
const designFiles = new Map(readdirSync(designsDir).filter(f => f.endsWith('.json')).map(f => { const d = json<{ id: string }>(path.join(designsDir, f)); return [d.id, d as unknown as { id: string; label?: string; variants?: Record<string, { label?: string; palette?: Record<string, unknown> }> }]; }));

const DISTRICT_NAME: Record<string, string> = {
  'oud-west': 'Oud-West', bellamy: 'Bellamybuurt', 'de-baarsjes': 'De Baarsjes', 'indische-buurt': 'Indische Buurt',
  spaarndammerbuurt: 'Spaarndammerbuurt', rivierenbuurt: 'Rivierenbuurt',
};
const fileOf = (modelUrl: string) => path.join(canal, modelUrl.replace(/\?.*$/, ''));
const pageUrl = (modelUrl: string) => modelUrl.replace(/\?.*$/, '').replace(/^\.\//, '');
const thumb = (t: { src: string; label: string; credit?: string } | undefined) => t && existsSync(path.join(canal, t.src)) ? { src: t.src, label: t.label, ...(t.credit ? { credit: t.credit } : {}) } : undefined;
const named = (palettes: Record<string, Record<string, unknown> | undefined> | undefined): Swatch[] =>
  paletteSwatches(Object.fromEntries(Object.entries(palettes ?? {}).map(([n, roles]) => [n, Object.fromEntries(Object.entries(roles ?? {}).map(([r, v]) => [r, typeof v === 'string' && SWATCHES[v] ? SWATCHES[v] : v]))])));
const chunkById = new Map(sources.chunks.map(c => [c.id, c]));
const missing: string[] = [];

const recipes: Record<string, LookRecipe> = {};
function chunkRecipeFields(chunkId: string | undefined): Pick<LookRecipe, 'glbUrl' | 'bytes' | 'modelId'> {
  const c = chunkId ? chunkById.get(chunkId) : undefined;
  if (!c || !existsSync(fileOf(c.modelUrl))) return {};
  return { glbUrl: pageUrl(c.modelUrl), bytes: statSync(fileOf(c.modelUrl)).size, ...(explorerIds.has(c.id) ? { modelId: c.id } : {}) };
}
function typeRecipe(id: string): string {
  const key = `type:${id}`;
  if (recipes[key]) return key;
  const t = items.types[id], file = typeFiles.get(id), lt = items.look?.types[id];
  const district = t?.district ?? (file?.district as string | undefined);
  recipes[key] = {
    kind: 'type', title: id,
    source: district ? `${DISTRICT_NAME[district] ?? district} house type` : 'House type of one block face',
    ...(t?.description ?? file?.description ? { description: String(t?.description ?? file?.description) } : {}),
    ...(t?.era ? { era: t.era } : {}),
    swatches: file ? named(file.palettes as Record<string, Record<string, unknown>>) : t?.swatches ?? [],
    kitKeys: file ? typeKitKeys(file) : t?.kitKeys ?? [],
    ...chunkRecipeFields(lt?.chunk),
    ...(thumb(lt?.render) ? { render: thumb(lt?.render) } : {}),
    ...(thumb(lt?.photo) ? { photo: thumb(lt?.photo) } : {}),
  };
  return key;
}
function designRecipe(unit: string): string | undefined {
  const key = `design:${unit}`;
  if (recipes[key]) return key;
  const glb = path.join(canal, 'building-types', `${unit}.glb`);
  if (!existsSync(glb)) { missing.push(`${key} (no GLB)`); return undefined; }
  const [family, variant] = unit.split('__');
  const d = designFiles.get(family), v = d?.variants?.[variant], item = items.designs[unit];
  const sw = paletteSwatch(variant, v?.palette, SWATCHES);
  recipes[key] = {
    kind: 'design', title: `${family} · ${variant}`, source: 'Nieuw-West building type',
    ...(v?.label || item?.label ? { description: [item?.label, v?.label].filter(Boolean).join('. ') } : {}),
    swatches: sw ? [sw] : [],
    kitKeys: [...new Set([item?.roof && `roof:${item.roof}`, item?.storeys && `storeys:${item.storeys}`].filter((x): x is string => !!x))],
    glbUrl: `building-types/${unit}.glb`, bytes: statSync(glb).size,
    ...(thumb(items.look?.designs[`${family}__${variant}`]?.render) ? { render: thumb(items.look?.designs[`${family}__${variant}`]?.render) } : {}),
    ...(thumb(items.look?.families[family]?.photo) ? { photo: thumb(items.look?.families[family]?.photo) } : {}),
  };
  return key;
}
function faceRecipe(face: string): string {
  const key = `face:${face}`;
  if (recipes[key]) return key;
  const f = items.faces[face];
  const intentFile = path.join(root, 'scripts/block-face/faces', face, 'intent.json');
  const houses = existsSync(intentFile) ? (json<{ houses?: { design?: { fronts?: Record<string, unknown>[]; roof?: Record<string, unknown>; palette?: Record<string, unknown> } }[] }>(intentFile).houses ?? []) : [];
  // Distinct measured palettes of the face's houses (at most four), and the kit keys any of them uses.
  const palettes = new Map<string, Record<string, unknown>>();
  for (const h of houses) if (h.design?.palette) palettes.set(JSON.stringify(h.design.palette), h.design.palette);
  const kit = new Set<string>();
  for (const h of houses) for (const front of h.design?.fronts ?? []) {
    const { gable, cornice, id: _id, street: _s, crownAt: _c, ...body } = front;
    for (const k of typeKitKeys({ body, crowns: { c: { gable, cornice } }, roof: h.design?.roof })) kit.add(k);
  }
  const thumbs = f?.thumbs ?? [];
  recipes[key] = {
    kind: 'face', title: f?.title ?? face, source: 'Measured block face',
    ...(f?.note ? { description: `${houses.length || f.pands} houses measured one by one from the street photos; ${f.note}` } : {}),
    swatches: named(Object.fromEntries([...palettes.values()].slice(0, 4).map((p, i) => [`house ${i + 1}`, p]))),
    kitKeys: [...kit].filter(k => !/^(doorBay|basement|hoist|atticWindows|crownSteps|crownRise|crownFinial|windowProportion|crownNeckWidth|crownCapRatio)/.test(k)).sort(),
    ...chunkRecipeFields(f?.chunk ?? `chunk-face-${face}`),
    ...(thumb(thumbs.find(t => t.label === 'Model')) ? { render: thumb(thumbs.find(t => t.label === 'Model')) } : {}),
    ...(thumb(thumbs.find(t => t.label !== 'Model')) ? { photo: thumb(thumbs.find(t => t.label !== 'Model')) } : {}),
  };
  return key;
}

const centroid = (g: Feature['geometry']): LngLat => {
  const pts = ((g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]).flatMap(p => p[0] ?? []);
  return [Math.round(pts.reduce((s, p) => s + p[0], 0) / pts.length * 1e6) / 1e6, Math.round(pts.reduce((s, p) => s + p[1], 0) / pts.length * 1e6) / 1e6];
};
const bboxOf = (g: Feature['geometry']): [number, number, number, number] => {
  const pts = ((g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]).flatMap(p => p[0] ?? []);
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  return [r(Math.min(...pts.map(p => p[0]))), r(Math.min(...pts.map(p => p[1]))), r(Math.max(...pts.map(p => p[0]))), r(Math.max(...pts.map(p => p[1])))];
};

/** Outer rings at ~1 m (5 decimals), for the map outline. */
const outlineOf = (g: Feature['geometry']): number[][][] =>
  ((g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]).map(p => (p[0] ?? []).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]));

/** The installed chunk in this buurt drawing most houses of a type, and the run of them to frame. */
function typeUse(id: string, n: number, f: Feature): LookUse {
  const key = typeRecipe(id);
  const isType = (p: string) => sources.pandType.get(fullPandId(p)) === id;
  const here = sources.chunks.filter(c => inGeometry(c.instance.anchor as LngLat, f.geometry))
    .map(c => ({ c, k: c.pands.filter(p => isType(p.pandId)).length })).filter(x => x.k > 0).sort((a, b) => b.k - a.k)[0]?.c;
  const chunk = here ?? chunkById.get(items.look?.types[id]?.chunk ?? '');
  const run = chunk ? typeRun(chunk.pands, isType) : null;
  const use: LookUse = { key, pands: n };
  if (chunk && run) {
    if (pageUrl(chunk.modelUrl) !== recipes[key].glbUrl) Object.assign(use, chunkRecipeFields(chunk.id));
    Object.assign(use, run);
  }
  return use;
}

const buurten: LookBuurt[] = [];
const none: [string, string, string][] = [];
for (const f of features) {
  const p = f.properties, look = p.look;
  const slug = slugify(p.name);
  if (!look || look.status === 'none') { none.push([slug, p.name, p.code]); continue; }
  const uses: LookUse[] = [];
  const types = look.status === 'drawn' ? look.types : p.content.types;
  for (const [id, n] of types) uses.push(typeUse(id, look.status === 'drawn' ? n : 0, f));
  for (const [family, n] of look.designs) {
    const unit = p.content.designs.filter(([u]) => u.startsWith(`${family}__`)).sort((a, b) => b[1] - a[1])[0]?.[0];
    const key = unit && designRecipe(unit);
    if (key) uses.push({ key, pands: n });
  }
  const faces = look.status === 'drawn' ? look.faces : p.content.faces.filter(([face]) => items.faces[face]?.chunk || ['authored', 'staged', 'held'].includes(items.faces[face]?.status ?? ''));
  for (const [face, n] of faces) uses.push({ key: faceRecipe(face), pands: look.status === 'drawn' ? n : 0 });
  const lngLat = centroid(f.geometry);
  const explorerBuurt = buurtFor(lngLat, osm);
  buurten.push({
    slug, code: p.code, name: p.name, ...(p.wijk ? { wijk: p.wijk } : {}),
    ...(explorerNames.has(explorerBuurt) ? { explorerBuurt } : {}),
    lngLat, bbox: bboxOf(f.geometry), outline: outlineOf(f.geometry), status: look.status, pands: p.pands, lookPands: look.pands, share: look.share,
    districts: look.districts.map(d => DISTRICT_NAME[d] ? `${DISTRICT_NAME[d]} house types` : d), uses: uses.sort((a, b) => b.pands - a.pands),
    models: index.models.filter(m => inGeometry(m.lngLat, f.geometry)).sort((a, b) => a.name.localeCompare(b.name)).map(m => m.id),
  });
}
buurten.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
none.sort((a, b) => a[1].localeCompare(b[1], 'nl'));
const slugs = new Set<string>();
for (const s of [...buurten.map(b => b.slug), ...none.map(n => n[0])]) { if (slugs.has(s)) missing.push(`duplicate slug ${s}`); slugs.add(s); }

const looks: ExplorerLooks = {
  version: 1,
  generatedAt: new Date().toISOString(),
  defaultLook: {
    title: 'The city default',
    description: 'Generic BAG/3DBAG extrusions with the era facade grammar: one wall per building drawn from the city palette (weighted to red and orange brick), measured roof tones, no district kit.',
    swatches: [
      { name: 'walls', colors: [...new Set(PHOTO_WALLS)].map((c, i) => [`wall ${i + 1}`, c] as [string, string]) },
      { name: 'roofs', colors: [['tile', CITY_ROOF.tile[0]], ['slate', CITY_ROOF.slate[0]], ['flat', CITY_ROOF.flat[0]]] },
    ],
  },
  recipes: Object.fromEntries(Object.entries(recipes).sort(([a], [b]) => a.localeCompare(b))),
  buurten,
  none,
};

const text = `${JSON.stringify(looks)}\n`;
const drawn = buurten.filter(b => b.status === 'drawn').length;
console.log(`${buurten.length} buurten with a look (${drawn} drawn, ${buurten.length - drawn} authored only), ${none.length} without; ${Object.keys(recipes).length} recipes; ${(text.length / 1024).toFixed(0)} KB`);
const noGlb = buurten.filter(b => !b.uses.some(u => u.glbUrl ?? recipes[u.key]?.glbUrl)).map(b => b.name);
if (noGlb.length) console.log(`no 3D example: ${noGlb.join(', ')}`);
if (missing.length) console.log(`missing: ${missing.join('; ')}`);
if (args.includes('--check')) {
  const strip = (s: string) => s.replace(/"generatedAt":"[^"]*"/, '');
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (strip(current) !== strip(text)) { console.error(`${path.relative(root, out)} is stale: run node --import tsx scripts/explorer/build-looks.ts`); process.exit(1); }
  console.log('explorer-looks.json is current');
} else {
  writeFileSync(out, text);
  console.log(`wrote ${path.relative(root, out)}`);
}
