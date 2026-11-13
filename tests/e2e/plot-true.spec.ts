// Rule 9, plot-true (lane BA, 2026-11-13): every house the game draws keeps its walls on its BAG plot, within 0.2 m.
// At fixed spots across Centrum on the default world (compiled cells, own engine), read the drawn wall vertices of every
// generic building in the near chunks and baked cells around the rider (`?keepVerts=1` keeps the CPU copies), place them
// with the layer's own local → Mercator transform, and measure how far any wall vertex stands outside its source ring.
// Pinned: Haarlemmerdijk 29 (0363100012167795) was drawn 1.58 m off its plot by the facade layer's mean-radius metre.
//   PW_PORT=<port> npx playwright test tests/e2e/plot-true.spec.ts --project=desktop   (npm run test:plot-true)
//   PLOT_TRUE_OUT=<file.json> writes the per-building report.
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openRoute, settleWorld } from './helpers';

/** Rule 9's tolerance (0.2 m) plus the linear-origin projection's curvature residual at Centrum's edge (~0.15 m). */
const TOL_M = 0.35;
/** Wall band: vertices below this share of the building's height (eaves overhangs and roofs above it are not walls). */
const WALL_BAND = 0.7;
const PINNED = ['0363100012167795', '0363100012165074'];

type Spot = { name: string; key: string; lngLat: [number, number]; headingDeg: number; fps: Record<string, unknown>; width: number; height: number };
const SPOTS: Spot[] = JSON.parse(readFileSync(new URL('./fixtures/plot-true-spots.json', import.meta.url), 'utf8')).spots;

async function openPage(page: Page): Promise<void> {
  await openRoute(page, { travelMode: 'car', query: `?engine=own&cam=fps&keepVerts=1${process.env.PLOT_TRUE_QUERY ?? ''}`, abortHeavyTiles: true });
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    g.player.handleInput = () => {};
    if (!vm.fpsCameraOn()) vm.setFpsCamera(true);
    vm.solveFps = function solveFpsPlotTrue(this: any) { const p = (window as any).__plotTruePose; this._lastFps = { pose: p, backM: 0, stuckId: null, elevation: 0 }; return p; };
  });
}

async function setPose(page: Page, spot: Spot): Promise<void> {
  await page.evaluate(({ lngLat, headingDeg, fps }) => {
    const w = window as any, g = w.canalRecallGame, l = g.osmLoader;
    const mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180), ppm = 3;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * mLng * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = (headingDeg - 90) * Math.PI / 180;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    w.__plotTruePose = fps;
    g.state = 4;
  }, spot);
}

type Row = { id: string; layer: string; corners: number; walls: number; outside: number; maxM: number };

/** In the page: every drawn generic building's worst wall vertex outside its ring, metres. */
async function measure(page: Page, wallBand: number): Promise<{ rows: Row[]; noCpu: number }> {
  return page.evaluate((band) => {
    const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings;
    const M: number[] = tb.transform.elements;
    const R = 6378137;
    const merc = (lng: number, lat: number) => [(180 + lng) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360];
    const latOf = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
    const rows: any[] = []; let noCpu = 0;
    const visit = (layer: string, source: any[], ranges: Map<string, { start: number; count: number }>, geometry: any, unit: number, offset: number[]) => {
      const pos = geometry?.getAttribute?.('position');
      if (!pos) return;
      if (!pos.array) { noCpu++; return; }
      for (const f of source) {
        const id = String(f?.properties?.id ?? ''), r = ranges.get(id);
        if (!r || tb.hidden?.has?.(id)) continue;
        const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
        const rings: number[][][] = polys.map((p: any) => p[0].map(([lng, lat]: number[]) => merc(lng, lat)));
        if (!rings.length) continue;
        // The wall band from the building's own lowest vertex (the own ground lifts whole buildings).
        let zMin = Infinity, zMax = -Infinity;
        for (let k = r.start; k < r.start + r.count; k++) { const z = pos.getZ(k) * unit + offset[2]; if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
        const top = zMin + band * (zMax - zMin);
        let walls = 0, outside = 0, maxM = 0;
        for (let k = r.start; k < r.start + r.count; k++) {
          const lx = pos.getX(k) * unit + offset[0], ly = pos.getY(k) * unit + offset[1], lz = pos.getZ(k) * unit + offset[2];
          if (lz > top) continue;
          walls++;
          const x = M[0] * lx + M[12], y = M[5] * ly + M[13];
          let inside = false, d = Infinity;
          for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const [xi, yi] = ring[i], [xj, yj] = ring[j];
              if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
              const ex = xj - xi, ey = yj - yi, L = ex * ex + ey * ey;
              const u = L ? Math.max(0, Math.min(1, ((x - xi) * ex + (y - yi) * ey) / L)) : 0;
              d = Math.min(d, Math.hypot(x - xi - u * ex, y - yi - u * ey));
            }
          }
          if (inside) continue;
          outside++;
          const m = d * 2 * Math.PI * R * Math.cos(latOf(y) * Math.PI / 180);
          if (m > maxM) maxM = m;
        }
        rows.push({ id: id.replace(/^NL\.IMBAG\.Pand\./, ''), layer, corners: rings[0].length - 1, walls, outside, maxM: +maxM.toFixed(3) });
      }
    };
    for (const [key, c] of tb.chunks.entries()) if (key.startsWith('near:') && c.mesh) visit(key, c.source ?? [], c.ranges, c.mesh.geometry, 1, [0, 0, 0]);
    for (const [key, e] of tb.bakedEntries.entries()) if (e.mesh) visit(`baked:${key}`, tb.bakedSources.get(key) ?? [], e.ranges, e.mesh.geometry, e.mesh.scale.x || 1, e.mesh.position.toArray());
    return { rows, noCpu };
  }, wallBand);
}

test('plot-true: drawn generic walls stay on their BAG plots', async ({ page }) => {
  test.setTimeout(120_000 + SPOTS.length * 90_000);
  await page.setViewportSize({ width: SPOTS[0].width, height: SPOTS[0].height });
  // BUNDLES_DIR=<dir> serves *.bundle.js from a scratch build (as house-frames.spec.ts): a source change before its bundles.
  const bundles = process.env.BUNDLES_DIR ? resolve(process.env.BUNDLES_DIR) : '';
  if (bundles) await page.context().route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openPage(page);
  const report: Record<string, unknown> = {};
  const failures: string[] = [];
  const seen = new Map<string, Row>();
  for (const spot of SPOTS) {
    await setPose(page, spot); await page.waitForTimeout(1200); await setPose(page, spot);
    await settleWorld(page, spot.key, 60_000); await setPose(page, spot);
    const { rows, noCpu } = await measure(page, WALL_BAND);
    const near = rows.filter(r => r.layer.startsWith('near:'));
    report[spot.name] = { buildings: rows.length, near: near.length, noCpu, worst: [...rows].sort((a, b) => b.maxM - a.maxM).slice(0, 10) };
    for (const r of rows) { const prev = seen.get(r.id); if (!prev || r.maxM > prev.maxM) seen.set(r.id, r); }
    expect(near.length, `${spot.name}: no near-chunk buildings read (keepVerts not honoured?)`).toBeGreaterThan(20);
  }
  for (const r of seen.values()) if (r.maxM > TOL_M) failures.push(`${r.id} (${r.layer}, ${r.corners} corners) ${r.maxM.toFixed(2)} m off its plot`);
  const all = [...seen.values()];
  const irregular = all.filter(r => r.corners > 4);
  report.summary = { buildings: all.length, irregular: irregular.length, overTol: failures.length, maxM: Math.max(...all.map(r => r.maxM)), p95M: all.map(r => r.maxM).sort((a, b) => a - b)[Math.floor(all.length * 0.95)] };
  for (const id of PINNED) report[`pinned ${id}`] = seen.get(id) ?? 'not drawn at these spots';
  if (process.env.PLOT_TRUE_OUT) writeFileSync(process.env.PLOT_TRUE_OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.summary), PINNED.map(id => `${id}: ${seen.get(id)?.maxM ?? 'not drawn'} m`).join(', '));
  for (const id of PINNED) expect(seen.has(id), `pinned ${id} not drawn at the spots`).toBe(true);
  expect(failures, `${failures.length} buildings drawn off their plot (> ${TOL_M} m):\n${failures.slice(0, 40).join('\n')}`).toEqual([]);
});
