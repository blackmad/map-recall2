import { test, expect } from '@playwright/test';

// #109 (Sentry CANAL-RECALL-7 / -J / -N): a Firefox Android GPU process died behind the opaque guest briefing while
// the shared three.js frame drew 46 k tree triangles and warmed up ~21 ground programs nobody could see. While an
// opaque card covers the whole map (measured from the layout, rendererShared/mapCover.ts) the frame draws nothing;
// it draws again once the map shows, beside the card or after Start. Touch devices by default; a desktop keeps
// drawing behind the card (its one-call warm-up would move into Start), so the layout test forces `?coverPause=1`.

const frameState = () => {
  const f = (window as any).canalRecallGame?.vectorMap?._sharedFrame;
  return { paused: !!f?.coverPaused, frames: f?.stats?.main?.frames ?? 0, programs: f?.renderer?.info?.programs?.length ?? 0, skipped: f?.coverSkipped ?? 0 };
};

test('the shared frame pauses behind the briefing, draws when the map shows beside the card, and after Start', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/canal-drive/?coverPause=1');
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._sharedFrame?.renderer && (window as any).canalRecallGame?.routePois?.length, null, { timeout: 90_000 });
  await page.waitForTimeout(2000);
  const briefing = await page.evaluate(frameState);
  expect(briefing.paused, 'the briefing covers the map on this layout').toBe(true);
  expect(briefing.frames, 'no main pass drew behind the card').toBe(0);
  expect(briefing.skipped).toBeGreaterThan(0);

  // A layout that shows the map beside the card must keep drawing: the desktop rail alone (no photo vista), or a
  // narrowed phone sheet.
  await page.evaluate(() => {
    const vista = document.querySelector<HTMLElement>('#route-setup .enamel-setup-vista');
    if (vista && vista.getBoundingClientRect().width > 0) vista.style.display = 'none';
    else document.querySelector<HTMLElement>('#route-setup .enamel-setup-rail')!.style.width = '60%';
  });
  await expect.poll(() => page.evaluate(frameState), { timeout: 5_000 }).toMatchObject({ paused: false });
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.triggerRepaint());
  await expect.poll(async () => (await page.evaluate(frameState)).frames, { timeout: 10_000 }).toBeGreaterThan(0);
  // Back to the full cover: paused again within the re-check interval.
  await page.evaluate(() => {
    const vista = document.querySelector<HTMLElement>('#route-setup .enamel-setup-vista');
    if (vista) vista.style.display = '';
    document.querySelector<HTMLElement>('#route-setup .enamel-setup-rail')!.style.width = '';
    (window as any).canalRecallGame.vectorMap.map.triggerRepaint();
  });
  await expect.poll(() => page.evaluate(frameState), { timeout: 5_000 }).toMatchObject({ paused: true });

  // Start: the card goes, the frame resumes in the same task, and the ride draws.
  const resumed = await page.evaluate(() => new Promise<{ pausedAfterSubmit: boolean }>(resolve => {
    document.querySelector<HTMLFormElement>('#route-card')!.requestSubmit();
    // The overlay closes the card in a later render; resolve once it has.
    const poll = () => { const f = (window as any).canalRecallGame.vectorMap._sharedFrame; if (!f.coverPaused) resolve({ pausedAfterSubmit: false }); else setTimeout(poll, 20); };
    setTimeout(poll, 0);
    setTimeout(() => resolve({ pausedAfterSubmit: true }), 10_000);
  }));
  expect(resumed.pausedAfterSubmit, 'the frame resumes after Start').toBe(false);
  const atStart = await page.evaluate(frameState);
  await expect.poll(async () => (await page.evaluate(frameState)).frames - atStart.frames, { timeout: 20_000 }).toBeGreaterThan(30);
  await page.waitForFunction(() => Boolean((window as any).canalRecallGame?.player?.x), null, { timeout: 90_000 });
  expect((await page.evaluate(frameState)).paused).toBe(false);
});

test('by default a desktop draws behind the briefing as before, and a touch device pauses', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._sharedFrame?.renderer && (window as any).canalRecallGame?.routePois?.length, null, { timeout: 90_000 });
  await page.waitForTimeout(2000);
  const s = await page.evaluate(frameState);
  if (info.project.name === 'iphone') expect(s).toMatchObject({ paused: true, frames: 0 });
  else { expect(s.paused).toBe(false); expect(s.skipped).toBe(0); expect(s.frames).toBeGreaterThan(0); }
});
