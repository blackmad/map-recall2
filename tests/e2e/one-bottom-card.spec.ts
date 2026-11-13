import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Never two bottom cards (#284, ride review #280 defect 8). After the landmark
// answer on desktop the landmark card and the Jordaan postcard were both
// active at once (`_landmarkNotice` and `_neighborhoodNotice` set together),
// though only one was drawn. The rule now lives at the source in every mode:
// a landmark card closes a postcard that is up, and a postcard waits while a
// landmark card is open. A per-frame sampler counts the active bottom cards
// (the question/answer card, the landmark card, the postcard) through the
// whole sequence: question answered → drive-by card → neighbourhood postcard.

const SHOTS = process.env.ONE_CARD_SHOTS || '';

/** Count active bottom cards on every animation frame from now on. */
async function startSampler(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__oneCard = { frames: 0, max: 0, both: [] as string[] };
    const tick = () => {
      const g = w.canalRecallGame;
      if (g) {
        // The question (and its answer during the hold): the prompt as the teaching gate reads it.
        const prompt = g._prompt as HTMLElement | null;
        const active = [
          prompt && prompt.style.display !== 'none' && prompt.style.display !== '' ? `question:${g.quizPromptKind}:${g.quizPromptName}:${g.quizFeedback ? 'answered' : 'open'}` : '',
          g._landmarkNotice ? `landmark:${g._landmarkNotice.name}` : '',
          g._neighborhoodNotice && g._neighborhoodNoticeTimer > 0 ? `postcard:${g._neighborhoodNotice.name}` : '',
        ].filter(Boolean);
        w.__oneCard.frames++;
        w.__oneCard.max = Math.max(w.__oneCard.max, active.length);
        if (active.length > 1 && w.__oneCard.both.length < 5) w.__oneCard.both.push(active.join(' + '));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const sampled = (page: Page) => page.evaluate(() => ({ ...(window as any).__oneCard }));
const state = (page: Page) => page.evaluate(() => {
  const g = (window as any).canalRecallGame;
  return {
    landmark: g._landmarkNotice?.name ?? null,
    postcard: g._neighborhoodNotice && g._neighborhoodNoticeTimer > 0 ? g._neighborhoodNotice.name : null,
    pending: g._postcardPending ?? null,
    hood: g.currentNeighborhood,
  };
});

test('one bottom card at every frame: landmark answer, its card, then the postcard', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const phone = testInfo.project.name !== 'desktop';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=1' });

  // In the Jordaan, 110 m west of the Westerkerk, facing it, nothing open.
  const setup = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const landmark = g.landmarks.find((l: any) => l.name === 'Westerkerk');
    if (!landmark) return { error: 'no Westerkerk' };
    g.routeOptions.answerMode = 'multiple';
    g.routePath = null;
    g.routeTo = { id: 'lm-elsewhere', name: 'Elsewhere' };
    g.quizFeedback = '';
    g.quizCandidateName = '';
    g._silentPass = null;
    g._questionBudget = { asks: [] };
    g._landmarkAsked = new Set();
    g._seenLandmarks = new Set();
    g._landmarkSightingsCache = {};
    try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); } catch { /* */ }
    g._clearLandmarkNotice();
    g._neighborhoodNotice = null;
    g._neighborhoodNoticeTimer = 0;
    g._prompt.style.display = 'none';
    g.quizPromptName = '';
    g.quizPromptKind = 'route';
    Object.assign(g.player, { x: landmark.x - 20 * 3, y: landmark.y, angle: 0, speed: 0, vx: 0, vy: 0 });
    g._updateLandmarks(1 / 60);
    return { kind: g.quizPromptKind, asked: g.quizPromptName };
  });
  expect(setup.error).toBeUndefined();
  await startSampler(page);

  if (setup.kind === 'landmark') {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1-question-${testInfo.project.name}.png` });
    // The rider crosses into the Jordaan while the question is open: a postcard is due.
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g._postcardPending = g.currentNeighborhood; });
    await page.locator('#canal-choices button[data-name="Westerkerk"]').click();
  } else {
    // No question on this layout: the drive-by card opens by itself.
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      g._postcardPending = g.currentNeighborhood;
      g._showLandmarkNotice(g.landmarks.find((l: any) => l.name === 'Westerkerk'), { kind: 'sticky' }, 'drive-by');
    });
  }
  // The card that follows the answer.
  await expect.poll(() => state(page).then(s => s.landmark), { timeout: 10_000 }).toBe('Westerkerk');
  await page.waitForTimeout(1500);
  const during = await state(page);
  expect(during.postcard, 'the postcard waits while the landmark card is open').toBeNull();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/2-card-${testInfo.project.name}.png` });

  // Closing the card frees the slot: the postcard that waited comes up (desktop; the phone shows none).
  await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice());
  if (!phone) {
    await expect.poll(() => state(page).then(s => s.postcard), { timeout: 10_000 }).toBeTruthy();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/3-postcard-${testInfo.project.name}.png` });
    // A drive-by card while the postcard is up takes the slot in the same frame.
    const swapped = await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      g._showLandmarkNotice(g.landmarks.find((l: any) => l.name === 'Anne Frank House') ?? g.landmarks[0], { kind: 'sticky' }, 'drive-by');
      return { landmark: !!g._landmarkNotice, postcard: !!(g._neighborhoodNotice && g._neighborhoodNoticeTimer > 0) };
    });
    expect(swapped).toEqual({ landmark: true, postcard: false });
    await page.waitForTimeout(800);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/4-driveby-over-postcard-${testInfo.project.name}.png` });
  } else {
    await page.waitForTimeout(1500);
  }

  const result = await sampled(page);
  expect(result.frames).toBeGreaterThan(30);
  expect(result.both, 'frames with two bottom cards active').toEqual([]);
  expect(result.max).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
