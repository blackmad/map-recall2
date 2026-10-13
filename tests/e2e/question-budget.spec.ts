import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// The ride is the lesson; the question is the check. Seeded ride, Anne Frank
// House to the Rijksmuseum, driven by the harness autopilot with the game's own
// physics (see turn-question-timing.spec.ts). Every question blocks the ride
// (user decision 2026-10-13); what keeps the centre from stopping the bike
// every block is the per-minute budget (questionBudget.ts): at most two route
// questions a rolling minute, the rest of the new names ridden past silently
// and said once the street is left.
//
// Run: PW_PORT=4421 npx playwright test tests/e2e/question-budget.spec.ts --project=desktop

const ANNE_FRANK_HOUSE: [number, number] = [52.37526, 4.88397];
const RIJKSMUSEUM: [number, number] = [52.36001, 4.88522];
const MAX_ASKS_PER_MINUTE = 2;
/** Seconds a simulated rider takes to read and answer a question. */
const THINK_SECONDS = 3;
/** px/s the autopilot cruises at. The harness default (170) crosses the whole
 *  route in under a minute, which says little about a per-minute rate; this is
 *  an easy pace and takes about two minutes. */
const CRUISE_SPEED = 80;

type Ride = {
  arrived: boolean;
  seconds: number;
  prompts: Array<{ at: number; name: string; speedBefore: number; speedAfter: number }>;
  events: Array<{ at: number; name: string; event: string }>;
  /** Frames where a route question was open and the vehicle was moving. */
  movingFramesInQuestion: number;
  /** Frames where an unanswered question's street name was already revealed. */
  earlyReveals: string[];
  frozenSeconds: number;
  maxAsksInAMinute: number;
  errors: string[];
};

async function ride(page: Page, budget: number): Promise<Ride> {
  return page.evaluate(({ waypoints, budget, think, cruiseSpeed }) => {
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
    game.maxAsksPerMinute = budget;
    game.routeOptions.answerMode = 'multiple';
    game.state = 6; // PAUSED: this test steps the simulation itself
    const player = game.player;
    player.handleInput = () => {};
    game._updateLandmarks = () => {};
    const STEP = 1 / 30;
    // The route is a single leg; the loop below supports more.
    const nodes = waypoints.map(snap);
    let leg = 0;
    let a = nodes[0], b = nodes[1];
    let path = game.track.findRoute(a, b);
    Object.assign(player, { x: a.x, y: a.y, speed: 0, vx: 0, vy: 0, angle: Math.atan2(path[1].y - a.y, path[1].x - a.x) });
    game.track.finishPoint = { ...b };
    game.track.clearFrameCache();
    game.raceTime = 0;
    game._promptLog = [];
    game._questionBudget = { asks: [] };
    game._silentPass = null;
    game.quizPromptName = '';
    game.quizCurrentName = game.track.getRoadName(player.x, player.y, player.angle);
    game.quizCandidateName = '';
    game.quizCandidateTimer = 0;
    game.quizCandidateMetres = 0;

    let index = 1, arrived = false, openedAt = -1, frozenSeconds = 0, movingFrames = 0;
    let wasRevealed = false;
    const earlyReveals: string[] = [];
    const errors: string[] = [];
    let seenPrompts = 0;
    const MAX_SECONDS = 1200;
    for (let elapsed = 0; elapsed < MAX_SECONDS && !arrived; elapsed += STEP) {
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
      const cruise = Math.abs(error) > 0.5 ? 40 : cruiseSpeed;
      player.steerInput = Math.max(-1, Math.min(1, error * 2.5));
      player.throttle = player.speed < cruise ? 1 : 0;
      player.brake = player.speed > cruise * 1.6 ? 1 : 0;
      player.handbrake = false;
      game.track.clearFrameCache();

      if (game.quizPromptName && game.quizPromptKind === 'route' && game._quizFreezesRide?.() !== false) frozenSeconds += STEP;
      game._updateRacing(STEP);
      game.track.clearFrameCache();

      // A new question has opened (the log grows on every open).
      const opened = game._promptLog.filter((entry: any) => !entry.event).length;
      if (opened > seenPrompts) {
        seenPrompts = opened;
        openedAt = game.raceTime;
        wasRevealed = game.revealedNames.has(game.quizPromptName);
      }
      if (game.quizPromptName) {
        const roadName = game.track.getRoadName(player.x, player.y, player.angle);
        // Geographic-learning rule: the street under question is never shown
        // before it is answered or left.
        if (roadName === game.quizPromptName && !wasRevealed && game.revealedNames.has(game.quizPromptName)) {
          earlyReveals.push(game.quizPromptName);
        }
        const open = !game._silentPass;
        if (open && Math.abs(player.speed) > 1) movingFrames++;
        // The simulated rider answers after a few seconds; a silent pass has
        // nothing to answer and ends when the street is left.
        const waited = game.raceTime - openedAt;
        if (open && waited >= think) {
          try { game._submitCanalAnswer(game.quizPromptName); } catch (error) { errors.push(String((error as Error).stack)); break; }
        }
      }
      if (Math.hypot(b.x - player.x, b.y - player.y) < 30) {
        leg++;
        if (leg >= nodes.length - 1) { arrived = true; } else {
          a = nodes[leg]; b = nodes[leg + 1];
          path = game.track.findRoute({ x: player.x, y: player.y }, b);
          index = 1;
          game.track.finishPoint = { ...b };
        }
      }
    }
    game.state = 4;

    const prompts = game._promptLog.filter((entry: any) => !entry.event && entry.kind === 'route')
      .map((entry: any) => ({ at: entry.at, name: entry.name, speedBefore: entry.speedBefore ?? 0, speedAfter: entry.speedAfter ?? 0 }));
    const events = game._promptLog.filter((entry: any) => entry.event)
      .map((entry: any) => ({ at: entry.at, name: entry.name, event: entry.event }));
    let maxAsksInAMinute = 0;
    for (const prompt of prompts) {
      maxAsksInAMinute = Math.max(maxAsksInAMinute, prompts.filter((other: any) => other.at >= prompt.at && other.at < prompt.at + 60).length);
    }
    return {
      arrived, seconds: game.raceTime, prompts, events, movingFramesInQuestion: movingFrames,
      earlyReveals, frozenSeconds, maxAsksInAMinute, errors,
    };
  }, { waypoints: [ANNE_FRANK_HOUSE, RIJKSMUSEUM], budget, think: THINK_SECONDS, cruiseSpeed: CRUISE_SPEED });
}

test('route questions are rationed to the budget and each one holds the bike (Anne Frank House to the Rijksmuseum)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(300_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });

  const everything = await ride(page, Infinity);
  console.log(`ask-everything: ${everything.prompts.length} prompts in ${everything.seconds.toFixed(1)} s, `
    + `frozen ${everything.frozenSeconds.toFixed(1)} s, max in a minute ${everything.maxAsksInAMinute}`);
  expect(everything.arrived, JSON.stringify(everything)).toBe(true);

  // A fresh profile for the second ride: the first one's answers must not
  // make this one's streets "known".
  await page.evaluate(() => localStorage.clear());
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const budgeted = await ride(page, MAX_ASKS_PER_MINUTE);
  const rate = budgeted.prompts.length / (budgeted.seconds / 60);
  console.log(`budgeted: ${budgeted.prompts.length} prompts in ${budgeted.seconds.toFixed(1)} s = ${rate.toFixed(1)}/min, `
    + `frozen ${budgeted.frozenSeconds.toFixed(1)} s, max in a minute ${budgeted.maxAsksInAMinute}, `
    + `events ${budgeted.events.map(e => e.event).join(',')}`);
  expect(budgeted.arrived, JSON.stringify(budgeted)).toBe(true);
  expect(budgeted.errors).toEqual([]);

  // Rationed: never more than the budget in any rolling minute, and fewer than ask-everything.
  expect(budgeted.maxAsksInAMinute, JSON.stringify(budgeted.prompts)).toBeLessThanOrEqual(MAX_ASKS_PER_MINUTE);
  expect(rate, `${rate.toFixed(2)} prompts/min`).toBeLessThanOrEqual(MAX_ASKS_PER_MINUTE * 1.25);
  expect(budgeted.prompts.length).toBeLessThan(everything.prompts.length);
  // Every question holds the bike: speed is zeroed when it opens and the frame loop waits.
  for (const prompt of budgeted.prompts) expect(prompt.speedAfter, JSON.stringify(prompt)).toBe(0);
  expect(budgeted.movingFramesInQuestion).toBe(0);
  expect(budgeted.frozenSeconds).toBeGreaterThan(0);
  // The street under question is not revealed before it is answered.
  expect(budgeted.earlyReveals).toEqual([]);
  // The ride still teaches: names that were not asked are revealed after the rider leaves the street.
  expect(budgeted.events.filter(e => e.event === 'revealed').length).toBeGreaterThan(0);
});

// The per-minute budget is a rider setting (1 / 2 / 3 / off). It is chosen on
// the setup screen through the hidden select, reaches the question budget, and
// survives a reload.
test('the questions-per-minute setting reaches the budget and persists', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'settings plumbing; one project is enough');
  test.setTimeout(120000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#max-asks-per-minute')).toHaveValue('2');
  for (const [value, expected] of [['1', 1], ['3', 3], ['0', 0]] as const) {
    await page.locator('#max-asks-per-minute').selectOption(value, { force: true });
    const seen = await page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      return { pref: game._prefs().maxAsksPerMinute, budget: game._askBudgetPerMinute() };
    });
    expect(seen, `choice ${value}`).toEqual({ pref: expected, budget: expected });
  }
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90000 }).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('canalRecall.preferences.v1') || '{}').maxAsksPerMinute);
  expect(saved, 'off is saved with the other preferences').toBe(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#max-asks-per-minute')).toHaveValue('0');
});
