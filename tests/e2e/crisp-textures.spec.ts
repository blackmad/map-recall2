import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { frameSharpness, type Rect } from '../../src/canalRecall/look/sharpness';
import { CRISP_SPOTS } from '../../scripts/look/crispSpots';

// Lane R1-B (#224), crisp textures and rails: frozen frames at the user's spots (S2 Da Costakade windows, S4 Zuidas
// rails) and the rail-look spots, per variant, with the sharpness probe inside each spot's facade band, the facade
// texture MB, the renderer's texture count and the GPU ms of a forced frame. Opt-in:
//   CRISP=1 ENGINE=own BUNDLES_DIR=<scratch> PW_PORT=4641 [CRISP_DPR=2] [CRISP_SPOTS=da-costakade,zuidas-rails] \
//     [CRISP_VARIANTS='before=texturePolicy=0;after='] [CRISP_DIR=artifacts/crisp] \
//     /tmp/canal-pw.sh npx playwright test crisp-textures --project=desktop --workers=1
// Output: <dir>/<project>-<spot>-<variant>.png and <dir>/<project>-results.json. The camera is held (WorldView
// `jumpToLngLat`, the game's sync and aim held) and the HUD is not in the frame (`captureFrame`).
test.skip(!process.env.CRISP, 'set CRISP=1 to measure');

const OUT = process.env.CRISP_DIR || 'artifacts/crisp';
const ONLY = (process.env.CRISP_SPOTS ?? '').split(',').filter(Boolean);
const SPOTS = ONLY.length ? CRISP_SPOTS.filter(s => ONLY.includes(s.name)) : CRISP_SPOTS;
const VARIANTS = (process.env.CRISP_VARIANTS ?? 'before=texturePolicy=0&railStripes=0&railMinPx=0&farRail=0;after=').split(';').filter(Boolean).map(v => {
  const [name, ...query] = v.split('='); return { name, query: query.join('=') };
});
// The tier is forced on desktop (headless may probe low); the phone keeps its own (touch: legacy textures).
const BASE_QUERY = (process.env.CRISP_QUERY ?? 'governor=0').replace(/^[?&]/, '');
if (Number(process.env.CRISP_DPR) > 0) test.use({ deviceScaleFactor: Number(process.env.CRISP_DPR) });

async function settle(page: Page, where: string): Promise<void> {
  let previous = '', stable = 0;
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround, s = vm._completeCity?.status?.(), t = vm._threeBuildings?.stats?.();
      const fading = g ? [...(g.resident?.values?.() ?? [])].filter((r: any) => r.fade).length : 0;
      vm.host?.triggerRepaint?.();
      return { ground: g ? !!g.ready && (g.loadingCells ?? 0) === 0 && fading === 0 : true, inFlight: s?.inFlight ?? 0, queued: s?.queued ?? 0, styling: !!s?.styling, chunks: t?.chunks, vertices: t?.vertices, pending: vm._threeBuildings?.pending?.length ?? 0 };
    });
    const key = JSON.stringify(now);
    const ok = now.ground && !now.inFlight && !now.queued && !now.styling && !now.pending;
    stable = ok && key === previous ? stable + 1 : 0;
    previous = key;
    if (stable >= 2) return;
    await page.waitForTimeout(1000);
  }
  console.warn(`${where}: not settled after 90 s: ${previous}`);
}

/** GPU ms of forced frames (EXT_disjoint_timer_query_webgl2 around the host's render), or wall ms with a finish. */
async function frameMs(page: Page, frames = 24): Promise<{ gpuMs: number | null; wallMs: number }> {
  return page.evaluate(async (n: number) => {
    const vm = (window as any).canalRecallGame.vectorMap, host = vm.host, gl = host.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const gpu: number[] = [], wall: number[] = [], pending: any[] = [];
    const render = host._render.bind(host);
    const px = new Uint8Array(4);
    for (let i = 0; i < n; i++) {
      host.dirty = true;
      const q = ext ? gl.createQuery() : null;
      const t0 = performance.now();
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      render();
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      wall.push(performance.now() - t0);
      await new Promise(r => requestAnimationFrame(r));
    }
    for (let k = 0; k < 60 && pending.length; k++) {
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      }
      await new Promise(r => requestAnimationFrame(r));
    }
    const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    return { gpuMs: gpu.length ? +median(gpu.slice(4)).toFixed(2) : null, wallMs: +median(wall.slice(4)).toFixed(2) };
  }, frames);
}

async function shot(page: Page, spot: typeof CRISP_SPOTS[number]): Promise<Buffer> {
  const pose = { center: spot.center, zoom: spot.zoom, bearing: spot.bearing, pitch: spot.pitch };
  const jump = () => page.evaluate((pose) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.__crispHeld ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, pitch: pose.pitch ?? vm.pitchForViewMode('chase'), elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, pose);
  await jump();
  await settle(page, `${spot.name} first jump`);
  await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.centre && g.ready) { g.residencyAt = null; g.updateResidency(); } });
  await settle(page, `${spot.name} ground re-planned`);
  await jump();
  await settle(page, `${spot.name} second jump`);
  await page.evaluate(() => { const f = (window as any).canalRecallGame.vectorMap._sharedFrame; if (f) { f.anchor = null; f.invalidateShadows?.(); } });
  await page.waitForTimeout(Number(process.env.CRISP_HOLD_MS ?? 4000));
  await settle(page, `${spot.name} hold`);
  const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  expect(url.startsWith('data:image/png;base64,'), 'world canvas captured').toBe(true);
  return Buffer.from(url.split(',')[1], 'base64');
}

for (const variant of VARIANTS) {
  test(`crisp: ${variant.name}`, async ({ page }, info) => {
    test.setTimeout(1_200_000);
    mkdirSync(OUT, { recursive: true });
    const touch = info.project.name === 'iphone';
    const query = [touch ? '' : 'tier=high', BASE_QUERY, variant.query].filter(Boolean).join('&');
    await page.addInitScript(() => { (window as any).__canalRecallChunkFade = false; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?${query}` });
    await page.evaluate(() => { const g = (window as any).canalRecallGame; if (g) { Object.defineProperty(g, '_lastDriveByAt', { configurable: true, get: () => g.raceTime, set: () => {} }); g._clearLandmarkNotice?.(); g.vectorMap?.setActiveLandmark?.(null); } });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    // A throwaway visit first: the first pose of a load otherwise catches the near detail still arriving.
    if (!process.env.CRISP_NO_WARMUP) await shot(page, SPOTS[0]);
    const file = `${OUT}/${info.project.name}-results.json`;
    const results = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    for (const spot of SPOTS) {
      const png = await shot(page, spot);
      writeFileSync(`${OUT}/${info.project.name}-${spot.name}-${variant.name}.png`, png);
      const { data, info: img } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      const s = frameSharpness(data, img.width, img.height, img.channels, spot.band as Rect);
      const state = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, i = vm._sharedFrame?.renderer?.info ?? vm.host?.renderer?.info;
        const perf = (window as any).__canalPerf ?? {};
        const gs = vm._ownGround?.status?.() ?? null;
        const ground = gs ? { ready: gs.ready, visible: gs.visible, blend: gs.blend, basemapHidden: gs.basemapHidden, radiusM: gs.radiusM, cells: Object.keys(gs.cells ?? {}).length, far: gs.far, errors: gs.errors } : null;
        return { ground, tier: perf.tier ?? null, pixelRatio: vm.host?.getPixelRatio?.(), facadeTextureMB: +(t?.stats?.().textureMB ?? 0).toFixed(1), atlas: t?.atlasSource ?? null, textures: i?.memory?.textures ?? null, geometries: i?.memory?.geometries ?? null, cellTier: t?.material?.uniforms?.cellTier?.value ?? null };
      });
      const ms = await frameMs(page);
      (results[spot.name] ??= {})[variant.name] = { errors: errors.slice(-5), query, size: [img.width, img.height], sharpness: { laplacianVar: +s.laplacianVar.toFixed(1), edge: +s.edge.toFixed(2), acutance: +s.acutance.toFixed(1) }, ...state, ...ms };
      console.log(info.project.name, spot.name, variant.name, JSON.stringify(results[spot.name][variant.name]));
      writeFileSync(file, JSON.stringify(results, null, 1));
    }
  });
}
