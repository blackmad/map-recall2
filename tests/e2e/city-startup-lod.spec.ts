import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

test('mobile city shells remain until detailed buildings install', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && /shader|WebGLProgram/.test(msg.text())) errors.push(msg.text()); });
  await openRoute(page, { viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => {
    const t = (window as any).canalRecallGame.vectorMap._threeBuildings;
    return t && [...t.chunks.keys()].some((k: any) => k.startsWith('near:')) && [...t.chunks.keys()].some((k: any) => k.startsWith('coarse:'));
  }), { timeout: 90_000 }).toBe(true);
  const status = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings;
    let checked = 0;
    for (const [key, chunk] of t.chunks) {
      if (!key.startsWith('coarse:') || !chunk.mesh) continue;
      const hidden = chunk.mesh.geometry.getAttribute('hidden');
      for (const [id, range] of chunk.ranges) if (t.installedDetailIds.has(id)) {
        if (hidden.getX(range.start) !== 1) throw new Error('Detailed building still draws its coarse shell');
        checked++;
      }
    }
    return { checked, detailZoom: t.detailZoom, pixelRatio: vm.map.getPixelRatio(), touch: matchMedia('(pointer: coarse)').matches, stats: t.stats() };
  });
  expect(status.checked).toBeGreaterThan(0);
  if (status.touch) {
    expect(status.detailZoom).toBe(17);
    expect(status.pixelRatio).toBeLessThanOrEqual(1.5);
    expect(status.stats.textureMB).toBeLessThanOrEqual(22);
  }
  await page.screenshot({ path: testInfo.outputPath('city-lod.png') });
  console.log('city LOD:', JSON.stringify(status));
  expect(errors).toEqual([]);
});
