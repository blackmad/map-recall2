// Before/after ride frames for the BGT plazas (lane bgt-plazas-20261110): load a street ride near a place, put the
// bike at a pose, hold forward for a few seconds, and screenshot at the start and the end, with and without
// `?bgtPlazas=1`. Writes <out>/<label>-<off|on>-{0,1}.png and <out>/frames.json (distance ridden, guard results).
//
//   PW_PORT=4437 bash /tmp/canal-pw.sh npx tsx scripts/routing/bgt-plaza-ride-frames.ts <out-dir>
//
// Needs a dev server on PW_PORT (PORT=4437 npm run dev).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

/** label, [lat, lon] of the bike, heading in compass degrees (0 north, 90 east), seconds of forward. */
export const RIDE_FRAME_PLACES: ReadonlyArray<readonly [string, [number, number], number, number]> = [
  ['asc-sdw-637f346b', [52.385970, 4.832498], 270, 3],
  ['radarweg-4f47f105', [52.387448, 4.833459], 0, 3],
  // Centrum plein: from the Waterlooplein street corridor south-west onto the market square (check-canal-car.ts pin).
  ['waterlooplein', [52.368798, 4.901371], 252, 4],
];

const out = process.argv[2] ?? 'artifacts/bgt-plaza-frames';
const extra = JSON.parse(process.env.EXTRA_PLACES ?? '[]') as Array<[string, [number, number], number, number]>;
const places = [...RIDE_FRAME_PLACES, ...extra];
const port = process.env.PW_PORT ?? '4437';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results: unknown[] = [];
for (const [label, [lat, lon], heading, seconds] of places) {
  for (const flag of ['off', 'on'] as const) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
    const qs = `?travel=car${flag === 'on' ? '&bgtPlazas=1' : ''}`;
    const finish = [lat + 0.004, lon + 0.004];
    await page.goto(`http://127.0.0.1:${port}/canal-drive/${qs}#race=${lat},${lon},${lat},${lon},${finish[0]},${finish[1]}`);
    await page.waitForFunction(() => (window as any).canalRecallGame?.player?.x && (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera.introOverview === 0, null, { timeout: 240_000 });
    const plazaCount = await page.evaluate(() => (window as any).canalRecallGame.track?.plazaIndex?.plazas?.length ?? 0);
    const place = async () => page.evaluate(({ lat, lon, heading }) => {
      const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = heading * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lon - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
      Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    }, { lat, lon, heading });
    await place();
    await page.waitForTimeout(2500);
    await place();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${label}-${flag}-0.png` });
    const where = () => page.evaluate(() => {
      const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
      return { x: g.player.x / ppm, y: g.player.y / ppm, lat: l._lastCenterLat - (g.player.y - l._lastOffsetY) / (111320 * ppm), lng: l._lastCenterLng + (g.player.x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm) };
    });
    const start = await where();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(seconds * 1000);
    await page.keyboard.up('ArrowUp');
    const end = await where();
    await page.screenshot({ path: `${out}/${label}-${flag}-1.png` });
    const metres = Math.hypot(end.x - start.x, end.y - start.y);
    results.push({ label, flag, plazaCount, start, end, metres: Math.round(metres * 10) / 10, errors });
    console.log(label, flag, `plazas ${plazaCount}`, `${metres.toFixed(1)} m in ${seconds} s`, errors.length ? errors : '');
    await page.close();
  }
}
writeFileSync(`${out}/frames.json`, JSON.stringify(results, null, 1));
await browser.close();
