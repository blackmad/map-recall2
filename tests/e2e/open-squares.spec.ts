import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Named regressions (feedback 636a57f4 and 638590e9, 2026-10-25): the bike was
// blocked on the open paving of the Dam and the Leidseplein, because closed
// rings are dropped and only street corridors were rideable. squares.json
// plazas now count as surface (pedestrianAreas.ts); a park square does not.
// The geometry is pinned in scripts/check-canal-car.ts; this checks the wiring.
test('open squares are rideable in the running game, park squares are not', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wiring check; one project is enough');
  test.setTimeout(120_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 60_000 });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const at = (lat: number, lng: number) => {
      const p = game.osmLoader.latLngToWorld(lat, lng);
      const contact = game.track.getGuardRoad(p.x, p.y, 0);
      return contact ? contact.dist - contact.width : Infinity;
    };
    return {
      plazas: game.track.plazaIndex ? game.track.plazaIndex.plazas.length : 0,
      dam: at(52.3729, 4.8925),
      // Feedback 3e7f0aa4: the paving to the Brug 228 landing by the Odebrug (pavedLinks.ts).
      odebrug: at(52.3772221, 4.9032256),
      frederiksplein: at(52.360156, 4.899909),
    };
  });
  expect(result.plazas).toBeGreaterThan(50);
  expect(result.dam).toBeLessThanOrEqual(0);
  expect(result.odebrug).toBeLessThanOrEqual(0);
  expect(result.frederiksplein).toBeGreaterThan(4);
});
