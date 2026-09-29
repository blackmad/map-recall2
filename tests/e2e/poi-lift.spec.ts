import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-29, "can we move the map POI labels
// up onto the buildings instead of being on the ground?"). Under a pitched
// camera, landmark and shop names sat on the pavement. They are now lifted in
// screen space by a 12 m roofline at the current zoom and pitch; stations and
// tram stops stay on the street, and so do our landmark dots, which include
// trees and memorials.
test('pitched chase lifts landmark and shop labels onto the buildings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map styling; one project is enough');
  test.setTimeout(150000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getPitch()), { timeout: 30000 }).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._poiLiftPitch ?? null)).not.toBeNull();
  const result = await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    const layers = (window as any).CanalRecallOrientationPois.basemapOrientationPoiLayerIds(map.getStyle().layers);
    // Evaluate each translate expression at the live zoom. The style's own
    // evaluated value can lag at the zoom of its last recalculation.
    const zoom = map.getZoom();
    const liftAt = (id: string, property: string) => {
      if (!map.getLayer(id)) return 0;
      const value = map.getPaintProperty(id, property);
      if (!Array.isArray(value)) return 0;
      if (value[0] !== 'interpolate') return typeof value[1] === 'number' ? value[1] : 0;
      const [, , , z0, [, v0], z1, [, v1]] = value;
      return v0[1] + (v1[1] - v0[1]) * (2 ** (zoom - z0) - 1) / (2 ** (z1 - z0) - 1);
    };
    return {
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      liftPitch: (window as any).canalRecallGame.vectorMap._poiLiftPitch,
      labels: liftAt('brand-poi-labels', 'text-translate'),
      landmarks: liftAt('poi-labels', 'text-translate'),
      dots: liftAt('brand-poi-dots', 'circle-translate'),
      shops: layers.filter((id: string) => !/transit/.test(id)).map((id: string) => liftAt(id, 'text-translate')),
      transit: layers.filter((id: string) => /transit/.test(id)).map((id: string) => liftAt(id, 'text-translate')),
      anchor: map.getPaintProperty('brand-poi-labels', 'text-translate-anchor'),
      // Lifted onto a facade is no use under the wall ("Café De Jo…" cut off).
      belowBuildings: layers.filter((id: string) => {
        const order = map.getStyle().layers.map((layer: any) => layer.id);
        return order.indexOf(id) < order.indexOf('osm-colored-building-roofs');
      }),
    };
  });
  expect(result.anchor).toBe('viewport');
  expect(result.belowBuildings, 'shop and café labels draw above the buildings').toEqual([]);
  expect(result.labels, JSON.stringify(result)).toBeLessThan(-10);
  expect(result.dots).toBe(result.labels);
  expect(result.shops.length).toBeGreaterThan(0);
  for (const lift of result.shops) expect(lift).toBe(result.labels);
  for (const lift of result.transit) expect(lift).toBe(0);
  // Landmarks include trees and memorials on open ground (Bevrijdingslinde).
  expect(result.landmarks, 'landmark dots and labels stay on their ground point').toBe(0);
});
