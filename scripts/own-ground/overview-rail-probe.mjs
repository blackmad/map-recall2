// Overview rail lines on screen (lane R3-C #232): the engine overview at the Zuidas corridor below the ground's zoom
// (the city-scale view the start flight and a zoomed-out map show; the own ground is not drawn there), per variant,
// on iPhone 13 or desktop. The camera is held (crisp-textures.spec.ts: sync and aim held, jumpToLngLat), the frame
// captured without the HUD with and without the overview's rail meshes, and every run of changed pixels down the
// columns is measured: its width in CSS px and the luma it takes off the ground beneath.
//   PORT=4647 node scripts/own-ground/overview-rail-probe.mjs <outdir> <iphone|desktop> 'main=@;after=@<bundlesDir>'
// Writes <outdir>/<device>-overview-<pose>-<variant>.png and <outdir>/<device>-overview.json.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [out = 'artifacts/overview-rail', device = 'iphone', variantArg = 'after=@'] = process.argv.slice(2);
const variants = variantArg.split(';').filter(Boolean).map(v => { const eq = v.indexOf('='), name = eq < 0 ? v : v.slice(0, eq), rest = eq < 0 ? '' : v.slice(eq + 1); const at = (rest ?? '').lastIndexOf('@'); return { name, query: at >= 0 ? rest.slice(0, at) : rest, bundles: at >= 0 ? rest.slice(at + 1) : '' }; });
// The corridor runs E-W here (Zuid to RAI): columns cross it north-south. Top-down so the column is the cross-section.
const POSES = [
  { name: 'z13.5', center: [4.8800, 52.3390], zoom: 13.5, bearing: 0, pitch: 0 },
  { name: 'z14.5', center: [4.8800, 52.3390], zoom: 14.5, bearing: 0, pitch: 0 },
  { name: 'z14.5-pitched', center: [4.8800, 52.3360], zoom: 14.5, bearing: 0, pitch: 60 },
];
const ctxOpts = device === 'iphone' ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1288, height: 715 }, deviceScaleFactor: 2 };
fs.mkdirSync(out, { recursive: true });
const results = {};
const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/**
 * The rail lines' pixels are those that change when the overview's rail meshes are hidden (renderOrder 29/30, the
 * halo and core or the old single line; streets are 10-26). Down columns, each run of changed pixels is one line's
 * cross-section (see measure): its width in CSS px, and its contrast, the luma it takes off what lies under it.
 */
async function measure(withPng, withoutPng, cssWidth) {
  const a = await sharp(withPng).removeAlpha().raw().toBuffer({ resolveWithObject: true }), b = await sharp(withoutPng).removeAlpha().raw().toBuffer();
  const { width: w, height: h, channels: c } = a.info, A = a.data, runs = [];
  // The frame's pixels per CSS px: the engine's drawing buffer, not devicePixelRatio (iPhone draws ~1.25x, not 3x).
  const dpr = w / cssWidth;
  // A run: changed pixels (|d luma| > 6) down a column, one-device-pixel gaps bridged; it counts as a line only when it
  // darkens what lies under it by PEAK luma somewhere (single dithered edge pixels do not).
  const PEAK = 30, diff = (x, k) => luma(b, (k * w + x) * c) - luma(A, (k * w + x) * c);
  for (let x = 0; x < w; x += Math.max(1, Math.round(w / 120))) {
    for (let y = 0; y < h;) {
      if (Math.abs(diff(x, y)) <= 6) { y++; continue; }
      let e = y, best = 0;
      while (e < h && (Math.abs(diff(x, e)) > 6 || (e + 1 < h && Math.abs(diff(x, e + 1)) > 6))) { best = Math.max(best, diff(x, e)); e++; }
      if (best >= PEAK) runs.push({ px: (e - y) / dpr, contrast: best });
      y = e;
    }
  }
  const s = arr => { const v = [...arr].sort((p, q) => p - q); return v.length ? { n: v.length, p10: +v[Math.floor(v.length * 0.1)].toFixed(2), p50: +v[v.length >> 1].toFixed(2), p90: +v[Math.floor(v.length * 0.9)].toFixed(2), under125: +(v.filter(x => x < 1.25).length / v.length).toFixed(3) } : null; };
  return { pxPerCss: +dpr.toFixed(3), widthCssPx: s(runs.map(r => r.px)), contrastLuma: s(runs.map(r => r.contrast)) };
}

const capture = page => page.evaluate(() => window.canalRecallGame.vectorMap.captureFrame().then(c => c?.toDataURL('image/png') ?? '')).then(u => Buffer.from(u.split(',')[1], 'base64'));
// PROBE_KIND=rail (or tram, subway, ...): only that kind's lines are hidden, so the runs are that kind's alone
// (lane variants; the old single-line build has no kinds and hides every rail line).
const KIND = process.env.PROBE_KIND ?? '';
const setRails = (page, on) => page.evaluate(({ on, kind }) => {
  const ov = window.canalRecallGame.vectorMap._overview, only = kind && ov.railLines?.length ? new Set(ov.railLines.filter(r => r.kind === kind).map(r => r.mesh)) : null;
  for (const m of ov.root.children) if ((m.renderOrder === 29 || m.renderOrder === 30) && (!only || only.has(m))) { if (on) m.layers.enableAll(); else m.layers.disableAll(); }
  window.canalRecallGame.vectorMap.host?.triggerRepaint?.();
}, { on, kind: KIND });

// REMEASURE=<css width>: measure the frames already in <outdir> again (no browser), e.g. REMEASURE=390 for iPhone 13.
if (process.env.REMEASURE) {
  for (const f of fs.readdirSync(out).filter(f => f.startsWith(`${device}-overview-`) && f.endsWith('.png') && !f.includes('-bare'))) {
    const stem = f.slice(0, -4), bare = `${out}/${stem}-bare${KIND ? `-${KIND}` : ''}.png`;
    if (!fs.existsSync(bare)) continue;
    results[stem.slice(`${device}-overview-`.length)] = await measure(`${out}/${f}`, bare, Number(process.env.REMEASURE));
    console.log(stem, JSON.stringify(results[stem.slice(`${device}-overview-`.length)]));
  }
  fs.writeFileSync(`${out}/${device}-overview${KIND ? `-${KIND}` : ''}-remeasured.json`, JSON.stringify(results, null, 1));
  process.exit(0);
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const v of variants) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__canalRecallEngine = 'own'; let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  if (v.bundles) await ctx.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(v.bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
  await page.goto(`http://127.0.0.1:${process.env.PORT || 4647}/canal-drive/?${['governor=0', v.query].filter(Boolean).join('&')}`);
  await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 120000 });
  await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => window.canalRecallGame.player?.x && window.canalRecallGame.camera.introOverview === 0 && window.canalRecallGame.vectorMap?._overview, null, { timeout: 180000 });
  const cssWidth = await page.evaluate(() => window.innerWidth);
  for (const pose of POSES) {
    await page.evaluate(pose => {
      const vm = window.canalRecallGame.vectorMap;
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      vm.jumpToLngLat({ center: pose.center, zoom: pose.zoom, bearing: pose.bearing, pitch: pose.pitch, elevation: 0 });
      vm.host?.triggerRepaint?.();
    }, pose);
    await page.waitForTimeout(4000);
    const png = await capture(page);
    await setRails(page, false); await page.waitForTimeout(600);
    const bare = await capture(page);
    await setRails(page, true);
    fs.writeFileSync(`${out}/${device}-overview-${pose.name}-${v.name}.png`, png);
    fs.writeFileSync(`${out}/${device}-overview-${pose.name}-${v.name}-bare${KIND ? `-${KIND}` : ''}.png`, bare);
    results[`${pose.name}:${v.name}`] = { cssWidth, ...(await measure(png, bare, cssWidth)) };
    console.log(device, pose.name, v.name, JSON.stringify(results[`${pose.name}:${v.name}`]));
  }
  await ctx.close();
}
fs.writeFileSync(`${out}/${device}-overview${KIND ? `-${KIND}` : ''}.json`, JSON.stringify(results, null, 1));
await browser.close();
