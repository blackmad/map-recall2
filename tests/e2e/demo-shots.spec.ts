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
  { name: 'westerkerk-shared-frame', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 72, query: '?sharedFrame=1' },
  { name: 'osdorpplein-flat', centre: [4.8076, 52.3585], standDeg: 0, standM: 0, faceDeg: 20 },
  { name: 'osdorpplein-own-ground', centre: [4.8076, 52.3585], standDeg: 0, standM: 0, faceDeg: 20, query: '?ownGround=1' },
  { name: 'street-police', centre: [4.8799828, 52.3311922], standDeg: 262, standM: 40, view: 'cockpit' },
  { name: 'street-leidsestraat-67', centre: [4.8853524, 52.3651691], standDeg: 323, standM: 26, view: 'cockpit' },
  { name: 'street-oosterkerk', centre: [4.9193125, 52.3699834], standDeg: 225, standM: 45, view: 'cockpit' },
  { name: 'street-mozes-en-aaronkerk', centre: [4.9032433, 52.3682715], standDeg: 215, standM: 50, view: 'cockpit' },
  { name: 'street-hotel-de-l-europe', centre: [4.8941808, 52.3675477], standDeg: 237, standM: 55, view: 'cockpit' },
  { name: 'street-westerkerk-default', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 60, view: 'cockpit' },
  { name: 'street-westerkerk-shared-frame', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 60, view: 'cockpit', query: '?sharedFrame=1' },
  { name: 'street-osdorp-sloterplas-own-ground', centre: [4.8130, 52.3600], standDeg: 0, standM: 0, faceDeg: 300, view: 'cockpit', query: '?ownGround=1' },
  { name: 'street-politie-oost-zeeburg', centre: [4.9715896, 52.3690872], standDeg: 131, standM: 70 },
  { name: 'street-politie-zuidoost-gaasperdam', centre: [4.9741204, 52.2971764], standDeg: 255, standM: 55 },
  { name: 'hoofdbureau-elandsgracht', centre: [4.87779, 52.3677401], standDeg: 205, standM: 95 },
  { name: 'street-hoofdbureau-marnixstraat', centre: [4.87779, 52.3677401], standDeg: 300, standM: 70, view: 'cockpit' },
  { name: 'street-westerkerk-citylook', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 60, view: 'cockpit', query: '?sharedFrame=1&cityLook=1' },
  { name: 'street-dam-citylook', centre: [4.8926, 52.3731], standDeg: 180, standM: 60, view: 'cockpit', query: '?sharedFrame=1&cityLook=1' },
  { name: 'street-dam-default', centre: [4.8926, 52.3731], standDeg: 180, standM: 60, view: 'cockpit' },
  { name: 'kattenburg-quadrangle', centre: [4.9099367, 52.3645834], standDeg: 160, standM: 110 },
  { name: 'street-heinekenplein-block', centre: [4.8924996, 52.3575303], standDeg: 95, standM: 60, view: 'cockpit' },
  { name: 'bilderdijk-recipe-tiles', centre: [4.8705, 52.3688], standDeg: 250, standM: 70, query: '?sharedFrame=1&recipeTiles=1' },
  { name: 'bilderdijk-legacy', centre: [4.8705, 52.3688], standDeg: 250, standM: 70, query: '?sharedFrame=1' },
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
  { name: 'aerial-westerdok', centre: [4.8860, 52.3840], standDeg: 0, standM: 0, faceDeg: 20, camZoom: 0.16 },
];

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
    await page.setViewportSize({ width: 1440, height: 900 });
    if (process.env.DEMO_LOG) {
      page.on('response', r => { if (r.status() >= 400) console.log(`HTTP ${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => console.log(`FAILED ${r.url()} ${r.failure()?.errorText}`));
      page.on('console', m => { if (m.type() === 'error' || /ordinary|recipe-large/i.test(m.text())) console.log(`CONSOLE ${m.type()} ${m.text().slice(0, 300)}`); });
    }
    await openRoute(page, { travelMode: 'car', viewMode: spot.view ?? 'chase', query: spot.query ?? '', abortHeavyTiles: true });
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
