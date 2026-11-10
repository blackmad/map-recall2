/**
 * Demo shots: drop the rider in front of named buildings and places and save a chase-camera screenshot per spot.
 * Not part of check:canal. Run: PW_PORT=4425 DEMO_OUT=artifacts/demo-20261013 npx playwright test demo-shots --project=desktop
 * Spots come from DEMO_SPOTS (comma-separated names) or default to all.
 */
import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

type Spot = { name: string; centre: [number, number]; standDeg: number; standM: number; query?: string; faceDeg?: number; view?: 'chase' | 'cockpit'; camZoom?: number };

const SPOTS: Spot[] = [
  { name: 'police-van-leijenberghlaan', centre: [4.8799828, 52.3311922], standDeg: 262, standM: 48 },
  { name: 'leidsestraat-67', centre: [4.8853524, 52.3651691], standDeg: 323, standM: 34 },
  { name: 'oosterkerk', centre: [4.9193125, 52.3699834], standDeg: 225, standM: 52 },
  { name: 'mozes-en-aaronkerk', centre: [4.9032433, 52.3682715], standDeg: 215, standM: 58 },
  { name: 'de-duif', centre: [4.8967391, 52.3612861], standDeg: 344, standM: 30 },
  { name: 'obrechtkerk', centre: [4.8746329, 52.3557558], standDeg: 67, standM: 60 },
  { name: 'hotel-de-l-europe', centre: [4.8941808, 52.3675477], standDeg: 237, standM: 62 },
  { name: 'da-costakade-13', centre: [4.8736692, 52.3727839], standDeg: 327, standM: 34 },
  { name: 'waag', centre: [4.9003229, 52.3727714], standDeg: 200, standM: 52 },
  { name: 'westerkerk-default', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 72 },
  { name: 'osdorpplein-flat', centre: [4.8076, 52.3585], standDeg: 0, standM: 0, faceDeg: 20 },
  { name: 'osdorpplein-own-ground', centre: [4.8076, 52.3585], standDeg: 0, standM: 0, faceDeg: 20, query: '?ownGround=1' },
  { name: 'street-police', centre: [4.8799828, 52.3311922], standDeg: 262, standM: 40, view: 'cockpit' },
  { name: 'street-leidsestraat-67', centre: [4.8853524, 52.3651691], standDeg: 323, standM: 26, view: 'cockpit' },
  { name: 'street-oosterkerk', centre: [4.9193125, 52.3699834], standDeg: 225, standM: 45, view: 'cockpit' },
  { name: 'street-mozes-en-aaronkerk', centre: [4.9032433, 52.3682715], standDeg: 215, standM: 50, view: 'cockpit' },
  { name: 'street-hotel-de-l-europe', centre: [4.8941808, 52.3675477], standDeg: 237, standM: 55, view: 'cockpit' },
  { name: 'street-westerkerk-default', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 60, view: 'cockpit' },
  { name: 'street-osdorp-sloterplas-own-ground', centre: [4.8130, 52.3600], standDeg: 0, standM: 0, faceDeg: 300, view: 'cockpit', query: '?ownGround=1' },
  { name: 'street-politie-oost-zeeburg', centre: [4.9715896, 52.3690872], standDeg: 131, standM: 70 },
  { name: 'street-politie-zuidoost-gaasperdam', centre: [4.9741204, 52.2971764], standDeg: 255, standM: 55 },
  { name: 'hoofdbureau-elandsgracht', centre: [4.87779, 52.3677401], standDeg: 205, standM: 95 },
  { name: 'street-hoofdbureau-marnixstraat', centre: [4.87779, 52.3677401], standDeg: 300, standM: 70, view: 'cockpit' },
  { name: 'street-westerkerk-citylook', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 60, view: 'cockpit', query: '?cityLook=1' },
  { name: 'street-dam-citylook', centre: [4.8926, 52.3731], standDeg: 180, standM: 60, view: 'cockpit', query: '?cityLook=1' },
  { name: 'street-dam-default', centre: [4.8926, 52.3731], standDeg: 180, standM: 60, view: 'cockpit' },
  { name: 'kattenburg-quadrangle', centre: [4.9099367, 52.3645834], standDeg: 160, standM: 110 },
  { name: 'street-heinekenplein-block', centre: [4.8924996, 52.3575303], standDeg: 95, standM: 60, view: 'cockpit' },
  { name: 'bilderdijk-recipe-tiles', centre: [4.8705, 52.3688], standDeg: 250, standM: 70, query: '?recipeTiles=1' },
  { name: 'bilderdijk-legacy', centre: [4.8705, 52.3688], standDeg: 250, standM: 70 },
  { name: 'street-politie-nz-voorburgwal', centre: [4.8944721, 52.3764406], standDeg: 179, standM: 45, view: 'cockpit' },
  { name: 'street-entrepotdok', centre: [4.9131356, 52.3693617], standDeg: 20, standM: 55, view: 'cockpit' },
  { name: 'entrepotdok-aerial', centre: [4.9131356, 52.3693617], standDeg: 30, standM: 120 },
  { name: 'street-politie-watergraafsmeer', centre: [4.9272823, 52.3575278], standDeg: 69, standM: 45, view: 'cockpit' },
  { name: 'street-politie-postjesweg', centre: [4.8387086, 52.363678], standDeg: 135, standM: 45, view: 'cockpit' },
  { name: 'roofs-bonboon-rozenstraat', centre: [4.88216, 52.37317], standDeg: 200, standM: 40 },
  { name: 'roofs-bonboon-street', centre: [4.88216, 52.37317], standDeg: 200, standM: 40, view: 'cockpit' },
  { name: 'roofs-hang-rozenstraat', centre: [4.88255, 52.37274], standDeg: 270, standM: 40 },
  { name: 'roofs-bilderdijkstraat', centre: [4.871021, 52.372319], standDeg: 250, standM: 40 },
  { name: 'roofs-bilderdijkstraat-saddle', centre: [4.871021, 52.372319], standDeg: 250, standM: 40, view: 'cockpit' },
  { name: 'roofs-nieuw-west', centre: [4.8130, 52.3600], standDeg: 150, standM: 45 },
  { name: 'sheds-willem-de-zwijgerlaan', centre: [4.86188, 52.37650], standDeg: 90, standM: 50 },
  { name: 'allotments-nut-en-genoegen', centre: [4.85995, 52.38705], standDeg: 180, standM: 70 },
  { name: 'allotments-sloterdijkermeer', centre: [4.85119, 52.38726], standDeg: 180, standM: 70 },
  { name: 'aerial-singelgracht', centre: [4.8795, 52.3715], standDeg: 0, standM: 0, faceDeg: 20, camZoom: 0.16 },
  // Transvaalbuurt round 3 (#152): the first installed 1911 rows, seen from mid-street.
  { name: 'transvaal3-retiefstraat-69-73', centre: [4.9218115, 52.3553544], standDeg: 333, standM: 8, view: 'cockpit' },
  { name: 'transvaal3-pretoriusstraat-79-87', centre: [4.9211937, 52.3544948], standDeg: 334, standM: 7, view: 'cockpit' },
  { name: 'transvaal3-pretoriusstraat-86-90', centre: [4.9209401, 52.3546185], standDeg: 154, standM: 7, view: 'cockpit' },
  // Transvaalbuurt 1929-31 (#153): the 1931 two-storey rows of Vaalrivierstraat and Kraaipanstraat.
  { name: 'transvaal1929-vaalrivierstraat-8-10', centre: [4.9181592, 52.352046], standDeg: 54, standM: 7, view: 'cockpit' },
  { name: 'transvaal1929-kraaipanstraat-63-65', centre: [4.9182174, 52.3516356], standDeg: 324, standM: 7, view: 'cockpit' },
  // Transvaalbuurt 1920-1922 rows (#154): the five-storey flat row on Retiefstraat, the three-storey oriel rows.
  { name: 'transvaal1920-retiefstraat-246-252', centre: [4.9210586, 52.3552715], standDeg: 153, standM: 8, view: 'cockpit' },
  { name: 'transvaal1920-retiefstraat-194-204', centre: [4.921788, 52.3555028], standDeg: 153, standM: 8, view: 'cockpit' },
  { name: 'transvaal1920-de-la-reijstraat-29-37', centre: [4.9194596, 52.351899], standDeg: 234, standM: 7, view: 'cockpit' },
  { name: 'transvaal1920-kraaipanstraat-43-45', centre: [4.9197584, 52.3522057], standDeg: 54, standM: 7, view: 'cockpit' },
  { name: 'transvaal1920-transvaalkade-103-105', centre: [4.9193327, 52.3515715], standDeg: 144, standM: 10, view: 'cockpit' },
  // Transvaalbuurt 1926-1928 (#155): the Danie Theronstraat band rows and President Steynstraat 9-15, seen from mid-street.
  { name: 'transvaal1926-theronstraat-25-31', centre: [4.9158006, 52.352054], standDeg: 283, standM: 8, view: 'cockpit' },
  { name: 'transvaal1926-theronstraat-20-26', centre: [4.9154452, 52.3521013], standDeg: 103, standM: 8, view: 'cockpit' },
  { name: 'transvaal1926-steynstraat-9-15', centre: [4.9161591, 52.3510951], standDeg: 299, standM: 7, view: 'cockpit' },
  // Landmark lanes 2026-11-01: Huis met de Hoofden from the far Keizersgracht quay, the Lensbomen on the Binnengasthuis square.
  { name: 'huis-met-de-hoofden', centre: [4.8858, 52.3773], standDeg: 120, standM: 30, faceDeg: 300, view: 'cockpit' },
  { name: 'lensbomen', centre: [4.8944688, 52.3686724], standDeg: 20, standM: 16, faceDeg: 200, view: 'cockpit' },
  // Museumkwartier A (#159): the first Cornelis Schuytbuurt gable-balcony row, seen from mid-street.
  { name: 'museum-a-breestraat-123-129', centre: [4.8724874, 52.3557232], standDeg: 337, standM: 9, view: 'cockpit' },
  { name: 'museum-a-breestraat-123-129-chase', centre: [4.8724874, 52.3557232], standDeg: 337, standM: 30 },
  // Duivelseiland 1899 corbel-cornice rows (#160): Cornelis Anthoniszstraat 62-70, Balthasar Floriszstraat 2A-8 and 20-26.
  { name: 'museum-de-anthoniszstraat-62-70', centre: [4.8857712, 52.3538079], standDeg: 343, standM: 8, view: 'cockpit' },
  { name: 'museum-de-floriszstraat-2a-8', centre: [4.8844596, 52.3530517], standDeg: 345, standM: 8, view: 'cockpit' },
  { name: 'museum-de-floriszstraat-20-26', centre: [4.8853927, 52.3531919], standDeg: 348, standM: 8, view: 'cockpit' },
  // Hondecoeterbuurt glazed-oriel row and Johannes Vermeerbuurt lintel-parapet row (#160).
  { name: 'museum-hc-wouwermanstraat-18-10', centre: [4.8795164, 52.3551376], standDeg: 159, standM: 8, view: 'cockpit' },
  { name: 'museum-jv-maesstraat-47-61', centre: [4.8822975, 52.3550121], standDeg: 340, standM: 8, view: 'cockpit' },
  // Transvaalbuurt 1911 variants (#156): flat white dormers, a shared gable, lone stair blocks with wall dormers.
  { name: 'transvaal1911b-transvaalstraat-39-41', centre: [4.9263594, 52.3552451], standDeg: 333, standM: 8, view: 'cockpit' },
  { name: 'transvaal1911b-transvaalstraat-42-44', centre: [4.9256896, 52.3551322], standDeg: 138, standM: 8, view: 'cockpit' },
  { name: 'transvaal1911b-retiefstraat-57', centre: [4.9223555, 52.3555254], standDeg: 333, standM: 8, view: 'cockpit' },
  { name: 'transvaal1911b-retiefstraat-65a', centre: [4.9220452, 52.3554271], standDeg: 333, standM: 8, view: 'cockpit' },
  { name: 'transvaal1911b-pretoriusstraat-23', centre: [4.9261931, 52.3559380], standDeg: 336, standM: 8, view: 'cockpit' },
  { name: 'transvaal1911b-paardekraalstraat-13', centre: [4.9252210, 52.3551335], standDeg: 220, standM: 8, view: 'cockpit' },
  // Transvaalbuurt round 5 (#158): the 1930-31 designs, seen from mid-street.
  { name: 'transvaal5b-luthulistraat-6-20', centre: [4.9196105, 52.3531229], standDeg: 119, standM: 30, view: 'cockpit' },
  { name: 'transvaal5b-luthulistraat-22-32', centre: [4.9191358, 52.3527690], standDeg: 144, standM: 30, view: 'cockpit' },
  { name: 'transvaal5b-afrikanerplein-33-51', centre: [4.9171430, 52.3518849], standDeg: 315, standM: 30, view: 'cockpit' },
  { name: 'transvaal5b-schalkburgerstraat-59-77', centre: [4.9209948, 52.3530040], standDeg: 234, standM: 30, view: 'cockpit' },
  { name: 'transvaal5b-schalkburgerstraat-99-115', centre: [4.9213461, 52.3527139], standDeg: 234, standM: 30, view: 'cockpit' },
  { name: 'aerial-westerdok', centre: [4.8860, 52.3840], standDeg: 0, standM: 0, faceDeg: 20, camZoom: 0.16 },
  // House line H1 (#337): the Nieuwmarkt 4-22 row by the Waag at the user's 2026-11-09 photo pose (register gables), and
  // a Kinkerstraat block face whose HouseSpec bays and measured walls reach the generic path (live tiles, before/after).
  { name: 'nieuwmarkt-row', centre: [4.89976, 52.37282], standDeg: 75, standM: 55 },
  { name: 'nieuwmarkt-row-live', centre: [4.89976, 52.37282], standDeg: 75, standM: 55, query: '?world=live' },
  { name: 'kinker-244-332-specs-off', centre: [4.86405, 52.36545], standDeg: 335, standM: 22, view: 'cockpit', query: '?world=live&houseSpecs=0' },
  { name: 'kinker-244-332-specs-on', centre: [4.86405, 52.36545], standDeg: 335, standM: 22, view: 'cockpit', query: '?world=live' },
];
// DEMO_DPR=2: desktop shots at device pixel ratio 2 (house line frames).
if (process.env.DEMO_DPR) test.use({ deviceScaleFactor: Number(process.env.DEMO_DPR) });

const OUT = process.env.DEMO_OUT ?? 'artifacts/demo';
const only = process.env.DEMO_SPOTS?.split(',').filter(Boolean);

function standpoint(s: Spot): { lng: number; lat: number; bearing: number } {
  const b = s.standDeg * Math.PI / 180;
  const dLat = s.standM * Math.cos(b) / 111320;
  const dLng = s.standM * Math.sin(b) / (111320 * Math.cos(s.centre[1] * Math.PI / 180));
  return { lng: s.centre[0] + dLng, lat: s.centre[1] + dLat, bearing: s.faceDeg ?? (s.standDeg + 180) % 360 };
}

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

for (const spot of SPOTS) {
  if (only && !only.includes(spot.name)) continue;
  test(`demo shot: ${spot.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    // The iphone project keeps its own viewport (phone frames); every other project shoots 1440 x 900.
    if (test.info().project.name !== 'iphone') await page.setViewportSize({ width: 1440, height: 900 });
    if (process.env.DEMO_LOG) {
      page.on('response', r => { if (r.status() >= 400) console.log(`HTTP ${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => console.log(`FAILED ${r.url()} ${r.failure()?.errorText}`));
      page.on('console', m => { if (m.type() === 'error' || /ordinary|recipe-large/i.test(m.text())) console.log(`CONSOLE ${m.type()} ${m.text().slice(0, 300)}`); });
    }
    await openRoute(page, { travelMode: 'car', query: spot.query ?? '', abortHeavyTiles: true });
    // Cockpit is no longer a player choice; these street captures still set
    // the camera directly for the low view.
    if (spot.view === 'cockpit') {
      await page.evaluate(() => {
        const g = (window as any).canalRecallGame;
        g.viewMode = 'cockpit';
        g.camera.viewMode = 'cockpit';
        g.camera.northUp = false;
      });
    }
    const p = standpoint(spot);
    await teleport(page, p);
    await page.waitForTimeout(2500);
    await teleport(page, p); // the game re-routes after the first jump; pin the spot again
    if (spot.camZoom) await page.evaluate(z => { (window as any).canalRecallGame.camera.zoom = z; }, spot.camZoom);
    await page.waitForTimeout(Number(process.env.DEMO_WAIT ?? 6000));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${spot.name}.png` });
  });
}
