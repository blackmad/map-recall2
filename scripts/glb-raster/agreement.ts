/**
 * Lane H12's agreement gate (docs/house-line.md §8): the same 25 GLBs drawn by the Node rasteriser
 * (src/canalRecall/glbRaster) and by headless Chromium (render.ts renderModelsBrowser, SwiftShader), the front elevation
 * measured on both (measureFacade after the shared PRE_BLUR_PX, likeness tolerances through previewVerdict with the
 * Chromium frame as the reference), and the pairs side by side on one sheet.
 *
 *   PW_PORT=4410 /tmp/canal-pw.sh node --import tsx scripts/glb-raster/agreement.ts [--out=artifacts/glb-raster/agreement] [--only=<id>,...] [--node-only | --browser-only]
 *
 * Recipe houses must be compiled first (scripts/building-recipes/compile.ts --house=<id>); a missing GLB is skipped and
 * listed. The Haarlemmerdijk chunk is read from the belt branch into artifacts/h12/ when it is not on main.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderModelsBrowser, closeRenderer, rdToRecipeLocal, type RenderView } from '../building-recipes/render.ts';
import { renderModelsNode, glbFile } from '../../src/canalRecall/glbRaster/render.ts';
import { boxOf, orientWall, resolveView, type Box } from '../../src/canalRecall/glbRaster/views.ts';
import { measureFacade, type FacadeImage, type FacadeMeasurement } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { previewVerdict, blurRgb, storeyLines, PRE_BLUR_PX } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { rgbToHsl } from '../../src/canalRecall/blockFace/wallColour.ts';

export const HELP = `node --import tsx scripts/glb-raster/agreement.ts [flags]

Renders the lane H12 agreement set (10 canal houses incl. the Nassaukade 506 block and Haarlemmerdijk 2-58, 5 block-face
chunks, 5 large recipes incl. Houthavenkade 26, 5 landmarks incl. glass/leaves) in Node and in Chromium, measures each
front elevation (measureFacade, ${PRE_BLUR_PX} px blur) and judges Node against Chromium (previewVerdict, reference
'render'). Chromium: run under /tmp/canal-pw.sh with your PW_PORT.

  --out=<dir>       output directory (default artifacts/glb-raster/agreement): agreement.json, sheet-*.png, per-id PNGs
  --only=<id,...>   these set ids only
  --ss=<n>          Node supersampling (default: the renderer's)
  --reuse-browser=<dir>  measure against the Chromium PNGs of an earlier run in <dir> (no browser)
  --node-only       time the Node side only (no Chromium)
  --browser-only    time the Chromium side only (today's path, the before numbers)
  --help            this text`;

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const MODELS = 'public/canal-drive/models', CHUNKS = `${MODELS}/ordinary-buildings/chunks`, LARGE = `${MODELS}/ordinary-buildings`;

type Entry = { id: string; group: 'canal' | 'face' | 'large' | 'landmark'; file: string; note?: string; wall?: (box: Box) => { a: [number, number]; b: [number, number]; eaves?: number } };
const recipe = (id: string): Entry => ({
  id, group: 'canal', file: `artifacts/building-recipes/${id}/model.glb`,
  wall: () => {
    const facts = readJson(`scripts/building-recipes/houses/${id}/facts.json`), report = readJson(`artifacts/building-recipes/${id}/report.json`), ff = facts.fronts[0];
    const [pa, pb] = ff.endpointsRD.map((p: number[]) => rdToRecipeLocal(p, report.anchorRD));
    const eaves = Math.max(...(report.fit?.fronts ?? []).map((f: { eavesM?: number; crownBaseM?: number }) => f.eavesM ?? f.crownBaseM ?? 0), 0) || undefined;
    return { ...orientWall([pa[0], pa[2]], [pb[0], pb[2]], [ff.outwardNormalRD[0], -ff.outwardNormalRD[1]]), eaves };
  },
});
/** Block-face chunks are in the strip frame: x along the strip's u, z out of the face. */
const chunk = (id: string, group: Entry['group'] = 'face', file = `${CHUNKS}/chunk-face-${id}.glb`, note?: string): Entry => ({ id, group, file, note, wall: box => ({ a: [box.min[0], 0], b: [box.max[0], 0] }) });
/** Large recipes and landmarks: the box's south face. */
const south = (id: string, group: Entry['group'], file: string, note?: string): Entry => ({ id, group, file, note, wall: box => ({ a: [box.min[0], box.max[2]], b: [box.max[0], box.max[2]] }) });

export const SET: Entry[] = [
  ...['cw-heren-175702', 'cw-keizers-171052', 'cw-heren-176601', 'cw-prinsen-167765', 'bloemgracht-78', 'bloemgracht-80', 'keizersgracht-569-575', 'cw-keizers-176393'].map(recipe),
  chunk('nassau-145-152', 'canal', undefined, 'Nassaukade 145-152, the Nassaukade 506 bar'),
  chunk('haarlemmerdijk-2-58-r1', 'canal', 'artifacts/h12/chunk-face-haarlemmerdijk-2-58-r1.glb', 'Haarlemmerdijk 2-58 r1 (lane/belt-haarlemmer-20261110), holds Haarlemmerdijk 6'),
  ...['bloemgracht-138-300-r1', 'clercq-236681', 'bilder-080336-090492', 'callenburg-3-63', 'bree-107-149-r1'].map(id => chunk(id)),
  ...['houthavenkade-26-247232', 'da-costakade-146-236799', 'entrepotdok-164981', 'barlaeus', 'haarlemmerweg-63-081533'].map(id => south(id, 'large', `${LARGE}/recipe-large-${id}.glb`)),
  south('westerkerk', 'landmark', `${MODELS}/westerkerk.glb`), south('rijksmuseum', 'landmark', `${MODELS}/rijksmuseum.glb`),
  south('conservatorium', 'landmark', `${MODELS}/conservatorium.glb`, 'glass (alpha BLEND)'), south('lensbomen', 'landmark', `${MODELS}/lensbomen.glb`, 'trees (alpha BLEND)'),
  south('afrikahuis', 'landmark', `${MODELS}/afrikahuis.glb`),
];

const BLUR = PRE_BLUR_PX, MAX_PX = 1800;
const measure = (image: FacadeImage, box: { u0: number; u1: number; v0: number; v1: number }, lines: number[]) =>
  measureFacade({ image: { ...image, rgb: blurRgb(image.rgb, image.width, image.height, BLUR) }, box, lines });
async function rgbOf(png: Buffer, ppm: number, topM: number): Promise<FacadeImage> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgb: new Uint8Array(data), ppm, topM };
}
const hueOf = (m: FacadeMeasurement) => rgbToHsl(m.wall.normalised);
/**
 * Stability controls (the decisive one is the quarter-pixel camera nudge each renderer makes against itself, see main;
 * these two are the fallback when only saved Chromium frames are available): the Chromium frame itself, perturbed below anything a renderer difference could explain, measured
 * against the unperturbed frame. `dither` adds a deterministic +-1 to every channel; `shift` moves the image 1 px right
 * (0.02 m at 50 px/m). A control that does not PASS means measureFacade's decision is on a knife edge for this front,
 * so a Node-vs-Chromium disagreement there is the measurement's, not the renderer's.
 */
export function perturb(img: FacadeImage, kind: 'dither' | 'shift'): FacadeImage {
  const rgb = new Uint8Array(img.rgb.length);
  if (kind === 'dither') for (let i = 0; i < rgb.length; i++) { const h = Math.imul(i + 1, 2654435761) >>> 29; rgb[i] = Math.max(0, Math.min(255, img.rgb[i] + (h & 1 ? 1 : -1) * (h > 3 ? 1 : 0))); }
  else for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) for (let c = 0; c < 3; c++) rgb[(y * img.width + x) * 3 + c] = img.rgb[(y * img.width + Math.max(0, x - 1)) * 3 + c];
  return { ...img, rgb };
}
/** Mean |RGB difference| (0..255) and the share of pixels differing by more than 16. */
function pixelDiff(a: FacadeImage, b: FacadeImage) {
  let sum = 0, big = 0; const n = a.width * a.height;
  for (let i = 0; i < n; i++) { let e = 0; for (let c = 0; c < 3; c++) e += Math.abs(a.rgb[i * 3 + c] - b.rgb[i * 3 + c]); e /= 3; sum += e; if (e > 16) big++; }
  return { mean: +(sum / n).toFixed(2), over16: +(big / n).toFixed(4) };
}

async function main() {
  if (process.argv.includes('--help')) { console.log(HELP); return; }
  const out = path.resolve(arg('out') ?? 'artifacts/glb-raster/agreement');
  // --reuse-browser=<dir>: measure against the Chromium frames of an earlier run (no browser).
  const reuse = arg('reuse-browser');
  fs.mkdirSync(out, { recursive: true });
  const only = arg('only')?.split(','), nodeOnly = process.argv.includes('--node-only'), browserOnly = process.argv.includes('--browser-only');
  const rows: Record<string, unknown>[] = [], skipped: string[] = [], tiles: { id: string; b: Buffer | null; n: Buffer | null; ob: Buffer | null; on: Buffer | null; label: string }[] = [];
  const timing = { node: 0, browser: 0, browserFirst: 0 };
  for (const e of SET) {
    if (only && !only.includes(e.id)) continue;
    if (!fs.existsSync(e.file)) { skipped.push(`${e.id}: ${e.file} missing`); continue; }
    const glb = await glbFile(e.file), box = boxOf(glb.primitives.map(p => p.positions));
    const w = e.wall!(box), len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), top = box.max[1] + 0.5;
    const ppm = Math.min(50, MAX_PX / Math.max(len + 2, top));
    const front = resolveView({ kind: 'front', a: w.a, b: w.b, ppm, v0: 0, v1: top, pad: 1 }, box);
    const orbit = resolveView({ kind: 'orbit', theta: Math.atan2(...((): [number, number] => { const rx = w.b[0] - w.a[0], rz = w.b[1] - w.a[1]; return [-rz, rx]; })()) + 0.55, phi: 1.02 }, box, { width: 600, height: 400 });
    // The renderer-noise control: the same front with the camera moved a quarter pixel along the wall.
    const rl = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, q = 0.25 / ppm, rx = (w.b[0] - w.a[0]) / rl * q, rz = (w.b[1] - w.a[1]) / rl * q;
    const nudged = { ...front, eye: [front.eye[0] + rx, front.eye[1], front.eye[2] + rz], target: [front.target[0] + rx, front.target[1], front.target[2] + rz] };
    const views: RenderView[] = [{ ...front, background: '#9fb8cf', noGround: true } as RenderView, orbit as RenderView, { ...nudged, background: '#9fb8cf', noGround: true } as RenderView];
    let nodePng: Buffer[] | null = null, browserPng: Buffer[] | null = null, nodeMs = 0, browserMs = 0;
    if (!browserOnly) { const t = performance.now(); nodePng = await renderModelsNode([{ file: e.file }], views as never, arg('ss') ? { supersample: Number(arg('ss')) } : {}); nodeMs = performance.now() - t; timing.node += nodeMs; }
    if (reuse) browserPng = [fs.readFileSync(path.join(reuse, `${e.id}-browser-front.png`)), fs.readFileSync(path.join(reuse, `${e.id}-browser-orbit.png`)), ...(fs.existsSync(path.join(reuse, `${e.id}-browser-nudged.png`)) ? [fs.readFileSync(path.join(reuse, `${e.id}-browser-nudged.png`))] : [])];
    else if (!nodeOnly) { const t = performance.now(); browserPng = await renderModelsBrowser([{ file: e.file }], views); browserMs = performance.now() - t; timing.browser += browserMs; if (!timing.browserFirst) timing.browserFirst = browserMs; }
    if (nodePng) { fs.writeFileSync(path.join(out, `${e.id}-node-front.png`), nodePng[0]); fs.writeFileSync(path.join(out, `${e.id}-node-orbit.png`), nodePng[1]); fs.writeFileSync(path.join(out, `${e.id}-node-nudged.png`), nodePng[2]); }
    if (browserPng) { fs.writeFileSync(path.join(out, `${e.id}-browser-front.png`), browserPng[0]); fs.writeFileSync(path.join(out, `${e.id}-browser-orbit.png`), browserPng[1]); if (browserPng[2]) fs.writeFileSync(path.join(out, `${e.id}-browser-nudged.png`), browserPng[2]); }
    const row: Record<string, unknown> = { id: e.id, group: e.group, note: e.note, file: e.file, ppm: +ppm.toFixed(2), size: [front.width, front.height], nodeMs: Math.round(nodeMs), browserMs: Math.round(browserMs) };
    let label = `${e.id} (${e.group})`;
    if (nodePng && browserPng) {
      // The pad is 1 m each side: the wall runs from u = 1 to 1 + len in the image.
      const eaves = Math.min(top - 0.5, w.eaves ?? (e.group === 'landmark' || e.group === 'large' ? top * 0.85 : top - 0.5));
      const mbox = { u0: 1.2, u1: 1 + len - 0.2, v0: 0, v1: eaves }, lines = storeyLines(eaves);
      const topM = front.ortho![2] + (front.target[1]);
      const ib = await rgbOf(browserPng[0], ppm, topM), inode = await rgbOf(nodePng[0], ppm, topM);
      const mb = measure(ib, mbox, lines), mn = measure(inode, mbox, lines);
      const v = previewVerdict(mn, mb, 'render');
      const controls = { dither: previewVerdict(measure(perturb(ib, 'dither'), mbox, lines), mb, 'render'), shift: previewVerdict(measure(perturb(ib, 'shift'), mbox, lines), mb, 'render') };
      // Renderer noise: each renderer against itself a quarter pixel over. Stable = Chromium agrees with itself.
      const nb = browserPng[2] ? previewVerdict(measure(await rgbOf(browserPng[2], ppm, topM), mbox, lines), mb, 'render') : null;
      const nn = previewVerdict(measure(await rgbOf(nodePng[2], ppm, topM), mbox, lines), mn, 'render');
      // Node against Chromium's own quarter-pixel spread: PASS against either Chromium frame is inside its noise.
      const vsNudged = browserPng[2] ? previewVerdict(mn, measure(await rgbOf(browserPng[2], ppm, topM), mbox, lines), 'render') : null;
      // The two renderers' quarter-pixel envelopes overlap: some pair of {Node, Node nudged} x {Chromium, Chromium nudged} PASSes.
      const mnn = measure(await rgbOf(nodePng[2], ppm, topM), mbox, lines);
      const pairs = [v, vsNudged, previewVerdict(mnn, mb, 'render'), browserPng[2] ? previewVerdict(mnn, measure(await rgbOf(browserPng[2], ppm, topM), mbox, lines), 'render') : null].filter(Boolean) as typeof v[];
      row.envelopePairsPass = pairs.filter(p => p.verdict === 'PASS').length;
      row.withinChromiumNoise = pairs.some(p => p.verdict === 'PASS');
      row.vsChromiumNudged = vsNudged ? { verdict: vsNudged.verdict, reasons: vsNudged.reasons } : null;
      const stable = nb ? nb.verdict === 'PASS' : controls.dither.verdict === 'PASS' && controls.shift.verdict === 'PASS';
      row.pixels = pixelDiff(ib, inode);
      row.control = { stable, chromiumQuarterPx: nb?.verdict ?? null, chromiumQuarterPxReasons: nb?.reasons ?? null, nodeQuarterPx: nn.verdict, nodeQuarterPxReasons: nn.reasons, dither: controls.dither.verdict, ditherReasons: controls.dither.reasons, shift: controls.shift.verdict, shiftReasons: controls.shift.reasons };
      const hb = hueOf(mb), hn = hueOf(mn);
      let dHue = hn[0] - hb[0]; if (dHue > 180) dHue -= 360; if (dHue < -180) dHue += 360;
      const nodeVsPhotoless = { verdict: v.verdict, reasons: v.reasons, warns: v.warns };
      Object.assign(row, {
        verdict: v.verdict, reasons: v.reasons,
        wall: { browser: mb.wall.hex, node: mn.wall.hex, dL: +(hn[2] - hb[2]).toFixed(3), dHue: Math.min(hb[1], hn[1]) > 0.08 ? +dHue.toFixed(1) : null },
        glazing: { browser: mb.glazing, node: mn.glazing, diff: +(mn.glazing - mb.glazing).toFixed(3) },
        columns: { browser: mb.windowColumns ?? mb.columns, node: mn.windowColumns ?? mn.columns, equal: (mb.windowColumns ?? mb.columns) === (mn.windowColumns ?? mn.columns) },
        window: { browser: mb.window?.shape ?? null, node: mn.window?.shape ?? null }, classes: { browser: mb.frontClass, node: mn.frontClass },
        storeys: v.storeys, nodeVsBrowser: nodeVsPhotoless,
      });
      label = `${e.id}: ${v.verdict} dL ${(row.wall as { dL: number }).dL} cols ${(row.columns as { browser: unknown }).browser}/${(row.columns as { node: unknown }).node}`;
    }
    rows.push(row);
    tiles.push({ id: e.id, b: browserPng?.[0] ?? null, n: nodePng?.[0] ?? null, ob: browserPng?.[1] ?? null, on: nodePng?.[1] ?? null, label });
    console.log(`${e.id}: node ${Math.round(nodeMs)} ms, browser ${Math.round(browserMs)} ms${row.verdict ? `, ${row.verdict} [control chromium-1/4px ${(row.control as { chromiumQuarterPx: string }).chromiumQuarterPx} node-1/4px ${(row.control as { nodeQuarterPx: string }).nodeQuarterPx} dither ${(row.control as { dither: string }).dither} shift ${(row.control as { shift: string }).shift}, pixels ${JSON.stringify(row.pixels)}] (dL ${(row.wall as { dL: number }).dL}, hue ${(row.wall as { dHue: number | null }).dHue}, glazing ${(row.glazing as { diff: number }).diff}, cols ${JSON.stringify(row.columns)})` : ''}`);
  }
  await closeRenderer();
  const measured = rows.filter(r => r.verdict);
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const summary = {
    n: rows.length, measured: measured.length,
    pass: measured.filter(r => r.verdict === 'PASS').length,
    /** Fronts whose Chromium frame passes both stability controls, and how many of those Node agrees on. */
    stable: measured.filter(r => (r.control as { stable: boolean }).stable).length,
    stablePass: measured.filter(r => (r.control as { stable: boolean }).stable && r.verdict === 'PASS').length,
    unstableFails: measured.filter(r => !(r.control as { stable: boolean }).stable && r.verdict !== 'PASS').map(r => r.id),
    stableFails: measured.filter(r => (r.control as { stable: boolean }).stable && r.verdict !== 'PASS').map(r => r.id),
    withinChromiumNoise: measured.filter(r => r.withinChromiumNoise).length,
    outsideChromiumNoise: measured.filter(r => !r.withinChromiumNoise).map(r => r.id),
    medianPixelDiff: med(measured.map(r => (r.pixels as { mean: number }).mean)),
    medianAbsDL: med(measured.map(r => Math.abs((r.wall as { dL: number }).dL))),
    medianAbsHue: med(measured.map(r => (r.wall as { dHue: number | null }).dHue).filter((x): x is number => x !== null).map(Math.abs)),
    columnsEqual: measured.filter(r => (r.columns as { equal: boolean }).equal).length,
    timingMs: { node: Math.round(timing.node), browser: Math.round(timing.browser), browserFirstIncludingLaunch: Math.round(timing.browserFirst) },
    skipped,
  };
  fs.writeFileSync(path.join(out, 'agreement.json'), JSON.stringify({ blurPx: BLUR, summary, rows }, null, 1));
  console.log(JSON.stringify(summary));
  // Sheet: per id one row, Chromium front | Node front | Chromium orbit | Node orbit, 220 px tall.
  if (tiles.length) {
    const H = 220, gap = 6, head = 22, cells: { input: Buffer; left: number; top: number }[] = [];
    let y = 0, width = 0;
    for (const t of tiles) {
      let x = 0;
      cells.push({ input: Buffer.from(`<svg width="1400" height="${head}"><text x="4" y="16" font-family="Helvetica, Arial" font-size="14" fill="#1f2328">${t.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')} · Chromium | Node | Chromium | Node</text></svg>`), left: 0, top: y });
      for (const img of [t.b, t.n, t.ob, t.on]) {
        if (!img) continue;
        const r = await sharp(img).resize({ height: H, width: 420, fit: 'inside' }).png().toBuffer(), meta = await sharp(r).metadata();
        cells.push({ input: r, left: x, top: y + head }); x += meta.width! + gap;
      }
      width = Math.max(width, x); y += head + H + gap;
    }
    const perSheet = 9, sheetRows = Math.ceil(tiles.length / perSheet);
    for (let s = 0; s < sheetRows; s++) {
      const y0 = s * perSheet * (head + H + gap), y1 = Math.min(y, (s + 1) * perSheet * (head + H + gap));
      const mine = cells.filter(c => c.top >= y0 && c.top < y1).map(c => ({ ...c, top: c.top - y0 }));
      const file = path.join(out, `sheet-${s + 1}.png`);
      await sharp({ create: { width: Math.max(width, 1400), height: y1 - y0, channels: 3, background: '#f4f4f2' } }).composite(mine).png().toFile(file);
      console.log(file);
    }
  }
}
if (process.argv[1]?.endsWith("glb-raster/agreement.ts")) await main();
