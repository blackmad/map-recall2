// Building types runtime (default on since 2026-10-16; `?buildingTypes=0` turns them off): in-game shots and perf, on vs off.
//   BT_RUN=1 BT=1 PW_PORT=4458 npx playwright test building-types-runtime --project=iphone   (the default game)
//   BT_RUN=1 BT=0 ...   (`?buildingTypes=0`: generic extrusions)
// Writes artifacts/building-types/<label>-<view>-<project>.png and perf-<label>-<project>.json.
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

test.skip(!process.env.BT_RUN, 'set BT_RUN=1');
const on = process.env.BT !== '0';
const label = on ? 'types' : 'default';
const pick = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2) });
const VIEWS: Record<string, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  // 2026-10-16 Sloterplas galerijflats (lane/sloterplas-towers-20261016): Burgemeester Hogguerstraat 1-1223, one gallery-slab type x3; galleries face north-east, balconies the lake.
  'sloterplas-galleries': { center: [4.829277, 52.3724985], zoom: 17.2, pitch: 62, bearing: 231 },
  'sloterplas-lake': { center: [4.829277, 52.3724985], zoom: 17.2, pitch: 62, bearing: 51 },
  'sloterplas-close': { center: [4.8280785, 52.3733715], zoom: 18.3, pitch: 60, bearing: 231 },
  'sonderbuur-street': { center: [4.7991, 52.3641], zoom: 17.8, pitch: 62, bearing: 250 },
  'sonderbuur-close': { center: [4.79931801, 52.3639055], zoom: 19.2, pitch: 60, bearing: 72 },
  'comenius-street': { center: [4.8267, 52.3587], zoom: 17.8, pitch: 62, bearing: 270 },
  'comenius-close': { center: [4.82968457, 52.35906528], zoom: 19.2, pitch: 60, bearing: 269 },
  // 2026-10-11 type-1 extension areas: 4-storey brick (Hegelhof/Herderhof) and re-clad 5-storey (Wildeman/Notweg).
  'slotermeer-street': { center: [4.8125, 52.3759], zoom: 17.8, pitch: 62, bearing: 85 },
  'slotermeer-close': { center: [4.81548466, 52.3757425], zoom: 19.2, pitch: 60, bearing: 85 },
  'wildeman-street': { center: [4.7985, 52.3643], zoom: 17.8, pitch: 62, bearing: 252 },
  'wildeman-close': { center: [4.79715, 52.3639873], zoom: 19.2, pitch: 60, bearing: 252 },
  // 2026-10-11 sub-designs (types/nw-subtypes-20261011): A Osdorper Ban / Hooge Venne, B Nieuwenhuysenstraat, C John Lockehof, D Clauskindereweg.
  'osdorper-ban-street': { center: [4.8005, 52.3616], zoom: 17.8, pitch: 62, bearing: 252 },
  'osdorper-ban-close': { center: [4.80057427, 52.36157675], zoom: 19.2, pitch: 60, bearing: 251.6 },
  'nieuwenhuysen-street': { center: [4.8211, 52.3825], zoom: 17.8, pitch: 62, bearing: 284 },
  'nieuwenhuysen-close': { center: [4.82106495, 52.3825187], zoom: 19.2, pitch: 60, bearing: 284.4 },
  'lockehof-street': { center: [4.8112, 52.3768], zoom: 17.8, pitch: 62, bearing: 270 },
  'lockehof-close': { center: [4.8110033, 52.37716495], zoom: 19.2, pitch: 60, bearing: 265.1 },
  'clauskinderen-street': { center: [4.7932, 52.3584], zoom: 17.8, pitch: 62, bearing: 252 },
  'clauskinderen-close': { center: [4.79319306, 52.35836115], zoom: 19.2, pitch: 60, bearing: 251.6 },
  // 2026-10-11 cluster designs (types/nw-clusters-20261011): Cornelis Lelylaan / Van Mourik Broekmanstraat / Pieter Calandlaan, Karel Klinkenbergstraat / Jan Tooropstraat, Ruys de Beerenbrouckstraat / Steven Vennecoolstraat.
  'lelylaan-street': { center: [4.8265, 52.3573], zoom: 17.8, pitch: 62, bearing: 179 },
  'lelylaan-close': { center: [4.82517006, 52.35730167], zoom: 19.2, pitch: 60, bearing: 179 },
  'klinkenberg-street': { center: [4.8360, 52.3668], zoom: 17.8, pitch: 62, bearing: 179 },
  'klinkenberg-close': { center: [4.83530619, 52.36757751], zoom: 19.2, pitch: 60, bearing: 179 },
  'peach-street': { center: [4.7990, 52.3820], zoom: 17.8, pitch: 62, bearing: 178 },
  'peach-close': { center: [4.79879119, 52.38218533], zoom: 19.2, pitch: 60, bearing: 178 },
  // 2026-10-11 terraced houses (types/nw-rowhouse-20261011): A garage door (Joannes de Swaefhof), G door + window (Pieter Calandlaan), B tall glass (Albert Schultenshof), D render + tile plinth (Philip Vingboonsstraat).
  'rowhouse-a-street': { center: [4.804201, 52.350815], zoom: 17.8, pitch: 62, bearing: 252 },
  'rowhouse-a-close': { center: [4.804201, 52.350815], zoom: 19.2, pitch: 60, bearing: 252 },
  'rowhouse-g-street': { center: [4.812304, 52.354326], zoom: 17.8, pitch: 62, bearing: 162 },
  'rowhouse-g-close': { center: [4.812304, 52.354326], zoom: 19.2, pitch: 60, bearing: 162 },
  'rowhouse-b-street': { center: [4.827591, 52.360673], zoom: 17.8, pitch: 62, bearing: 269 },
  'rowhouse-b-close': { center: [4.827591, 52.360673], zoom: 19.2, pitch: 60, bearing: 269 },
  'rowhouse-d-street': { center: [4.797393, 52.383532], zoom: 17.8, pitch: 62, bearing: 88 },
  'rowhouse-d-close': { center: [4.797393, 52.383532], zoom: 19.2, pitch: 60, bearing: 88 },
  // 2026-10-11 terraced houses, second pass (types/nw-rowhouse2-20261011): E1 white sheds (Jacob Tilstraat), B2 tall glazed bay + storage door (Aart van der Leeuwstraat / Louis Couperusstraat), E2 red panel door (Bierens de Haanstraat), K ribbon + fascia (Korte Water), C 3-storey (Hoogheemraadweg), O render + pilasters (Wessel Gansfortstraat).
  'rowhouse-e1-street': { center: [4.80322, 52.373216], zoom: 17.8, pitch: 62, bearing: 207 },
  'rowhouse-e1-close': { center: [4.80322, 52.373216], zoom: 19.2, pitch: 60, bearing: 207 },
  'rowhouse-b2-street': { center: [4.83261, 52.375157], zoom: 17.8, pitch: 62, bearing: 284 },
  'rowhouse-b2-close': { center: [4.83261, 52.375157], zoom: 19.2, pitch: 60, bearing: 284 },
  'rowhouse-e2-street': { center: [4.810727, 52.373712], zoom: 17.8, pitch: 62, bearing: 189 },
  'rowhouse-e2-close': { center: [4.810727, 52.373712], zoom: 19.2, pitch: 60, bearing: 189 },
  'rowhouse-k-close': { center: [4.786899, 52.353549], zoom: 19.2, pitch: 60, bearing: 252 },
  'rowhouse-c-close': { center: [4.782098, 52.356177], zoom: 19.2, pitch: 60, bearing: 252 },
  'rowhouse-o-close': { center: [4.811406, 52.37268], zoom: 19.2, pitch: 60, bearing: 9 },
  // 2026-10-11 post-war flats west of the A10 (types/nw-flats-20261011): D4 garage + white balcony pairs (Dubbelmondehof / Borrendammehof), D1 glazed loggia stacks (Zonzeelstraat white, Ookmeerweg grey), D5 three-storey blue-door portiek (Van Gilsestraat).
  'flats-d4-street': { center: [4.7930, 52.3582], zoom: 17.8, pitch: 62, bearing: 252 },
  'flats-d4-close': { center: [4.79239686, 52.35810205], zoom: 19.2, pitch: 60, bearing: 252 },
  'flats-d1-street': { center: [4.7899, 52.3628], zoom: 17.8, pitch: 62, bearing: 252 },
  'flats-d1-close': { center: [4.7900703, 52.36265335], zoom: 19.2, pitch: 60, bearing: 252 },
  'flats-d1-grey-close': { center: [4.78991098, 52.36308275], zoom: 19.2, pitch: 60, bearing: 162 },
  'flats-d5-street': { center: [4.8258, 52.3813], zoom: 17.8, pitch: 62, bearing: 284 },
  'flats-d5-close': { center: [4.82583041, 52.38126567], zoom: 19.2, pitch: 60, bearing: 284 },
  // 2026-10-25 round 4 (#75): Dichtersbuurt, Gooise Kant, K-buurt-Zuidwest, Buiksloterbreek rows.
  'r4-dichtersbuurt': { center: [4.822176, 52.376410], zoom: 18.4, pitch: 62, bearing: 104 },
  'r4-gooise-kant': { center: [4.968800, 52.313004], zoom: 18.4, pitch: 62, bearing: 330 },
  'r4-k-buurt-zuidwest': { center: [4.981315, 52.312778], zoom: 18.4, pitch: 62, bearing: 61 },
  'r4-buiksloterbreek': { center: [4.907009, 52.402211], zoom: 18.4, pitch: 62, bearing: 142 },
};
const ONLY = process.env.BT_VIEWS?.split(',');
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];

test(`building types ${label}`, async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /Building types|unavailable/.test(m.text())) errors.push(m.text()); });
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false, query: on ? '' : '?buildingTypes=0' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  await page.evaluate((cam) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
    vm._signatureLandmarks.setSuspended?.(false);
  }, CAM);
  const cdp = await page.context().newCDPSession(page);
  const results: Record<string, unknown> = {};
  mkdirSync('artifacts/building-types', { recursive: true });
  for (const [name, cam] of Object.entries(VIEWS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    await page.evaluate((c) => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      map.__jumpTo.call(map, { center: c.center, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing });
    }, cam);
    const t0 = Date.now();
    let last = -1, stable = 0;
    while (Date.now() - t0 < 120_000 && stable < 4) {
      await page.waitForTimeout(2000);
      const n = await page.evaluate(() => { const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks; return l._entries.length * 1000 + l._pending.size; });
      stable = n === last ? stable + 1 : 0; last = n;
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/building-types/${label}-${name}-${info.project.name}.png` });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.name === 'iphone' ? 4 : 1 });
    await page.evaluate(() => {
      const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map;
      const t: Record<string, number[]> = { frame: [], landmarkRender: [], rendererTri: [], rendererCalls: [], renderCalls: [] };
      w.__perf = t; w.__stopFrames = false;
      const layer = vm._signatureLandmarks.layer, orig = layer.render;
      // three.js defines WebGLRenderer.render as an instance property (not on the prototype), and the layer's renderer
      // is private, so renderer.info is unreachable and a prototype patch never fires. Count the GL draws instead:
      // every draw issued while the landmark layer's render() is on the stack (all landmark and building-type meshes,
      // instanced draws multiplied by their instance count).
      let tri = 0, calls = 0, renders = 0, inLayer = false;
      const protos = [WebGLRenderingContext.prototype, (window as any).WebGL2RenderingContext?.prototype].filter(Boolean) as any[];
      const restore: (() => void)[] = [];
      const per = (mode: number, n: number) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
      for (const gp of protos) for (const [fn, instanced] of [['drawElements', false], ['drawArrays', false], ['drawElementsInstanced', true], ['drawArraysInstanced', true], ['drawRangeElements', false]] as const) {
        const o = gp[fn]; if (!o) continue;
        gp[fn] = function (this: any, ...a: number[]) {
          if (inLayer) { calls++; const count = fn === 'drawElements' ? a[1] : fn === 'drawArrays' ? a[2] : fn === 'drawRangeElements' ? a[3] : fn === 'drawElementsInstanced' ? a[1] : a[2]; tri += per(a[0], count) * (instanced ? (fn === 'drawElementsInstanced' ? a[4] : a[3]) : 1); }
          return o.apply(this, a);
        };
        restore.push(() => { gp[fn] = o; });
      }
      layer.render = (...a: unknown[]) => { const s = performance.now(); inLayer = true; renders++; try { return orig.apply(layer, a); } finally { inLayer = false; t.landmarkRender.push(performance.now() - s); } };
      w.__unwrap = [() => { layer.render = orig; }, ...restore];
      let prev = performance.now();
      const tick = (now: number) => { t.frame.push(now - prev); prev = now; t.rendererTri.push(tri); t.rendererCalls.push(calls); t.renderCalls.push(renders); tri = 0; calls = 0; renders = 0; if (!w.__stopFrames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const rep = () => { if (!w.__stopFrames) { map.triggerRepaint(); requestAnimationFrame(rep); } }; rep();
    });
    await page.waitForTimeout(8000);
    const raw = await page.evaluate(() => {
      const w = window as any; w.__stopFrames = true; w.__unwrap.forEach((f: () => void) => f());
      const l = w.canalRecallGame.vectorMap._signatureLandmarks;
      const areas = Object.fromEntries(Object.entries(w.__canalRecallBuildingTypes ?? {}).map(([k, v]: [string, any]) => [k, v.stats()]));
      const skip = 5, mean = (v: number[]) => Math.round(v.slice(skip).reduce((a, b) => a + b, 0) / Math.max(1, v.length - skip));
      return { t: w.__perf, entries: l._entries.map((e: any) => e.spec.id).filter((id: string) => id.startsWith('building-types')), suppressed: l.shownSuppressOsmIds().length, areas, tri: mean(w.__perf.rendererTri), calls: mean(w.__perf.rendererCalls), renders: mean(w.__perf.renderCalls) };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frames = raw.t.frame.slice(5);
    results[name] = { frames: summary(frames), landmarkRender: summary(raw.t.landmarkRender.slice(5)), meanLandmarkLayerTrianglesPerFrame: raw.tri, meanLandmarkLayerDrawCallsPerFrame: raw.calls, meanLandmarkLayerRendersPerFrame: raw.renders, typeEntries: raw.entries, suppressedPands: raw.suppressed, areas: raw.areas };
    console.log('building-types', label, name, JSON.stringify(results[name]));
  }
  writeFileSync(`artifacts/building-types/perf-${label}-${info.project.name}.json`, JSON.stringify({ results, errors }, null, 1));
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
});
