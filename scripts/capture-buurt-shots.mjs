// In-game frames for the neighbourhood pages (GitHub #69).
//   PORT=4493 bash /tmp/canal-pw.sh node scripts/capture-buurt-shots.mjs [slug-regex]
// Reads public/canal-drive/buurt/shots/plan.json (written by scripts/build-buurt-pages.ts:
// per page up to three street-level viewpoints facing a landmark, plus one aerial over the
// centre), boots one bike ride, teleports to each viewpoint the way scripts/live-play-shots.mjs
// does, hides the HUD, and writes <slug>-<n>.jpg (960 px wide, mozjpeg) plus one <slug>-cover.jpg
// thumbnail per page for the index. Frames already on disk are kept unless FORCE=1.
// Leaves shots/manifest.json; then run scripts/build-buurt-pages.ts again.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/canal-drive/buurt/shots';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const force = process.env.FORCE === '1', settle = Number(process.env.SETTLE_MS || 5000);
const WIDTH = 960, QUALITY = Number(process.env.QUALITY || 64), AERIAL_ZOOM = Number(process.env.AERIAL_ZOOM || 0.16);
const manifestFile = `${DIR}/manifest.json`;
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { shots: {} };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4493}/canal-drive/`);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 120000 });
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
await page.evaluate(() => { canalRecallGame.state = 4; window.__chaseZoom = canalRecallGame.camera.zoom; });
const hud = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas.maplibregl-canvas { visibility: visible !important; }' });

let done = 0;
for (const p of plan.pages) {
  if (only && !only.test(p.slug)) continue;
  const list = [];
  for (const [i, s] of p.shots.entries()) {
    const file = `shots/${p.slug}-${i + 1}.jpg`, abs = path.join('public/canal-drive/buurt', file);
    const [lng, lat, bearing] = s.at;
    if (!force && fs.existsSync(abs)) {
      const prev = (manifest.shots[p.slug] || []).find(x => x.file === file);
      if (prev) { list.push(prev); continue; }
    }
    await page.evaluate(({ lng, lat, bearing, aerial, zoom }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
      const pose = { x: g.player.x, y: g.player.y, angle: g.player.angle };
      if (window.__holdPose) cancelAnimationFrame(window.__holdPose);
      const hold = () => { Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 }); window.__holdPose = requestAnimationFrame(hold); };
      hold();
      g.camera.zoom = aerial ? zoom : window.__chaseZoom;
    }, { lng, lat, bearing, aerial: s.view === 'aerial', zoom: AERIAL_ZOOM });
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const st = g.status(); return st.ready && !st.queued && !Object.keys(st.pending).length; }, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(settle);
    const png = await page.screenshot({ type: 'png' });
    const img = sharp(png).resize({ width: WIDTH });
    const info = await img.clone().jpeg({ quality: QUALITY, mozjpeg: true }).toFile(abs);
    const entry = { file, label: s.label, view: s.view, lng, lat, bearing, width: info.width, height: info.height };
    if (i === p.shots.length - 1 || s.view === 'aerial') {
      const thumb = `shots/${p.slug}-cover.jpg`;
      await sharp(png).resize({ width: 480 }).jpeg({ quality: 62, mozjpeg: true }).toFile(path.join('public/canal-drive/buurt', thumb));
      entry.thumb = thumb;
    }
    list.push(entry);
    done++;
    process.stdout.write(`${p.slug}-${i + 1} `);
  }
  manifest.shots[p.slug] = list;
  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
}
await hud.evaluate(e => e.remove());
console.log('\nframes', done, 'errors', errors.length, errors.slice(0, 3));
await browser.close();
