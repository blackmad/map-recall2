import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';

// `?world=v1` against the default tile path at the world-compiler sentinels (lane L3, issue #130).
// Opt-in measurement until world-v1 is published:
//   WORLD_AB=1 [WORLD_DIR=artifacts/world/staging] [BUNDLES_DIR=dir] PW_PORT=4525 \
//     /tmp/canal-pw.sh npx playwright test world-v1-ab --project=desktop
// WORLD_DIR serves staged cells at /data/extracts/amsterdam/world-v1/ (nothing is published);
// BUNDLES_DIR serves *.bundle.js built from this checkout, for both variants alike.
// Per spot it records: the styled resident features per tile (hash), the three.js layer's stats, the
// screenshot difference, and world-v1 cell decode ms; output under artifacts/world/ab/.
// Per tile it also dumps the resident ids and a hash of each styled feature (ids-<spot>-<variant>.json), and
// compare.json lists, per tile, the ids only in world, only in default, and styled differently.
// First it runs scripts/world/verify.ts on WORLD_DIR: cells compiled from an older extract or older code
// differ for that reason alone (the 2026-10-30 Westerkerk A/B), and that is a compile step, not a runtime bug.
// WORLD_AB_STALE=1 skips that gate (to measure stale cells on purpose).
test.skip(!process.env.WORLD_AB, 'set WORLD_AB=1 to measure');

const OUT = process.env.AB_DIR || 'artifacts/world/ab';
const WORLD_DIR = path.resolve(process.env.WORLD_DIR || 'artifacts/world/staging');
const SPOTS = [
  { name: 'westerkerk', at: [4.8826, 52.3741], face: [4.8843, 52.3746] },
  { name: 'bloemgracht-80', at: [4.8798, 52.3752], face: [4.8809, 52.3750] },
  { name: 'nassaukade', at: [4.8722, 52.3712], face: [4.8732, 52.3722] },
  { name: 'leidsegracht-courtyard', at: [4.8868, 52.3676], face: [4.8884, 52.3686] },
  { name: 'ijburg-edge', at: [5.0185, 52.3512], face: [5.0203, 52.3521] },
] as const;
// AB_SPOTS=westerkerk,nassaukade measures a subset (diagnosis runs).
const SPOT_FILTER = (process.env.AB_SPOTS ?? '').split(',').filter(Boolean);
const RUN_SPOTS = SPOT_FILTER.length ? SPOTS.filter(s => SPOT_FILTER.includes(s.name)) : SPOTS;
// AB_QUERY='&x=1' is added to both variants (e.g. `buildingSource=0`: the default path without MapLibre's copy of the
// buildings, which world-v1 never makes). AB_NOISE=1 adds a second default run: default vs default2 is the noise floor.
const AB_QUERY = (process.env.AB_QUERY ?? '').replace(/^[?&]/, '');
const withQuery = (q: string) => (q || AB_QUERY ? `?${[q.replace(/^\?/, ''), AB_QUERY].filter(Boolean).join('&')}` : '');
const VARIANTS = [{ name: 'default', query: withQuery('') }, { name: 'world', query: withQuery('world=v1') }, ...(process.env.AB_NOISE ? [{ name: 'default2', query: withQuery('') }] : [])];

async function serve(page: Page) {
  // On the context, so a worker's cell fetches are served too.
  await page.context().route(/\/data\/extracts\/amsterdam\/world-v1\/(.+)$/, route => {
    const rel = /world-v1\/([^?]+)/.exec(route.request().url())![1], file = path.join(WORLD_DIR, rel);
    if (!file.startsWith(WORLD_DIR) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: readFileSync(file), contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  });
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
}

async function park(page: Page, at: readonly number[], face: readonly number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at as number[]), b = toWorld(face as number[]);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

/** Streamer idle and the three.js layer done building for two consecutive polls. */
async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings?.stats?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks, t?.vertices, vm._threeBuildings?.pending?.length ?? 0]);
    });
    const ok = now === last && JSON.parse(now)[0] === 0 && JSON.parse(now)[1] === 0;
    last = now;
    return ok;
  }, { timeout: 120_000, intervals: [1500] }).toBe(true);
}

const results: Record<string, any> = {};
test.beforeAll(() => {
  if (process.env.WORLD_AB_STALE) return;
  mkdirSync(OUT, { recursive: true });
  try { execFileSync(process.execPath, ['--import', 'tsx', 'scripts/world/verify.ts', `--dir=${WORLD_DIR}`, `--report=${OUT}/verify.json`], { stdio: 'pipe', timeout: 300_000 }); }
  catch (e: any) { throw Error(`staged cells in ${WORLD_DIR} are not the default path of this checkout (recompile: npm run world:compile -- --out=${WORLD_DIR}):\n${String(e.stdout ?? e).slice(0, 2000)}`); }
});
for (const variant of VARIANTS) {
  test(`world ab: ${variant.name}`, async ({ page }) => {
    test.setTimeout(900_000);
    await serve(page);
    await page.addInitScript(() => { (window as any).__canalRecallTrees3d = false; (window as any).__canalRecallChunkFade = false; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: variant.query });
    mkdirSync(OUT, { recursive: true });
    const spots: Record<string, any> = {};
    for (const spot of RUN_SPOTS) {
      await park(page, spot.at, spot.face);
      await page.waitForTimeout(3000);
      await park(page, spot.at, spot.face);
      await settle(page);
      await park(page, spot.at, spot.face);
      await page.waitForTimeout(800);
      const shot = `${OUT}/${spot.name}-${variant.name}.png`;
      await page.screenshot({ path: shot });
      spots[spot.name] = await page.evaluate((dumpIds: string[]) => {
        const vm = (window as any).canalRecallGame.vectorMap, city = vm._completeCity;
        const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
        const tiles: Record<string, string> = {}, ids: Record<string, [string, string][]> = {}, dumped: Record<string, unknown> = {};
        for (const [key, features] of city.cache.entries()) {
          const styled = features.map((f: any) => city.styled(f));
          tiles[key] = fnv(JSON.stringify(styled));
          ids[key] = styled.map((f: any) => [String(f.properties?.id), fnv(JSON.stringify(f))]);
          for (const f of styled) if (dumpIds.includes(String(f.properties?.id))) dumped[String(f.properties.id)] = f.properties;
        }
        const t = vm._threeBuildings?.stats?.() ?? {};
        return { usingWorldCells: !!city.usingWorldCells, publishing: city.isPublishing, status: city.status(), tiles, ids, three: { chunks: t.chunks, buildings: t.buildings, walls: t.walls, quads: t.quads, vertices: t.vertices, triangles: t.triangles },
          decodeMs: city.world ? Object.fromEntries(city.world.decodeMs) : null, inflateMs: city.world?.inflateMs ? Object.fromEntries(city.world.inflateMs) : null, decodeThread: city.world?.decodeThread ?? null, worldMessages: city.world?.messages ?? null, longestMessageMs: city.world?.longestMessageMs ?? null, dumped };
      }, (process.env.AB_DUMP_IDS ?? '').split(',').filter(Boolean));
      spots[spot.name].shot = shot;
      writeFileSync(`${OUT}/ids-${spot.name}-${variant.name}.json`, JSON.stringify(spots[spot.name].ids));
      delete spots[spot.name].ids;
      // AB_DUMP_IDS=id,id: the styled properties of those buildings, to diff what differs.
      if (Object.keys(spots[spot.name].dumped).length) writeFileSync(`${OUT}/dump-${spot.name}-${variant.name}.json`, JSON.stringify(spots[spot.name].dumped, null, 1));
      delete spots[spot.name].dumped;
    }
    results[variant.name] = spots;
    writeFileSync(`${OUT}/${variant.name}.json`, JSON.stringify(spots, null, 2));
    if (variant.name === 'world') for (const s of Object.values(spots)) expect(s.usingWorldCells, 'world-v1 index served').toBe(true);
  });
}

test('world ab: compare', async () => {
  const read = (n: string) => results[n] ?? JSON.parse(readFileSync(`${OUT}/${n}.json`, 'utf8'));
  const a = read('default'), b = read('world'), rows: Record<string, any> = {};
  for (const spot of RUN_SPOTS) {
    const x = a[spot.name], y = b[spot.name];
    const common = Object.keys(x.tiles).filter(k => k in y.tiles), differing = common.filter(k => x.tiles[k] !== y.tiles[k]);
    const idsA = JSON.parse(readFileSync(`${OUT}/ids-${spot.name}-default.json`, 'utf8')), idsB = JSON.parse(readFileSync(`${OUT}/ids-${spot.name}-world.json`, 'utf8'));
    const perTile: Record<string, any> = {};
    for (const k of differing) {
      const a = new Map<string, string>(idsA[k]), b = new Map<string, string>(idsB[k]);
      const orderA = idsA[k].map((e: string[]) => e[0]).join(), orderB = idsB[k].map((e: string[]) => e[0]).join();
      perTile[k] = { default: a.size, world: b.size, onlyWorld: [...b.keys()].filter(id => !a.has(id)), onlyDefault: [...a.keys()].filter(id => !b.has(id)),
        styledDiffer: [...a.keys()].filter(id => b.has(id) && a.get(id) !== b.get(id)), orderDiffers: orderA !== orderB };
    }
    const [ia, ib] = await Promise.all([x.shot, y.shot].map((f: string) => sharp(f).raw().toBuffer({ resolveWithObject: true })));
    const differ = (p: typeof ia, q: typeof ia) => { let n = 0, over30 = 0; for (let i = 0; i < p.data.length; i += p.info.channels) { const d = Math.abs(p.data[i] - q.data[i]) + Math.abs(p.data[i + 1] - q.data[i + 1]) + Math.abs(p.data[i + 2] - q.data[i + 2]); if (d) n++; if (d > 30) over30++; } return { n, over30 }; };
    const px = differ(ia, ib).n, pxOver30 = differ(ia, ib).over30;
    const noise = process.env.AB_NOISE ? differ(ia, await sharp(read('default2')[spot.name].shot).raw().toBuffer({ resolveWithObject: true })) : null;
    const tiles2 = process.env.AB_NOISE ? read('default2')[spot.name].tiles : null;
    rows[spot.name] = { commonTiles: common.length, tilesOnlyDefault: Object.keys(x.tiles).filter(k => !(k in y.tiles)), tilesOnlyWorld: Object.keys(y.tiles).filter(k => !(k in x.tiles)), tilesWithDifferentFeatures: differing, perTile, threeDefault: x.three, threeWorld: y.three, pixelsDiffering: px, pixelsDifferingOver30: pxOver30, noiseFloor: noise && { pixelsDiffering: noise.n, pixelsDifferingOver30: noise.over30, sameTilesAsDefault: JSON.stringify(Object.keys(tiles2).sort()) === JSON.stringify(Object.keys(x.tiles).sort()), tilesWithDifferentFeatures: Object.keys(x.tiles).filter(k => k in tiles2 && tiles2[k] !== x.tiles[k]) }, pixels: ia.info.width * ia.info.height, decodeMs: y.decodeMs, inflateMs: y.inflateMs, decodeThread: y.decodeThread, worldMessages: y.worldMessages, longestMessageMs: y.longestMessageMs };
  }
  writeFileSync(`${OUT}/compare.json`, JSON.stringify(rows, null, 2));
  const brief = (r: any) => ({ ...r, perTile: Object.fromEntries(Object.entries<any>(r.perTile).map(([k, t]) => [k, { ...t, onlyWorld: t.onlyWorld.length, onlyDefault: t.onlyDefault.length, styledDiffer: t.styledDiffer.length }])) });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, brief(r)])), null, 2));
  for (const [name, r] of Object.entries(rows)) expect(r.tilesWithDifferentFeatures, `${name}: styled features per tile`).toEqual([]);
});
