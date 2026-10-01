import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Rides through reported bridges with real keyboard events and the quiz on.
// The sweep, pose probe and harness set player.throttle/steerInput directly
// and stub the quiz, so they missed the freeze where an answer's hold timer
// hid the next question while the bike waited for it (2026-10-01, "I just got
// stuck on a bridge again"). Here only setup touches game state: the bike is
// placed before the bridge. After that, every input is a Playwright key press
// (arrows to ride, number keys or typing to answer) and the game loop runs
// at its own pace.
//
// It fails when the bike is stuck: arrow-up held, no question on screen, and
// under 10 px (about 3 m) of movement in 4 s. It also fails when a question is
// pending but its card is not visible for over a second.
//
//   KEYBOARD_RIDE=lat,lng[;lat,lng…]  bridges to ride over (default below)

type Point = { x: number; y: number };

const DEFAULT_BRIDGES: Array<{ name: string; at: [number, number] }> = [
  { name: 'Sint Antoniessluis', at: [52.36968, 4.90115] },
  { name: 'Westeinde over the Singelgracht', at: [52.35895, 4.89815] },
  { name: 'Koepelkerk fork', at: [52.3780, 4.8935] },
];
const bridges = process.env.KEYBOARD_RIDE
  ? process.env.KEYBOARD_RIDE.split(';').map((p, i) => ({ name: `probe ${i + 1}`, at: p.split(',').map(Number) as [number, number] }))
  : DEFAULT_BRIDGES;

const TICK_MS = 80;
const RIDE_SECONDS = 60;
const STUCK_SECONDS = 4;

async function placeBefore(page: Page, at: [number, number]) {
  return page.evaluate(([lat, lng]) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const bridge = {
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat,
    };
    const road = game.track.getNearestRoad(bridge.x, bridge.y);
    if (!road) return null;
    const snap = (p: { x: number; y: number }) => { const r = game.track.getNearestRoad(p.x, p.y); return r ? { x: r.x, y: r.y } : p; };
    const dir = { x: Math.cos(road.angle), y: Math.sin(road.angle) };
    const from = snap({ x: road.x - dir.x * 360, y: road.y - dir.y * 360 });
    const to = snap({ x: road.x + dir.x * 360, y: road.y + dir.y * 360 });
    const path = game.track.findRoute(from, to);
    if (!path || path.length < 2) return null;
    const player = game.player;
    Object.assign(player, { x: from.x, y: from.y, vx: 0, vy: 0, speed: 0,
      angle: Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x) });
    // A fresh crossing: the bridge question is allowed to fire.
    game._lastBridgeQuizAt = -Infinity;
    game._quizzedCrossings?.clear?.();
    if (typeof game._reclaimKeyboardFocus === 'function') game._reclaimKeyboardFocus();
    return { path: path.map((p: Point) => ({ x: p.x, y: p.y })), to };
  }, at);
}

for (const bridge of bridges) {
  test(`rides over ${bridge.name} on the keyboard, quiz on`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard input; desktop only');
    test.setTimeout(240_000);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
    const plan = await placeBefore(page, bridge.at);
    expect(plan, 'a route over the bridge').toBeTruthy();
    const { path, to } = plan!;

    const held = new Set<string>();
    const hold = async (key: string, down: boolean) => {
      if (down === held.has(key)) return;
      if (down) { await page.keyboard.down(key); held.add(key); } else { await page.keyboard.up(key); held.delete(key); }
    };
    const releaseAll = async () => { for (const key of [...held]) await hold(key, false); };

    let index = 0;
    let answered = 0, answeredWrong = 0;
    let hiddenQuestionSeconds = 0;
    let lastAnswered = '';
    const history: Array<{ t: number; x: number; y: number; angle: number; throttle: boolean; steer: number; speed: number }> = [];
    const started = Date.now();
    let arrived = false;
    let failure = '';

    while ((Date.now() - started) / 1000 < RIDE_SECONDS) {
      const s = await page.evaluate(() => {
        const game = (window as any).canalRecallGame;
        const prompt = document.getElementById('canal-prompt')!;
        const visible = getComputedStyle(prompt).display !== 'none';
        const input = document.getElementById('canal-answer') as HTMLInputElement | null;
        return {
          x: game.player.x, y: game.player.y, angle: game.player.angle, speed: game.player.speed,
          question: game.quizPromptName || '', visible,
          choices: (game._choiceOrder || []) as string[],
          typing: !!input && getComputedStyle(input).display !== 'none',
          focusIsInput: document.activeElement === input,
        };
      });
      const t = (Date.now() - started) / 1000;

      if (s.question) {
        await releaseAll();
        if (!s.visible) {
          hiddenQuestionSeconds += TICK_MS / 1000;
          if (hiddenQuestionSeconds > 1) { failure = `question "${s.question}" pending but not on screen`; break; }
        } else if (s.question !== lastAnswered) {
          hiddenQuestionSeconds = 0;
          // Every other answer is wrong: its hold is the longest (3.2 s), the
          // window in which the freeze happened.
          const wrong = answered % 2 === 0;
          if (s.typing) {
            if (!s.focusIsInput) await page.locator('#canal-answer').focus();
            await page.keyboard.type(wrong ? 'Not A Real Name' : s.question);
            await page.keyboard.press('Enter');
          } else {
            const right = s.choices.indexOf(s.question);
            const pick = wrong ? s.choices.findIndex(c => c !== s.question) : right;
            if (pick >= 0) await page.keyboard.press(`Digit${pick + 1}`);
          }
          lastAnswered = s.question;
          answered++;
          if (wrong) answeredWrong++;
        }
        history.length = 0;
        await page.waitForTimeout(TICK_MS);
        continue;
      }
      hiddenQuestionSeconds = 0;
      lastAnswered = '';

      if (Math.hypot(to.x - s.x, to.y - s.y) < 40) { arrived = true; break; }

      // Follow the planned route: the nearest vertex ahead, aimed 90 px on.
      let nearest = index, best = Infinity;
      for (let i = index; i < Math.min(path.length, index + 20); i++) {
        const d = Math.hypot(path[i].x - s.x, path[i].y - s.y);
        if (d < best) { best = d; nearest = i; }
      }
      index = nearest;
      let target = index, ahead = 0;
      while (target < path.length - 1 && ahead < 90) { ahead += Math.hypot(path[target + 1].x - path[target].x, path[target + 1].y - path[target].y); target++; }
      let error = Math.atan2(path[target].y - s.y, path[target].x - s.x) - s.angle;
      error = Math.atan2(Math.sin(error), Math.cos(error));
      const cruise = Math.abs(error) > 0.5 ? 50 : 140;
      const throttle = s.speed < cruise;
      await hold('ArrowUp', throttle);
      await hold('ArrowLeft', error < -0.08);
      await hold('ArrowRight', error > 0.08);

      const steer = error < -0.08 ? -1 : error > 0.08 ? 1 : 0;
      history.push({ t, x: s.x, y: s.y, angle: s.angle, throttle, steer, speed: s.speed });
      while (history.length && t - history[0].t > STUCK_SECONDS) history.shift();
      const span = history.length ? t - history[0].t : 0;
      if (span >= STUCK_SECONDS - 0.2 && history.every(h => h.throttle)) {
        const moved = Math.hypot(s.x - history[0].x, s.y - history[0].y);
        // Turned: a rider steering into a kerb who still swings round is not
        // stuck; one whose arrows do nothing is.
        const turned = Math.abs(Math.atan2(Math.sin(s.angle - history[0].angle), Math.cos(s.angle - history[0].angle)));
        if (moved < 10 && turned < 0.3) {
          failure = `stuck: throttle held ${span.toFixed(1)} s, moved ${moved.toFixed(1)} px, turned ${turned.toFixed(2)} rad`;
          console.log(JSON.stringify(history.filter((_, i) => i % 5 === 0).map(h => ({ x: Math.round(h.x), y: Math.round(h.y), a: +h.angle.toFixed(2), v: Math.round(h.speed), steer: h.steer }))));
          break;
        }
      }
      await page.waitForTimeout(TICK_MS);
    }
    await releaseAll();
    if (failure || !arrived) await page.screenshot({ path: testInfo.outputPath('keyboard-ride.png') });
    console.log(`${bridge.name}: arrived=${arrived} answered=${answered} (wrong ${answeredWrong})${failure ? ' FAIL ' + failure : ''}`);
    expect(failure, failure).toBe('');
    expect(arrived, 'reached the far side of the bridge').toBe(true);
  });
}
