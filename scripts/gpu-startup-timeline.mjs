import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
// Startup GPU timeline on a phone profile (CANAL-RECALL-7 / -J / -N, Firefox Android 2026-10-29).
// Every WebGL shader compile and program link on the page (MapLibre's and three.js's), textures and
// buffers created, and the shared frame's triangles, sampled over the first SECONDS of a fresh load
// of the default guest route (boat, Anne Frank House -> Rijksmuseum). START=1 presses Start at once;
// otherwise the page sits on the briefing, as a first-time rider reading it does.
// PROFILE=firefox-android (default) | iphone | desktop. CPU=4 adds a 4x CDP CPU throttle.
// START_AT=ms presses Start at that page time (a rider who read the briefing) and reports the 5 s after it:
// frame gaps and program links (#109: the warm-up behind a covering card moves to Start). QS=?coverPause=0 is before.
const port = process.env.PORT || 4641, seconds = Number(process.env.SECONDS || 15);
const profiles = {
  'firefox-android': {viewport: {width: 414, height: 774}, deviceScaleFactor: 2.608695652173913, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Android 17; Mobile; rv:159.0) Gecko/159.0 Firefox/159.0'},
  iphone: {viewport: {width: 390, height: 664}, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'},
  desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1},
};
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext(profiles[process.env.PROFILE || 'firefox-android']);
const page = await context.newPage();
if (process.env.CPU) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', {rate: Number(process.env.CPU)}); }
if (process.env.TRACE) await page.addInitScript(() => { window.__gpuTrace = true; });
await page.addInitScript(() => {
  const log = window.__gpuLog = {t0: performance.now(), shaders: [], links: [], textures: 0, texBytes: 0, buffers: 0, contexts: 0, frames: []};
  const tick = t => { log.frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
    const wrap = (name, f) => { const o = P[name]; P[name] = function (...a) { f.call(this, a); return o.apply(this, a); }; };
    const owner = gl => gl.canvas?.classList?.contains('maplibregl-canvas') ? 'map' : 'other';
    wrap('compileShader', function () { log.shaders.push([Math.round(performance.now()), owner(this)]); });
    // TRACE=1 (see below): keep a short stack per link and per texture allocation, to attribute them.
    const where = () => window.__gpuTrace ? (new Error().stack || '').split('\n').slice(3, 9).map(l => l.trim().replace(/https?:\/\/[^/]+/, '').replace(/\?[^:]*/, '')).join(' < ') : '';
    wrap('linkProgram', function () { log.links.push([Math.round(performance.now()), owner(this), where()]); });
    wrap('texStorage2D', function (a) { const b = a[3] * a[4] * 4 * (a[1] > 1 ? 1.33 : 1); log.texBytes += b; (log.allocs ??= []).push([Math.round(performance.now()), 'storage', a[3], a[4], where()]); });
    wrap('createTexture', () => { log.textures++; });
    wrap('createBuffer', () => { log.buffers++; });
    wrap('texImage2D', function (a) { const [w, h] = a.length >= 9 ? [a[3], a[4]] : a[5]?.width ? [a[5].width, a[5].height] : [0, 0]; log.texBytes += w * h * 4; if (w * h >= 512 * 512) (log.allocs ??= []).push([Math.round(performance.now()), 'image', w, h, where()]); });
  }
});
await page.goto(`http://127.0.0.1:${port}/canal-drive/` + (process.env.QS || ''));
const t0 = Date.now(), rows = [];
let started = false, lost = false;
const startAt = Number(process.env.START_AT || 0);
// LOSE_AT=ms: lose the map's context at that page time and restore it 173 ms later (the Sentry -7/-J timing),
// to measure the compile burst a restore brings (-N died 1.4 s after one).
const loseAt = Number(process.env.LOSE_AT || 0);
while (Date.now() - t0 < seconds * 1000) {
  if ((process.env.START || startAt) && !started) started = await page.evaluate((at) => { const g = window.canalRecallGame; const f = document.querySelector('#route-card'); if (performance.now() < at || !g?.routePois?.length || !f) return false; window.__gpuLog.startedAt = Math.round(performance.now()); f.requestSubmit(); return true; }, startAt).catch(() => false);
  if (loseAt && !lost) lost = await page.evaluate((at) => {
    if (performance.now() < at) return false;
    const gl = window.canalRecallGame?.vectorMap?.map?.painter?.context?.gl, ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    window.__gpuLog.lostAt = Math.round(performance.now()); ext.loseContext();
    setTimeout(() => { window.__gpuLog.restoredAt = Math.round(performance.now()); ext.restoreContext(); }, 173);
    return true;
  }, loseAt).catch(() => false);
  const r = await page.evaluate(() => {
    const L = window.__gpuLog, g = window.canalRecallGame, vm = g?.vectorMap, f = vm?._sharedFrame, i = f?.renderer?.info, m = vm?.map;
    const stats = f?.drawStats?.() || {};
    let mapPrograms = null; try { mapPrograms = m?.painter?.cache ? Object.keys(m.painter.cache).length : null; } catch (_) {}
    return {t: Math.round(performance.now()), links: L.links.length, mapLinks: L.links.filter(x => x[1] === 'map').length, threePrograms: i?.programs?.length ?? null, mapPrograms,
      textures: L.textures, texMB: +(L.texBytes / 1048576).toFixed(1), buffers: L.buffers, threeTex: i?.memory?.textures ?? null, threeGeo: i?.memory?.geometries ?? null,
      tris: f?.stats?.main?.triangles ?? null, paused: f?.coverPaused ?? null, calls: f?.stats?.main?.calls ?? null, state: g?.state ?? null, pitch: m ? Math.round(m.getPitch()) : null, zoom: m ? +m.getZoom().toFixed(1) : null,
      canvas: m ? `${m.getCanvas().width}x${m.getCanvas().height}` : null, coarse: matchMedia('(pointer: coarse)').matches,
      heaviest: Object.entries(stats).sort((a, b) => b[1].triangles - a[1].triangles).slice(0, 3).map(([k, v]) => `${k}:${v.triangles}`).join(' ')};
  }).catch(e => ({err: String(e).slice(0, 80)}));
  rows.push(r); await page.waitForTimeout(500);
}
const links = await page.evaluate(() => window.__gpuLog.links);
const startedAt = await page.evaluate(() => window.__gpuLog.startedAt ?? null);
if (startedAt != null) {
  // The first 5 s after Start: frame gaps (rAF) and program links.
  const frames = await page.evaluate(() => window.__gpuLog.frames);
  const win = frames.filter(t => t >= startedAt && t < startedAt + 5000);
  const gaps = win.slice(1).map((t, i) => t - win[i]).sort((a, b) => a - b);
  const q = p => gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))].toFixed(1) : null;
  const after = links.filter(([t]) => t >= startedAt && t < startedAt + 5000).map(([t]) => t);
  let peak = 0; for (const t of after) peak = Math.max(peak, after.filter(u => u >= t && u < t + 100).length);
  const before = links.filter(([t]) => t < startedAt).length;
  console.log('start', startedAt, JSON.stringify({linksBeforeStart: before, linksIn5s: after.length, linkPeakPer100ms: peak, frames: win.length, gapP50: q(0.5), gapP95: q(0.95), gapMax: q(1), gapsOver50: gaps.filter(g => g > 50).length, gapsOver100: gaps.filter(g => g > 100).length}));
}
const {lostAt, restoredAt} = await page.evaluate(() => window.__gpuLog);
if (restoredAt) {
  // Links in the 1.4 s after the restore, and the most in any one 100 ms (one task / frame).
  const after = links.filter(([t]) => t >= restoredAt && t < restoredAt + 1400).map(([t]) => t);
  let peak = 0; for (const t of after) peak = Math.max(peak, after.filter(u => u >= t && u < t + 100).length);
  console.log('lost', lostAt, 'restored', restoredAt, 'links in 1.4 s after restore', after.length, 'peak per 100 ms', peak);
}
// Program links per second, and the worst 1.4 s window (Sentry -N: 2 -> 22 three.js programs within 1.4 s).
const perSec = {}; for (const [t] of links) perSec[Math.floor(t / 1000)] = (perSec[Math.floor(t / 1000)] || 0) + 1;
let worst = 0; for (let a = 0; a < links.length; a++) { let b = a; while (b < links.length && links[b][0] - links[a][0] <= 1400) b++; worst = Math.max(worst, b - a); }
for (const r of rows) console.log(JSON.stringify(r));
let peak100 = 0; for (let a = 0; a < links.length; a++) { let b = a; while (b < links.length && links[b][0] - links[a][0] < 100) b++; peak100 = Math.max(peak100, b - a); }
console.log('links/s', JSON.stringify(perSec), 'worst 1.4 s window', worst, 'peak per 100 ms', peak100, 'total', links.length);
if (process.env.TRACE) { const L = await page.evaluate(() => window.__gpuLog); for (const l of L.links) console.log('link', l.join(' | ')); for (const a of L.allocs || []) console.log('tex', a.join(' | ')); }
if (process.env.SHOT) { fs.mkdirSync(path.dirname(process.env.SHOT), {recursive: true}); await page.screenshot({path: process.env.SHOT}); }
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({rows, links, perSec, worst}, null, 1));
await browser.close();
