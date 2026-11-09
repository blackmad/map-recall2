import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// #290: the arrival card, ride HUD, pause card, landmark question card and Free Ride plaque
// carry no English when the game is Dutch. DUTCH_SHOTS=<dir> saves the frames.
// Needs the rebuilt game-presentation, game-landmarks, i18n bundles.

const LANGUAGE = 'canalRecall.language.v1';
const shots = process.env.DUTCH_SHOTS || 'artifacts/dutch-surfaces';
const shot = (name: string) => `${shots}/${name}-${test.info().project.name}.png`;
const lang = () => (process.env.DUTCH_LANG || 'nl');

async function seed(page: Page) {
  await page.addInitScript((language: string) => {
    if (!sessionStorage.getItem('l290-seeded')) {
      sessionStorage.setItem('l290-seeded', '1');
      localStorage.setItem('canalRecall.language.v1', language);
    }
    const drawn: string[] = ((window as any).__drawn = []);
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: any[]) {
      if (drawn.length > 4000) drawn.splice(0, 2000);
      drawn.push(String(text));
      return (fillText as any).call(this, text, ...rest);
    };
  }, lang());
}

async function drawnText(page: Page): Promise<string[]> {
  await page.evaluate(() => { (window as any).__drawn.length = 0; });
  await page.waitForTimeout(600);
  return page.evaluate(() => [...new Set((window as any).__drawn as string[])]);
}

/** Visible text of the DOM cards that can carry a question or plaque. */
async function domText(page: Page, selector: string): Promise<string> {
  return page.evaluate(sel => [...document.querySelectorAll(sel)].map(n => (n as HTMLElement).innerText).join(' | '), selector);
}

function report(name: string, canvas: string[], dom = '') {
  console.log(`[${test.info().project.name}] ${name} CANVAS: ${JSON.stringify(canvas)}${dom ? `\n[${test.info().project.name}] ${name} DOM: ${dom}` : ''}`);
}

// Words that must not appear (English UI vocabulary of these surfaces).
export const ENGLISH = /\b(RIBBON|Recall \d|Unaided|Efficiency|personal best|ARRIVED|TOUR COMPLETE|PAUSED|Resume|Route setup|named|DESTINATION|NEIGHBOURHOOD|Share route|Link copied|landmarks?\b)/;

test('Dutch: HUD, pause, landmark question, arrival', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });
  await page.waitForTimeout(1500);
  const hud = await drawnText(page);
  report('HUD', hud);
  await page.screenshot({ path: shot('01-hud') });

  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.speed = 0; g.state = 6; });
  const pause = await drawnText(page);
  report('PAUSE', pause);
  await page.screenshot({ path: shot('02-pause') });
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });

  const q = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const anne = g.landmarks.find((l: any) => l.name === 'Anne Frank House');
    if (!anne) return false;
    g._landmarkAsked = new Set(g.landmarks.filter((l: any) => l.id !== anne.id).map((l: any) => l.id));
    g._landmarkIsModelled = () => true;
    g._askBudgetPerMinute = () => Infinity;
    g._questionBudget = null;
    g.player.x = anne.x - Math.cos(g.player.angle) * 40; g.player.y = anne.y - Math.sin(g.player.angle) * 40; g.player.speed = 0;
    g.quizCandidateName = ''; g.quizPromptName = ''; g.quizFeedback = '';
    return g._tryLandmarkQuestion();
  });
  expect(q).toBe(true);
  await page.waitForTimeout(500);
  report('QUESTION', await drawnText(page), await domText(page, '#canal-prompt, #canal-card'));
  await page.screenshot({ path: shot('03-question') });
  await page.evaluate(() => (window as any).canalRecallGame._submitLandmarkAnswer('Anne Frank Huis'));
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 150, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
    g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
  });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.evaluate(() => { localStorage.setItem('canalRecall.bestTimes', '{}'); (window as any).canalRecallGame._finishPassportFresh = ['Jordaan']; });
  await page.waitForTimeout(400);
  const arrival = await drawnText(page);
  report('ARRIVAL', arrival);
  await page.screenshot({ path: shot('04-arrival') });
  const widths = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const mono = (window as any).CanalRecallUi.hudSurface.fontMono;
    const w = (text: string, font: string) => { ctx.font = font; return Math.round(ctx.measureText(text).width); };
    const T = (window as any).CanalI18n.t;
    return {
      viewport: window.innerWidth,
      header: w(T('ride.arrival.header'), `700 11px ${mono}`),
      tier: ['gold', 'silver', 'bronze', 'none'].map(id => [T(`ribbon.${id}`), w(T(`ribbon.${id}`), `700 19px ${mono}`)]),
      axes: ['recall', 'aids', 'efficiency'].map(id => [T(`ribbon.axis.${id}`), w(`${T(`ribbon.axis.${id}`)} 100%`, `11px ${mono}`), w(T(`ribbon.axis.${id}`), `10px ${mono}`)]),
      pill: w(T('hud.destination'), `700 10px system-ui`),
    };
  });
  console.log(`[${test.info().project.name}] WIDTHS ${JSON.stringify(widths)}`);
  if (process.env.DUTCH_ASSERT) expect(arrival.join(' | ')).not.toMatch(ENGLISH);
});

test('Dutch: Free Ride plaque', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?ride=free');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
  await page.waitForTimeout(2500);
  report('FREERIDE', await drawnText(page), await domText(page, '#free-ride-bar, [id*="free"], [class*="free-ride"]'));
  await page.screenshot({ path: shot('05-freeride') });
});
