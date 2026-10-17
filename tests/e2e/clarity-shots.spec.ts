import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute, setHiddenSelect } from './helpers';

// Gameplay clarity review: one screenshot per first-time-player state, on the
// desktop and iPhone projects. Opt-in, because it boots the game several
// times: CLARITY_SHOTS=1 SHOT_TAG=before PW_PORT=4403 npx playwright test clarity-shots
// Output: artifacts/clarity/<tag>/<project>-<state>.png
test.skip(!process.env.CLARITY_SHOTS, 'set CLARITY_SHOTS=1');
test.setTimeout(240_000);

const tag = process.env.SHOT_TAG || 'now';
const dir = `artifacts/clarity/${tag}`;

async function shot(page: Page, project: string, name: string) {
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${project}-${name}.png` });
}

async function bootFirstVisit(page: Page) {
  await page.addInitScript(() => { (window as any).__canalRecallOnboarding = true; });
  await page.route(/3dbag|cesium3dtiles/i, (route) => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
}

test('first visit and start panel', async ({ page }, info) => {
  const p = info.project.name;
  await bootFirstVisit(page);
  await page.waitForTimeout(2500);
  await shot(page, p, '01-first-visit');
  // Any intro/onboarding layer that covers the setup is dismissed for the
  // setup shot; it is reviewed in its own state.
  const skip = page.locator('#onboarding [data-onboarding="skip"]');
  if (await skip.isVisible().catch(() => false)) {
    await shot(page, p, '01b-onboarding-1');
    await page.locator('#onboarding [data-onboarding="next"]').click();
    await shot(page, p, '01c-onboarding-2');
    await page.locator('#onboarding [data-onboarding="next"]').click();
    await shot(page, p, '01d-onboarding-3');
    await page.locator('#onboarding [data-onboarding="next"]').click();
  }
  await shot(page, p, '02-start-panel');
  await page.evaluate(() => {
    const overlay = (window as any).CanalRecallOverlay?.getOverlay?.();
    overlay?.store.setAdvancedOpen(true);
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.advanced-options summary')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await shot(page, p, '03-setup-advanced');
  await page.evaluate(() => {
    const overlay = (window as any).CanalRecallOverlay?.getOverlay?.();
    overlay?.store.setAdvancedOpen(false);
    overlay?.store.patchPrefs({ travelMode: 'car', routePattern: 'home', homeAddress: 'Burgemeester de Vlugtlaan 125-3, Amsterdam' }, overlay.callbacks.zoom);
  });
  await page.waitForTimeout(400);
  await shot(page, p, '04-home-route-setup');
});

for (const mode of ['boat', 'car'] as const) {
  test(`${mode} ride, question, answers, finish`, async ({ page }, info) => {
    const p = info.project.name;
    await page.addInitScript(() => { try { localStorage.setItem('canalRecall.onboarding.v1', 'done'); } catch { /* */ } });
    await openRoute(page, { travelMode: mode, viewMode: 'chase', enterRacing: false });
    await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 120_000 });
    await page.waitForTimeout(2500);
    await shot(page, p, `10-${mode}-riding`);
    // Hold the throttle a moment so the ride is moving.
    if (p === 'desktop') {
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(1800);
      await page.keyboard.up('ArrowUp');
    }
    await shot(page, p, `11-${mode}-moving`);
    const name = mode === 'boat' ? 'Prinsengracht' : 'Raadhuisstraat';
    const choices = mode === 'boat'
      ? ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht']
      : ['Raadhuisstraat', 'Rozengracht', 'Westermarkt', 'Hartenstraat'];
    const ask = () => page.evaluate(({ name, choices, mode }) => {
      const game = (window as any).canalRecallGame;
      game.routeOptions.answerMode = 'multiple';
      game._openQuizPrompt({
        kind: 'route', name, subject: mode === 'boat' ? 'water' : 'street',
        question: mode === 'boat' ? 'Which canal are you on?' : 'Which street are you on?',
        context: 'You made a turn', choices,
      });
    }, { name, choices, mode });
    await ask();
    await page.waitForTimeout(600);
    await shot(page, p, `12-${mode}-question`);
    await page.evaluate((n) => (window as any).canalRecallGame._submitCanalAnswer(n), name);
    await page.waitForTimeout(500);
    await shot(page, p, `13-${mode}-right`);
    await page.waitForTimeout(3500);
    await ask();
    await page.waitForTimeout(400);
    await page.evaluate((n) => (window as any).canalRecallGame._submitCanalAnswer(n), choices[1]);
    await page.waitForTimeout(500);
    await shot(page, p, `14-${mode}-wrong`);
    await page.waitForTimeout(4000);
    await shot(page, p, `15-${mode}-after-answers`);
    if (mode === 'car') {
      // Help and settings panels mid-ride.
      // The corner buttons tuck while riding, so click them programmatically.
      await page.evaluate(() => document.getElementById('open-help')!.click());
      await page.waitForTimeout(400);
      await shot(page, p, '20-help');
      await page.evaluate(() => (document.querySelector('#help-panel .utility-close') as HTMLElement).click());
      await page.evaluate(() => document.getElementById('open-settings')!.click());
      await page.waitForTimeout(400);
      await shot(page, p, '21-settings');
      await page.evaluate(() => (window as any).canalRecallGame._closeUtilityPanels());
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      game.state = 5;
      game._render();
    });
    await page.waitForTimeout(600);
    await shot(page, p, `16-${mode}-finish`);
  });
}

test('stacked notices and long names', async ({ page }, info) => {
  const p = info.project.name;
  await page.addInitScript(() => { try { localStorage.setItem('canalRecall.onboarding.v1', 'done'); } catch { /* */ } });
  await page.route(/3dbag|cesium3dtiles/i, (route) => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await setHiddenSelect(page, 'travel-mode', 'car');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90_000 }).toBe(true);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 120_000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.currentNeighborhood = 'Van Lennepbuurt en Kinkerbuurt-Noord';
    game.routeTo = { ...(game.routeTo || {}), name: 'Rijksmuseum en Museumplein (hoofdingang)' };
    game._landmarkNotice = {
      id: 'westerkerk', name: 'Westerkerk', type: 'church', extractLang: 'en',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Westerkerk',
      longDetail: 'The Westerkerk is a Reformed church in central Amsterdam, built between 1620 and 1631 after a design by Hendrick de Keyser.',
    };
    game._landmarkNoticeAlpha = 1;
    game._neighborhoodNotice = { name: 'Van Lennepbuurt en Kinkerbuurt-Noord', kind: 'neighborhood' };
    game._neighborhoodNoticeTimer = 6;
    game._syncHudLayout?.();
    game._renderLandmarkNotice?.();
    game._renderNeighborhoodNotice?.();
  });
  await page.waitForTimeout(800);
  await shot(page, p, '30-stacked-long');
});
