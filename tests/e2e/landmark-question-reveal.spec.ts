import { expect, test, type Page } from '@playwright/test';
import { landingFixtureEntries } from '../../src/canalRecall/landing/landingFixtures';

// #281 — the landmark question must not ask about a building whose name was
// just on screen. Ride review #280 defect 1: at the start of Today's ride for
// 2026-11-09 (Red Light District) the orientation label "VLAAMS CULTUURHUIS DE
// BRAKKE GROND" stood on screen and about five seconds later the ride asked
// "Which building is this?" about the Brakke Grond.
//
// Rule (labelDrawLedger.ts): a landmark is asked about only if no label layer
// drew its name in the last 30 s and no drive-by card for it showed in the last
// 60 s; once it is the approached candidate its name and its three
// distractors' names are withheld, leaving at the label budget's own fade.
//
// Every frame samples the label overlay's drawn set (`.cr-map-labels
// [data-map-label]` with its computed opacity) and the game's question state.

const SHOTS = process.env.REVEAL_SHOTS_DIR || '';
const BRAKKE = /brakke grond/i;
const dev = () => (test.info().project.name === 'desktop' ? 'desktop' : 'phone');

interface Frame {
  t: number; state: number; kind: string; asked: string; withheld: string[]; approach: string[];
  labels: Record<string, number>;
}

async function startSampler(page: Page) {
  await page.evaluate(() => {
    const frames: any[] = []; (window as any).__revealFrames = frames;
    const tick = () => {
      const g = (window as any).canalRecallGame;
      const labels: Record<string, number> = {};
      for (const el of document.querySelectorAll('.cr-map-labels [data-map-label]')) {
        const o = Number(getComputedStyle(el).opacity);
        if (o > 0.01) labels[(el as HTMLElement).dataset.mapLabel!] = Math.round(o * 100) / 100;
      }
      // The own engine's canvas labels, when that engine draws them.
      for (const l of g?.vectorMap?._labels?.placed ?? []) labels[l.text] = 1;
      frames.push({
        t: Math.round(performance.now()), state: g?.state ?? -1, kind: g?.quizPromptKind ?? '', asked: g?.quizPromptName ?? '',
        withheld: [...(g?.quizWithheldNames ?? [])], approach: [...(g?.landmarkApproachWithheld ?? [])], labels,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const frames = (page: Page): Promise<Frame[]> => page.evaluate(() => (window as any).__revealFrames);
const shown = (f: Frame, re: RegExp | string) => Object.entries(f.labels).filter(([n]) => (typeof re === 'string' ? n === re : re.test(n))).map(([, o]) => o);

/** The invariants over a sampled ride: (1) no question about a name drawn in
 *  the 30 s before it opened; (2) from the moment a landmark is withheld as the
 *  candidate (or asked), its label is never drawn; (3) a label withheld while
 *  on screen fades out over several frames, never pops. Returns what it saw. */
function checkInvariants(log: Frame[]) {
  const asked = new Map<string, number>();
  for (const f of log) if (f.kind === 'landmark' && f.asked && !asked.has(f.asked)) asked.set(f.asked, f.t);
  for (const [name, at] of asked) {
    const drawnBefore = log.filter(f => f.t < at && f.t >= at - 30_000 && shown(f, name).length);
    expect(drawnBefore.map(f => f.t), `"${name}" was drawn in the 30 s before its question at ${at}`).toEqual([]);
  }
  const candidateSince = new Map<string, number>();
  for (const f of log) {
    const answer = f.approach[0] || (f.kind === 'landmark' ? f.asked : '');
    if (answer && !candidateSince.has(answer)) candidateSince.set(answer, f.t);
  }
  for (const [name, since] of candidateSince) {
    const end = log.find(f => f.t > since && !f.approach.includes(name) && !(f.kind === 'landmark' && f.asked === name))?.t ?? Infinity;
    const leaks = log.filter(f => f.t >= since && f.t < end && shown(f, name).length);
    expect(leaks.map(f => f.t), `"${name}" drawn while it was the candidate or under question`).toEqual([]);
  }
  // Fades: a name entering the withheld set while drawn.
  const fades: { name: string; ms: number; steps: number }[] = [];
  for (let i = 1; i < log.length; i++) {
    const prior = new Set([...log[i - 1].approach, ...log[i - 1].withheld]);
    for (const name of new Set([...log[i].approach, ...log[i].withheld])) {
      if (prior.has(name) || !(log[i - 1].labels[name] > 0.5)) continue;
      let j = i, steps = 0;
      while (j < log.length && (log[j].labels[name] ?? 0) > 0.01) { if (log[j].labels[name] < 0.95) steps++; j++; }
      fades.push({ name, ms: (log[j]?.t ?? log[log.length - 1].t) - log[i - 1].t, steps });
    }
  }
  for (const fade of fades) {
    expect(fade.steps, `"${fade.name}" popped instead of fading: ${JSON.stringify(fade)}`).toBeGreaterThanOrEqual(2);
    expect(fade.ms, `"${fade.name}" fade too short: ${JSON.stringify(fade)}`).toBeGreaterThanOrEqual(150);
  }
  return { asked: [...asked.keys()], candidates: [...candidateSince.keys()], fades };
}

test('Today’s ride 2026-11-09: the Brakke Grond is not asked after its label, and withheld labels fade', async ({ page }) => {
  test.setTimeout(240_000);
  if (dev() === 'phone') await page.setViewportSize({ width: 414, height: 896 });
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  // The review's path: a returning rider taps Today's ride on the landing (Red Light District start).
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('lq-seeded')) return; sessionStorage.setItem('lq-seeded', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, landingFixtureEntries('returning', Date.now()));
  await page.goto('/canal-drive/landing.html');
  await page.locator('[data-landing-go="daily"]').click();
  await page.waitForURL(/ride=daily/);
  await page.evaluate(() => { if (!/landmarkQuestions=/.test(location.search)) history.replaceState(null, '', `${location.pathname}${location.search}&landmarkQuestions=1`); });
  await startSampler(page);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state ?? -1), { timeout: 150_000 }).toBe(4);
  await page.waitForTimeout(2500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/start-${dev()}.png` });
  await page.waitForTimeout(6000);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/start-8s-${dev()}.png` });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(6000); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/riding-${dev()}.png` });
  const log = await frames(page);
  const seen = checkInvariants(log);
  const session = await page.evaluate(() => ({ ...(window as any).__canalRecallSession }));
  test.info().annotations.push({ type: 'reveal', description: JSON.stringify({ ...seen, skips: session.landmarkSkips ?? null, brakkeDrawn: log.some(f => shown(f, BRAKKE).length) }) });
  // The defect itself: the Brakke Grond is never asked within 30 s of its label.
  const brakkeLabel = log.filter(f => shown(f, BRAKKE).length).map(f => f.t);
  const brakkeAsked = log.find(f => f.kind === 'landmark' && BRAKKE.test(f.asked));
  if (brakkeAsked && brakkeLabel.length) expect(brakkeAsked.t - Math.max(...brakkeLabel.filter(t => t < brakkeAsked.t))).toBeGreaterThanOrEqual(30_000);
});

test('a label on screen as the rider turns toward its landmark: not asked within 30 s, skip counted', async ({ page }) => {
  test.setTimeout(240_000);
  if (dev() === 'phone') await page.setViewportSize({ width: 414, height: 896 });
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  await page.goto('/canal-drive/?ride=daily&dailyDate=2026-11-09&landmarkQuestions=1');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state ?? -1), { timeout: 150_000 }).toBe(4);
  await startSampler(page);
  // Stand 60 m short of the Brakke Grond, side-on (its label in the frame, the
  // building outside the question's cone), with an empty slot and budget.
  const place = (angleOffset: number, metres: number) => page.evaluate(([offset, m]) => {
    const game = (window as any).canalRecallGame;
    const lm = game.landmarks.find((l: any) => /brakke grond/i.test(l.name));
    if (!lm) return null;
    game.routePath = null; game.routeTo = { id: 'lm-elsewhere', name: 'Elsewhere' };
    game.quizFeedback = ''; game.quizCandidateName = ''; game._silentPass = null; game._questionBudget = { asks: [] };
    game._landmarkAsked = new Set(); game._seenLandmarks = new Set(); game._landmarkSightingsCache = {};
    game._clearLandmarkNotice?.();
    // Facing east along the Nes, the building `offset` radians off the heading.
    const heading = 0;
    const bearing = heading + offset;
    Object.assign(game.player, { x: lm.x - Math.cos(bearing) * m * 3, y: lm.y - Math.sin(bearing) * m * 3, angle: heading, speed: 0, vx: 0, vy: 0 });
    return lm.name;
  }, [angleOffset, metres] as [number, number]);
  const name = await place((70 * Math.PI) / 180, 120);
  test.skip(!name, 'no Brakke Grond in this extract');
  // Its label on screen (a few label plans).
  await expect.poll(async () => (await frames(page)).slice(-5).some(f => shown(f, BRAKKE).length), { timeout: 15_000 }).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/label-on-screen-${dev()}.png` });
  // Turn toward it: inside the cone and 110 m.
  await place(0, 110);
  await page.waitForTimeout(5000);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/turned-${dev()}.png` });
  const log = await frames(page);
  checkInvariants(log);
  expect(log.some(f => f.kind === 'landmark' && BRAKKE.test(f.asked)), 'asked about the Brakke Grond with its label just drawn').toBe(false);
  expect(log.some(f => f.approach.some(n => BRAKKE.test(n))), 'it became the candidate with its label just drawn').toBe(false);
  const skips = await page.evaluate(() => (window as any).__canalRecallSession?.landmarkSkips ?? null);
  expect(skips?.labelRecent ?? 0).toBeGreaterThanOrEqual(1);
});
