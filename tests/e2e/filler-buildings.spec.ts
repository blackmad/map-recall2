import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Named regressions for generic city-mesh "filler" buildings around landmarks:
//  - Mövenpick Amsterdam City Centre (Piet Heinkade 11): the hotel tower was suppressed by the
//    Muziekgebouw landmark, leaving only a 43 m² canopy part under the "Mövenpick Hotel" label.
//  - Westerkerk: lean-to shops against the nave and tower and the Westermarkt kiosks.
// Each place gets oblique aerial shots plus a probe of what the streamed tile layer draws there.
//   PW_PORT=4432 npx playwright test filler-buildings --project=desktop
//   FILLER_PLACES=movenpick PW_PORT=4432 npx playwright test filler-buildings
const OUT = 'artifacts/filler-buildings';

type Place = {
  id: string; centre: [number, number]; views: { name: string; bearing: number; distanceM: number; altitudeM: number; targetAltM: number }[];
  /** Ids that must be drawn by the streamed city layer (not suppressed) with at least this height. */
  mustDraw?: Record<string, number>;
  /** Ids that must NOT be drawn by the streamed city layer (a landmark model owns them). */
  mustHide?: string[];
  /** Generic ids drawn plain yellow in the audit shots (offenders from the audit report). */
  highlight?: string[];
  /** Where the rider waits during the probe (default: 60 m toward the first camera). */
  parkAt?: number[];
  /** Ids whose draw state is only reported (source, suppression, three.js layer). */
  inspect?: string[];
};

const PLACES: Place[] = [
  {
    id: 'movenpick', centre: [4.91435, 52.37805], parkAt: [4.9143, 52.3772],
    views: [
      { name: 'from-ij', bearing: 200, distanceM: 260, altitudeM: 70, targetAltM: 25 },
      { name: 'from-piet-heinkade', bearing: 20, distanceM: 220, altitudeM: 45, targetAltM: 25 },
    ],
    mustDraw: { w755464128: 60, w755464126: 15, w755464130: 9 },
    inspect: ['w755464127', 'w755464131', 'w755504263'],
  },
  {
    id: 'westerkerk', centre: [4.88390, 52.37445],
    views: [
      { name: 'from-westermarkt', bearing: 0, distanceM: 120, altitudeM: 45, targetAltM: 6 },
      { name: 'from-keizersgracht', bearing: 255, distanceM: 140, altitudeM: 50, targetAltM: 6 },
      // Close, low: the lean-to shops between the south buttresses and the kiosks on the square.
      { name: 'south-shops', bearing: 350, distanceM: 55, altitudeM: 14, targetAltM: 3 },
      // The tower foot from the Prinsengracht: Prinsengracht 277B/281 against the tower.
      { name: 'tower-foot', bearing: 95, distanceM: 70, altitudeM: 18, targetAltM: 6 },
      // North side: Prinsengracht 277 (former church annex) and Westermarkt 60/62.
      { name: 'north-side', bearing: 160, distanceM: 70, altitudeM: 22, targetAltM: 4 },
    ],
    mustHide: ['w99205257', 'NL.IMBAG.Pand.0363100012164998'],
  },
];

// Audit shots for offenders found by scripts/audit-landmark-filler.ts:
//   FILLER_AT='oba:4.9082,52.3761:w779659694;rai:4.8886,52.3436' PW_PORT=4432 npx playwright test filler-buildings
for (const entry of process.env.FILLER_AT?.split(';').filter(Boolean) ?? []) {
  const [id, at, ids] = entry.split(':'); const [lng, lat] = at.split(',').map(Number);
  PLACES.push({ id, centre: [lng, lat], highlight: ids?.split('+'), views: [
    { name: 'ne', bearing: 225, distanceM: 200, altitudeM: 90, targetAltM: 10 },
    { name: 'sw', bearing: 45, distanceM: 200, altitudeM: 90, targetAltM: 10 },
  ] });
}
const only = process.env.FILLER_PLACES?.split(',') ?? (process.env.FILLER_AT ? process.env.FILLER_AT.split(';').map(e => e.split(':')[0]) : undefined);
const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number) => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

async function parkAt(page: Page, at: number[]) {
  await page.evaluate(({ at }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * (window as any).PIXELS_PER_METER_VALUE;
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = L._lastOffsetX + (at[0] - L._lastCenterLng) * k;
    g.player.y = L._lastOffsetY - (at[1] - L._lastCenterLat) * 111320 * (window as any).PIXELS_PER_METER_VALUE;
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
  }, { at });
}

for (const place of PLACES.filter(p => !only || only.includes(p.id))) {
  test(`filler buildings: ${place.id}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    await page.addInitScript(() => { (window as any).PIXELS_PER_METER_VALUE = 3; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    await parkAt(page, place.centre);
    // Wait until the streamed city layer holds features around the place.
    await page.waitForFunction(({ c }) => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      const near = (f: any) => { const g = f.geometry; const p = g.type === 'Polygon' ? g.coordinates[0][0] : g.coordinates[0][0][0]; return Math.abs(p[0] - c[0]) < 0.002 && Math.abs(p[1] - c[1]) < 0.0015; };
      try { return map.querySourceFeatures('osm-building-appearance').some(near); } catch { return false; }
    }, { c: place.centre }, { timeout: 120_000, polling: 1000 });
    // Then step the rider 60 m off the subject: a building over the rider is hidden ('cover').
    await parkAt(page, place.parkAt ?? ahead(place.centre, place.views[0].bearing + 180, 60));
    await page.waitForTimeout(4000);
    const probe = await page.evaluate(({ c, mustDraw, mustHide, inspectIds }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      const hidden = new Set<string>(vm._signatureSuppressOsmIds().map(String));
      const feats = map.querySourceFeatures('osm-building-appearance');
      const byId = new Map<string, any>();
      for (const f of feats) byId.set(String(f.properties.id), f.properties);
      const draw: Record<string, unknown> = {};
      for (const [id, h] of Object.entries(mustDraw ?? {})) draw[id] = { present: byId.has(id), suppressed: hidden.has(id), height: byId.get(id)?.height ?? null, need: h };
      const hide: Record<string, unknown> = {};
      for (const id of mustHide ?? []) hide[id] = { present: byId.has(id), suppressed: hidden.has(id) };
      const three = vm._threeBuildings;
      const inThree = (id: string) => three ? { hidden: three.hidden?.has(id) ?? null, meshed: [...(three.chunks?.values() ?? [])].some((e: any) => e.ranges?.has(id)) } : null;
      const inspect: Record<string, unknown> = {};
      for (const id of [...Object.keys(mustDraw ?? {}), ...(mustHide ?? []), ...(inspectIds ?? [])]) inspect[id] = { present: byId.has(id), suppressed: hidden.has(id), height: byId.get(id)?.height ?? null, three: inThree(id) };
      return { draw, hide, inspect };
    }, { c: place.centre, mustDraw: place.mustDraw, mustHide: place.mustHide, inspectIds: place.inspect });
    if (place.highlight) await page.evaluate(ids => (window as any).canalRecallGame.vectorMap._threeBuildings?.setHighlighted(ids), place.highlight);
    for (const view of place.views) {
      const eye = ahead(place.centre, view.bearing + 180, view.distanceM);
      // The rider stands under the camera, out of frame, so it does not cover the subject.
      await parkAt(page, eye);
      await page.evaluate(({ eye, alt, target, targetAlt }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, alt, { lng: target[0], lat: target[1] }, targetAlt));
      }, { eye, alt: view.altitudeM, target: place.centre, targetAlt: view.targetAltM });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/${place.id}-${view.name}-${info.project.name}.png` });
    }
    writeFileSync(`${OUT}/${place.id}-${info.project.name}.json`, JSON.stringify(probe, null, 1));
    for (const [id, v] of Object.entries(probe.draw) as [string, any][]) {
      expect(v.suppressed, `${id} suppressed`).toBe(false);
      expect(v.present, `${id} streamed`).toBe(true);
      expect(v.height, `${id} height`).toBeGreaterThanOrEqual(place.mustDraw![id]);
      expect((probe.inspect as any)[id].three?.hidden ?? false, `${id} hidden in the three.js layer`).toBe(false);
    }
    for (const [id, v] of Object.entries(probe.hide) as [string, any][]) expect(v.suppressed || !v.present, `${id} hidden`).toBe(true);
  });
}
