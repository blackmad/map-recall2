import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { useEngine } from './helpers';
import { U1_POSE } from '../../scripts/roofs/u1Pose';

// Lane R5-E (#265): the user's U1 shot (map-recall2-screenshots engine/2026-11-08-user-shots/aerial-nieuwmarkt-flat-roofs-bright.png,
// "roofs look too bright/flat/unfinished") at its fitted pose (scripts/roofs/u1Pose.ts). Per flat lid in frame: the rendered
// lid's median luma (the lid outline projected at its height, intersected with the building's own pixels: the frame with it
// against the frame with it hidden), the lid colour and its source (meshBuildingFor, the runtime's own choice), the tier that
// draws it and whether its measured furniture is drawn. The orthophoto half is Node-side (scripts/roofs/flat-roof-u1-table.mts).
//   PW_PORT=4685 BUNDLES_DIR=<scratch> /tmp/canal-pw.sh npx playwright test tests/e2e/flat-roofs-u1.spec.ts --project=desktop --workers=1
// U1_QS adds query flags; U1_LABEL names the output (artifacts/flat-roofs/u1-<label>.json/.png).
const QS = process.env.U1_QS ?? '';
const LABEL = process.env.U1_LABEL ?? 'main';
const TOP = Number(process.env.U1_TOP ?? 45);
const lumaOf = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const OUT = 'artifacts/flat-roofs';
test.use({ viewport: { width: U1_POSE.viewport[0], height: U1_POSE.viewport[1] }, deviceScaleFactor: 2 });

async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings, g = vm._ownGround;
      vm.host?.triggerRepaint?.();
      return JSON.stringify([s?.inFlight, s?.queued, t?.chunks?.size, t?.pending?.length ?? 0, t?.inflight?.size ?? 0, t?.staged?.length ?? 0, t?.fading?.size ?? 0, t?.leaving?.size ?? 0, g?.loadingCells ?? 0]);
    });
    const v = JSON.parse(now), ok = now === last && !v[0] && !v[1] && v.slice(3).every((n: number) => n === 0);
    last = now;
    return ok;
  }, { timeout: 240_000, intervals: [1500] }).toBe(true);
}
async function rgba(url: string) {
  const { data, info } = await sharp(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const inPoly = (x: number, y: number, r: number[][]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };

test('U1 flat lids: rendered luma, lid source and furniture at the user\'s Nieuwmarkt pose', async ({ page }) => {
  test.setTimeout(900_000);
  await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await useEngine(page);
  // The rider at Levensboom (in the frame's foreground), facing the Zuiderkerk.
  const rider = [4.901069, 52.370943], face = [4.899795, 52.370273];
  await page.goto(`/canal-drive/?engine=own&travel=car&governor=0${QS}#race=${rider[1]},${rider[0]},${rider[1]},${rider[0]},${face[1]},${face[0]}`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._threeBuildings?.ready; }), { timeout: 180_000 }).toBe(true);
  await settle(page);
  const pose = await page.evaluate((spot) => {
    const vm = (window as any).canalRecallGame.vectorMap, cm = vm.cameraMap, g = vm._ownGround;
    const [lng, lat, alt] = spot.eye, ground = g?.ready ? g.heightAt([lng, lat]) : 0;
    const run = alt * Math.tan(spot.pitch * Math.PI / 180), b = spot.bearing * Math.PI / 180;
    const to = [lng + run * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat + run * Math.cos(b) / 111132];
    const o = cm.calculateCameraOptionsFromTo([lng, lat], alt + ground, to, ground);
    return { center: o.center, zoom: o.zoom, bearing: o.bearing, pitch: o.pitch };
  }, U1_POSE);
  console.log('u1 pose', JSON.stringify(pose));
  await page.evaluate((pose) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, pose);
  await settle(page);
  await page.waitForTimeout(1500);
  // Every building the tiers hold, with its lid outline projected at its top (chunk frame: ORIGIN metres).
  const seen = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, T = tb.THREE, cam = tb.camera;
    const W = innerWidth, H = innerHeight, ORIGIN = { lng: 4.9, lat: 52.37 }, kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
    const all: Record<string, any> = {};
    // One frame for every projection: a regular chunk's (ORIGIN metres; baked cells sit at their cell origin).
    const frameMesh = [...tb.chunks.values()].find((c: any) => c.mesh)?.mesh;
    frameMesh?.updateWorldMatrix(true, false);
    const add = (key: string, mesh: any, source: any[], ranges: Map<string, any>) => {
      if (!mesh || !frameMesh) return;
      for (const f of source) {
        const id = String(f.properties?.id ?? ''); if (!ranges?.has(id)) continue;
        const e = all[id] ??= { id, keys: [], feature: { type: 'Feature', properties: f.properties, geometry: f.geometry } };
        e.keys.push(key);
        if (e.screen) continue;
        const g = f.geometry, outer = (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0], z = Number(f.properties.height) || 0;
        const v = new T.Vector3();
        e.screen = outer.map(([lng, lat]: number[]) => { v.set((lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * 110540, z).applyMatrix4(frameMesh.matrixWorld).applyMatrix4(cam.projectionMatrix); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; });
      }
    };
    for (const [key, c] of tb.chunks) add(String(key), c.mesh, c.source ?? [], c.ranges);
    for (const [key, e] of tb.bakedEntries ?? []) add(`baked:${key}`, e.mesh, tb.bakedSources?.get(key) ?? [], e.ranges);
    return { look: tb.look, detail: tb.detail, zoom: vm.cameraMap?.getZoom?.(), W, H, all: Object.values(all) };
  });
  console.log('u1 resident', seen.all.length, 'look', seen.look, 'detail', seen.detail, 'zoom', seen.zoom);
  // The largest outlines on screen; scripts/roofs/flat-roof-u1-table.mts keeps the flat lids (meshBuildingFor, Node-side).
  const lids = seen.all.filter((e: any) => e.screen && e.screen.every((p: number[]) => p[2] > -1 && p[2] < 1)).map((e: any) => {
    let a = 0; const s = e.screen.map((p: number[]) => [Math.max(-50, Math.min(seen.W + 50, p[0])), Math.max(-50, Math.min(seen.H + 50, p[1]))]);
    for (let i = 0, j = s.length - 1; i < s.length; j = i++) a += s[j][0] * s[i][1] - s[i][0] * s[j][1];
    return { id: e.id, keys: e.keys, screenPx: Math.abs(a / 2), screen: e.screen, feature: e.feature };
  }).sort((a: any, b: any) => b.screenPx - a.screenPx).slice(0, TOP);
  const grab = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  const shownUrl = await grab(), shown = await rgba(shownUrl), sx = shown.width / seen.W;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/u1-${LABEL}.png`, Buffer.from(shownUrl.slice(shownUrl.indexOf(',') + 1), 'base64'));
  const rows = [];
  for (const l of lids) {
    await page.evaluate((id) => (window as any).canalRecallGame.vectorMap._threeBuildings.setHidden('u1', [id]), l.id);
    await page.waitForTimeout(250);
    const hidden = await rgba(await grab());
    await page.evaluate(() => (window as any).canalRecallGame.vectorMap._threeBuildings.setHidden('u1', []));
    const ring = l.screen.map((p: number[]) => [p[0] * sx, p[1] * sx]);
    const ys: number[] = []; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(1, Math.floor(y0)); y < Math.min(shown.height - 1, y1); y++) for (let x = Math.max(1, Math.floor(x0)); x < Math.min(shown.width - 1, x1); x++) {
      // Two pixels in from the projected outline (the parapet edge, the wall's top row).
      if (!inPoly(x + .5, y + .5, ring) || !inPoly(x - 1.5, y + .5, ring) || !inPoly(x + 2.5, y + .5, ring) || !inPoly(x + .5, y - 1.5, ring) || !inPoly(x + .5, y + 2.5, ring)) continue;
      const i = (y * shown.width + x) * 4, d = Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]);
      if (d > 30) ys.push(lumaOf([shown.data[i], shown.data[i + 1], shown.data[i + 2]]));
    }
    ys.sort((a, b) => a - b);
    const { screen: _s, ...rest } = l;
    rows.push({ ...rest, renderedLuma: ys.length ? Math.round(ys[ys.length >> 1]) : null, renderedPx: ys.length, ring: l.screen.map((p: number[]) => [Math.round(p[0]), Math.round(p[1])]) });
  }
  console.table(rows.map(r => ({ id: r.id.slice(-8), px: r.renderedPx, luma: r.renderedLuma, keys: r.keys.map((k: string) => k.split(':')[0]).join(',') })));
  writeFileSync(`${OUT}/u1-${LABEL}.json`, JSON.stringify({ when: new Date().toISOString(), qs: QS, pose, look: seen.look, detail: seen.detail, zoom: seen.zoom, frame: [shown.width, shown.height], rows }, null, 1));
  expect(rows.length, 'buildings in the U1 frame').toBeGreaterThan(5);
});
