import { expect, test } from '@playwright/test';
declare const GameState: { RACING: number };

test('Da Costakade 13 uses reviewed brick through the ground floor', async ({ page }) => {
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
  const pand = 'NL.IMBAG.Pand.0363100012166570';
  await expect.poll(() => page.evaluate(id => {
    const stream = (window as any).canalRecallGame?.vectorMap?._completeCity;
    const feature = stream?.sampleFeatures(10000).find((f: any) => f.properties.id === id);
    return feature?.properties.sideColourSource;
  }, pand), { timeout: 90_000 }).toBe('measured-accepted');
  const colour = await page.evaluate(id => {
    const f = (window as any).canalRecallGame.vectorMap._completeCity.sampleFeatures(10000).find((f: any) => f.properties.id === id);
    return { wall:f.properties.sideColour, ground:f.properties.groundColour, origin:f.properties.sideColourReviewOrigin, observation:f.properties.sideColourObservationId };
  }, pand);
  const filter = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getFilter('osm-colored-building-ground-floors'));
  expect(JSON.stringify(filter)).toContain('wall-inherited-not-independently-measured');
  expect(colour).toEqual({ wall:'#6d5e55', ground:'#6d5e55', origin:'model-visual-review', observation:'0363100012166570_e_0wwk20u' });
});
