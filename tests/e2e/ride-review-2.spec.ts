import { expect, test, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { landingFixtureEntries } from '../../src/canalRecall/landing/landingFixtures';

// Ride review round 2 (#298, docs/reviews/ride-review-2-20261109.md). Capture only, not a gate: it drives the
// merged gameplay loop on desktop (1440×900) and the iphone project (390×664, key frames also at 390×844) and
// writes a frame at every state change plus facts.jsonl (the game state behind each frame) to SHOTS=<dir>.
// Run: SHOTS=artifacts/ride-review-2 PW_PORT=4717 /tmp/canal-pw.sh npx playwright test tests/e2e/ride-review-2.spec.ts --project=desktop --workers=1
const OUT = process.env.SHOTS || '';
test.skip(!OUT, 'set SHOTS=<dir> to capture the review strip');
if (OUT) mkdirSync(OUT, { recursive: true });

const dev = () => (test.info().project.name === 'desktop' ? 'desktop' : 'phone');
const isPhone = () => dev() === 'phone';

/** A frame; on the phone `tall` also takes it at 390×844 and returns to 390×664. */
async function snap(page: Page, ride: string, step: string, tall = false) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${ride}-${step}-${dev()}.png` });
  if (tall && isPhone()) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${ride}-${step}-phone844.png` });
    await page.setViewportSize({ width: 390, height: 664 });
    await page.waitForTimeout(700);
  }
}
function fact(ride: string, step: string, data: unknown) {
  appendFileSync(`${OUT}/facts.jsonl`, JSON.stringify({ ride, step, dev: dev(), data }) + '\n');
}
async function waitState(page: Page, s: number, timeout = 120_000) {
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state ?? -1), { timeout }).toBe(s);
}
/** Everything a frame could get wrong, as numbers and names. */
async function facts(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (!g) return null;
    const box = (sel: string) => [...document.querySelectorAll(sel)].filter(e => (e as HTMLElement).offsetParent).map(e => {
      const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });
    const card = document.getElementById('canal-card');
    return {
      state: g.state, engine: g.vectorMap?.engine ?? null, from: g.routeFrom?.name, to: g.routeTo?.name,
      travel: g.routeOptions?.travelMode ?? g.travelMode, hood: g.currentNeighborhood ?? null,
      quizPoints: g.quizPoints, runLine: g._runArrivalLine?.() ?? null,
      run: JSON.parse(localStorage.getItem('canalRecall.openRun.v1') || 'null'),
      lastRun: JSON.parse(localStorage.getItem('canalRecall.lastRun.v1') || 'null'),
      runCard: g._runCard ?? null, shareUrl: g._shareUrl ?? null,
      finishButtons: (g._finishButtonBounds || []).map((b: any) => ({ id: b.id, w: Math.round(b.w), h: Math.round(b.h), y: Math.round(b.y) })),
      finishCard: g._finishCardBounds ?? null, vp: { w: g.viewport?.width, h: g.viewport?.height },
      landmarkNotice: g._landmarkNotice?.name ?? null, hoodNotice: g._neighborhoodNotice ? { name: g._neighborhoodNotice.name, stamped: g._neighborhoodNotice.stamped } : null,
      prompt: g.quizPromptName, promptKind: g.quizPromptKind, withheld: g.quizWithheldNames ?? null,
      cardVisible: !!card && getComputedStyle(card).display !== 'none',
      cardText: card && getComputedStyle(card).display !== 'none' ? (card.innerText || '').slice(0, 300) : null,
      choices: box('#canal-choices button, #canal-card button'),
      plaque: g._plaqueText ?? g._streetPlaque?.text ?? null,
      session: { ...((window as any).__canalRecallSession || {}) },
    };
  });
}
/** Advance along the planned path a step per frame until a card/question opens or `share` of the path is ridden. */
async function rideUntilCard(page: Page, share = 0.6) {
  return page.evaluate(async (share) => {
    const g = (window as any).canalRecallGame;
    const path = [...g.routePath, g.track.finishPoint];
    const frame = () => new Promise(r => requestAnimationFrame(r));
    let total = 0; for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    let done = 0; const start = g.player.distancePx ?? 0;
    const open = () => g.quizPromptName || g._landmarkNotice || g._neighborhoodNotice;
    for (let i = 1; i < path.length && g.state === 4; i++) {
      const a = path[i - 1], b = path[i]; const seg = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(seg / 25));
      for (let s = 1; s <= steps && g.state === 4; s++) {
        g.player.x = a.x + (b.x - a.x) * s / steps; g.player.y = a.y + (b.y - a.y) * s / steps;
        g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
        done += seg / steps; g.player.distancePx = start + done;
        await frame(); await frame();
        if (open()) return { opened: true, at: done / total, prompt: g.quizPromptName, kind: g.quizPromptKind, landmark: g._landmarkNotice?.name ?? null, hood: g._neighborhoodNotice?.name ?? null };
        if (done / total > share) return { opened: false, at: done / total };
      }
    }
    return { opened: false, at: done / total };
  }, share);
}
async function answer(page: Page, correct: boolean) {
  // The question card's DOM stays behind when it closes: act only on a visible card, never wait on a hidden button.
  if (!(await page.locator('#canal-card').isVisible().catch(() => false))) return false;
  const btns = page.locator('#canal-choices button:visible');
  if (await btns.count()) {
    const want = await page.evaluate(() => (window as any).canalRecallGame.quizPromptName);
    const pick = correct ? btns.filter({ hasText: want }).first() : btns.filter({ hasNotText: want }).first();
    if (await pick.count()) { await pick.click({ timeout: 5000 }).catch(() => {}); return true; }
  }
  const noIdea = page.locator('#canal-card button', { hasText: /No idea|Geen idee/ });
  if (await noIdea.isVisible().catch(() => false)) { await noIdea.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}
async function arrive(page: Page, points: number) {
  await answer(page, false);
  await page.evaluate((pts) => {
    const g = (window as any).canalRecallGame; g.maxAsksPerMinute = 0;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: pts, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
  }, points);
  // Ride the rest so the share trail has the leg, then settle on the finish (a question can hold the bike).
  await page.evaluate(async () => {
    const g = (window as any).canalRecallGame; const frame = () => new Promise(r => requestAnimationFrame(r));
    const path = [...g.routePath, g.track.finishPoint]; let near = 0, best = Infinity;
    path.forEach((p: any, i: number) => { const d = Math.hypot(p.x - g.player.x, p.y - g.player.y); if (d < best) { best = d; near = i; } });
    for (let i = Math.max(1, near); i < path.length && g.state === 4; i++) {
      const a = path[i - 1], b = path[i]; const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 60));
      for (let s = 1; s <= steps && g.state === 4; s++) { g.player.x = a.x + (b.x - a.x) * s / steps; g.player.y = a.y + (b.y - a.y) * s / steps; await frame(); }
    }
  });
  const deadline = Date.now() + 30_000;
  while (!(await page.evaluate(() => (window as any).canalRecallGame.state === 5))) {
    await answer(page, false);
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0; });
    if (Date.now() > deadline) throw new Error('no arrival within 30 s');
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(900);
}
const finishTap = (page: Page, id: string) => page.evaluate(want => (window as any).canalRecallGame._runFinishTap(want), id);
async function pauseCard(page: Page, ride: string) {
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(700);
  fact(ride, 'pause', { state: await page.evaluate(() => (window as any).canalRecallGame.state), buttons: await page.evaluate(() => ((window as any).canalRecallGame._pauseButtonBounds || []).map((b: any) => ({ id: b.id, w: Math.round(b.w), h: Math.round(b.h) }))) });
  await snap(page, ride, 'pause-card', true);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(500);
}
/** The question/drive-by beat of a ride: ride until something opens, frame it, answer, frame the answer. */
async function questionBeat(page: Page, ride: string, n: number, correct: boolean) {
  const r = await rideUntilCard(page, 0.55);
  fact(ride, `ride-${n}`, { ...r, ...(await facts(page)) });
  await snap(page, ride, `q${n}-open`, n === 1);
  if (await answer(page, correct)) {
    await page.waitForTimeout(700);
    await snap(page, ride, `q${n}-answered`);
    fact(ride, `answered-${n}`, { feedback: await page.locator('#canal-feedback').innerText().catch(() => null), ...(await facts(page)) });
    await page.waitForTimeout(3500);
    await snap(page, ride, `q${n}-after`);
    fact(ride, `after-${n}`, await facts(page));
  }
}
async function startFromSetup(page: Page, ride: string) {
  await expect(page.locator('#route-card')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await snap(page, ride, '02-setup', true);
  fact(ride, 'setup', await page.locator('#route-card').innerText().catch(() => null));
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return !!g._intro || g.state === 4; }, null, { timeout: 150_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await snap(page, ride, '03-start-flight');
  await waitState(page, 4, 150_000);
  await page.waitForTimeout(2500);
  await snap(page, ride, '04-ride-start', true);
  fact(ride, 'ride-start', await facts(page));
}

test('A guest: first visit landing → Start a ride → question → arrival → Next stop → End run → run card → Share', async ({ page }) => {
  test.setTimeout(900_000);
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  const phone = isPhone();
  await page.addInitScript((phone) => {
    const w = window as any; w.__sharedFiles = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: phone ? (d: any) => !!d.files?.length : undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: phone ? async (d: any) => {
      w.__sharedText = d.text ?? ''; w.__sharedUrl = d.url ?? '';
      for (const f of d.files ?? []) { const b = new Uint8Array(await f.arrayBuffer()); let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); w.__sharedFiles.push({ name: f.name, b64: btoa(s) }); }
    } : undefined });
  }, phone);
  await page.goto('/canal-drive/landing.html');
  await page.waitForTimeout(2000);
  await snap(page, 'A', '01-landing-guest', true);
  await page.screenshot({ path: `${OUT}/A-01b-landing-guest-full-${dev()}.png`, fullPage: true });
  fact('A', 'landing', { returningSlot: await page.locator('#landing-returning-slot').isVisible(), toast: await page.locator('#whats-new-toast').isVisible().catch(() => false), daily: await page.locator('[data-landing-go="daily"]').count() });
  const start = page.locator('a.stamp', { hasText: /Start a ride|Ride/ }).first();
  const href = await start.getAttribute('data-dev-href').catch(() => null);
  await page.goto(`/canal-drive/${(href || './').replace(/^\.\//, '')}`);
  await page.waitForTimeout(3000);
  await snap(page, 'A', '01c-game-first-open', true);
  fact('A', 'first-open', { onboarding: await page.locator('[class*=onboard], #onboarding').count(), state: await page.evaluate(() => (window as any).canalRecallGame?.state ?? null) });
  // Close a first-visit onboarding if one is up, as a player would.
  for (let i = 0; i < 4; i++) {
    const next = page.locator('button', { hasText: /^(Next|Got it|Start|Let.s ride|Skip|Close)$/i }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await snap(page, 'A', `01d-onboarding-${i}`); await next.click().catch(() => {}); await page.waitForTimeout(800);
  }
  await startFromSetup(page, 'A');
  await questionBeat(page, 'A', 1, true);
  await questionBeat(page, 'A', 2, false);
  await pauseCard(page, 'A');
  await arrive(page, 130);
  await snap(page, 'A', '05-arrive1', true);
  fact('A', 'arrive1', await facts(page));
  await finishTap(page, 'again');
  await waitState(page, 4, 120_000);
  await page.waitForTimeout(2500);
  await snap(page, 'A', '06-next-stop', true);
  fact('A', 'leg2', await facts(page));
  await questionBeat(page, 'A', 3, true);
  await arrive(page, 240);
  await snap(page, 'A', '07-arrive2', true);
  fact('A', 'arrive2', await facts(page));
  await finishTap(page, 'end');
  await page.waitForTimeout(1200);
  await snap(page, 'A', '08-run-card', true);
  fact('A', 'run-card', await facts(page));
  // Share run from the run card.
  let bytes: Buffer | null = null;
  if (phone) {
    await finishTap(page, 'copy');
    await page.waitForTimeout(3000);
    const sh = await page.evaluate(() => ({ f: (window as any).__sharedFiles, t: (window as any).__sharedText, u: (window as any).__sharedUrl }));
    fact('A', 'shared', { files: sh.f.map((x: any) => x.name), text: sh.t, url: sh.u });
    if (sh.f.length) bytes = Buffer.from(sh.f[0].b64, 'base64');
  } else {
    const dl = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await page.keyboard.press('KeyC');
    const file = await dl;
    if (file) bytes = Buffer.from(await (await import('node:fs/promises')).readFile(await file.path()));
    fact('A', 'shared', { dl: file?.suggestedFilename() ?? null });
  }
  await snap(page, 'A', '09-after-share');
  if (bytes) writeFileSync(`${OUT}/A-10-share-card-${dev()}.png`, bytes);
});

test('B returning: landing hook → Today’s ride → arrival → What’s New', async ({ page }) => {
  test.setTimeout(720_000);
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  const entries = landingFixtureEntries('returning', Date.now());
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('rr-seeded')) return;
    sessionStorage.setItem('rr-seeded', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, entries);
  await page.goto('/canal-drive/landing.html');
  await expect(page.locator('[data-landing-card]').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  await snap(page, 'B', '01-landing-returning', true);
  fact('B', 'landing', {
    stats: await page.locator('[data-landing-stats]').innerText().catch(() => null),
    cards: await page.locator('[data-landing-card]').allInnerTexts(),
    toast: await page.locator('#whats-new-toast').innerText().catch(() => null),
    taps: await page.locator('[data-landing-go], #whats-new-toast a, #whats-new-toast button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height) }; })),
  });
  await page.locator('[data-landing-go="daily"]').click();
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g && (!!g._intro || g.state === 4); }, null, { timeout: 150_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await snap(page, 'B', '02-daily-flight');
  await waitState(page, 4, 150_000);
  await page.waitForTimeout(2500);
  await snap(page, 'B', '03-daily-start', true);
  fact('B', 'daily-start', await facts(page));
  await questionBeat(page, 'B', 1, true);
  await arrive(page, 180);
  await snap(page, 'B', '04-daily-arrival', true);
  fact('B', 'daily-arrival', await facts(page));
  // Next stop, then a reload mid-leg (#280 defect 4): the dealt leg should resume, not Today's ride again.
  await finishTap(page, 'again');
  await waitState(page, 4, 120_000);
  await page.waitForTimeout(2000);
  fact('B', 'leg2-before-reload', await facts(page));
  await page.reload();
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === 4, null, { timeout: 150_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await snap(page, 'B', '04b-after-reload');
  fact('B', 'leg2-after-reload', await facts(page));
  await page.goto('/canal-drive/whats-new.html');
  await page.waitForTimeout(2500);
  await snap(page, 'B', '05-whats-new', true);
});

test('C Dutch: ?lang=nl setup → question → arrival → run card → pause', async ({ page }) => {
  test.setTimeout(720_000);
  await page.addInitScript(() => localStorage.setItem('canalRecall.language.v1', 'nl'));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?lang=nl', enterRacing: false });
  await waitState(page, 4, 150_000);
  await page.waitForTimeout(2500);
  await snap(page, 'C', '01-ride-start', true);
  fact('C', 'ride-start', await facts(page));
  await questionBeat(page, 'C', 1, true);
  await questionBeat(page, 'C', 2, false);
  await pauseCard(page, 'C');
  await arrive(page, 150);
  await snap(page, 'C', '02-arrival', true);
  fact('C', 'arrival', await facts(page));
  await finishTap(page, 'again');
  await waitState(page, 4, 120_000);
  await page.waitForTimeout(2000);
  await arrive(page, 90);
  await snap(page, 'C', '03-arrival2', true);
  fact('C', 'arrival2', await facts(page));
  await finishTap(page, 'end');
  await page.waitForTimeout(1200);
  await snap(page, 'C', '04-run-card', true);
  fact('C', 'run-card', await facts(page));
  await page.goto('/canal-drive/landing.html?lang=nl');
  await page.waitForTimeout(2000);
  await snap(page, 'C', '05-landing-nl', true);
});

test('D Free Ride collection: two places, checklist, token, stamp', async ({ page }) => {
  test.setTimeout(480_000);
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  await page.goto('/canal-drive/?ride=free');
  await waitState(page, 4, 150_000);
  await page.waitForTimeout(3000);
  await snap(page, 'D', '01-free-ride', true);
  const list = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const lists = [...g._freeRideChecklists().values()] as any[];
    const l = lists.filter(x => x.places.length >= 2).sort((a, b) => a.places.length - b.places.length)[0] ?? lists[0];
    return { hood: l.hood, n: lists.length, places: l.places.map((p: any) => ({ key: p.key, name: p.name, x: p.x, y: p.y })) };
  });
  fact('D', 'list', list);
  const place = (p: any, dy: number) => page.evaluate(({ p, dy }) => {
    const g = (window as any).canalRecallGame; const road = g.track.getNearestRoad(p.x, p.y + dy);
    const q = road ? { x: road.x, y: road.y } : { x: p.x, y: p.y + dy };
    Object.assign(g.player, { x: q.x, y: q.y, speed: 0, vx: 0, vy: 0, angle: road?.angle ?? 0 });
    g.camera.resetForRide?.(g.player); g._freeRideRefresh = 0;
  }, { p, dy });
  const tok = () => page.evaluate(() => {
    const g = (window as any).canalRecallGame; const c = g._freeRideCollection; const t = c?.tokenScreen;
    const rect = g.canvas.getBoundingClientRect(); const s = rect.width / g.viewport.width;
    return { key: c?.token?.key ?? null, screen: t ? { x: rect.left + t.x * s, y: rect.top + t.y * s, size: t.size * s } : null,
      tally: g._freeRideTally?.(), hood: g.currentNeighborhood, notice: g._landmarkNotice?.name ?? null,
      postcard: g._neighborhoodNotice ? { name: g._neighborhoodNotice.name, stamped: g._neighborhoodNotice.stamped } : null };
  });
  await place(list.places[0], 200 * 3);
  await page.waitForTimeout(2500);
  await snap(page, 'D', '02-approach-checklist', true);
  fact('D', 'approach', await tok());
  let i = 0;
  for (const p of list.places) {
    await place(p, 60 * 3);
    await page.waitForTimeout(1500);
    const t = await tok();
    fact('D', `place-${i}`, t);
    if (i === 0) await snap(page, 'D', '03-token-near');
    if (t.screen && t.key === p.key) {
      if (isPhone()) await page.touchscreen.tap(t.screen.x, t.screen.y); else await page.mouse.click(t.screen.x, t.screen.y);
    } else {
      await page.evaluate((p) => { const g = (window as any).canalRecallGame; g.player.x = p.x; g.player.y = p.y; g.player.speed = 0; }, p);
    }
    await page.waitForTimeout(1300);
    if (i < 2) { await snap(page, 'D', `04-opened-${i}`, i === 0); fact('D', `opened-${i}`, await tok()); }
    await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice?.());
    i++;
  }
  await page.waitForTimeout(1500);
  await snap(page, 'D', '05-stamp', true);
  fact('D', 'stamp', { ...(await tok()), passport: await page.evaluate(() => localStorage.getItem('canalRecall.neighborhoodPassport.v1')), coll: await page.evaluate(() => localStorage.getItem('canalRecall.freeRideCollection.v1')) });
  await page.waitForTimeout(4000);
  await snap(page, 'D', '06-stamp-later');
  // The knowledge screen after the collection: does the stamp show?
  await page.goto('/canal-drive/');
  await page.locator('#knowledge-button').click({ timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const album = page.getByTestId('stamp-album');
  fact('D', 'album-after', { earned: await album.getAttribute('data-earned').catch(() => null), total: await album.getAttribute('data-total').catch(() => null) });
  await album.scrollIntoViewIfNeeded().catch(() => {});
  await snap(page, 'D', '07-album-after-collection', true);
});

const DAY = 86_400_000;
const CENTRE = ['Grachtengordel', 'Jordaan', 'Oude Pijp', 'Marineterrein', 'Nieuwmarkt/Lastage', 'Prinses Irenebuurt e.o.'];
const OUTER = ['IJburg', 'Zuidoost', 'Nieuw-West', 'Tuindorp Nieuwendam', 'Buitenveldert-West', 'Oostelijk Havengebied'];
for (const set of ['centre', 'outer'] as const) {
  test(`E knowledge map and stamp album (${set} names); landing agrees`, async ({ page }) => {
    test.setTimeout(240_000);
    const now = Date.now();
    const names: Array<[string, string, [number, number], number, number]> = set === 'centre'
      ? [['Prinsengracht', 'canal', [52.3725, 4.8845], 3, 5], ['Keizersgracht', 'canal', [52.3705, 4.886], 3, 3], ['Herengracht', 'canal', [52.369, 4.889], 3, -1],
         ['Albert Cuypstraat', 'street', [52.356, 4.893], 3, 8], ['Westerstraat', 'street', [52.3775, 4.8825], 2, -2], ['Overtoom', 'street', [52.3615, 4.8723], 3, 9]]
      : [['IJburglaan', 'street', [52.354, 4.995], 3, 5], ['Bijlmerdreef', 'street', [52.317, 4.955], 2, -1], ['Meer en Vaart', 'street', [52.359, 4.802], 3, 6],
         ['Nieuwendammerdijk', 'street', [52.392, 4.937], 3, 2], ['De Boelelaan', 'street', [52.333, 4.866], 2, 4], ['Prinsengracht', 'canal', [52.3725, 4.8845], 3, 5]];
    const stamps = set === 'centre' ? CENTRE : OUTER;
    await page.addInitScript(({ now, day, names, stamps }) => {
      const states = Object.fromEntries(names.map(([name, type, center, repetitions, dueDays], i) => [`rr-${i}_guess_name`, {
        featureKey: `rr-${i}`, mode: 'guess_name', dueAt: now + dueDays * day, intervalDays: 4, ease: 2.3, repetitions, lapses: 0,
        lastReviewedAt: now - day, lastEventId: `e${i}`, schedulerVersion: 1, featureSnapshot: { name, type, cityId: 'amsterdam', center } }]));
      localStorage.setItem('mapRecall_reviewStates_v1', JSON.stringify(states));
      localStorage.setItem('canalRecall.neighborhoodPassport.v1', JSON.stringify({ stamped: stamps.slice(1), dates: Object.fromEntries(stamps.slice(1).map((s: string) => [s, '2026-11-07'])) }));
      localStorage.setItem('canalRecall.freeRideCollection.v1', JSON.stringify({ opened: [], stamps: [{ hood: stamps[0], at: '2026-11-08' }] }));
      localStorage.setItem('canalRecall.returningPlayer.v1', '1');
    }, { now, day: DAY, names, stamps });
    await page.goto('/canal-drive/');
    await page.locator('#knowledge-button').click({ timeout: 60_000 });
    const map = page.getByTestId('knowledge-map');
    await expect(map).toHaveAttribute('data-render-ms', /\d/, { timeout: 30_000 });
    await page.waitForTimeout(800);
    await snap(page, 'E', `01-knowledge-${set}`, true);
    fact('E', `map-${set}`, { renderMs: await map.getAttribute('data-render-ms'), legend: await page.locator('[data-testid=knowledge-map]').innerText().catch(() => null) });
    const [lat, lng] = names[0][2];
    const point = await page.evaluate(([lat, lng]) => {
      const c = document.querySelector('[data-testid=knowledge-map] canvas') as any; const [x, y] = c.knowledgeMapProject(lat, lng); return { x, y };
    }, [lat, lng]);
    await map.locator('canvas').click({ position: point }).catch(() => {});
    await page.waitForTimeout(600);
    await snap(page, 'E', `02-buurt-tapped-${set}`);
    fact('E', `filter-${set}`, await page.locator('.kmap-filter').innerText().catch(() => null));
    const album = page.getByTestId('stamp-album');
    await album.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await snap(page, 'E', `03-album-${set}`, true);
    await album.screenshot({ path: `${OUT}/E-03b-album-element-${set}-${dev()}.png` });
    fact('E', `album-${set}`, { earned: await album.getAttribute('data-earned'), total: await album.getAttribute('data-total'), seeded: stamps.length,
      captions: await album.locator('.stamp').evaluateAll(els => els.slice(0, 40).map(e => { const el = e as HTMLElement; return { t: (el.innerText || '').replace(/\n/g, ' | ').slice(0, 60), clipped: [...el.querySelectorAll('*')].some(c => (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1) }; })) });
    await page.goto('/canal-drive/landing.html');
    await page.waitForTimeout(1800);
    fact('E', `landing-${set}`, await page.locator('[data-landing-stats]').innerText().catch(() => 'no stats'));
    await snap(page, 'E', `04-landing-${set}`);
  });
}

test('F own engine: one desktop ride (?engine=own) start → question → arrival', async ({ page }) => {
  test.skip(isPhone(), 'desktop only');
  test.setTimeout(720_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?engine=own', enterRacing: false, abortHeavyTiles: false });
  await waitState(page, 4, 150_000);
  await page.waitForTimeout(5000);
  await snap(page, 'F', '01-ride-start');
  fact('F', 'ride-start', await facts(page));
  await questionBeat(page, 'F', 1, true);
  await questionBeat(page, 'F', 2, false);
  await arrive(page, 120);
  await snap(page, 'F', '02-arrival');
  fact('F', 'arrival', await facts(page));
  await finishTap(page, 'end');
  await page.waitForTimeout(1200);
  await snap(page, 'F', '03-run-card');
  fact('F', 'run-card', await facts(page));
});
