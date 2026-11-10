import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { setHiddenSelect, useEngine } from './helpers';

// Lane S5 (#333): Free Ride pins stand at the landmark's own point (or the nearest open land when that is water),
// not at the nearest road/canal point the quiz modes snap to. Measures every Free Ride landmark: distance from its
// extract point to the game point (snapped) and to the Free Ride anchor, and whether each is on water. Pins the
// Westertoren: its pin within 25 m of the tower and on land, by boat and by bike. `S5_OUT=<dir>` writes the rows.
// `S5_GATE=1` asserts (the default run only measures).

const WESTERMARKT: [number, number] = [4.8836, 52.3747];
const TOWER_PIN_M = 25;

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

async function placeAt(page: Page, lngLat: [number, number]): Promise<boolean> {
  return page.evaluate(([lng, lat]) => {
    const g = (window as any).canalRecallGame;
    const l = g.osmLoader;
    const x = (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * 3 + l._lastOffsetX;
    const y = -(lat - l._lastCenterLat) * 111320 * 3 + l._lastOffsetY;
    const road = g.track.getNearestRoad(x, y);
    if (!road) return false;
    g.player.x = road.x; g.player.y = road.y; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.player.angle = road.angle;
    g.camera.resetForRide?.(g.player);
    return true;
  }, lngLat);
}

for (const mode of ['boat', 'car'] as const) {
  test(`free ride pin snap (${mode === 'car' ? 'bike' : 'boat'})`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const label = mode === 'car' ? 'bike' : 'boat';
    await startFreeRide(page, mode);
    expect(await placeAt(page, WESTERMARKT)).toBe(true);
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      const l = g.osmLoader;
      const toWorld = ([lng, lat]: [number, number]) => ({
        x: (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * 3 + l._lastOffsetX,
        y: -(lat - l._lastCenterLat) * 111320 * 3 + l._lastOffsetY,
      });
      const water = (p: { x: number; y: number }) => !!g.vectorMap.isWater?.(p.x, p.y, g.osmLoader);
      const anchors = new Map<string, { x: number; y: number }>();
      // The pins as Free Ride places them: every catalogue landmark through the runtime's own re-anchoring.
      const catalogue = g._freeRideCatalog().filter((p: any) => p.kind === 'landmark').map((p: any) => ({ ...p, distance: 0 }));
      for (const p of g._freeRideOnLand(catalogue)) anchors.set(String(p.key), p);
      const catalogueIds = new Set<string>(catalogue.map((p: any) => String(p.key)));
      const rows = [] as any[];
      for (const lm of g.landmarks as any[]) {
        const place = anchors.get(String(lm.id));
        if (!place) { if (catalogueIds.has(String(lm.id))) rows.push({ id: lm.id, name: lm.name, dropped: true, snapM: 0, anchorM: 0 }); continue; }
        const own = toWorld(lm.lngLat);
        rows.push({
          id: lm.id, name: lm.name,
          snapM: Math.hypot(lm.x - own.x, lm.y - own.y) / 3,
          anchorM: Math.hypot(place.x - own.x, place.y - own.y) / 3,
          ownWater: water(own), snapWater: water(lm), anchorWater: water(place),
          anchorFootprint: !!g.vectorMap.isFootprint?.(place.x, place.y, g.osmLoader), ownFootprint: !!g.vectorMap.isFootprint?.(own.x, own.y, g.osmLoader),
        });
      }
      const tower = (g.landmarks as any[]).find(lm => /westertoren/i.test(lm.name));
      const own = tower ? toWorld(tower.lngLat) : null;
      const nearby = (g._freeRideNearby || []).find((p: any) => /westertoren/i.test(p.name));
      return {
        rows,
        tower: tower && own ? {
          name: tower.name, ownWater: water(own), snapM: Math.hypot(tower.x - own.x, tower.y - own.y) / 3,
          pin: nearby ? { distM: Math.hypot(nearby.x - own.x, nearby.y - own.y) / 3, water: water(nearby) } : null,
        } : null,
      };
    });
    const rows = result.rows as any[];
    const med = (key: string) => rows.map(r => r[key]).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0;
    const summary = {
      mode: label, landmarks: rows.length,
      snapMedianM: +med('snapM').toFixed(1), snapMaxM: +Math.max(0, ...rows.map(r => r.snapM)).toFixed(1),
      snapOver10M: rows.filter(r => r.snapM > 10).length, snapOver25M: rows.filter(r => r.snapM > 25).length,
      ownOnWater: rows.filter(r => r.ownWater).length, snapOnWater: rows.filter(r => r.snapWater).length,
      anchorOnWater: rows.filter(r => r.anchorWater).length,
      anchorMedianM: +med('anchorM').toFixed(1), anchorMaxM: +Math.max(0, ...rows.map(r => r.anchorM)).toFixed(1),
      anchorOver25M: rows.filter(r => r.anchorM > 25).length, noPin: rows.filter(r => r.dropped).length,
      ownInFootprint: rows.filter(r => r.ownFootprint).length, anchorInFootprint: rows.filter(r => r.anchorFootprint).length,
      tower: result.tower,
    };
    console.log(`S5 ${JSON.stringify(summary)}`);
    const out = process.env.S5_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, `${info.project.name}-${label}.json`), JSON.stringify({ summary, rows }, null, 1));
    }
    if (process.env.S5_GATE) {
      expect(result.tower, 'Westertoren landmark present').toBeTruthy();
      expect(result.tower!.pin, 'Westertoren pin shown at Westermarkt').toBeTruthy();
      expect(result.tower!.pin!.distM).toBeLessThanOrEqual(TOWER_PIN_M);
      expect(result.tower!.pin!.water).toBe(false);
      expect(summary.anchorOnWater).toBe(0);
    }
  });
}
