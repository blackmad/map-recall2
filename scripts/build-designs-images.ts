/**
 * Pictures for the building-design gallery (designs.html, GitHub #84): per design, one street photo it was measured from and
 * one render of its shipped unit, both small JPGs committed under public/canal-drive/designs/img/.
 *
 *   node --import tsx scripts/build-designs-images.ts                 # make what is missing
 *   node --import tsx scripts/build-designs-images.ts --force         # redo every picture
 *   node --import tsx scripts/build-designs-images.ts --only=zo-vw-bay,nn-row
 *   node --import tsx scripts/build-designs-images.ts --check         # images.json and the files agree (no browser, no cache)
 *
 * Photos (City of Amsterdam panorama crops, CC BY 4.0) come from local, uncommitted sources, so this step is run by hand:
 *   1. the camera-matched contact sheets archived in ../map-recall2-source-data/building-types/<area>/sheets/<design>-contact*.jpg
 *      (first row, photo panel), which cover the Nieuw-West designs;
 *   2. the per-pand crops the building-type surveys leave in .cache/building-types/crops/<pand>.jpg, preferring a pand the
 *      spec cites as evidence and that carries the design in the game.
 * Renders: the design's most-placed unit GLB, three in a row (alternating with its mirror unit when there is one), drawn by
 * scripts/building-types/render-page.ts in the game look from a three-quarter street view.
 * Writes public/canal-drive/designs/images.json, which scripts/build-designs-page.ts reads.
 */
import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {chromium, type Page} from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = path.join(ROOT, 'src/canalRecall/buildingTypes/types');
const UNITS = path.join(ROOT, 'public/canal-drive/building-types');
const OUT = path.join(ROOT, 'public/canal-drive/designs');
const IMG = path.join(OUT, 'img');
const MANIFEST = path.join(OUT, 'images.json');
const CROPS = path.join(ROOT, '.cache/building-types/crops');
// The source-data archive sits beside the main checkout; worktrees live one level deeper.
const SHEETS = path.join([process.env.SOURCE_DATA, path.resolve(ROOT, '../map-recall2-source-data'), path.resolve(ROOT, '../../map-recall2-source-data')]
  .find(d => d && fs.existsSync(d)) ?? '/nonexistent', 'building-types');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const flag = (n: string) => process.argv.includes(`--${n}`);
const WIDTH = 640, HEIGHT = 480, QUALITY = 74;

/** Contact sheets whose file name does not carry the design id (the flats survey named them by cluster). */
const SHEET_OVERRIDES: Record<string, string> = {
  'nw-garage-pair-balcony-5st': 'flats/d4-garage-pair-contact.jpg',
  'nw-loggia-stack-flat-5st': 'flats/d1-loggia-white-contact.jpg',
  'nw-portiek-3st-blue-door': 'flats/d5-blue-door-white-contact.jpg',
  'nw-gallery-slab-15st-hogguer': 'sloterplas-towers/nw-gallery-slab-15st-hogguer-contact-close.jpg',
};

export interface DesignImages {
  /** Street photo, relative to public/canal-drive/. */
  photo?: string;
  photoSource?: 'contact-sheet' | 'survey-crop';
  /** The pand the photo shows, when known. */
  photoPand?: string;
  /** Render of the unit, relative to public/canal-drive/. */
  render?: string;
  renderUnit?: string;
}
export interface ImagesManifest { generatedBy: string; credit: string; designs: Record<string, DesignImages> }

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const specs = fs.readdirSync(TYPES).filter(f => f.endsWith('.json')).sort().map(f => readJson<{id: string}>(path.join(TYPES, f)) as {id: string} & Record<string, unknown>);
const manifest: ImagesManifest = fs.existsSync(MANIFEST) ? readJson<ImagesManifest>(MANIFEST)
  : {generatedBy: 'scripts/build-designs-images.ts', credit: 'Street photos: City of Amsterdam panorama images (data.amsterdam.nl), CC BY 4.0', designs: {}};

if (flag('check')) {
  const problems: string[] = [];
  const ids = new Set(specs.map(s => s.id));
  for (const [id, d] of Object.entries(manifest.designs)) {
    if (!ids.has(id)) problems.push(`${id}: no such design spec`);
    for (const f of [d.photo, d.render]) if (f && !fs.existsSync(path.join(ROOT, 'public/canal-drive', f))) problems.push(`${id}: missing ${f}`);
  }
  for (const f of fs.existsSync(IMG) ? fs.readdirSync(IMG) : []) {
    const rel = `designs/img/${f}`;
    if (!Object.values(manifest.designs).some(d => d.photo === rel || d.render === rel)) problems.push(`orphan ${rel}`);
  }
  const without = specs.filter(s => !manifest.designs[s.id]?.render).map(s => s.id);
  if (without.length) console.warn(`designs without pictures yet (run scripts/build-designs-images.ts): ${without.join(', ')}`);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`design images ok (${Object.keys(manifest.designs).length} designs)`);
  process.exit(0);
}

type Instance = {pand: string; unit: string};
const instances = readJson<Instance[]>(path.join(UNITS, 'instances.json'));
const byDesign = new Map<string, Instance[]>();
for (const i of instances) { const id = i.unit.split('__')[0]; (byDesign.get(id) ?? byDesign.set(id, []).get(id)!).push(i); }

/** Pand ids a spec cites: full 16-digit ids, or the 7-digit tails the notes use. */
function citedPands(spec: unknown): string[] {
  const out: string[] = [];
  for (const m of JSON.stringify(spec).matchAll(/\b(0363100012\d{6}|\d{7})\b/g)) {
    const id = m[1].length === 16 ? m[1] : `036310001${m[1]}`;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function findSheet(id: string): string | undefined {
  if (SHEET_OVERRIDES[id] && fs.existsSync(path.join(SHEETS, SHEET_OVERRIDES[id]))) return path.join(SHEETS, SHEET_OVERRIDES[id]);
  if (!fs.existsSync(SHEETS)) return undefined;
  const hits: string[] = [];
  for (const area of fs.readdirSync(SHEETS)) {
    for (const dir of [path.join(SHEETS, area, 'sheets'), path.join(SHEETS, area)]) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) if (f.startsWith(`${id}-contact`) && f.endsWith('.jpg')) hits.push(path.join(dir, f));
    }
  }
  const rank = (f: string) => (/-final\.jpg$/.test(f) ? 0 : f.endsWith(`${id}-contact.jpg`) ? 1 : 2);
  return hits.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
}

async function photoFor(spec: {id: string}): Promise<{buf: Buffer; source: DesignImages['photoSource']; pand?: string} | undefined> {
  const placed = new Set((byDesign.get(spec.id) ?? []).map(i => i.pand));
  const cited = citedPands(spec);
  const crop = (p: string) => path.join(CROPS, `${p}.jpg`);
  const pick = cited.find(p => placed.has(p) && fs.existsSync(crop(p))) ?? cited.find(p => fs.existsSync(crop(p))) ?? [...placed].find(p => fs.existsSync(crop(p)));
  if (pick) return {buf: await sharp(crop(pick)).resize(WIDTH, HEIGHT, {fit: 'cover'}).jpeg({quality: QUALITY, mozjpeg: true}).toBuffer(), source: 'survey-crop', pand: pick};
  const sheet = findSheet(spec.id);
  if (!sheet) return undefined;
  // Contact sheet rows: a 26 px label, then photo | render | overlay panels of 500 x 375.
  const buf = await sharp(sheet).extract({left: 0, top: 26, width: 500, height: 375}).resize(WIDTH, HEIGHT, {fit: 'cover'}).jpeg({quality: QUALITY, mozjpeg: true}).toBuffer();
  return {buf, source: 'contact-sheet'};
}

function unitFor(id: string): {unit: string; mirror?: string} | undefined {
  const counts = new Map<string, number>();
  for (const i of byDesign.get(id) ?? []) { const u = i.unit.replace(/__mirror$/, ''); counts.set(u, (counts.get(u) ?? 0) + 1); }
  let unit = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (!unit) unit = fs.readdirSync(UNITS).filter(f => f.startsWith(`${id}__`) && f.endsWith('.glb') && !f.includes('__mirror')).sort()[0]?.replace(/\.glb$/, '');
  if (!unit || !fs.existsSync(path.join(UNITS, `${unit}.glb`))) return undefined;
  const mirror = fs.existsSync(path.join(UNITS, `${unit}__mirror.glb`)) ? `${unit}__mirror` : undefined;
  return {unit, mirror};
}

let pageP: Promise<Page> | undefined;
let closeBrowser: (() => Promise<void>) | undefined;
async function renderPage(): Promise<Page> {
  pageP ??= (async () => {
    const bundle = await build({entryPoints: [path.join(ROOT, 'scripts/building-types/render-page.ts')], bundle: true, format: 'iife', write: false, minify: false, logLevel: 'silent'});
    const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
    closeBrowser = () => browser.close();
    const page = await browser.newPage({viewport: {width: 1280, height: 960}});
    page.on('pageerror', e => console.error('page error', e.message));
    await page.setContent('<!doctype html><meta charset=utf-8><body></body>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    return page;
  })();
  return pageP;
}

const brickFile = path.join(ROOT, 'public/canal-drive/materials/ambientcg/Bricks057/colour.jpg');
const brick = fs.existsSync(brickFile) ? `data:image/jpeg;base64,${fs.readFileSync(brickFile).toString('base64')}` : undefined;
type Bounds = {min: number[]; max: number[]};

async function renderUnit(u: {unit: string; mirror?: string}): Promise<Buffer> {
  const page = await renderPage();
  const glb = (n: string) => fs.readFileSync(path.join(UNITS, `${n}.glb`)).toString('base64');
  const a = glb(u.unit), b = u.mirror ? glb(u.mirror) : a;
  await page.evaluate(async ([f, o]) => (window as any).bt.load(f, o), [[a], {look: 'game', brick}] as const);
  const one: Bounds = await page.evaluate(() => (window as any).bt.bounds());
  const w = one.max[0] - one.min[0];
  // Wide blocks stand alone; houses and narrow blocks show as a short row (house, mirror, house).
  const row = w < 20 ? [a, b, a] : [a];
  const offsetsX = row.length === 3 ? [-w, 0, w] : [0];
  await page.evaluate(async ([f, o]) => (window as any).bt.load(f, o), [row, {look: 'game', brick, offsetsX}] as const);
  const bb: Bounds = await page.evaluate(() => (window as any).bt.bounds());
  const cx = (bb.min[0] + bb.max[0]) / 2, cz = (bb.min[2] + bb.max[2]) / 2, ground = bb.min[1];
  const rowW = bb.max[0] - bb.min[0], h = bb.max[1] - bb.min[1], depth = bb.max[2] - bb.min[2];
  const hfov = 46, aspect = WIDTH / HEIGHT, yaw = 24 * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / aspect);
  // Distance that fits the row's apparent width (front plus a bit of the side) and its height, with a margin.
  const apparentW = rowW * Math.cos(yaw) + depth * Math.sin(yaw);
  const dist = Math.max(apparentW / 2 / Math.tan(hfov * Math.PI / 360), h / 2 / Math.tan(vfov / 2)) * 1.04 + depth * 0.3;
  const eye = ground + Math.min(Math.max(1.7, h * 0.35), 12);
  const camX = cx + Math.sin(yaw) * dist, camZ = cz + Math.cos(yaw) * dist;
  const targetY = ground + h * 0.45;
  const pitch = Math.atan2(targetY - eye, dist) * 180 / Math.PI;
  const url: string = await page.evaluate(o => (window as any).bt.camera(o), {x: camX, z: camZ, y: eye, heading: -yaw * 180 / Math.PI, pitch, hfov, w: WIDTH, h: HEIGHT, groundY: ground});
  return sharp(Buffer.from(url.split(',')[1], 'base64')).jpeg({quality: QUALITY, mozjpeg: true}).toBuffer();
}

const only = arg('only') ? new Set(arg('only').split(',')) : null;
const force = flag('force');
fs.mkdirSync(IMG, {recursive: true});
let made = 0;
try {
  for (const spec of specs) {
    if (only && !only.has(spec.id)) continue;
    const d: DesignImages = manifest.designs[spec.id] ?? {};
    if (force || !d.photo) {
      const p = await photoFor(spec);
      if (p) {
        const rel = `designs/img/${spec.id}-photo.jpg`;
        fs.writeFileSync(path.join(ROOT, 'public/canal-drive', rel), p.buf);
        Object.assign(d, {photo: rel, photoSource: p.source, photoPand: p.pand}); made++;
      } else console.warn(`${spec.id}: no photo source`);
    }
    if (force || !d.render) {
      const u = unitFor(spec.id);
      if (u) {
        const rel = `designs/img/${spec.id}-unit.jpg`;
        fs.writeFileSync(path.join(ROOT, 'public/canal-drive', rel), await renderUnit(u));
        Object.assign(d, {render: rel, renderUnit: u.unit}); made++;
      } else console.warn(`${spec.id}: no unit GLB`);
    }
    if (d.photo || d.render) manifest.designs[spec.id] = d;
    process.stdout.write(`${spec.id} `);
  }
} finally { await closeBrowser?.(); }
const sorted = Object.fromEntries(Object.entries(manifest.designs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))]));
fs.writeFileSync(MANIFEST, `${JSON.stringify({...manifest, designs: sorted}, null, 1)}\n`);
const bytes = fs.readdirSync(IMG).reduce((s, f) => s + fs.statSync(path.join(IMG, f)).size, 0);
console.log(`\n${made} pictures written; ${Object.keys(sorted).length} designs in ${path.relative(ROOT, MANIFEST)}; img/ ${(bytes / 1e6).toFixed(2)} MB`);
