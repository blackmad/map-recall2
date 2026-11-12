import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';
import { GROUND_V2_PLACES } from '../../src/canalRecall/ownGround/groundV2Places';

// Lane G2a #372: before/after frames at the ground v2 named places (groundV2Places.ts), own engine, the rider stood at
// each place with the chase camera, then a low aerial over it. GROUND_V2_BEFORE=1 shoots without `?groundV2=1` (the
// worker-built surface). The baked files must be served at data/extracts/amsterdam/ground-v2/ (staging copied there
// for the run, not committed). Writes <project>-<place>-{ride,air}.png and groundV2.json (each place cell's loader
// outcome: 'v2:<baked tris>/<dropped>' or 'fallback:<why>'). Opt-in:
//   GROUND_V2_FRAMES=1 [GROUND_V2_BEFORE=1] [BUNDLES_DIR=dir] GROUND_V2_SHOTS_OUT=dir PW_PORT=4470 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/ground-v2-frames.spec.ts --project=desktop --workers=1
// GROUND_V2_STRIPS=<audit --places --json file>: each place's thin strip slivers (stripAt: x, y, layer, height mm)
// projected in the ride frame, their on-screen width in px (the larger of the height laid east and north), so the
// hand-back can say whether a remaining strip can be seen at ride height.
test.skip(!process.env.GROUND_V2_FRAMES, 'set GROUND_V2_FRAMES=1');

const BEFORE = process.env.GROUND_V2_BEFORE === '1';
// groundStore.ts fromLocal, copied: importing groundStore pulls the crossing register's JSON, which Playwright's loader refuses.
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const fromLocal = (x: number, y: number): [number, number] => [4.9 + x / KX, 52.37 + y / KY];
const STRIPS: { id: string; stripAt?: [number, number, string, number][] }[] = process.env.GROUND_V2_STRIPS ? JSON.parse(readFileSync(process.env.GROUND_V2_STRIPS, 'utf8')) : [];
const OUT = process.env.GROUND_V2_SHOTS_OUT || `artifacts/ground-v2/frames/${BEFORE ? 'before' : 'after'}`;

/** Why the ground has not settled: its pending cells (key → state), the install queue, the resident count. */
async function groundPending(page: Page): Promise<unknown> {
  return page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; return g && { pending: [...(g.pending?.entries?.() ?? [])], installQueue: (g.installQueue ?? []).map((q: any) => q.key ?? q), resident: g.resident?.size, zoom: g.zoom }; });
}

async function place(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
  }, { lng, lat, bearing });
}

test('ground v2: frames at the named places', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  // A place that does not settle names its cells (round 2: the Radarweg place never settled in 90 s).
  const consoleLines: string[] = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleLines.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => consoleLines.push(`pageerror: ${String(e).slice(0, 300)}`));
  const settle = async (where: string) => {
    const s = await settleWorld(page, where) as { settled?: boolean } | null;
    if (s && s.settled === false) console.warn(`${where}: ground pending ${JSON.stringify(await groundPending(page))}; console ${JSON.stringify(consoleLines.slice(-8))}`);
  };
  await page.goto(`/canal-drive/?ride=free&engine=own${BEFORE ? '' : '&groundV2=1'}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.GROUND_V2_ONLY?.split(',');
  const outcome: Record<string, unknown> = {};
  for (const p of GROUND_V2_PLACES) {
    if (only && !only.includes(p.id)) continue;
    await place(page, p.at[0], p.at[1], p.bearing);
    await settle(`${p.id} ride`);
    await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
    await settle(`${p.id} ride re-planned`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${p.id}-ride.png` });
    outcome[p.id] = await page.evaluate((at) => { const g = (window as any).canalRecallGame.vectorMap._ownGround; const key = g.cellKeyAt(at); const s = key ? g.cellStats(key) : null; return { key, lod: s?.lod ?? null, detail: s?.detail ?? null, groundV2: s?.groundV2 ?? null }; }, p.at);
    const strips = STRIPS.find(q => q.id === p.id)?.stripAt ?? [];
    if (strips.length) {
      const probes = strips.map(([x, y, layer, hMm]) => ({ layer, hMm, at: fromLocal(x, y), east: fromLocal(x + hMm / 1000, y), north: fromLocal(x, y + hMm / 1000) }));
      (outcome[p.id] as Record<string, unknown>).strips = await page.evaluate((qs) => {
        const vm = (window as any).canalRecallGame.vectorMap, cam = vm.camera, W = innerWidth, H = innerHeight;
        const px = (a: [number, number]) => { const q = cam.project(a); return [q.x, q.y]; };
        return qs.map(q => { const a = px(q.at), e = px(q.east), n = px(q.north); const on = a[0] >= 0 && a[0] <= W && a[1] >= 0 && a[1] <= H; return { layer: q.layer, hMm: q.hMm, onScreen: on, widthPx: +Math.max(Math.hypot(e[0] - a[0], e[1] - a[1]), Math.hypot(n[0] - a[0], n[1] - a[1])).toFixed(2) }; });
      }, probes);
    }
  }
  for (const p of GROUND_V2_PLACES) {
    if (only && !only.includes(p.id)) continue;
    await place(page, p.at[0], p.at[1], p.bearing);
    const pose = { center: p.at, zoom: 18.6, pitch: 45, bearing: p.bearing };
    const jump = () => page.evaluate((q) => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
      vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      vm.jumpToLngLat({ center: q.center, zoom: q.zoom, pitch: q.pitch, bearing: q.bearing, elevation: g?.ready ? g.heightAt(q.center) : 0 });
    }, pose);
    await jump();
    await settle(`${p.id} air`);
    await jump();
    await settle(`${p.id} air again`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${p.id}-air.png` });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__held) { vm.sync = vm.__held.sync; vm.aimAtWorld = vm.__held.aimAtWorld; vm.__held = null; } });
  }
  writeFileSync(`${OUT}/${info.project.name}-groundV2.json`, JSON.stringify(outcome, null, 1));
});
