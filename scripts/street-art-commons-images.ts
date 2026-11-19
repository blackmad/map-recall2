/**
 * Commons photos for street-art points that have none (feedback deb3fc, 2026-11-13, the "Why not" sculpture card:
 * "do we not at least have a photo of it to show?"). 447 of the 1,428 points in `street-art.json` carry no `i`: the
 * builder only takes the image of a Wikipedia article, and most OSM artworks have no article.
 *
 * For each point without `i`, in order:
 *   1. its Wikidata item's image (P18), when the point has a Q id (`q`, or a Wikidata-only point) and that item is the work
 *      itself (P31 a sculpture/statue/mural/... class, not the person it depicts) standing within 300 m;
 *   2. a Commons file within NEAR_M of the point whose title names the work (every significant word of the name, or the
 *      whole name) or, for a name of one generic word, the work and the artist's surname together.
 * Only freely licensed files (the Commons extmetadata licence) are kept, with the file page, author and licence, so the
 * card's photo can be credited. Writes the staged sidecar `public/data/extracts/amsterdam/staging/street-art-commons.json`
 * and prints the coverage; the integrator reviews it and `build-street-art.ts` reads the published copy.
 *
 * Usage: node --import tsx scripts/street-art-commons-images.ts [--limit N]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import type { StreetArtFile, StreetArtPoint } from '../src/canalRecall/streetArt.ts';

const UA = { 'User-Agent': 'map-recall2 street-art images (https://github.com/blackmad/map-recall2)' };
const NEAR_M = 40;
const OUT = path.resolve('public/data/extracts/amsterdam/staging/street-art-commons.json');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

/** Words too common in artwork titles and Commons file names to identify a work on their own. */
const STOP = new Set(['de', 'het', 'een', 'van', 'en', 'the', 'of', 'and', 'a', 'in', 'op', 'aan', 'voor', 'met', 'bij', 'te', 'amsterdam', 'beeld', 'kunstwerk', 'zonder', 'titel', 'untitled', 'sculpture', 'statue', 'monument', 'mural', 'gedenkteken', 'herdenkingsmonument']);
export const words = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));

/** Does a Commons file title name this work? */
export function titleNames(fileTitle: string, name: string, artist?: string): boolean {
  const t = ` ${fileTitle.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')} `;
  const w = words(name);
  if (!w.length) return false;
  if (w.length >= 2) return w.every(x => t.includes(` ${x} `));
  const surname = artist ? words(artist).at(-1) : undefined;
  return t.includes(` ${w[0]} `) && (w[0].length >= 7 || (!!surname && t.includes(` ${surname} `)));
}

type Found = { id: string; name: string; file: string; page: string; thumb: string; licence: string; author: string; by: 'wikidata-p18' | 'commons-near-title' | 'panorama'; distM?: number; note?: string };

/**
 * Hand-checked Gemeente Amsterdam panorama views (CC BY 4.0, data.amsterdam.nl) for works Commons has no photo of. Each was
 * looked at: the work stands centred in the view. The thumbnail API ignores a field of view under ~30 degrees.
 */
export const PANORAMA_PHOTOS: Found[] = [
  {
    id: 'n13410980119', name: 'Why not', file: 'recording_2025-06-18_08-56-14_01448', by: 'panorama', distM: 22,
    page: 'https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-06-18_08-56-14_01448/',
    thumb: 'https://api.data.amsterdam.nl/panorama/thumbnail/recording_2025-06-18_08-56-14_01448/?width=600&aspect=1.2&fov=30&heading=19&pitch=-4',
    licence: 'CC BY 4.0', author: 'Gemeente Amsterdam (panoramabeelden)',
    note: 'Feedback deb3fc. No Commons file of this Else Ringnalda figure (Commons search "Ringnalda", category, 100 m geosearch, 2026-11-19); the slender bronze on its round plinth on the Nassaukade lawn stands 22 m from the camera at bearing 17, the OSM node.',
  },
];

async function commons(params: Record<string, string>): Promise<any> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({ format: 'json', ...params })) url.searchParams.set(k, v);
  return cachedJsonFetch(url, { headers: UA, cacheDirectory: '.cache/commons-api', pauseMs: 150 });
}

/** Licence, author and a 960 px thumbnail of a Commons file, or null when the licence is not free. */
async function fileInfo(file: string): Promise<{ page: string; thumb: string; licence: string; author: string } | null> {
  const r = await commons({ action: 'query', titles: file, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960' });
  const page = Object.values(r.query?.pages ?? {})[0] as any, ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {}, licence = String(meta.LicenseShortName?.value ?? '');
  if (!/^(CC BY|CC0|Public domain|PD)/i.test(licence) || /NC|ND/.test(licence)) return null;
  const author = String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();
  return { page: ii.descriptionurl, thumb: ii.thumburl ?? ii.url, licence, author };
}

/** Classes of an item that is the work itself (not the person or event it depicts): sculpture, statue, mural, memorial,
 *  monument, work of art, fountain, bust, relief, installation, public art, war memorial, outdoor sculpture, group,
 *  grave monument, wall painting, street art. */
const WORK_CLASSES = new Set(['Q860861', 'Q179700', 'Q219423', 'Q5003624', 'Q4989906', 'Q838948', 'Q483453', 'Q241045', 'Q245117',
  'Q20437094', 'Q557141', 'Q575759', 'Q17514', 'Q1088552', 'Q11060274', 'Q15710813', 'Q1404150', 'Q93184', 'Q3304059', 'Q16743958']);

/** The item's own image (P18), only when the item is a work (P31 in WORK_CLASSES) standing within 300 m of the point. */
export async function p18(q: string, at?: { lng: number; lat: number }): Promise<string | null> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'wbgetclaims', entity: q, format: 'json' })) url.searchParams.set(k, v);
  const r = await cachedJsonFetch(url, { headers: UA, cacheDirectory: '.cache/commons-api', pauseMs: 150 });
  const classes = (r.claims?.P31 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
  if (!classes.some((c: string) => WORK_CLASSES.has(c))) return null;
  const coord = r.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (at && coord && Math.hypot((coord.longitude - at.lng) * 68_000, (coord.latitude - at.lat) * 111_000) > 300) return null;
  const v = r.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? `File:${v}` : null;
}

async function find(p: StreetArtPoint): Promise<Found | null> {
  const q = p.q ?? (p.id.startsWith('Q') ? p.id : undefined);
  if (q) {
    const file = await p18(q, p);
    const info = file ? await fileInfo(file) : null;
    if (file && info) return { id: p.id, name: p.name, file, ...info, by: 'wikidata-p18' };
  }
  const near = await commons({ action: 'query', list: 'geosearch', gscoord: `${p.lat}|${p.lng}`, gsradius: String(NEAR_M), gsnamespace: '6', gslimit: '50' });
  for (const g of near.query?.geosearch ?? []) {
    if (!titleNames(g.title, p.name, p.a)) continue;
    const info = await fileInfo(g.title);
    if (info) return { id: p.id, name: p.name, file: g.title, ...info, by: 'commons-near-title', distM: Math.round(g.dist) };
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const art = JSON.parse(await readFile('public/data/extracts/amsterdam/street-art.json', 'utf8')) as StreetArtFile;
  const missing = art.points.filter(p => !p.i).slice(0, limit);
  const found: Found[] = PANORAMA_PHOTOS.filter(f => missing.some(p => p.id === f.id));
  let done = 0;
  for (const p of missing.filter(m => !found.some(f => f.id === m.id))) {
    const f = await find(p).catch(e => { console.error(p.id, String(e).slice(0, 120)); return null; });
    if (f) found.push(f);
    if (++done % 50 === 0) console.log(`${done}/${missing.length} checked, ${found.length} photos`);
  }
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), checked: missing.length, found: found.length,
    byP18: found.filter(f => f.by === 'wikidata-p18').length, byPanorama: found.filter(f => f.by === 'panorama').length, byTitle: found.filter(f => f.by === 'commons-near-title').length, nearM: NEAR_M,
    licence: 'each file keeps its own Commons licence (field licence; credit field author, page)', images: found }, null, 1) + '\n');
  console.log(`${missing.length} points without a photo: ${found.length} found on Commons (${found.filter(f => f.by === 'wikidata-p18').length} Wikidata P18, ${found.filter(f => f.by === 'commons-near-title').length} by title within ${NEAR_M} m) -> ${path.relative(process.cwd(), OUT)}`);
  const why = missing.find(p => p.id === 'n13410980119');
  if (why) console.log(`"Why not" (n13410980119): ${found.some(f => f.id === why.id) ? (found.find(f => f.id === why.id)!.by) : 'no photo'}`);
}
