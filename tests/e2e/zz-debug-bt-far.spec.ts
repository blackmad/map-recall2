import { test } from '@playwright/test';
import { openRoute } from './helpers';
test('debug far layers', async ({ page }) => {
  test.setTimeout(400_000);
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false, query: '?buildingTypes=1' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  await page.evaluate(() => { const g = (window as any).canalRecallGame, map = g.vectorMap.map; for (const k of ['jumpTo','easeTo','flyTo','setCenter','setZoom','setBearing','setPitch']) { map['__'+k] = map[k]; map[k] = () => map; } g.vectorMap._signatureLandmarks.setSuspended?.(false); map.__jumpTo.call(map, { center: [4.829277, 52.3724985], zoom: 17.2, pitch: 62, bearing: 231 }); });
  await page.waitForTimeout(40000);
  const out = await page.evaluate(() => {
    const a = (window as any).__canalRecallBuildingTypes || {};
    const r: any = {};
    for (const k of ['sloterplas-towers', 'rh2-09']) { const b = a[k]; if (!b) { r[k] = 'missing'; continue; }
      r[k] = { stats: b.stats(), group: { visible: b.group.visible, parentVisible: b.group.parent?.visible, children: b.group.children.map((c: any) => [c.name, c.visible, c.count, c.geometry?.index?.count ?? c.geometry?.attributes?.position?.count, c.frustumCulled, c.boundingSphere ? Math.round(c.boundingSphere.radius) : null]) } }; }
    return r;
  });
  for (const [k, v] of Object.entries(out) as any) { if (typeof v === "string") { console.log(k, v); continue; } console.log(k, JSON.stringify(v.stats), "groupVis", v.group.visible); for (const c of v.group.children) if (/\/far\/|\/merged/.test(c[0])) console.log("  ", JSON.stringify(c)); }
});
