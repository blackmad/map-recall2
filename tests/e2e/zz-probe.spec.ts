import { test } from '@playwright/test';
import { openRoute } from './helpers';

test('probe centraal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  test.setTimeout(200_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const out = await page.evaluate((pairsJson) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toXY = (lat: number, lng: number) => ({ x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng, y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat });
    const toLL = (p: any) => [+(loader._lastCenterLat - (p.y - loader._lastOffsetY) / perLat).toFixed(6), +(loader._lastCenterLng + (p.x - loader._lastOffsetX) / perLng).toFixed(6)];
    const res: any = {};
    const pairs: Array<[[number, number], [number, number]]> = JSON.parse(pairsJson);
    res.routes = pairs.map(([a, b]) => {
      const A = toXY(...a), B = toXY(...b);
      const ra = game.track.getNearestRoad(A.x, A.y), rb = game.track.getNearestRoad(B.x, B.y);
      const path = game.track.findRoute({ x: ra.x, y: ra.y }, { x: rb.x, y: rb.y }) || [];
      return path.map((p: any) => { const r = game.track.getNearestRoad(p.x, p.y); return [...toLL(p), game.track.getRoadName(p.x, p.y), r && +r.width.toFixed(1)]; });
    });
    // corridor along Cuyperspassage
    res.samples = [];
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const lat = 52.379251 + (52.380124 - 52.379251) * t, lng = 4.898142 + (4.899005 - 4.898142) * t;
      const p = toXY(lat, lng);
      const r = game.track.getNearestRoad(p.x, p.y);
      res.samples.push([t.toFixed(1), game.track.getRoadName(p.x, p.y), r && +r.dist.toFixed(1), r && +r.width.toFixed(1)]);
    }
    return res;
  }, process.env.PAIRS || '[]');
  console.log(JSON.stringify(out, null, 0));
});
