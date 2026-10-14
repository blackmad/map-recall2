/**
 * Measured-wall swatches: fixture GLBs (a quad, material extras `materialSlot` / `tint` / optional `tintSource: 'measured'`)
 * rendered through the game's city look. Shared by tests/e2e/building-look.spec.ts and the before/after sheet:
 *
 *   node --import tsx scripts/look/measured-swatches.ts [out.png]
 */
import fs from 'node:fs/promises';
import {Document, NodeIO} from '@gltf-transform/core';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {hexToRgb} from '../../src/canalRecall/look/palette.ts';

const srgbToLinear = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

/** A 2x2 m quad facing +Z with UVs in metres, one material carrying the slot extras (what export-glb.ts writes). */
export async function swatchGlb(slot: string, hex: string, source?: 'measured'): Promise<Buffer> {
  const doc = new Document(), buffer = doc.createBuffer();
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const material = doc.createMaterial(`${slot}-${hex}`).setBaseColorFactor([r, g, b, 1]).setMetallicFactor(0).setRoughnessFactor(0.9)
    .setExtras({materialSlot: slot, tint: hex, ...(source ? {tintSource: source} : {})});
  const acc = (type: 'VEC3' | 'VEC2', a: number[]) => doc.createAccessor().setType(type).setArray(new Float32Array(a)).setBuffer(buffer);
  const prim = doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', acc('VEC3', [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]))
    .setAttribute('NORMAL', acc('VEC3', Array(6).fill([0, 0, 1]).flat()))
    .setAttribute('TEXCOORD_0', acc('VEC2', [0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2]));
  const mesh = doc.createMesh('swatch').addPrimitive(prim);
  doc.createScene('s').addChild(doc.createNode('swatch').setMesh(mesh));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

export async function swatchBundle(): Promise<string> {
  const out = await build({entryPoints: ['scripts/look/measured-swatch-page.ts'], bundle: true, write: false, format: 'iife', platform: 'browser'});
  return out.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
}
export async function brickDataUrl(): Promise<string> {
  return `data:image/jpeg;base64,${(await fs.readFile('public/canal-drive/materials/ambientcg/Bricks057/colour.jpg')).toString('base64')}`;
}

export type SwatchSpec = {slot: string; hex: string; source?: 'measured'; label: string};
export type SwatchResult = {png: string; means: number[][]};
export async function renderSpecs(page: {setContent(html: string): Promise<void>; evaluate: (fn: any, arg: any) => Promise<any>}, specs: SwatchSpec[], columns: number): Promise<SwatchResult> {
  await page.setContent(`<html><body style="margin:0"><script>${await swatchBundle()}</script></body></html>`);
  const payload = await Promise.all(specs.map(async s => ({label: s.label, base64: (await swatchGlb(s.slot, s.hex, s.source)).toString('base64')})));
  const brick = await brickDataUrl();
  return await page.evaluate(([p, c, b]: [unknown, number, string]) => (window as any).renderSwatches(p, c, b), [payload, columns, brick] as const);
}

export const SHEET_HEXES = [['dark', '#3a2a28'], ['mid', '#8a3e2e'], ['pale', '#d8d2c4']] as const;

async function main() {
  const out = process.argv[2] ?? 'artifacts/look/measured-swatches.png';
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage();
  // Columns: authored (paint slot, the reference), unmeasured brick (before), measured brick (after).
  const specs: SwatchSpec[] = SHEET_HEXES.flatMap(([name, hex]) => [
    {slot: 'paint', hex, label: `${name} ${hex} authored`},
    {slot: 'brick', hex, label: `${name} ${hex} unmeasured (before)`},
    {slot: 'brick', hex, source: 'measured' as const, label: `${name} ${hex} measured (after)`},
  ]);
  const {png, means} = await renderSpecs(page, specs, 3);
  await browser.close();
  const raw = Buffer.from(png.split(',')[1], 'base64'), meta = await sharp(raw).metadata();
  const titles = ['authored colour', 'unmeasured brick (before)', 'measured brick (after)'];
  const svg = `<svg width="${meta.width}" height="${meta.height! + 40}">${titles.map((t, i) => `<text x="${i * 150 + 6}" y="26" font-family="Helvetica" font-size="13" fill="#1f2328">${t}</text>`).join('')}${
    specs.map((s, i) => `<text x="${(i % 3) * 150 + 6}" y="${40 + Math.floor(i / 3) * 150 + 142}" font-family="Helvetica" font-size="11" fill="#fff" stroke="#000" stroke-width="0.3">${s.hex} rgb(${means[i].map(Math.round)})</text>`).join('')}</svg>`;
  await fs.mkdir(out.replace(/\/[^/]*$/, ''), {recursive: true});
  await sharp({create: {width: meta.width!, height: meta.height! + 40, channels: 3, background: '#f4f4f2'}}).composite([{input: raw, top: 40, left: 0}, {input: Buffer.from(svg), top: 0, left: 0}]).png().toFile(out);
  console.log(JSON.stringify(specs.map((s, i) => ({label: s.label, rgb: means[i].map(Math.round)})), null, 1));
  console.log('wrote', out);
}
if (process.argv[1]?.endsWith('measured-swatches.ts')) main();
