// Lane PR1 cost check: triangles drawn, resident GPU MB (glCounters, the figure aerialGlMaxMB peaks) and the building
// chunks' vertices at the Dam, aerial (z16.2 p60) and chase (z17.8 p72), the shader-facades spec's two poses, for one
// query. Run once per flag state, one at a time, through the browser queue:
//   BUNDLES_DIR=<scratch bundles> PORT=4662 /tmp/canal-pw.sh node scripts/house-line/structure/dam-cost.mjs <out.json> '?world=live&structurePrior=0'
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [out = 'artifacts/structure-priors/cost/dam.json', extra = ''] = process.argv.slice(2);
const origin = `http://127.0.0.1:${process.env.PORT || 4662}`;
const POSES = [
  { name: 'dam-aerial', center: [4.8926, 52.3731], zoom: 16.2, bearing: 250, pitch: 60 },
  { name: 'dam-chase', center: [4.8926, 52.3731], zoom: 17.8, bearing: 250, pitch: 72 },
];
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await context.route(/ingest\.(us\.)?sentry\.io/, route => route.fulfill({ status: 200, body: '{}' }));
const page = await context.newPage();
await page.addInitScript(() => { window.__canalRecallGlCounters = true; });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const qs = `?ride=free&engine=own${extra ? `&${extra.replace(/^\?/, '')}` : ''}`;
await page.goto(`${origin}/canal-drive/${qs}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
await page.evaluate(() => { const p = canalRecallGame.player; canalRecallGame.camera.viewMode = 'chase'; p.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
async function settle() {
  let prev = '', stable = 0;
  for (const t0 = Date.now(); Date.now() - t0 < 120_000;) {
    for (let k = 0; k < 5; k++) { await page.evaluate(() => { const vm = canalRecallGame.vectorMap; if (vm?.settleTick) vm.settleTick(); else vm?.host?.triggerRepaint?.(); }); await page.waitForTimeout(100); }
    const now = JSON.stringify(await page.evaluate(() => canalRecallGame.vectorMap?.worldSettled?.() ?? { settled: true }));
    stable = JSON.parse(now).settled && now === prev ? stable + 1 : 0; prev = now;
    if (stable >= 2) return true;
  }
  return false;
}
const result = { qs, bundles: process.env.BUNDLES_DIR ?? null, at: new Date().toISOString(), poses: {}, errors };
for (const pose of POSES) {
  const jump = () => page.evaluate(p => { const vm = canalRecallGame.vectorMap; vm.sync = () => {}; vm.aimAtWorld = () => {}; const g = vm._ownGround; vm.jumpToLngLat({ ...p, elevation: g?.ready ? g.heightAt(p.center) : 0 }); }, pose);
  await jump(); const s1 = await settle(); await jump(); const s2 = await settle();
  await page.waitForTimeout(2500);
  result.poses[pose.name] = { settled: s1 && s2, ...(await page.evaluate(() => {
    const vm = canalRecallGame.vectorMap, st = vm._sharedFrame?.stats, rep = window.__canalPerf?.gl?.report?.();
    const tb = vm._threeBuildings, chunks = tb ? [...tb.chunks.values()] : [];
    let vertices = 0, indices = 0;
    for (const c of chunks) { const g = c.mesh?.geometry; if (g) { vertices += g.attributes?.position?.count ?? 0; indices += g.index?.count ?? 0; } }
    return { triangles: (st?.main?.triangles ?? 0) + (st?.overlay?.triangles ?? 0), draws: (st?.main?.calls ?? 0) + (st?.overlay?.calls ?? 0),
      glResidentMB: rep?.resident?.totalMB ?? null, glBufferMB: rep?.resident?.bufferMB ?? null, glTextureMB: rep?.resident?.textureMB ?? null,
      buildingChunks: chunks.length, buildingVertices: vertices, buildingIndices: indices };
  })) };
  console.log(pose.name, JSON.stringify(result.poses[pose.name]));
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
