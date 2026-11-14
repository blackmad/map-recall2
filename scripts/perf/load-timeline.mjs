// Load timeline (lane LS, 2026-11-13): a first load of the ride on the default path (MapLibre chase, default world)
// at Geldersekade / Schreierstoren, sampled every --every ms: a frame, what each layer has resident, and every
// response's bytes by layer. Cold cache by default (fresh context); --warm loads twice in one context and records the
// second; --stale <list> loads once, then rewrites the ?v= stamp of the matching URLs (a deploy that changed them)
// and records the second load.
//
//   node scripts/perf/load-timeline.mjs <outDir> [--origin https://rideamsterdam.nl] [--device desktop|iphone]
//     [--secs 60] [--every 1000] [--warm] [--qs 'a=1&b=2'] [--headed] [--probe-only] [--no-shots] [--bundles dir] [--no-route] [--cache] [--spki hash] [--persistent profileDir]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const outDir = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(`--${k}`);
const origin = opt('origin', 'https://rideamsterdam.nl');
const pagePath = opt('page', '/ride');
const device = opt('device', 'desktop');
const secs = Number(opt('secs', '60'));
const every = Number(opt('every', '1000'));
const extraQs = opt('qs', '');
fs.mkdirSync(outDir, { recursive: true });

// Geldersekade by the Schreierstoren, riding south to Nieuwmarkt (#race=lat,lng,startLat,startLng,finishLat,finishLng).
const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const hash = `#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;
const qs = `?travel=car${extraQs ? `&${extraQs}` : ''}`;

// --persistent <dir>: a profile on disk (a player's disk cache). An ephemeral context keeps its HTTP cache in memory,
// where the first load's ~140 MB of data evicts the scripts before a --warm load asks for them again.
const launchOpts = {
  headless: !has('headed'),
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // --spki <hash>: trust deploy-proxy.mjs's self-signed certificate (an --origin https://127.0.0.1:<port> run).
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-precise-memory-info', ...(opt('spki', '') ? [`--ignore-certificate-errors-spki-list=${opt('spki', '')}`] : [])],
};
const ctxOpts = device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1512, height: 862 }, deviceScaleFactor: 2 };
const profile = opt('persistent', '');
const browser = profile ? null : await chromium.launch(launchOpts);
const context = profile ? await chromium.launchPersistentContext(profile, { ...launchOpts, ...ctxOpts }) : await browser.newContext(ctxOpts);
// Playwright disables the HTTP cache for a context with any route (so every repeat of a file downloads again, which a
// real browser would serve from its cache or coalesce). --no-route keeps the cache as a player has it: no Sentry stub
// and no --bundles (the deployed build only).
const noRoute = has('no-route');
if (!noRoute) await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
// --bundles <dir>: serve any /js/<file>.js found in <dir> instead of the deployed one (a source change's before/after);
// the files served from it are counted in the output (workers' bundles included) to show the route took.
const bundles = noRoute ? '' : opt('bundles', '');
const served = {};
if (bundles) await context.route(/\/js\/([\w.-]+\.js)(\?.*)?$/, r => {
  const name = /\/js\/([\w.-]+\.js)/.exec(r.request().url())[1], file = path.join(bundles, name);
  if (!fs.existsSync(file)) return r.continue();
  served[name] = (served[name] || 0) + 1;
  return r.fulfill({ path: file, contentType: 'application/javascript' });
});

const layerOf = u => {
  const p = new URL(u).pathname + (new URL(u).hostname.includes('openfreemap') ? ' ofm' : '');
  if (/ofm$/.test(p)) return /\.pbf| \d+\/\d+\/\d+/.test(u) || /tiles\.openfreemap\.org\/planet/.test(u) ? 'maplibre-vector' : 'maplibre-style';
  if (p.includes('overview-tiles')) return 'overview-raster';
  if (p.includes('building-overview')) return 'building-overview-raster';
  if (p.includes('/world-v1/shells')) return 'world-shells';
  if (p.includes('/world-v1/far')) return 'world-far';
  if (p.includes('/world-v1/')) return 'world-cells';
  if (/ground|elevation|relief|osm-ground|water/.test(p)) return 'ground-data';
  if (/tree/.test(p)) return 'trees';
  if (/landmark|signature|models\//.test(p)) return 'landmarks/models';
  if (/building-tiles|buildings|lod|tiles\//.test(p)) return 'building-tiles';
  if (/\.bundle\.js|\/js\//.test(p)) return 'js';
  if (/\.(png|jpe?g|webp|ktx2)$/.test(p)) return 'images';
  return 'other';
};

async function run(page, label) {
  const net = [];
  // --cache: with routes on, turn the page's HTTP cache back on (CDP Network.setCacheDisabled false) so repeats are
  // served from the cache as a player's are; workers are separate targets and get the same on attach.
  if (has('cache')) {
    const on = async target => { try { const c = await context.newCDPSession(target); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: false }); } catch (_) { /* gone */ } };
    await on(page); page.on('worker', w => { void on(w); });
  }
  const t0 = Date.now();
  page.on('response', async res => {
    const u = res.url(); if (u.startsWith('data:')) return;
    let bytes = Number(res.headers()['content-length'] || 0);
    try { if (!bytes) bytes = (await res.body()).length; } catch (_) { /* aborted */ }
    // Bytes on the wire (CDP encodedDataLength: ~0 for a memory or disk cache hit), so duplicates count real downloads.
    let wire = null; try { const z = await res.request().sizes(); wire = z.responseBodySize + z.responseHeadersSize; } catch (_) { /* aborted */ }
    net.push({ t: Date.now() - t0, url: u.replace(origin, ''), status: res.status(), bytes, wire, fromCache: res.fromServiceWorker() || (res.request().timing?.().responseStart === -1), layer: layerOf(u) });
  });
  // Request times (when each fetch starts), for the load-order question: what waits on what.
  const reqs = [];
  page.on('request', req => { const u = req.url(); if (!u.startsWith('data:')) reqs.push({ t: Date.now() - t0, url: u.replace(origin, ''), layer: layerOf(u) }); });
  await page.goto(`${origin}${pagePath}${qs}${hash}`, { waitUntil: 'commit' });
  const samples = [];
  for (let i = 0; i * every <= secs * 1000; i++) {
    const due = t0 + i * every; const wait = due - Date.now(); if (wait > 0) await page.waitForTimeout(wait);
    const t = Date.now() - t0;
    const probe = await page.evaluate(() => {
      try {
        const g = window.canalRecallGame; if (!g) return { phase: 'no game' };
        const vm = g.vectorMap, m = vm?.map;
        const o = { state: g.state, engine: vm?.engine ?? 'maplibre' };
        if (m) {
          o.zoom = +m.getZoom().toFixed(2); o.pitch = +m.getPitch().toFixed(1);
          const lay = id => { const l = m.getLayer(id); return l ? (m.getLayoutProperty(id, 'visibility') ?? 'visible') : null; };
          o.overviewRaster = lay('canal-overview-ground');
          // Which building layers draw (the first-load states: basemap extrusions, our coloured walls/roofs, none).
          o.layers = {}; for (const id of ['building-3d', 'osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-roofs', 'osm-colored-building-facades']) { const v = lay(id); if (v) o.layers[id] = v; }
          try { o.buildingFilter = m.getLayer('building-3d') ? JSON.stringify(m.getFilter('building-3d') ?? null).slice(0, 80) : null; } catch (_) {}
          try { const src = m.getSource('osm-building-appearance'); o.appearanceLoaded = src ? !!src.loaded?.() : null; } catch (_) {}
          o.flags = { detailed: vm._detailedBuildingsVisible, completeCity: vm._completeCityHasBuildings, measuredOnly: vm._measuredColoursOnly, threeVisible: vm._threeBuildings?.visible ?? null, suppressed: vm._threeBuildings?.suppressedCount?.() ?? null };
          try { o.overviewOpacity = m.getPaintProperty('canal-overview-ground', 'raster-opacity'); o.overviewOpacityNow = m.style?._layers?.['canal-overview-ground']?.paint?.get?.('raster-opacity'); } catch (_) {}
        }
        const og = vm?._ownGround;
        if (og) {
          const lods = {}; for (const r of og.resident?.values?.() ?? []) { const k = `lod${r.lod}${r.detail ? 'd' : ''}`; lods[k] = (lods[k] || 0) + 1; }
          o.ground = { ready: og.ready, resident: og.resident?.size, lods, pending: og.pending?.size, fading: og.fading?.size, wanted: og.wantedKeys?.size, zoom: og.zoom, basemapHidden: og.basemapHidden, enabled: og.enabled };
        }
        o.ownGroundFlag = vm?._ownGroundEnabled;
        const tb = vm?._threeBuildings; if (tb?.chunks) { const k = {}; for (const key of tb.chunks.keys()) { const c = key.split(':')[0]; k[c] = (k[c] || 0) + 1; } o.chunks = k; }
        return o;
      } catch (e) { return { err: String(e) }; }
    }).catch(e => ({ evalErr: String(e).slice(0, 100) }));
    const shot = path.join(outDir, `${label}-${String(Math.round(t / 100) * 100).padStart(6, '0')}.jpg`);
    if (!has('no-shots')) await page.screenshot({ path: shot, type: 'jpeg', quality: 70, scale: 'css' }).catch(() => {});
    samples.push({ t, shot: path.basename(shot), ...probe });
    if (has('probe-only') && i > 3) break;
  }
  // The ground's own startup marks (gameGround.ts `startup`: load, store ready, workers posted and ready, first cell).
  const groundStartup = await page.evaluate(() => { try { const og = window.canalRecallGame?.vectorMap?._ownGround; return og ? { ...og.startup } : null; } catch (e) { return String(e); } }).catch(() => null);
  return { samples, net, reqs, groundStartup };
}

const page = await context.newPage();
const out = {};
// End-of-run pair: the same pose with the overview raster hidden (the crisp basemap / own ground underneath).
async function endPair(pg, label) {
  // Same pose, three grounds: C the own ground (end state), A the overview raster (own ground hidden: what draws while
  // its cells pend or where none is resident), B the recoloured vector basemap (own ground and overview raster hidden).
  await pg.evaluate(p => { const g = window.canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; if (p) g.vectorMap.map.setPitch(p); }, Number(opt('pitch', '0')));
  await pg.waitForTimeout(2500);
  const shot = async n => { await pg.waitForTimeout(1200); await pg.screenshot({ path: path.join(outDir, `${label}-pair-${n}.png`) }); };
  await shot('C-own-ground');
  const info = await pg.evaluate(() => { const vm = window.canalRecallGame.vectorMap, m = vm.map, og = vm._ownGround; og.root.visible = false; vm._setBasemapGroundHidden(false); m.triggerRepaint(); return { zoom: m.getZoom(), pitch: m.getPitch(), center: m.getCenter(), dpr: devicePixelRatio, overview: m.getSource('canal-overview-ground')?.maxzoom }; });
  await shot('A-overview-raster');
  await pg.evaluate(() => { const m = window.canalRecallGame.vectorMap.map; m.setLayoutProperty('canal-overview-ground', 'visibility', 'none'); });
  await shot('B-vector-basemap');
  return info;
}
if (has('warm')) { await run(page, 'prime'); out.warm = await run(await context.newPage(), 'warm'); }
else { out.cold = await run(page, 'cold'); if (has('pair')) out.pair = await endPair(page, 'cold'); }
out.bundles = bundles || null; out.served = served;
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(out, null, 1));
console.log('wrote', outDir);
await (browser ? browser.close() : context.close());
