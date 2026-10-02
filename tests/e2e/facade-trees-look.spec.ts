import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Visual states for the generic facades + stylised trees experiment
// (2026-10-01). Opt-in, since they write screenshots rather than assert looks:
//   LOOK_SHOTS=1 PW_PORT=4402 npx playwright test facade-trees-look --project=desktop --project=iphone
// Each run boots once per look (old flat vs facades + trees), parks the rider
// at a canal-belt and a 20th-century street, and shoots chase and cockpit.
test.skip(!process.env.LOOK_SHOTS, 'set LOOK_SHOTS=1 to capture');

const OUT = process.env.LOOK_DIR || 'artifacts/facades-trees';

/** Named spots: a lng/lat to stand on and a second point to face. */
const SPOTS = [
  // Keizersgracht road along the canal, south of the Leidsegracht: 17th-century canal houses.
  { name: 'canal-belt-keizersgracht', at: [4.884677, 52.366703], face: [4.889273, 52.364094] },
  // Zaanstraat, Spaarndammerbuurt: 1910s–20s Amsterdam School blocks (Het Schip).
  { name: 'amsterdam-school-zaanstraat', at: [4.878776, 52.387715], face: [4.874565, 52.389553] },
  // Burgemeester De Vlugtlaan, Slotermeer: 1950s post-war gallery flats.
  { name: 'nieuw-west-de-vlugtlaan', at: [4.818892, 52.383833], face: [4.818847, 52.384367] },
] as const;

async function parkAt(page: Page, at: readonly number[], face: readonly number[], view: 'chase' | 'cockpit') {
  await page.evaluate(({ at, face, view }) => {
    const g = (window as any).canalRecallGame;
    const L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    // Quiet the quiz so cards do not cover the street in the comparison.
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = view; g.camera.viewMode = view; g.camera.northUp = false;
    g.vectorMap.setTreesVisible(true);
  }, { at, face, view });
}

for (const look of [{ name: 'old', facades: false, trees: false, three: false as boolean | string }, { name: 'new', facades: true, trees: true, three: false }, { name: 'three', facades: true, trees: true, three: true }, { name: 'cartoon', facades: true, trees: true, three: 'cartoon' }, { name: 'photo', facades: true, trees: true, three: 'photo' }]) {
  test(`look: ${look.name}`, async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await page.addInitScript(([facades, trees, three]) => {
      (window as any).__canalRecallFacades = facades;
      (window as any).__canalRecallTrees3d = trees;
      (window as any).__canalRecallBuildings3d = three;
    }, [look.facades, look.trees, look.three]);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    mkdirSync(OUT, { recursive: true });
    for (const spot of SPOTS) {
      for (const view of ['chase', 'cockpit'] as const) {
        await parkAt(page, spot.at, spot.face, view);
        // Streamed tiles, facts and trees land over a few seconds.
        await page.waitForTimeout(view === 'chase' ? 7000 : 3500);
        await parkAt(page, spot.at, spot.face, view);
        await page.waitForTimeout(800);
        const file = `${OUT}/${spot.name}-${view}-${testInfo.project.name}-${look.name}.png`;
        await page.screenshot({ path: file });
      }
    }
    const stats = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap;
      const features = vm.map.querySourceFeatures('osm-building-appearance');
      const withFacade = features.filter((f: any) => f.properties.facade).length;
      const withYear = features.filter((f: any) => Number.isFinite(f.properties.constructionYear)).length;
      return { features: features.length, withFacade, withYear, trees: vm._treeCount ?? null, three: vm._threeBuildings ? vm._threeBuildings.stats() : null, zoom: vm.map.getZoom(), facadeZoom: vm._facadeTileZoom };
    });
    console.log(look.name, testInfo.project.name, JSON.stringify(stats));
    expect(stats.features).toBeGreaterThan(0);
  });
}
