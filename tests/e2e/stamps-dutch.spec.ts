import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';
import { landingFixtureEntries } from '../../src/canalRecall/landing/landingFixtures';

// L3 (#283), from the ride review #280 (defects 5, 6, 12):
// - one stamp count: the landing, the arrival card's stamp line and the album
//   read stampAlbum.ts stampCount for the review's three storage states;
// - the Dutch arrival card and run card carry no English from the review's
//   list, and a landmark question in Dutch reads "Anne Frank Huis".
// Needs the rebuilt game-presentation, game-landmarks, landing, overlay, i18n bundles.

const PASSPORT = 'canalRecall.neighborhoodPassport.v1';
const FREE_RIDE = 'canalRecall.freeRideCollection.v1';
const LANGUAGE = 'canalRecall.language.v1';
const shots = process.env.L3_SHOTS || 'artifacts/l3-stamps-dutch';
const shot = (name: string) => `${shots}/${name}-${test.info().project.name}.png`;

const SEEDS: Record<string, { overrides: Record<string, string>; earned: number }> = {
  landing: { overrides: {}, earned: 4 },
  spec: {
    overrides: {
      [PASSPORT]: JSON.stringify({ stamped: ['Grachtengordel', 'Oude Pijp'], dates: { Grachtengordel: '2026-11-07' } }),
      [FREE_RIDE]: JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }] }),
    },
    earned: 3,
  },
  junk: {
    overrides: {
      [PASSPORT]: JSON.stringify({ stamped: ['Jordaan', 'De Pijp', 'Plantage', 'Grachtengordel', 'Oude Pijp', 'Buitenveldert', 'Weesp', 'Portugese Synagoge', 'Amsterdam', 'Grachtengordel-West', 'Street lm-1'] }),
      [FREE_RIDE]: JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }, { hood: 'Jordaan', at: '2026-11-08' }] }),
    },
    earned: 8,
  },
};

async function seed(page: Page, entries: Record<string, string>) {
  await page.addInitScript((data: Record<string, string>) => {
    if (!sessionStorage.getItem('l3-seeded')) {
      sessionStorage.setItem('l3-seeded', '1');
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    }
    // Every string the canvas draws, so the card's text can be asserted.
    const drawn: string[] = ((window as any).__drawn = []);
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: any[]) {
      if (drawn.length > 4000) drawn.splice(0, 2000);
      drawn.push(String(text));
      return (fillText as any).call(this, text, ...rest);
    };
  }, entries);
}

/** Strings drawn over the next few frames. */
async function drawnText(page: Page): Promise<string[]> {
  await page.evaluate(() => { (window as any).__drawn.length = 0; });
  await page.waitForTimeout(500);
  return page.evaluate(() => [...new Set((window as any).__drawn as string[])]);
}

async function arrive(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 150, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
    g.player.x = g.track.finishPoint.x;
    g.player.y = g.track.finishPoint.y;
    g.player.speed = 0;
  });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  // The arrival's buurt stamp: the card draws it whenever this arrival stamped a buurt.
  await page.evaluate(() => { (window as any).canalRecallGame._finishPassportFresh = ['Jordaan']; });
  await page.waitForTimeout(300);
}

for (const [name, { overrides, earned }] of Object.entries(SEEDS)) {
  test(`seed ${name}: landing, arrival card and album all count ${earned} of 89`, async ({ page }) => {
    test.setTimeout(240_000);
    await seed(page, { ...landingFixtureEntries('returning', Date.now()), ...overrides });

    await page.goto('/canal-drive/landing.html');
    await expect(page.locator('[data-landing-stats]')).toContainText(`Passport · ${earned} stamps`);
    if (name === 'spec') await page.screenshot({ path: shot(`01-landing-${name}`) });

    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=0' });
    await arrive(page);
    // The card can redraw its stamp block a frame or two after the arrival saves.
    let text: string[] = [];
    await expect.poll(async () => {
      await page.evaluate(() => { (window as any).canalRecallGame._finishPassportFresh = ['Jordaan']; });
      text = await drawnText(page);
      return text;
    }, { timeout: 15_000 }).toContain(`${earned} of 89 buurt stamps`);
    expect(text.join(' | ')).not.toMatch(/NEW STAMP|STAMP AGAIN|of 393(?! places)|of 101/);
    if (name === 'spec') await page.screenshot({ path: shot(`02-arrival-${name}`) });

    await page.goto('/canal-drive/');
    await expect(page.locator('#knowledge-button')).toBeVisible({ timeout: 60_000 });
    await page.locator('#knowledge-button').click();
    const album = page.getByTestId('stamp-album');
    await expect(album).toHaveAttribute('data-earned', String(earned));
    await expect(album).toHaveAttribute('data-total', '89');
    await expect(album.locator('.stamp-album-count')).toHaveText(`${earned} / 89`);
    // No caption is cut: every name fits its column, wrapped at a seam if need be.
    await album.locator('.stamp-album-more').click().catch(() => {});
    const cut = await album.locator('.stamp strong').evaluateAll(nodes => nodes
      .filter(node => (node as HTMLElement).scrollWidth > (node as HTMLElement).clientWidth + 1)
      .map(node => node.textContent));
    expect(cut, 'captions that overflow their column').toEqual([]);
    const irene = await album.locator('.stamp strong[title="Prinses Irenebuurt e.o."]').evaluate(node => {
      const lh = parseFloat(getComputedStyle(node).lineHeight);
      return { lines: Math.round(node.getBoundingClientRect().height / lh), width: node.getBoundingClientRect().width };
    });
    console.log(`[${test.info().project.name}] Prinses Irenebuurt e.o.: ${irene.lines} lines at ${irene.width.toFixed(0)} px`);
    expect(irene.lines).toBeLessThanOrEqual(3);
    if (name === 'junk') {
      await album.locator('.stamp-grid').scrollIntoViewIfNeeded();
      await album.screenshot({ path: shot(`03-album-${name}`) });
    }
  });
}

// The review's English on the Dutch cards (#280 defect 6).
const ENGLISH = ['End run', 'Route setup', 'RUN', 'NEW STAMP', 'Points', 'Time', 'Distance', 'Best streak', 'RUN COMPLETE', 'New run', 'Names', 'CITY KNOWLEDGE'];

test('Dutch: the arrival card and the run card are Dutch; a landmark choice reads Anne Frank Huis', async ({ page }) => {
  test.setTimeout(300_000);
  const phone = test.info().project.name !== 'desktop';
  await seed(page, { [LANGUAGE]: 'nl', ...SEEDS.spec.overrides });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });

  // A landmark question at the Anne Frank Huis: every other landmark already asked.
  const question = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const anne = g.landmarks.find((l: any) => l.name === 'Anne Frank House');
    if (!anne) return null;
    g._landmarkAsked = new Set(g.landmarks.filter((l: any) => l.id !== anne.id).map((l: any) => l.id));
    g._landmarkIsModelled = () => true;
    g._askBudgetPerMinute = () => Infinity;
    g._questionBudget = null;
    // Inside the view cone: 40 px short of it, facing it.
    g.player.x = anne.x - Math.cos(g.player.angle) * 40; g.player.y = anne.y - Math.sin(g.player.angle) * 40; g.player.speed = 0;
    g.quizCandidateName = ''; g.quizPromptName = ''; g.quizFeedback = '';
    const debug = {
      on: g._landmarkQuestionsOn(), worth: !!anne.wikipediaExtract, seen: g._seenLandmarks?.has(anne.id),
      gate: g._teachingGate(), prompt: g.quizPromptName, silent: !!g._silentPass, ferry: !!g.player.ferryOrigin,
      budget: g._questionBudget, dest: g.routeTo?.name,
    };
    const opened = g._tryLandmarkQuestion();
    return { debug, opened, name: g.quizPromptName as string, withheld: g.quizWithheldNames as string[] };
  });
  expect(question, 'Anne Frank House is in the landmarks').toBeTruthy();
  expect(question!.opened, `the question opened ${JSON.stringify((question as any).debug)}`).toBe(true);
  expect(question!.name).toBe('Anne Frank Huis');
  expect(question!.withheld).toEqual(expect.arrayContaining(['Anne Frank House', 'Anne Frank Huis']));
  await expect(page.locator('#canal-prompt, #canal-card').first()).toContainText('Anne Frank Huis');
  await expect(page.locator('#canal-prompt, #canal-card').first()).not.toContainText('Anne Frank House');
  await page.screenshot({ path: shot('04-question-nl') });
  // Close the question so the ride can end.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._submitLandmarkAnswer('Anne Frank Huis');
  });
  await page.waitForTimeout(300);

  await arrive(page);
  const arrival = await drawnText(page);
  await page.screenshot({ path: shot('05-arrival-nl') });
  const joined = arrival.join(' | ');
  for (const word of ENGLISH) expect(arrival, `arrival card: no "${word}"`).not.toContain(word);
  expect(joined).not.toMatch(/\bneighborhoods?\b|NEW STAMP|\bof 89\b|\bpoints\b|\bchain\b/);
  if (!phone) expect(arrival).toContain('Reeks beëindigen');
  expect(arrival).toContain('REEKS');
  expect(arrival).toEqual(expect.arrayContaining(['Punten', 'Tijd', 'Afstand', 'KENNIS VAN DE STAD']));
  expect(joined).toMatch(/1 stop\s+·\s+1 naam\s+·\s+150 punten/);
  expect(joined).toContain('3 van 89 buurtstempels');

  // End run: the run card.
  if (phone) await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('end'));
  else await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!(window as any).canalRecallGame._runCard, null, { timeout: 10_000 });
  const card = await drawnText(page);
  await page.screenshot({ path: shot('06-run-card-nl') });
  for (const word of ENGLISH) expect(card, `run card: no "${word}"`).not.toContain(word);
  expect(card).toEqual(expect.arrayContaining(['REEKS VOLTOOID', '1 stop', 'STOPS', 'Punten', 'Beste reeks', 'Namen', 'Nieuwe reeks']));
  expect(card.join(' | ')).toMatch(/Eén stop .*1( \| | )naam op de kaart\./);
});
