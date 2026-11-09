import { expect, test, type Page } from '@playwright/test';
import { finishKeycapCentre, openRoute } from './helpers';

// G1 (#271), chained stops: a run is a chain of arrivals. This drives a
// three-stop run end to end — arrive, Next stop (dealt 1–3 km on), arrive, a
// reload in the middle that continues the run, arrive, End run — on the
// desktop and phone projects, and checks `?run=0` keeps today's arrival.
//
// Lanes run it against a scratch build: BUNDLES_DIR=<dir> (helpers.ts).

type Bounds = { x: number; y: number; w: number; h: number; id: string };

const shot = (name: string) => `artifacts/g1/${name}-${test.info().project.name}.png`;

/** Puts the rider on the finish point and waits for the arrival card. */
async function arrive(page: Page) {
  // An open landmark question stops the bike short of the finish: answer "No idea", ask no more (#282).
  const noIdea = page.locator('#canal-card button', { hasText: /No idea|Geen idee/ });
  if (await noIdea.isVisible().catch(() => false)) { await noIdea.click().catch(() => {}); await page.waitForTimeout(3500); }
  await page.evaluate(() => { (window as any).canalRecallGame.maxAsksPerMinute = 0; });
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    // A ride's own score, so the run's points and chain bonus have something to carry.
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 200, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
    g.player.x = g.track.finishPoint.x;
    g.player.y = g.track.finishPoint.y;
    g.player.speed = 0;
  });
  // The teleport can land within 300 m of a landmark, and the question that opens on that frame holds the
  // arrival (an open landmark question stops the bike short of the finish, by design): answer it and settle again.
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (await page.evaluate(() => (window as any).canalRecallGame.state === 5)) break;
    if (await noIdea.isVisible().catch(() => false)) {
      await noIdea.click().catch(() => {});
      await page.waitForTimeout(3500);
      await page.evaluate(() => {
        const g = (window as any).canalRecallGame;
        g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
      });
    }
    if (Date.now() > deadline) throw new Error('no arrival within 30 s (state ' + (await page.evaluate(() => (window as any).canalRecallGame.state)) + ')');
    await page.waitForTimeout(250);
  }
  // The card records the stop on its first frame.
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return {
      to: g.routeTo.name as string,
      line: g._runArrivalLine() as string | null,
      run: JSON.parse(localStorage.getItem('canalRecall.openRun.v1') || 'null'),
      buttons: (g._finishButtonBounds as Bounds[]).map(b => b.id),
      card: g._finishCardBounds as { x: number; y: number; w: number; h: number },
      viewport: { w: g.viewport.width, h: g.viewport.height },
      session: { ...(window as any).__canalRecallSession },
    };
  });
}

/**
 * Desktop: the action's key (the card documents ENTER / E). Phone: a tap where it is drawn.
 * `_finishButtonBounds` are canvas units, not CSS px (on desktop the canvas is scaled to the window);
 * the on-screen check goes through helpers.ts `finishKeycapCentre`, the one mapping every spec uses (#278).
 */
async function tap(page: Page, id: string) {
  if (test.info().project.name === 'desktop') {
    await page.keyboard.press(id === 'end' ? 'KeyE' : 'Enter');
    return;
  }
  const bounds = await page.evaluate(want => ((window as any).canalRecallGame._finishButtonBounds as Bounds[]).find(b => b.id === want), id);
  expect(bounds, `${id} button drawn`).toBeTruthy();
  // A real touch target, on screen; then the canvas tap handler's own dispatch (presentationRuntime pointerup →
  // _runFinishTap). Playwright's emulated tap does not reach the canvas's pointer path (no spec taps it).
  const at = await finishKeycapCentre(page, id);
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(at, `${id} keycap on screen`).toBeTruthy();
  expect(at!.h).toBeGreaterThanOrEqual(44);
  expect(at!.y + at!.h / 2).toBeLessThanOrEqual(innerHeight);
  await page.evaluate(want => (window as any).canalRecallGame._runFinishTap(want), id);
}

async function nextStopKm(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const a = g.routeFrom, b = g.routeTo;
    const km = Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180));
    return { km, review: !!g._reviewRoute, state: g.state as number, from: a.name as string, to: b.name as string };
  });
}

test('a three-stop run: Next stop, a reload, End run and the run card', async ({ page }) => {
  test.setTimeout(420_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });

  // Stop 1: the arrival card gains the run line and End run.
  const first = await arrive(page);
  expect(first.run?.stopCount).toBe(1);
  // Stop 1 earns no chain bonus, so its line names none (#282).
  expect(first.line).toMatch(/^1 stop {2}· {2}1 name {2}· {2}200 points$/);
  expect(first.buttons).toContain('end');
  expect(first.buttons).toContain('again');
  expect(first.card.y + first.card.h).toBeLessThanOrEqual(first.viewport.h);
  await page.screenshot({ path: shot('stop1-arrival') });

  // Next stop: the same city, dealt 1–3 km on from the arrival.
  await tap(page, 'again');
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 60_000 });
  const leg2 = await nextStopKm(page);
  expect(leg2.from).toBe(first.to);
  if (!leg2.review) {
    expect(leg2.km).toBeGreaterThanOrEqual(1);
    expect(leg2.km).toBeLessThanOrEqual(3);
  }
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });

  const second = await arrive(page);
  expect(second.run?.stopCount).toBe(2);
  // 200 points + 5 % chain bonus at the second stop.
  expect(second.run?.totalPoints).toBe(200 + 210);
  expect(second.line).toContain('2 stops');
  // The line names the bonus this stop earned and its points already hold (#282), not the next stop's.
  expect(second.line).toContain('410 points');
  expect(second.line).toContain('chain +5 %');
  expect(second.session.stopsThisRun).toBe(2);

  // A reload continues the open run: the next arrival is stop 3.
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const third = await arrive(page);
  expect(third.run?.stopCount).toBe(3);
  expect(third.run?.totalPoints).toBe(200 + 210 + 220);
  expect(third.line).toContain('3 stops');
  expect(third.line).toContain('chain +10 %');
  await page.screenshot({ path: shot('stop3-arrival') });

  // End run: the run card replaces the arrival card.
  await tap(page, 'end');
  const card = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return {
      run: g._runCard,
      open: localStorage.getItem('canalRecall.openRun.v1'),
      last: JSON.parse(localStorage.getItem('canalRecall.lastRun.v1') || 'null'),
      buttons: (g._finishButtonBounds as Bounds[]).map(b => b.id),
      card: g._finishCardBounds,
      viewport: { w: g.viewport.width, h: g.viewport.height },
      session: { ...(window as any).__canalRecallSession },
    };
  });
  expect(card.run?.stopCount).toBe(3);
  expect(card.open).toBeNull();
  expect(card.last?.stopCount).toBe(3);
  expect(card.buttons).toEqual(['again', 'route']);
  expect(card.card.y + card.card.h).toBeLessThanOrEqual(card.viewport.h);
  expect(card.session.stopsPerRun).toEqual([3]);
  expect(card.session.runsEnded).toBe(1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('run-card') });

  // New run rides on; the next arrival starts a fresh run.
  await tap(page, 'again');
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).canalRecallGame._runCard)).toBeNull();
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  const fresh = await arrive(page);
  expect(fresh.run?.stopCount).toBe(1);
  console.log(JSON.stringify({
    project: test.info().project.name,
    stops: [first.to, second.to, third.to], leg2,
    cardH: { stop1: first.card.h, stop3: third.card.h, runCard: card.card.h }, viewport: first.viewport,
  }));
});

test('Route setup from the arrival card closes the run, without a run card', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const arrival = await arrive(page);
  expect(arrival.run?.stopCount).toBe(1);
  if (test.info().project.name === 'desktop') await page.keyboard.press('KeyM');
  else await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('route'));
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 0, null, { timeout: 10_000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    open: localStorage.getItem('canalRecall.openRun.v1'),
    last: JSON.parse(localStorage.getItem('canalRecall.lastRun.v1') || 'null'),
    card: (window as any).canalRecallGame._runCard ?? null,
    session: { ...(window as any).__canalRecallSession },
  }));
  expect(after.open).toBeNull();
  expect(after.last?.stopCount).toBe(1);
  expect(after.card).toBeNull();
  expect(after.session.runsEnded).toBe(1);
  expect(after.session.stopsPerRun).toEqual([1]);
});

test('?run=0 keeps the single-ride arrival', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?run=0' });
  const arrival = await arrive(page);
  expect(arrival.line).toBeNull();
  expect(arrival.run).toBeNull();
  expect(arrival.buttons).not.toContain('end');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).canalRecallGame._runCard ?? null)).toBeNull();
  console.log(JSON.stringify({ project: test.info().project.name, run0CardH: arrival.card.h }));
});
