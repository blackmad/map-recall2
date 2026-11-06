import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { CRISP_SPOTS } from '../../scripts/look/crispSpots';

// Lane R3-C (#232): are the rail ballast beds built at every rail spot, on every fresh load? The user's S4 frame
// (s4-zuidas-rails.png, map-recall2-screenshots engine/2026-11-06-user-shots/) shows the Zuidas corridor with no beds.
// One fresh page per load, one spot per load. Per load the rider is placed and the view posed, the ground is waited on
// until nothing is pending, queued or fading, and per resident rail cell the build's `byLayer.ballast` / `.track`, its
// LOD, the worker's rail fetch outcome (GroundStore.railOutcomes) and `status().errors` / `rail.discards` are read.
//
// Modes (RAIL_BEDS_MODE, default both):
//   rider   the rider stands at the spot (scripts/own-ground/rail-shots.mjs), the camera follows it.
//   panned  the user's path: the rider at the Amstel by the Weesperbuurt (where the user's HUD says it was), then
//           the camera panned off it (RE-CENTER showing) to the spot. The ground has to follow the view, not the rider.
// Gate: the cell under the view centre is resident with ballast (and track at LOD 0) wherever the extract has a rail
// cell, in every load. RAIL_BEDS_REPORT_ONLY=1 records without failing (the before run).
//   ENGINE=own BUNDLES_DIR=<scratch> PW_PORT=4647 [RAIL_BEDS_LOADS=10] [RAIL_BEDS_SPOTS=zuidas-rails,...] \
//     [RAIL_BEDS_MODE=rider|panned] [RAIL_BEDS_QUERY=groundView=0] [RAIL_BEDS_OUT=artifacts/rail-beds] \
//     /tmp/canal-pw.sh npx playwright test rail-beds --project=desktop --workers=1
// Output: <out>/<project>-<label>.jsonl, one row per load.

const LOADS = Number(process.env.RAIL_BEDS_LOADS ?? 10);
const NAMES = (process.env.RAIL_BEDS_SPOTS ?? 'zuidas-rails,zuidas-rails-high,piet-heinkade-east,oostertoegang,s4-zuidas-user').split(',').filter(Boolean);
const SPOTS = NAMES.map(n => { const s = CRISP_SPOTS.find(c => c.name === n); if (!s) throw new Error(`unknown spot ${n}`); return s; });
const MODES = (process.env.RAIL_BEDS_MODE ?? 'rider,panned').split(',').filter(Boolean) as ('rider' | 'panned')[];
const QUERY = (process.env.RAIL_BEDS_QUERY ?? '').replace(/^[?&]/, '');
const OUT = process.env.RAIL_BEDS_OUT || 'artifacts/rail-beds';
const LABEL = process.env.RAIL_BEDS_LABEL || 'run';
const REPORT_ONLY = !!process.env.RAIL_BEDS_REPORT_ONLY;
/** The user's rider (the HUD of s4-zuidas-rails.png: "AMSTEL · Weesperbuurt"), by the Hogesluis. */
const USER_RIDER: [number, number] = [4.9040, 52.3605];

type Spot = typeof SPOTS[number];

/** Place the rider at lng/lat heading `bearing` (rail-shots.mjs), held still. */
async function placeRider(page: Page, lngLat: [number, number], bearing: number): Promise<void> {
  await page.evaluate(({ lngLat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g.camera.resetPan?.();
  }, { lngLat, bearing });
}

/** Pan the camera off the rider to lng/lat (camera.js `pan`: detached, the anchor moves; the view eases there). */
async function panTo(page: Page, lngLat: [number, number], bearing: number): Promise<void> {
  await page.evaluate(({ lngLat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), c = g.camera;
    const x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    const y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    // A detached view holds its rotation (camera.js _updateRotation): the spot's bearing, as the user turned it.
    c.pan(0, 0); c.anchorX = x; c.anchorY = y; c.rotation = bearing * Math.PI / 180;
  }, { lngLat, bearing });
}

/** Step the game camera's zoom until the map zoom the ground is given is the spot's (camera.zoom is a canvas scale). */
async function zoomTo(page: Page, zoom: number): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const now = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._ownGround?.zoom ?? null);
    if (now == null || Math.abs(now - zoom) < 0.05) return;
    await page.evaluate(d => { const c = (window as any).canalRecallGame.camera; c.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, c.zoom * 2 ** d)); }, zoom - now);
    await page.waitForTimeout(600);
  }
}

/** Wait until the own ground has nothing asked for, queued, installing or fading (3 polls in a row), at most `ms`. */
async function settle(page: Page, ms = 60_000): Promise<boolean> {
  const start = Date.now();
  let stable = 0, previous = '';
  while (Date.now() - start < ms) {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
      vm.host?.triggerRepaint?.();
      if (!g) return 'none';
      const s = g.status();
      const fading = [...(g.resident?.values?.() ?? [])].filter((r: any) => r.fade).length;
      const busy = !s.ready || !s.workerReady || Object.keys(s.pending).length || s.queued || fading || s.far.pending;
      return busy ? 'busy' : JSON.stringify(s.cells);
    });
    stable = now !== 'busy' && now === previous ? stable + 1 : 0;
    previous = now;
    if (stable >= 3) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function read(page: Page, spot: Spot) {
  return page.evaluate((center) => {
    const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround, s = g.status();
    const key = g.cellKeyAt(center), groundKey = g.centre ? g.store.cellAt(g.centre[0], g.centre[1]) : null;
    const cellOf = (k: string) => { const c = g.cellStats(k); return { key: k, lod: s.cells[k] ?? null, ballast: c?.byLayer?.ballast ?? 0, track: c?.byLayer?.track ?? 0, railFetch: c?.railFetch ?? null }; };
    const railCells = Object.keys(s.cells).filter(k => g.store.railCells.has(k)).map(cellOf);
    const centre = { ...cellOf(key), resident: key in s.cells, hasRails: g.store.railCells.has(key), pending: s.pending[key] ?? null };
    const cam = (window as any).canalRecallGame.camera;
    return { key, groundKey, detached: !!cam.detached, zoom: +(+s.zoom).toFixed(2), radiusM: s.radiusM, visible: s.visible, blend: s.blend, centre, railCells, residents: Object.keys(s.cells).length, errors: s.errors, rail: s.rail, far: { radiusM: s.far.radiusM, blocks: s.far.blocks, partsShown: s.far.partsShown } };
  }, spot.center);
}

for (const mode of MODES) for (const spot of SPOTS) for (let i = 0; i < LOADS; i++) {
  test(`rail beds: ${mode} ${spot.name} load ${i + 1}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const touch = info.project.name === 'iphone';
    await page.addInitScript(() => { (window as any).__canalRecallEngine = 'own'; });
    const chasePitch = spot.pitch ?? 60;
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, seed: 0x5eed1234 + i, query: `?${['governor=0', `chasePitch=${chasePitch}`, QUERY].filter(Boolean).join('&')}` });
    await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.player?.x && g.camera.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 120_000 });
    const t0 = Date.now();
    if (mode === 'rider') {
      await placeRider(page, spot.center, spot.bearing);
      await page.waitForTimeout(800);
      await zoomTo(page, spot.zoom);
    } else {
      // The user rode to the Amstel, then panned off to the corridor (the camera eases over a few hundred ms).
      await placeRider(page, USER_RIDER, spot.bearing);
      await page.waitForTimeout(800);
      await settle(page, 30_000);
      await zoomTo(page, spot.zoom);
      await panTo(page, spot.center, spot.bearing);
    }
    const settled = await settle(page);
    const row = { project: info.project.name, mode, spot: spot.name, load: i + 1, touch, settled, settleS: Math.round((Date.now() - t0) / 100) / 10, query: QUERY, ...(await read(page, spot)) };
    const ok = !row.centre.hasRails || (row.centre.resident && row.centre.ballast > 0 && (row.centre.lod === 1 || row.centre.track > 0));
    appendFileSync(`${OUT}/${info.project.name}-${LABEL}.jsonl`, JSON.stringify({ ...row, ok }) + '\n');
    console.log(`${mode} ${spot.name} #${i + 1}: ${ok ? 'beds' : 'NO BEDS'} centre ${row.key} resident=${row.centre.resident} lod=${row.centre.lod} ballast=${row.centre.ballast} track=${row.centre.track} fetch=${row.centre.railFetch} groundKey=${row.groundKey} r=${row.radiusM} discards=${JSON.stringify(row.rail?.discards)} errors=${row.errors.length}`);
    if (process.env.RAIL_BEDS_SHOTS) {
      const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
      if (url) writeFileSync(`${OUT}/${info.project.name}-${LABEL}-${mode}-${spot.name}-${i + 1}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
    if (!REPORT_ONLY) expect(ok, `${mode} ${spot.name} load ${i + 1}: ballast beds at the view centre's rail cell ${row.key}`).toBe(true);
  });
}
