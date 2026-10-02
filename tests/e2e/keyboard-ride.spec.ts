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
//   KEYBOARD_RIDE=lat,lng[;lat,lng…]  bridges to ride over (default below);
//                 lat,lng,lat,lng rides from one point to the other
//   KEYBOARD_RIDE_GREP=regex          only the named rides that match
//   KEYBOARD_RIDE_ALL=1               every named spot, not only the core set

type Point = { x: number; y: number };
type LatLng = [number, number];
/**
 * `at`: a bridge or seam; the ride runs ~120 m along the nearest road's axis
 * on each side of it, in both directions. `from`/`to`: a reported route,
 * ridden as the game's router plans it (one direction per entry).
 */
type Ride = { name: string; at?: LatLng; from?: LatLng; to?: LatLng; legs?: 'both' | 'back'; core?: boolean };

// Every place a "stuck" or "really hard" report named (HISTORY.md), so the
// real keyboard-and-quiz path is exercised wherever a rider got into trouble.
const DEFAULT_RIDES: Ride[] = [
  { name: 'Sint Antoniessluis', at: [52.36968, 4.90115], core: true },
  { name: 'Westeinde over the Singelgracht', at: [52.35895, 4.89815], core: true },
  { name: 'Koepelkerk fork', at: [52.3780, 4.8935], core: true },
  // 2026-10-01 "driving through this tunnel in centraal is really hard": the
  // Cuyperspassage cycle tunnel under Amsterdam Centraal, both ways, and on to
  // the IJ-side cycle path east.
  { name: 'Cuyperspassage north to De Ruijterkade', from: [52.37890, 4.89790], to: [52.38067, 4.89817], core: true },
  { name: 'Cuyperspassage south from De Ruijterkade', from: [52.38067, 4.89817], to: [52.37890, 4.89790] },
  { name: 'Cuyperspassage to the IJ side east', from: [52.37890, 4.89790], to: [52.37960, 4.90060] },
  { name: 'Zanddwarsstraat end to Sint Antoniessluis', from: [52.37009, 4.89927], to: [52.36940, 4.90230] },
  { name: 'Nieuwezijds Armsteeg to Nieuwendijk', from: [52.37702, 4.89530], to: [52.37708, 4.89660] },
  { name: 'Bullebakssluis, Marnixstraat into Westerkade', from: [52.3745, 4.8766], to: [52.37396, 4.8769] },
  { name: 'Solitudobrug', at: [52.340602, 4.925079] },
  // A footbridge whose south end is a dead end in the extract. Ridden from
  // the north, the bike reaches the end nose-first; up and right held there
  // stood still for good until the edge stall was judged on net movement
  // (2026-10-02). (Southbound the axis ride wanders off to Leidsegracht.)
  { name: 'Melkwegbrug', at: [52.364876, 4.881568], legs: 'back', core: true },
  { name: 'Bosch van Drakesteinpad seam', at: [52.376205, 4.789186] },
  { name: 'Burgemeester Fockstraat bridge', at: [52.377326, 4.831227] },
  { name: 'Liesdelsluis', at: [52.374773, 4.899287] },
  { name: 'Karel van het Revebrug', at: [52.358868, 4.817654] },
  { name: 'Nannie van Wehlstraat bridge', at: [52.380608, 4.810128] },
];
const rides: Ride[] = process.env.KEYBOARD_RIDE
  ? process.env.KEYBOARD_RIDE.split(';').map((p, i) => {
    const n = p.split(',').map(Number);
    return n.length >= 4
      ? { name: `probe ${i + 1}`, from: [n[0], n[1]] as LatLng, to: [n[2], n[3]] as LatLng }
      : { name: `probe ${i + 1}`, at: [n[0], n[1]] as LatLng };
  })
  : DEFAULT_RIDES;
const filter = process.env.KEYBOARD_RIDE_GREP ? new RegExp(process.env.KEYBOARD_RIDE_GREP, 'i') : null;
// The full set takes ~15 min of real time; the every-push e2e run rides the
// core spots and the nightly run (scripts/nightly-driving.sh) rides them all.
const everySpot = process.env.KEYBOARD_RIDE_ALL === '1' || Boolean(filter) || Boolean(process.env.KEYBOARD_RIDE);
// Bridge rides go both ways; route rides as written.
const legs = rides.filter(r => (everySpot || r.core) && (!filter || filter.test(r.name))).flatMap(r => r.at
  ? [
    ...(r.legs === 'back' ? [] : [{ ...r, reverse: false }]),
    { ...r, name: `${r.name} (back)`, reverse: true },
  ]
  : [{ ...r, reverse: false }]);

const TICK_MS = 80;
const RIDE_SECONDS = 60;
const STUCK_SECONDS = 4;

async function placeBefore(page: Page, ride: Ride & { reverse: boolean }) {
  return page.evaluate((ride) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toXY = ([lat, lng]: [number, number]) => ({
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat,
    });
    const snap = (p: { x: number; y: number }) => { const r = game.track.getNearestRoad(p.x, p.y); return r ? { x: r.x, y: r.y } : p; };
    let from: { x: number; y: number }, to: { x: number; y: number };
    if (ride.at) {
      const bridge = toXY(ride.at);
      const road = game.track.getNearestRoad(bridge.x, bridge.y);
      if (!road) return null;
      const dir = { x: Math.cos(road.angle), y: Math.sin(road.angle) };
      from = snap({ x: road.x - dir.x * 360, y: road.y - dir.y * 360 });
      to = snap({ x: road.x + dir.x * 360, y: road.y + dir.y * 360 });
      if (ride.reverse) [from, to] = [to, from];
    } else {
      from = snap(toXY(ride.from!));
      to = snap(toXY(ride.to!));
    }
    const path = game.track.findRoute(from, to);
    if (!path || path.length < 2) return null;
    const player = game.player;
    Object.assign(player, { x: from.x, y: from.y, vx: 0, vy: 0, speed: 0,
      angle: Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x) });
    // A fresh crossing: the bridge question is allowed to fire.
    game._lastBridgeQuizAt = -Infinity;
    game._quizzedCrossings?.clear?.();
    if (typeof game._reclaimKeyboardFocus === 'function') game._reclaimKeyboardFocus();
    // Count the frames the road guard had to act: how hard the ride was,
    // not only whether it finished.
    // The bundle's exports are getters, so wrap by replacing the global.
    const w = window as any;
    if (!w.CanalRecallCar.__counted) {
      const original = w.CanalRecallCar.constrainCarToRoad;
      w.CanalRecallCar = {
        ...w.CanalRecallCar,
        __counted: true,
        constrainCarToRoad: (...args: unknown[]) => {
          const result = original(...args);
          const g = w.__keyboardRideGuard;
          g.frames++;
          if (result !== 'on-road') {
            g.edge++;
            const p = args[0] as { x: number; y: number };
            if (g.where.length < 2000) g.where.push([Math.round(p.x), Math.round(p.y), result[0]]);
          }
          if (result === 'rolled-back') g.rolledBack++;
          if (result === 'unwedged') g.unwedged++;
          return result;
        },
      };
    }
    w.__keyboardRideGuard = { frames: 0, edge: 0, rolledBack: 0, unwedged: 0, where: [] };
    return { path: path.map((p: Point) => ({ x: p.x, y: p.y })), to };
  }, ride);
}

for (const bridge of legs) {
  test(`rides ${bridge.name} on the keyboard, quiz on`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard input; desktop only');
    test.setTimeout(240_000);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
    const plan = await placeBefore(page, bridge);
    expect(plan, 'a route over the bridge').toBeTruthy();
    const { path, to } = plan!;
    const routePx = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);

    const held = new Set<string>();
    const hold = async (key: string, down: boolean) => {
      if (down === held.has(key)) return;
      if (down) { await page.keyboard.down(key); held.add(key); } else { await page.keyboard.up(key); held.delete(key); }
    };
    const releaseAll = async () => { for (const key of [...held]) await hold(key, false); };

    let index = 0;
    let progress: { t: number; x: number; y: number } | null = null;
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
          x: game.player.x, y: game.player.y, angle: game.player.angle, speed: game.player.speed, stall: game._edgeStallFrames || 0, steerIn: game.player.steerInput,
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

      // Follow the planned route: from the bike's place on it, aim 90 px on.
      // Held up for a second (a corner cut into a kerb), aim 30 px on, as a
      // rider would hug the line round the corner; it is the arrows' effect
      // that is under test, not the aim.
      if (!progress || Math.hypot(s.x - progress.x, s.y - progress.y) > 10) progress = { t, x: s.x, y: s.y };
      const lookahead = t - progress.t > 1 ? 30 : 90;
      let nearest = index, best = Infinity, along = 0;
      for (let i = index; i < Math.min(path.length - 1, index + 20); i++) {
        const a = path[i], b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const u = Math.max(0, Math.min(1, ((s.x - a.x) * (b.x - a.x) + (s.y - a.y) * (b.y - a.y)) / (len * len)));
        const d = Math.hypot(a.x + (b.x - a.x) * u - s.x, a.y + (b.y - a.y) * u - s.y);
        if (d < best) { best = d; nearest = i; along = u * len; }
      }
      index = nearest;
      let aim = path[path.length - 1];
      for (let i = index, left = lookahead + along; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (left <= len) { aim = { x: a.x + (b.x - a.x) * left / (len || 1), y: a.y + (b.y - a.y) * left / (len || 1) }; break; }
        left -= len;
      }
      let error = Math.atan2(aim.y - s.y, aim.x - s.x) - s.angle;
      error = Math.atan2(Math.sin(error), Math.cos(error));
      const cruise = Math.abs(error) > 0.5 ? 50 : 140;
      const throttle = s.speed < cruise;
      await hold('ArrowUp', throttle);
      await hold('ArrowLeft', error < -0.08);
      await hold('ArrowRight', error > 0.08);

      const steer = error < -0.08 ? -1 : error > 0.08 ? 1 : 0;
      history.push({ t, x: s.x, y: s.y, angle: s.angle, throttle, steer, speed: s.speed, stall: s.stall, steerIn: s.steerIn } as any);
      while (history.length && t - history[0].t > STUCK_SECONDS) history.shift();
      const span = history.length ? t - history[0].t : 0;
      if (span >= STUCK_SECONDS - 0.2 && history.every(h => h.throttle)) {
        const moved = Math.hypot(s.x - history[0].x, s.y - history[0].y);
        // Turned: a rider steering into a kerb who still swings round is not
        // stuck; one whose arrows do nothing is.
        const turned = Math.abs(Math.atan2(Math.sin(s.angle - history[0].angle), Math.cos(s.angle - history[0].angle)));
        if (moved < 10 && turned < 0.3) {
          failure = `stuck: throttle held ${span.toFixed(1)} s, moved ${moved.toFixed(1)} px, turned ${turned.toFixed(2)} rad`;
          console.log(JSON.stringify(history.filter((_, i) => i % 5 === 0).map(h => ({ x: Math.round(h.x), y: Math.round(h.y), a: +h.angle.toFixed(2), v: Math.round(h.speed), steer: h.steer, stall: (h as any).stall, si: (h as any).steerIn }))));
          break;
        }
      }
      await page.waitForTimeout(TICK_MS);
    }
    await releaseAll();
    if (failure || !arrived) await page.screenshot({ path: testInfo.outputPath('keyboard-ride.png') });
    const guard = await page.evaluate(() => {
      const w = window as any;
      const g = w.__keyboardRideGuard;
      const loader = w.canalRecallGame.osmLoader;
      const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
      // Where the guard acted, as lat,lng rounded to ~1 m, with frame counts.
      const cells = new Map<string, number>();
      for (const [x, y, kind] of g.where) {
        const lat = (loader._lastCenterLat - (y - loader._lastOffsetY) / perLat).toFixed(5);
        const lng = (loader._lastCenterLng + (x - loader._lastOffsetX) / perLng).toFixed(5);
        const key = `${lat},${lng} ${kind}`;
        cells.set(key, (cells.get(key) || 0) + 1);
      }
      return { ...g, where: [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
    });
    if (process.env.KEYBOARD_RIDE_TRACE) console.log(JSON.stringify(guard.where));
    const seconds = (Date.now() - started) / 1000;
    console.log(`${bridge.name}: route ${Math.round(routePx / 3)} m, arrived=${arrived} in ${seconds.toFixed(1)} s, answered=${answered} (wrong ${answeredWrong}), `
      + `guard edge frames ${guard.edge}/${guard.frames} (rolled back ${guard.rolledBack}, unwedged ${guard.unwedged})${failure ? ' FAIL ' + failure : ''}`);
    testInfo.annotations.push({ type: 'keyboard-ride', description: JSON.stringify({ name: bridge.name, arrived, seconds, answered, guard: { frames: guard.frames, edge: guard.edge, rolledBack: guard.rolledBack, unwedged: guard.unwedged, hotspots: guard.where }, failure }) });
    expect(failure, failure).toBe('');
    expect(arrived, 'reached the far side of the bridge').toBe(true);
  });
}
