/**
 * F3 (#381) step 2: measureFacade self-agreement. The same 25 GLBs as agreement.ts are drawn by the Node rasteriser, then again with the
 * camera moved a quarter pixel (`--nudge`: along the wall by default, `vertical`, or `diag`); the nudged frame is measured and judged
 * against the unmoved one (previewVerdict, reference 'render'). Target: PASS on at least 24 of 25. Prints the reasons of every failure
 * and the measurement fields that moved, so a knife edge can be located.
 *
 *   node --import tsx scripts/glb-raster/stability.ts [--only=a,b] [--nudge=wall|vertical|diag|all] [--out=artifacts/glb-raster/stability] [--stable]
 *   --stable  measure with measureFacadeStable (the sub-pixel ensemble vote) instead of one measureFacade call
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderModelsNode, glbFile } from '../../src/canalRecall/glbRaster/render.ts';
import { boxOf, resolveView } from '../../src/canalRecall/glbRaster/views.ts';
import { measureFacade, type FacadeImage, type FacadeMeasurement } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { previewVerdict, blurRgb, storeyLines, PRE_BLUR_PX } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { measureFacadeStable } from '../../src/canalRecall/buildingRecipe/stableMeasure.ts';
import type { RenderView } from '../building-recipes/render.ts';
import { SET } from './agreement.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const MAX_PX = 1800;
let STABLE = false;
const measure = (image: FacadeImage, box: { u0: number; u1: number; v0: number; v1: number }, lines: number[]): FacadeMeasurement => { const input = { image: { ...image, rgb: blurRgb(image.rgb, image.width, image.height, PRE_BLUR_PX) }, box, lines }; return STABLE ? measureFacadeStable(input) : measureFacade(input); };
async function rgbOf(png: Buffer, ppm: number, topM: number): Promise<FacadeImage> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgb: new Uint8Array(data), ppm, topM };
}

export type StabilityRow = { id: string; nudge: string; verdict: string; reasons: string[]; columns: [unknown, unknown]; window: [unknown, unknown]; frontClass: [unknown, unknown]; glazing: [number, number]; wall: [string, string] };

export async function runStability(only: string[] | undefined, nudges: string[]): Promise<{ rows: StabilityRow[]; skipped: string[] }> {
  const rows: StabilityRow[] = [], skipped: string[] = [];
  for (const e of SET) {
    if (only && !only.includes(e.id)) continue;
    if (!fs.existsSync(e.file)) { skipped.push(`${e.id}: ${e.file} missing`); continue; }
    const glb = await glbFile(e.file), box = boxOf(glb.primitives.map(p => p.positions));
    const w = e.wall!(box), len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), top = box.max[1] + 0.5, ppm = Math.min(50, MAX_PX / Math.max(len + 2, top));
    const front = resolveView({ kind: 'front', a: w.a, b: w.b, ppm, v0: 0, v1: top, pad: 1 }, box);
    const ux = (w.b[0] - w.a[0]) / (len || 1), uz = (w.b[1] - w.a[1]) / (len || 1), q = 0.25 / ppm;
    const shift = (dx: number, dy: number, dz: number): RenderView => ({ ...front, eye: [front.eye[0] + dx, front.eye[1] + dy, front.eye[2] + dz], target: [front.target[0] + dx, front.target[1] + dy, front.target[2] + dz], background: '#9fb8cf', noGround: true } as RenderView);
    const views: { name: string; v: RenderView }[] = [{ name: 'base', v: { ...front, background: '#9fb8cf', noGround: true } as RenderView }];
    if (nudges.includes('wall')) views.push({ name: 'wall', v: shift(ux * q, 0, uz * q) });
    if (nudges.includes('vertical')) views.push({ name: 'vertical', v: shift(0, q, 0) });
    if (nudges.includes('diag')) views.push({ name: 'diag', v: shift(ux * q * 0.7071, q * 0.7071, uz * q * 0.7071) });
    const pngs = await renderModelsNode([{ file: e.file }], views.map(x => x.v) as never, {});
    const eaves = Math.min(top - 0.5, w.eaves ?? (e.group === 'landmark' || e.group === 'large' ? top * 0.85 : top - 0.5));
    const mbox = { u0: 1.2, u1: 1 + len - 0.2, v0: 0, v1: eaves }, lines = storeyLines(eaves), topM = front.ortho![2] + front.target[1];
    const base = measure(await rgbOf(pngs[0], ppm, topM), mbox, lines);
    for (let i = 1; i < views.length; i++) {
      const m = measure(await rgbOf(pngs[i], ppm, topM), mbox, lines), v = previewVerdict(m, base, 'render');
      rows.push({ id: e.id, nudge: views[i].name, verdict: v.verdict, reasons: v.reasons, columns: [base.windowColumns ?? base.columns, m.windowColumns ?? m.columns], window: [base.window?.shape ?? null, m.window?.shape ?? null], frontClass: [base.frontClass, m.frontClass], glazing: [base.glazing, m.glazing], wall: [base.wall.hex, m.wall.hex] });
    }
  }
  return { rows, skipped };
}

async function main() {
  STABLE = process.argv.includes('--stable');
  const only = arg('only')?.split(','), nudge = arg('nudge') ?? 'wall', nudges = nudge === 'all' ? ['wall', 'vertical', 'diag'] : [nudge];
  const { rows, skipped } = await runStability(only, nudges);
  for (const n of nudges) {
    const mine = rows.filter(r => r.nudge === n), pass = mine.filter(r => r.verdict === 'PASS').length;
    console.log(`nudge ${n}: ${pass}/${mine.length} PASS`);
    for (const r of mine.filter(x => x.verdict !== 'PASS')) console.log(`  ${r.id}: ${r.verdict} ${r.reasons.join('; ')} | columns ${r.columns.join('->')} window ${r.window.join('->')} class ${r.frontClass.join('->')} glazing ${r.glazing.map(g => g.toFixed(3)).join('->')} wall ${r.wall.join('->')}`);
  }
  if (skipped.length) console.log('skipped:', skipped.join(', '));
  const out = path.resolve(arg('out') ?? 'artifacts/glb-raster/stability'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'stability.json'), JSON.stringify({ nudges, rows, skipped }, null, 1));
}
if (process.argv[1]?.endsWith('glb-raster/stability.ts')) await main();
