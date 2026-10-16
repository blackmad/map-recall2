import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-10-09, "asked me kinda too late"): the
// card "Which street are you on now? — You made a turn" for the Noordsche
// Compagniebrug opened with the rider already over the Keizersgracht at the
// far quay. The route question settled on time (0.65 s), and at cruise the
// bike covers ~50 m/s of world distance, so the ask came 33 m into the 40 m
// bridge way (17–34 m into every street on this ride). It now also settles on
// distance and opens ~8 m in. The ride also crosses straight on, which is not
// a turn, so the card must not say so.
//
// Since 2026-10-16 (user report, the Niek Engelschmanbrug on the
// Raadhuisstraat) a bridge's name is never the answer to "which street?": the
// deck runs from the Prinsenstraat onto the Herenstraat, carries neither on
// both sides, and is transparent (bridgeStreetName.ts). The ask is now the
// Herenstraat, still a few metres in. The reported deck itself rides from the
// Westermarkt (Homomonument) east onto the Raadhuisstraat towards the
// Herengracht.
const CASES: Array<{ bridge: string; street: string; from: [number, number]; to: [number, number] }> = [
  { bridge: 'Noordsche Compagniebrug', street: 'Herenstraat', from: [52.3779, 4.8867], to: [52.37715, 4.8889] },
  { bridge: 'Niek Engelschmanbrug', street: 'Raadhuisstraat', from: [52.37395, 4.8845], to: [52.37345, 4.8872] },
];
const MAX_METRES_INTO_STREET = 12;

for (const { bridge: BRIDGE, street: STREET_BEYOND, from: FROM, to: TO } of CASES) test(`across the ${BRIDGE} the route question asks the ${STREET_BEYOND} a few metres in, never the bridge`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(180_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const result = await page.evaluate(({ fromLatLng, toLatLng, bridge, street }) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toWorld = ([lat, lng]: [number, number]) => ({
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat,
    });
    const { allNodes } = game.track._routingGraph();
    const snap = (latLng: [number, number]) => {
      const target = toWorld(latLng);
      let best = allNodes[0], bestDistance = Infinity;
      for (const node of allNodes) {
        const distance = Math.hypot(node.x - target.x, node.y - target.y);
        if (distance < bestDistance) { bestDistance = distance; best = node; }
      }
      return best;
    };
    game.state = 6; // PAUSED: this test steps the simulation itself
    // Ask-timing is the subject here, not rationing: ask on every street.
    const player = game.player;
    player.handleInput = () => {};
    game._updateLandmarks = () => {};
    const STEP = 1 / 30;
    const from = snap(fromLatLng), to = snap(toLatLng);
    const path = game.track.findRoute(from, to);
    Object.assign(player, { x: from.x, y: from.y, speed: 0, vx: 0, vy: 0, angle: Math.atan2(path[1].y - from.y, path[1].x - from.x) });
    game.track.finishPoint = { ...to };
    game.track.clearFrameCache();
    game.quizCurrentName = game.track.getRoadName(player.x, player.y, player.angle);
    game.quizCandidateName = '';
    game.quizCandidateTimer = 0;
    game.quizCandidateMetres = 0;
    let index = 1, arrived = false, metres = 0, lastName = game.quizCurrentName;
    const enteredAt: Record<string, number> = {};
    const asks: Array<{ name: string; context: string; metresIn: number; nameUnder: string }> = [];
    for (let elapsed = 0; elapsed < 40 && !arrived; elapsed += STEP) {
      // The driving harness's autopilot: steer for a point ~40 m along the route.
      let nearestDistance = Infinity;
      for (let i = Math.max(0, index - 4); i < Math.min(path.length, index + 24); i++) {
        const d = Math.hypot(path[i].x - player.x, path[i].y - player.y);
        if (d < nearestDistance) { nearestDistance = d; index = i; }
      }
      let lookahead = 0, targetIndex = index;
      while (targetIndex < path.length - 1 && lookahead < 120) {
        lookahead += Math.hypot(path[targetIndex + 1].x - path[targetIndex].x, path[targetIndex + 1].y - path[targetIndex].y);
        targetIndex++;
      }
      const target = path[targetIndex];
      let error = Math.atan2(target.y - player.y, target.x - player.x) - player.angle;
      error = Math.atan2(Math.sin(error), Math.cos(error));
      const cruise = Math.abs(error) > 0.5 ? 60 : 170;
      player.steerInput = Math.max(-1, Math.min(1, error * 2.5));
      player.throttle = player.speed < cruise ? 1 : 0;
      player.brake = player.speed > cruise * 1.6 ? 1 : 0;
      player.handbrake = false;
      game.track.clearFrameCache();
      const before = { x: player.x, y: player.y };
      game._updateRacing(STEP);
      metres += Math.hypot(player.x - before.x, player.y - before.y) / 3;
      game.track.clearFrameCache();
      const name = game.track.getRoadName(player.x, player.y, player.angle);
      if (name && name !== lastName) enteredAt[name] = metres;
      lastName = name;
      if (game.quizPromptName) {
        asks.push({
          name: game.quizPromptName,
          context: game._promptQuestion.textContent,
          metresIn: +(metres - (enteredAt[game.quizPromptName] ?? -Infinity)).toFixed(1),
          nameUnder: name,
        });
        // Answer it and ride on.
        game.quizCurrentName = game.quizPromptName;
        game.quizPromptName = '';
        game._prompt.style.display = 'none';
      }
      arrived = Math.hypot(to.x - player.x, to.y - player.y) < 30;
    }
    game.state = 4;
    return {
      arrived,
      asks,
      bridgeAsk: asks.find(ask => ask.name === bridge) ?? null,
      streetAsk: asks.find(ask => ask.name === street) ?? null,
    };
  }, { fromLatLng: FROM, toLatLng: TO, bridge: BRIDGE, street: STREET_BEYOND });

  expect(result.arrived, JSON.stringify(result)).toBe(true);
  // The bridge's name is not a street: it is never the answer.
  expect(result.bridgeAsk, JSON.stringify(result)).toBeNull();
  expect(result.streetAsk, JSON.stringify(result)).not.toBeNull();
  // Asked within a few metres of riding onto the Herenstraat.
  expect(result.streetAsk!.nameUnder).toBe(STREET_BEYOND);
  expect(result.streetAsk!.metresIn).toBeLessThanOrEqual(MAX_METRES_INTO_STREET);
  // Both rides run straight over the bridge: no turn was made.
  expect(result.streetAsk!.context).not.toBe('You made a turn');
  for (const ask of result.asks) {
    // Since the askable-bridges extract (2026-10-16) both decks are in
    // bridge-crossings.json, so the ride also asks the canal it crosses; that
    // ask is about the water, not a street, and has no metres-into-street (the
    // rider never entered a road of that name). The card's context line is no
    // guide: a street asked just past a deck also reads "Crossing a bridge".
    if (!Number.isFinite(ask.metresIn)) {
      expect(ask.name, JSON.stringify(ask)).toMatch(/gracht$/);
      continue;
    }
    expect(ask.metresIn, JSON.stringify(ask)).toBeLessThanOrEqual(MAX_METRES_INTO_STREET);
    expect(ask.nameUnder, JSON.stringify(ask)).toBe(ask.name);
  }
});
