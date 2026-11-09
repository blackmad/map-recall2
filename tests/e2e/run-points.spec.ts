import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// #282: one score across the three surfaces that show a run's points. Seeded as ride review #280 did
// (rides scoring 130 / 240 / 90): each arrival card's Points is that stop's points with the bonus it
// earned, the run line's total is the sum of those, and it names this stop's bonus (stop 1 none, stop 2
// +5 %, stop 3 +10 %), and the run card lists the same per-stop points and total (chainedRun.ts scoreStop).
// Every dealt route also carries its share link at the arrival, with no seeding (#282 part B).

const SEED = [130, 240, 90];
const EXPECTED = [
  { points: 130, line: '1 stop  ·  1 name  ·  130 points' },
  { points: 252, line: '2 stops  ·  2 names  ·  382 points  ·  chain +5 %' },
  { points: 99, line: '3 stops  ·  3 names  ·  481 points  ·  chain +10 %' },
];
const shot = (name: string) => `artifacts/run-points/${name}-${test.info().project.name}.png`;

/** Records the canvas text drawn per frame, so a spec can read what the card says rather than the state behind it. */
async function captureText(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__drawn = new Set<string>();
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, max?: number) {
      w.__drawn.add(String(text));
      return max === undefined ? fill.call(this, text, x, y) : fill.call(this, text, x, y, max);
    };
  });
}

async function drawnText(page: Page): Promise<string[]> {
  await page.evaluate(() => { (window as any).__drawn = new Set<string>(); });
  await page.waitForTimeout(250);
  return page.evaluate(() => [...((window as any).__drawn as Set<string>)]);
}

/** The text drawn right after a label (the stats draw label then value, or value then label). */
function pointsValue(texts: string[]): string | null {
  const i = texts.findIndex(t => /^points$/i.test(t.trim()));
  if (i < 0) return null;
  const near = [texts[i + 1], texts[i - 1]].filter((t): t is string => !!t && /^\d[\d,]*$/.test(t.trim()));
  return near[0] ?? null;
}

async function arrive(page: Page, points: number) {
  // An open landmark question stops the bike short of the finish: answer "No idea", as review #280 did.
  const noIdea = page.locator('#canal-card button', { hasText: /No idea|Geen idee/ });
  if (await noIdea.isVisible().catch(() => false)) { await noIdea.click().catch(() => {}); await page.waitForTimeout(3500); }
  await page.evaluate(() => { (window as any).canalRecallGame.maxAsksPerMinute = 0; });
  await page.evaluate((pts) => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: pts, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
    g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
  }, points);
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
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(300);
  const texts = await drawnText(page);
  const facts = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return {
      to: g.routeTo.name as string, toLL: [g.routeTo.lat, g.routeTo.lng],
      line: g._runArrivalLine() as string | null,
      share: g._shareUrl as string | null,
      buttons: (g._finishButtonBounds as { id: string }[]).map(b => b.id),
    };
  });
  return { ...facts, texts, shownPoints: pointsValue(texts), drawnLine: texts.find(t => /^\d+ stops? /.test(t)) ?? null };
}

/** The card's text wrapper collapses runs of spaces; compare words, not spacing. */
function words(text: string | null): string | null {
  return text == null ? null : text.replace(/\s+/g, ' ').trim();
}

async function nextStop(page: Page) {
  const before = await page.evaluate(() => (window as any).canalRecallGame.routeTo.id);
  await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('again'));
  await page.waitForFunction(id => { const g = (window as any).canalRecallGame; return g.state === 4 && g.routeTo?.id !== id && !!g.player?.x; }, before, { timeout: 90_000 });
  // The link as the next leg is placed (riding on reuses the world, so there is no settle hold).
  const atDeal = await page.evaluate(() => { const g = (window as any).canalRecallGame; return { share: g._shareUrl as string | null, to: [g.routeTo.lat, g.routeTo.lng] as number[] }; });
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  return atDeal;
}

test('run points agree on the arrival card, the run line and the run card; every arrival has its share link', async ({ page }) => {
  test.setTimeout(360_000);
  await captureText(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const arrivals = [];
  const deals: { share: string | null; to: number[] }[] = [];
  for (const [i, pts] of SEED.entries()) {
    if (i > 0) deals.push(await nextStop(page));
    const a = await arrive(page, pts);
    arrivals.push(a);
    await page.screenshot({ path: shot(`arrival${i + 1}`) });
  }
  await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('end'));
  await page.waitForFunction(() => !!(window as any).canalRecallGame._runCard, null, { timeout: 10_000 });
  await page.waitForTimeout(300);
  const cardTexts = await drawnText(page);
  const run = await page.evaluate(() => (window as any).canalRecallGame._runCard);
  await page.screenshot({ path: shot('run-card') });
  console.log(JSON.stringify({
    project: test.info().project.name,
    nextStopDeals: deals,
    arrivals: arrivals.map(a => ({ to: a.to, shownPoints: a.shownPoints, line: a.line, drawnLine: a.drawnLine, share: a.share, copy: a.buttons.includes('copy') })),
    runCard: { total: run.totalPoints, stops: run.stops.map((s: any) => [s.basePoints, s.bonus, s.points]), rows: cardTexts.filter(t => /^\d[\d,]*( {2}\+\d+ %)?$/.test(t)) },
  }));

  for (const [i, a] of arrivals.entries()) {
    expect(a.shownPoints, `arrival ${i + 1} Points`).toBe(String(EXPECTED[i].points));
    expect(a.line, `arrival ${i + 1} run line`).toBe(EXPECTED[i].line);
    // Drawn whole: a phone that cut the line off before its bonus would hide the very thing #282 fixes.
    expect(words(a.drawnLine), `arrival ${i + 1} draws the whole run line`).toBe(words(EXPECTED[i].line));
    // Part B: the dealt route carries a link that reopens it, and the card offers Share.
    expect(a.share, `arrival ${i + 1} share link`).toMatch(/#race=-?\d+\.\d{4}(,-?\d+\.\d{4}){5}$/);
    const ll = a.share!.split('#race=')[1].split(',').map(Number);
    expect(Math.abs(ll[4] - a.toLL[0]) + Math.abs(ll[5] - a.toLL[1]), `arrival ${i + 1} link names this finish`).toBeLessThan(0.0002);
    expect(a.buttons, `arrival ${i + 1} Share keycap`).toContain('copy');
  }
  for (const d of deals) {
    expect(d.share, 'a Next stop leg has its own link as it is placed').toMatch(/#race=/);
    const ll = d.share!.split('#race=')[1].split(',').map(Number);
    expect(Math.abs(ll[4] - d.to[0]) + Math.abs(ll[5] - d.to[1]), 'not the last leg\'s link').toBeLessThan(0.0002);
  }
  expect(run.stops.map((s: any) => s.points)).toEqual(EXPECTED.map(e => e.points));
  expect(run.totalPoints).toBe(481);
  expect(cardTexts).toContain('130');
  expect(cardTexts).toContain('252  +5 %');
  expect(cardTexts).toContain('99  +10 %');
  expect(cardTexts).toContain('481');
});

test('a ride arrived at the moment it is dealt already has its share link', async ({ page }) => {
  test.setTimeout(240_000);
  // openRoute returns as soon as the player is placed; arriving at once is how review #280 met a card
  // with no Share keycap (the link was written after the ~4 s map-settle hold, not with the route).
  // The hold is made its full length here, as on a loaded phone, so the race is deterministic.
  await page.addInitScript(() => {
    const hook = setInterval(() => {
      const g = (window as any).canalRecallGame;
      if (!g?._waitForMapSettle) return;
      clearInterval(hook);
      const settle = g._waitForMapSettle.bind(g);
      g._waitForMapSettle = async (ms: number) => { await settle(ms); await new Promise(r => setTimeout(r, ms)); };
    }, 20);
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  // The link as the rider is placed: the first frame they could arrive on.
  const atDeal = await page.evaluate(() => { const g = (window as any).canalRecallGame; return { share: g._shareUrl as string | null, to: [g.routeTo.lat, g.routeTo.lng] }; });
  const a = await arrive(page, 50);
  console.log(JSON.stringify({ project: test.info().project.name, immediate: { atDeal, share: a.share, buttons: a.buttons } }));
  expect(atDeal.share, 'the link exists as soon as the rider is placed').toMatch(/#race=/);
  const ll = atDeal.share!.split('#race=')[1].split(',').map(Number);
  expect(Math.abs(ll[4] - atDeal.to[0]) + Math.abs(ll[5] - atDeal.to[1])).toBeLessThan(0.0002);
  expect(a.share).toMatch(/#race=/);
  expect(a.buttons).toContain('copy');
  await page.screenshot({ path: shot('immediate-share') });
});
