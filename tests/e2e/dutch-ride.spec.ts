import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';
import { LANDMARK_NAMES_NL, LANDMARK_NAMES_NL_WIKIDATA } from '../../src/canalRecall/game/landmarkNamesNl';
import { nameKey } from '../../src/canalRecall/game/landmarkQuestion';

// R2-2/R2-3 (#303): ride C of ride review 2 in one deterministic pass. The Dutch game answers in Dutch
// and names a place one way on every surface: the destination pill, the landmark question, the
// answer feedback, the drive-by card after it, the arrival title, route line and stamp line.
// Ride C's real names are pinned: Mint Tower (question), New Church (pill), Torture Museum →
// Pathé Tuschinski Cinema (arrival). R2_SHOTS=<dir> saves the frames.
// Needs the rebuilt answer-path, game-recall, game-landmarks, game-presentation and i18n bundles.

const shots = process.env.R2_SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}-${test.info().project.name === 'desktop' ? 'desktop' : 'phone'}.png` });
};

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('r2b-seeded')) {
      sessionStorage.setItem('r2b-seeded', '1');
      localStorage.setItem('canalRecall.language.v1', 'nl');
    }
    const drawn: string[] = ((window as any).__drawn = []);
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: any[]) {
      if (drawn.length > 4000) drawn.splice(0, 2000);
      drawn.push(String(text));
      return (fillText as any).call(this, text, ...rest);
    };
  });
}

async function drawnText(page: Page): Promise<string[]> {
  await page.evaluate(() => { (window as any).__drawn.length = 0; });
  await page.waitForTimeout(700);
  return page.evaluate(() => [...new Set((window as any).__drawn as string[])]);
}

// Ride C's English labels, any case: none may be drawn in the Dutch game.
const ENGLISH_NAMES = /mint tower|new church|pathé tuschinski cinema/i;
const ENGLISH_FEEDBACK = /\b(Correct|Not quite|This is|Passed|pts|new name bonus|in a row)\b/;

test('Dutch ride C: answer feedback and place names', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });
  await page.waitForTimeout(1500);
  const surfaces: Record<string, string> = {};

  // 1. The destination pill, with ride C's destination.
  const named = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const pick = (name: string) => g.landmarks.find((l: any) => l.name === name);
    const church = pick('New Church');
    if (church) g.routeTo = { ...g.routeTo, name: church.name };
    return { church: !!church, mint: !!pick('Mint Tower') };
  });
  expect(named).toEqual({ church: true, mint: true });
  const hud = await drawnText(page);
  surfaces.pill = hud.filter(text => /nieuwe kerk|new church/i.test(text)).join(' / ') || '(none)';
  await shot(page, 'r2b-01-pill');

  // 2. The landmark question on the Mint Tower, answered right.
  const asked = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const mint = g.landmarks.find((l: any) => l.name === 'Mint Tower');
    g._landmarkAsked = new Set(g.landmarks.filter((l: any) => l.id !== mint.id).map((l: any) => l.id));
    g._landmarkIsModelled = () => true;
    g._askBudgetPerMinute = () => Infinity;
    g._questionBudget = null;
    g.player.x = mint.x - Math.cos(g.player.angle) * 40; g.player.y = mint.y - Math.sin(g.player.angle) * 40; g.player.speed = 0;
    g.quizCandidateName = ''; g.quizPromptName = ''; g.quizFeedback = '';
    return g._tryLandmarkQuestion() ? g.quizPromptName : null;
  });
  surfaces.question = asked ?? '(none)';
  expect(asked).toBeTruthy();
  await page.waitForTimeout(400);
  await shot(page, 'r2b-02-question');
  await page.evaluate(() => { (window as any).__drawn.length = 0; });
  surfaces.feedback = await page.evaluate(name => {
    const g = (window as any).canalRecallGame;
    g._submitLandmarkAnswer(name);
    return g.quizFeedback || '';
  }, asked);
  await shot(page, 'r2b-03-answered');

  // 3. The drive-by card the answer opens once its hold ends.
  // Everything drawn from the answer on: a neighbour's card (Pathé de Munt) may follow on desktop.
  await page.waitForFunction(() => !!(window as any).canalRecallGame._landmarkNotice, null, { timeout: 15_000 });
  await page.waitForTimeout(900);
  const card = await page.evaluate(() => [...new Set((window as any).__drawn as string[])]);
  surfaces.card = card.filter(text => /munttoren|mint tower/i.test(text)).join(' / ') || '(none)';
  await shot(page, 'r2b-04-after');

  // 4. The arrival, with ride C's start and destination.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._landmarkNotice = null;
    g.routeFrom = { ...g.routeFrom, name: 'Torture Museum' };
    g.routeTo = { ...g.routeTo, name: 'Pathé Tuschinski Cinema', reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 150, quizBestStreak: 2 });
    g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
  });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(600);
  const arrival = await drawnText(page);
  surfaces.arrival = arrival.filter(text => /tuschinski|torture/i.test(text)).join(' / ') || '(none)';
  await shot(page, 'r2b-05-arrival');

  console.log(`[${test.info().project.name}] R2B SURFACES ${JSON.stringify(surfaces)}`);
  const englishDrawn = [...hud, ...card, ...arrival].filter(text => ENGLISH_NAMES.test(text));
  console.log(`[${test.info().project.name}] R2B ENGLISH NAMES DRAWN ${englishDrawn.length} ${JSON.stringify(englishDrawn)}`);

  expect.soft(surfaces.pill).toMatch(/nieuwe kerk/i);
  expect.soft(surfaces.question).toBe('Munttoren');
  expect.soft(surfaces.feedback).toMatch(/^Goed — Munttoren/);
  expect.soft(surfaces.feedback).not.toMatch(ENGLISH_FEEDBACK);
  expect.soft(surfaces.card).toMatch(/munttoren/i);
  expect.soft(surfaces.arrival).toContain('Koninklijk Theater Tuschinski');
  expect.soft(englishDrawn).toEqual([]);
});

// R3-A (#307): the map/3D place label and the arrival paragraph. The label ledger
// (labelDrawLedger: every layer's drawn names, both engines) and a fillText hook
// say which landmark names the map drew near the Munttoren; none may be a catalogue
// English name the Dutch game renames. Then an arrival at De Dokwerker, whose nl
// article lede the extract kept, prints that Dutch lede; ride C's Portugese
// Synagoge has no Dutch text and stays English (no machine translation).
const RENAMED: Array<[string, string]> = [
  ...Object.entries(LANDMARK_NAMES_NL),
  ...Object.entries(LANDMARK_NAMES_NL_WIKIDATA).map(([en, row]) => [en, row.nl] as [string, string]),
];

test('Dutch ride C: map labels and the arrival paragraph speak Dutch (#307)', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await page.waitForTimeout(1500);
  // Stand at the Munttoren facing it; let the label layers re-plan.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const mint = g.landmarks.find((l: any) => l.name === 'Mint Tower');
    g.player.x = mint.x - Math.cos(g.player.angle) * 120; g.player.y = mint.y - Math.sin(g.player.angle) * 120; g.player.speed = 0;
  });
  await page.waitForTimeout(6000);
  const seen = await page.evaluate(() => {
    const ledger = (window as any).__canalRecallLabelLedger;
    const keys = new Set<string>();
    for (const set of ledger?.current?.values?.() ?? []) for (const key of set) keys.add(key);
    for (const key of ledger?.lastDrawn?.keys?.() ?? []) keys.add(key);
    return { keys: [...keys], drawn: [...new Set((window as any).__drawn as string[])] };
  });
  const drawnKeys = new Set([...seen.keys, ...seen.drawn.map(nameKey)]);
  const english = RENAMED.filter(([en]) => drawnKeys.has(nameKey(en))).map(([en]) => en);
  const dutch = RENAMED.filter(([, nl]) => drawnKeys.has(nameKey(nl))).map(([, nl]) => nl);
  await shot(page, 'r3a-01-label');
  console.log(`[${test.info().project.name}] R3A LABELS english=${JSON.stringify(english)} dutch=${JSON.stringify(dutch)} ledgerKeys=${seen.keys.length}`);

  // The arrival at a landmark whose Dutch lede the extract kept.
  const arrive = async (id: string) => {
    await page.evaluate((landmarkId: string) => {
      const g = (window as any).canalRecallGame;
      const lm = g.landmarks.find((l: any) => l.id === landmarkId);
      g._landmarkNotice = null;
      g.routeTo = { ...g.routeTo, id: `lm-${lm.id}`, landmarkId: lm.id, name: lm.name, reviewStop: undefined };
      g._finishBlurb = null;
      g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
    }, id);
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
    await page.waitForTimeout(800);
    return page.evaluate(() => (window as any).canalRecallGame._finishBlurb?.text || '');
  };
  const dokwerker = await arrive('extract_landmarks_1098130181');
  await shot(page, 'r3a-02-arrival-dokwerker');
  console.log(`[${test.info().project.name}] R3A ARRIVAL ${JSON.stringify(dokwerker.slice(0, 120))}`);

  expect.soft(english).toEqual([]);
  expect.soft(dutch.length, 'some renamed landmark is labelled at all').toBeGreaterThan(0);
  expect.soft(dokwerker).toMatch(/^De Dokwerker is een beeld/);
});
