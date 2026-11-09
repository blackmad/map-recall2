import { expect, test, type Page } from '@playwright/test';
import { finishKeycapCentre, openRoute } from './helpers';

// #295 (G6 follow-up): the run card (End run after a chained run) shares one
// 1200×630 picture of the whole run: every leg as one silhouette, the stops
// numbered, RUN over the buurt or city, the run line, rideamsterdam.nl. It
// never prints a withheld name. Two stops are seeded with their legs (as a
// run saved by this build keeps them), the third is ridden for real, then
// End run and Share.
//
// Lanes run it against a scratch build: BUNDLES_DIR=<dir> (helpers.ts).

type Pt = { x: number; y: number };
type Bounds = Pt & { w: number; h: number; id: string };
const shot = (name: string) => `artifacts/l295/${name}-${test.info().project.name}.png`;
const pngSize = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), png: bytes.subarray(1, 4).toString() === 'PNG' });

async function seedRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l295-seeded')) return;
    sessionStorage.setItem('l295-seeded', '1');
    const now = Date.now();
    const stop = (id: string, name: string, points: number, bonus: number, lat: number, lng: number, path: Array<[number, number]>, at: number) => ({
      id, name, basePoints: points, points: Math.round(points * (1 + bonus)), bonus, bestStreak: 2, names: [`Street ${id}`], at, lat, lng, area: 'Centrum', path,
    });
    localStorage.setItem('canalRecall.openRun.v1', JSON.stringify({
      version: 1, startedAt: now - 1_200_000, lastActiveAt: now - 30_000, startName: 'Noordermarkt',
      stopCount: 2, totalPoints: 130 + 252, bestStreak: 2, names: ['Street westerkerk', 'Street rijks'],
      stops: [
        stop('westerkerk', 'Westerkerk', 130, 0, 52.3746, 4.8840, [[52.3786, 4.8862], [52.3786, 4.8845], [52.3746, 4.8840]], now - 900_000),
        stop('rijks', 'Rijksmuseum', 240, 0.05, 52.3600, 4.8852, [[52.3746, 4.8840], [52.3655, 4.8830], [52.3600, 4.8852]], now - 300_000),
      ],
    }));
  });
}

/** Ride the planned path a step per frame, so the share trail samples it, then arrive. */
async function rideToFinish(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).canalRecallGame.maxAsksPerMinute = 0; });
  await page.evaluate(async () => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 200, quizBestStreak: 2 });
    const path: Pt[] = [...g.routePath, g.track.finishPoint];
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    let travelled = g.player.distancePx ?? 0;
    for (let i = 1; i < path.length && g.state === 4; i++) {
      const a = path[i - 1], b = path[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 40));
      for (let s = 1; s <= steps && g.state === 4; s++) {
        g.player.x = a.x + (b.x - a.x) * s / steps;
        g.player.y = a.y + (b.y - a.y) * s / steps;
        travelled += Math.hypot(b.x - a.x, b.y - a.y) / steps;
        g.player.distancePx = travelled;
        await frame();
      }
    }
  });
  // A landmark question can hold the bike short of the finish (#282): answer it and settle on the finish.
  const noIdea = page.locator('#canal-card button', { hasText: /No idea|Geen idee/ });
  const deadline = Date.now() + 30_000;
  while (!(await page.evaluate(() => (window as any).canalRecallGame.state === 5))) {
    if (await noIdea.isVisible().catch(() => false)) { await noIdea.click().catch(() => {}); await page.waitForTimeout(3000); }
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
    });
    if (Date.now() > deadline) throw new Error('no arrival within 30 s');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
}

test('the run card shares one picture of the whole run, never a withheld name', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const phone = testInfo.project.name === 'iphone';
  if (phone) {
    // A share sheet that takes files, as iOS Safari's.
    await page.addInitScript(() => {
      const w = window as any;
      w.__sharedFiles = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => !!d.files?.length });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: ShareData) => {
          w.__sharedText = d.text ?? '';
          for (const f of d.files ?? []) {
            const bytes = new Uint8Array(await f.arrayBuffer());
            let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); });
            w.__sharedFiles.push({ name: f.name, b64: btoa(s) });
          }
        },
      });
    });
  } else {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
  }
  await seedRun(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await rideToFinish(page);
  const third = await page.evaluate(() => (window as any).canalRecallGame.routeTo.name as string);

  // End run; the open question names stop 2 (the map withholds it, so must the picture).
  if (phone) await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('end'));
  else await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!(window as any).canalRecallGame._runCard, null, { timeout: 10_000 });
  await page.evaluate(() => { (window as any).canalRecallGame.quizCandidateName = 'Rijksmuseum'; });
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return {
      buttons: (g._finishButtonBounds as Bounds[]).map(b => b.id),
      card: g._finishCardBounds as Bounds,
      viewport: { w: g.viewport.width, h: g.viewport.height },
      last: JSON.parse(localStorage.getItem('canalRecall.lastRun.v1') || 'null'),
      share: g._shareUrl as string | null,
    };
  });
  expect(card.share, 'the last leg has its link').toMatch(/#race=/);
  expect(card.buttons).toEqual(['again', 'route', 'copy']);
  expect(card.card.y + card.card.h).toBeLessThanOrEqual(card.viewport.h);
  expect(card.last.stopCount).toBe(3);
  const leg = card.last.stops[2];
  expect(leg.path?.length ?? 0, 'the ridden leg is kept as lat/lngs').toBeGreaterThanOrEqual(2);
  expect(Math.abs(leg.path[leg.path.length - 1][0] - 52.37)).toBeLessThan(0.1);
  const at = await finishKeycapCentre(page, 'copy');
  expect(at, 'Share keycap on screen').toBeTruthy();
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(at!.y + at!.h / 2).toBeLessThanOrEqual(innerHeight);
  if (phone) expect(at!.h, 'a phone touch target').toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: shot('run-card') });

  let bytes: Buffer;
  if (phone) {
    await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('copy'));
    await expect.poll(() => page.evaluate(() => (window as any).__sharedFiles.length)).toBe(1);
    const shared = await page.evaluate(() => ({ files: (window as any).__sharedFiles as Array<{ name: string; b64: string }>, text: (window as any).__sharedText as string }));
    bytes = Buffer.from(shared.files[0].b64, 'base64');
    expect(shared.files[0].name).toMatch(/^ride-amsterdam-run-3-stops.*\.png$/);
    expect(shared.text, 'the link travels with the picture').toContain('#race=');
  } else {
    const download = page.waitForEvent('download');
    await page.keyboard.press('KeyC');
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^ride-amsterdam-run-3-stops.*\.png$/);
    bytes = Buffer.from(await (await import('node:fs/promises')).readFile(await file.path()));
  }
  expect(pngSize(bytes)).toEqual({ width: 1200, height: 630, png: true });

  const picture = await page.evaluate(() => (window as any).canalRecallGame._shareCard as { texts: string[]; ms: number });
  const drawn = picture.texts.join(' | ');
  expect(picture.texts).toContain('RUN');
  expect(drawn).toMatch(/3 stops\s+·\s+\d+ names\s+·\s+[\d,]+ points/);
  expect(drawn).not.toMatch(/chain/);
  expect(picture.texts).toContain('Westerkerk');
  expect(picture.texts).toContain('Stop 2');
  expect(drawn).not.toContain('Rijksmuseum');
  expect(drawn).toContain(third.length > 18 ? third.slice(0, 12) : third);
  for (const n of ['1', '2', '3']) expect(picture.texts.filter(t => t === n).length, `stop ${n}: a dot and a list number`).toBe(2);
  expect(picture.texts).toContain('rideamsterdam.nl');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('run-card-shared') });
  const saved = testInfo.outputPath('run-share.png');
  await (await import('node:fs/promises')).writeFile(saved, bytes);
  await (await import('node:fs/promises')).writeFile(shot('picture'), bytes);
  console.log(`RUN SHARE ${testInfo.project.name}: ${bytes.length} bytes, ${picture.ms.toFixed(1)} ms, keycap h ${at!.h.toFixed(1)} px, texts: ${drawn}`);
});

test('?shareCard=0: the run card shares the link only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project is enough for the flag');
  test.setTimeout(180_000);
  await seedRun(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?shareCard=0' });
  await rideToFinish(page);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!(window as any).canalRecallGame._runCard, null, { timeout: 10_000 });
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.evaluate(() => (window as any).canalRecallGame._runFinishTap('copy'));
  await expect.poll(() => page.evaluate(() => (window as any).__canalLastShare?.url ?? '')).toContain('#race=');
  expect(downloaded).toBe(false);
  expect(await page.evaluate(() => (window as any).canalRecallGame._shareCard ?? null)).toBeNull();
});
