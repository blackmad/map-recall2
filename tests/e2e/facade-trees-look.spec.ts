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
  { name: 'canal-belt-keizersgracht', at: [4.884677, 52.366703], face: [4.88515, 52.36643] },
  // Zaanstraat, Spaarndammerbuurt: 1910s–20s Amsterdam School blocks (Het Schip).
  { name: 'amsterdam-school-zaanstraat', at: [4.878776, 52.387715], face: [4.87831, 52.38792] },
  // Burgemeester De Vlugtlaan, Slotermeer: 1950s post-war gallery flats.
  { name: 'nieuw-west-de-vlugtlaan', at: [4.818892, 52.383833], face: [4.818847, 52.384367] },
  // Rozengracht / Jordaan, the start of a user's race link: dense pitched-roof terraces.
  { name: 'jordaan-rozengracht', at: [4.87826, 52.37278], face: [4.878243, 52.372949] },
  // Akitsu, Da Costabuurt (user screenshots 2026-10-02): raised doors, doors on back walls, broken rhythm on a curved block.
  { name: 'da-costa-akitsu', at: [4.8740, 52.3716], face: [4.875215, 52.372219] },
  { name: 'da-costa-akitsu-n', at: [4.8752, 52.3730], face: [4.875215, 52.372219] },
  { name: 'da-costa-akitsu-e', at: [4.8765, 52.3722], face: [4.875215, 52.372219] },
  // De Hallen, the old tram depot (user report 2026-10-02): a row of hall roofs over one footprint.
  { name: 'de-hallen', at: [4.8668, 52.3684], face: [4.8683, 52.3673] },
  { name: 'de-hallen-s', at: [4.8700, 52.3655], face: [4.8688, 52.3667] },
  // Kinkerstraat shops by De Hallen: painted shopfront ground floors (user report 2026-10-02).
  { name: 'kinkerstraat-shops', at: [4.8688, 52.3652], face: [4.8693, 52.3660] },
  // Centraal Station: a landmark that must keep its own form.
  { name: 'centraal', at: [4.9003, 52.3774], face: [4.9004, 52.3789] },
  // Landmark kits: stand ~55 m from each tower and look straight at it.
  { name: 'k-westerkerk', at: [4.88421, 52.37417], face: [4.88351, 52.37452] },
  { name: 'k-zuiderkerk', at: [4.89899, 52.36985], face: [4.89949, 52.37020] },
  { name: 'k-montelbaan', at: [4.90610, 52.37165], face: [4.90566, 52.37203] },
  { name: 'k-noorderkerk', at: [4.88585, 52.37925], face: [4.88642, 52.37966] },
  { name: 'k-palace', at: [4.89105, 52.37230], face: [4.89166, 52.37314] },
  // Real-vs-game comparison spots (house-design/real-vs-game): typical streets per style.
  // The free camera centres on `face` and looks from the side of `at`, so `face` is the facade in the real photo.
  { name: 'rvg-herengracht-230', at: [4.88795, 52.37238], face: [4.886722, 52.37238] }, // 17th c. canal houses
  { name: 'rvg-kinkerstraat', at: [4.8698, 52.36656], face: [4.8710, 52.36672] }, // 19th c. Oud-West street + tram
  { name: 'rvg-kinkerstraat-321', at: [4.87005, 52.36628], face: [4.8700, 52.3660] }, // user's Street View pair: 19th c. terrace with shops, balconies, step gables
  { name: 'rvg-marnixstraat-150', at: [4.87615, 52.37355], face: [4.8762, 52.3733] }, // 19th c. neo-renaissance villa
  { name: 'rvg-spaarndammerstraat-63', at: [4.87936, 52.38920], face: [4.87936, 52.38950] }, // 1930s brick facade
  { name: 'rvg-le-mairestraat', at: [4.8805, 52.3905], face: [4.8805, 52.3909] }, // Amsterdam School corner blocks
  { name: 'rvg-pijp-snow-street', at: [4.89131, 52.35347], face: [4.8905, 52.3538] }, // 19th c. street canyon
  { name: 'rvg-merwedeplein', at: [4.8998, 52.34553], face: [4.8996, 52.3458] }, // Rivierenbuurt Amsterdam School
  { name: 'rvg-knsm-piraeus', at: [4.94206, 52.37416], face: [4.9433, 52.3752] }, // modern harbour housing
  { name: 'rvg-borneo-sporenburg', at: [4.94317, 52.372], face: [4.9445, 52.3724] }, // modern, Borneo island
  { name: 'rvg-brouwersgracht', at: [4.88665, 52.38185], face: [4.8878, 52.3823] }, // canal corner, Jordaan edge
  { name: 'rvg-bijlmer-kelbergenpad', at: [4.96953, 52.31627], face: [4.9705, 52.3164] }, // late-20th c. low-rise
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

for (const look of [{ name: 'old', facades: false, trees: false, three: false as boolean | string }, { name: 'new', facades: true, trees: true, three: false }, { name: 'three', facades: true, trees: true, three: true }, { name: 'storybook', facades: true, trees: true, three: 'storybook' }, { name: 'cartoon', facades: true, trees: true, three: 'cartoon' }, { name: 'photo', facades: true, trees: true, three: 'photo' }]) {
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
    for (const spot of SPOTS.filter(spot => !process.env.LOOK_SPOT || process.env.LOOK_SPOT.split(',').some(prefix => spot.name.startsWith(prefix)))) {
      for (const view of (process.env.LOOK_VIEW ? [process.env.LOOK_VIEW as 'chase' | 'cockpit'] : ['chase', 'cockpit'] as const)) {
        await parkAt(page, spot.at, spot.face, view);
        // Streamed tiles, facts and trees land over a few seconds.
        await page.waitForTimeout(view === 'chase' ? 7000 : 3500);
        await parkAt(page, spot.at, spot.face, view);
        await page.waitForTimeout(800);
        await page.waitForFunction(() => { const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings; if (t && t.stats().buildings <= 3000) { const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-6, c.lat] }); } return !t || t.stats().buildings > 3000; }, null, { timeout: 75_000, polling: 1000 }).catch(() => {});
        await page.waitForTimeout(1500);
        if (process.env.LOOK_FREE) {
          // Free camera: stop the game steering the map, then look straight at the target.
          await page.evaluate(({ at, face, zoom, pitch }) => {
            const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
            vm.sync = () => {}; map.stop();
            const bearing = (Math.atan2((face[0] - at[0]) * Math.cos(face[1] * Math.PI / 180), face[1] - at[1]) * 180) / Math.PI;
            map.jumpTo({ center: face as [number, number], zoom, pitch, bearing });
          }, { at: [...spot.at], face: [...spot.face], zoom: Number(process.env.LOOK_ZOOM) || 18.2, pitch: Number(process.env.LOOK_PITCH) || 68 });
          await page.waitForTimeout(Number(process.env.LOOK_WAIT) || 9000);
        }
        const file = `${OUT}/${spot.name}-${view}-${testInfo.project.name}-${look.name}.png`;
        await page.screenshot({ path: file });
      }
    }
    const stats = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap;
      const features = vm.map.querySourceFeatures('osm-building-appearance');
      const withFacade = features.filter((f: any) => f.properties.facade).length;
      const withYear = features.filter((f: any) => Number.isFinite(f.properties.constructionYear)).length;
      return { features: features.length, withFacade, withYear, trees: vm._treeCount ?? null, three: vm._threeBuildings ? vm._threeBuildings.stats() : null, zoom: vm.map.getZoom(), plainBase: JSON.stringify(vm.map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-base')).slice(0, 300), active: vm._facadesActive(), order: vm.map.getLayersOrder().filter((id: string) => /building|three|poi-lab/.test(id)), facadeZoom: vm._facadeTileZoom };
    });
    console.log(look.name, testInfo.project.name, JSON.stringify(stats));
    expect(stats.features).toBeGreaterThan(0);
  });
}
