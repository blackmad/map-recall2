// Evidence for scripts/check-osm-under-models.ts hits: is the plain extrusion really drawn through the model?
//   OSMU_RUN=1 OSMU_VIEWS='[{"name":"paradiso","center":[4.8838,52.3622],"ids":["NL.IMBAG.Pand.0363100012169473"]}]' PW_PORT=4466 npx playwright test osm-under-models --project=desktop
// Writes artifacts/osm-under/<name>-<project>.png and prints, per id, whether the three.js building layer holds it and whether it is hidden.
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

test.skip(!process.env.OSMU_RUN, 'set OSMU_RUN=1');
type View = { name: string; center: [number, number]; ids: string[]; zoom?: number; pitch?: number; bearing?: number };
const VIEWS: View[] = JSON.parse(process.env.OSMU_VIEWS ?? '[]');
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];

test('osm extrusion under placed models', async ({ page }, info) => {
  test.setTimeout(600_000);
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  await page.evaluate((cam) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
    vm._signatureLandmarks.setSuspended?.(false);
  }, CAM);
  mkdirSync('artifacts/osm-under', { recursive: true });
  for (const v of VIEWS) {
    await page.evaluate((c) => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      map.__jumpTo.call(map, { center: c.center, zoom: c.zoom ?? 18.6, pitch: c.pitch ?? 58, bearing: c.bearing ?? 20 });
    }, v);
    let last = -1, stable = 0;
    for (let t = 0; t < 40 && stable < 4; t++) {
      await page.waitForTimeout(2000);
      const n = await page.evaluate(() => { const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks; return l._entries.length * 1000 + l._pending.size; });
      stable = n === last ? stable + 1 : 0; last = n;
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/osm-under/${v.name}-${info.project.name}.png` });
    const state = await page.evaluate((ids) => {
      const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
      const held = new Set<string>();
      for (const chunk of tb.chunks.values()) for (const id of chunk.ranges?.keys?.() ?? []) held.add(String(id));
      return ids.map((id: string) => ({ id, inLayer: held.has(id), hidden: tb.hidden.has(id) }));
    }, v.ids);
    console.log(v.name, JSON.stringify(state));
  }
});
