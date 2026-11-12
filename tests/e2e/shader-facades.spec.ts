import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute, settleWorld } from './helpers';

// F1 (#380, docs/plans/facade-f1-design-20261112.md §6): the record path renders. At the Dam, aerial (the baked tier)
// and chase, with `?shaderFacades=0|1`: the record cells are drawn, every program links, no GL error is logged.
// Needs a world compiled with `--facade-records` served as world-v1 (the published world has no records: the spec then
// reports `no-records` and skips).
//   PW_PORT=4460 /tmp/canal-pw.sh npx playwright test shader-facades --project=desktop --workers=1
const OUT = 'artifacts/shader-facades';
const POSES = [
  { name: 'dam-aerial', center: [4.8926, 52.3731] as [number, number], zoom: 16.2, bearing: 250, pitch: 60 },
  { name: 'dam-chase', center: [4.8926, 52.3731] as [number, number], zoom: 17.8, bearing: 250, pitch: 72 },
];
test.use({ viewport: { width: 1280, height: 800 } });

async function frames(page: Page, on: boolean) {
  const glErrors: string[] = [];
  page.on('console', m => { const t = m.text(); if (/GL_INVALID|GL ERROR|WebGLProgram|Shader Error|ERROR: 0:|INVALID_OPERATION/i.test(t)) glErrors.push(t.slice(0, 400)); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?engine=own&tier=high&governor=0&bakedCoarse=1&shaderFacades=${on ? 1 : 0}` });
  const out: Record<string, unknown> = {};
  for (const pose of POSES) {
    const jump = () => page.evaluate((p) => {
      const vm = (window as any).canalRecallGame.vectorMap;
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      const g = vm._ownGround;
      vm.jumpToLngLat({ ...p, elevation: g?.ready ? g.heightAt(p.center) : 0 });
    }, pose);
    await jump(); await settleWorld(page, `${pose.name} first`); await jump(); await settleWorld(page, `${pose.name} second`);
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap;
      const r = vm.renderer ?? vm._renderer ?? null;
      return { baked: vm._bakedCoarse?.stats?.() ?? null, shaderFacades: vm.shaderFacades ?? null, bakedOff: vm.bakedCoarseOff ?? null, programs: r?.info?.programs?.length ?? null };
    });
    const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
    writeFileSync(`${OUT}/${pose.name}-${on ? 'on' : 'off'}.png`, Buffer.from(url.split(',')[1], 'base64'));
    out[pose.name] = state;
  }
  return { out, glErrors };
}

test('shader facades: the record cells draw at the Dam with no GL error', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop path');
  test.skip(!!process.env.CI, 'needs a real GPU (the baked tier)');
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const on = await frames(page, true);
  writeFileSync(`${OUT}/result-on.json`, JSON.stringify(on, null, 1));
  const first = Object.values(on.out)[0] as { shaderFacades: string };
  test.skip(first.shaderFacades === 'no-records', 'the served world-v1 has no record shells');
  const off = await frames(page, false);
  writeFileSync(`${OUT}/result-off.json`, JSON.stringify(off, null, 1));
  console.log('shader-facades', JSON.stringify({ on, off }));
  expect(on.glErrors, 'no GL error with the flag on').toEqual([]);
  for (const s of Object.values(on.out) as { baked: { records: number; cells: number; drawn: number } }[]) {
    expect(s.baked.records, 'record cells resident').toBeGreaterThan(0);
    expect(s.baked.drawn, 'every resident cell drawn').toBe(s.baked.cells);
  }
  for (const s of Object.values(off.out) as { baked: { records: number } }[]) expect(s.baked.records, 'flag off draws no record cell').toBe(0);
});
