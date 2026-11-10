import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute, settleWorld } from './helpers';
import { CRISP_SPOTS } from '../../scripts/look/crispSpots';

// Lane R4-K (#255): with `?bakedRelease=1` the far prisms draw under every released baked cell. Opt-in probe:
//   FAR_RELEASE=1 BUNDLES_DIR=<scratch> PW_PORT=4670 [FAR_RELEASE_SPOTS=zuidas-rails-high] [FAR_RELEASE_QUERY=bakedRelease=1]
//     /tmp/canal-pw.sh npx playwright test far-under-release --project=desktop --workers=1
// Per spot: every far part of a released cell, and why it is hidden (baked drawn / runtime coarse / near detail).
test.skip(!process.env.FAR_RELEASE, 'set FAR_RELEASE=1 to probe');

const OUT = process.env.FAR_RELEASE_DIR || 'artifacts/far-release';
const NAMES = (process.env.FAR_RELEASE_SPOTS ?? 'zuidas-rails-high').split(',').filter(Boolean);
const QUERY = process.env.FAR_RELEASE_QUERY ?? 'bakedRelease=1';
// The west-leg peak of scripts/aerial-pan.mjs (west-bos-en-lommer, looking N) as a held pose, beside the crisp spots.
const EXTRA: typeof CRISP_SPOTS[number][] = [
  { name: 'west-peak', center: [4.8530, 52.3780], zoom: 14.8, bearing: 0, pitch: 66, band: { x0: 0, y0: 0, x1: 1, y1: 0.5 } },
  { name: 'west-peak-east', center: [4.8530, 52.3780], zoom: 14.8, bearing: 90, pitch: 66, band: { x0: 0, y0: 0, x1: 1, y1: 0.5 } },
];
const ALL = [...CRISP_SPOTS, ...EXTRA];

async function jump(page: Page, spot: typeof CRISP_SPOTS[number]): Promise<void> {
  const pose = { center: spot.center, zoom: spot.zoom, bearing: spot.bearing, pitch: spot.pitch };
  await page.evaluate((pose) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, pitch: pose.pitch ?? vm.pitchForViewMode('chase'), elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, pose);
  await settleWorld(page, `${spot.name} jump`);
}

/** Every far part of a released (or covered, undrawn) cell and why it is hidden. */
async function probe(page: Page): Promise<any> {
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, fs = vm._farShells, bc = vm._bakedCoarse;
    const host = tb.farShellHost();
    const released = [...(bc?.released ?? [])], covered = [...(bc?.covered ?? [])];
    const coarseTiles = new Set([...tb.chunks.keys()].filter((k: string) => k.startsWith('coarse:') && tb.chunks.get(k)?.mesh).map((k: string) => k.slice(7)));
    const cells: any[] = [];
    for (const [key, r] of fs?.residents ?? []) {
      const rel = bc?.released?.has(key) ?? false;
      if (!rel && !(bc?.covered?.has(key) && !bc?.drawn(key))) continue;
      cells.push({ key, released: rel, drawn: bc?.drawn(key), visible: r.mesh.visible, inScene: !!r.mesh.parent, fading: !!r.fade,
        parts: r.parts.map((p: any) => ({ tile: p.tile, hidden: p.hidden, coarse: coarseTiles.has(p.tile), near: tb.nearDrawnIn(p.tile), host: host.coarseDrawn(p.tile, key) })) });
    }
    const farKeys = new Set([...(fs?.residents?.keys() ?? [])]);
    return { far: fs?.stats(), baked: bc?.stats(), released, coveredNotFar: covered.filter((k: string) => !farKeys.has(k)), coarseTiles: [...coarseTiles], cells,
      eye: bc?.eye ?? null, nearChunks: [...tb.chunks.keys()].filter((k: string) => k.startsWith('near:')).length };
  });
}

test('far prisms under released baked cells', async ({ page }) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => { (window as any).__canalRecallChunkFade = false; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?engine=own&tier=high&governor=0&${QUERY}` });
  const report: Record<string, any> = {};
  for (const name of NAMES) {
    const spot = ALL.find(s => s.name === name)!;
    await jump(page, spot);
    await jump(page, spot);
    await page.waitForTimeout(4000);
    await settleWorld(page, `${name} hold`);
    const p = await probe(page);
    report[name] = p;
    const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
    writeFileSync(`${OUT}/${name}-${QUERY.replace(/[^\w]+/g, '_')}.png`, Buffer.from(url.split(',')[1], 'base64'));
    // FAR_RELEASE_LAYERS=1: the same frame without the far prisms, and without the baked cells (which tier draws where).
    if (process.env.FAR_RELEASE_LAYERS) for (const layer of ['far', 'baked'] as const) {
      const url2: string = await page.evaluate(async (layer) => {
        const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings;
        const meshes = layer === 'far' ? [...vm._farShells.residents.values()].map((r: any) => r.mesh) : [...tb.bakedEntries.values()].map((e: any) => e.mesh);
        const was = meshes.map((m: any) => m.layers.mask); meshes.forEach((m: any) => { m.layers.mask = 0; }); vm.host?.triggerRepaint?.(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const c = await vm.captureFrame(); const u = c?.toDataURL('image/png') ?? '';
        meshes.forEach((m: any, i: number) => { m.layers.mask = was[i]; });
        return u;
      }, layer);
      writeFileSync(`${OUT}/${name}-${QUERY.replace(/[^\w]+/g, '_')}-no-${layer}.png`, Buffer.from(url2.split(',')[1], 'base64'));
    }
    // FAR_RELEASE_AB=<metres>: keep | release in the same page and pose (no second load: the same rider, near chunks and
    // resident sets). The release distance is switched on the live tier; `keep` brings every released cell back.
    if (process.env.FAR_RELEASE_AB) {
      const cap = async (label: string) => {
        await settleWorld(page, `${name} ${label}`);
        await page.waitForTimeout(1500);
        await settleWorld(page, `${name} ${label} hold`);
        const u: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
        writeFileSync(`${OUT}/${name}-ab-${label}.png`, Buffer.from(u.split(',')[1], 'base64'));
        return page.evaluate(() => (window as any).canalRecallGame.vectorMap._bakedCoarse.stats());
      };
      const setRelease = (m: number | null) => page.evaluate((m) => { const vm = (window as any).canalRecallGame.vectorMap; vm._bakedCoarse.releaseM = m; vm.host?.triggerRepaint?.(); }, m);
      const ab: Record<string, any> = {};
      for (const m of process.env.FAR_RELEASE_AB.split(',').map(Number)) {
        await setRelease(null); ab[`keep-before-${m}`] = await cap(`keep-${m}`);
        await setRelease(m); ab[`release-${m}`] = await cap(`release-${m}`);
      }
      await setRelease(null); ab.keepEnd = await cap('keep-end');
      report[name].ab = ab;
    }
    // FAR_RELEASE_SERIES=<metres>: one release and one return at the held pose, frame by frame (no settle between):
    // the far part must show in the frame the baked mesh goes, and hide only once the returning mesh has dissolved in.
    if (process.env.FAR_RELEASE_SERIES) {
      const m = Number(process.env.FAR_RELEASE_SERIES);
      const setRelease = (v: number | null) => page.evaluate((v) => { const vm = (window as any).canalRecallGame.vectorMap; vm._bakedCoarse.releaseM = v; vm.host?.triggerRepaint?.(); }, v);
      await setRelease(null); await settleWorld(page, `${name} series keep`);
      const grab = async (label: string, waitMs: number) => {
        const u: string = await page.evaluate(async (w) => { const vm = (window as any).canalRecallGame.vectorMap; const t = performance.now(); while (performance.now() - t < w) { vm.host?.triggerRepaint?.(); await new Promise(r => requestAnimationFrame(r)); } return vm.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''); }, waitMs);
        const st = await page.evaluate(() => { const b = (window as any).canalRecallGame.vectorMap._bakedCoarse.stats(); return { released: b.released, drawn: b.drawn, fading: b.fading, cells: b.cells }; });
        writeFileSync(`${OUT}/${name}-series-${label}.png`, Buffer.from(u.split(',')[1], 'base64'));
        return { label, ...st };
      };
      const series: any[] = [await grab('00-keep', 0)];
      await setRelease(m);
      for (let k = 1; k <= 4; k++) series.push(await grab(`r${k}`, 0));
      series.push(await grab('r-late', 1500));
      await setRelease(null);
      for (let k = 1; k <= 12; k++) series.push(await grab(`b${String(k).padStart(2, '0')}`, 150));
      series.push(await grab('b-late', 3000));
      report[name].series = series;
    }
    report[name].bakedHidden = await page.evaluate(() => {
      const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, out: Record<string, number> = {};
      for (const [k, e] of tb.bakedEntries) { const a = e.mesh.geometry.getAttribute('hidden').array; let h = 0; for (let i = 0; i < a.length; i++) h += a[i] ? 1 : 0; out[k] = +(h / a.length).toFixed(3); }
      return out;
    });
  }
  writeFileSync(`${OUT}/probe-${QUERY.replace(/[^\w]+/g, '_')}.json`, JSON.stringify(report, null, 1));
  if (process.env.FAR_RELEASE_ASSERT) for (const [name, p] of Object.entries(report)) {
    const bare = p.cells.filter((c: any) => c.released).flatMap((c: any) => c.parts.filter((q: any) => q.hidden && !q.coarse).map((q: any) => `${c.key}@${q.tile}`));
    expect(bare, `${name}: released cells' far parts hidden with nothing drawing them`).toEqual([]);
  }
});
