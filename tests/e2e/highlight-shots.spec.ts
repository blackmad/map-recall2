/**
 * Highlight styles (default a; `?highlight=yellow|b|c`, look/highlight.ts) against the old yellow: shots for the contact sheet,
 * not a gate. Four spots (the Westermarkt block, the Westerkerk, the Rijksmuseum, a terrace house in Oud-West) from
 * the chase view and from the saddle (cockpit), in the default frame and the shared frame, at the game's fixed day.
 *
 *   PW_PORT=4451 HIGHLIGHT_SHOTS_OUT=artifacts/highlight-redesign/shots npx playwright test highlight-shots --project=desktop
 *   HIGHLIGHT_STYLES=yellow,a  HIGHLIGHT_FRAMES=default  narrow the matrix;
 *   then `node scripts/highlight-contact-sheet.mjs artifacts/highlight-redesign/shots`.
 *   LOOK_BUNDLES_DIR=<dir> serves *.bundle.js from there (e.g. the committed bundles, for a yellow before/after:
 *   `node scripts/compare-look-shots.mjs <before> <after>`).
 *
 * Each shot records the share of pixels in the style's colour (yellow: #ffd21f; candidates: the accent) and the
 * three.js draw calls, in `<out>/<frame>-<style>.json`.
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';

export type HighlightSpot = { name: string; landmarkId?: string; pand?: string; pick?: [number, number]; standDeg: number; standM: number; saddleM: number };
export const HIGHLIGHT_SPOTS: HighlightSpot[] = [
  // Anne Frank House: the three pands on the Westermarkt corner of the Prinsengracht (the user's screenshot block).
  { name: 'westermarkt', landmarkId: 'extract_landmarks_614625734', standDeg: 115, standM: 75, saddleM: 45 },
  { name: 'westerkerk', landmarkId: 'extract_landmarks_1692085215', standDeg: 140, standM: 90, saddleM: 60 },
  { name: 'rijksmuseum', landmarkId: 'extract_landmarks_512243549', standDeg: 195, standM: 150, saddleM: 120 },
  // An ordinary 1890s house on the Bilderdijkstraat (the "building you tapped" path: no landmark, just its id).
  { name: 'oudwest-terrace', pand: 'NL.IMBAG.Pand.0363100012236453', pick: [4.87177, 52.36696], standDeg: 7, standM: 60, saddleM: 35 },
];
const STYLES = (process.env.HIGHLIGHT_STYLES || 'yellow,a,b,c').split(',').filter(Boolean);
const FRAMES = [{ name: 'default', query: '' }, { name: 'shared', query: 'sharedFrame=1' }].filter(f => !process.env.HIGHLIGHT_FRAMES || process.env.HIGHLIGHT_FRAMES.split(',').includes(f.name));
const VIEWS = (process.env.HIGHLIGHT_VIEWS || 'chase,saddle').split(',');
const OUT = process.env.HIGHLIGHT_SHOTS_OUT || 'artifacts/highlight-redesign/shots';
// Styles may carry `-hud` (`a-hud`): the same candidate with the HUD accent (`?highlightAccent=hud`, #b4682c).
const ACCENT: Record<string, [number, number, number]> = { yellow: [255, 210, 31], coral: [255, 128, 51], hud: [180, 104, 44] };

/** Share of pixels within `tolerance` (RGB distance) of `rgb`. */
export async function colourShare(png: Buffer, rgb: [number, number, number], tolerance = 60): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += 3) if (Math.hypot(data[i] - rgb[0], data[i + 1] - rgb[1], data[i + 2] - rgb[2]) < tolerance) n++;
  return n / (info.width * info.height);
}

function standpoint(centre: [number, number], deg: number, m: number): { lng: number; lat: number; bearing: number } {
  const b = deg * Math.PI / 180;
  return { lng: centre[0] + m * Math.sin(b) / (111320 * Math.cos(centre[1] * Math.PI / 180)), lat: centre[1] + m * Math.cos(b) / 111320, bearing: (deg + 180) % 360 };
}

export async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
}

/** The spot's landmark, or a synthetic "tapped building" landmark for the nearest streamed building to `pick`. */
export async function spotLandmark(page: Page, spot: HighlightSpot): Promise<any> {
  if (spot.pand) return { id: `tapped-${spot.pand}`, name: 'Terrace house', lngLat: spot.pick, buildingIds: [spot.pand], featureTarget: { source: 'osm-building-appearance', id: spot.pand } };
  return page.evaluate(({ id, pick }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    if (id) return (g.landmarks || []).find((l: any) => l.id === id) ?? (g._allLandmarks || []).find((l: any) => l.id === id) ?? null;
    let best: any = null, bestD = Infinity;
    for (const chunk of vm._threeBuildings?.chunks?.values() ?? []) for (const f of chunk.source) {
      const ring = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
      if (!ring) continue;
      const c = ring.reduce((a: number[], p: number[]) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
      const d = Math.hypot((c[0] - pick![0]) * 68000, (c[1] - pick![1]) * 111000);
      if (d < bestD) { bestD = d; best = { id: `tapped-${f.properties.id}`, name: 'Terrace house', lngLat: c, buildingIds: [String(f.properties.id)], featureTarget: { source: 'osm-building-appearance', id: f.properties.id } }; }
    }
    return best;
  }, { id: spot.landmarkId, pick: spot.pick });
}

async function quiet(page: Page): Promise<void> {
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
    const canvas = map.getCanvas() as HTMLCanvasElement;
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
}

for (const frame of FRAMES) for (const style of STYLES) {
  test(`highlight shots: ${frame.name} ${style}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'shots: desktop');
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const bundles = process.env.LOOK_BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    const [base, accent] = style.split('-');
    const query = [frame.query, `highlight=${base}`, accent ? `highlightAccent=${accent}` : ''].filter(Boolean).join('&');
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: query ? `?${query}` : '', abortHeavyTiles: true });
    mkdirSync(OUT, { recursive: true });
    const records: any[] = [];
    const spots = HIGHLIGHT_SPOTS.filter(s => !process.env.HIGHLIGHT_SPOT_NAMES || process.env.HIGHLIGHT_SPOT_NAMES.split(',').includes(s.name));
    for (const spot of spots) for (const view of VIEWS) {
      // Get near first, so the streamed buildings around the spot are resident before picking.
      const first = await spotLandmark(page, spot);
      // A picked house: stand off the pick itself (its chunk may not be resident yet, so the nearest loaded building is not it).
      const centre: [number, number] = spot.pick ?? first?.lngLat;
      const p = standpoint(centre, spot.standDeg, view === 'saddle' ? spot.saddleM : spot.standM);
      await page.evaluate((mode) => { const g = (window as any).canalRecallGame; g.viewMode = mode; g.camera.viewMode = mode; }, view === 'saddle' ? 'cockpit' : 'chase');
      await teleport(page, p);
      await page.waitForTimeout(4000);
      await teleport(page, p);
      await page.waitForTimeout(4000);
      await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(3000);
      const landmark = await spotLandmark(page, spot);
      expect(landmark, `${spot.name}: landmark`).toBeTruthy();
      const state = await page.evaluate((l) => {
        const vm = (window as any).canalRecallGame.vectorMap;
        vm.setActiveLandmark(l);
        const entries = vm._signatureLandmarks?._entries || [];
        return { models: entries.filter((e: any) => e.highlighted).map((e: any) => e.spec.id), extrusions: [...(vm._threeBuildings?.highlighted ?? [])].length, marker: vm._highlightMarker?.status?.() ?? null };
      }, landmark);
      await page.waitForTimeout(2500);
      await quiet(page);
      await page.waitForTimeout(500);
      const file = `${OUT}/${frame.name}-${style}-${spot.name}-${view}.png`;
      const png = await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: file });
      const share = await colourShare(png, ACCENT[base === 'yellow' ? 'yellow' : accent ?? 'coral']);
      records.push({ spot: spot.name, view, file, share, state, landmark: { id: landmark.id, name: landmark.name, lngLat: landmark.lngLat } });
      await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap;
        vm.setActiveLandmark(null);
        for (const e of Array.from(document.body.querySelectorAll('*'))) (e as HTMLElement).style.visibility = '';
      });
    }
    // Merge with an earlier run of other spots (HIGHLIGHT_SPOT_NAMES re-shoots a subset).
    const json = `${OUT}/${frame.name}-${style}.json`;
    const kept = existsSync(json) ? JSON.parse(readFileSync(json, 'utf8')).records.filter((r: any) => !records.some(n => n.spot === r.spot && n.view === r.view)) : [];
    writeFileSync(json, JSON.stringify({ frame: frame.name, style, query, records: [...kept, ...records] }, null, 1));
  });
}
