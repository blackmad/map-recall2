/**
 * Thumbnails for coverage.html's "own look" examples: a kit render and an exemplar photo crop per block-face house
 * type and per building-type design (family + variant), written to staging, never straight into the extract.
 *
 *   kit renders   the installed chunk GLB that draws most houses of a type, framed frontally on a run of that type's
 *                 houses (chunks.json frontage); a building-type GLB at a three-quarter view. Rendered with the
 *                 building-types review page (scripts/building-types/render-page.ts) in Chromium/SwiftShader.
 *   photo crops   open data only, archived by the lanes: municipal panorama crops (CC BY 4.0, City of Amsterdam)
 *                 from map-recall2-source-data pand-reference-<street>/<pand>/front.jpg, the face's photo strip
 *                 (strip.jpg + scripts/block-face/faces/<face>/strip.json spans), public/data/pand-reference thumbs,
 *                 or the photo tile of a building-type contact sheet (map-recall2-source-data/building-types).
 *
 * Writes artifacts/coverage/out/look/*.jpg and look.json (manifest); build-coverage.ts reads the manifest and, with
 * --publish, copies the images to public/data/extracts/amsterdam/coverage-v1/look/.
 *
 *   node --import tsx scripts/coverage/build-look-thumbs.ts [--source-data=~/Code/map-recall2-source-data] [--only=types|designs]
 * Browser runs on this machine are serialised: bash /tmp/canal-pw.sh node --import tsx scripts/coverage/build-look-thumbs.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import sharp from 'sharp';
import { chromium, type Page } from '@playwright/test';
import { fullPandId } from '../../src/canalRecall/bagTiles';
import { readOwnLookSources } from './ownLook';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PAGE = path.join(ROOT, 'public/canal-drive');
const OUT = path.join(ROOT, 'artifacts/coverage/out/look');
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SOURCE = path.resolve((arg('source-data') ?? process.env.MAP_RECALL_SOURCE_DATA ?? path.join(os.homedir(), 'Code/map-recall2-source-data')).replace(/^~/, os.homedir()));
const ONLY = arg('only');
const W = 320, H = 240, QUALITY = 72;
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const CREDIT = 'City of Amsterdam panorama, CC BY 4.0';

export type LookThumb = { file: string; label: string; credit?: string };
export type LookManifest = {
  version: 1; generatedAt: string; sourceData: string;
  types: Record<string, { render?: LookThumb; photo?: LookThumb; chunk?: string; pand?: string }>;
  /** Keyed by `family__variant`. */
  designs: Record<string, { render?: LookThumb; unit: string }>;
  families: Record<string, { photo?: LookThumb }>;
  missing: string[];
};

fs.mkdirSync(OUT, { recursive: true });
const manifestFile = path.join(OUT, '..', 'look.json');
const manifest: LookManifest = fs.existsSync(manifestFile) && ONLY ? readJson(manifestFile)
  : { version: 1, generatedAt: '', sourceData: '', types: {}, designs: {}, families: {}, missing: [] };
manifest.generatedAt = new Date().toISOString();
manifest.sourceData = SOURCE;
manifest.missing = manifest.missing.filter(m => ONLY && !m.startsWith(`${ONLY.replace(/s$/, '')}:`));

/** Renders fill the frame; photos are letterboxed whole (a facade crop cut to 4:3 loses its gable or its ground floor). */
async function writeJpeg(name: string, input: Buffer | sharp.Sharp, fit: 'cover' | 'contain' = 'cover'): Promise<string> {
  const img = Buffer.isBuffer(input) ? sharp(input) : input;
  const buf = await img.resize(W, H, { fit, position: 'centre', background: '#d9d4c7' }).flatten({ background: '#d9d4c7' }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), buf);
  return `${name}.jpg`;
}

// --- renderer ------------------------------------------------------------------------------------------------
let page: Page | null = null, closeBrowser = async () => {};
async function renderer(): Promise<Page> {
  if (page) return page;
  const bundle = await build({ entryPoints: [path.join(ROOT, 'scripts/building-types/render-page.ts')], bundle: true, format: 'iife', write: false, minify: false, logLevel: 'silent' });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  closeBrowser = () => browser.close();
  page = await browser.newPage({ viewport: { width: W * 2, height: H * 2 } });
  page.on('pageerror', e => console.error('page error', e.message));
  await page.setContent('<!doctype html><meta charset=utf-8><body></body>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return page;
}
type Bounds = { min: number[]; max: number[] };
async function load(glb: string): Promise<Bounds> {
  const p = await renderer();
  await p.evaluate(async b64 => (window as any).bt.load([b64]), fs.readFileSync(glb).toString('base64'));
  return p.evaluate(() => (window as any).bt.bounds());
}
/** Camera looking at `target` from `az` degrees (0 = from +z, positive = from +x), framing a w × h box. */
async function shoot(target: [number, number, number], w: number, h: number, az: number, groundY: number, pitchDeg = 0): Promise<Buffer> {
  const hfov = 38, tan = Math.tan(hfov * Math.PI / 360), vtan = tan * H / W;
  const d = Math.max(w / 2 / tan, h / 2 / vtan) * 1.12;
  const a = az * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  const x = target[0] + Math.sin(a) * Math.cos(p) * d, z = target[2] + Math.cos(a) * Math.cos(p) * d, y = target[1] + Math.sin(p) * d;
  // render-page heading: 0 looks along -z, positive turns toward +x.
  const heading = Math.atan2(target[0] - x, -(target[2] - z)) * 180 / Math.PI;
  const url = await (await renderer()).evaluate(o => (window as any).bt.camera(o), { x, z, y, heading, pitch: -pitchDeg, hfov, w: W * 2, h: H * 2, groundY });
  return Buffer.from(url.split(',')[1], 'base64');
}

// --- photo crops ---------------------------------------------------------------------------------------------
const refDirs = fs.existsSync(SOURCE) ? fs.readdirSync(SOURCE).filter(d => d.startsWith('pand-reference-')).map(d => path.join(SOURCE, d)) : [];
function referencePhoto(pand: string): string | null {
  for (const dir of refDirs) { const f = path.join(dir, pand, 'front.jpg'); if (fs.existsSync(f)) return f; }
  const pub = path.join(ROOT, 'public/data/pand-reference', pand, 'thumb.jpg');
  return fs.existsSync(pub) ? pub : null;
}
/**
 * Face photo strips not yet archived to source-data stay in a checkout's staging/ (block-face lanes write them there):
 * this checkout, the main checkout, then the lane worktrees under it.
 */
const STAGING_ROOTS = (() => {
  const main = ROOT.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`) ? ROOT.slice(0, ROOT.indexOf(`${path.sep}.claude${path.sep}worktrees${path.sep}`)) : ROOT;
  const lanes = path.join(main, '.claude/worktrees');
  return [...new Set([ROOT, main, ...(fs.existsSync(lanes) ? fs.readdirSync(lanes).sort().map(d => path.join(lanes, d)) : [])])].map(r => path.join(r, 'staging'));
})();
/** One pand's span of a face photo strip (rectified facade, pixelsPerMetre wide). */
async function stripCrop(face: string, pand: string): Promise<sharp.Sharp | null> {
  const meta = path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json');
  const image = [path.join(SOURCE, 'block-face-strips', face, 'strip.jpg'), ...STAGING_ROOTS.map(r => path.join(r, 'block-face', face, 'strip.jpg'))].find(f => fs.existsSync(f));
  if (!image || !fs.existsSync(meta)) return null;
  const s = readJson(meta) as { width: number; height: number; spans: { pandId: string; px: [number, number] }[] };
  const span = s.spans.find(x => fullPandId(x.pandId) === fullPandId(pand));
  if (!span) return null;
  const m = await sharp(image).metadata();
  const k = (m.width ?? s.width) / s.width;
  const left = Math.max(0, Math.round(span.px[0] * k)), width = Math.min((m.width ?? 0) - left, Math.round((span.px[1] - span.px[0]) * k));
  if (width < 20) return null;
  // Widen narrow houses to the thumbnail's aspect so the crop shows the whole front, not a sliver.
  const height = m.height ?? s.height, want = Math.min(m.width ?? width, Math.round(height * W / H));
  const l2 = Math.max(0, Math.min((m.width ?? 0) - Math.max(width, want), left - Math.round((Math.max(width, want) - width) / 2)));
  return sharp(image).extract({ left: l2, top: 0, width: Math.max(width, want), height });
}
/** Photo tile (top-left) of a building-type contact sheet: dark label band, then photo | model | overlay columns. */
async function contactPhoto(file: string): Promise<sharp.Sharp | null> {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  // A label row is mostly near-black (white text on #111); a photo row is not.
  // Text rows of the label stay above ~70% dark, photo rows fall far below; the next label starts fully dark.
  const dark = (y: number) => { let n = 0; for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < 40) n++; return n / info.width; };
  let top = 0; while (top < info.height && dark(top) > 0.3) top++;
  let bottom = top; while (bottom < info.height && dark(bottom) < 0.9) bottom++;
  const width = Math.floor(info.width / 3);
  if (bottom - top < 60 || width < 80) return null;
  return sharp(file).extract({ left: 0, top, width, height: bottom - top });
}
const contactSheets = (() => {
  const out = new Map<string, string[]>();
  const root = path.join(SOURCE, 'building-types');
  if (!fs.existsSync(root)) return out;
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/-contact[^/]*\.jpg$/.test(e.name)) { const l = out.get(e.name) ?? []; l.push(p); out.set(e.name, l); } } };
  walk(root);
  return out;
})();
function contactFor(family: string): string | null {
  for (const name of [`${family}-contact-final.jpg`, `${family}-contact.jpg`]) { const l = contactSheets.get(name); if (l?.length) return l.sort()[0]; }
  const any = [...contactSheets].filter(([n]) => n.startsWith(`${family}-contact`)).sort(([a], [b]) => a.localeCompare(b));
  return any[0]?.[1].sort()[0] ?? null;
}

// --- block-face house types ----------------------------------------------------------------------------------
const sources = readOwnLookSources(ROOT);
const typesDir = path.join(ROOT, 'scripts/block-face/types');
const typeEvidence = new Map<string, { pand: string; face?: string }[]>();
for (const [id, district] of sources.typeDistrict) {
  const file = fs.readdirSync(path.join(typesDir, district)).map(f => path.join(typesDir, district, f)).find(f => (readJson(f).id ?? path.basename(f, '.json')) === id)!;
  const ev = ((readJson(file).evidence ?? []) as { face?: string; pands?: string[] }[]).flatMap(e => (e.pands ?? []).map(p => ({ pand: fullPandId(/^\d{6}$/.test(p) ? `0363100012${p}` : p).replace(/^NL\.IMBAG\.Pand\./, ''), face: e.face })));
  typeEvidence.set(id, ev);
}
if (!ONLY || ONLY === 'types') {
  // Every type a chunk draws (library types and a face's own types), plus library types not drawn yet (photo only).
  const drawn = new Map<string, { chunk: (typeof sources.chunks)[number]; pands: string[] }>();
  for (const c of sources.chunks) {
    const byType = new Map<string, string[]>();
    for (const p of c.pands) { const t = sources.pandType.get(fullPandId(p.pandId)); if (t) byType.set(t, [...(byType.get(t) ?? []), p.pandId]); }
    for (const [t, list] of byType) if (list.length > (drawn.get(t)?.pands.length ?? 0)) drawn.set(t, { chunk: c, pands: list });
  }
  for (const id of new Set([...drawn.keys(), ...sources.typeDistrict.keys()])) {
    const entry: LookManifest['types'][string] = {};
    const d = drawn.get(id);
    if (d) {
      const glb = path.join(PAGE, d.chunk.modelUrl.split('?')[0]);
      // A run of neighbouring houses of this type, up to ~22 m of frontage, centred on the first of them.
      const order = d.chunk.pands.filter(p => p.frontage).sort((a, b) => a.frontage!.x0 - b.frontage!.x0);
      const first = order.findIndex(p => d.pands.includes(p.pandId));
      const run = [order[first]];
      for (let i = first + 1; i < order.length && d.pands.includes(order[i].pandId) && order[i].frontage!.x1 - run[0].frontage!.x0 <= 22; i++) run.push(order[i]);
      const x0 = run[0].frontage!.x0, x1 = run[run.length - 1].frontage!.x1;
      try {
        const b = await load(glb);
        const top = Math.max(...run.map(p => p.bounds?.max[1] ?? b.max[1]));
        const w = Math.max(x1 - x0 + 3, top * W / H * 0.75), h = top + 1.5;
        const png = await shoot([(x0 + x1) / 2, h / 2 - 0.4, b.max[2]], w, h, 14, b.min[1], 2);
        entry.render = { file: await writeJpeg(`type-${id}-kit`, png), label: `Kit render: ${run.length} ${run.length === 1 ? 'house' : 'houses'} of ${id} in ${d.chunk.id}` };
        entry.chunk = d.chunk.id; entry.pand = run[0].pandId;
      } catch (e) { manifest.missing.push(`type:${id}:render ${(e as Error).message}`); }
    } else manifest.missing.push(`type:${id}:render (no installed chunk draws it)`);
    // Photo: the drawn exemplar's own front first, then the type's evidence pands.
    const candidates = [...(d ? d.pands.map(p => ({ pand: p, face: sources.chunkFace.get(d.chunk.id) })) : []), ...(typeEvidence.get(id) ?? [])];
    for (const c of candidates) {
      const ref = referencePhoto(c.pand);
      const img = ref ? sharp(ref) : c.face ? await stripCrop(c.face, c.pand) : null;
      if (!img) continue;
      entry.photo = { file: await writeJpeg(`type-${id}-photo`, img, 'contain'), label: `Photo of pand …${c.pand.slice(-6)}${ref ? '' : ` (face ${c.face} strip)`}`, credit: ref?.includes('/public/data/') ? 'City of Amsterdam panorama (pand-reference), CC BY 4.0' : CREDIT };
      break;
    }
    if (!entry.photo) manifest.missing.push(`type:${id}:photo`);
    manifest.types[id] = entry;
    console.log(`type ${id}: ${entry.render ? 'render' : '-'} ${entry.photo ? 'photo' : '-'}`);
  }
}

// --- building-type designs -------------------------------------------------------------------------------------
if (!ONLY || ONLY === 'designs') {
  const instances = readJson(path.join(PAGE, 'building-types/instances.json')) as { unit: string }[];
  const count = new Map<string, number>();
  for (const i of instances) count.set(i.unit, (count.get(i.unit) ?? 0) + 1);
  const byVariant = new Map<string, string>();
  for (const [unit, n] of [...count].sort((a, b) => b[1] - a[1])) { const key = unit.split('__').slice(0, 2).join('__'); if (!byVariant.has(key)) byVariant.set(key, unit); void n; }
  for (const [key, unit] of byVariant) {
    const glb = path.join(PAGE, 'building-types', `${unit}.glb`);
    if (!fs.existsSync(glb)) { manifest.missing.push(`design:${key}:glb`); continue; }
    try {
      const b = await load(glb);
      const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2], hgt = b.max[1] - b.min[1];
      // Which side is the front is not in the GLB (a slab fronts its long side, a row house its short one): shoot the
      // four three-quarter views and keep the busiest (windows and doors), not a blank party wall or gable.
      let png: Buffer | null = null, best = -1;
      for (const az of [35, 125, 215, 305]) {
        const a = az * Math.PI / 180, w = Math.abs(sx * Math.cos(a)) + Math.abs(sz * Math.sin(a)) + 4;
        const shot = await shoot([(b.min[0] + b.max[0]) / 2, b.min[1] + hgt / 2, (b.min[2] + b.max[2]) / 2], w, hgt + 4, az, b.min[1], 12);
        const st = await sharp(shot).extract({ left: W / 2, top: H / 2, width: W, height: H }).greyscale().stats();
        if (st.channels[0].stdev > best) { best = st.channels[0].stdev; png = shot; }
      }
      manifest.designs[key] = { unit, render: { file: await writeJpeg(`design-${key}-kit`, png!), label: `Kit render of ${unit}` } };
    } catch (e) { manifest.missing.push(`design:${key}:render ${(e as Error).message}`); }
    console.log(`design ${key}: ${manifest.designs[key]?.render ? 'render' : '-'}`);
  }
  for (const family of new Set([...byVariant.keys()].map(k => k.split('__')[0]))) {
    const sheet = contactFor(family);
    const img = sheet ? await contactPhoto(sheet) : null;
    if (img) manifest.families[family] = { photo: { file: await writeJpeg(`family-${family}-photo`, img, 'contain'), label: `Photo from the ${path.basename(sheet!, '.jpg')} survey sheet`, credit: CREDIT } };
    else manifest.missing.push(`family:${family}:photo`);
    console.log(`family ${family}: ${img ? 'photo' : '-'}`);
  }
}

await closeBrowser();
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
const files = fs.readdirSync(OUT), bytes = files.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`\n${files.length} thumbnails, ${(bytes / 1024).toFixed(0)} KB (${(bytes / Math.max(1, files.length) / 1024).toFixed(1)} KB each); missing ${manifest.missing.length}:`);
for (const m of manifest.missing) console.log(`  ${m}`);
console.log(`wrote ${manifestFile}`);
