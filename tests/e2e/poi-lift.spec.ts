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

// Named regression (user requests 2026-09-29, "should we just implement our
// own POI later?" / "for POI layer we can also do our own filtering"). Our own
// layer replaces the basemap's: the basemap POIs are hidden, ours draw above
// the buildings, each height band on its own roofline, outdoor places on the
// ground, and no label names a quiz-eligible street.
test('our own POI layer replaces the basemap and sits on each building\'s roofline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map styling; one project is enough');
  test.setTimeout(150000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._ownPoisActive ?? false), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getPitch()), { timeout: 30000 }).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._poiLiftPitch ?? null)).not.toBeNull();
  const result = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    const lib = (window as any).CanalRecallOrientationPois;
    const zoom = map.getZoom();
    const liftAt = (id: string) => {
      const value = map.getPaintProperty(id, 'text-translate');
      if (!Array.isArray(value) || value[0] !== 'interpolate') return 0;
      const [, , , z0, [, v0], z1, [, v1]] = value;
      return v0[1] + (v1[1] - v0[1]) * (2 ** (zoom - z0) - 1) / (2 ** (z1 - z0) - 1);
    };
    const order = map.getStyle().layers.map((layer: any) => layer.id);
    const lift: Record<string, number> = {};
    for (const band of lib.OWN_POI_BANDS) lift[band] = liftAt(lib.ownPoiLayerIds(band).labels);
    const basemapVisible = lib.basemapOrientationPoiLayerIds(map.getStyle().layers)
      .filter((id: string) => map.getLayoutProperty(id, 'visibility') !== 'none');
    const ownIds = lib.OWN_POI_BANDS.flatMap((band: string) => Object.values(lib.ownPoiLayerIds(band)));
    const features = vm._ownPoiData?.features ?? [];
    const spoiled = features.filter((f: any) => vm._spoils(f.properties.name)).map((f: any) => f.properties.name);
    return {
      lift, basemapVisible, count: features.length, spoiled,
      belowBuildings: ownIds.filter((id: string) => order.indexOf(id) < order.indexOf('osm-colored-building-roofs')),
    };
  });
  expect(result.basemapVisible, 'the basemap POIs are hidden').toEqual([]);
  expect(result.count).toBeGreaterThan(1000);
  expect(result.spoiled).toEqual([]);
  expect(result.belowBuildings).toEqual([]);
  expect(result.lift.ground).toBe(0);
  expect(result.lift.low).toBeLessThan(-3);
  expect(result.lift.mid).toBeLessThan(result.lift.low);
  expect(result.lift.high).toBeLessThan(result.lift.mid);

  // A question hides the names, which could answer "where am I?"; the dots stay.
  const quiet = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, lib = (window as any).CanalRecallOrientationPois;
    vm.setQuizQuietMap(true);
    const { dots, labels } = lib.ownPoiLayerIds('mid');
    const state = { dots: vm.map.getLayoutProperty(dots, 'visibility'), labels: vm.map.getLayoutProperty(labels, 'visibility') };
    vm.setQuizQuietMap(false);
    return { ...state, after: vm.map.getLayoutProperty(labels, 'visibility') };
  });
  expect(quiet).toEqual({ dots: 'visible', labels: 'none', after: 'visible' });
});
