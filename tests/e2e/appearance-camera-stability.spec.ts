import { expect, test } from '@playwright/test';
declare const GameState: { RACING: number };

test('camera updates preserve resident trees, windows, roofs and water', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/canal-drive/');
  // The study is no longer a visible route choice (2026-09-28); select the
  // pattern through the hidden form control the harness reads.
  await page.locator('#route-pattern').evaluate((select: HTMLSelectElement) => {
    select.value = 'study';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === GameState.RACING, {}, { timeout: 90_000 });
  await page.waitForFunction(() => {
    const v = (window as any).canalRecallGame?.vectorMap;
    return v && [v._studyRoofAreas, v._studyFacadeAreas, v._studyTreeAreas, v._studyPublicRealmAreas].every(g => g?.some((l: any) => l.ready));
  }, {}, { timeout: 90_000 });
  const result = await page.evaluate(async () => {
    const v = (window as any).canalRecallGame.vectorMap, m = v.map;
    // Exercise the same repeated jumpTo/moveend sequence as the live sync loop,
    // at a fixed district camera so every detail class is in its visible range.
    v.sync = () => {};
    const camera = { center: [4.871752, 52.372835], zoom: 19.55, pitch: 55, bearing: -18 };
    m.jumpTo(camera);
    await v.whenAppearanceRenderReady(60_000);
    const layers = [v._studyRoofAreas, v._studyFacadeAreas, v._studyTreeAreas, v._studyPublicRealmAreas].map(g => g.find((l: any) => l.enabled)).filter(l => l?.debugRenderable);
    const before = layers.map(l => ({ resident: l.debugResident, paints: l.debugPaints, resources: new Map(l.resources) }));
    let lost = 0, replaced = 0;
    for (let frame = 0; frame < 90; frame++) {
      // A small back-and-forth pan, followed by stationary updates, must not
      // clear a tile that is still in view or redownload it every frame.
      m.jumpTo({ ...camera, center: [camera.center[0] + (frame % 2 ? 0.000002 : 0), camera.center[1]] });
      for (let i = 0; i < layers.length; i++) {
        if (!layers[i].debugResident) lost++;
        for (const [key, resource] of before[i].resources) if (layers[i].resources.get(key) !== resource) replaced++;
      }
      await new Promise(requestAnimationFrame);
    }
    return { lost, replaced, residents: before.map(b => b.resident), painted: layers.map((l, i) => l.debugPaints > before[i].paints), bytes: v.appearanceRenderStatus().detailBytes };
  });
  expect(result.residents.length).toBeGreaterThanOrEqual(3);
  expect(result.residents.every(count => count > 0)).toBe(true);
  expect(result.lost, 'moving the camera never blanks resident detail').toBe(0);
  expect(result.replaced, 'tiles that stay visible retain their actual geometry').toBe(0);
  expect(result.painted.every(Boolean)).toBe(true);
  expect(result.bytes).toBeLessThanOrEqual(11_000_000);
});
