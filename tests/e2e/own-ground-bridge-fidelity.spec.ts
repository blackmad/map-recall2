import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { bridgesFromExtract, type Bridge } from './ownGroundBridges';
import { PINNED_CROWNS, crownOverHigherEnd } from '../../src/canalRecall/ownGround/bridgeCrowns';

// Named bridge-fidelity regressions on the own ground (`?ownGround=1`), lane bridge-fidelity 2026-10-14.
// Opt-in, needs the GPU and the network basemap:
//   OWN_GROUND=1 PW_PORT=4510 npx playwright test own-ground-bridge-fidelity --project=desktop
// Pixel checks: each view is shot twice, with and without the deckBody meshes; the difference is the bridge kit's own
// mask. Arches are drawn when a row through the lower half of the mask has an opening between body runs. The deck
// humps are read as geometry: the own-ground store's deck for each bridge id (ground.store.surface.decks), its crown
// over the higher approach end in metres against PINNED_CROWNS (src/canalRecall/ownGround/bridgeCrowns.ts, the values
// test:own-ground pins). The pixel hump reading gave false alarms and is gone; screenshots stay as evidence.
//   - the Seven Bridges down the Reguliersgracht from the Herengracht corner (BRU0031 … BRU0072)
//   - the Torensluis (BRU0009) from the Singel
//   - the bascules: the Magere Brug (portals), the Haarlemmerpoort pair Willemsbrug / Bullebak and the Zoutkeetsgracht
//     bridge (BRU0345; basement bascules: signal masts, no portal); user screenshots 2026-10-14
//   - the Houthavens footbridges BRU2433-2435 (user 2026-10-14 "disconnected bridge"): both ends on land
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-bridge-fidelity';
const SEVEN = ['BRU0031', 'BRU0032', 'BRU0039', 'BRU0074', 'BRU0073', 'BRU0072'];

const offset = (b: { lng: number; lat: number }, east: number, north: number): [number, number] =>
  [b.lng + east / (111320 * Math.cos(b.lat * Math.PI / 180)), b.lat + north / 111320];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  // ROADS=bgt: the roads-v1 BGT road partition (phase 1 opt-in, `?roads=bgt`); shots land in a separate directory for before/after.
  if (process.env.ROADS === 'bgt') await page.addInitScript(() => { (window as any).__canalRecallRoads = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  // Only the map scene: the HUD cards come and go between the paired shots; the rider is hidden too.
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #vector-map, #vector-map * { visibility: visible !important; }' });
  await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    for (const k of ['setPlayerBike', 'setPlayerBoat', 'setPlayerFerry', 'setPlayerTransit']) {
      const orig = vm[k]?.bind(vm);
      if (orig) vm[k] = (player: unknown, loader: unknown, _visible: boolean, ...rest: unknown[]) => orig(player, loader, false, ...rest);
    }
  });
  return errors;
}

async function teleport(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
}

async function settle(page: Page): Promise<void> {
  await expect.poll(async () => {
    const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(4000);
}

/** Crown over the higher approach end, in metres, of each bridge's deck as the running game's own-ground store holds it (null: deck not placed). */
async function deckCrowns(page: Page, ids: string[]): Promise<Record<string, number | null>> {
  const heights = await page.evaluate(ids => {
    const surface = (window as any).canalRecallGame.vectorMap._ownGround.store.surface;
    const out: Record<string, { h: number[]; ends: [number, number] } | null> = {};
    for (const id of ids) {
      const d = surface.decks.find((k: any) => k.profile.id === id);
      out[id] = d ? { h: Array.from(d.profile.x as ArrayLike<number>, (_: number, i: number) => surface.height(d.profile.x[i], d.profile.y[i])), ends: [d.ends[0], d.ends[1]] } : null;
    }
    return out;
  }, ids);
  return Object.fromEntries(ids.map(id => [id, heights[id] ? crownOverHigherEnd(heights[id]!.h, heights[id]!.ends) : null]));
}

function expectCrowns(crowns: Record<string, number | null>, ids: string[]): void {
  for (const id of ids) {
    const pin = PINNED_CROWNS[id];
    expect(crowns[id], `${id} deck present in the own-ground store`).not.toBeNull();
    expect(Math.abs(crowns[id]! - pin.crownM), `${id} crown ${crowns[id]?.toFixed(3)} m over the higher end vs pinned ${pin.crownM} m`).toBeLessThanOrEqual(pin.tolM);
  }
}

/** Freeze the camera at `from` (`up` m over the water there, or over the ground) looking at `to` (`toUp` m over the ground). */
async function lookFrom(page: Page, from: [number, number], up: number, to: [number, number], toUp: number, onWater = true): Promise<void> {
  // The rider (hidden, boot) stands on the target, so the bridge's cells are in the near ring (LOD 0).
  const me = (from[0] - to[0]) * Math.cos(from[1] * Math.PI / 180), mn = from[1] - to[1];
  await teleport(page, to[0], to[1], (Math.atan2(-me, -mn) * 180 / Math.PI + 360) % 360);
  await settle(page);
  await page.evaluate(({ from, up, to, toUp, onWater }) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, (onWater ? ground.waterLevelAt(from) : ground.heightAt(from)) + up, to, ground.heightAt(to) + toUp));
    map.triggerRepaint();
  }, { from, up, to, toUp, onWater });
  await page.waitForTimeout(1500);
}

/** The bridge kit's pixels: the shot with deckBody hidden against the shot with it. */
async function kitMask(page: Page, file: string): Promise<{ mask: Uint8Array; width: number; height: number; count: number; rg: Int16Array }> {
  const shot = async () => sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const toggle = (show: boolean) => page.evaluate(show => {
    const vm = (window as any).canalRecallGame.vectorMap, ground = vm._ownGround;
    for (const r of ground.resident.values()) r.group.traverse((o: any) => { if (o.isMesh && o.name === 'deckBody') o.visible = show; });
    vm.map.triggerRepaint();
  }, show);
  const on = await shot();
  await page.screenshot({ path: file });
  await toggle(false); await page.waitForTimeout(800);
  const off = await shot();
  await toggle(true); await page.waitForTimeout(300);
  const { width, height } = on.info, mask = new Uint8Array(width * height), rg = new Int16Array(width * height);
  let count = 0;
  for (let i = 0; i < width * height; i++) {
    const d = Math.abs(on.data[i * 3] - off.data[i * 3]) + Math.abs(on.data[i * 3 + 1] - off.data[i * 3 + 1]) + Math.abs(on.data[i * 3 + 2] - off.data[i * 3 + 2]);
    // The HUD's top row (score, target, compass) is out of the scene.
    if (d > 40 && i / width >= 120) { mask[i] = 1; rg[i] = on.data[i * 3] - on.data[i * 3 + 1]; count++; }
  }
  return { mask, width, height, count, rg };
}

/** Screen columns of a bridge's deck-span ends (the side view's own bridge, not a neighbour further down the canal). */
async function spanColumns(page: Page, b: Bridge): Promise<[number, number]> {
  return page.evaluate(({ b }) => {
    const map = (window as any).canalRecallGame.vectorMap.map, left = map.getContainer().getBoundingClientRect().left;
    const rad = b.bearing * Math.PI / 180, mLng = 111320 * Math.cos(b.lat * Math.PI / 180), h = b.lengthM / 2;
    const xs = [-1, 1].map(s => map.project([b.lng + Math.sin(rad) * s * h / mLng, b.lat + Math.cos(rad) * s * h / 111320]).x + left);
    return [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))] as [number, number];
  }, { b });
}

/**
 * Openings: most body-gap-body patterns in one row of the lower part of the mask (the arches), and the hump.
 * `cols`: the deck span's screen columns (spanColumns); the hump is read between them.
 */
function readMask(m: { mask: Uint8Array; width: number; height: number; rg: Int16Array }, cols?: [number, number]): { openings: number; humpPx: number; bbox: number[]; span?: number[] } {
  let x0 = m.width, x1 = -1, y0 = m.height, y1 = -1;
  const colCount = new Array(m.width).fill(0);
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.mask[y * m.width + x]) colCount[x]++;
  // The bridge's extent: columns with a solid run (lone railing pixels do not count).
  for (let x = 0; x < m.width; x++) if (colCount[x] > 6) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  for (let y = 0; y < m.height; y++) for (let x = x0; x <= x1; x++) if (m.mask[y * m.width + x]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let openings = 0;
  for (let y = Math.round(y0 + (y1 - y0) * 0.45); y <= y1 - 2; y += 2) {
    // A body pixel is the kit's face: in the mask and as red as the row's face (spandrel brick, stone and steel all sit
    // redder than the shadowed vault under an arch, seen through the opening).
    const reds: number[] = [];
    for (let x = x0; x <= x1; x++) if (m.mask[y * m.width + x]) reds.push(m.rg[y * m.width + x]);
    reds.sort((a, b) => a - b);
    const faceRed = reds.length ? reds[Math.floor(reds.length * 0.75)] : 0;
    const runs: [number, number][] = [];
    let s = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const k = y * m.width + x, on = x <= x1 && m.mask[k] === 1 && (faceRed < 12 || m.rg[k] > faceRed * 0.7);
      if (on && s < 0) s = x; else if (!on && s >= 0) { if (x - s >= 3) runs.push([s, x - 1]); s = -1; }
    }
    // Gaps of at least 8 px between body runs.
    let gaps = 0;
    for (let i = 1; i < runs.length; i++) if (runs[i][0] - runs[i - 1][1] > 8) gaps++;
    openings = Math.max(openings, gaps);
  }
  // Top edge of the solid body (6 px of mask below it, so a rail is not body) per column; the hump is the ends' mean
  // minus the middle, each the median of a band of columns, between the deck span's columns when given. Single columns
  // let a railing post top set the middle and the next bridge down the Singel set the right end: the Torensluis read
  // 28 px on its lane and -12 px on main (2026-10-14) from byte-identical deck meshes, once main's shots carried an
  // orange-outlined figure on the crown and orange streaks at the deck ends that differ between the paired shots.
  const top = (x: number) => { for (let y = 0; y < m.height - 6; y++) { let k = 0; while (k < 6 && m.mask[(y + k) * m.width + x]) k++; if (k === 6) return y; } return m.height; };
  const [h0, h1] = cols ? [Math.max(x0, cols[0]), Math.min(x1, cols[1])] : [x0, x1], span = h1 - h0;
  const band = (a: number, b: number) => { const v: number[] = []; for (let x = Math.round(h0 + span * a); x <= Math.round(h0 + span * b); x++) v.push(top(x)); v.sort((p, q) => p - q); return v[v.length >> 1]; };
  const ends = [band(0.04, 0.14), band(0.86, 0.96)], mid = band(0.4, 0.6);
  return { openings, humpPx: (ends[0] + ends[1]) / 2 - mid, bbox: [x0, y0, x1, y1], ...(cols ? { span: [h0, h1, ends[0], mid, ends[1]] } : {}) };
}

test('bridge fidelity: arches, humps, bascules and landed ends', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const report: Record<string, unknown> = {};
  const P = info.project.name;
  const save = () => writeFileSync(`${OUT}/${P}-report.json`, JSON.stringify(report, null, 1));

  // 1. The Seven Bridges: from the Herengracht corner down the Reguliersgracht.
  const seven = bridgesFromExtract(SEVEN), first = seven[0], last = seven[seven.length - 1];
  const de = (last.lng - first.lng) * Math.cos(first.lat * Math.PI / 180), dn = last.lat - first.lat, dl = Math.hypot(de, dn);
  const ue = de / dl, un = dn / dl;
  await lookFrom(page, offset(first, -ue * 30, -un * 30), 1.2, [first.lng, first.lat], -0.5);
  const sm = await kitMask(page, `${OUT}/${P}-seven-bridges.png`), sr = readMask(sm);
  report.sevenBridges = { pixels: sm.count, ...sr }; save();
  expect(sm.count, 'Seven Bridges drawn').toBeGreaterThan(5000);
  expect(sr.openings, 'an arch opening down the Reguliersgracht').toBeGreaterThanOrEqual(1);
  const sevenCrowns = await deckCrowns(page, SEVEN);
  report.sevenCrowns = sevenCrowns; save();
  expectCrowns(sevenCrowns, SEVEN);

  // 2. Side views from the water: the Torensluis from the Singel; BRU0073, BRU0038 and the Blauwbrug for reference.
  const side: { id: string; arches: number; across: number; bearing?: number; flat?: boolean }[] = [
    { id: 'BRU0009', arches: 3, across: 48, bearing: 104 }, { id: 'BRU0073', arches: 1, across: 26 }, { id: 'BRU0038', arches: 3, across: 30 }, { id: 'BRU0236', arches: 3, across: 40, flat: true },
  ];
  for (const s of side) {
    const [b] = bridgesFromExtract([s.id]) as Bridge[];
    if (s.bearing !== undefined) b.bearing = s.bearing;
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    // Across the axis: the right-hand normal in the east-north frame is (uy, -ux).
    await lookFrom(page, offset(b, uy * s.across, -ux * s.across), 1.2, [b.lng, b.lat], -1.0);
    const cols = await spanColumns(page, b);
    const m = await kitMask(page, `${OUT}/${P}-${s.id}-side.png`), r = readMask(m, cols);
    report[s.id] = { pixels: m.count, ...r }; save();
    expect(r.openings, `${s.id} arches drawn`).toBeGreaterThanOrEqual(s.arches);
    // The Blauwbrug's deck is nearly level (a 0.3 m rise over 40 m): no crown pinned there.
    if (!s.flat) {
      const crowns = await deckCrowns(page, [s.id]);
      report[`${s.id}Crown`] = crowns[s.id]; save();
      expectCrowns(crowns, [s.id]);
    }
  }

  // 3. Bascules: the kit stands over the deck (portals or signal masts), seen from the approach at 1.7 m.
  for (const id of ['BRU0242', 'BRU0151', 'BRU0149', 'BRU0345']) {
    const [b] = bridgesFromExtract([id]) as Bridge[];
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad), back = b.lengthM / 2 + 25;
    await lookFrom(page, offset(b, -ux * back + uy * 3, -uy * back - ux * 3), 1.7, [b.lng, b.lat], 2.0, false);
    const m = await kitMask(page, `${OUT}/${P}-${id}-approach.png`), r = readMask(m);
    report[id] = { pixels: m.count, bbox: r.bbox }; save();
    // The horizon at eye height sits mid-frame: the kit reaches well over it.
    expect(r.bbox[1], `${id}: portal or masts over the deck`).toBeLessThan(m.height * 0.42);
  }

  // 4. The Houthavens footbridges land on both banks: the ground layer 1.5 m past each deck end is not water.
  for (const b of bridgesFromExtract(['BRU2433', 'BRU2434', 'BRU2435'])) {
    await teleport(page, b.lng, b.lat, b.bearing);
    await settle(page);
    const ends = await page.evaluate(({ b }) => {
      const ground = (window as any).canalRecallGame.vectorMap._ownGround, api = (window as any).CanalRecallOwnGround;
      const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad), mLng = 111320 * Math.cos(b.lat * Math.PI / 180);
      return [-1, 1].map(sgn => {
        const s = sgn * (b.lengthM / 2 + 1.5), lngLat: [number, number] = [b.lng + ux * s / mLng, b.lat + uy * s / 111320];
        const [x, y] = api.toLocal(lngLat[0], lngLat[1]), hit = ground.layersAt(x, y);
        return { top: hit.top, z: hit.hits.find((h: any) => !h.cut && h.layer !== 'water')?.z ?? null, water: ground.waterLevelAt(lngLat) };
      });
    }, { b });
    report[b.id] = ends; save();
    for (const e of ends) expect(e.top, `${b.id}: an end over water`).not.toBeNull();
  }

  // 5. Ride review 2026-10-14, geometry in metres from the store and the built cells.
  // J6, the Nieuwe-Wercksbrug BRU0063: its 18 m outline side widens the deck over the water only. Every metre of the
  // widened side (past the road's half-width) along the deck span: on land the deck top is not what a camera above
  // sees (it lay as grey slabs over the quay corners), over the water it is (or a band on it).
  await teleport(page, 4.88292, 52.37433, 191);
  await settle(page);
  const j6 = await page.evaluate(() => {
    const ground = (window as any).canalRecallGame.vectorMap._ownGround, p = ground.store.surface.decks.find((d: any) => d.profile.id === 'BRU0063')?.profile;
    if (!p?.sides) return null;
    let land = 0, slab = 0, water = 0, decked = 0;
    for (let i = 4; i + 4 < p.s.length; i++) {
      if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1]) continue;
      const dx = p.x[i + 4] - p.x[i - 4], dy = p.y[i + 4] - p.y[i - 4], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      for (let t = p.halfWidth[i] + 1.5; t < p.sides[0] - 0.5; t += 1) {
        const hit = ground.layersAt(p.x[i] + nx * t, p.y[i] + ny * t), wet = hit.hits.some((h: any) => h.layer === 'water');
        if (wet) { water++; if (hit.top && hit.top !== 'water') decked++; } else { land++; if (hit.top === 'deckTop') slab++; }
      }
    }
    return { land, slab, water, decked };
  });
  report.BRU0063widths = j6; save();
  expect(j6, 'BRU0063 placed with its outline').not.toBeNull();
  expect(j6!.slab, `BRU0063: deck top seen over ${j6!.slab} of ${j6!.land} land probes of the widened side`).toBeLessThanOrEqual(Math.ceil(j6!.land * 0.1));
  expect(j6!.decked, `BRU0063: the widened side over the water (${j6!.decked}/${j6!.water})`).toBeGreaterThanOrEqual(Math.floor(j6!.water * 0.9));
  // P4, the Walter Süskindbrug BRU0237: its leaves from OSM way 38322370 (bridge=movable, 12.7 m between the heels on a
  // 21.5 m register footprint): a double bascule, a portal at each heel.
  await teleport(page, 4.90206, 52.36593, 163);
  await settle(page);
  const p4 = await page.evaluate(async () => {
    const ground = (window as any).canalRecallGame.vectorMap._ownGround, api = (window as any).CanalRecallOwnGround, store = ground.store;
    for (const key of api.GroundStore.neighbours(ground.cellKeyAt([4.90206, 52.36593]))) {
      const i = store.flatDeckMeta(key).findIndex((m: any) => m.id === 'BRU0237');
      if (i < 0) continue;
      const ring = store.flatDecks(key)[i], input = await store.cellInput(key, 0);
      const lines = [input.osm, ...input.osmAround].flatMap((o: any) => o?.ways ?? []).filter((w: any) => w.tags.bridge && w.tags.bridge !== 'no');
      const local = (w: any) => w.g.map((q: [number, number]) => api.toLocal(q[0], q[1]));
      const through = lines.map(local).filter((l: [number, number][]) => l.some(q => api.pointInRing(ring, q[0], q[1])) || l.some((q, k) => k > 0 && api.pointInRing(ring, (q[0] + l[k - 1][0]) / 2, (q[1] + l[k - 1][1]) / 2)));
      const moving = lines.filter((w: any) => w.tags.bridge === 'movable' || w.tags['bridge:movable']).map(local);
      const axis = api.footprintAxis(ring, through), plan = api.movableLeaves(ring, axis.u, moving);
      const frames = (ground.cellStats(key)?.flatBridges ?? []).find((f: any) => f.id === 'BRU0237')?.frames ?? null;
      return { footprintM: axis.along[1] - axis.along[0], double: plan?.double ?? null, leavesM: plan ? plan.leaves[plan.leaves.length - 1][1] - plan.leaves[0][0] : null, frames };
    }
    return null;
  });
  report.BRU0237leaves = p4; save();
  expect(p4, 'BRU0237 footprint in the store').not.toBeNull();
  expect(p4!.double, 'BRU0237: a double bascule from its OSM way').toBe(true);
  expect(Math.abs(p4!.leavesM! - 12.7), `BRU0237 leaves span ${p4!.leavesM?.toFixed(2)} m (the OSM movable way 12.7 m)`).toBeLessThan(0.6);
  expect(p4!.frames, 'BRU0237: a portal at each heel').toBe(2);
  expect(errors).toEqual([]);
});
