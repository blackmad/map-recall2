import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-29, "can we move the map POI labels
// up onto the buildings instead of being on the ground?"). Under a pitched
// camera, landmark and shop names sat on the pavement. They are now lifted in
// screen space by a 12 m roofline at the current zoom and pitch; stations and
// tram stops stay on the street.
test('pitched chase lifts landmark and shop labels onto the buildings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map styling; one project is enough');
  test.setTimeout(150000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getPitch()), { timeout: 30000 }).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._poiLiftPitch ?? null)).not.toBeNull();
  const result = await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    const layers = (window as any).CanalRecallOrientationPois.basemapOrientationPoiLayerIds(map.getStyle().layers);
    // Evaluate each translate at the live zoom through the style.
    const liftAt = (id: string, property: string) => {
      const layer = map.style.getLayer(id);
      const value = layer?.paint?.get(property);
      return Array.isArray(value) ? value[1] : 0;
    };
    return {
      zoom: map.getZoom(),
      labels: liftAt('poi-labels', 'text-translate'),
      dots: liftAt('poi-dots', 'circle-translate'),
      shops: layers.filter((id: string) => !/transit/.test(id)).map((id: string) => liftAt(id, 'text-translate')),
      transit: layers.filter((id: string) => /transit/.test(id)).map((id: string) => liftAt(id, 'text-translate')),
      anchor: map.getPaintProperty('poi-labels', 'text-translate-anchor'),
    };
  });
  expect(result.anchor).toBe('viewport');
  expect(result.labels, JSON.stringify(result)).toBeLessThan(-10);
  expect(result.dots).toBe(result.labels);
  expect(result.shops.length).toBeGreaterThan(0);
  for (const lift of result.shops) expect(lift).toBe(result.labels);
  for (const lift of result.transit) expect(lift).toBe(0);
});
