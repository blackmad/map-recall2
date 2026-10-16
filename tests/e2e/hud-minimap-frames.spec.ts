import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Review frames for the 2026-10-16 HUD reports (destination pill, re-center
// under a map label, utilities over the overview flight, the minimap).
// Opt-in: HUD_FRAMES=<dir> [FRAME_TAG=before] PW_PORT=4564 npx playwright test hud-minimap-frames
test.skip(!process.env.HUD_FRAMES, 'set HUD_FRAMES=<dir> to write review frames');

const shot = async (page: Page, name: string, project: string) => {
  const dir = process.env.HUD_FRAMES!;
  mkdirSync(dir, { recursive: true });
  const tag = process.env.FRAME_TAG ? `-${process.env.FRAME_TAG}` : '';
  await page.screenshot({ path: `${dir}/${project}-${name}${tag}.png` });
};

test('frames: overview flight, ride, destination pill, re-center over a label', async ({ page }, info) => {
  test.setTimeout(300_000);
  const project = info.project.name;
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._intro, null, { timeout: 120_000, polling: 'raf' });
  await page.waitForTimeout(1200);
  await shot(page, 'intro', project);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 120_000, polling: 'raf' });
  await page.waitForTimeout(4500);
  await shot(page, 'ride', project);

  // Riding a little so the radar has a heading.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(800);
  await shot(page, 'ride-moving', project);

  // Destination pill: put the vehicle a few metres short of the finish.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const f = g.track.finishPoint;
    g.player.x = f.x - 60; g.player.y = f.y + 60; g.player.speed = 0;
    g.camera.resetForRide(g.player);
  });
  await page.waitForTimeout(2500);
  await shot(page, 'destination', project);

  // Re-center over a label: pan so a drawn map label lands under the button.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g.camera.pan(0, -140);
  });
  await page.waitForTimeout(1500);
  const moved = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const root = document.querySelector('.cr-map-labels');
    const labels = [...(root?.querySelectorAll('.l') ?? [])].filter(el => Number((el as HTMLElement).style.opacity || 0) > 0.5) as HTMLElement[];
    const b = g._recenterBtnBounds;
    if (!labels.length || !b) return { labels: labels.length, button: !!b };
    const canvas = g.canvas.getBoundingClientRect();
    const sx = canvas.width / (window as any).eval('CANVAS_W');
    const bx = canvas.left + (b.x + b.w / 2) * sx, by = canvas.top + (b.y + b.h / 2) * sx;
    // Nearest label to the button.
    let best = labels[0], bestD = Infinity;
    for (const el of labels) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - bx, r.top + r.height / 2 - by);
      if (d < bestD) { bestD = d; best = el; }
    }
    const r = best.getBoundingClientRect();
    g.camera.pan((r.left + r.width / 2 - bx) / sx, (r.top + r.height * 0.3 - by) / sx);
    return { labels: labels.length, name: best.dataset.mapLabel };
  });
  console.log('recenter probe', JSON.stringify(moved));
  await page.waitForTimeout(300);
  await shot(page, 'recenter', project);
  await page.waitForTimeout(1500);
  await shot(page, 'recenter-settled', project);
});

test('frames: phone utilities tucked over a quiz, back on a map tap', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'phone rule');
  test.setTimeout(180_000);
  const project = info.project.name;
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._openQuizPrompt({
      kind: 'route', name: 'Prinsengracht', subject: 'water',
      question: 'Which canal are you on?', context: 'Crossing a bridge',
      choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Plantage Kerklaan'],
    });
  });
  await page.waitForTimeout(800);
  const tucked = await page.evaluate(() => document.getElementById('utility-buttons')!.classList.contains('tucked'));
  console.log('phone quiz tucked', tucked);
  await shot(page, 'quiz-tucked', project);
  // A tap on the map (above the quiz card, clear of the stick) brings the cluster back.
  const size = page.viewportSize()!;
  await page.touchscreen.tap(size.width / 2, size.height * 0.33);
  await page.waitForTimeout(400);
  const shown = await page.evaluate(() => !document.getElementById('utility-buttons')!.classList.contains('tucked'));
  console.log('phone tap revealed', shown);
  await shot(page, 'quiz-tap', project);
});
