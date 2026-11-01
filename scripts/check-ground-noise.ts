/**
 * Pins ownGround/groundNoise.ts `paintNoise` (one ImageData) to the fillRect-per-block painter it replaced: paints
 * both with the same generator for every ground grain texture's parameters plus edge cases (tones near 0 and 255,
 * odd grains, fractional bases), in headless Chrome (and WebKit when installed), and compares every pixel and the
 * generator's state afterwards. Exits 1 on any difference. Run under the browser lock:
 *   /tmp/canal-pw.sh node --import tsx scripts/check-ground-noise.ts
 */
import { chromium, webkit, type BrowserType } from 'playwright';
import * as esbuild from 'esbuild';

const bundle = (await esbuild.build({ entryPoints: ['src/canalRecall/ownGround/groundNoise.ts'], bundle: true, write: false, format: 'iife', globalName: 'GroundNoise', logLevel: 'silent' })).outputFiles[0].text;
// [size, base, spread, grain]: the textures in gameGround.ts makeMaterials (tones vary by look, so a spread of
// tones), then the clamps and odd sizes.
const cases: Array<[number, number[], number, number]> = [
  [256, [150, 140, 120], 30, 2], [256, [96, 128, 70], 30, 3], [256, [120, 96, 70], 34, 3], [256, [110, 150, 80], 18, 2],
  [256, [90, 70, 50], 24, 2], [256, [70, 100, 60], 22, 3], [256, [80, 60, 45], 40, 3], [256, [214, 200, 170], 22, 2],
  [256, [180, 170, 150], 34, 2], [256, [170, 160, 140], 16, 2], [256, [128.5, 64.25, 200.75], 30, 2],
  [256, [3, 250, 128], 40, 3], [100, [10, 245, 0.5], 60, 7], [64, [255, 0, 127.5], 255, 5],
];
/** Runs in the page: both painters per case, every pixel compared. */
const PAGE_CHECK = `function (cases) {
  var N = window.GroundNoise;
  return cases.map(function (c, i) {
    var s = c[0], base = c[1], spread = c[2], grain = c[3];
    function paint(fn) {
      var seed = 99 + i;
      var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      var canvas = document.createElement('canvas'); canvas.width = canvas.height = s;
      var g = canvas.getContext('2d'); var t0 = performance.now(); fn(g, s, base, spread, grain, rnd); var ms = performance.now() - t0;
      return { px: g.getImageData(0, 0, s, s).data, seed: seed, ms: ms };
    }
    var a = paint(N.paintNoiseReference), b = paint(N.paintNoise), differ = 0, maxDelta = 0;
    for (var k = 0; k < a.px.length; k++) { var d = Math.abs(a.px[k] - b.px[k]); if (d) { differ++; if (d > maxDelta) maxDelta = d; } }
    return { s: s, grain: grain, spread: spread, differ: differ, maxDelta: maxDelta, sameGenerator: a.seed === b.seed, referenceMs: a.ms, imageDataMs: b.ms };
  });
}`;
let failed = false;
for (const [name, type] of [['chromium', chromium], ['webkit', webkit]] as Array<[string, BrowserType]>) {
  let browser;
  try { browser = await type.launch(name === 'chromium' ? { executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}); }
  catch { console.log(`${name}: not installed, skipped`); continue; }
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: bundle });
    // A string, not a function: tsx's emitted helpers (__name) do not exist in the page.
    const rows: Array<{ s: number; grain: number; spread: number; differ: number; maxDelta: number; sameGenerator: boolean; referenceMs: number; imageDataMs: number }> = await page.evaluate(`(${PAGE_CHECK})(${JSON.stringify(cases)})`);
    const bad = rows.filter(r => r.differ || !r.sameGenerator);
    const ms = (k: 'referenceMs' | 'imageDataMs') => rows.reduce((t, r) => t + r[k], 0).toFixed(1);
    console.log(`${name}: ${rows.length} textures (fillRect ${ms('referenceMs')} ms, ImageData ${ms('imageDataMs')} ms), ${bad.length ? `${bad.length} DIFFER ${JSON.stringify(bad)}` : 'every pixel identical, generator in step'}`);
    if (bad.length) failed = true;
  } finally { await browser.close(); }
}
if (failed) process.exitCode = 1;
