import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openRoute } from './helpers';

// Label budget (`?labelCalm=1`, #161 lever 3) at the real chase camera: the game drives the camera (no held pose),
// the rider is parked at each spot, and the same page toggles the flag so both sides see one pose. Opt-in measurement:
//   LABEL_CALM_RIDE=1 PW_PORT=4804 bash /tmp/canal-pw.sh npx playwright test label-calm-ride --project=desktop --workers=1
// LABEL_CALM_BUNDLES=dir serves *.bundle.js built from this checkout; LABEL_CALM_TAG names the run (old/new code).
// The camera is the game's chase pose (zoom ~17.98 = 17.68 + the 0.3 chase offset, pitch 60), held per spot with sync off.
// Writes artifacts/label-calm-ride/<project>.json and <project>-<spot>-{off,on}.png.
const OUT = process.env.LABEL_CALM_OUT || 'artifacts/label-calm-ride';
const SPOTS = [
  { name: 'westerkerk', at: [4.8826, 52.3741], face: [4.8843, 52.3746] },
  { name: 'bloemgracht-80', at: [4.8798, 52.3752], face: [4.8809, 52.3750] },
  { name: 'nassaukade', at: [4.8722, 52.3712], face: [4.8732, 52.3722] },
  { name: 'leidsegracht-courtyard', at: [4.8868, 52.3676], face: [4.8884, 52.3686] },
  { name: 'dam', at: [4.8925, 52.3733], face: [4.8940, 52.3728] },
  { name: 'leidseplein', at: [4.8832, 52.3643], face: [4.8850, 52.3650] },
  { name: 'nieuwmarkt', at: [4.9003, 52.3724], face: [4.9020, 52.3719] },
] as const;
test.skip(!process.env.LABEL_CALM_RIDE, 'opt-in measurement (LABEL_CALM_RIDE=1)');

const bearingOf = (at: readonly number[], face: readonly number[]) =>
  Math.atan2((face[0] - at[0]) * Math.cos(at[1] * Math.PI / 180), face[1] - at[1]) * 180 / Math.PI;
const CHASE_ZOOM = 17.98;

async function park(page: Page, at: readonly number[], face: readonly number[]) {
  await page.evaluate(({ pose }) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.__abHeld ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, pitch: vm.pitchForViewMode('chase'), elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, { pose: { center: [at[0], at[1]], zoom: CHASE_ZOOM, bearing: bearingOf(at, face) } });
}

/** Placed labels now, after forcing a fresh full placement. */
async function snapshot(page: Page, calm: boolean) {
  await page.evaluate((calm) => {
    const gg = (window as any).canalRecallGame; gg.vectorMap.setQuizQuietMap(false); gg._clearLandmarkNotice?.();
    const l = (window as any).canalRecallGame.vectorMap._labels;
    l.calm = calm; l.rev++; l.ctxKey = ''; (window as any).canalRecallGame.vectorMap.host.triggerRepaint();
  }, calm);
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, l = vm._labels, h = vm.host.viewport().height, tgt = (vm.cameraMap?.camera ?? vm.cameraMap);
    const placed = l.placed as any[];
    return {
      zoom: tgt?.zoom, pitch: tgt?.pitch, calm: l.calm, total: placed.length,
      kinds: placed.reduce((a: any, p: any) => { a[p.kind] = (a[p.kind] || 0) + 1; return a; }, {}),
      poiTop: placed.filter(p => p.kind === 'poi' && p.y < h / 3).length,
      pois: placed.filter(p => p.kind === 'poi').map(p => ({ id: p.id, text: p.text, x: Math.round(p.x), y: Math.round(p.y), landmark: l.aerialPoiIds.has(p.id) })),
      names: placed.filter(p => p.kind !== 'poi').map(p => `${p.kind}:${p.text}`).sort(),
    };
  });
}

test('label calm at the ride camera', async ({ page }, info) => {
  test.setTimeout(900_000);
  if (process.env.LABEL_CALM_BUNDLES) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.LABEL_CALM_BUNDLES!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
  const tag = `${info.project.name}${process.env.LABEL_CALM_TAG ? '-' + process.env.LABEL_CALM_TAG : ''}`;
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: '' });
  // Street and water names on (T) and every name 'earned', so a withheld one can be tested; the game's own landmark quiz
  // silences the POIs (quizQuiet), so it is held off like the A/B harness holds the cards.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    vm.setLabelsVisible(true);
    vm.setQuizQuietMap = vm.setQuizQuietMap.bind(vm); const real = vm.setQuizQuietMap; vm.setQuizQuietMap = (q: boolean) => real(false);
    class AllNames extends Set<string> { has() { return true; } }
    const all = new AllNames(['x']); g._mapLabelNames = all;
  });
  mkdirSync(OUT, { recursive: true });
  const rows: any[] = [];
  for (const spot of SPOTS) {
    await park(page, spot.at, spot.face);
    await page.waitForTimeout(5000);
    await park(page, spot.at, spot.face);
    await page.waitForTimeout(4000);
    const off = await snapshot(page, false);
    await page.screenshot({ path: `${OUT}/${tag}-${spot.name}-off.png` });
    const on = await snapshot(page, true);
    await page.screenshot({ path: `${OUT}/${tag}-${spot.name}-on.png` });
    // Withheld name: ask for a street that is on screen; it must be gone from both sides.
    const street = (off.names.find(n => n.startsWith('street:')) ?? '').slice(7);
    let withheld: any = { street };
    if (street) {
      await page.evaluate((s) => { (window as any).canalRecallGame.quizPromptName = s; }, street);
      const a = await snapshot(page, false), b = await snapshot(page, true);
      withheld = { street, offHas: a.names.some(n => n.endsWith(`:${street}`)), onHas: b.names.some(n => n.endsWith(`:${street}`)),
        onSubsetOfOff: b.names.every(n => a.names.includes(n)) };
      await page.evaluate(() => { (window as any).canalRecallGame.quizPromptName = ''; });
    }
    const namesKept = on.names.join('|') === off.names.join('|');
    const offIds = new Set(off.pois.map((p: any) => p.id));
    rows.push({ spot: spot.name, off, on, namesKept, onPoisSubset: on.pois.every((p: any) => offIds.has(p.id)),
      landmarksOff: off.pois.filter((p: any) => p.landmark).length, landmarksOn: on.pois.filter((p: any) => p.landmark).length, withheld });
  }
  writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(rows, null, 1));
  for (const r of rows) {
    console.log(`${tag} ${r.spot}: zoom ${r.off.zoom?.toFixed?.(2)} pitch ${r.off.pitch} POI ${r.off.kinds.poi ?? 0}(top ${r.off.poiTop}) -> ${r.on.kinds.poi ?? 0}(top ${r.on.poiTop}); landmarks ${r.landmarksOff}->${r.landmarksOn}; names kept ${r.namesKept}; withheld ${JSON.stringify(r.withheld)}`);
    expect(r.withheld.offHas ?? false).toBe(false);
    expect(r.withheld.onHas ?? false).toBe(false);
  }
});
