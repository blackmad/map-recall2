import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// POI labels (lane 2026-10-13, docs/handoffs/lane-poi-labels-20261013.md).
// User report: "labels now look really bad against our palette; also not sure
// they make sense to always be on top of everything" — a desktop shot over the
// Damrak at ~250 m with hundreds of white shop/hotel/cruise names on every roof.
//
//   LABEL_SHOTS_OUT=artifacts/labels/after PW_PORT=4455 npx playwright test labels --project=desktop
//
// Each view is a fixed camera (eye, height, target); the HUD stays on so a
// label over the plaque would show. The count is the labels a rider can read:
// MapLibre symbols the collision pass placed, plus the game's own label layer.
const OUT = process.env.LABEL_SHOTS_OUT || 'artifacts/labels';

type View = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number };
export const LABEL_VIEWS: View[] = [
  // The user's viewpoint: over the Damrak, ~250 m up, looking south to the Dam.
  { name: 'damrak-250m', target: [4.89300, 52.37420], bearing: 10, distM: 330, altM: 250, targetAltM: 0 },
  // A rider's eye (1.7 m) on the Westermarkt, looking west at the Westerkerk.
  { name: 'westerkerk-1.7m', target: [4.88361, 52.37439], bearing: 94, distM: 74, altM: 1.7, targetAltM: 22 },
  // The Dam from the air.
  { name: 'dam-air', target: [4.89260, 52.37300], bearing: 200, distM: 420, altM: 380, targetAltM: 0 },
  // Nieuw-West: Osdorpplein, ordinary post-war blocks and shops.
  { name: 'nieuw-west', target: [4.80080, 52.35850], bearing: 30, distM: 300, altM: 220, targetAltM: 0 },
];

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

type Seen = { name: string; layer: string; x: number; y: number; w: number; h: number };
type Box = { x: number; y: number; width: number; height: number };

/** Every label a rider can read right now, in CSS pixels. */
async function readableLabels(page: Page): Promise<Seen[]> {
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    const symbolIds = map.getStyle().layers
      .filter((l: any) => l.type === 'symbol' && map.getLayoutProperty(l.id, 'visibility') !== 'none')
      .map((l: any) => l.id);
    const box = (map.getCanvas() as HTMLCanvasElement).getBoundingClientRect();
    const out: Seen[] = [];
    // MapLibre: queryRenderedFeatures returns only symbols its collision pass placed.
    // Street and water names are the game's (earned); only POI-like names count here.
    for (const f of map.queryRenderedFeatures(undefined, { layers: symbolIds })) {
      if (/street|road|water|transportation|place|neighborhood|ferry|answered/.test(f.layer.id)) continue;
      const name = f.properties?.name || f.properties?.['name:latin'];
      if (!name) continue;
      const c = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
      if (!c) continue;
      const p = map.project(c);
      out.push({ name, layer: f.layer.id, x: box.left + p.x, y: box.top + p.y, w: 0, h: 0 });
    }
    // The game's own label layer (src/canalRecall/labels): DOM, measured.
    for (const el of Array.from(document.querySelectorAll('[data-map-label]')) as HTMLElement[]) {
      if (el.hidden || Number(getComputedStyle(el).opacity) < 0.05) continue;
      const r = el.getBoundingClientRect();
      out.push({ name: el.dataset.mapLabel || '', layer: `own:${el.dataset.labelClass}`, x: r.left, y: r.top, w: r.width, h: r.height });
    }
    return out.filter(l => l.x >= box.left && l.x <= box.right && l.y >= box.top && l.y <= box.bottom);
  });
}

/** The plaque, destination card and prompt in CSS pixels (hudLayout is in canvas design units). */
async function hudRects(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const layout = g._hudRects();
    const canvas = g.canvas as HTMLCanvasElement, r = canvas.getBoundingClientRect();
    const designW = (0, eval)('typeof CANVAS_W === "number" ? CANVAS_W : 0') || canvas.width;
    const designH = (0, eval)('typeof CANVAS_H === "number" ? CANVAS_H : 0') || canvas.height;
    const sx = r.width / designW, sy = r.height / designH;
    const css = (rect: any) => ({ x: r.left + rect.x * sx, y: r.top + rect.y * sy, width: rect.width * sx, height: rect.height * sy });
    return { recall: css(layout.recall), location: css(layout.location), destination: css(layout.destination) };
  });
}

async function pose(page: Page, view: View): Promise<void> {
  const eye = ahead(view.target, view.bearing, view.distM);
  await page.evaluate(({ eye, view }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView?.(50);
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM));
  }, { eye, view });
}

const overlaps = (l: Seen, r: Box) => {
  const w = Math.max(l.w, 1), h = Math.max(l.h, 1);
  return l.x < r.x + r.width && l.x + w > r.x && l.y < r.y + r.height && l.y + h > r.y;
};

test('labels: shots and counts at the review viewpoints', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport for the counted shots');
  test.setTimeout(420_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: process.env.LABEL_SHOTS_QUERY || '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const report: Record<string, { count: number; overHud: string[]; labels: Seen[]; hud: Record<string, Box>; overlay: unknown }> = {};
  for (const view of LABEL_VIEWS) {
    await pose(page, view);
    await page.waitForTimeout(9000);
    const labels = await readableLabels(page);
    const hud = await hudRects(page);
    const overHud = labels.filter(l => Object.values(hud).some(r => overlaps(l, r))).map(l => l.name);
    const overlay = await page.evaluate(() => {
      const o = (window as any).canalRecallGame.vectorMap._labelOverlay;
      if (!o) return null;
      // Projection check: the overlay's ground projection against MapLibre's own.
      const map = (window as any).canalRecallGame.vectorMap.map, c = map.getCenter();
      const p = (o as any).projector(map)(c.lng, c.lat, 0), q = map.project(c);
      return { ...o.stats, projectionErrorPx: Math.hypot(p.x - q.x, p.y - q.y) };
    });
    report[view.name] = { count: labels.length, overHud, labels, hud, overlay };
    await page.screenshot({ path: `${OUT}/${view.name}.png` });
  }
  writeFileSync(`${OUT}/counts.json`, JSON.stringify(report, null, 1));
  console.log(Object.entries(report).map(([k, v]) => `${k}: ${v.count} labels, ${v.overHud.length} over the HUD ${JSON.stringify(v.overlay)}`).join('\n'));
  if (process.env.LABEL_SHOTS_BEFORE) return;
  // The handoff's budget: at most ~12 labels in view at the Damrak, none on the plaque.
  expect(report['damrak-250m'].count, JSON.stringify(report['damrak-250m'].labels.map(l => l.name))).toBeLessThanOrEqual(12);
  for (const [name, v] of Object.entries(report)) expect(v.overHud, `${name}: labels over the plaque/destination card`).toEqual([]);
});

// User 2026-10-16 ("don't show destinations through scrim"): the DOM label
// layer sits above the game canvas, so it floated venue names over the paper
// loading screen. Every covered state hides it, without waiting for a map repaint.
test('labels: hidden while the loading screen covers the map', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'state rule, one viewport');
  test.setTimeout(180_000);
  const seenDuringLoad: string[] = [];
  await page.exposeFunction('__labelLeak', (names: string) => seenDuringLoad.push(names));
  await page.addInitScript(() => {
    const tick = () => {
      const g = (window as any).canalRecallGame, root = document.querySelector('.cr-map-labels') as HTMLElement | null;
      if (g && root && g.state <= 2 && getComputedStyle(root).visibility !== 'hidden') {
        const shown = [...root.children].filter(el => Number((el as HTMLElement).style.opacity || 0) > 0.05).map(el => el.textContent);
        if (shown.length) (window as any).__labelLeak(`state ${g.state}: ${shown.join(', ')}`);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  expect(seenDuringLoad, 'labels visible over menu/setup/loading paper').toEqual([]);
  const visibility = () => page.evaluate(() => getComputedStyle(document.querySelector('.cr-map-labels')!).visibility);
  await page.evaluate(() => { (window as any).canalRecallGame.state = 2; });
  await expect.poll(visibility, { timeout: 2000 }).toBe('hidden');
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  await expect.poll(visibility, { timeout: 2000 }).toBe('visible');
});
