import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { openRoute } from './helpers';

// A phone player taps. Street following stops where there is no straight on
// and waits for a side (streetFollow.ts); L1's iPhone profile found that a tap
// of a turn button there only queued the turn and the rider stood still — only
// holding the button went (a pivot after 0.6 s). The seeded route of
// engine-own.spec's ride() spawns the iPhone rider across Polonceaukade facing
// north, so it waits from the first frame. One real touch tap on the pad's
// right button must now commit the turn and ride, also when the tap starts and
// ends between two frames (input.js latches it for one frame).
//
// Pinned pose (2026-11-01, #130): the seeded iPhone spawn moved to a straight
// cycle path along the Amstel (Amsteldijk), so "waiting from the first frame"
// no longer held. The side-pick test now rides into a pinned T-junction,
// Eerste Leliedwarsstraat meeting Bloemgracht (no straight on, on both
// engines), with route questions off: an open question holds the bike
// (_quizFreezesRide) and a teleport beside a new street asks one.

type View = { x: number; y: number; speed: number; waiting: boolean; queued: number; parked: boolean; mode: string; pad: string };
const view = (page: Page) => page.evaluate((): View => {
  const g = (window as any).canalRecallGame;
  const v = g.player.streetFollowView;
  return { x: g.player.x, y: g.player.y, speed: g.player.speed, waiting: !!v?.awaitingChoice, queued: v?.queuedTurn ?? 0, parked: !!v?.parked, mode: g.player.controlMode, pad: g.input.padMode };
});

/** The centre of a street-pad button, in client px, for a real touch. */
const padButton = (page: Page, button: 'left' | 'right' | 'back') => page.evaluate((name) => {
  const g = (window as any).canalRecallGame;
  const rect = (window as any).CanalRecallUi.streetPadRects(g.input.dpad)[name];
  const canvas = document.getElementById('gameCanvas')!.getBoundingClientRect();
  const w = (window as any).CANVAS_W ?? canvas.width, h = (window as any).CANVAS_H ?? canvas.height;
  return { x: canvas.left + (rect.x + rect.width / 2) * canvas.width / w, y: canvas.top + (rect.y + rect.height / 2) * canvas.height / h };
}, button);

/** A touch that starts and ends in one task: shorter than a frame. */
const quickTap = (page: Page, at: { x: number; y: number }) => page.touchscreen.tap(at.x, at.y);

async function spawn(page: Page): Promise<View> {
  test.skip(test.info().project.name !== 'iphone', 'the touch pad is the iPhone profile');
  // BUNDLES_DIR=<dir>: serve *.bundle.js from a local build (a lane's source change before the integrator rebuilds).
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  const start = await view(page);
  expect(start.mode, 'street following on the phone').toBe('street');
  expect(start.pad, 'the street-follow pad').toBe('street');
  return start;
}

test('iPhone: one tap of a turn button at the seeded spawn sets the rider off', async ({ page }) => {
  test.setTimeout(150_000);
  const start = await spawn(page);
  await quickTap(page, await padButton(page, 'right'));
  await expect.poll(async () => { const v = await view(page); return Math.hypot(v.x - start.x, v.y - start.y); }, { timeout: 5000, message: 'the rider moves after a single tap' }).toBeGreaterThan(30);
  const after = await view(page);
  expect(after.waiting, 'no longer waiting for a side').toBe(false);
  expect(after.parked).toBe(false);
});

/** Teleport onto `street`, about 40 px before its end at `into`, heading at it; route questions off. */
const pinBefore = (page: Page, street: string, into: string) => page.evaluate(([a, b]) => {
  const g = (window as any).canalRecallGame, segs = g.track.segments as Array<{ name?: string; points: Array<{ x: number; y: number }> }>;
  const dSeg = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) => {
    const dx = r.x - q.x, dy = r.y - q.y, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / l));
    return Math.hypot(q.x + dx * t - p.x, q.y + dy * t - p.y);
  };
  let best: { d: number; p: { x: number; y: number }; prev: { x: number; y: number } } | null = null;
  for (const s of segs.filter(s => s.name === a)) for (const end of [0, s.points.length - 1]) {
    const p = s.points[end], prev = s.points[end === 0 ? 1 : end - 1];
    for (const t of segs.filter(s => s.name === b)) for (let i = 1; i < t.points.length; i++) { const d = dSeg(p, t.points[i - 1], t.points[i]); if (!best || d < best.d) best = { d, p, prev }; }
  }
  if (!best || best.d > 3) return null;
  const { p, prev } = best, k = Math.min(0.6, 40 / Math.hypot(p.x - prev.x, p.y - prev.y));
  g.maxAsksPerMinute = 0; g.quizPromptName = '';
  Object.assign(g.player, { x: p.x + (prev.x - p.x) * k, y: p.y + (prev.y - p.y) * k, angle: Math.atan2(p.y - prev.y, p.x - prev.x), speed: 0, vx: 0, vy: 0, _streetState: null, _streetCommand: null, _headingTarget: null });
  return { x: g.player.x, y: g.player.y, gap: best.d };
}, [street, into]);

test('iPhone: waiting for a side, a single tap commits the turn (a hold is not needed)', async ({ page }) => {
  test.setTimeout(150_000);
  await spawn(page);
  // Pin on a settled ride: openRoute enters racing while the intro overview still runs, and a pose set then can
  // be carried past the T (1 run in 3 before this wait).
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.camera.introOverview), { timeout: 60_000, message: 'the intro overview ends' }).toBe(0);
  const pin = await pinBefore(page, 'Eerste Leliedwarsstraat', 'Bloemgracht');
  expect(pin, 'Eerste Leliedwarsstraat meets Bloemgracht in the street extract').not.toBeNull();
  await page.waitForTimeout(500);
  // Set off with the up arrow, held for longer than a frame (a press shorter than a frame is never seen by
  // streetFollow, which reads input.isDown): the rider follows the street to the T and waits for a side.
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await view(page)).waiting, { timeout: 6000, message: 'the rider waits for a side at the T' }).toBe(true);
  await expect.poll(async () => Math.abs((await view(page)).speed), { timeout: 4000, message: 'and comes to a stop there' }).toBeLessThan(1);
  const stopped = await view(page);
  await page.waitForTimeout(800);
  const waiting = await view(page);
  expect(waiting.waiting, 'still waiting for a side').toBe(true);
  expect(Math.hypot(waiting.x - stopped.x, waiting.y - stopped.y), 'standing at the T').toBeLessThan(2);
  expect(Math.abs(waiting.speed)).toBeLessThan(1);
  await quickTap(page, await padButton(page, 'right'));
  await expect.poll(async () => { const v = await view(page); return Math.hypot(v.x - waiting.x, v.y - waiting.y); }, { timeout: 5000, message: 'the rider moves after a single tap' }).toBeGreaterThan(30);
  const after = await view(page);
  expect(after.waiting).toBe(false);
  expect(after.queued, 'the tap was spent on the turn, not left queued').toBe(0);
});
