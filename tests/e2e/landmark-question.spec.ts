import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// G3 — Landmarks you can name (#273). A scripted ride past the Westerkerk asks
// "Which building is this?" with four names from the same buurt; no HUD
// surface names it while the question is open; a right answer fires the
// passport's `named` stamp, which nothing fired before. The drive-by card that
// follows offers "Noticed". Off by default since the 2026-11-09 hotfix (#281): the specs opt in with
// `?landmarkQuestions=1`; `?landmarkQuestions=0` keeps drive-by cards only.

const SHOTS = process.env.G3_SHOTS_DIR || '';

/** Put the bike 110 m west of the Westerkerk, facing it, with the slot empty. */
async function approachWesterkerk(page: Page, extra: { streetOpen?: boolean; keepReview?: boolean } = {}) {
  return page.evaluate(({ streetOpen, keepReview }) => {
    const game = (window as any).canalRecallGame;
    const landmark = game.landmarks.find((l: any) => l.name === 'Westerkerk');
    if (!landmark) return { error: 'no Westerkerk in the landmark list' };
    game.routeOptions.answerMode = 'multiple';
    game.routePath = null;
    game.routeTo = { id: 'lm-elsewhere', name: 'Elsewhere' };
    game.quizFeedback = '';
    game.quizCandidateName = '';
    game._silentPass = null;
    game._questionBudget = { asks: [] };
    game._landmarkAsked = new Set();
    game._seenLandmarks = new Set();
    game._landmarkSightingsCache = {};
    try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); } catch { /* */ }
    // The review schedule (#300) decides whether a landmark asked on an earlier ride is due.
    game._landmarkReviewsCache = undefined;
    if (!keepReview) try { localStorage.removeItem('canalRecall.landmarkReview.v1'); } catch { /* */ }
    game._clearLandmarkNotice();
    game._prompt.style.display = 'none';
    game.quizPromptName = '';
    game.quizPromptKind = 'route';
    if (streetOpen) {
      // A street question already owns the card: the landmark must wait.
      game.quizPromptName = 'Prinsengracht';
      game.quizPromptSubject = 'water';
      game._prompt.style.display = 'flex';
    }
    Object.assign(game.player, { x: landmark.x - 110 * 3, y: landmark.y, angle: 0, speed: 0, vx: 0, vy: 0 });
    game._updateLandmarks(1 / 60);
    const prompt = document.getElementById('canal-card');
    const choices = [...document.querySelectorAll('#canal-choices button')].map(b => (b as HTMLElement).dataset.name);
    // Every visible DOM surface but the answer buttons (which must hold the answer).
    const mentions: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent || '';
      // The answer and, while a landmark question is open, every other choice.
      const names = game.quizPromptKind === 'landmark' ? choices as string[] : ['Westerkerk'];
      if (!names.some(name => name && text.includes(name))) continue;
      const el = node.parentElement;
      if (!el || el.closest('#canal-choices, script, style')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      mentions.push(`${el.tagName}#${el.id}.${el.className}`);
    }
    return {
      id: landmark.id,
      modelled: game._landmarkIsModelled(landmark.id),
      kind: game.quizPromptKind,
      asked: game.quizPromptName,
      heading: prompt?.querySelector('h2')?.textContent,
      context: prompt?.querySelector('p')?.textContent,
      chip: (prompt?.querySelector('.prompt-kind') as HTMLElement | null)?.dataset.kind,
      choices,
      domMentions: mentions,
      card: game._landmarkNotice?.name ?? null,
      panelOpen: getComputedStyle(document.getElementById('landmark-panel')!).display !== 'none',
      gateQuizOpen: game._teachingGate().quizOpen,
      withheld: game.quizWithheldNames ?? [],
      // The own engine's label policy input, when that engine draws the labels.
      policyHidden: game.vectorMap?.labelPolicy ? (game.vectorMap.labelPolicy().hiddenNames ?? null) : null,
      markers: (game._freeRideNearby || []).map((p: any) => p.name),
      session: { ...(window as any).__canalRecallSession },
    };
  }, extra);
}

test('a ride past the Westerkerk asks its name, hides it, and stamps it named', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'question logic; the phone layout is the Storybook state');
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });

  // One-card rule first: with a street question open nothing new is asked.
  const blocked = await approachWesterkerk(page, { streetOpen: true });
  expect(blocked.error).toBeUndefined();
  expect(blocked.kind, JSON.stringify(blocked)).toBe('route');
  expect(blocked.asked).toBe('Prinsengracht');

  const open = await approachWesterkerk(page);
  expect(open.modelled, 'the Westerkerk has a hand-built model').toBe(true);
  expect(open.kind, JSON.stringify(open)).toBe('landmark');
  expect(open.asked).toBe('Westerkerk');
  expect(open.heading).toBe('Which building is this?');
  expect(open.chip).toBe('landmark');
  expect(open.choices).toHaveLength(4);
  expect(open.choices).toContain('Westerkerk');
  expect(new Set(open.choices).size).toBe(4);
  expect(open.choices, 'the tower is the same building').not.toContain('Westertoren');
  // Never named on the HUD before the answer: no card, no panel, no DOM text,
  // and the label policies' withheld name is this landmark.
  expect(open.context).not.toContain('Westerkerk');
  expect(open.domMentions, 'a visible DOM surface other than the choices names it').toEqual([]);
  expect(open.card).toBeNull();
  expect(open.panelOpen).toBe(false);
  expect(open.gateQuizOpen).toBe(true);
  // Every choice is withheld, not only the answer: labelled distractors would
  // name the lit building by elimination (coordinator condition, #273).
  expect([...open.withheld].sort()).toEqual([...open.choices].sort());
  if (open.policyHidden) expect([...open.policyHidden].sort()).toEqual([...open.choices].sort());
  expect(open.session.landmarksAsked).toBe(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-question-open.png` });

  // Answer it as a rider would.
  await page.locator('#canal-choices button[data-name="Westerkerk"]').click();
  const answered = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const stamps = (window as any).CanalCollection?.all?.() ?? [];
    return {
      feedback: document.getElementById('canal-feedback')?.textContent,
      stamp: stamps.find((s: any) => s.name === 'Westerkerk') ?? null,
      sightings: JSON.parse(localStorage.getItem('canalRecall.landmarkSightings.v1') || '{}'),
      session: { ...(window as any).__canalRecallSession },
      promptName: game.quizPromptName,
      points: game.quizPoints,
    };
  });
  expect(answered.feedback).toContain('Correct');
  expect(answered.stamp?.how, 'the named stamp fires').toBe('named');
  expect(answered.promptName).toBe('');
  expect(answered.session.landmarksNamed).toBe(1);
  expect(Object.values(answered.sightings).some((s: any) => s.how === 'named')).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-answered.png` });

  // After the hold the card says what it is; already named, so "Noted".
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._landmarkNotice?.name ?? null), { timeout: 10000 }).toBe('Westerkerk');
  await page.waitForTimeout(800);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-card-after.png` });

  // Named once: the same ride past it again asks nothing.
  const again = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game._clearLandmarkNotice();
    game._landmarkAsked = new Set();
    game._seenLandmarks = new Set();
    game._questionBudget = { asks: [] };
    game.quizFeedback = '';
    game._prompt.style.display = 'none';
    game._updateLandmarks(1 / 60);
    return game.quizPromptKind;
  });
  expect(again).toBe('route');
});

test('a drive-by card offers Noticed, and one tap counts the landmark', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project is enough');
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });
  const bounds = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const landmark = game.landmarks.find((l: any) => l.name === 'Westerkerk');
    game._landmarkSightingsCache = {};
    try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); } catch { /* */ }
    game.quizFeedback = '';
    // No question may take the slot from the card during the tap.
    game.maxAsksPerMinute = 0;
    game._showLandmarkNotice(landmark, { kind: 'sticky' }, 'drive-by');
    game._landmarkNoticeAlpha = 1;
    game._landmarkNoticeState.elapsed = 1;
    game._renderLandmarkNotice();
    const rect = game.canvas.getBoundingClientRect();
    const b = game._landmarkActionBounds;
    return b && { x: rect.left + (b.x + b.w / 2) * rect.width / game.viewport.width, y: rect.top + (b.y + b.h / 2) * rect.height / game.viewport.height };
  });
  expect(bounds, 'the drive-by card has a Noticed pill').not.toBeNull();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-drive-by-noticed.png` });
  // The live frame redraws the card; wait until its pill is where we measured.
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._landmarkActionBounds)).toBe(true);
  await page.mouse.click(bounds!.x, bounds!.y);
  const after = await page.evaluate(() => ({
    sightings: JSON.parse(localStorage.getItem('canalRecall.landmarkSightings.v1') || '{}'),
    session: { ...(window as any).__canalRecallSession },
    cardStillUp: !!(window as any).canalRecallGame._landmarkNotice,
    panelOpen: getComputedStyle(document.getElementById('landmark-panel')!).display !== 'none',
  }));
  expect(Object.values(after.sightings).map((s: any) => s.how)).toEqual(['noticed']);
  expect(after.session.landmarksNoticed).toBe(1);
  expect(after.cardStillUp).toBe(true);
  expect(after.panelOpen, 'the tap is the pill, not the card').toBe(false);
});

test('?landmarkQuestions=0 keeps drive-by cards only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project is enough');
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=0' });
  const off = await approachWesterkerk(page);
  expect(off.kind).toBe('route');
  expect(off.asked).toBe('');
  expect(off.withheld, 'nothing withheld with the flag off').toEqual([]);
  const action = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const landmark = game.landmarks.find((l: any) => l.name === 'Westerkerk');
    game._showLandmarkNotice(landmark, { kind: 'sticky' }, 'drive-by');
    return game._landmarkCardAction();
  });
  expect(action, 'no Noticed pill with the flag off').toBeNull();
});

// Spaced review (#300): a landmark named right comes back after 1 day, then 3,
// 7, 21; one missed comes back next ride. Across a reload only localStorage
// carries over, so this is the real persistence path.
test('a named landmark is not asked after a reload until its review is due', async ({ page }) => {
  test.setTimeout(240000);
  const opts = { travelMode: 'car' as const, viewMode: 'chase' as const, query: '?landmarkQuestions=1' };
  await openRoute(page, opts);
  const open = await approachWesterkerk(page);
  expect(open.kind, JSON.stringify(open)).toBe('landmark');
  await page.locator('#canal-choices button[data-name="Westerkerk"]').click();
  const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem('canalRecall.landmarkReview.v1') || '{}')[id] ?? null, open.id);
  expect(stored, 'the answer is scheduled').not.toBeNull();
  expect(stored.step).toBe(1);
  const days = (stored.dueAt - stored.lastAskedAt) / 86_400_000;
  expect(days).toBeCloseTo(1, 5);

  // Reload: a new ride, the same approach. Named today: not asked (a
  // never-asked neighbour such as the Anne Frank House may be asked instead).
  await openRoute(page, opts);
  const reloaded = await approachWesterkerk(page, { keepReview: true });
  expect(reloaded.asked, JSON.stringify(reloaded)).not.toBe('Westerkerk');

  // Its review date in the past: due, so the same approach asks it.
  await page.evaluate((id) => {
    const all = JSON.parse(localStorage.getItem('canalRecall.landmarkReview.v1') || '{}');
    all[id].dueAt = Date.now() - 1000;
    localStorage.setItem('canalRecall.landmarkReview.v1', JSON.stringify(all));
  }, open.id);
  await openRoute(page, opts);
  const due = await approachWesterkerk(page, { keepReview: true });
  expect(due.kind, JSON.stringify(due)).toBe('landmark');
  expect(due.asked).toBe('Westerkerk');
  expect(due.domMentions, 'still never named before the answer').toEqual([]);
});
