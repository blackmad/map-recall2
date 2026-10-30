import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setHiddenSelect } from './helpers';

// Issue #122, user 2026-10-30, Free Ride in the pitched 3D city:
//  1. labels popped in and out with no fade;
//  2. Klimmuur Centraal alternated between the plaque label and the place pill;
//  3. street names drew over the Oosterdok buildings;
//  4. street names sat across Kattenburg / Kadijksplein at odd angles.
//   LABELS_OUT=<dir> LABELS_TAG=after PW_PORT=4512 npx playwright test labels-free-ride-20261030
const OUT = process.env.LABELS_OUT || 'artifacts/labels-20261030';
const TAG = process.env.LABELS_TAG || 'run';

type Spot = { name: string; at: [number, number]; face: [number, number] };
// De Ruijterkade east of Centraal, looking along Oosterdok towards Klimmuur Centraal.
const OOSTERDOK: Spot = { name: 'oosterdok', at: [4.90560, 52.37840], face: [4.91150, 52.37660] };
// Just beyond Free Ride's marker radius (320 m) of Klimmuur Centraal, looking at it: the overlay names it.
const KLIMMUUR: Spot = { name: 'klimmuur', at: [4.90680, 52.37760], face: [4.91158, 52.37663] };
// Kadijksplein, looking south down the Schippersgracht / Laagte Kadijk.
const KATTENBURG: Spot = { name: 'kattenburg', at: [4.91380, 52.37150], face: [4.91050, 52.36900] };

async function openFreeRide(page: Page) {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  // Before shots: LABELS_BEFORE_DIR holds the pre-#122 scripts (git show HEAD:…), served in place of these.
  const before = process.env.LABELS_BEFORE_DIR;
  if (before) {
    await page.route(/\/canal-drive\/js\/(road-network\.js|vector-map\.js|game-presentation\.bundle\.js|orientation-pois\.bundle\.js)(\?|$)/, route => {
      const file = `${before}/${new URL(route.request().url()).pathname.split('/').pop()}`;
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
  }
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', 'car');
  await setHiddenSelect(page, 'view-mode', 'chase');
  await page.locator('[data-choice="route:free"]').click();
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.state), { timeout: 120_000 }).toBe(4);
}

/** Park the rider at `at`, facing `face`; `speedPx` > 0 rides straight on. */
async function park(page: Page, spot: Spot, speedPx = 0) {
  await page.evaluate(({ at, face, speedPx }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = speedPx; g.player.vx = 0; g.player.vy = 0;
  }, { ...spot, speedPx });
}

/** What the label layers drew this frame. */
async function probe(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    const o = g._streetLabelOcclusion;
    const overlay = vm?._labelOverlay;
    const els = overlay ? [...overlay.root.querySelectorAll('.l')].map((el: any) => ({ name: el.dataset.mapLabel, cls: el.className, opacity: el.style.opacity })) : [];
    return {
      viewMode: g.viewMode, freeRide: !!g.freeRide,
      pitch: vm?.map?.getPitch?.(),
      occlusion: o ? { stats: o.stats, hidden: o.lastHidden, ready: o.index.ready } : null,
      streets: (g.track.lastDrawnLabels || []).map((r: any) => ({ text: r.text, x: Math.round(r.x), y: Math.round(r.y), angle: r.angle, screenAngle: r.screenAngle, alpha: r.alpha })),
      overlay: els.filter(e => e.opacity !== '0'),
      markers: (g._freeRideMarkers || []).map((m: any) => m.key),
      nearby: (g._freeRideNearby || []).map((p: any) => p.name),
    };
  });
}

/**
 * Label churn while the rider rides on, sampled every animation frame. Each
 * painted street name, place pill and overlay label has a strength (alpha);
 * a "snap" is a jump of more than half its strength in one frame (a pop, the
 * user's complaint); a "flip" is a crossing of half strength either way.
 */
async function flipsPerSecond(page: Page, seconds: number) {
  return page.evaluate((seconds) => new Promise<any>(resolve => {
    const g = (window as any).canalRecallGame, overlay = g.vectorMap?._labelOverlay;
    let prev = new Map<string, number>();
    let flips = 0, snaps = 0, frames = 0, first = true;
    const kinds = { street: { flips: 0, snaps: 0 }, place: { flips: 0, snaps: 0 } } as Record<string, { flips: number; snaps: number }>;
    const t0 = performance.now();
    const tick = () => {
      const now = new Map<string, number>();
      const painted = g.track.lastPaintedLabels || g.track.lastDrawnLabels || [];
      for (const r of painted) {
        const key = `street:${r.text}@${Math.round(r.wx)},${Math.round(r.wy)}`;
        now.set(key, Math.max(now.get(key) ?? 0, r.alpha ?? 1));
      }
      if (overlay) for (const el of overlay.root.querySelectorAll('.l')) {
        const a = Number(getComputedStyle(el as HTMLElement).opacity || 0);
        if (a > 0) now.set(`place:${(el as HTMLElement).dataset.mapLabel}`, a);
      }
      const fade = g._freeRideMarkerFade;
      for (const m of g._freeRideMarkers || []) now.set(`place:pill:${m.key}`, fade ? fade.alpha(m.key) : 1);
      if (fade) for (const key of fade.leftovers?.() || []) if (fade.alpha(key) > 0) now.set(`place:pill:${key}`, fade.alpha(key));
      if (!first) {
        for (const key of new Set([...now.keys(), ...prev.keys()])) {
          const a = prev.get(key) ?? 0, b = now.get(key) ?? 0;
          const kind = kinds[key.split(':')[0]];
          if (Math.abs(b - a) > 0.5) { snaps++; kind.snaps++; }
          if ((a >= 0.5) !== (b >= 0.5)) { flips++; kind.flips++; }
        }
      }
      first = false; prev = now; frames++;
      if (performance.now() - t0 < seconds * 1000) requestAnimationFrame(tick);
      else {
        const per = (n: number) => +(n / seconds).toFixed(2);
        resolve({ seconds, frames, flipsPerS: per(flips), snapsPerS: per(snaps),
          street: { flipsPerS: per(kinds.street.flips), snapsPerS: per(kinds.street.snaps) },
          place: { flipsPerS: per(kinds.place.flips), snapsPerS: per(kinds.place.snaps) } });
      }
    };
    requestAnimationFrame(tick);
  }), seconds);
}

async function settle(page: Page) {
  await page.waitForFunction(() => ((window as any).canalRecallGame._streetLabelOcclusion?.stats.features ?? 0) > 500, null, { timeout: 90_000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(5000);
}

test('labels 2026-10-30: Oosterdok and Kattenburg in pitched Free Ride', async ({ page }, info) => {
  test.setTimeout(400_000);
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await openFreeRide(page);
  const report: Record<string, unknown> = {};
  for (const spot of [OOSTERDOK, KLIMMUUR, KATTENBURG]) {
    await park(page, spot);
    await settle(page);
    report[spot.name] = await probe(page);
    await page.screenshot({ path: `${dir}/${spot.name}-${TAG}.png` });
  }
  // A scripted ride along De Ruijterkade: label churn per second.
  // 2. The overlay's own element for Klimmuur Centraal wears the pill, whatever the distance.
  report.klimmuurLook = await page.evaluate(() => {
    const overlay = (window as any).canalRecallGame.vectorMap._labelOverlay;
    const c = overlay?.candidates?.find((x: any) => /Klimmuur Centraal/.test(x.name));
    if (!c) return null;
    overlay.syncPills((window as any).canalRecallGame);
    return { id: c.id, cls: overlay.element(c).className };
  });
  // 3. North-up / heading-up tilt the map 14°: the sightline test runs there too.
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.viewMode = 'heading'; g.camera.viewMode = 'heading'; });
  await park(page, OOSTERDOK);
  await page.waitForTimeout(3000);
  report.headingOcclusion = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return { pitch: g.vectorMap.map.getPitch(), active: g._streetLabelOcclusion.index.ready && (g._streetLabelOcclusion.stats.tested + g._streetLabelOcclusion.stats.hidden) > 0, stats: g._streetLabelOcclusion.stats };
  });
  await page.screenshot({ path: `${dir}/oosterdok-heading-${TAG}.png` });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.viewMode = 'chase'; g.camera.viewMode = 'chase'; });
  // Ride east along De Ruijterkade / Piet Heinkade with the throttle held.
  await park(page, { name: 'ride', at: OOSTERDOK.at, face: [4.91500, 52.38000] });
  await page.locator('#gameCanvas').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(800);
  report.ride = await flipsPerSecond(page, 10);
  await page.keyboard.up('ArrowUp');
  writeFileSync(`${dir}/report-${TAG}.json`, JSON.stringify(report, null, 1));
  console.log(info.project.name, JSON.stringify(report.ride));
  const oosterdok = report.oosterdok as any, kattenburg = report.kattenburg as any, klimmuur = report.klimmuur as any;
  expect(oosterdok.freeRide).toBe(true);
  if (process.env.LABELS_PROBE || process.env.LABELS_BEFORE_DIR) return;
  // 1. Labels fade: almost no label pops in or out in one frame.
  expect((report.ride as any).snapsPerS, 'label pops per second on the ride').toBeLessThan(0.5);
  // 2. One look per place: no landmark plaque for a place Free Ride marks with a pill.
  for (const view of [oosterdok, klimmuur, kattenburg]) {
    expect(view.overlay.filter((e: any) => /Klimmuur/.test(e.name) && !/\bpill\b/.test(e.cls)), 'Klimmuur Centraal only ever as a pill').toEqual([]);
  }
  expect((report.klimmuurLook as any)?.cls, 'Klimmuur Centraal overlay element').toMatch(/\bpill\b/);
  // 3. The occlusion test runs in pitched Free Ride and hides names behind the Oosterdok buildings,
  //    and in the 14° heading-up view as well.
  expect(oosterdok.occlusion?.ready, 'sightline index ready').toBe(true);
  expect(oosterdok.occlusion?.hidden.length, 'names behind Oosterdokseiland hidden').toBeGreaterThan(0);
  expect((report.headingOcclusion as any).active, 'occlusion runs in heading-up').toBe(true);
  // 4. Every street name follows its street's on-screen direction and stays upright.
  for (const view of [oosterdok, kattenburg]) {
    for (const s of view.streets) {
      expect(Math.abs(s.screenAngle), `${s.text} upright`).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
    }
  }
});
