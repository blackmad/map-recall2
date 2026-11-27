// Before/after frames for `?landmarkFarLod=<m>` (lane landmark-residency, 2026-11-27; David: "Show me frames first").
// Each pose: a race start parked facing its finish (chase camera, ?engine=own), the world settled, then frames with the
// far-lod rule off, and on at each asked distance, switched in place on the same page (the layer's `_farLodValue`, which
// `?landmarkFarLod=` sets at load), so nothing else in the world differs between the frames. Per frame: a 1512x900 dpr 2
// screenshot, triangles and draws per drawn frame (every GL draw over 20 forced frames), and the landmarks whose level
// changed with their eye distance. Then per pair: pixels that differ (any channel > 24), a crop around the densest
// changed area; scripts/perf/farlod-page.mjs then writes the HTML page. A second off frame 5 s later is the noise floor.
//   PORT=4363 BUNDLES_DIR=<scratch> node scripts/perf/farlod-frames.mjs [--out artifacts/landmark-farlod] [--only <pose>]
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const outDir = opt('out', 'artifacts/landmark-farlod'), only = opt('only', null);
const origin = `http://127.0.0.1:${process.env.PORT || 4363}`;
// start [lat, lng] -> finish [lat, lng]: the rider parks at the start facing along the route to the finish.
const POSES = [
  { id: 'westerkerk-prinsengracht', label: 'Westerkerk tower from the Prinsengracht', start: [52.3698, 4.8829], finish: [52.3738, 4.8840], dists: [300, 450] },
  { id: 'munttoren-amstel', label: 'Munttoren from the Amstel', start: [52.3667, 4.9008], finish: [52.3671, 4.8960], dists: [300] },
  { id: 'zuiderkerk-zwanenburgwal', label: 'Zuiderkerk from the Zwanenburgwal', start: [52.3663, 4.9003], finish: [52.3700, 4.9008], dists: [300] },
  { id: 'damrak-centraal', label: 'Centraal / Damrak skyline from the Dam', start: [52.3731, 4.8930], finish: [52.3772, 4.8975], dists: [300] },
  { id: 'rokin-dam', label: 'Rokin towards the Dam (Beurs, Nieuwe Kerk, Palace)', start: [52.3672, 4.8917], finish: [52.3712, 4.8928], dists: [300] },
].filter(p => !only || p.id === only);
fs.mkdirSync(outDir, { recursive: true });
setTimeout(() => { console.error('watchdog'); process.exit(3); }, 1_800_000).unref();

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const results = [];
for (const pose of POSES) {
  const context = await browser.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 });
  await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
  if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, r => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(r.request().url())[1]);
    return fs.existsSync(file) ? r.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : r.continue();
  });
  await context.addInitScript(() => {
    let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    const C = window.__fl = { draws: 0, tris: 0 };
    const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
    const P = WebGL2RenderingContext.prototype;
    const wrap = (o, name, f) => { const b = o[name]; if (b) o[name] = function (...a) { try { f(a); } catch (_) {} return b.apply(this, a); }; };
    wrap(P, 'drawArrays', a => { C.draws++; C.tris += tri(a[0], a[2]); });
    wrap(P, 'drawElements', a => { C.draws++; C.tris += tri(a[0], a[1]); });
    wrap(P, 'drawArraysInstanced', a => { C.draws++; C.tris += tri(a[0], a[2]) * a[3]; });
    wrap(P, 'drawElementsInstanced', a => { C.draws++; C.tris += tri(a[0], a[1]) * a[4]; });
    wrap(P, 'drawRangeElements', a => { C.draws++; C.tris += tri(a[0], a[3]); });
    const ge = P.getExtension;
    P.getExtension = function (name) {
      const ext = ge.call(this, name);
      if (ext && name === 'WEBGL_multi_draw' && !ext.__fl) {
        ext.__fl = true;
        wrap(ext, 'multiDrawElementsWEBGL', a => { for (let i = 0; i < a[5]; i++) { C.draws++; C.tris += tri(a[0], a[1][a[2] + i]); } });
        wrap(ext, 'multiDrawElementsInstancedWEBGL', a => { for (let i = 0; i < a[7]; i++) { C.draws++; C.tris += tri(a[0], a[1][a[2] + i]) * a[5][a[6] + i]; } });
      }
      return ext;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const [S, F] = [pose.start, pose.finish];
  await page.goto(`${origin}/canal-drive/?engine=own&travel=car#race=${S[0]},${S[1]},${S[0]},${S[1]},${F[0]},${F[1]}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => { const g = window.canalRecallGame; return g && g.state === 4 && (!g.camera || !g.camera.introOverview); }, null, { timeout: 240_000, polling: 500 });
  // Parked, facing the finish (the chase camera follows the rider's heading).
  await page.evaluate(fin => {
    const g = canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    const fx = l._lastOffsetX + (fin[1] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, fy = l._lastOffsetY - (fin[0] - l._lastCenterLat) * 111320 * ppm;
    p.angle = Math.atan2(fy - p.y, fx - p.x);
    g._quizFreezesRide = () => false; p.handleInput = () => {}; p.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
  }, F);
  const settle = async (minS = 6) => {
    const t0 = Date.now(); let prev = '', stable = 0;
    while (Date.now() - t0 < 150_000) {
      const now = await page.evaluate(() => {
        const vm = canalRecallGame.vectorMap, sl = vm._signatureLandmarks;
        for (let k = 0; k < 3; k++) { if (vm.settleTick) vm.settleTick(); else vm.host?.triggerRepaint?.(); }
        sl?._updateLevels?.();
        const w = vm.worldSettled?.() ?? { settled: true }, pending = vm.pendingWork?.() ?? [];
        const levels = (sl?._entries || []).map(e => `${e.spec.id}:${e.level}${e.levelLoading ? '*' : ''}`).sort().join(',');
        return { settled: !!w.settled && !pending.length, key: `${vm._threeBuildings?.stats?.()?.buildings}|${levels}|${sl?._pending?.size}` };
      });
      stable = now.settled && now.key === prev ? stable + 1 : 0; prev = now.key;
      if (stable >= 4 && Date.now() - t0 > minS * 1000) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };
  const shoot = async tag => {
    const levels = await page.evaluate(async () => {
      const vm = canalRecallGame.vectorMap, sl = vm._signatureLandmarks, C = window.__fl;
      C.draws = 0; C.tris = 0; let frames = 0; const off = vm.host.on?.('render', () => frames++);
      for (let k = 0; k < 20; k++) { vm.settleTick?.(); vm.host?.triggerRepaint?.(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
      void off;
      return { frames, tris: Math.round(C.tris / Math.max(1, frames)), draws: Math.round(C.draws / Math.max(1, frames)),
        entries: (sl?._entries || []).map(e => ({ id: e.spec.id, level: e.level, d: Math.round(sl._eyeDistanceM(e.spec, e.placement.anchor) ?? -1) })) };
    });
    const file = path.join(outDir, `${pose.id}-${tag}.png`);
    await page.screenshot({ path: file });
    return { tag, file, ...levels };
  };
  const ok = await settle(10);
  const shots = [await shoot('off')];
  // Noise floor: a second off frame after the same wait, so animation (water, flags) is not charged to the rule.
  await page.waitForTimeout(5000);
  await settle(6);
  const noise = await shoot('off2');
  for (const m of [...pose.dists].sort((a, b) => b - a)) {
    await page.evaluate(m => { canalRecallGame.vectorMap._signatureLandmarks._farLodValue = m; }, m);
    // The level dwell holds a downgrade 4 s; settle waits for the swaps and the lod1 loads.
    await page.waitForTimeout(5000);
    await settle(6);
    shots.push(await shoot(`far${m}`));
  }
  results.push({ ...pose, settled: ok, shots, noise, errors: errors.slice(0, 3) });
  console.error(`${pose.id}: settled ${ok}; ${shots.map(s => `${s.tag} ${s.tris} tris/${s.draws} draws (${s.frames} frames)`).join('; ')}`);
  await context.close();
}
await browser.close();

// Pairs: off against each distance.
const pairs = [];
for (const r of results) {
  const off = r.shots[0];
  const n = await sharp(r.noise.file).raw().toBuffer({ resolveWithObject: true });
  for (const on of r.shots.slice(1)) {
    const [a, b] = await Promise.all([off.file, on.file].map(f => sharp(f).raw().toBuffer({ resolveWithObject: true })));
    const { width: W, height: H, channels: ch } = a.info, G = 48, gw = Math.ceil(W / G), gh = Math.ceil(H / G), grid = new Uint32Array(gw * gh);
    const differs = (u, v, i) => Math.abs(u[i] - v[i]) > 24 || Math.abs(u[i + 1] - v[i + 1]) > 24 || Math.abs(u[i + 2] - v[i + 2]) > 24;
    let changed = 0, noisePx = 0, beyondNoise = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch, nz = differs(a.data, n.data, i);
      if (nz) noisePx++;
      // The crop follows changes the noise frame does not show.
      if (differs(a.data, b.data, i)) { changed++; if (!nz) { beyondNoise++; grid[Math.floor(y / G) * gw + Math.floor(x / G)]++; } }
    }
    // Crop: a 480x300 device-px window (shown at 2x) centred on the densest 3x3 block of grid cells.
    let best = -1, bx = 0, by = 0;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += grid[(gy + dy) * gw + gx + dx] ?? 0; if (s > best) { best = s; bx = gx; by = gy; } }
    const cw = 480, chh = 300, left = Math.max(0, Math.min(W - cw, bx * G + G / 2 - cw / 2)), top = Math.max(0, Math.min(H - chh, by * G + G / 2 - chh / 2));
    const crop = async (f, tag) => { const o = path.join(outDir, `${r.id}-${tag}-crop.png`); await sharp(f).extract({ left: Math.round(left), top: Math.round(top), width: cw, height: chh }).resize(cw * 2, chh * 2, { kernel: 'nearest' }).toFile(o); return path.basename(o); };
    const offLevels = new Map(off.entries.map(e => [e.id, e.level]));
    const swapped = on.entries.filter(e => offLevels.get(e.id) && offLevels.get(e.id) !== e.level).map(e => `${e.id} ${offLevels.get(e.id)}→${e.level} @${e.d} m`);
    pairs.push({ pose: r.id, label: r.label, settled: r.settled, tag: on.tag, changedPx: changed, noisePx, beyondNoisePx: beyondNoise, cropBefore: changed ? await crop(off.file, `${on.tag}-off`) : null, cropAfter: changed ? await crop(on.file, on.tag) : null,
      before: path.basename(off.file), after: path.basename(on.file), trisOff: off.tris, trisOn: on.tris, drawsOff: off.draws, drawsOn: on.draws, saved: off.tris - on.tris, swapped, cropAt: [Math.round(left), Math.round(top)] });
  }
}
fs.writeFileSync(path.join(outDir, 'pairs.json'), JSON.stringify({ results: results.map(r => ({ ...r, noise: { ...r.noise, entries: undefined }, shots: r.shots.map(s => ({ ...s, entries: undefined })) })), pairs }, null, 1));
for (const p of pairs) console.log(`${p.pose} ${p.tag}: ${p.changedPx} px changed (noise floor ${p.noisePx}, beyond noise ${p.beyondNoisePx}); tris ${p.trisOff} -> ${p.trisOn} (saved ${p.saved}); swaps ${p.swapped.length}: ${p.swapped.slice(0, 8).join('; ')}`);
