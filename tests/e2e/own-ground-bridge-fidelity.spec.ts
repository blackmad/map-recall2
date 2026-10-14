import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { bridgesFromExtract, type Bridge } from './ownGroundBridges';

// Named bridge-fidelity regressions on the own ground (`?ownGround=1`), lane bridge-fidelity 2026-10-14.
// Opt-in, needs the GPU and the network basemap:
//   OWN_GROUND=1 PW_PORT=4510 npx playwright test own-ground-bridge-fidelity --project=desktop
// Pixel checks: each view is shot twice, with and without the deckBody meshes; the difference is the bridge kit's own
// mask. Arches are drawn when a row through the lower half of the mask has an opening between body runs; the deck is
// humped when the mask's top edge at the middle of the span stands over its top edge at the ends.
//   - the Seven Bridges down the Reguliersgracht from the Herengracht corner (BRU0031 … BRU0072)
//   - the Torensluis (BRU0009) from the Singel
//   - the bascules: the Magere Brug (portals), the Haarlemmerpoort pair Willemsbrug / Bullebak and the Zoutkeetsgracht
//     bridge (BRU0345; basement bascules: signal masts, no portal); user screenshots 2026-10-14
//   - the Houthavens footbridges BRU2433-2435 (user 2026-10-14 "disconnected bridge"): both ends on land
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-bridge-fidelity';
const SEVEN = ['BRU0031', 'BRU0032', 'BRU0039', 'BRU0074', 'BRU0073', 'BRU0072'];

const offset = (b: { lng: number; lat: number }, east: number, north: number): [number, number] =>
  [b.lng + east / (111320 * Math.cos(b.lat * Math.PI / 180)), b.lat + north / 111320];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  // Only the map scene: the HUD cards come and go between the paired shots; the rider is hidden too.
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #vector-map, #vector-map * { visibility: visible !important; }' });
  await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    for (const k of ['setPlayerBike', 'setPlayerBoat', 'setPlayerFerry', 'setPlayerTransit']) {
      const orig = vm[k]?.bind(vm);
      if (orig) vm[k] = (player: unknown, loader: unknown, _visible: boolean, ...rest: unknown[]) => orig(player, loader, false, ...rest);
    }
  });
  return errors;
}

async function teleport(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
}

async function settle(page: Page): Promise<void> {
  await expect.poll(async () => {
    const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(4000);
}

/** Freeze the camera at `from` (`up` m over the water there, or over the ground) looking at `to` (`toUp` m over the ground). */
async function lookFrom(page: Page, from: [number, number], up: number, to: [number, number], toUp: number, onWater = true): Promise<void> {
  // The rider (hidden, boot) stands on the target, so the bridge's cells are in the near ring (LOD 0).
  const me = (from[0] - to[0]) * Math.cos(from[1] * Math.PI / 180), mn = from[1] - to[1];
  await teleport(page, to[0], to[1], (Math.atan2(-me, -mn) * 180 / Math.PI + 360) % 360);
  await settle(page);
  await page.evaluate(({ from, up, to, toUp, onWater }) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, (onWater ? ground.waterLevelAt(from) : ground.heightAt(from)) + up, to, ground.heightAt(to) + toUp));
    map.triggerRepaint();
  }, { from, up, to, toUp, onWater });
  await page.waitForTimeout(1500);
}

/** The bridge kit's pixels: the shot with deckBody hidden against the shot with it. */
async function kitMask(page: Page, file: string): Promise<{ mask: Uint8Array; width: number; height: number; count: number; rg: Int16Array }> {
  const shot = async () => sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const toggle = (show: boolean) => page.evaluate(show => {
    const vm = (window as any).canalRecallGame.vectorMap, ground = vm._ownGround;
    for (const r of ground.resident.values()) r.group.traverse((o: any) => { if (o.isMesh && o.name === 'deckBody') o.visible = show; });
    vm.map.triggerRepaint();
  }, show);
  const on = await shot();
  await page.screenshot({ path: file });
  await toggle(false); await page.waitForTimeout(800);
  const off = await shot();
  await toggle(true); await page.waitForTimeout(300);
  const { width, height } = on.info, mask = new Uint8Array(width * height), rg = new Int16Array(width * height);
  let count = 0;
  for (let i = 0; i < width * height; i++) {
    const d = Math.abs(on.data[i * 3] - off.data[i * 3]) + Math.abs(on.data[i * 3 + 1] - off.data[i * 3 + 1]) + Math.abs(on.data[i * 3 + 2] - off.data[i * 3 + 2]);
    // The HUD's top row (score, target, compass) is out of the scene.
    if (d > 40 && i / width >= 120) { mask[i] = 1; rg[i] = on.data[i * 3] - on.data[i * 3 + 1]; count++; }
  }
  return { mask, width, height, count, rg };
}

/** Screen columns of a bridge's deck-span ends (the side view's own bridge, not a neighbour further down the canal). */
async function spanColumns(page: Page, b: Bridge): Promise<[number, number]> {
  return page.evaluate(({ b }) => {
    const map = (window as any).canalRecallGame.vectorMap.map, left = map.getContainer().getBoundingClientRect().left;
    const rad = b.bearing * Math.PI / 180, mLng = 111320 * Math.cos(b.lat * Math.PI / 180), h = b.lengthM / 2;
    const xs = [-1, 1].map(s => map.project([b.lng + Math.sin(rad) * s * h / mLng, b.lat + Math.cos(rad) * s * h / 111320]).x + left);
    return [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))] as [number, number];
  }, { b });
}

/**
 * Openings: most body-gap-body patterns in one row of the lower part of the mask (the arches), and the hump.
 * `cols`: the deck span's screen columns (spanColumns); the hump is read between them.
 */
function readMask(m: { mask: Uint8Array; width: number; height: number; rg: Int16Array }, cols?: [number, number]): { openings: number; humpPx: number; bbox: number[]; span?: number[] } {
  let x0 = m.width, x1 = -1, y0 = m.height, y1 = -1;
  const colCount = new Array(m.width).fill(0);
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.mask[y * m.width + x]) colCount[x]++;
  // The bridge's extent: columns with a solid run (lone railing pixels do not count).
  for (let x = 0; x < m.width; x++) if (colCount[x] > 6) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  for (let y = 0; y < m.height; y++) for (let x = x0; x <= x1; x++) if (m.mask[y * m.width + x]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let openings = 0;
  for (let y = Math.round(y0 + (y1 - y0) * 0.45); y <= y1 - 2; y += 2) {
    // A body pixel is the kit's face: in the mask and as red as the row's face (spandrel brick, stone and steel all sit
    // redder than the shadowed vault under an arch, seen through the opening).
    const reds: number[] = [];
    for (let x = x0; x <= x1; x++) if (m.mask[y * m.width + x]) reds.push(m.rg[y * m.width + x]);
    reds.sort((a, b) => a - b);
    const faceRed = reds.length ? reds[Math.floor(reds.length * 0.75)] : 0;
    const runs: [number, number][] = [];
    let s = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const k = y * m.width + x, on = x <= x1 && m.mask[k] === 1 && (faceRed < 12 || m.rg[k] > faceRed * 0.7);
      if (on && s < 0) s = x; else if (!on && s >= 0) { if (x - s >= 3) runs.push([s, x - 1]); s = -1; }
    }
    // Gaps of at least 8 px between body runs.
    let gaps = 0;
    for (let i = 1; i < runs.length; i++) if (runs[i][0] - runs[i - 1][1] > 8) gaps++;
    openings = Math.max(openings, gaps);
  }
  // Top edge of the solid body (6 px of mask below it, so a rail is not body) per column; the hump is the ends' mean
  // minus the middle, each the median of a band of columns, between the deck span's columns when given. Single columns
  // let a railing post top set the middle and the next bridge down the Singel set the right end: the Torensluis read
  // 28 px on its lane and -12 px on main (2026-10-14) from byte-identical deck meshes, once main's shots carried an
  // orange-outlined figure on the crown and orange streaks at the deck ends that differ between the paired shots.
  const top = (x: number) => { for (let y = 0; y < m.height - 6; y++) { let k = 0; while (k < 6 && m.mask[(y + k) * m.width + x]) k++; if (k === 6) return y; } return m.height; };
  const [h0, h1] = cols ? [Math.max(x0, cols[0]), Math.min(x1, cols[1])] : [x0, x1], span = h1 - h0;
  const band = (a: number, b: number) => { const v: number[] = []; for (let x = Math.round(h0 + span * a); x <= Math.round(h0 + span * b); x++) v.push(top(x)); v.sort((p, q) => p - q); return v[v.length >> 1]; };
  const ends = [band(0.04, 0.14), band(0.86, 0.96)], mid = band(0.4, 0.6);
  return { openings, humpPx: (ends[0] + ends[1]) / 2 - mid, bbox: [x0, y0, x1, y1], ...(cols ? { span: [h0, h1, ends[0], mid, ends[1]] } : {}) };
}

test('bridge fidelity: arches, humps, bascules and landed ends', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const report: Record<string, unknown> = {};
  const P = info.project.name;
  const save = () => writeFileSync(`${OUT}/${P}-report.json`, JSON.stringify(report, null, 1));

  // 1. The Seven Bridges: from the Herengracht corner down the Reguliersgracht.
  const seven = bridgesFromExtract(SEVEN), first = seven[0], last = seven[seven.length - 1];
  const de = (last.lng - first.lng) * Math.cos(first.lat * Math.PI / 180), dn = last.lat - first.lat, dl = Math.hypot(de, dn);
  const ue = de / dl, un = dn / dl;
  await lookFrom(page, offset(first, -ue * 30, -un * 30), 1.2, [first.lng, first.lat], -0.5);
  const sm = await kitMask(page, `${OUT}/${P}-seven-bridges.png`), sr = readMask(sm);
  report.sevenBridges = { pixels: sm.count, ...sr }; save();
  expect(sm.count, 'Seven Bridges drawn').toBeGreaterThan(5000);
  expect(sr.openings, 'an arch opening down the Reguliersgracht').toBeGreaterThanOrEqual(1);
  expect(sr.humpPx, 'the first bridge humped').toBeGreaterThan(3);

  // 2. Side views from the water: the Torensluis from the Singel; BRU0073, BRU0038 and the Blauwbrug for reference.
  const side: { id: string; arches: number; across: number; bearing?: number; flat?: boolean }[] = [
    { id: 'BRU0009', arches: 3, across: 48, bearing: 104 }, { id: 'BRU0073', arches: 1, across: 26 }, { id: 'BRU0038', arches: 3, across: 30 }, { id: 'BRU0236', arches: 3, across: 40, flat: true },
  ];
  for (const s of side) {
    const [b] = bridgesFromExtract([s.id]) as Bridge[];
    if (s.bearing !== undefined) b.bearing = s.bearing;
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    // Across the axis: the right-hand normal in the east-north frame is (uy, -ux).
    await lookFrom(page, offset(b, uy * s.across, -ux * s.across), 1.2, [b.lng, b.lat], -1.0);
    const cols = await spanColumns(page, b);
    const m = await kitMask(page, `${OUT}/${P}-${s.id}-side.png`), r = readMask(m, cols);
    report[s.id] = { pixels: m.count, ...r }; save();
    expect(r.openings, `${s.id} arches drawn`).toBeGreaterThanOrEqual(s.arches);
    // The Blauwbrug's deck is nearly level (a 0.3 m rise over 40 m): no hump check there.
    // The pixel hump reading gave two false alarms on 2026-10-14 (a railing post, then the brighter ground look
    // moving BRU0038 from +11 to -9 px); the deck crowns are pinned in metres in test:own-ground, so this is a
    // warning until the reading comes from the own-ground store's deck geometry (board, P1 bridges).
    if (!s.flat && !(r.humpPx > 2)) console.warn(`${s.id} deck hump reads ${r.humpPx} px from pixels (geometry pinned in test:own-ground)`);
  }

  // 3. Bascules: the kit stands over the deck (portals or signal masts), seen from the approach at 1.7 m.
  for (const id of ['BRU0242', 'BRU0151', 'BRU0149', 'BRU0345']) {
    const [b] = bridgesFromExtract([id]) as Bridge[];
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad), back = b.lengthM / 2 + 25;
    await lookFrom(page, offset(b, -ux * back + uy * 3, -uy * back - ux * 3), 1.7, [b.lng, b.lat], 2.0, false);
    const m = await kitMask(page, `${OUT}/${P}-${id}-approach.png`), r = readMask(m);
    report[id] = { pixels: m.count, bbox: r.bbox }; save();
    // The horizon at eye height sits mid-frame: the kit reaches well over it.
    expect(r.bbox[1], `${id}: portal or masts over the deck`).toBeLessThan(m.height * 0.42);
  }

  // 4. The Houthavens footbridges land on both banks: the ground layer 1.5 m past each deck end is not water.
  for (const b of bridgesFromExtract(['BRU2433', 'BRU2434', 'BRU2435'])) {
    await teleport(page, b.lng, b.lat, b.bearing);
    await settle(page);
    const ends = await page.evaluate(({ b }) => {
      const ground = (window as any).canalRecallGame.vectorMap._ownGround, api = (window as any).CanalRecallOwnGround;
      const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad), mLng = 111320 * Math.cos(b.lat * Math.PI / 180);
      return [-1, 1].map(sgn => {
        const s = sgn * (b.lengthM / 2 + 1.5), lngLat: [number, number] = [b.lng + ux * s / mLng, b.lat + uy * s / 111320];
        const [x, y] = api.toLocal(lngLat[0], lngLat[1]), hit = ground.layersAt(x, y);
        return { top: hit.top, z: hit.hits.find((h: any) => !h.cut && h.layer !== 'water')?.z ?? null, water: ground.waterLevelAt(lngLat) };
      });
    }, { b });
    report[b.id] = ends; save();
    for (const e of ends) expect(e.top, `${b.id}: an end over water`).not.toBeNull();
  }
  expect(errors).toEqual([]);
});
