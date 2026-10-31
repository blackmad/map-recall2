import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openRoute } from './helpers';

// Time-to-resident per z14 tile at page start, default tile path vs `?world=v1` (lane L4, issue #136).
// The integrator's A/B saw the default path hold ~6,000 more buildings than world-v1 at its first snapshot:
// the world path made tiles resident later. This records, per tile, ms from navigation to first request and
// to resident (adopted by the streamer), for RUNS interleaved runs of each variant, and the summary per variant.
//   WORLD_AB=1 [WORLD_DIR=...] [BUNDLES_DIR=...] [RUNS=2] PW_PORT=4529 /tmp/canal-pw.sh npx playwright test world-v1-resident --project=desktop --trace off
test.skip(!process.env.WORLD_AB, 'set WORLD_AB=1 to measure');

const OUT = process.env.AB_DIR || 'artifacts/world/resident';
const WORLD_DIR = process.env.WORLD_DIR ? path.resolve(process.env.WORLD_DIR) : null;
const RUNS = Number(process.env.RUNS || 2);
const VARIANTS = [{ name: 'default', query: '' }, { name: 'world', query: '?world=v1' }];

async function serve(page: Page) {
  if (WORLD_DIR) await page.context().route(/\/data\/extracts\/amsterdam\/world-v1\/(.+)$/, route => {
    const rel = /world-v1\/([^?]+)/.exec(route.request().url())![1], file = path.join(WORLD_DIR, rel);
    if (!file.startsWith(WORLD_DIR) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: readFileSync(file), contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  });
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
}

const runs: Record<string, any[]> = { default: [], world: [] };
for (let run = 0; run < RUNS; run++) for (const variant of VARIANTS) {
  test(`resident ${variant.name} #${run + 1}`, async ({ page }) => {
    test.setTimeout(300_000);
    await serve(page);
    await page.addInitScript(() => { (window as any).__canalRecallTrees3d = false; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: variant.query });
    // Idle: the streamer has nothing queued or in flight for 3 polls.
    let quiet = 0;
    await expect.poll(async () => {
      const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCity?.status?.());
      quiet = s && !s.inFlight && !s.queued ? quiet + 1 : 0;
      return quiet >= 3;
    }, { timeout: 120_000, intervals: [1000] }).toBe(true);
    const r = await page.evaluate(() => {
      const city = (window as any).canalRecallGame.vectorMap._completeCity;
      const tiles = [...city.tileTimes.entries()].map(([key, t]: [string, any]) => ({ key, ...t }));
      return { usingWorldCells: !!city.usingWorldCells, tiles, decodeThread: city.world?.decodeThread ?? null, workers: city.world?.workerCount ?? null };
    });
    if (variant.name === 'world') expect(r.usingWorldCells).toBe(true);
    runs[variant.name].push(r);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${variant.name}-${run + 1}.json`, JSON.stringify(r, null, 1));
  });
}

test('resident: compare', async () => {
  const load = (n: string) => runs[n].length ? runs[n] : Array.from({ length: RUNS }, (_, i) => JSON.parse(readFileSync(`${OUT}/${n}-${i + 1}.json`, 'utf8')));
  const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const summary: Record<string, any> = {};
  for (const n of ['default', 'world']) {
    const rs = load(n);
    const resident = (r: any) => r.tiles.filter((t: any) => t.resident !== undefined).sort((a: any, b: any) => a.resident - b.resident);
    const at = (r: any, k: number) => resident(r)[k]?.resident ?? null;
    const buildingsBy = (r: any, ms: number) => resident(r).filter((t: any) => t.resident <= ms).reduce((s: number, t: any) => s + (t.buildings ?? 0), 0);
    summary[n] = {
      firstTileMs: median(rs.map(r => at(r, 0))), fourthTileMs: median(rs.map(r => at(r, 3))), lastTileMs: median(rs.map(r => resident(r).at(-1)?.resident ?? 0)),
      tiles: median(rs.map(r => resident(r).length)),
      requestToResidentMs: median(rs.flatMap(r => resident(r).map((t: any) => t.resident - t.requested))),
      perTile: Object.fromEntries(rs[0].tiles.map((t: any) => [t.key, median(rs.map(r => r.tiles.find((x: any) => x.key === t.key)?.resident ?? NaN).filter(Number.isFinite))])),
      buildingsBy: Object.fromEntries([5000, 8000, 12000, 20000].map(ms => [ms, median(rs.map(r => buildingsBy(r, ms)))])),
    };
  }
  writeFileSync(`${OUT}/compare.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
});
