import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute, setHiddenSelect } from './helpers';

// Replays the 2026-10-25 centre feedback poses (player x/y/angle from the notes) and
// records a frame plus the POI labels drawn, for before/after evidence.
//   CENTRE_FB_OUT=<dir> PW_PORT=4687 npx playwright test centre-feedback --project=desktop
const OUT = process.env.CENTRE_FB_OUT || 'artifacts/centre-feedback';
const ONLY = process.env.CENTRE_FB_ONLY || '';
export const CENTRE_POSES = [
  { id: '3026cca1', note: 'bijenkorf windows', x: -1256.88, y: -5717.19, angle: -0.9148 },
  { id: '59b67ef0', note: 'grey vertical strip, Dam', x: -1340.79, y: -5802.81, angle: -1.0613 },
  { id: '58f97b44', note: 'berlage floating windows', x: -937.65, y: -6119.65, angle: -0.4793 },
  { id: 'd85ba0ac', note: 'two berlage labels', x: -671.62, y: -6571.85, angle: -0.9421 },
  { id: '3702bcd7', note: 'double POI labels, Centraal', x: 15.71, y: -7350.21, angle: -0.5125 },
  { id: '334bcadd', note: 'Stationsplein island', x: 200.35, y: -7349.79, angle: 1.6912 },
  { id: 'bbbeaceb', note: 'De Ruijterkade IJ side', x: 652.88, y: -7855.94, angle: -2.5912 },
];

async function park(page: Page, p: { x: number; y: number; angle: number }) {
  await page.evaluate((p) => {
    const g = (window as any).canalRecallGame;
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.quizPromptName = ''; g.quizCandidateName = '';
    g.player.x = p.x; g.player.y = p.y; g.player.angle = p.angle;
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
    // The notes' camera zoom (0.8997): the rider had zoomed out from the default.
    if (g.camera.zoom != null) g.camera.zoom = 0.8997; if (g.camera.targetZoom != null) g.camera.targetZoom = 0.8997;
  }, p);
}

async function drawnLabels(page: Page) {
  return page.evaluate(() => {
    const o = (window as any).canalRecallGame.vectorMap._labelOverlay;
    const out: Array<{ name: string; cls: string; x: number; y: number }> = [];
    for (const el of Array.from(document.querySelectorAll('[data-map-label]')) as HTMLElement[]) {
      if (el.hidden || el.style.display === 'none' || Number(getComputedStyle(el).opacity) < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.push({ name: el.dataset.mapLabel || '', cls: el.dataset.labelClass || '', x: Math.round(r.left), y: Math.round(r.top) });
    }
    const g = (window as any).canalRecallGame;
    const markers = (g._freeRideMarkers || []).map((m: any) => ({ key: m.key, name: g._freeRideNearby?.find((p: any) => p.key === m.key)?.name, x: Math.round(m.anchorX), y: Math.round(m.anchorY) }));
    // MapLibre symbols its collision pass placed (station and transit names are not the overlay's).
    const map = g.vectorMap.map;
    const symbolIds = map.getStyle().layers.filter((l: any) => l.type === 'symbol' && map.getLayoutProperty(l.id, 'visibility') !== 'none').map((l: any) => l.id);
    const symbols = map.queryRenderedFeatures(undefined, { layers: symbolIds })
      .filter((f: any) => !/street|road|water|transportation_name|place|neighborhood|answered/.test(f.layer.id))
      .map((f: any) => ({ name: f.properties?.name || '', layer: f.layer.id })).filter((f: any) => f.name);
    return { labels: out, markers, symbols, nearby: (g._freeRideNearby || []).map((p: any) => p.name), duplicates: o?.duplicates || [], stats: o?.stats };
  });
}

test('centre feedback poses: frames and drawn labels', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop frames');
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: Number(process.env.CENTRE_FB_W || 960), height: Number(process.env.CENTRE_FB_H || 540) });
  if (process.env.CENTRE_FB_FREE !== '0') {
    // The feedback was sent from Free Ride (the plaque reads "N places opened").
    await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
    await page.goto('/canal-drive/');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
    await expect(page.locator('#route-card')).toBeVisible();
    await setHiddenSelect(page, 'travel-mode', 'car');
    await setHiddenSelect(page, 'view-mode', 'chase');
    await page.locator('[data-choice="route:free"]').click();
    await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  } else {
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  }
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const report: Record<string, unknown> = {};
  for (const pose of CENTRE_POSES) {
    if (ONLY && !ONLY.split(',').includes(pose.id)) continue;
    await park(page, pose);
    await page.waitForTimeout(12_000);
    await park(page, pose);
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${OUT}/${pose.id}.png` });
    // CENTRE_FB_PICK="x,y;x,y" (CSS px): which model each pixel shows, for naming the pand in a screenshot.
    const picks = process.env.CENTRE_FB_PICK ? await page.evaluate((spec) => {
      const vm = (window as any).canalRecallGame.vectorMap, canvas = vm.map.getCanvas() as HTMLCanvasElement;
      return spec.split(';').map(pair => {
        const [x, y] = pair.split(',').map(Number);
        const hits: Record<string, unknown> = {};
        for (const [name, layer] of [['signature', vm._signatureLandmarks], ['three', vm._threeBuildings], ['tiles', vm._tileBuildings]] as const) {
          const hit = (layer as any)?.inspectAtScreen?.(x, y, canvas.clientWidth, canvas.clientHeight);
          if (hit) hits[name] = { ...hit, footprint: undefined, geometry: undefined };
        }
        return { x, y, hits };
      });
    }, process.env.CENTRE_FB_PICK) : undefined;
    report[pose.id] = { ...pose, ...(await drawnLabels(page)), picks };
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
});
