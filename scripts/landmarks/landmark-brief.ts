/**
 * Photo-first brief for a bespoke landmark lane: no brief is written from memory.
 *
 *   node --import tsx scripts/landmarks/landmark-brief.ts --pand=<BAG pand id> [--id=<slug>] [--min-len=4] [--max=30]
 *        [--height=<m>] [--wiki=nl:Elandsgracht_117,en:...] [--address="Elandsgracht 117"] [--force-skeleton] [--offline]
 *
 * Writes
 *  - artifacts/landmark-briefs/<id>/w<NN>-<bearing>.jpg (+ .alt.jpg from another year, .thumb.jpg aimed view) and
 *    contact.jpg: one rectified crop per exposed (non-party) wall >= min-len, every wall, not just the long ones.
 *    The stock `all-walls.ts` defaults (--min-len=14 --max=8) drop the 13.9 m Marnixstraat end wall of the Hoofdbureau,
 *    the one with the Amsterdam-arms relief; review-sheet's --walls=6 drops it too. Default here: 4 m, 30 walls.
 *  - scripts/landmarks/<id>-brief.md: facts (BAG, 3DBAG, local building facts), monument register text verbatim
 *    (scripts/data/amsterdam-monument-register, data.amsterdam.nl monumenten CC0 + RCE), Wikipedia extracts with URL,
 *    one section per wall with its crops and the ornament checklist, and the signature question.
 *  - scripts/landmarks/<id>-inventory.json: an inventory skeleton (schema src/canalRecall/landmarks/ornamentInventory.ts),
 *    unless one exists (--force-skeleton overwrites). The lane fills it from the crops before writing geometry;
 *    build-manual-landmarks.ts refuses to export a new landmark until it validates (check-landmark-inventory.ts).
 *
 * Sources: Gemeente Amsterdam panoramas (CC BY 4.0), BAG via api.data.amsterdam.nl (CC0), 3DBAG (CC BY 4.0), monument
 * registers (CC0), Wikipedia (CC BY-SA 4.0, quoted with its URL). Network responses are cached in .cache/pand-reference.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import {cachedJson, findPands, neighbourhood, normId, rdToLngLat} from '../pand-reference/core.ts';
import {exposedWalls, listPanos, rankPanos, type PanoPick, type Wall} from '../pand-reference/select.ts';
import {aimedThumbnail, loadPano, rectifyWall} from '../pand-reference/rectify.ts';
import {factsFor} from '../pand-reference/facts.ts';
import {ORNAMENT_KINDS, type LandmarkInventory} from '../../src/canalRecall/landmarks/ornamentInventory.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const flag = (n: string) => process.argv.includes(`--${n}`);
if (!arg('pand')) { console.error('--pand=<BAG pand id> required'); process.exit(2); }
const pand = normId(arg('pand')), bag = pand.replace('NL.IMBAG.Pand.', '');
const minLen = Number(arg('min-len', '4')), maxWalls = Number(arg('max', '30'));

interface CatalogueEntry {id: string; name: string; suppressOsmIds?: string[]; attribution?: {title?: string}}
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as CatalogueEntry[];
const entry = arg('id') ? catalogue.find(c => c.id === arg('id')) : catalogue.find(c => c.suppressOsmIds?.includes(pand));
const id = arg('id') || entry?.id || `pand-${bag}`;
const cropDir = path.join(ROOT, 'artifacts/landmark-briefs', id);
const briefFile = path.join(ROOT, 'scripts/landmarks', `${id}-brief.md`);
const invFile = path.join(ROOT, 'scripts/landmarks', `${id}-inventory.json`);
fs.mkdirSync(cropDir, {recursive: true});
const rel = (p: string) => path.relative(path.dirname(briefFile), p);
const net = async <T>(what: string, f: () => Promise<T>): Promise<T | null> => {
  if (flag('offline')) return null;
  try { return await f(); } catch (e) { console.log(`  ${what}: ${String(e).split('\n')[0]}`); return null; }
};
const bearingOf = (w: Wall) => Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
const compass = (b: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];

// ---- geometry and walls ---------------------------------------------------------------------------------------------
let fp = (await findPands([pand])).get(pand);
if (!fp) {
  // Not in the building tiles (the Tropenmuseum's 321-vertex pand is missing from them): take the BAG outline from PDOK WFS (CC0).
  const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bag}</Literal></PropertyIsEqualTo></Filter>`)}`).catch(() => null);
  const g = wfs?.features?.[0]?.geometry;
  if (!g) throw new Error(`pand not in building tiles and not in PDOK BAG: ${pand}`);
  const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => ({x: p[0], y: p[1]}));
  fp = {id: pand, ring, height: Number(arg('height', '20'))};
  console.log(`  ${pand}: BAG outline from PDOK WFS (${ring.length - 1} vertices)`);
}
const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
const allWalls = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len);
const walls = allWalls.filter(w => w.len >= minLen).slice(0, maxWalls);
const dropped = allWalls.length - walls.length;
console.log(`${id}: ${allWalls.length} exposed walls, ${walls.length} in the brief (>= ${minLen} m, max ${maxWalls})`);

interface WallRow {tag: string; bearing: number; lengthM: number; centre: [number, number]; pick?: PanoPick; alt?: PanoPick; crop?: string; altCrop?: string; thumb?: string; candidates: number}
const rows: WallRow[] = [];
let i = 0;
for (const w of walls) {
  const bearing = bearingOf(w), tag = `w${String(++i).padStart(2, '0')}-${bearing}`;
  const [lng, lat] = rdToLngLat(w.mid);
  const row: WallRow = {tag, bearing, lengthM: Math.round(w.len * 10) / 10, centre: [+lng.toFixed(7), +lat.toFixed(7)], candidates: 0};
  const ranked = (await net(`panoramas ${tag}`, async () => rankPanos(w, await listPanos(w.mid)))) ?? [];
  row.candidates = ranked.length;
  row.pick = ranked[0];
  // A second view from another capture year: trees, vans and scaffolding hide different things each year.
  row.alt = ranked.find(p => row.pick && p.missionYear !== row.pick.missionYear && p.obliquityDeg <= 40);
  for (const [key, pick, file] of [['crop', row.pick, `${tag}.jpg`], ['altCrop', row.alt, `${tag}.alt.jpg`]] as const) {
    if (!pick) continue;
    const pano = await net(`pano ${pick.panoId}`, () => loadPano(pick));
    const crop = pano ? rectifyWall(pano.img, pick, w, fp.height, 50) : null;
    if (crop) { fs.writeFileSync(path.join(cropDir, file), crop.jpeg); row[key] = path.join(cropDir, file); }
  }
  if (row.pick) {
    const thumb = await net(`thumb ${tag}`, () => aimedThumbnail(row.pick!, w, fp.height));
    if (thumb) { fs.writeFileSync(path.join(cropDir, `${tag}.thumb.jpg`), thumb.jpeg); row.thumb = path.join(cropDir, `${tag}.thumb.jpg`); }
  }
  rows.push(row);
  console.log(`  ${tag} ${row.lengthM} m ${row.pick ? `${row.pick.panoId} ${row.pick.timestamp.slice(0, 10)}${row.alt ? ` + ${row.alt.missionYear}` : ''}` : 'NO PANORAMA'}`);
}

// Contact sheet: every wall's aimed view, labelled, so the whole building is seen at once.
{
  const S = 420, C = 4, withThumb = rows.filter(r => r.thumb);
  const comps: import("sharp").OverlayOptions[] = [];
  for (const [k, r] of withThumb.entries()) {
    comps.push({input: await sharp(r.thumb!).resize(S, S).toBuffer(), left: (k % C) * S, top: Math.floor(k / C) * S});
    comps.push({input: Buffer.from(`<svg width="${S}" height="24"><rect width="${S}" height="24" fill="#000" opacity=".7"/><text x="4" y="17" font-size="15" fill="#fff" font-family="sans-serif">${r.tag} ${r.lengthM} m ${r.pick!.timestamp.slice(0, 4)}</text></svg>`), left: (k % C) * S, top: Math.floor(k / C) * S});
  }
  if (withThumb.length) await sharp({create: {width: S * Math.min(C, withThumb.length), height: S * Math.ceil(withThumb.length / C), channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 82}).toFile(path.join(cropDir, 'contact.jpg'));
}

// ---- facts and texts ------------------------------------------------------------------------------------------------
const local = await factsFor(fp, walls[0] ?? null);
const bagRecord = await net('BAG', () => cachedJson(`https://api.data.amsterdam.nl/v1/bag/panden/${bag}/?_format=json`));
const dbag = await net('3DBAG', () => cachedJson(`https://api.3dbag.nl/collections/pand/items/${pand}`));
const dbagAttr = dbag?.feature?.CityObjects?.[pand]?.attributes ?? {};

/** Register descriptions (municipal + RCE) linked to this pand, verbatim, from the committed snapshot. */
function registerTexts(): {source: string; number: string; url: string; status: string; text: string}[] {
  const file = path.join(ROOT, 'scripts/data/amsterdam-monument-register/records.json.gz');
  if (!fs.existsSync(file)) return [];
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const out = [];
  for (const r of [...d.municipal, ...d.rce]) {
    if (!(r.bagPandIds ?? []).includes(bag)) continue;
    const text = (r.descriptions ?? []).map((x: {text?: string}) => x.text ?? '').filter(Boolean).join('\n\n');
    out.push({source: r.source, number: String(r.monumentNumber), url: r.recordUrl, status: Array.isArray(r.status) ? r.status.join(', ') : String(r.status), text});
  }
  return out;
}
const register = registerTexts();

/**
 * Wikipedia: the POI card's cited URLs, --wiki, and a search of nl + en Wikipedia for the catalogue name and the address.
 * The Hoofdbureau's own article is "Elandsgracht 117" on nl.wikipedia; its "Beeldhouwwerken" section describes the arms
 * relief, the banner's verse and Hildo Krop's three figures. The original lane cited only the street article.
 * Sections whose heading names sculpture, facade or decoration are quoted in full; each article is flagged for the lane
 * to confirm it is about this building.
 */
const poiData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/game/manual-poi-data.json'), 'utf8')) as {modelId?: string; sourceUrl?: string; additionalSources?: string[]}[];
const poi = poiData.find(p => p.modelId === id);
const wikiRefs = new Set<string>();
for (const u of [poi?.sourceUrl, ...(poi?.additionalSources ?? [])]) { const m = u?.match(/https:\/\/(\w+)\.wikipedia\.org\/wiki\/([^#?]+)/); if (m) wikiRefs.add(`${m[1]}:${decodeURIComponent(m[2]).replace(/_/g, ' ')}`); }
const cited = new Set(wikiRefs);
for (const w of arg('wiki').split(',').filter(Boolean)) wikiRefs.add(w.replace(/_/g, ' '));
// The address finds articles titled by address (nl.wikipedia "Elandsgracht 117"); the catalogue title often carries it.
const address = arg('address') || entry?.attribution?.title?.split(',').map(s => s.trim()).find(s => /\d/.test(s)) || '';
const queries = [...new Set([entry?.name && `${entry.name} Amsterdam`, address && `${address} Amsterdam`].filter(Boolean) as string[])];
for (const lang of ['nl', 'en']) for (const q of queries) {
  const j = await net(`wikipedia search ${q}`, () => cachedJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=2&format=json&srsearch=${encodeURIComponent(q)}`));
  for (const hit of j?.query?.search ?? []) wikiRefs.add(`${lang}:${hit.title}`);
}
const SKIP_HEADING = /afbeelding|zie ook|extern|bronnen|referenties|noten|literatuur|see also|references|external|notes|further/i;
const ORNAMENT_HEADING = /beeld|ornament|gevel|exterieur|decor|sculpt|relief|fa[cç]ade|exterior|architect|bouwkunst|kunst/i;
const wiki: {url: string; title: string; text: string; searched: boolean}[] = [];
const seenTitles = new Set<string>();
for (const ref of wikiRefs) {
  const [lang, ...t] = ref.split(':'), title = t.join(':');
  const j = await net(`wikipedia ${ref}`, () => cachedJson(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`));
  const page = Object.values(j?.query?.pages ?? {})[0] as {title?: string; extract?: string} | undefined;
  if (!page?.extract || seenTitles.has(`${lang}:${page.title}`) || /kan verwijzen naar|may refer to/i.test(page.extract.slice(0, 300))) continue;
  seenTitles.add(`${lang}:${page.title}`);
  const parts = page.extract.split(/\n(?===+ )/);
  const lead = parts[0].replace(/\s+/g, ' ').slice(0, 700);
  const relevant = parts.slice(1).filter(p => ORNAMENT_HEADING.test(p.split('\n')[0]) && !SKIP_HEADING.test(p.split('\n')[0])).map(p => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').slice(0, 4000));
  wiki.push({url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title!.replace(/ /g, '_'))}`, title: page.title!, text: [lead, ...relevant].join(' ... '), searched: !cited.has(`${lang}:${page.title}`) && !cited.has(ref)});
}

// ---- brief ------------------------------------------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const fmt = (v: unknown) => v === null || v === undefined || v === '' ? '-' : String(v);
const lines: string[] = [];
lines.push(`# Brief: ${entry?.name ?? id} (BAG ${bag})`, '');
lines.push(`Generated ${today} by \`node --import tsx scripts/landmarks/landmark-brief.ts --pand=${bag} --id=${id}\`. Crops are under`,
  `\`artifacts/landmark-briefs/${id}/\` (not committed; re-run the command, responses are cached). Panoramas: Gemeente Amsterdam, CC BY 4.0.`, '');
lines.push('**Rules.** Describe the building only from the crops and the cited texts below; nothing from memory. Fill',
  `\`scripts/landmarks/${id}-inventory.json\` wall by wall **before** writing geometry: every relief, sculpture, crest, gable stone,`,
  'lettering, sign, clock, canopy, ironwork, lamp, tower, dome, colonnade or unusual window shape a rider would notice at 1.7 m or on a',
  'gallery card, with its size, the panorama it was seen in, and its plan (`modelled`, `simplified` + how, or `skipped` + a coded reason).',
  '"No component" and "the facade systems cannot express it" are not reasons: the bespoke builder exists for exactly those parts.',
  'Then answer the signature question and budget the hand triangles against the inventory.', '');
lines.push('## Signature question', '', 'Name the features that make this building recognisable, most recognisable first (item ids in the',
  'inventory\'s `signature`). Each must end up `modelled` or `simplified`; a signature item can never be skipped.', '');
lines.push('## Facts', '', '| fact | value | source |', '|---|---|---|');
lines.push(`| BAG pand | ${bag} | BAG, api.data.amsterdam.nl (CC0) |`);
lines.push(`| construction year (BAG) | ${fmt(bagRecord?.oorspronkelijkBouwjaar ?? local.buildYear)} | BAG |`);
lines.push(`| BAG status / storeys | ${fmt(bagRecord?.status?.omschrijving ?? bagRecord?.statusOmschrijving)} / ${fmt(bagRecord?.aantalBouwlagen)} | BAG |`);
lines.push(`| roof max / ridge / 70th pct / ground (m NAP) | ${[dbagAttr.b3_h_dak_max, dbagAttr.b3_h_nok, dbagAttr.b3_h_dak_70p, dbagAttr.b3_h_maaiveld].map(v => v === undefined ? '-' : (+v).toFixed(1)).join(' / ')} | 3DBAG (CC BY 4.0) |`);
lines.push(`| 3DBAG roof type | ${fmt(dbagAttr.b3_dak_type)} | 3DBAG |`);
lines.push(`| tile height | ${fp.height} m | building-tiles extract |`);
lines.push(`| roof shape (OSM/aerial) | ${fmt(local.roofShape)} | buildings-colored.geojson |`);
lines.push(`| exposed walls | ${allWalls.length} (${walls.length} >= ${minLen} m in this brief${dropped ? `, ${dropped} shorter/extra not shown` : ''}) | footprint vs neighbours |`, '');
lines.push('## Register and encyclopedia text (verbatim, cited)', '');
if (!register.length) lines.push('No municipal or national monument record links this pand (scripts/data/amsterdam-monument-register snapshot). That is not evidence of no ornament: look at the crops.', '');
for (const r of register) lines.push(`- **${r.source === 'rce' ? 'Rijksmonument' : 'Municipal register'} ${r.number}** (${r.status}), ${r.url}:`, r.text ? `  > ${r.text.replace(/\s+/g, ' ').slice(0, 1500)}` : '  (no description text)', '');
if (!wiki.length) lines.push('No Wikipedia article cited by the POI card; pass `--wiki=nl:<Title>` if one exists.', '');
for (const w of wiki) lines.push(`- **${w.title}**, ${w.url} (CC BY-SA 4.0)${w.searched ? ', found by search' : ''}. Confirm it is about this building, not the street; lead plus sections on sculpture/facade/architecture:`, `  > ${w.text}`, '');
lines.push('## Walls', '', `Contact sheet: ![all walls](${rel(path.join(cropDir, 'contact.jpg'))})`, '');
lines.push('| tag | facing | length | panorama | captured | camera | obliquity | second view |', '|---|---|---|---|---|---|---|---|');
for (const r of rows) lines.push(`| ${r.tag} | ${compass(r.bearing)} ${r.bearing} | ${r.lengthM} m | ${r.pick?.panoId ?? '**none: inferred**'} | ${r.pick?.timestamp.slice(0, 10) ?? '-'} | ${r.pick ? `${r.pick.distM.toFixed(0)} m` : '-'} | ${r.pick ? `${r.pick.obliquityDeg.toFixed(0)} deg` : '-'} | ${r.alt ? `${r.alt.panoId} (${r.alt.missionYear})` : '-'} |`);
lines.push('');
for (const r of rows) {
  lines.push(`### ${r.tag}: faces ${compass(r.bearing)} (${r.bearing} deg), ${r.lengthM} m`, '');
  if (!r.pick) { lines.push('No panorama within 35 m (courtyard, water or a private side). Label it **inferred** in the inventory, or find a photo (Beeldbank record with its rights, a user photo) before claiming anything about it.', ''); continue; }
  if (r.crop) lines.push(`![${r.tag} rectified](${rel(r.crop)})`);
  if (r.altCrop) lines.push(`![${r.tag} ${r.alt!.missionYear}](${rel(r.altCrop)})`);
  if (r.thumb) lines.push(`![${r.tag} aimed](${rel(r.thumb)})`);
  lines.push('', `Panorama ${r.pick.panoId} (${r.pick.timestamp.slice(0, 10)}), https://api.data.amsterdam.nl/panorama/panoramas/${r.pick.panoId}/`, '',
    `Look for (${ORNAMENT_KINDS.join(', ')}). Inventory: \`walls[tag=${r.tag}]\`.`, '');
}

fs.writeFileSync(briefFile, lines.join('\n'));
console.log(`brief: ${path.relative(ROOT, briefFile)}`);

if (!fs.existsSync(invFile) || flag('force-skeleton')) {
  const skeleton: LandmarkInventory = {
    schemaVersion: 1, id, pand: bag, brief: path.relative(ROOT, briefFile), signature: [],
    walls: rows.map(r => ({tag: r.tag, bearing: r.bearing, lengthM: r.lengthM, centre: r.centre, evidence: r.pick ? 'photo' : 'inferred', panoId: r.pick?.panoId ?? null, capturedAt: r.pick?.timestamp.slice(0, 10) ?? null, checked: false, items: []})),
    sources: [{name: 'Gemeente Amsterdam panoramas', url: 'https://api.data.amsterdam.nl/panorama/', licence: 'CC BY 4.0'}],
  };
  fs.writeFileSync(invFile, JSON.stringify(skeleton, null, 1) + '\n');
  console.log(`inventory skeleton: ${path.relative(ROOT, invFile)}`);
} else console.log(`inventory exists, not overwritten: ${path.relative(ROOT, invFile)}`);
