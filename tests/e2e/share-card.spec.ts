// G6 (#276): "Share this route" on the arrival card offers a 1200×630 picture
// of the ride: the ridden silhouette, destination, distance, time, ribbon.
// It never names the answer of a question still open, and keeps the link.
//
// The desktop project removes the share sheet (macOS Chrome has one that
// headless never resolves), so the picture downloads and the link is copied;
// the iphone project stubs a share sheet that takes files.

import { expect, Page, test } from '@playwright/test';
import { openRoute } from './helpers';

type Pt = { x: number; y: number };
type ShareGame = {
  state: number;
  player: Pt & { distancePx?: number };
  routePath: Pt[];
  track: { finishPoint: Pt };
  routeTo: { name?: string } | null;
  quizPromptName: string | null;
  quizCandidateName: string | null;
  _shareUrl: string | null;
  _shareTrail?: { points: Pt[] } | null;
  _shareCard?: { width: number; height: number; texts: string[]; ms: number } | null;
  _finishButtonBounds?: Array<{ id: string }>;
  _runFinishAction(id: string): void;
};
const game = (page: Page) => page.evaluate(() => (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame !== undefined);

/** Ride the planned path a step per frame, so the trail samples it, then arrive. */
async function rideToFinish(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame;
    const path = [...g.routePath, g.track.finishPoint];
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame.state), { timeout: 20_000 }).toBe(5);
}

/** Desktop: no system share sheet, the download fallback. */
async function withoutShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
}

const pngSize = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), png: bytes.subarray(1, 4).toString() === 'PNG' });

test('the arrival card shares a 1200×630 picture of the ride, never the open question', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const phone = testInfo.project.name === 'iphone';
  if (phone) {
    await page.addInitScript(() => {
      const w = window as unknown as { __sharedFiles: Array<{ name: string; b64: string }>; __sharedText: string };
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
    await withoutShareSheet(page);
  }
  await openRoute(page, { travelMode: 'car' });
  expect(await game(page)).toBe(true);
  await rideToFinish(page);

  const arrival = await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame;
    // The open question's answer is the destination itself: the card must not say it.
    g.quizPromptName = g.routeTo?.name ?? null;
    // Every dealt route carries its own share link from the moment it is dealt (#282): no seeding.
    return {
      destination: g.routeTo?.name ?? '',
      candidate: g.quizCandidateName,
      trail: g._shareTrail?.points.length ?? 0,
      buttons: (g._finishButtonBounds ?? []).map(b => b.id),
      share: g._shareUrl,
    };
  });
  expect(arrival.trail, 'the ridden path was sampled').toBeGreaterThan(5);
  expect(arrival.share, 'the dealt route has its own share link').toMatch(/#race=/);
  expect(arrival.buttons, 'and the card offers Share').toContain('copy');
  expect(arrival.destination).not.toBe('');

  let bytes: Buffer;
  if (phone) {
    await page.evaluate(() => (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame._runFinishAction('copy'));
    await expect.poll(() => page.evaluate(() => (window as unknown as { __sharedFiles: unknown[] }).__sharedFiles.length)).toBe(1);
    const shared = await page.evaluate(() => {
      const w = window as unknown as { __sharedFiles: Array<{ name: string; b64: string }>; __sharedText: string };
      return { __sharedFiles: w.__sharedFiles, __sharedText: w.__sharedText };
    });
    bytes = Buffer.from(shared.__sharedFiles[0].b64, 'base64');
    expect(shared.__sharedFiles[0].name).toMatch(/^ride-amsterdam-.*\.png$/);
    expect(shared.__sharedText, 'the link travels with the picture').toContain('#race=');
  } else {
    const download = page.waitForEvent('download');
    await page.keyboard.press('KeyC');
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^ride-amsterdam-.*\.png$/);
    bytes = Buffer.from(await (await import('node:fs/promises')).readFile(await file.path()));
  }
  expect(pngSize(bytes)).toEqual({ width: 1200, height: 630, png: true });

  const card = await page.evaluate(() => (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame._shareCard!);
  const drawn = card.texts.join(' | ');
  expect(drawn).not.toContain(arrival.destination);
  if (arrival.candidate) expect(drawn).not.toContain(arrival.candidate);
  expect(drawn).toContain('rideamsterdam.nl');
  expect(card.texts[0], 'a withheld destination: RIDE over its buurt').toBe('RIDE');
  const session = await page.evaluate(() => (window as unknown as { __canalRecallSession?: Record<string, number> }).__canalRecallSession?.sharePictures);
  expect(session).toBe(1);
  testInfo.annotations.push({ type: 'share-card', description: `${bytes.length} bytes, drawn in ${card.ms.toFixed(1)} ms; ${drawn}` });
  const saved = testInfo.outputPath('share-card.png');
  await (await import('node:fs/promises')).writeFile(saved, bytes);
  await testInfo.attach('share-card.png', { path: saved, contentType: 'image/png' });
  console.log(`SHARE CARD ${testInfo.project.name}: ${bytes.length} bytes, ${card.ms.toFixed(1)} ms, texts: ${drawn}`);
});

test('?shareCard=0 keeps the link-only share', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project is enough for the flag');
  test.setTimeout(120_000);
  await withoutShareSheet(page);
  await openRoute(page, { travelMode: 'car', query: '?shareCard=0' });
  await rideToFinish(page);
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame;
    if (!g._shareUrl) throw new Error('the dealt route has no share link (#282)');
    g._runFinishAction('copy');
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __canalLastShare?: { url: string } }).__canalLastShare?.url ?? '')).toContain('#race=');
  expect(downloaded).toBe(false);
  expect(await page.evaluate(() => (window as unknown as { canalRecallGame: ShareGame }).canalRecallGame._shareCard ?? null)).toBeNull();
});
