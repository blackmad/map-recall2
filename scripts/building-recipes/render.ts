/**
 * Headless-Chromium (WebGL via SwiftShader) renders of building GLBs and the
 * contact sheet: reference photo | recipe front | recipe 3/4 | existing model 3/4.
 *
 *   node --import tsx scripts/building-recipes/render.ts --house=keizers-575 [--existing=public/canal-drive/models/ordinary-buildings/0363100012176752.glb] [--textures]
 *   node --import tsx scripts/building-recipes/render.ts --row=bloemgracht-78,bloemgracht-80,... --out=artifacts/building-recipes/row-x.png
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium, type Browser, type Page} from 'playwright';
import sharp from 'sharp';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const ARTIFACTS = 'artifacts/building-recipes', HOUSES = 'scripts/building-recipes/houses';
export interface RenderModel { file: string; position?: number[]; rotationY?: number; scale?: number[] }
export interface RenderView { eye: number[]; target: number[]; fov: number; width: number; height: number }

let browser: Browser | null = null, page: Page | null = null;
async function getPage(): Promise<Page> {
  if (page) return page;
  const bundle = await build({entryPoints: ['scripts/building-recipes/render-page.ts'], bundle: true, write: false, format: 'iife', platform: 'browser'});
  browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  page = await browser.newPage();
  await page.setContent(`<html><body style="margin:0"><script>${bundle.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')}</script></body></html>`);
  return page;
}
export async function closeRenderer() { await browser?.close(); browser = null; page = null; }

export async function renderModels(models: RenderModel[], views: RenderView[], textures?: Record<string, string>): Promise<Buffer[]> {
  const p = await getPage();
  const payload = await Promise.all(models.map(async m => ({...m, base64: (await fs.readFile(m.file)).toString('base64')})));
  const tex = textures ? Object.fromEntries(await Promise.all(Object.entries(textures).map(async ([k, f]) => [k, `data:image/png;base64,${(await fs.readFile(f)).toString('base64')}`]))) : undefined;
  const urls: string[] = await p.evaluate(([m, v, t]) => (window as any).renderGlbs(m, v, t), [payload, views, tex] as const);
  return urls.map(u => Buffer.from(u.split(',')[1], 'base64'));
}

/** Front-on and three-quarter views of a frontage, in a model's local frame (x east, z south). */
export function frontViews(target: number[], normal: number[], widthM: number, heightM: number, size = {width: 640, height: 800}) {
  const size2 = Math.max(widthM * size.height / size.width, heightM) * 1.25, fov = 30;
  const dist = size2 / 2 / Math.tan(fov * Math.PI / 360);
  const mid = [target[0], heightM / 2, target[2]];
  const yaw = 38 * Math.PI / 180, [nx, nz] = normal, rx = nx * Math.cos(yaw) - nz * Math.sin(yaw), rz = nx * Math.sin(yaw) + nz * Math.cos(yaw);
  return {
    front: {eye: [mid[0] + nx * dist, Math.max(1.7, heightM * 0.35), mid[2] + nz * dist], target: mid, fov, ...size},
    threeQuarter: {eye: [mid[0] + rx * dist * 1.05, heightM * 0.9, mid[2] + rz * dist * 1.05], target: [mid[0], heightM * 0.45, mid[2]], fov, ...size},
  };
}

/** RD → a model local frame. Recipe models: RD offsets from anchorRD. Ordinary models: degree-scaled metres from a lng/lat anchor. */
export const rdToRecipeLocal = (p: number[], anchorRD: number[]) => [p[0] - anchorRD[0], 0, anchorRD[1] - p[1]];
export function rdToOrdinaryLocal(p: number[], anchor: number[]) {
  const [lng, lat] = rdToLngLat({x: p[0], y: p[1]});
  return [(lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), 0, -(lat - anchor[1]) * 111320];
}

async function label(image: Buffer, text: string, width: number, height: number) {
  const base = await sharp(image).resize(width, height, {fit: 'contain', background: '#ffffff'}).png().toBuffer();
  const svg = `<svg width="${width}" height="34"><rect width="100%" height="100%" fill="#1f2328"/><text x="10" y="23" font-family="Helvetica, Arial" font-size="17" fill="#ffffff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
  return sharp({create: {width, height: height + 34, channels: 3, background: '#ffffff'}}).composite([{input: Buffer.from(svg), top: 0, left: 0}, {input: base, top: 34, left: 0}]).png().toBuffer();
}
export async function contactSheet(panels: {image: Buffer; text: string}[], out: string, panel = {width: 480, height: 600}, title?: string) {
  const labelled = await Promise.all(panels.map(p => label(p.image, p.text, panel.width, panel.height)));
  const top = title ? 40 : 0, width = panel.width * panels.length + 8 * (panels.length - 1), height = panel.height + 34 + top;
  const comps = labelled.map((input, i) => ({input, left: i * (panel.width + 8), top}));
  if (title) comps.push({input: Buffer.from(`<svg width="${width}" height="40"><text x="10" y="27" font-family="Helvetica, Arial" font-size="22" font-weight="bold" fill="#1f2328">${title.replace(/&/g, '&amp;')}</text></svg>`), left: 0, top: 0});
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp({create: {width, height, channels: 3, background: '#f4f4f2'}}).composite(comps).png().toFile(out);
}

export async function houseContactSheet(id: string, existing?: {file: string; anchor: number[]}, textures?: Record<string, string>) {
  const facts: BuildingFacts = JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8'));
  const report = JSON.parse(await fs.readFile(path.join(ARTIFACTS, id, 'report.json'), 'utf8'));
  const sheets: string[] = [];
  for (const [i, ff] of facts.fronts.entries()) {
    const mid = [(ff.endpointsRD[0][0] + ff.endpointsRD[1][0]) / 2, (ff.endpointsRD[0][1] + ff.endpointsRD[1][1]) / 2];
    const height = Math.max(...report.fit.fronts.map((f: any) => f.crownTopM), facts.heights.roofMaxM) + 1;
    const normal = [ff.outwardNormalRD[0], -ff.outwardNormalRD[1]];
    const local = rdToRecipeLocal(mid, report.anchorRD), views = frontViews(local, normal, ff.widthM, height);
    const [front, three] = await renderModels([{file: path.join(ARTIFACTS, id, 'model.glb')}], [views.front, views.threeQuarter], textures);
    const photos = JSON.parse(await fs.readFile(path.join(HOUSES, id, 'photos.json'), 'utf8').catch(() => '[]'));
    // Prefer the photo the intent author cited for this front; fall back to the facts-step panorama crop.
    const intent = JSON.parse(await fs.readFile(path.join(HOUSES, id, 'intent.json'), 'utf8'));
    const cited = intent.sources?.filter((s: any) => s.image && !s.image.includes('/photo-'))[i];
    const photo = cited ? {image: cited.image, timestamp: cited.capturedAt} : photos[i];
    const panels = [{image: photo ? await fs.readFile(photo.image) : await sharp({create: {width: 4, height: 5, channels: 3, background: '#dddddd'}}).png().toBuffer(), text: photo ? `reference ${photo.timestamp.slice(0, 10)} (panorama)` : 'no reference photo'},
      {image: front, text: `recipe front · ${report.triangles} tris`}, {image: three, text: 'recipe 3/4'}];
    if (existing) {
      const el = rdToOrdinaryLocal(mid, existing.anchor), ev = frontViews(el, normal, ff.widthM, height);
      const [old] = await renderModels([{file: existing.file}], [ev.threeQuarter]);
      panels.push({image: old, text: 'existing hand-built 3/4'});
    }
    const out = path.join(ARTIFACTS, id, facts.fronts.length > 1 ? `contact-${ff.street.toLowerCase()}.png` : 'contact.png');
    await contactSheet(panels, out, undefined, `${id} — ${ff.street}`);
    sheets.push(out);
  }
  return sheets;
}

/** Street-row view: several recipe models placed in a shared frame, seen from across the street. */
export async function rowSheet(ids: string[], out: string, textures?: Record<string, string>) {
  const all = await Promise.all(ids.map(async id => ({id, facts: JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8')) as BuildingFacts, report: JSON.parse(await fs.readFile(path.join(ARTIFACTS, id, 'report.json'), 'utf8'))})));
  const origin = all[0].report.anchorRD;
  const models = all.map(h => ({file: path.join(ARTIFACTS, h.id, 'model.glb'), position: [h.report.anchorRD[0] - origin[0], 0, origin[1] - h.report.anchorRD[1]]}));
  const ends = all.flatMap(h => h.facts.fronts[0].endpointsRD);
  const xs = ends.map(p => p[0]), ys = ends.map(p => p[1]);
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const n = all.map(h => h.facts.fronts[0].outwardNormalRD).reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]), len = Math.hypot(n[0], n[1]);
  const width = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), height = Math.max(...all.map(h => h.facts.heights.roofMaxM)) + 2;
  const views = frontViews(rdToRecipeLocal(mid, origin), [n[0] / len, -n[1] / len], width, height, {width: 1400, height: 700});
  const [front, three] = await renderModels(models, [views.front, views.threeQuarter], textures);
  await fs.mkdir(path.dirname(out), {recursive: true});
  await sharp({create: {width: 1400, height: 1408, channels: 3, background: '#ffffff'}}).composite([{input: front, top: 0, left: 0}, {input: three, top: 708, left: 0}]).png().toFile(out);
  return out;
}

if (process.argv[1]?.endsWith('building-recipes/render.ts')) {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const textures = process.argv.includes('--textures') ? {brick: 'artifacts/building-recipes/textures/brick-256.png', roofTile: 'artifacts/building-recipes/textures/roof-tile-256.png', slate: 'artifacts/building-recipes/textures/roof-tile-256.png'} : undefined;
  try {
    if (arg('row')) console.log(await rowSheet(arg('row')!.split(','), arg('out') ?? `${ARTIFACTS}/row.png`, textures));
    for (const id of (arg('house') ?? '').split(',').filter(Boolean)) {
      const ex = arg('existing'), anchor = arg('existing-anchor')?.split(',').map(Number);
      console.log(await houseContactSheet(id, ex && anchor ? {file: ex, anchor} : undefined, textures));
    }
  } finally { await closeRenderer(); }
}
