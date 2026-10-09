import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Pop-in check for the start flight: the landing neighbourhood (buildings,
// landmarks, trees) must already be drawn on the first frame after landing.
// Opt-in: PERF_INTRO=1 PW_PORT=4402 npx playwright test intro-landing
// Screenshots: artifacts/intro-flat/landing-<project>-{overview,first,settled}.png
test.skip(!process.env.PERF_INTRO, 'set PERF_INTRO=1');

test('first frame after the start flight lands', async ({ page }, info) => {
  test.setTimeout(240_000);
  const cdp = await page.context().newCDPSession(page);
  if (info.project.name === 'iphone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  const dir = 'artifacts/intro-flat';
  mkdirSync(dir, { recursive: true });
  const tag = process.env.SHOT_TAG ? `-${process.env.SHOT_TAG}` : '';
  await page.waitForFunction(() => !!(window as any).canalRecallGame._intro, null, { timeout: 120_000, polling: 'raf' });
  await page.screenshot({ path: `${dir}/landing-${info.project.name}${tag}-overview.png` });
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 120_000, polling: 'raf' });
  await page.screenshot({ path: `${dir}/landing-${info.project.name}${tag}-first.png` });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/landing-${info.project.name}${tag}-settled.png` });
});
