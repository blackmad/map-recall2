import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

// Street-survey retirement shots (docs/handoffs/lane-street-survey-retire-20261013.md): the user's Singelgracht
// angle (aerial from the south-west over the Nassaukade 300–318 block, Marnixstraat towers beyond), a
// Bilderdijkstraat chase-height view and De Clercqstraat, per mode.
//
//   SS_MODES='default:,chunks:?streetChunks=1' PW_PORT=4463 npx playwright test street-survey-retire --project=desktop
//
// Writes `<SS_OUT>/<mode>/<view>.png` and `entries.json` (which ordinary/street-survey models were drawn, their
// materials and lights) so a dark model can be diagnosed from the run. Regression: by default no street-survey model
// is drawn at the Nassaukade 300–318 block (the user's near-black chunk, 2026-10-13); `?streetChunks=1` draws it.
// Diagnostics: SS_EVAL / SS_EVAL_FILE (page script run before each shot, its result kept in entries.json),
// SS_PROJECT=iphone, SS_HEAVY=1 (keep the 3DBAG tiles), SS_GPU=1 (ANGLE/Metal), SS_VIEWS=a,b (incl. the controls).
const OUT = process.env.SS_OUT || 'artifacts/street-survey-retire';
const MODES = (process.env.SS_MODES || 'default:,chunks:?streetChunks=1')
  .split(',').map(s => { const i = s.indexOf(':'); return { label: s.slice(0, i), query: s.slice(i + 1) }; });

type View = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number };
const VIEWS: View[] = [
  // The user's screenshot: Nassaukade 318–300 (chunk face-nassau-162289) from the south-west, high.
  { name: 'singelgracht', target: [4.87545, 52.36945], bearing: 225, distM: 230, altM: 110, targetAltM: 8 },
  { name: 'singelgracht-close', target: [4.87520, 52.36935], bearing: 225, distM: 110, altM: 45, targetAltM: 8 },
  // The canal fronts of the same block, from across the Singelgracht.
  { name: 'nassau-front', target: [4.87520, 52.36935], bearing: 60, distM: 110, altM: 25, targetAltM: 8 },
  // Bilderdijkstraat at chase height, looking north-north-west between the even-side faces and the odd side.
  { name: 'bilderdijk', target: [4.87122, 52.36861], bearing: 157, distM: 90, altM: 10, targetAltM: 6 },
  // De Clercqstraat 22–2 (chunk face-clercq-236681), chase height from the east, looking down the street.
  { name: 'clercq', target: [4.873038, 52.371671], bearing: 69, distM: 90, altM: 9, targetAltM: 6 },
  // The blank west end wall of the same face from the Nassaukade (tree shadows fall on it in the shared frame).
  { name: 'clercq-end', target: [4.87345, 52.37177], bearing: 250, distM: 80, altM: 12, targetAltM: 8 },
];
// Controls for the shared-frame self-shadow check (only when named in SS_VIEWS): a landmark GLB and the Dam.
const EXTRA: View[] = [
  { name: 'westerkerk', target: [4.88390, 52.37450], bearing: 200, distM: 140, altM: 45, targetAltM: 15 },
  { name: 'dam', target: [4.89260, 52.37300], bearing: 250, distM: 170, altM: 60, targetAltM: 12 },
];
const ONLY = process.env.SS_VIEWS?.split(',');
if (ONLY) VIEWS.push(...EXTRA.filter(v => ONLY.includes(v.name)));
// SS_GPU=1: the machine's GPU through ANGLE/Metal instead of SwiftShader (a dark model may be GPU-specific).
if (process.env.SS_GPU) test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false'] } });

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks, r = vm._tileBuildings;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const rs = r?.stats?.();
    const tilesIdle = !rs || (!rs.loading && rs.ready === rs.tiles.length);
    const key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}|${rs?.ready ?? -1}`;
    w.__ssIdle = idle && landmarksIdle && tilesIdle && key === w.__ssKey ? (w.__ssIdle || 0) + 1 : 0;
    w.__ssKey = key;
    return w.__ssIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__ssCamera); });
  await page.waitForTimeout(3000);
}

for (const mode of MODES) test(`street-survey shots: ${mode.label}`, async ({ page }, info) => {
  test.skip(info.project.name !== (process.env.SS_PROJECT || 'desktop'), 'one project per run (SS_PROJECT)');
  test.setTimeout(900_000);
  const dir = join(OUT, info.project.name === 'desktop' ? mode.label : `${mode.label}-${info.project.name}`);
  mkdirSync(dir, { recursive: true });
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: !process.env.SS_HEAVY, enterRacing: false, query: mode.query });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const diag: Record<string, unknown> = {};
  diag.gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null; const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null; });
  for (const view of VIEWS) {
    if (ONLY && !ONLY.includes(view.name)) continue;
    const eye = ahead(view.target, view.bearing, view.distM);
    await page.evaluate(({ eye, view }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__ssIdle = 0;
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__ssCamera = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM);
      map.jumpTo((window as any).__ssCamera);
    }, { eye, view });
    await settle(page);
    await page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    // Diagnostics: SS_EVAL is evaluated in the page before the shot (e.g. to toggle one model's shadows).
    const evalSource = process.env.SS_EVAL_FILE ? readFileSync(process.env.SS_EVAL_FILE, 'utf8') : process.env.SS_EVAL;
    if (evalSource) diag[`${view.name}:eval`] = await page.evaluate(evalSource);
    await page.waitForTimeout(1500);
    await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: join(dir, `${view.name}.png`) });
    diag[view.name] = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, sl = vm._signatureLandmarks;
      return (sl?._entries ?? []).filter((e: any) => e.spec.assetKind === 'ordinary-building').map((e: any) => {
        const mats: Record<string, unknown> = {};
        e.group.traverse((o: any) => {
          if (!o.isMesh) return;
          const m = o.material, key = `${m.type}:${m.name}`;
          mats[key] = { side: m.side, tint: m.uniforms?.tint?.value?.toArray?.() ?? m.color?.getHexString?.(), map: !!(m.map || m.uniforms?.map?.value), image: !!(m.map?.image || m.uniforms?.map?.value?.image), userData: m.userData };
        });
        const lights = (e.scene?.children ?? []).filter((c: any) => c.isLight).map((l: any) => ({ name: l.name, pos: l.position.toArray().map((v: number) => +v.toFixed(3)), i: l.intensity }));
        return { id: e.spec.id, category: e.spec.buildingCategory, scale: e.group.scale.toArray(), enu: e.enuFromWorld?.elements?.map((v: number) => +v.toFixed(3)), lights, mats, highlightState: e.highlightState ?? null };
      });
    });
  }
  writeFileSync(join(dir, 'entries.json'), JSON.stringify({ query: mode.query, diag, errors: errors.slice(0, 20) }, null, 1));
  const atNassaukade = diag['singelgracht'] as { id: string; category: string }[] | undefined;
  if (atNassaukade) {
    const surveys = atNassaukade.filter(e => e.category === 'street-survey').map(e => e.id);
    if (/streetChunks=1/.test(mode.query)) expect(surveys).toContain('chunk-face-nassau-162289');
    else if (!/streetChunks=/.test(mode.query)) expect(surveys).toEqual([]);
  }
  expect(errors).toEqual([]);
});
