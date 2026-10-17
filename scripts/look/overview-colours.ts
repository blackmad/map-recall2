/**
 * Colour of the same place at every zoom from the flat overview down to the ride: the descent's colour jump, per class.
 *
 *   PORT=4563 node --import tsx scripts/look/overview-colours.ts --out=artifacts/overview-tiles/before [--qs=?foo=1]
 *     [--spots=canal,park,road] [--zooms=12.5,13,13.5,14,14.5,15,15.6,16,16.5]
 *
 * The rider is held at each spot; the camera looks straight down (plan view, `introOverview` 1) at each map zoom and
 * then rides (`introOverview` 0, the chase pitch). At every frame each sample point (a canal, a lawn, a carriageway,
 * …) is projected with the map and read as the median of a 7×7 px box, and as the mean of a fixed 60 m × 60 m patch
 * round it (the same ground at every zoom). Writes <out>/<spot>-z<zoom>.png, <out>/<spot>-ride.png, <out>/colours.json
 * and prints the table. The jump at a sample is the largest ΔE76 between its overview colour and its ride colour.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, type Page } from 'playwright';

const arg = (n: string, d?: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = arg('out', 'artifacts/overview-tiles/run')!, qs = arg('qs', '')!;
const W = Number(arg('width', '1280')), H = Number(arg('height', '800'));
const port = process.env.PORT || '4563';
fs.mkdirSync(out, { recursive: true });

interface Sample { name: string; cls: 'water' | 'park' | 'road' | 'land' | 'pavement'; lng: number; lat: number }
interface Spot { lng: number; lat: number; bearing: number; label: string; samples: Sample[] }
export const SPOTS: Record<string, Spot> = {
  // Sample points sit on a homogeneous stretch of their class in the own ground (picked from the overview rasters).
  canal: {
    lng: 4.88262, lat: 52.37713, bearing: 95, label: 'Westerstraat / Prinsengracht, Jordaan',
    samples: [{ name: 'Prinsengracht', cls: 'water', lng: 4.884709, lat: 52.376488 }, { name: 'Westerstraat klinker', cls: 'road', lng: 4.882576, lat: 52.377103 }],
  },
  park: {
    lng: 4.86890, lat: 52.35790, bearing: 250, label: 'Vondelpark',
    samples: [{ name: 'Vondelpark lawn', cls: 'park', lng: 4.868106, lat: 52.357296 }],
  },
  road: {
    lng: 4.875035, lat: 52.362616, bearing: 70, label: 'Overtoom',
    samples: [{ name: 'Overtoom asphalt', cls: 'road', lng: 4.87527, lat: 52.362734 }, { name: 'Overtoom pavement', cls: 'pavement', lng: 4.875006, lat: 52.362652 }],
  },
};
const spots = arg('spots', Object.keys(SPOTS).join(','))!.split(',');
const zooms = arg('zooms', '12.5,13,13.5,14,14.5,15,15.6,16,16.5')!.split(',').map(Number);
const PATCH_M = 60;

async function boot(page: Page) {
  await page.addInitScript({ content: 'globalThis.__name = f => f;' });
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.goto(`http://127.0.0.1:${port}/canal-drive/${qs}`);
  await page.waitForFunction(() => (window as any).canalRecallGame?.routePois?.length, null, { timeout: 180_000 });
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.player?.x && g.camera.introOverview === 0; }, null, { timeout: 240_000 });
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  await page.addStyleTag({ content: 'body > *:not(#vector-map):not(#gameCanvas), body > *:not(#vector-map):not(#gameCanvas) * { visibility: hidden !important; }' });
}

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    const pose = {
      x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm,
      y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm,
      angle: Math.atan2(-Math.cos(b), Math.sin(b)),
    };
    const w = window as any;
    if (w.__holdPose) cancelAnimationFrame(w.__holdPose);
    const hold = () => {
      Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 });
      if (w.__tz) { g.camera.zoom = w.__tz.zoom; g.camera.introOverview = w.__tz.overview; }
      w.__holdPose = requestAnimationFrame(hold);
    };
    w.__tz = null;
    hold();
  }, p);
  await page.waitForTimeout(1500);
  await settle(page);
}

async function settle(page: Page) {
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, og = vm._ownGround;
    if (!vm.map.areTilesLoaded()) return false;
    if (!og) return true;
    const s = og.status();
    return s.ready && !s.queued && !Object.keys(s.pending).length;
  }, null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const css = (c: number[]) => `rgb(${c.map(v => Math.round(v)).join(',')})`;
function lab(c: number[]): [number, number, number] {
  const lin = c.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047, Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2], Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export const deltaE = (a: number[], b: number[]) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

async function capture(page: Page, file: string, samples: Sample[]) {
  const pts = await page.evaluate(({ samples, patch }) => {
    const m = (window as any).canalRecallGame.vectorMap.map;
    return samples.map((s: { lng: number; lat: number }) => {
      const p = m.project([s.lng, s.lat]);
      const dLat = patch / 2 / 111320, dLng = patch / 2 / (111320 * Math.cos(s.lat * Math.PI / 180));
      const a = m.project([s.lng - dLng, s.lat + dLat]), b = m.project([s.lng + dLng, s.lat - dLat]);
      // Flat layers drawn over our overview raster at this point (top first): what hides the tiles' colour.
      const order = m.getStyle().layers as { id: string; type: string }[];
      const tilesAt = order.findIndex(l => l.id === 'canal-overview-ground');
      const over = tilesAt < 0 ? [] : [...new Set((m.queryRenderedFeatures([p.x, p.y]) as { layer: { id: string; type: string } }[])
        .filter(f => (f.layer.type === 'fill' || f.layer.type === 'line') && order.findIndex(l => l.id === f.layer.id) > tilesAt).map(f => f.layer.id))];
      return { x: p.x, y: p.y, half: Math.max(1, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2), over };
    });
  }, { samples, patch: PATCH_M });
  const zoom = await page.evaluate(() => +(window as any).canalRecallGame.vectorMap.map.getZoom().toFixed(2));
  const png = await page.screenshot();
  fs.writeFileSync(file, png);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  return {
    zoom, file: path.basename(file),
    samples: pts.map((p, k) => {
      const box: number[][] = [];
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = Math.round(p.x) + dx, y = Math.round(p.y) + dy;
        if (x >= 0 && y >= 0 && x < info.width && y < info.height) box.push(px(x, y));
      }
      const med = [0, 1, 2].map(c => { const v = box.map(b => b[c]).sort((a, b) => a - b); return v[v.length >> 1] ?? 0; });
      const sum = [0, 0, 0]; let n = 0;
      const h = Math.min(p.half, 200);
      for (let y = Math.max(0, Math.round(p.y - h)); y <= Math.min(info.height - 1, Math.round(p.y + h)); y++)
        for (let x = Math.max(0, Math.round(p.x - h)); x <= Math.min(info.width - 1, Math.round(p.x + h)); x++) { const c = px(x, y); sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; n++; }
      return { name: samples[k].name, cls: samples[k].cls, over: p.over, point: med, patch: sum.map(v => Math.round(v / Math.max(1, n))) };
    }),
  };
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
await boot(page);
const report: Record<string, unknown> = { qs, viewport: [W, H], patchM: PATCH_M, spots: {} };
for (const name of spots) {
  const spot = SPOTS[name];
  await teleport(page, spot);
  const playZoom = await page.evaluate(() => (window as any).canalRecallGame.camera.zoom as number);
  const frames: unknown[] = [];
  // Plan view: camera zoom for a map zoom (log2 of the camera zoom plus a constant in plan view).
  await page.evaluate(v => { (window as any).__tz = v; }, { zoom: playZoom * 0.15, overview: 1 });
  await page.waitForTimeout(800);
  for (const z of zooms) {
    const z0 = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getZoom() as number);
    const c0 = await page.evaluate(() => (window as any).canalRecallGame.camera.zoom as number);
    await page.evaluate(v => { (window as any).__tz = v; }, { zoom: c0 * 2 ** (z - z0), overview: 1 });
    await settle(page);
    frames.push(await capture(page, path.join(out, `${name}-z${z}.png`), spot.samples));
  }
  await page.evaluate(v => { (window as any).__tz = v; }, { zoom: playZoom, overview: 0 });
  await settle(page);
  const ride = await capture(page, path.join(out, `${name}-ride.png`), spot.samples);
  frames.push({ ...ride, ride: true });
  await page.evaluate(() => { (window as any).__tz = null; });
  (report.spots as Record<string, unknown>)[name] = { ...spot, playZoom, frames };
  console.log(`\n${spot.label}`);
  for (const f of frames as { zoom: number; ride?: boolean; samples: { name: string; point: number[]; patch: number[]; over: string[] }[] }[]) {
    console.log(`  ${f.ride ? 'ride ' : 'plan '} z${f.zoom.toFixed(2)}  ` + f.samples.map(s => `${s.name}: pt ${css(s.point)} patch ${css(s.patch)}${s.over.length ? ` over tiles: ${s.over.join(',')}` : ''}`).join('  |  '));
  }
  const last = (frames.at(-2) as { samples: { point: number[] }[] }), first = frames[0] as { samples: { point: number[] }[] };
  spot.samples.forEach((s, k) => console.log(`  ΔE76 ${s.name}: z${zooms[0]} vs z${zooms.at(-1)} ${deltaE(first.samples[k].point, last.samples[k].point).toFixed(1)}`));
}
report.errors = errors;
fs.writeFileSync(path.join(out, 'colours.json'), JSON.stringify(report, null, 1));
await browser.close();
