import { test, expect } from '@playwright/test';

test('recipe edits retain the last good mesh and exports preserve evidence and IDs', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/canal-drive/facade-recipe-lab.html');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallRecipeLab?.status().ready)).toBe(true);
  const originalHash = await page.evaluate(() => (window as any).canalRecallRecipeLab.status().assetHash);
  await page.locator('#left').fill('999'); await page.locator('#apply-opening').click();
  await expect(page.locator('#error')).toContainText('escapes');
  expect(await page.evaluate(() => (window as any).canalRecallRecipeLab.status().assetHash)).toBe(originalHash);
  await page.locator('#left').fill('0.9'); await page.locator('#apply-opening').click();
  await expect(page.locator('#error')).toBeEmpty();
  expect(await page.evaluate(() => (window as any).canalRecallRecipeLab.status().assetHash)).not.toBe(originalHash);
  await page.getByText('Recipe JSON · import / export', {exact:true}).click();
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.asset.disposition).toBe('diagnostic-only');
  expect(exported.recipe.elevations[0].openings.basis).toBe('authored');
  expect(exported.asset.meshes.every((m: any) => m.buildingId === exported.recipe.buildingId)).toBe(true);
  await page.locator('#reset').click();
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallRecipeLab.status().assetHash)).toBe(originalHash);
  await page.locator('#fixture').selectOption('2');
  await expect(page.locator('#synthetic-note')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallRecipeLab.status().buildingId)).toBe('fixture:courtyard');
  const collision = await page.evaluate(() => {
    const w = window as any, polygons = w.canalRecallRecipeLab.asset().collision;
    return [w.CanalRecallRecipe.recipeContainsPoint(polygons, {x:9,y:12}), w.CanalRecallRecipe.recipeContainsPoint(polygons, {x:20,y:5})];
  });
  expect(collision).toEqual([false, false]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('map preview restores its exact fallback on eviction, failure and context loss', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/canal-drive/facade-recipe-lab.html');
  const shown = () => page.evaluate(() => (window as any).canalRecallRecipeLab?.status().map?.shown);
  await expect.poll(shown, { timeout: 60000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallRecipeLab.status().streaming?.tiles ?? 0), { timeout: 60000 }).toBeGreaterThan(0);
  const aliases = () => page.evaluate(() => (window as any).canalRecallRecipeLab.status().replacementAliases);
  expect(await aliases()).toEqual(['NL.IMBAG.Pand.0363100012164989']);
  for (const action of ['evict', 'fail', 'preview']) {
    await page.locator(`#${action}`).click();
    await expect.poll(shown).toBe(false); expect(await aliases()).toEqual([]);
    expect(await page.evaluate(() => (window as any).canalRecallRecipeLab.map.getFilter('recipe-city-walls') ?? null)).toBeNull();
    await page.locator(action === 'preview' ? '#preview' : '#reload').click();
    await expect.poll(shown).toBe(true);
  }
  const supported = await page.evaluate(() => {
    const w = window as any;
    w.recipeContextTest = w.canalRecallRecipeLab.map.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context');
    w.recipeContextTest?.loseContext(); return !!w.recipeContextTest;
  });
  if (supported) {
    await expect.poll(shown).toBe(false); expect(await aliases()).toEqual([]);
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).recipeContextTest.restoreContext());
    await expect.poll(shown, { timeout: 20000 }).toBe(true);
  }
});
