import { test } from '@playwright/test';
import { openRoute } from './helpers';

test('shot centraal', async ({ page }, testInfo) => {
  test.setTimeout(200_000);
  await openRoute(page, { travelMode: 'car', viewMode: (process.env.VIEW || 'chase') as any, abortHeavyTiles: false });
  const spots = JSON.parse(process.env.SPOTS || '[[52.3796,4.89855,0.78]]');
  let i = 0;
  for (const [lat, lng, ang] of spots) {
    await page.evaluate(([lat, lng, ang]) => {
      const game = (window as any).canalRecallGame;
      const loader = game.osmLoader;
      const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
      const x = loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng, y = loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat;
      // ang: compass bearing in radians (0 = north, clockwise)
      Object.assign(game.player, { x, y, vx: 0, vy: 0, speed: 0, angle: ang - Math.PI / 2 });
    }, [lat, lng, ang]);
    await page.waitForTimeout(Number(process.env.WAIT || 4000));
    const feats = await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      const vm = g.vectorMap;
      const ll = vm.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
      const p = vm.map.project(ll);
      const src = vm.map.querySourceFeatures('osm-building-appearance').filter((f: any) => String(f.properties.id || '').includes('451533149')).map((f: any) => JSON.stringify(f.properties).slice(0, 300));
      return { status: vm._completeCity && vm._completeCity.status(), src, fromTiles: vm._buildingsFromTiles, r: vm.map.queryRenderedFeatures([p.x, p.y]).map((f: any) => [f.layer.id, f.source, JSON.stringify(f.properties).slice(0, 300)]) };
    });
    console.log(JSON.stringify(feats, null, 1));
    await page.screenshot({ path: `/private/tmp/claude-501/-Users-blackmad-Code-map-recall2/492e0fce-d0f1-4210-9326-28ce1b000c0a/scratchpad/shot-${testInfo.project.name}-${i++}.png` });
  }
});
