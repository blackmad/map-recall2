// Start-of-ride orientation flight (user idea 2026-09-27: "when the game starts
// it's really hard to get oriented"). The overview must show both pins inside
// the free part of the screen, open wider than the driving zoom even for a
// short hop, and land exactly on the driving camera.

import assert from 'node:assert/strict';
import {
  INTRO_FLIGHT_S, INTRO_HOLD_S, INTRO_MAX_ZOOM_FRACTION, INTRO_MIN_ZOOM,
  INTRO_LANDING_RADIUS_M, introFrame, introLandingArea, introOverview, introPlan, type IntroCamera, type Point,
} from '../src/canalRecall/game/introFlight.ts';

let checks = 0;
const ok = (condition: boolean, message: string): void => { assert.ok(condition, message); checks++; };

const PPM = 3; // PIXELS_PER_METER in constants.js
const PLAY_ZOOM = 0.5;
const phone = { width: 390, height: 664, top: 90, bottom: 170 };
const desktop = { width: 1280, height: 720, top: 70, bottom: 40 };

function toScreen(camera: IntroCamera, point: Point, box: { width: number; height: number }): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + box.width / 2,
    y: (point.y - camera.y) * camera.zoom + box.height / 2,
  };
}

// Both pins land inside the band between the HUD and the controls.
for (const [name, box] of [['phone', phone], ['desktop', desktop]] as const) {
  for (const metres of [300, 1500, 4900, 9000]) {
    for (const angle of [0, 0.7, Math.PI / 2, 2.4]) {
      const start = { x: 1000, y: 2000 };
      const finish = { x: start.x + Math.cos(angle) * metres * PPM, y: start.y + Math.sin(angle) * metres * PPM };
      const camera = introOverview(start, finish, box, PLAY_ZOOM);
      ok(camera.zoom <= PLAY_ZOOM * INTRO_MAX_ZOOM_FRACTION + 1e-9,
        `${name} ${metres} m opens at least ${1 / INTRO_MAX_ZOOM_FRACTION}× wider than driving`);
      for (const [label, point] of [['start', start], ['finish', finish]] as const) {
        const screen = toScreen(camera, point, box);
        ok(screen.x >= 20 && screen.x <= box.width - 20,
          `${name} ${metres} m @${angle.toFixed(1)}: ${label} x=${screen.x.toFixed(0)} on screen`);
        ok(screen.y >= box.top + 20 && screen.y <= box.height - box.bottom - 20,
          `${name} ${metres} m @${angle.toFixed(1)}: ${label} y=${screen.y.toFixed(0)} clear of HUD and controls`);
      }
    }
  }
}

// The flight holds, moves monotonically inward, and lands on the live target.
{
  const from = { x: 0, y: 0, zoom: 0.03 };
  const to = { x: 900, y: -400, zoom: PLAY_ZOOM };
  const plan = introPlan(from);
  const held = introFrame(plan, to, INTRO_HOLD_S * 0.9);
  ok(held.zoom === from.zoom && held.overview === 1 && !held.done, 'holds on the overview first');
  let previous = from.zoom;
  for (let t = INTRO_HOLD_S; t < INTRO_HOLD_S + INTRO_FLIGHT_S; t += 0.05) {
    const frame = introFrame(plan, to, t);
    ok(frame.zoom >= previous - 1e-12, `zoom never backs out (t=${t.toFixed(2)})`);
    ok(frame.zoom <= to.zoom + 1e-9, 'never overshoots the driving zoom');
    previous = frame.zoom;
  }
  const landed = introFrame(plan, to, INTRO_HOLD_S + INTRO_FLIGHT_S + 0.01);
  ok(landed.done && landed.x === to.x && landed.y === to.y && landed.zoom === to.zoom,
    'lands exactly on the driving camera');
  // Half way through in time is not half way in linear zoom: log space keeps
  // the flight from spending its time at altitude and plunging at the end.
  const mid = introFrame(plan, to, INTRO_HOLD_S + INTRO_FLIGHT_S / 2);
  ok(Math.abs(mid.zoom - Math.sqrt(from.zoom * to.zoom)) < 1e-9, 'zooms in log space');
}

// Reduced motion: a still overview, then a cut — never a flight.
{
  const plan = introPlan({ x: 0, y: 0, zoom: 0.03 }, true);
  ok(plan.flight === 0, 'reduced motion has no flight');
  const to = { x: 5, y: 5, zoom: PLAY_ZOOM };
  ok(introFrame(plan, to, plan.hold - 0.01).overview === 1, 'reduced motion still shows the overview');
  ok(introFrame(plan, to, plan.hold).done, 'then cuts straight to driving');
}


// The flight streams buildings only for where it lands: the driving view the
// map last showed when it contains the rider, else a box round the rider.
{
  const rider: [number, number] = [4.9, 52.37];
  const view = { west: 4.897, south: 52.368, east: 4.904, north: 52.373 };
  ok(JSON.stringify(introLandingArea(view, rider)) === JSON.stringify(view), 'landing area is the driving view');
  const elsewhere = { west: 4.95, south: 52.36, east: 4.96, north: 52.365 };
  const box = introLandingArea(elsewhere, rider);
  ok(box.west < rider[0] && box.east > rider[0] && box.south < rider[1] && box.north > rider[1], 'a view elsewhere falls back to the rider');
  ok(Math.abs((box.north - box.south) * 111320 - 2 * INTRO_LANDING_RADIUS_M) < 1, 'fallback box is the landing radius');
  const overview = { west: 4.8, south: 52.33, east: 5.0, north: 52.42 };
  const fromOverview = introLandingArea(overview, rider);
  ok((fromOverview.east - fromOverview.west) < 0.05, 'a city-scale view never becomes the landing area');
  ok(introLandingArea(null, rider).west < rider[0], 'no view falls back to the rider');
}

console.log(`Intro flight checks passed (${checks} assertions).`);
