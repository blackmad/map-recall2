/**
 * Shared-frame shadows at four named spots (docs/LOOK.md §Light "Shadow map depth range" and "Shadow fill"):
 * the Royal Palace, the Nassaukade 300–318 block-face chunk (`?streetChunks=1`), a Prinsengracht canal-house
 * run by the Westerkerk and a Nieuw-West slab, each in plain materials and in the city look.
 *
 *   PW_PORT=4475 npx playwright test shadow-fill --project=desktop
 *   SHADOW_OUT=artifacts/shadow-fill SHADOW_SPOTS=palace,nassaukade SHADOW_MODES=plain
 *
 * Each spot is shot under three shadow configurations in one page load:
 *   before    the shadow map drawn inside MapLibre's 3D depth range (`shadowMap.fullDepthRange = false`), no fill:
 *             main before the look/shadow-fill lane;
 *   depthFix  the shadow map drawn at the full depth range, no fill;
 *   after     the shipped rig: full depth range and `SHADOW_FILL`.
 * plus three masks drawn without shadows (everything, without the streamed city and landmarks, without the named
 * model). `table.json` holds, per spot and mask: the share of pixels the shadow map darkens, the share under luma
 * 60, the mean luma of the shadowed pixels and of the pixels no configuration shadows ("sun side", which includes
 * the walls facing away from the sun).
 *
 * Regressions pinned: the named models no longer shadow themselves on their sun-facing walls (the depth-range
 * bug: Palace 95 % of its pixels, the chunk 64 %), shadowed building pixels stay at luma ≥ 70 on average, and the
 * unshadowed pixels do not move (± 5).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { SHADOW_FILL } from '../../src/canalRecall/rendererShared/lightRig';

const OUT = process.env.SHADOW_OUT || 'artifacts/shadow-fill';
const ALL_MODES = [
  { label: 'plain', query: '?sharedFrame=1&streetChunks=1' },
  { label: 'citylook', query: '?sharedFrame=1&streetChunks=1&cityLook=1' },
];
const MODES = ALL_MODES.filter(m => !process.env.SHADOW_MODES || process.env.SHADOW_MODES.split(',').includes(m.label));
const ONLY = process.env.SHADOW_SPOTS?.split(',').filter(Boolean);

type Spot = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number; model?: string };
export const SHADOW_SPOTS: Spot[] = [
  // The Royal Palace from the Dam (west-south-west: its sun-facing west and south fronts).
  { name: 'palace', target: [4.89260, 52.37300], bearing: 250, distM: 170, altM: 60, targetAltM: 12, model: 'palace-on-the-dam' },
  // Nassaukade 318–300 (chunk face-nassau-162289), the user's near-black block (2026-10-13), from the south-west.
  { name: 'nassaukade', target: [4.87520, 52.36935], bearing: 225, distM: 110, altM: 45, targetAltM: 8, model: 'chunk-face-nassau-162289' },
  // Prinsengracht east bank north of the Westerkerk: canal houses facing west, from across the canal.
  { name: 'prinsengracht', target: [4.88400, 52.37560], bearing: 255, distM: 70, altM: 50, targetAltM: 6 },
  // Nieuw-West slabs (the mood-shots spot) from the west-north-west: sun-facing west walls, shadows cast north-east.
  { name: 'nieuw-west', target: [4.8076, 52.3585], bearing: 300, distM: 160, altM: 60, targetAltM: 10 },
];

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).__sfIdle = 0; });
  await page.waitForFunction(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__sfIdle = idle && landmarksIdle && key === w.__sfKey ? (w.__sfIdle || 0) + 1 : 0;
    w.__sfKey = key;
    return w.__sfIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__sfCamera); });
  await page.waitForTimeout(2500);
}

type Config = 'before' | 'depthFix' | 'after';
const CONFIGS: Config[] = ['before', 'depthFix', 'after'];

/** Page state for one shot: shadows on/off, depth-range fix, fill, which things draw. */
async function stage(page: Page, s: { shadows: boolean; fullDepthRange?: boolean; fill?: number; city?: boolean; model?: string | null }): Promise<void> {
  await page.evaluate(async (s) => {
    const vm = (window as any).canalRecallGame.vectorMap, sf = vm._sharedFrame, map = vm.map;
    sf.setShadows(s.shadows);
    sf.renderer.shadowMap.fullDepthRange = s.fullDepthRange !== false;
    sf.rig.options.shadowIntensity = 1 - (s.fill ?? 0);
    vm._threeBuildings?.setVisible(s.city !== false);
    if (vm._signatureLandmarks) vm._signatureLandmarks.enabled = s.city !== false;
    for (const e of vm._signatureLandmarks?._entries ?? []) e.group.visible = !s.model || e.spec.id !== s.model;
    sf.invalidateShadows();
    for (let i = 0; i < 4; i++) { map.triggerRepaint(); await new Promise(r => requestAnimationFrame(r)); }
  }, s);
  await page.waitForTimeout(400);
}

const lumaOf = (d: Buffer, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
async function rawOf(png: Buffer) { return (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data; }

type Stats = { px: number; shadowShare: number; darkShare: number; shadowLuma: number | null; sunLuma: number; meanLuma: number };

for (const mode of MODES) test(`shadow fill shots: ${mode.label}`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(900_000);
  const dir = join(OUT, mode.label);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: mode.query });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  expect(await page.evaluate(() => !!(window as any).canalRecallGame.vectorMap._sharedFrame)).toBe(true);
  const table: Record<string, unknown> = {};
  for (const spot of SHADOW_SPOTS) {
    if (ONLY && !ONLY.includes(spot.name)) continue;
    const eye = ahead(spot.target, spot.bearing, spot.distM);
    await page.evaluate(({ eye, spot }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__sfCamera = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, spot.altM, { lng: spot.target[0], lat: spot.target[1] }, spot.targetAltM);
      map.jumpTo((window as any).__sfCamera);
    }, { eye, spot });
    await settle(page);
    await page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    const canvas = page.locator('canvas.maplibregl-canvas').first();
    const shot = async (name?: string) => { const png = await canvas.screenshot(); if (name) writeFileSync(join(dir, `${spot.name}-${name}.png`), png); return rawOf(png); };
    await stage(page, { shadows: false });
    const off = await shot('noshadow');
    await stage(page, { shadows: false, city: false });
    const bare = await shot();
    const noModel = spot.model ? (await stage(page, { shadows: false, model: spot.model }), await shot()) : null;
    const on: Record<Config, Buffer> = {} as any;
    for (const config of CONFIGS) {
      await stage(page, { shadows: true, fullDepthRange: config !== 'before', fill: config === 'after' ? SHADOW_FILL : 0 });
      on[config] = await shot(config);
    }
    await stage(page, { shadows: true });
    // Masks: building pixels (streamed city + landmarks), and the named model's own pixels.
    const n = off.length / 3;
    const diff = (a: Buffer, b: Buffer, i: number) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    const masks: Record<string, Uint8Array> = { buildings: new Uint8Array(n) };
    if (noModel) masks.model = new Uint8Array(n);
    for (let k = 0, i = 0; k < n; k++, i += 3) {
      if (diff(off, bare, i) > 9) masks.buildings[k] = 1;
      if (noModel && diff(off, noModel, i) > 9) masks.model[k] = 1;
    }
    const shadowed = (img: Buffer, i: number) => lumaOf(img, i) < lumaOf(off, i) - 6;
    const spotStats: Record<string, Record<Config, Stats>> = {};
    for (const [maskName, mask] of Object.entries(masks)) {
      spotStats[maskName] = {} as Record<Config, Stats>;
      for (const config of CONFIGS) {
        let px = 0, sh = 0, dark = 0, shSum = 0, sunSum = 0, sunN = 0, sum = 0;
        for (let k = 0, i = 0; k < n; k++, i += 3) {
          if (!mask[k]) continue;
          px++;
          const l = lumaOf(on[config], i);
          sum += l;
          if (l < 60) dark++;
          if (shadowed(on[config], i)) { sh++; shSum += l; }
          if (!CONFIGS.some(c => shadowed(on[c], i))) { sunSum += l; sunN++; }
        }
        spotStats[maskName][config] = {
          px, shadowShare: +(sh / Math.max(1, px)).toFixed(3), darkShare: +(dark / Math.max(1, px)).toFixed(3),
          shadowLuma: sh >= 200 ? +(shSum / sh).toFixed(1) : null, sunLuma: +(sunSum / Math.max(1, sunN)).toFixed(1), meanLuma: +(sum / Math.max(1, px)).toFixed(1),
        };
      }
    }
    // Without shadow casting, for the near-black share the fill is compared against.
    for (const [maskName, mask] of Object.entries(masks)) {
      let px = 0, dark = 0;
      for (let k = 0, i = 0; k < n; k++, i += 3) if (mask[k]) { px++; if (lumaOf(off, i) < 60) dark++; }
      (spotStats[maskName] as any).noCastDarkShare = +(dark / Math.max(1, px)).toFixed(3);
    }
    table[spot.name] = spotStats;
    console.log(mode.label, spot.name, JSON.stringify(spotStats));
  }
  writeFileSync(join(dir, 'table.json'), JSON.stringify({ query: mode.query, fill: SHADOW_FILL, table }, null, 1));
  expect(errors).toEqual([]);
  for (const [spot, spotStats] of Object.entries(table) as [string, Record<string, Record<Config, Stats>>][]) {
    for (const [maskName, s] of Object.entries(spotStats)) {
      if (!s.after) continue;
      // The unshadowed pixels do not move.
      expect(Math.abs(s.after.sunLuma - s.before.sunLuma), `${spot}/${maskName} sun side`).toBeLessThanOrEqual(5);
      // Shadowed pixels, where there are enough to measure, stay readable.
      if (s.after.shadowLuma !== null && s.after.px > 5000) expect(s.after.shadowLuma, `${spot}/${maskName} shadow luma`).toBeGreaterThanOrEqual(70);
    }
    // The named models no longer shadow their own sun-facing walls (depth-range regression).
    if (spotStats.model) expect(spotStats.model.after.shadowShare, `${spot} model shadow share`).toBeLessThan(0.15);
  }
});
