import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// A WebGL context loss after a ride under ?engine=own (#129, facades package): every CPU copy a layer frees after
// upload must be rebuilt (or kept) for the new context. A geometry still in the scene after the restore whose attribute
// was drawn before the loss and has no CPU array any more cannot be uploaded again: it draws nothing, or three throws.
// Also the compileAsync poll that read `currentProgram.isReady` of a reset program (sharedFrame.ts).
//
//   PW_PORT=4545 [BUNDLES_DIR=dir] npx playwright test facade-context-loss --project=desktop
//   RIDE_S=60 (default) seconds of autopiloted ride before the loss.

const RIDE_S = Number(process.env.RIDE_S ?? 60);
const QUERY = '?engine=own&world=v1&roads=bin';

const settled = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 120_000, intervals: [500] }).toBe(0);

/** The driving harness's lookahead steer along the planned route (scripts/motion-stutter.mjs). */
const autopilot = (page: Page) => page.evaluate(() => {
  const g = (window as any).canalRecallGame, p = g.player;
  let route: { x: number; y: number }[] | null = null, index = 1;
  p.handleInput = () => {
    if (!route || route.length < 2) { try { route = g.track.findRoute({ x: p.x, y: p.y }, g.track.finishPoint); } catch { route = null; } index = 1; if (!route || route.length < 2) { p.throttle = 1; return; } }
    let best = Infinity;
    for (let i = Math.max(0, index - 4); i < Math.min(route.length, index + 24); i++) { const d = Math.hypot(route[i].x - p.x, route[i].y - p.y); if (d < best) { best = d; index = i; } }
    let look = 0, ti = index;
    while (ti < route.length - 1 && look < 120) { look += Math.hypot(route[ti + 1].x - route[ti].x, route[ti + 1].y - route[ti].y); ti++; }
    const tg = route[ti]; let err = Math.atan2(tg.y - p.y, tg.x - p.x) - p.angle; err = Math.atan2(Math.sin(err), Math.cos(err));
    const cruise = Math.abs(err) > 0.5 ? 60 : 170;
    p.steerInput = Math.max(-1, Math.min(1, err * 2.5)); p.throttle = p.speed < cruise ? 1 : 0; p.brake = p.speed > cruise * 1.6 ? 1 : 0; p.handbrake = false;
  };
});

/** Every attribute and index of every geometry in the shared frame's scene, by top-level child. */
const sceneAttributes = `(() => {
  const root = window.canalRecallGame.vectorMap._sharedFrame.scene, out = [];
  root.children.forEach((top, i) => top.traverse(o => {
    const g = o.geometry; if (!g) return;
    for (const [name, a] of [...Object.entries(g.attributes || {}), ['index', g.index]]) if (a) out.push({ owner: (top.name || top.type) + ':' + i, name, a: a.isInterleavedBufferAttribute ? a.data : a, mesh: o });
  }));
  return out;
})()`;

test('a context loss after a ride: no stale attribute, no error, the city draws again', async ({ page }) => {
  test.setTimeout(RIDE_S * 1000 + 300_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, { query: QUERY, viewMode: 'chase' });
  await settled(page);
  await autopilot(page);
  await page.waitForTimeout(RIDE_S * 1000);
  const before = await page.evaluate(`(() => {
    const list = ${sceneAttributes};
    window.__preLoss = new WeakSet(list.map(r => r.a));
    const p = window.canalRecallGame.player;
    return { attributes: list.length, facades: window.canalRecallGame.vectorMap._threeBuildings.chunks.size, at: [Math.round(p.x), Math.round(p.y)] };
  })()`) as { attributes: number; facades: number };
  expect(before.facades, 'facades resident after the ride').toBeGreaterThan(0);
  const errorsBeforeLoss = errors.length;
  // Hold still for the loss and restore, so the comparison is of one place.
  await page.evaluate(() => { const p = (window as any).canalRecallGame.player; p.handleInput = () => { p.throttle = 0; p.brake = 1; p.steerInput = 0; }; });
  await page.evaluate(() => { const w = window as any; w.__lose = w.canalRecallGame.vectorMap._sharedFrame.renderer.getContext().getExtension('WEBGL_lose_context'); w.__lose.loseContext(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as any).__lose.restoreContext());
  await page.waitForTimeout(2000);
  await settled(page);
  await page.waitForTimeout(3000);
  const after = await page.evaluate(`(() => {
    const list = ${sceneAttributes}, stale = {};
    let visibleMeshes = 0;
    for (const r of list) {
      if (r.mesh.visible) visibleMeshes++;
      if (window.__preLoss.has(r.a) && !r.a.array) (stale[r.owner + ' ' + r.name] = (stale[r.owner + ' ' + r.name] || 0) + 1);
    }
    const vm = window.canalRecallGame.vectorMap;
    return { attributes: list.length, stale, facades: [...vm._threeBuildings.chunks.values()].filter(c => c.mesh).length, lost: vm._sharedFrame.renderer.getContext().isContextLost() };
  })()`) as { attributes: number; stale: Record<string, number>; facades: number; lost: boolean };
  console.log(JSON.stringify({ rideS: RIDE_S, before, after, errorsBeforeLoss, errors: errors.slice(0, 20) }));
  expect(after.lost).toBe(false);
  expect(after.stale, 'attributes drawn before the loss with no CPU copy to upload again').toEqual({});
  expect(after.facades, 'facade chunks drawn again').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
