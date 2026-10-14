/**
 * Measured pilots through the real game look: compiles the three re-fitted large recipes (Apollohal, Houthavenkade 26,
 * Waagdragerhof), renders each measured wall group front-on through the city look (and the legacy recipe look and the
 * raw GLB materials the kit sheets drew), and measures the mean rendered sRGB of every measured material against its
 * authored hex. The baked shade of the wall's facing is divided out before the comparison (a north wall is drawn at
 * ~0.7 of its colour by design); `ΔL` is HSL lightness 0..1.
 *
 *   node --import tsx scripts/look/measured-walls.ts [--label=after] [--out=artifacts/look/measured-walls] [--paths=raw,legacy,city]
 *
 * Writes <out>/<label>.json (the table) and <out>/<label>-<pilot>-<path>.png (front views). `measured-pilots-sheet.ts`
 * composes the before/after sheet from two labels.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {compileLargeHouse} from '../building-recipes/large.ts';
import {bakedWallShade} from '../../src/canalRecall/rendererShared/lightRig.ts';
import {hexToRgb, rgbToHsl} from '../../src/canalRecall/look/palette.ts';
import type {WallPath, WallRequest, WallResult, WallView} from './measured-walls-page.ts';

export type Pilot = {id: string; groups: number[]; photo: string; crop?: {left: number; top: number; width: number; height: number}};
/** The kit-vocabulary sheet's rows (lane C, 2026-10-14): the measured groups each photo shows. */
export const PILOTS: Pilot[] = [
  {id: 'apollolaan-4-134507', groups: [0], photo: 'staging/pand-reference-walls/0363100012134507/w01-231.jpg'},
  {id: 'houthavenkade-26-247232', groups: [0, 1], photo: 'staging/pand-reference-walls/0363100012247232/w01-2.jpg'},
  {id: 'waagdragerhof-198-118320', groups: [0], photo: 'staging/pand-reference-walls/0363100012118320/w03-286.jpg'},
  {id: 'waagdragerhof-198-118320', groups: [3], photo: 'staging/pand-reference-walls/0363100012118320/w01-16.jpg', crop: {left: 1640, top: 300, width: 732, height: 459}},
];
export const PATHS: WallPath[] = ['raw', 'legacy', 'city'];

export type Row = {pilot: string; groups: number[]; material: string; role: 'wall' | 'arch' | 'glass'; authored: string; path: WallPath; year: number | null; shade: number; rgb: number[]; unshaded: number[]; dL: number; pixels: number};
const L = (rgb: number[]) => rgbToHsl(rgb.map(v => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number])[2];

async function bundle() {
  const out = await build({entryPoints: ['scripts/look/measured-walls-page.ts'], bundle: true, write: false, format: 'iife', platform: 'browser'});
  return out.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
}

/** Front-on view of the groups' main panels (the kit sheet's framing), and the baked shade of the first panel's facing. */
function frontView(built: Awaited<ReturnType<typeof compileLargeHouse>>['built'], groups: number[]): {view: WallView; shade: number} {
  const r = built.recipe, top = Math.max(built.facts.heights.roofMaxM, 6);
  const ps = groups.map(g => built.panels[r.groups[g].mainPanel!]), p = ps[0];
  const ends = ps.flatMap(q => [q.uMin, q.uMax].map(u => [q.o[0] + q.r[0] * u, q.o[2] + q.r[2] * u]));
  const xs = ends.map(e => e[0]), zs = ends.map(e => e[1]);
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, top / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  const W = Math.max(Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)), 8);
  const fov = 30, dist = Math.max(W * 0.75, top) * 1.1 / 2 / Math.tan(fov * Math.PI / 360);
  const len = Math.hypot(p.n[0], p.n[2]) || 1;
  // Model frame: +x east, +y up, +z south, so the ENU normal is (x, -z).
  return {view: {eye: [mid[0] + p.n[0] * dist, Math.max(1.7, top * 0.35), mid[2] + p.n[2] * dist], target: mid, fov, width: 800, height: 560}, shade: bakedWallShade(p.n[0] / len, -p.n[2] / len)};
}

/** Measured materials of the groups: wall brick, arch ring, glass (names as export-glb writes them). */
function targetsOf(intent: any, groups: number[], materials: string[]) {
  const out: {material: string; role: Row['role']; authored: string}[] = [];
  const add = (hex: string | undefined, slot: string, role: Row['role']) => {
    if (!hex) return;
    const key = hex.slice(1).toLowerCase(), name = materials.find(m => m === `${key}_${slot}_measured`) ?? materials.find(m => m === `${key}_${slot}`);
    if (name && !out.some(o => o.material === name)) out.push({material: name, role, authored: hex.toLowerCase()});
  };
  for (const g of groups) {
    const pal = intent.walls[g].palette ?? {};
    add(pal.brick, 'brick', 'wall'); add(pal.arch, 'brick', 'arch'); add(pal.glass, 'glass', 'glass');
  }
  return out;
}

type EvalPage = {setContent(html: string): Promise<void>; evaluate: (fn: any, arg: any) => Promise<any>};
/** Loads the measurement page (the game's looks, bundled) into a Playwright page. */
export async function loadWallPage(page: EvalPage) {
  await page.setContent(`<html><body style="margin:0"><script>${await bundle()}</script></body></html>`);
}
const dataUrl = async (f: string, type: string) => `data:${type};base64,${(await fs.readFile(f)).toString('base64')}`;
/** The trial tiles the old sheet column used (make-textures.ts; untracked, regenerate with that script); undefined when absent. */
async function trialTiles() {
  const tiles = 'artifacts/building-recipes/textures';
  try { return {brick: await dataUrl(`${tiles}/brick-256.png`, 'image/png'), roofTile: await dataUrl(`${tiles}/roof-tile-256.png`, 'image/png'), slate: await dataUrl(`${tiles}/roof-tile-256.png`, 'image/png')}; } catch { return undefined; }
}

/** One pilot wall: compile the recipe, render the front view through each path, measure each measured material. */
export async function measurePilot(page: EvalPage, pl: Pilot, paths: WallPath[] = PATHS): Promise<{rows: Row[]; pngs: Partial<Record<WallPath, Buffer>>}> {
  const brickUrl = await dataUrl('public/canal-drive/materials/ambientcg/Bricks057/colour.jpg', 'image/jpeg');
  const rawMaps = paths.includes('raw') ? await trialTiles() : undefined;
  const {built, intent} = await compileLargeHouse(pl.id);
  const glb = await fs.readFile(path.join('artifacts/building-recipes', pl.id, 'model.glb'));
  const {view, shade} = frontView(built, pl.groups);
  const targets = targetsOf(intent, pl.groups, await materialNames(glb));
  const year: number | null = findYear(built.facts);
  const rows: Row[] = [], pngs: Partial<Record<WallPath, Buffer>> = {};
  for (const p of paths) {
    const req: WallRequest = {base64: glb.toString('base64'), year: p === 'city' ? year : null, path: p, views: [view], targets: targets.map(t => t.material), brickUrl, ...(p === 'raw' && rawMaps ? {rawMaps} : {})};
    const [res] = await page.evaluate((r: WallRequest) => (window as any).renderWalls(r), req) as WallResult[];
    pngs[p] = Buffer.from(res.png.split(',')[1], 'base64');
    for (const t of targets) {
      const m = res.means[t.material], s = p === 'raw' ? 1 : shade, unshaded = m.rgb.map(v => v / s);
      rows.push({pilot: pl.id, groups: pl.groups, material: t.material, role: t.role, authored: t.authored, path: p, year: req.year, shade: +s.toFixed(3), rgb: m.rgb.map(Math.round), unshaded: unshaded.map(Math.round), dL: +(L(unshaded) - L(hexToRgb(t.authored))).toFixed(3), pixels: m.pixels});
    }
  }
  return {rows, pngs};
}

export async function measurePilots(label: string, outDir: string, paths: WallPath[] = PATHS) {
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage();
  await loadWallPage(page);
  await fs.mkdir(outDir, {recursive: true});
  const rows: Row[] = [], images: Record<string, string> = {};
  try {
    for (const [k, pl] of PILOTS.entries()) {
      const res = await measurePilot(page, pl, paths);
      rows.push(...res.rows);
      for (const [p, png] of Object.entries(res.pngs)) {
        const file = path.join(outDir, `${label}-${k}-${p}.png`);
        await fs.writeFile(file, png!);
        images[`${k}-${p}`] = file;
      }
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(outDir, `${label}.json`), JSON.stringify({label, rows, images}, null, 1) + '\n');
  return {rows, images};
}

/** BAG construction year from the facts (`builtYear`, wherever the facts step put it). */
function findYear(facts: unknown): number | null {
  const m = JSON.stringify(facts).match(/"builtYear":\s*(\d{4})/);
  return m ? Number(m[1]) : null;
}

async function materialNames(glb: Buffer): Promise<string[]> {
  const {NodeIO} = await import('@gltf-transform/core');
  const {KHRMeshQuantization} = await import('@gltf-transform/extensions');
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(new Uint8Array(glb));
  return doc.getRoot().listMaterials().map(m => m.getName());
}

export function table(rows: Row[]) {
  const head = '| pilot | groups | material | role | authored | path | shade | rendered | ÷ shade | ΔL |\n|---|---|---|---|---|---|---|---|---|---|';
  return [head, ...rows.map(r => `| ${r.pilot} | ${r.groups.join(',')} | ${r.material} | ${r.role} | ${r.authored} | ${r.path}${r.year ? ` (${r.year})` : ''} | ${r.shade} | ${r.rgb.join(',')} | ${r.unshaded.join(',')} | ${r.dL >= 0 ? '+' : ''}${r.dL.toFixed(3)} |`)].join('\n');
}

if (process.argv[1]?.endsWith('measured-walls.ts')) {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const {rows} = await measurePilots(arg('label') ?? 'after', arg('out') ?? 'artifacts/look/measured-walls', arg('paths')?.split(',') as WallPath[] | undefined);
  console.log(table(rows));
}
