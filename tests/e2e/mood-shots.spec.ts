/**
 * Mood shots (lane-sun-and-mood-20261013, docs/LOOK.md §Mood): six spots, each
 * from the sun side (rider facing away from the sun, lit walls ahead) and the
 * shade side (rider facing into the sun), with a luma/saturation table.
 * Not part of check:canal: a before/after record for look changes.
 *
 *   PW_PORT=4450 MOOD_OUT=artifacts/mood/before npx playwright test mood-shots --project=desktop
 *   MOOD_QUERIES=',?sharedFrame=1&cityLook=1' picks the frames; MOOD_SPOTS=dam,canal picks spots;
 *   LOOK_BUNDLES_DIR=<dir> serves freshly built *.bundle.js (as look-consistency).
 *
 * mood.json per frame and spot/side: mean sRGB luma and HSV saturation of the
 * whole frame, of the building pixels (those that change when the streamed
 * buildings and landmarks are hidden) and of the rest (ground, water, trees, sky).
 */
import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { DEFAULT_LIGHT_RIG } from '../../src/canalRecall/rendererShared/lightRig';

const OUT = process.env.MOOD_OUT || 'artifacts/mood';
const QUERIES = (process.env.MOOD_QUERIES ?? ',?sharedFrame=1&cityLook=1,?ownGround=1&cityLook=1').split(',').map(s => s.trim());
const ONLY = process.env.MOOD_SPOTS?.split(',').filter(Boolean);

type Spot = { name: string; target: [number, number]; standM: number; view: 'chase' | 'cockpit' | 'aerial' };
export const MOOD_SPOTS: Spot[] = [
  { name: 'dam', target: [4.8913, 52.3731], standM: 95, view: 'chase' },
  { name: 'westerkerk', target: [4.8839, 52.3745], standM: 80, view: 'chase' },
  { name: 'rijksmuseum', target: [4.8852, 52.3600], standM: 75, view: 'chase' },
  { name: 'bilderdijk', target: [4.87195, 52.3672], standM: 60, view: 'chase' },
  { name: 'nieuw-west', target: [4.8076, 52.3585], standM: 60, view: 'chase' },
  // The Amstel by the Magere Brug, from the water at the cockpit's eye, looking along it
  // (on a quay the clearance guard drops a cockpit's pitch to plan view between the houses).
  { name: 'canal', target: [4.9030, 52.3615], standM: 0, view: 'cockpit' },
  // The acceptance shot for "so much grey" (user, 2026-10-13): Kinkerbuurt / Ten Katestraat from
  // ~200 m, the sun side looking north-east. Flat roofs, streets and brick shade sides in one frame.
  { name: 'kinkerbuurt', target: [4.8700, 52.3680], standM: 250, view: 'aerial' },
];

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).__moodIdle = 0; });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__moodIdle = idle && landmarksIdle && key === w.__moodKey ? (w.__moodIdle || 0) + 1 : 0;
    w.__moodKey = key;
    return w.__moodIdle >= 4;
  }, null, { timeout: 180_000, polling: 1000 });
}

const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const satOf = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };

async function raw(png: Buffer) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function stats(a: Awaited<ReturnType<typeof raw>>, b: Awaited<ReturnType<typeof raw>>) {
  const acc = { all: [0, 0, 0], buildings: [0, 0, 0], rest: [0, 0, 0] };
  for (let k = 0; k < a.data.length; k += 3) {
    const r = a.data[k], g = a.data[k + 1], bl = a.data[k + 2];
    const l = lumaOf(r, g, bl), s = satOf(r, g, bl);
    const d = Math.abs(r - b.data[k]) + Math.abs(g - b.data[k + 1]) + Math.abs(bl - b.data[k + 2]);
    for (const key of ['all', d > 18 ? 'buildings' : 'rest'] as const) { acc[key][0] += l; acc[key][1] += s; acc[key][2]++; }
  }
  const out: Record<string, { luma: number; sat: number; share: number }> = {};
  for (const [k, [l, s, n]] of Object.entries(acc)) out[k] = { luma: +(l / Math.max(1, n)).toFixed(1), sat: +(s / Math.max(1, n)).toFixed(3), share: +(n / (a.data.length / 3)).toFixed(3) };
  return out;
}

for (const query of QUERIES) for (const view of ['chase', 'cockpit', 'aerial'] as const) {
  const label = query ? query.replace(/^\?/, '').replace(/[=&]/g, '-') : 'default';
  test(`mood shots: ${label} ${view}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough');
    test.setTimeout(1_800_000);
    const dir = join(OUT, label);
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    const bundles = process.env.LOOK_BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    const results: Record<string, unknown> = {};
    {
      const spots = MOOD_SPOTS.filter(s => s.view === view && (!ONLY || ONLY.includes(s.name)));
      test.skip(!spots.length, 'no spots for this view');
      await openRoute(page, { travelMode: 'car', query, abortHeavyTiles: true });
      // Cockpit is no longer a player choice; these captures still set the
      // camera directly for the low view.
      if (view === 'cockpit') {
        await page.evaluate(() => {
          const g = (window as any).canalRecallGame;
          g.viewMode = 'cockpit';
          g.camera.viewMode = 'cockpit';
          g.camera.northUp = false;
        });
      }
      await page.evaluate(() => {
        const map = (window as any).canalRecallGame.vectorMap.map;
        for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
      });
      for (const spot of spots) {
        // Sun side: stand toward the sun from the target, face away from it. Shade side: the opposite.
        const sunAz = DEFAULT_LIGHT_RIG.sunAzimuthDeg;
        for (const side of ['sun', 'shade'] as const) {
          const standBearing = side === 'sun' ? sunAz : (sunAz + 180) % 360;
          const face = (standBearing + 180) % 360;
          const b = standBearing * Math.PI / 180, c = spot.target;
          const p = { lng: c[0] + Math.sin(b) * spot.standM / (111320 * Math.cos(c[1] * Math.PI / 180)), lat: c[1] + Math.cos(b) * spot.standM / 111320, bearing: face };
          await teleport(page, p);
          await page.waitForTimeout(2500);
          await teleport(page, p);
          if (view === 'aerial') {
            // A fixed camera 200 m up, standM back from the target (the rider stands under it).
            await page.evaluate(({ eye, target }) => {
              const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
              vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
              map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, 200, { lng: target[0], lat: target[1] }, 0));
            }, { eye: [p.lng, p.lat], target: c });
          }
          await settle(page);
          await page.waitForTimeout(2500);
          await page.evaluate(() => {
            const map = (window as any).canalRecallGame.vectorMap.map, canvas = map.getCanvas();
            for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
          });
          await page.waitForTimeout(600);
          const shot = await page.screenshot();
          writeFileSync(join(dir, `${spot.name}-${side}.png`), shot);
          await page.evaluate(() => {
            const vm = (window as any).canalRecallGame.vectorMap;
            vm._threeBuildings?.setVisible(false); vm.__moodLandmarks = vm._signatureLandmarks?.enabled;
            if (vm._signatureLandmarks) vm._signatureLandmarks.enabled = false;
            vm.map.triggerRepaint();
          });
          await page.waitForTimeout(600);
          const bare = await page.screenshot();
          await page.evaluate(() => {
            const vm = (window as any).canalRecallGame.vectorMap;
            vm._threeBuildings?.setVisible(true);
            if (vm._signatureLandmarks) vm._signatureLandmarks.enabled = vm.__moodLandmarks;
            for (const e of Array.from(document.body.querySelectorAll('*'))) (e as HTMLElement).style.visibility = '';
            vm.map.triggerRepaint();
          });
          results[`${spot.name}-${side}`] = stats(await raw(shot), await raw(bare));
        }
      }
    }
    writeFileSync(join(dir, `mood-${view}.json`), JSON.stringify({ query, view, results }, null, 1));
    console.log(label, JSON.stringify(results));
  });
}
