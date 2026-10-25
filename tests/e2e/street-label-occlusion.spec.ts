import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// User 2026-10-25, chase view on the Oudezijds Voorburgwal at the Oude Doelenstraat:
// "need to hide road labels behind buildings". The alleys behind the canal row
// (Stoofsteeg, Barndesteeg, Koestraat…) were named across its roofs. Street names
// a resident building hides are skipped (src/canalRecall/labels/streetLabelOcclusion.ts);
// the open street ahead stays named.
//   LABEL_OCC_OUT=<dir> PW_PORT=4355 npx playwright test street-label-occlusion --project=desktop
const OUT = process.env.LABEL_OCC_OUT || 'artifacts/labels-occlusion';
const AT = [4.89612, 52.37085], FACE = [4.89700, 52.37250];

async function parkAndLearn(page: Page) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.quizPromptName = ''; g.quizCandidateName = '';
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
    // A player who has learned every street around here: all of them may be named.
    for (const l of g.track.labels) if (Math.hypot(l.x - a.x, l.y - a.y) < 1500) g._mapLabelNames.add(l.text);
  }, { at: AT, face: FACE });
}

/** Per-frame occlusion cost and the drawn/hidden names over `frames` frames. */
async function sample(page: Page, frames = 90) {
  return page.evaluate((frames) => new Promise<any>(resolve => {
    const g = (window as any).canalRecallGame, ms: number[] = [], hidden = new Set<string>(), drawn = new Set<string>();
    let n = 0;
    const tick = () => {
      const o = g._streetLabelOcclusion;
      if (o) { ms.push(o.stats.ms); o.lastHidden.forEach((t: string) => hidden.add(t)); }
      (g.track.lastDrawnLabels || []).forEach((r: any) => drawn.add(r.text));
      if (++n < frames) requestAnimationFrame(tick);
      else {
        ms.sort((a, b) => a - b);
        resolve({ meanMs: ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length), p95Ms: ms[Math.floor(ms.length * 0.95)] ?? 0,
          maxMs: ms[ms.length - 1] ?? 0, stats: o_stats(g), hidden: [...hidden], drawn: [...drawn] });
      }
    };
    const o_stats = (g: any) => g._streetLabelOcclusion?.stats;
    requestAnimationFrame(tick);
  }), frames);
}

test('street labels: names behind the canal row are hidden, the open street stays named', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop frame');
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  await parkAndLearn(page);
  await page.waitForFunction(() => ((window as any).canalRecallGame._streetLabelOcclusion?.stats.features ?? 0) > 500, null, { timeout: 90_000, polling: 500 });
  await page.waitForTimeout(6000);
  const after = await sample(page);
  await page.screenshot({ path: `${OUT}/oude-doelenstraat-after.png` });
  // Before: the same frame with the occlusion test switched off.
  await page.evaluate(() => { const o = (window as any).canalRecallGame._streetLabelOcclusion; o._frame = o.frame; o.frame = () => null; });
  await page.waitForTimeout(1500);
  const before = await sample(page, 30);
  await page.screenshot({ path: `${OUT}/oude-doelenstraat-before.png` });
  await page.evaluate(() => { const o = (window as any).canalRecallGame._streetLabelOcclusion; o.frame = o._frame; });
  writeFileSync(`${OUT}/oude-doelenstraat.json`, JSON.stringify({ after, before }, null, 1));
  console.log(JSON.stringify({ after: { ...after, drawn: after.drawn.length }, beforeDrawn: before.drawn }, null, 0));
  expect(after.hidden.length, 'some street names behind buildings are hidden').toBeGreaterThan(0);
  expect(after.drawn.length, 'the open street stays named').toBeGreaterThan(0);
  expect(before.drawn.length).toBeGreaterThan(after.drawn.length - 1);
  expect(after.meanMs, 'occlusion cost per frame').toBeLessThan(0.5);
});
