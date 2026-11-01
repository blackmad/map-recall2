/**
 * Garden-room frames (lane #169): the ride camera over three back-garden courtyards with garden rooms, through the
 * live tile path (`?world=live`; the compiled world-v1 bakes the chunk output and is recompiled by the integrator).
 * Not part of check:canal. Run once per bundle state:
 *   PW_PORT=4817 GR_OUT=staging/outbuildings/after npx playwright test tests/e2e/garden-rooms-shots.spec.ts --workers=1
 */
import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

type Spot = { name: string; centre: [number, number]; standDeg: number; standM: number; camZoom?: number };
const SPOTS: Spot[] = [
  // Canal ring: the Herengracht/Keizersgracht block at 52.3781 (two 2013 garden rooms), from Keizersgracht.
  { name: 'ring-keizersgracht', centre: [4.889662, 52.378095], standDeg: 299, standM: 52 },
  { name: 'ring-keizersgracht-over', centre: [4.889662, 52.378095], standDeg: 299, standM: 52, camZoom: 0.4 },
  // Oud-Zuid: the Dufaystraat / Johannes Verhulststraat block (a 2020 garden room), from Dufaystraat.
  { name: 'oudzuid-dufaystraat', centre: [4.867869, 52.353616], standDeg: 63, standM: 12 },
  { name: 'oudzuid-dufaystraat-over', centre: [4.867869, 52.353616], standDeg: 63, standM: 12, camZoom: 0.4 },
  // De Pijp: Quellijnstraat, the 2018 black garden room behind the south row.
  { name: 'pijp-quellijnstraat', centre: [4.8883448, 52.356625], standDeg: 3, standM: 33 },
  { name: 'pijp-quellijnstraat-over', centre: [4.8883448, 52.356625], standDeg: 3, standM: 33, camZoom: 0.4 },
];
const OUT = process.env.GR_OUT ?? 'staging/outbuildings/frames';
const only = process.env.GR_SPOTS?.split(',').filter(Boolean);

function standpoint(s: Spot) {
  const b = s.standDeg * Math.PI / 180;
  return { lng: s.centre[0] + s.standM * Math.sin(b) / (111320 * Math.cos(s.centre[1] * Math.PI / 180)), lat: s.centre[1] + s.standM * Math.cos(b) / 111320, bearing: (s.standDeg + 180) % 360 };
}
async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

for (const spot of SPOTS) {
  if (only && !only.includes(spot.name)) continue;
  test(`garden rooms: ${spot.name}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
    await openRoute(page, { travelMode: 'car', query: '?world=live', abortHeavyTiles: true });
    const p = standpoint(spot);
    await teleport(page, p);
    await page.waitForTimeout(2500);
    await teleport(page, p);
    if (spot.camZoom) await page.evaluate(z => { (window as any).canalRecallGame.camera.zoom = z; }, spot.camZoom);
    await page.waitForTimeout(Number(process.env.GR_WAIT ?? 8000));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${spot.name}-${info.project.name}.png` });
  });
}

// Close: the ride's own renderer with the camera taken over (as allotment-houses-demo.html does): centred on the room,
// looking at its glass front from the house side, pitch 32 (over the row in between). The rider is road-bound, so it cannot stand in a garden.
const CLOSE: Array<{ name: string; centre: [number, number]; bearing: number; zoom: number; id: string }> = [
  { name: 'ring-close', centre: [4.889662, 52.378095], bearing: 298, zoom: 20.2, id: 'NL.IMBAG.Pand.0363100012241008' },
  { name: 'ring-glass', centre: [4.889662, 52.378095], bearing: 118, zoom: 20.2, id: 'NL.IMBAG.Pand.0363100012241008' },
  { name: 'oudzuid-close', centre: [4.867869, 52.353616], bearing: 336, zoom: 20.2, id: 'NL.IMBAG.Pand.0363100012198818' },
  { name: 'pijp-close', centre: [4.8883448, 52.356625], bearing: 276, zoom: 20.2, id: 'NL.IMBAG.Pand.0363100012248029' },
];
for (const spot of CLOSE) {
  if (only && !only.includes(spot.name)) continue;
  test(`garden rooms: ${spot.name}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
    await openRoute(page, { travelMode: 'car', query: '?world=live', abortHeavyTiles: true });
    await page.waitForTimeout(3000);
    await page.evaluate(async ({ centre, bearing, zoom }) => {
      const game = (window as any).canalRecallGame, v = game.vectorMap;
      if (game._intro) game._updateIntro(60);
      game.camera.introOverview = 0; v.sync(game.camera, game.osmLoader, game.canvas);
      v.sync = () => {}; game.player.update = () => {}; Object.assign(game.player, { speed: 0, vx: 0, vy: 0 });
      const style = document.createElement('style'); style.textContent = '#gameCanvas,#canal-overlay-root,#utility-buttons,#quick-help{display:none!important}'; document.head.append(style);
      v.map.jumpTo({ center: centre, zoom, pitch: 32, bearing });
      v._facadesOutOfZoom = false; v._applyFacadeState(); v._syncFacadeZoom(zoom); v._threeBuildings.setDetailCentre(...centre);
      v._completeCity?.setSuspended(false); v._completeCity?.followCamera(); v.map.triggerRepaint();
    }, spot);
    // The room's own pand must be in a resident near chunk, or the frame shows the placeholder extrusions.
    await page.waitForFunction(id => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return !t.pending.length && !t.inflight.size && !t.pumping && [...t.chunks].some(([key, e]: [string, any]) => key.startsWith('near:') && e.mesh && e.ranges?.has(id)); }, spot.id, { timeout: 150_000 });
    // MapLibre's plain extrusions (the placeholder under a taken-over camera) sat over the gardens as tall tan
    // boxes in some frames: hide them so only the three.js meshes are judged. Close frames only.
    await page.evaluate(() => { const m = (window as any).canalRecallGame.vectorMap.map; for (const l of m.getStyle().layers) if (l.type === 'fill-extrusion') m.setLayoutProperty(l.id, 'visibility', 'none'); m.triggerRepaint(); });
    await page.waitForTimeout(Number(process.env.GR_WAIT ?? 6000));
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${spot.name}-${info.project.name}.png` });
  });
}
