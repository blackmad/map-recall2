// Ride-review frames: a held pose every ~STEP metres along a polyline, plus a frame before every routed bridge
// within reach of the line and any named extra places. For neighbourhood review lanes (docs/ride-review-*.md).
//   PORT=4525 MODE=bike node scripts/ride-review-shots.mjs <spec.json> <outDir> ["<query>"]
// spec.json: { "mode": "car (the bike) | boat", "dest": "<poi id or name fragment>", "step": 60,
//              "legs": [{ "name": "prinsengracht", "path": [[lat, lng], ...] }],
//              "extra": [{ "name": "westerkerk", "at": [lng, lat, bearing] }] }
// Writes <outDir>/<NN>-<label>.png and <outDir>/frames.json (lng/lat/bearing, own-ground status, nearby bridge).
// Unlike live-play-shots.mjs the quiz cards stay visible, so the frames can be checked for the HUD revealing the answer.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [specFile, out = 'artifacts/ride-review', qs = ''] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
fs.mkdirSync(out, { recursive: true });
const STEP = spec.step || 60, settle = Number(process.env.SETTLE_MS || 4500);
const R = 6371008.8, rad = Math.PI / 180;
const metres = (a, b) => { const x = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad) * R, y = (b[0] - a[0]) * rad * R; return Math.hypot(x, y); };
const bearingOf = (a, b) => (Math.atan2((b[1] - a[1]) * Math.cos(a[0] * rad), b[0] - a[0]) / rad + 360) % 360;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Bridges from the routing extract (ways with bridge=true), merged when their midpoints are within 20 m.
const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8'));
const bridges = [];
for (const w of routing) {
  if (!w.bridge) continue;
  const p = w.path, mid = lerp(p[0], p[p.length - 1], 0.5), len = metres(p[0], p[p.length - 1]);
  if (len < 4) continue;
  const near = bridges.find(b => metres(b.mid, mid) < 20);
  if (near) { if (!near.name && w.name) near.name = w.name; continue; }
  bridges.push({ mid, name: w.name || '', len: Math.round(len), highway: w.highway });
}

const frames = [];
for (const leg of spec.legs) {
  const p = leg.path;
  let carried = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], seg = metres(a, b), brg = bearingOf(a, b);
    if (i > 0) { // a junction-sized turn gets its own frame
      const prev = bearingOf(p[i - 1], a), turn = Math.abs(((brg - prev + 540) % 360) - 180);
      if (turn > 25) frames.push({ label: `${leg.name}-turn`, at: [a[1], a[0], brg] });
    }
    for (let d = carried; d < seg; d += STEP) { const q = lerp(a, b, d / seg); frames.push({ label: leg.name, at: [q[1], q[0], brg] }); }
    carried = (carried - seg) % STEP; if (carried < 0) carried += STEP;
  }
  // Bridges within 45 m of the leg: a frame 35 m before the closest point, looking at the bridge.
  for (const br of bridges) {
    let best = null, along = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const seg = metres(p[i], p[i + 1]);
      for (let t = 0; t <= 1; t += 0.05) { const q = lerp(p[i], p[i + 1], t), d = metres(q, br.mid); if (!best || d < best.d) best = { d, s: along + t * seg }; }
      along += seg;
    }
    if (!best || best.d > 45) continue;
    let s = Math.max(0, best.s - 35), q = p[0];
    for (let i = 0, acc = 0; i < p.length - 1; i++) { const seg = metres(p[i], p[i + 1]); if (acc + seg >= s) { q = lerp(p[i], p[i + 1], (s - acc) / seg); break; } acc += seg; q = p[i + 1]; }
    frames.push({ label: `bridge-${(br.name || 'unnamed').replace(/\W+/g, '').slice(0, 18)}`, at: [q[1], q[0], bearingOf(q, br.mid)], bridge: br, order: leg.name });
  }
}
for (const e of spec.extra || []) frames.push({ label: e.name, at: e.at });

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
if (process.env.BUNDLES_DIR) await context.route(/\/js\/[^/?]+\.bundle\.js/, route => {
  const name = new URL(route.request().url()).pathname.split('/').pop(), file = `${process.env.BUNDLES_DIR}/${name}`;
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'text/javascript' }) : route.continue();
});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4525}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
await page.locator('#travel-mode').selectOption(spec.mode || 'bike', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.evaluate((dest) => {
  const g = canalRecallGame, d = (dest || '').toLowerCase();
  const poi = g.routePois.find(p => p.id === dest) || g.routePois.find(p => (p.name || '').toLowerCase().includes(d));
  if (poi) { try { g._overlay.store.setState({ destinationId: poi.id }); } catch (_) {} const sel = document.querySelector('#poi-destination'); if (sel) sel.value = poi.id; }
}, spec.dest);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
await page.evaluate(() => { canalRecallGame.state = 4; });

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const log = [];
let n = 0;
for (const f of frames) {
  const name = `${String(n++).padStart(2, '0')}-${f.label}`;
  if (only && !only.test(name)) continue;
  const [lng, lat, bearing] = f.at;
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    const pose = { x: g.player.x, y: g.player.y, angle: g.player.angle };
    if (window.__holdPose) cancelAnimationFrame(window.__holdPose);
    const hold = () => { Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 }); window.__holdPose = requestAnimationFrame(hold); };
    hold();
  }, { lng, lat, bearing });
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(settle);
  // EVAL_JS=<file>: run in the page before the shot; whatever it leaves on window.__probe lands in frames.json.
  if (process.env.EVAL_JS) await page.evaluate(src => (0, eval)(src), fs.readFileSync(process.env.EVAL_JS, 'utf8'));
  const info = await page.evaluate(() => {
    const g = canalRecallGame, t = g.vectorMap._inventoryTrees;
    return { probe: window.__probe ?? null, travelMode: g.travelMode, street: g.currentStreetName ?? null, ownGround: !!g.vectorMap._ownGround,
      trees: t ? { drawn: t.debugTrees ?? 0, tiles: t.tiles?.size ?? 0, pending: t.pending?.size ?? 0, queued: t.queue?.length ?? 0 } : null };
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  log.push({ name, lng: +lng.toFixed(6), lat: +lat.toFixed(6), bearing: Math.round(bearing), bridge: f.bridge || null, info });
  process.stdout.write(`${name} `);
}
// DRIVE_S=<seconds>: then let go of the pose at the last frame and ride with ArrowUp held, a frame every 2.5 s,
// questions left open (the HUD check: the asked street must not be named anywhere on screen).
if (Number(process.env.DRIVE_S) > 0) {
  await page.evaluate(() => { if (window.__holdPose) cancelAnimationFrame(window.__holdPose); window.__holdPose = null; });
  await page.keyboard.down('ArrowUp');
  for (let t = 0, i = 0; t < Number(process.env.DRIVE_S); t += 2.5, i++) {
    await page.waitForTimeout(2500);
    const q = await page.evaluate(() => { const g = canalRecallGame; return { state: g.state, street: g.currentStreetName ?? null, prompt: g.quizPromptName || null, kind: g.quizPromptKind || null }; });
    await page.screenshot({ path: `${out}/drive-${String(i).padStart(2, '0')}.png` });
    log.push({ name: `drive-${String(i).padStart(2, '0')}`, drive: q });
  }
  await page.keyboard.up('ArrowUp');
}
fs.writeFileSync(`${out}/frames.json`, JSON.stringify({ qs, spec: specFile, errors, frames: log }, null, 1));
console.log('\n', out, 'frames', log.length, 'errors', errors.length, errors.slice(0, 3));
await browser.close();
