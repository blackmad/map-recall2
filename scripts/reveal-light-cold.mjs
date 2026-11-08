// Reveal frame series (issue #267): every rendered world frame from the last covered frame through the first 500 ms
// after the loading screen lifts (state 4), at the display's rate (60 Hz on the Mac), with the per-frame pixel change
// (128 px wide, a pixel counts when any channel moves > 40/255) and the light state the frame was drawn with: shadow
// map redraws, the sun's shadow intensity, whether the map exists, tone exposure, fog, camera, ground cells.
//   PORT=4695 node scripts/reveal-light-cold.mjs <out.json> [--device desktop|iphone] [--runs 5] [--qs '?engine=own&ride=free']
//     [--chrome] [--headed] [--throttle 4] [--window 500]
// STILLS_DIR=<dir>: 384 px PNGs of the reveal frame, the +250 ms frame and every frame changing > 2 %.
// Built from scripts/start-settle-cold.mjs (R5-B2, #261); same browser setup (cold context per run).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/r267/reveal.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const runs = Number(opt('runs', '5'));
const qs = opt('qs', '?engine=own&ride=free');
const throttle = Number(opt('throttle', device === 'iphone' ? '4' : '1'));
const windowMs = Number(opt('window', '500'));
const headed = argv.includes('--headed');
const useChrome = argv.includes('--chrome');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4695}`;
const pagePath = process.env.PAGE || '/canal-drive/';

const browser = await chromium.launch({
  headless: !headed,
  args: ['--enable-precise-memory-info', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});

async function run() {
  const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
  const context = await browser.newContext(device === 'iphone'
    ? { ...devices['iPhone 13'] }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
  if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.addInitScript(([windowMs, stills]) => {
    const R = window.__reveal = { frames: [], keep: [], covered: null };
    const W = 128, c = document.createElement('canvas');
    let prev = null, raceAt = null, prevUrl = null, hooked = false;
    const still = src => { const big = document.createElement('canvas'); big.width = 384; big.height = Math.round(384 * src.height / src.width); big.getContext('2d').drawImage(src, 0, 0, big.width, big.height); return big.toDataURL('image/png'); };
    const lightState = vm => {
      const sf = vm._sharedFrame, rig = sf?.rig, r = sf?.renderer, sh = rig?.sun?.shadow;
      const fog = sf?.scene?.fog;
      let cam = null; try { const p = vm.startSettleProbe?.(); cam = p ? [+p.lng.toFixed(7), +p.lat.toFixed(7), +p.zoom.toFixed(3), +p.pitch.toFixed(2), +p.bearing.toFixed(2)] : null; } catch (_) { /* */ }
      return {
        redraws: sf?.shadowRedraws ?? null, intensity: sh ? +sh.intensity.toFixed(3) : null, hasMap: !!sh?.map,
        mapSize: sh?.mapSize ? sh.mapSize.x : null, every: sf?.shadowEvery ?? null, key: sf?.shadowKey ? sf.shadowKey.split('|')[0] : '',
        sunI: rig?.sun ? +rig.sun.intensity.toFixed(3) : null, exposure: r ? r.toneMappingExposure : null, tone: r ? r.toneMapping : null,
        fog: fog ? [fog.near != null ? Math.round(fog.near) : null, fog.far != null ? Math.round(fog.far) : null, fog.color?.getHexString?.()] : null,
        coverPaused: sf?.coverPaused ?? null, coverSkipped: sf?.coverSkipped ?? null, calls: sf?.stats?.main?.calls ?? null, tris: sf?.stats?.main?.triangles ?? null,
        groundCells: vm._ownGround?.cells?.size ?? vm._ownGround?.cellCount ?? null, cam,
        drawn: (sf?.lastDrawn?.main ?? []).length,
        // The camera's centre elevation (the rider's eased surface height, ownWorldView riderSurfaceM) and its target.
        elev: vm.cameraMap?.camera?.elevation != null ? +vm.cameraMap.camera.elevation.toFixed(3) : null, rs: vm.riderSurfaceM != null ? +vm.riderSurfaceM.toFixed(3) : null,
        // Dissolves running this frame, per tier (which of them is landing at the reveal).
        bFade: vm._threeBuildings?.fading?.size ?? null, bLeave: vm._threeBuildings?.leaving?.size ?? null,
        bakedFade: (() => { try { return vm._bakedCoarse?.stats?.().fading ?? null; } catch (_) { return null; } })(),
        farFade: (() => { try { let n = 0; for (const r of vm._farShells?.residents?.values?.() ?? []) if (r.fade) n++; return n; } catch (_) { return null; } })(),
        gFade: (() => { const g = vm._ownGround; const gg = g?.game ?? g?.ground ?? g?._game ?? g; return gg?.fading?.size ?? null; })(),
      };
    };
    const hook = () => {
      const g = window.canalRecallGame, vm = g?.vectorMap;
      if (hooked || !vm?.cameraMap || typeof vm.frameCanvas !== 'function') return;
      hooked = true;
      vm.cameraMap.on('render', () => {
        const gg = window.canalRecallGame; const now = performance.now();
        const src = vm.frameCanvas(); if (!src?.width) return;
        if (!gg || gg.state !== 4) {
          // The last covered frame (the world behind the loading screen): its pixels are the baseline for the reveal.
          if (gg && gg.state === 2) {
            const H = Math.max(1, Math.round(W * src.height / src.width)); c.width = W; c.height = H;
            const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, W, H);
            prev = cx.getImageData(0, 0, W, H).data; R.covered = { t: Math.round(now), ...lightState(vm) };
            if (stills) prevUrl = still(src);
          }
          return;
        }
        raceAt ??= now;
        if (now - raceAt > windowMs) return;
        const H = Math.max(1, Math.round(W * src.height / src.width)); c.width = W; c.height = H;
        const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, W, H);
        const d = cx.getImageData(0, 0, W, H).data;
        let changed = 0, lum = 0;
        for (let i = 0; i < d.length; i += 4) {
          lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          if (prev && (Math.abs(d[i] - prev[i]) > 40 || Math.abs(d[i + 1] - prev[i + 1]) > 40 || Math.abs(d[i + 2] - prev[i + 2]) > 40)) changed++;
        }
        const frac = prev ? changed / (W * H) : null;
        const idx = R.frames.length;
        R.frames.push({ t: Math.round(now), ms: Math.round(now - raceAt), frac: frac == null ? null : Math.round(frac * 10000) / 10000, lum: +(lum / (W * H)).toFixed(1), ...lightState(vm) });
        if (stills) {
          const url = still(src);
          if (idx === 0) { if (prevUrl) R.keep.push({ label: 'covered', ms: -1, url: prevUrl }); R.keep.push({ label: 'reveal', ms: 0, url }); }
          else if (frac > 0.02 && R.keep.length < 14) R.keep.push({ label: 'pop', ms: Math.round(now - raceAt), url });
          if (!R.kept250 && now - raceAt >= 250) { R.kept250 = true; R.keep.push({ label: 'plus250', ms: Math.round(now - raceAt), url }); }
        }
        prev = d;
      });
    };
    const iv = setInterval(() => { hook(); if (hooked) clearInterval(iv); }, 20);
  }, [windowMs, !!process.env.STILLS_DIR]);
  const t0 = Date.now();
  await page.goto(`${origin}${pagePath}${qs}`, { waitUntil: 'load' });
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 180_000, polling: 50 });
  const navToRace = await page.evaluate(() => Math.round(performance.now()));
  await page.waitForTimeout(windowMs + 700);
  const R = await page.evaluate(() => ({ frames: window.__reveal.frames, keep: window.__reveal.keep, covered: window.__reveal.covered }));
  await context.close();
  const fr = R.frames;
  const revealPop = fr.length ? fr[0].frac : null;
  const maxPop = fr.reduce((m, f) => Math.max(m, f.frac ?? 0), 0);
  const firstPop = fr.find((f, i) => i > 0 && f.frac > 0.02);
  return { navToRaceMs: navToRace, wallMs: Date.now() - t0, revealPop, maxPopInWindow: maxPop, firstPopMs: firstPop ? firstPop.ms : null, firstPopFrac: firstPop ? firstPop.frac : null,
    sumFracWindow: +fr.slice(1).reduce((s, f) => s + (f.frac ?? 0), 0).toFixed(4), frameCount: fr.length, covered: R.covered, frames: fr, keep: R.keep, errors: errors.slice(0, 3) };
}

const results = [];
for (let i = 0; i < runs; i++) {
  const r = await run();
  if (process.env.STILLS_DIR) {
    fs.mkdirSync(process.env.STILLS_DIR, { recursive: true });
    for (const k of r.keep) fs.writeFileSync(path.join(process.env.STILLS_DIR, `${device}-run${i + 1}-${k.label}-${k.ms}ms.png`), Buffer.from(k.url.split(',')[1], 'base64'));
  }
  r.keep = r.keep.map(k => ({ label: k.label, ms: k.ms }));
  results.push(r);
  console.log(`${device} run ${i + 1}: nav->racing ${r.navToRaceMs} ms; reveal-vs-covered ${r.revealPop}; first pop ${r.firstPopMs} ms ${r.firstPopFrac}; max ${r.maxPopInWindow}; frames ${r.frameCount}`);
  console.log('   ' + r.frames.slice(0, 16).map(f => `${f.ms}:${f.frac}/r${f.redraws}/i${f.intensity}/${f.hasMap ? 'M' : '-'}/z${f.cam?.[2]}/b${f.bFade},${f.bLeave}/k${f.bakedFade}/f${f.farFade}/g${f.gFade}/e${f.elev}`).join(' '));
}
await browser.close();
const med = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
const summary = {
  nav_to_racing_ms: med(results.map(r => r.navToRaceMs)),
  reveal_vs_covered_frac: med(results.map(r => r.revealPop)),
  first_pop_ms: med(results.map(r => r.firstPopMs)), first_pop_frac: med(results.map(r => r.firstPopFrac)),
  max_pop_in_window: med(results.map(r => r.maxPopInWindow)), runs_max_pop_under_3pct: results.filter(r => r.maxPopInWindow < 0.03).length,
  sum_frac_window: med(results.map(r => r.sumFracWindow)),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ qs, device, throttle, windowMs, summary, results }, null, 2));
console.log('summary', JSON.stringify(summary));
