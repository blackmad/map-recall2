/**
 * Lane H2's acceptance sheet (docs/house-line.md §2): for each pand, the Node preview's front beside the
 * scripts/building-recipes/render.ts frame (headless Chromium, the GLB the pand is drawn from on the kit routes) and the
 * reference photo, all on the wall's axis at 50 px/m, with measureFacade + the likeness tolerances between each pair.
 *
 *   /tmp/canal-pw.sh node --import tsx scripts/house-preview/gate.ts --face=nassau-145-152:0363100012164843,... \
 *       --recipe=cw-heren-175702,cw-keizers-171052 [--out=artifacts/house-preview/gate]
 *
 * `--face=<face>:<pand>,...`: the block-face chunk staging/block-face/<face>/chunk.glb (compile.ts --face first), in the
 * strip frame (x along the strip's u from midRD, y up, z out of the face). `--recipe=<house>,...`: the recipe GLB
 * (artifacts/building-recipes/<house>/model.glb), x east, y up, z south from report.anchorRD. Uses Chromium: run it
 * under /tmp/canal-pw.sh.
 *
 * `--unlit`: the preview in the legacy unlit look (default: the lit city look). `--blur=0`: measure without the shared
 * PRE_BLUR_PX (the before numbers of lane H2b); `--no-wall-vs-trim`: the pre-H2c wall pick (wallTrim.ts off); `--no-opening-split`: the pre-H2d opening and wall estimate; default every image, preview, render.ts and photo, is blurred by it.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderModels, closeRenderer, useBrowserRenderer } from '../building-recipes/render.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { measureFacade, type FacadeImage } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { previewVerdict, blurRgb, PRE_BLUR_PX, type PreviewVerdict } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { PreviewSession, parseArgs, renderPand, renderRecipe, compareSheet, houseLineSplit, profileUsed, type PreviewResult } from './preview.ts';
import { REPO_ROOT } from './nodeDom.ts';

// This gate is the Node preview against the Chromium frame: keep render.ts on Chromium (lane H12 made Node its default).
useBrowserRenderer();
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = path.resolve(arg('out') ?? 'artifacts/house-preview/gate');
const PPM = 50;
const BLUR = arg('blur') !== undefined ? Number(arg('blur')) : PRE_BLUR_PX;
const previewFlags = (pand: string) => [pand, '--photo', ...(process.argv.includes('--unlit') ? ['--unlit'] : [])];
const measure = (input: Parameters<typeof measureFacade>[0]) => measureFacade({ ...input, ...(process.argv.includes('--no-wall-vs-trim') ? { wallVsTrim: false } : {}), ...houseLineSplit(), image: { ...input.image, rgb: blurRgb(input.image.rgb, input.image.width, input.image.height, BLUR) } });
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

async function rgbOf(png: Buffer, topM: number): Promise<FacadeImage> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: PPM, topM };
}

type Row = { pand: string; label: string; preview: PreviewResult; renderTs: { file: string; ms: number }; vsRenderTs: PreviewVerdict | null; vsPhoto: PreviewVerdict | null; renderTsVsPhoto: PreviewVerdict | null };

async function one(label: string, pand: string, preview: PreviewResult, glb: string, frame: { mid: number[]; normal: number[]; lenM: number }): Promise<Row> {
  const m = preview.measure as any, top: number = m.heights.topM, lines: number[] = m.heights.lines, eaves: number = m.heights.eavesM;
  const width = Math.round(frame.lenM * PPM), height = Math.round(top * PPM);
  const eye = [frame.mid[0] + frame.normal[0] * 200, top / 2, frame.mid[2] + frame.normal[1] * 200];
  const t0 = performance.now();
  const [png] = await renderModels([{ file: glb }], [{ eye, target: [frame.mid[0], top / 2, frame.mid[2]], fov: 30, width, height, ortho: [-frame.lenM / 2, frame.lenM / 2, top / 2, -top / 2], background: '#9fb8cf', noGround: true }]);
  const ms = performance.now() - t0;
  const file = path.join(out, `${pand}-render-ts.png`);
  await sharp(png).png().toFile(file);
  const box = { u0: 0.2, u1: frame.lenM - 0.2, v0: 0, v1: eaves };
  const rts = measure({ image: await rgbOf(png, top), box, lines });
  const prev = measure({ image: await rgbOf(fs.readFileSync(path.join(preview.out, 'front.png')), top), box, lines });
  const vsRenderTs = previewVerdict(prev, rts, 'render');
  let vsPhoto: PreviewVerdict | null = null, renderTsVsPhoto: PreviewVerdict | null = null, photoPng: Buffer | null = null, photoTop = 0, photoLabel = '';
  if (m.photo?.file) {
    const ref = path.join(REPO_ROOT, 'staging/pand-reference', pand, 'reference.json');
    const crop = fs.existsSync(ref) ? readJson(ref).primary.crop : null;
    if (crop) {
      photoTop = crop.wallHeightM; photoLabel = m.photo.kind;
      const meta = await sharp(path.join(REPO_ROOT, m.photo.file)).metadata(), k = PPM / crop.pixelsPerMetre;
      photoPng = await sharp(path.join(REPO_ROOT, m.photo.file)).resize(Math.round(meta.width! * k), Math.round(meta.height! * k), { fit: 'fill' }).png().toBuffer();
      const photo = measure({ image: await rgbOf(photoPng, photoTop), box: { ...box, v1: Math.min(box.v1, photoTop) }, lines: lines.filter(l => l <= photoTop) });
      vsPhoto = previewVerdict(prev, photo); renderTsVsPhoto = previewVerdict(rts, photo);
    }
  }
  const panels = [{ png: fs.readFileSync(path.join(preview.out, 'front.png')), label: `Node preview (${m.route})`, topM: top }, { png: await sharp(png).png().toBuffer(), label: `render.ts (Chromium, ${path.basename(glb)})`, topM: top }];
  if (photoPng) panels.push({ png: photoPng, label: photoLabel, topM: photoTop });
  await compareSheet(panels, PPM, vsRenderTs, path.join(out, `${pand}-sheet.png`), `preview route ${m.route} · ${m.shader === 'unlit' ? 'unlit (legacy)' : 'lit city look'} · measured after a ${BLUR} px blur · verdict: preview vs render.ts`);
  return { pand, label, preview, renderTs: { file, ms }, vsRenderTs, vsPhoto, renderTsVsPhoto };
}

const rows: Row[] = [];
const session = new PreviewSession('photo');
fs.mkdirSync(out, { recursive: true });
try {
  for (const spec of (arg('face') ?? '').split(',').filter(Boolean)) {
    const [face, pand] = spec.includes(':') ? spec.split(':') : [arg('face-default') ?? '', spec];
    const s = readJson(path.join(REPO_ROOT, 'scripts/block-face/faces', face, 'strip.json'));
    const preview = await renderPand(session, pand, { ...parseArgs(previewFlags(pand)), out: path.join(out, pand) });
    const w = (preview.measure as any).wall, along = (ll: number[]) => { const p = lngLatToRd(ll as [number, number]); return (p.x - s.frame.midRD[0]) * s.frame.uRD[0] + (p.y - s.frame.midRD[1]) * s.frame.uRD[1]; };
    const xa = along(w.a), xb = along(w.b);
    if (xb < xa) throw new Error(`${pand}: the wall runs against the strip's u axis`);
    rows.push(await one(`${face} ${pand}`, pand, preview, path.join(REPO_ROOT, 'staging/block-face', face, 'chunk.glb'), { mid: [(xa + xb) / 2, 0, 0], normal: [0, 1], lenM: xb - xa }));
  }
  for (const house of (arg('recipe') ?? '').split(',').filter(Boolean)) {
    const intent = readJson(path.join(REPO_ROOT, 'scripts/building-recipes/houses', house, 'intent.json')), pand = String(intent.pandId);
    const preview = await renderRecipe(session, pand, house, { ...parseArgs(previewFlags(pand)), out: path.join(out, pand) });
    const generic = await renderPand(session, pand, { ...parseArgs(previewFlags(pand)), out: path.join(out, `${pand}-generic`) });
    const report = readJson(path.join(REPO_ROOT, 'artifacts/building-recipes', house, 'report.json')), anchor = report.anchorRD;
    const w = (preview.measure as any).wall, A = lngLatToRd(w.a), B = lngLatToRd(w.b);
    const ax = A.x - anchor[0], az = anchor[1] - A.y, bx = B.x - anchor[0], bz = anchor[1] - B.y, len = Math.hypot(bx - ax, bz - az);
    const rx = (bx - ax) / len, rz = (bz - az) / len;
    rows.push(await one(`recipe ${house}`, pand, preview, path.join(REPO_ROOT, 'artifacts/building-recipes', house, 'model.glb'), { mid: [(ax + bx) / 2, 0, (az + bz) / 2], normal: [-rz, rx], lenM: len }));
    rows.push({ ...rows[rows.length - 1], label: `generic path ${house}`, preview: generic, vsRenderTs: null, vsPhoto: (generic.measure as any).verdict ?? null, renderTsVsPhoto: null });
  }
} finally { await closeRenderer(); }

const brief = (v: PreviewVerdict | null) => v ? { verdict: v.verdict, dL: v.wall.dL, dHue: v.wall.dHue, glazing: [v.glazing.a, v.glazing.b], columns: [v.columns.a, v.columns.b], window: [v.window.a, v.window.b], reasons: v.reasons, warns: v.warns } : null;
const table = rows.map(r => ({ label: r.label, pand: r.pand, previewMs: r.preview.timings, renderTsMs: Math.round(r.renderTs.ms), sheet: path.relative(REPO_ROOT, path.join(out, `${r.pand}-sheet.png`)), previewVsRenderTs: brief(r.vsRenderTs), previewVsPhoto: brief(r.vsPhoto), renderTsVsPhoto: brief(r.renderTsVsPhoto) }));
fs.writeFileSync(path.join(out, 'gate.json'), JSON.stringify({ blurPx: BLUR, shader: process.argv.includes('--unlit') ? 'unlit' : 'lit', rows: table }, null, 1));
for (const r of table) console.log(`${r.label}: preview vs render.ts ${r.previewVsRenderTs?.verdict} (dL ${r.previewVsRenderTs?.dL}, hue ${r.previewVsRenderTs?.dHue}, glazing ${r.previewVsRenderTs?.glazing}, cols ${r.previewVsRenderTs?.columns}, window ${r.previewVsRenderTs?.window}) | preview vs photo ${r.previewVsPhoto?.verdict ?? '-'} | render.ts vs photo ${r.renderTsVsPhoto?.verdict ?? '-'}`);
console.log(path.join(out, 'gate.json'));
