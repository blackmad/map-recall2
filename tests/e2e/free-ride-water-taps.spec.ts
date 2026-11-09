import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { setHiddenSelect, useEngine } from './helpers';

// Lane S2 (#314, user 2026-11-09: "in free ride, get the landmark clicks out of the waterways").
// At three canal-side poses, by boat and by bike, tap 30 points on water near bridges and quays and 30 on land,
// and log what opens: card kind, id, distance from the tap to the nearest marker anchor, whether the tap was on a
// pill, whether the tap point is water (the engine's water index, built from water.json). Also count Free Ride
// markers whose anchor stands on open water (reading B). `S2_OUT=<dir>` writes the rows and a frame per pose;
// `S2_GATE=1` asserts the lane's gate: no water tap opens a landmark/bridge/building card off a pill, and no
// marker anchor stands on water.

type Pose = { name: string; lngLat: [number, number] };
const POSES: Pose[] = [
  { name: 'westermarkt', lngLat: [4.8836, 52.3747] },
  { name: 'brouwersgracht', lngLat: [4.8870, 52.3836] },
  { name: 'blauwbrug', lngLat: [4.9010, 52.3669] },
];
const TAPS = 30;

async function startFreeRide(page: Page, mode: 'boat' | 'car'): Promise<void> {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await useEngine(page);
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', mode);
  await page.locator('[data-choice="route:free"]').click();
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.state), { timeout: 90_000 }).toBe(4);
}

/** Put the rider on the nearest way (street or canal, per mode) to a lng/lat. */
async function placeAt(page: Page, lngLat: [number, number]): Promise<boolean> {
  return page.evaluate(([lng, lat]) => {
    const g = (window as any).canalRecallGame;
    const l = g.osmLoader;
    const scale = 3; // PIXELS_PER_METER (osm/roadProjection.ts); inverse of landmarkRuntime._streetArtAt.
    const x = (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * scale + l._lastOffsetX;
    const y = -(lat - l._lastCenterLat) * 111320 * scale + l._lastOffsetY;
    const road = g.track.getNearestRoad(x, y);
    if (!road) return false;
    g.player.x = road.x; g.player.y = road.y; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.player.angle = road.angle;
    g.camera.resetForRide?.(g.player);
    return true;
  }, lngLat);
}

type Candidate = { cx: number; cy: number; px: number; py: number; water: boolean; anchorDist: number };

/** Candidate taps: a grid over the canvas off the HUD, water or land, sorted nearest a marker anchor / bridge first. */
async function candidates(page: Page): Promise<{ water: Candidate[]; land: Candidate[]; markers: any[] }> {
  return page.evaluate((count) => {
    const g = (window as any).canalRecallGame;
    const rect = g.canvas.getBoundingClientRect();
    const scale = rect.width / g.viewport.width;
    const W = g.viewport.width, H = g.canvas.height / (g.canvas.width / W);
    const anchors: Array<{ x: number; y: number }> = [];
    for (const m of g._freeRideMarkers || []) anchors.push({ x: m.anchorX, y: m.anchorY });
    for (const b of g.bridges || []) for (const c of b.crossings || []) {
      const s = g.camera.worldToScreen(c.x, c.y);
      if (s.x > 0 && s.y > 0 && s.x < W && s.y < H) anchors.push(s);
    }
    const layout = g._hudRects?.() || {};
    const boxes = [layout.recall, layout.compass, layout.minimap, layout.dpad?.bounds].filter(Boolean)
      .map((r: any) => ({ x: r.x, y: r.y, w: r.width ?? r.w, h: r.height ?? r.h }));
    if (g._freeRideBarRect?.()) boxes.push(g._freeRideBarRect());
    const inBox = (x: number, y: number) => boxes.some((b: any) => x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8);
    const water: any[] = [], land: any[] = [];
    const step = Math.max(10, Math.round(W / 70));
    for (let y = H * 0.18; y < H * 0.86; y += step) for (let x = step; x < W - step; x += step) {
      if (inBox(x, y)) continue;
      const css = { x: x * scale, y: y * scale };
      const world = g.vectorMap.screenToWorld?.(css.x, css.y, rect, g.osmLoader);
      if (!world) continue;
      // Visible water: the ground under the pixel is water and no building or model surface stands in front of it
      // (a facade over a canal behind it is a building tap, not a water tap).
      const groundWater = !!g.vectorMap.isWater?.(world.x, world.y, g.osmLoader);
      const hit = groundWater ? g.vectorMap.inspectBuilding(css.x, css.y, rect) : null;
      if (hit?.poi) continue; // a POI label covers it: neither open water nor plain ground
      const isWater = groundWater && !hit;
      const anchorDist = anchors.reduce((d, a) => Math.min(d, Math.hypot(a.x - x, a.y - y)), Infinity);
      (isWater ? water : land).push({ cx: x, cy: y, px: rect.left + css.x, py: rect.top + css.y, water: isWater, anchorDist });
    }
    const spread = (list: any[]) => {
      list.sort((a, b) => a.anchorDist - b.anchorDist);
      const out: any[] = [];
      for (const c of list) {
        if (out.length >= count) break;
        if (out.some(o => Math.hypot(o.cx - c.cx, o.cy - c.cy) < step * 1.5)) continue;
        out.push(c);
      }
      return out;
    };
    const markers = (g._freeRideMarkers || []).map((m: any) => {
      const place = (g._freeRideNearby || []).find((p: any) => p.key === m.key);
      return { key: m.key, kind: place?.kind, name: place?.name, anchorX: m.anchorX, anchorY: m.anchorY,
        anchorWater: (() => { // the drawn anchor dot, unprojected to the ground
          const w = g.vectorMap.screenToWorld?.(m.anchorX * scale, m.anchorY * scale, rect, g.osmLoader);
          return w ? !!g.vectorMap.isWater?.(w.x, w.y, g.osmLoader) : null;
        })() };
    });
    return { water: spread(water), land: spread(land), markers };
  }, TAPS);
}

/** Tap one point and report what opened. */
async function tapAndRead(page: Page, c: Candidate, phone: boolean): Promise<any> {
  const before = await page.evaluate(({ cx, cy, px, py }) => {
    const g = (window as any).canalRecallGame;
    g._clearLandmarkNotice?.();
    g._landmarkNotice = null;
    const onMarker = (g._freeRideMarkers || []).some((m: any) => cx >= m.box.x && cx <= m.box.x + m.box.w && cy >= m.box.y && cy <= m.box.y + m.box.h);
    const label = [...document.querySelectorAll('[data-map-label] .n')].some(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
    });
    return { onPill: onMarker || label, onMarker, onLabel: label };
  }, c);
  if (phone) await page.touchscreen.tap(c.px, c.py); else await page.mouse.click(c.px, c.py);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const n = g._landmarkNotice;
    if (!n || g._landmarkNoticeSource !== 'click') return null;
    const id = String(n.id ?? '');
    const kind = id.startsWith('clicked-') ? 'building'
      : id.startsWith('bridge:') || n.type === 'bridge' ? 'bridge'
      : id.startsWith('free-way:') || n.type === 'water' || n.type === 'waterway' || n.type === 'street' ? `way:${n.type}`
      : (g.landmarks || []).some((l: any) => l.id === id) ? 'landmark'
      : n.type ? `other:${n.type}` : 'other';
    return { id, name: n.name, kind, alongside: !!g._neighborhoodNotice };
  });
  return { ...c, ...before, opened: after };
}

for (const mode of ['boat', 'car'] as const) {
  test(`free ride water taps (${mode === 'car' ? 'bike' : 'boat'})`, async ({ page }, info) => {
    test.setTimeout(600_000);
    const phone = info.project.name === 'iphone';
    await startFreeRide(page, mode);
    const out = process.env.S2_OUT;
    if (out) mkdirSync(out, { recursive: true });
    const rows: any[] = [];
    const summary: any[] = [];
    for (const pose of POSES) {
      expect(await placeAt(page, pose.lngLat), `placed at ${pose.name}`).toBe(true);
      await page.waitForTimeout(4000);
      const { water, land, markers } = await candidates(page);
      if (out) await page.screenshot({ path: join(out, `${info.project.name}-${mode === 'car' ? 'bike' : 'boat'}-${pose.name}.png`) });
      const results: any[] = [];
      for (const c of [...water, ...land]) results.push({ pose: pose.name, ...(await tapAndRead(page, c, phone)) });
      rows.push(...results);
      const off = (list: any[]) => list.filter(r => r.opened && !r.onPill);
      const pinCards = (list: any[]) => off(list).filter(r => !String(r.opened.kind).startsWith('way:'));
      const w = results.filter(r => r.water), l = results.filter(r => !r.water);
      const line = {
        pose: pose.name, device: info.project.name, mode: mode === 'car' ? 'bike' : 'boat',
        waterTaps: w.length, waterOffPillCards: off(w).length, waterOffPillPinCards: pinCards(w).length,
        waterKinds: off(w).map(r => `${r.opened.kind}:${r.opened.name}`),
        landTaps: l.length, landOffPillCards: off(l).length, landKinds: off(l).map(r => r.opened.kind),
        markers: markers.length, markersOnWater: markers.filter(m => m.anchorWater).map(m => m.name),
      };
      summary.push(line);
      console.log(`S2 ${JSON.stringify(line)}`);
    }
    if (out) writeFileSync(join(out, `${info.project.name}-${mode === 'car' ? 'bike' : 'boat'}.json`), JSON.stringify({ summary, rows }, null, 1));
    if (process.env.S2_GATE) {
      // Ruling 2026-11-09 (#314): a boat's tap on its water names that canal, and only that: never from a quay tap,
      // never a street; a bike's water tap opens nothing; every opened card is the one bottom card.
      const waterNames = new Set(await page.evaluate(async () =>
        (await (await fetch('/data/extracts/amsterdam/water.json')).json()).map((w: any) => w.name)));
      const boat = mode === 'boat';
      for (const r of rows) {
        if (!r.opened) continue;
        expect(r.opened.alongside, `${r.pose}: one card at a time (${r.opened.name})`).toBe(false);
        const way = String(r.opened.kind).startsWith('way:');
        if (r.water && !r.onPill) {
          if (boat) {
            expect(way, `${r.pose}: a boat's water tap opens only the water's card, got ${r.opened.kind} ${r.opened.name}`).toBe(true);
            expect(waterNames.has(r.opened.name) || waterNames.has(r.opened.name.replace(/^free-way:/, '')), `${r.pose}: ${r.opened.name} is a water`).toBe(true);
          } else {
            expect(r.opened, `${r.pose}: a bike's water tap opens nothing (${r.opened.kind} ${r.opened.name})`).toBeNull();
          }
        }
        if (!r.water && boat) expect(way, `${r.pose}: a boat's quay/land tap names no canal (${r.opened.name})`).toBe(false);
      }
      for (const line of summary) {
        expect(line.waterTaps, `${line.pose}: enough water taps`).toBeGreaterThanOrEqual(10);
        expect(line.waterOffPillPinCards, `${line.pose}: water taps opening a landmark/bridge/building card off a pill`).toBe(0);
        expect(line.markersOnWater, `${line.pose}: marker anchors on open water`).toEqual([]);
      }
    }
  });
}
