import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// POI labels behind buildings under ?engine=own (#129, user report 2026-10-31): on Eerste Constantijn Huygensstraat
// looking north from the Overtoom crossing (chase view), "Anmol" and "Snackbar Miriam" floated over the roofs of
// the blocks whose far side holds the shop. engine/labelOcclusion.ts hides a POI label whose shopfront faces away
// from the camera or whose sightline a nearer building blocks; the street-frontage shops stay labelled.
//
//   PW_PORT=4523 npx playwright test label-occlusion --project=desktop
//   LABEL_OCCLUSION_OUT=artifacts/label-occlusion also saves the before (occlusion off) and after frames.

const STAND = { lng: 4.87523, lat: 52.36262, bearing: 340 }; // 20 m south of the crossing, facing up the street
const HIDDEN = ['Anmol', 'Snackbar Miriam'];
const FRONTAGE = ['Albert Heijn', 'Kartika'];

async function teleport(page: Page, p: typeof STAND): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

/**
 * Drawn POI labels the rendered city hides: the facades' own pick (prismPick) at the label's pixel hits another
 * building more than 6 m nearer than the spot the label is drawn at (its frontage, or its anchor), on the ground.
 * Independent of engine/labelOcclusion.ts's footprint walk; the user's question, "is it printed across a building?".
 */
const throughBuildings = (page: Page): Promise<string[]> => page.evaluate(() => {
  const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, L = vm._labels, T = vm._sharedFrame.THREE;
  const { width: W, height: H } = vm.host.viewport();
  const chunk = [...tb.chunks.values()].find((c: any) => c.mesh);
  const M = chunk.mesh.matrixWorld, upm = new T.Vector3().setFromMatrixColumn(M, 0).length();
  const inv = tb.camera.projectionMatrix.clone().invert();
  const pois = new Map<string, any>((L.pois ?? []).map((p: any) => [p.id, p]));
  const out: string[] = [];
  for (const l of L.placed) {
    const p = pois.get(l.id);
    if (l.kind !== 'poi' || !p) continue;
    const at = L.drawAt?.get(l.id) ?? (() => { const c = [...L.buckets.values()].flat().find((c: any) => c.id === l.id); return c?.at; })();
    const hit = at && tb.inspectAtScreen(l.x, l.y, W, H);
    if (!hit) continue;
    const host = vm.labelOcclusion.at(p.lngLat);
    if (host && String(host.properties?.id) === String(hit.id)) continue;
    const nx = l.x / W * 2 - 1, ny = 1 - l.y / H * 2, near = new T.Vector3(nx, ny, -1).applyMatrix4(inv);
    const da = new T.Vector3(at[0], at[1], 0).applyMatrix4(M).distanceTo(near) / upm;
    const dh = new T.Vector3(nx, ny, hit.depth).applyMatrix4(inv).distanceTo(near) / upm;
    if (dh < da - 6) out.push(`${l.text} (${Math.round(da - dh)} m)`);
  }
  return out;
});

const placedPois = (page: Page, occlusion: boolean): Promise<string[]> => page.evaluate(async on => {
  const vm = (window as any).canalRecallGame.vectorMap;
  vm.labelOcclusionOn = on;
  await new Promise(r => setTimeout(r, 1200)); // the switch forces a full placement on the next frame
  return vm._labels.placed.filter((l: { kind: string }) => l.kind === 'poi').map((l: { text: string }) => l.text);
}, occlusion);

test('a POI label behind a nearer building is not drawn; the street-frontage labels still are', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1800, height: 1100 });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine)).toBe('own');
  await teleport(page, STAND);
  await page.waitForTimeout(2500);
  await teleport(page, STAND); // the game re-routes after the first jump; pin the spot again
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 120_000, intervals: [500] }).toBe(0);
  await page.waitForTimeout(3000);

  const out = process.env.LABEL_OCCLUSION_OUT;
  const off = await placedPois(page, false);
  if (out) await page.screenshot({ path: `${out}/before-occlusion.png` });
  const on = await placedPois(page, true);
  if (out) await page.screenshot({ path: `${out}/after-occlusion.png` });
  console.log(JSON.stringify({ off, on }));

  // Every drawn POI the city hides, counted at the same pose (lane materials 2026-10-31): with the test off most of
  // the street's POIs are printed across a nearer block; with it on, at most the one corner case left (Cafe Kompleet:
  // the line from its frontage passes the corner of the row house in front, which the pick sees and the walk does not).
  await placedPois(page, false);
  const throughOff = await throughBuildings(page);
  await placedPois(page, true);
  const throughOn = await throughBuildings(page);
  console.log(JSON.stringify({ throughOff, throughOn }));
  expect(throughOff.length, 'the pose shows the bug without the test').toBeGreaterThanOrEqual(4);
  expect(throughOn.length, `POI labels printed across a nearer building: ${throughOn.join(', ')}`).toBeLessThanOrEqual(1);

  for (const name of HIDDEN) {
    expect(off, `${name} competes at this pose with occlusion off (the user's report)`).toContain(name);
    expect(on, `${name} sits behind a nearer roof: not drawn`).not.toContain(name);
  }
  for (const name of FRONTAGE) expect(on, `${name} faces the street: still drawn`).toContain(name);
  const stats = await page.evaluate(() => ({ ...(window as any).canalRecallGame.vectorMap._labels.stats }));
  expect(stats.occluded, 'occlusion hid something at the last full placement').toBeGreaterThan(0);
});

test('riding: between full placements no street or water name stays drawn behind a building, at a bounded cost', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1800, height: 1100 });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  await teleport(page, STAND);
  await page.waitForTimeout(2500);
  await teleport(page, STAND);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 120_000, intervals: [500] }).toBe(0);
  // A player who has learned every street and canal name, with the street-labels toggle (D) on: they may all be named.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, d = g.vectorMap._labels.data;
    if (!(g._mapLabelNames instanceof Set)) g._mapLabelNames = new Set();
    for (const s of [...d.streets, ...d.waterLines]) if (s.name) g._mapLabelNames.add(s.name);
    g.vectorMap.setLabelsVisible(true);
  });
  await page.waitForTimeout(2000);
  // Ride north up the street for 5 s; every 250 ms, ask the occlusion test about every drawn street and water name.
  const s0 = await page.evaluate(() => { const L = (window as any).canalRecallGame.vectorMap._labels; return { ...L.stats }; });
  await page.evaluate(() => { const p = (window as any).canalRecallGame.player; delete p.handleInput; });
  await page.keyboard.down('ArrowUp');
  // A copy that went behind a building is re-tested within one round of the per-frame round-robin (8 sightlines a
  // frame, ~10-30 drawn names): it may be caught in one sample, never in two in a row (250 ms apart).
  const stale: string[] = [];
  let lines = 0, last = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const L = (window as any).canalRecallGame.vectorMap._labels, out = { lines: 0, hidden: [] as string[] }, copies = new Map<string, number>();
      for (const l of L.placed) {
        const n = copies.get(l.id) ?? 0; copies.set(l.id, n + 1);
        if ((l.kind !== 'street' && l.kind !== 'water') || !l.anchors?.length || !L.lineTest) continue;
        out.lines++;
        // Every drawn copy (a long street repeats), under a probe key: its own hysteresis, from the shown side.
        if (L.lineTest(`probe:${l.id}@${n}`, l.anchors)) out.hidden.push(`${l.text} #${n}`);
      }
      return out;
    });
    lines += r.lines;
    for (const h of r.hidden) if (last.has(h)) stale.push(h);
    last = new Set(r.hidden);
  }
  await page.keyboard.up('ArrowUp');
  const s1 = await page.evaluate(() => { const L = (window as any).canalRecallGame.vectorMap._labels; return { ...L.stats }; });
  const frames = s1.winnersOnly - s0.winnersOnly;
  const usPerFrame = (s1.betweenMs - s0.betweenMs) * 1000 / Math.max(1, frames);
  console.log(JSON.stringify({ lines, stale, frames, usPerFrame: +usPerFrame.toFixed(1), sightlinesPerFrame: +((s1.betweenSightlines - s0.betweenSightlines) / Math.max(1, frames)).toFixed(2) }));
  expect(lines, 'street names are drawn on this ride').toBeGreaterThan(0);
  expect(frames, 'frames between full placements happened').toBeGreaterThan(20);
  expect(stale, 'street or water names still drawn 250 ms after a building hid them').toEqual([]);
  // 8 sightlines a frame at ~20 us each (lab 2026-11-01: 140-200 us on the M4 Pro).
  expect(usPerFrame, 'between-pass occlusion cost per frame (us)').toBeLessThan(500);
});
