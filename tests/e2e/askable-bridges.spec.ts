import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Named regressions (TODO "Bridge decks after the carried-street fix",
// 2026-10-16).
//
// 1. bridges.json was the top 300 bridges by prominence, so 124 bridge names
//    on routed ways were asked by no question once bridgeStreetName.ts stopped
//    asking them as streets. The Noordsche Compagniebrug (Herenstraat over the
//    Keizersgracht) is one: at hard it is now "Which bridge are you on?",
//    asked on the deck, and the plaque never shows the name before the answer.
// 2. The plaque read the raw way name, so on a deck OSM names after the bridge
//    it was blank for the whole span. The Vingboomsbrug carries the
//    Huidenstraat: riding the Huidenstraat over it, the plaque keeps saying
//    Huidenstraat.
//
// PW_BRIDGE_EXTRACT_DIR serves the bridge files from a staged extract
// (scripts/build-askable-bridges.ts) instead of the published one, so the
// change can be ridden before it is published.

const STAGED = process.env.PW_BRIDGE_EXTRACT_DIR;
const STAGED_FILES = ['bridges.json', 'bridge-crossings.json', 'bridge-register.json', 'manifest.json'];

async function serveStagedBridges(page: Page): Promise<void> {
  if (!STAGED) return;
  for (const file of STAGED_FILES) {
    const body = readFileSync(resolve(STAGED, file), 'utf8');
    await page.route(new RegExp(`/data/extracts/amsterdam/${file.replace('.', '\\.')}(\\?.*)?$`),
      route => route.fulfill({ status: 200, contentType: 'application/json', body }));
  }
}

interface Ride {
  arrived: boolean;
  asks: Array<{ name: string; subject: string; nameUnder: string }>;
  /** Plaque readings while on the deck, before and after its question. */
  deckPlaques: string[];
}

async function ride(page: Page, from: [number, number], to: [number, number], deck: string,
  difficulty: string, startName: string | null): Promise<Ride> {
  return page.evaluate(({ fromLatLng, toLatLng, deckName, routeDifficulty, start }) => {
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
    game.routeDifficulty = routeDifficulty;
    game.state = 6; // PAUSED: this test steps the simulation itself
    const player = game.player;
    player.handleInput = () => {};
    game._updateLandmarks = () => {};
    // Ask on every street: rationing is not the subject.
    game._budgetForRouteName = () => ({ action: 'ask' });
    let plaque: string | null = null;
    game.hud.drawPlaque = (_ctx: unknown, opts: { routeName?: string }) => { plaque = opts.routeName || ''; };
    const STEP = 1 / 30;
    const from = snap(fromLatLng), to = snap(toLatLng);
    const path = game.track.findRoute(from, to);
    Object.assign(player, { x: from.x, y: from.y, speed: 0, vx: 0, vy: 0, angle: Math.atan2(path[1].y - from.y, path[1].x - from.x) });
    game.track.finishPoint = { ...to };
    game.track.clearFrameCache();
    game.quizCurrentName = start ?? game.track.getRoadName(player.x, player.y, player.angle);
    game.quizCandidateName = '';
    game.quizCandidateTimer = 0;
    game.quizCandidateMetres = 0;
    let index = 1, arrived = false;
    const asks: Array<{ name: string; subject: string; nameUnder: string }> = [];
    const deckPlaques: string[] = [];
    for (let elapsed = 0; elapsed < 40 && !arrived; elapsed += STEP) {
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
      game._updateRacing(STEP);
      game.track.clearFrameCache();
      const name = game.track.getRoadName(player.x, player.y, player.angle);
      if (name === deckName) {
        plaque = null;
        game._render();
        // A frame that draws no plaque (an open question card) has nothing to read.
        if (plaque !== null) {
          deckPlaques.push(`${game.quizPromptName ? `asked ${game.quizPromptName}` : game.quizCurrentName === deckName ? 'answered' : 'before'}:${plaque}`);
        }
      }
      if (game.quizPromptName) {
        asks.push({ name: game.quizPromptName, subject: game.quizPromptSubject, nameUnder: name });
        game.quizCurrentName = game.quizPromptName;
        game.learnedNames.add(game.quizPromptName);
        game.quizPromptName = '';
        game._prompt.style.display = 'none';
      }
      arrived = Math.hypot(to.x - player.x, to.y - player.y) < 30;
    }
    game.state = 4;
    return { arrived, asks, deckPlaques };
  }, { fromLatLng: from, toLatLng: to, deckName: deck, routeDifficulty: difficulty, start: startName });
}

test('at hard the Noordsche Compagniebrug is asked as a bridge, on the deck, and not revealed before', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(180_000);
  await serveStagedBridges(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const askable = await page.evaluate(() => (window as any).canalRecallGame.bridges
    .some((bridge: { name: string }) => bridge.name === 'Noordsche Compagniebrug'));
  expect(askable, 'the Noordsche Compagniebrug is in the bridge set').toBe(true);

  const result = await ride(page, [52.3779, 4.8867], [52.37715, 4.8889], 'Noordsche Compagniebrug', 'hard', null);
  expect(result.arrived, JSON.stringify(result)).toBe(true);
  const bridgeAsk = result.asks.find(ask => ask.name === 'Noordsche Compagniebrug');
  expect(bridgeAsk, JSON.stringify(result)).toBeTruthy();
  expect(bridgeAsk!.subject).toBe('bridge');
  expect(bridgeAsk!.nameUnder).toBe('Noordsche Compagniebrug');
  // Before the answer the plaque never names the bridge; after it, it does.
  for (const reading of result.deckPlaques) {
    const shown = reading.slice(reading.lastIndexOf(':') + 1);
    if (!reading.startsWith('answered:')) expect(shown, JSON.stringify(result.deckPlaques)).not.toContain('Noordsche');
  }
  expect(result.deckPlaques.some(reading => reading === 'answered:Noordsche Compagniebrug'),
    JSON.stringify(result.deckPlaques)).toBe(true);
});

test('on the Vingboomsbrug the plaque keeps reading the Huidenstraat it carries', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(180_000);
  await serveStagedBridges(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  // West to east along the Huidenstraat and over its deck.
  const result = await ride(page, [52.368858, 4.884359], [52.368771, 4.887015], 'Vingboomsbrug', 'medium', 'Huidenstraat');
  expect(result.arrived, JSON.stringify(result)).toBe(true);
  expect(result.deckPlaques.length, 'the ride crosses the deck').toBeGreaterThan(0);
  for (const reading of result.deckPlaques) {
    expect(['Huidenstraat', ''], JSON.stringify(result)).toContain(reading.slice(reading.lastIndexOf(':') + 1));
  }
  expect(result.deckPlaques.filter(reading => reading === 'before:Huidenstraat').length,
    JSON.stringify(result)).toBeGreaterThan(0);
  expect(result.asks.find(ask => ask.name === 'Vingboomsbrug'), JSON.stringify(result.asks)).toBeUndefined();
});
