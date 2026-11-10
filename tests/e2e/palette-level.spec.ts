import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute, settleWorld } from './helpers';
import { CRISP_SPOTS } from '../../scripts/look/crispSpots';

// Lane palette-level (2026-11-09): opt-in measurement of the rendered generic wall.
//   PALETTE_LEVEL=transfer: overwrite the `tint` attribute of every facade chunk with each test tint in turn (the GPU copy is the
//     only one; the CPU array is freed after upload), capture the same frame, and read the wall pixels (those that answer to
//     the tint) split into the sun side and the shade side. Writes <dir>/transfer.json: tint -> {sun, shade} sRGB medians.
//   PALETTE_LEVEL=strips: frames at the 12 generic-gap spots, the two user poses and a landmark, per variant
//     (PALETTE_VARIANTS='before=paletteLevel=0;after='), to <dir>/<spot>-<variant>.png and <dir>/walls.json (wall medians).
// PW_PORT=4751 PALETTE_LEVEL=transfer /tmp/canal-pw.sh npx playwright test palette-level --project=desktop --workers=1
test.skip(!process.env.PALETTE_LEVEL, 'set PALETTE_LEVEL=transfer|strips');
const OUT = process.env.PALETTE_DIR || 'artifacts/palette-level';
const MODE = process.env.PALETTE_LEVEL;
const TINTS = ['#40261f', '#5b362b', '#7b3a2f', '#9a5846', '#b05a40', '#c58b5e', '#d3b184', '#b0756d', '#6f6f6f', '#9b9a98', '#858687', '#e5dfd1', '#efe7e0', '#8c4a38', '#ffffff', '#000000'];

type Spot = { name: string; center: [number, number]; zoom: number; bearing: number; pitch: number | null; viewport?: [number, number] };
const GAP: Spot[] = JSON.parse(readFileSync('scripts/look/generic-gap-spots.json', 'utf8')).map((s: any) => ({ name: s.slug.replace(/[^a-z0-9-]/g, ''), center: [s.lng, s.lat] as [number, number], zoom: 17.8, bearing: s.bearing, pitch: null }));
const SPOTS: Spot[] = [
  ...GAP,
  ...CRISP_SPOTS.filter(s => s.name === 'da-costakade-user' || s.name === 'westerkerk').map(s => ({ name: s.name, center: s.center, zoom: s.zoom, bearing: s.bearing, pitch: s.pitch, viewport: s.viewport })),
  { name: 's3-slab-user', center: [4.906301, 52.363845], zoom: 18.28, bearing: -16.8, pitch: 74.7, viewport: [1448, 657] },
];

async function settle(page: Page, where: string) { await settleWorld(page, where); }
let DEFAULT_VIEWPORT: { width: number; height: number } | null = null;

async function pose(page: Page, spot: Spot, hold = 3000) {
  const want = spot.viewport ? { width: spot.viewport[0], height: spot.viewport[1] } : DEFAULT_VIEWPORT;
  const have = page.viewportSize();
  if (want && (have?.width !== want.width || have?.height !== want.height)) { await page.setViewportSize(want); await page.waitForTimeout(1000); }
  const p = { center: spot.center, zoom: spot.zoom, bearing: spot.bearing, pitch: spot.pitch };
  const jump = () => page.evaluate((p) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.__crispHeld ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...p, pitch: p.pitch ?? vm.pitchForViewMode('chase'), elevation: g?.ready ? g.heightAt(p.center) : 0 });
  }, p);
  await jump(); await settle(page, `${spot.name} first`);
  await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.centre && g.ready) { g.residencyAt = null; g.updateResidency(); } });
  await settle(page, `${spot.name} ground`);
  await jump(); await settle(page, `${spot.name} second`);
  await expect.poll(() => page.evaluate(() => !(window as any).canalRecallGame.vectorMap._threeBuildings?.cellRolloffPending), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => { const f = (window as any).canalRecallGame.vectorMap._sharedFrame; if (f) { f.anchor = null; f.invalidateShadows?.(); } });
  await page.waitForTimeout(hold);
  await settle(page, `${spot.name} hold`);
}

async function capture(page: Page): Promise<Buffer> {
  const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  expect(url.startsWith('data:image/png;base64,')).toBe(true);
  return Buffer.from(url.split(',')[1], 'base64');
}

async function boot(page: Page, query: string) {
  await page.addInitScript(() => { (window as any).__canalRecallChunkFade = false; });
  DEFAULT_VIEWPORT ??= page.viewportSize();
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?${query}` });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; if (g) { Object.defineProperty(g, '_lastDriveByAt', { configurable: true, get: () => g.raceTime, set: () => {} }); g._clearLandmarkNotice?.(); g.vectorMap?.setActiveLandmark?.(null); } });
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('palette-level: transfer', async ({ page }) => {
  test.skip(MODE !== 'transfer');
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  await boot(page, 'tier=high&governor=0' + (process.env.PALETTE_QUERY ? '&' + process.env.PALETTE_QUERY : ''));
  const spot = SPOTS.find(s => s.name === (process.env.PALETTE_TRANSFER_SPOT ?? 'tichelstraat'))!;
  await pose(page, spot);
  const frames: Record<string, { data: Buffer; w: number; h: number; ch: number }> = {};
  for (const hex of TINTS) {
    const meshes: number = await page.evaluate((hex) => {
      const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      let n = 0;
      for (const e of tb.chunks.values()) {
        const a = e.mesh?.geometry?.getAttribute?.('tint'); if (!a) continue;
        const arr = new Uint8Array(a.count * 4); for (let i = 0; i < a.count; i++) { arr[i * 4] = v[0]; arr[i * 4 + 1] = v[1]; arr[i * 4 + 2] = v[2]; arr[i * 4 + 3] = 255; }
        a.array = arr; a.needsUpdate = true; n++;
      }
      (window as any).canalRecallGame.vectorMap._sharedFrame?.invalidateShadows?.();
      return n;
    }, hex);
    expect(meshes, 'facade chunks overwritten').toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    const png = await capture(page);
    writeFileSync(`${OUT}/transfer-${hex.slice(1)}.png`, png);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    frames[hex] = { data, w: info.width, h: info.height, ch: info.channels };
    console.log('tint', hex, 'meshes', meshes);
  }
  const white = frames['#ffffff'], black = frames['#000000'], n = white.w * white.h, ch = white.ch;
  // Wall pixels answer to the tint (white vs black differ); split sun/shade by Otsu on the white frame's luma.
  const idx: number[] = [], lumaW: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = Math.abs(white.data[i * ch] - black.data[i * ch]) + Math.abs(white.data[i * ch + 1] - black.data[i * ch + 1]) + Math.abs(white.data[i * ch + 2] - black.data[i * ch + 2]);
    if (d > 150) { idx.push(i); lumaW.push(luma(white.data[i * ch], white.data[i * ch + 1], white.data[i * ch + 2])); }
  }
  let best = 0, thr = 128; const hist = new Array(256).fill(0); for (const l of lumaW) hist[Math.min(255, Math.round(l))]++;
  const tot = lumaW.length; let sumAll = 0; for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0, sB = 0; for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB || wB === tot) continue; sB += t * hist[t]; const mB = sB / wB, mF = (sumAll - sB) / (tot - wB), v = wB * (tot - wB) * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  const sunIdx = idx.filter((_, k) => lumaW[k] > thr), shadeIdx = idx.filter((_, k) => lumaW[k] <= thr);
  const rows: Record<string, any> = {};
  for (const hex of TINTS) {
    const f = frames[hex];
    const med = (ix: number[]) => [0, 1, 2].map(c => median(ix.map(i => f.data[i * ch + c])));
    rows[hex] = { sun: med(sunIdx), shade: med(shadeIdx) };
  }
  writeFileSync(`${OUT}/transfer.json`, JSON.stringify({ spot: spot.name, thr, wallPixels: idx.length, sunPixels: sunIdx.length, shadePixels: shadeIdx.length, rows }, null, 1));
  console.log('transfer', JSON.stringify({ thr, wall: idx.length, sun: sunIdx.length, shade: shadeIdx.length }));
});

test('palette-level: strips', async ({ page }) => {
  test.skip(MODE !== 'strips');
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  const variants = (process.env.PALETTE_VARIANTS ?? 'before=paletteLevel=0;after=').split(';').filter(Boolean).map(v => { const [name, ...q] = v.split('='); return { name, query: q.join('=') }; });
  const only = (process.env.PALETTE_SPOTS ?? '').split(',').filter(Boolean);
  const spots = only.length ? SPOTS.filter(s => only.includes(s.name)) : SPOTS;
  const results: Record<string, any> = {};
  for (const variant of variants) {
    // One page load per variant: the flag is read at boot.
    await page.goto('about:blank');
    await boot(page, ['tier=high', 'governor=0', variant.query].filter(Boolean).join('&'));
    await pose(page, spots[0], 1000);
    for (const spot of spots) {
      await pose(page, spot);
      const png = await capture(page);
      writeFileSync(`${OUT}/${spot.name}-${variant.name}.png`, png);
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      // Warm-hued mid-lower frame: median RGB of the brightest-half pixels of the facade band (rows 30-90 %), as a brightness/hue reading.
      const ch = info.channels, px: number[][] = [];
      for (let y = Math.floor(info.height * 0.3); y < Math.floor(info.height * 0.9); y += 2) for (let x = 0; x < info.width; x += 2) { const i = (y * info.width + x) * ch; px.push([data[i], data[i + 1], data[i + 2]]); }
      (results[spot.name] ??= {})[variant.name] = { meanLuma: +(px.reduce((s, p) => s + luma(p[0], p[1], p[2]), 0) / px.length).toFixed(2), medianRGB: [0, 1, 2].map(c => median(px.map(p => p[c]))) };
      console.log(spot.name, variant.name, JSON.stringify(results[spot.name][variant.name]));
      writeFileSync(`${OUT}/walls.json`, JSON.stringify(results, null, 1));
    }
  }
});
