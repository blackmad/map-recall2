// Named regressions (user reports 2026-10-10):
//  - "why is clicking on a building to get the detail card so slow to look it
//    up / highlight it?" Picking rebuilt every chunk the click ray crossed
//    (the whole facade layout, then thrown away): 1.9–2.3 s per click on
//    desktop. Picking now tests footprint prisms (`prismPick.ts`).
//  - "why does this building not let me click on it?" A tall post-war slab
//    tower alone on a square. Only listed monuments opened a card, so a click
//    on an ordinary or large-tier building did nothing at all; now every drawn
//    building answers with what the register knows.
//
// Budgets: card drawn < 150 ms after pointerup on desktop, < 400 ms on the
// iPhone project under 4× CPU throttle; the highlight is applied in the same
// task as the card, so it lands in the card's first frame.
//
//   PW_PORT=4434 npx playwright test building-click-perf
//   BEFORE=1 … serves the pre-fix bundles from tests/e2e/.before (local only).
import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

const BUDGET_MS: Record<string, number> = { desktop: 150, iphone: 400 };
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];
/** De Nederlandsche Bank's tower on Frederiksplein (OSM way 1533847438, 71.8 m,
 *  no BAG year): a slab alone on a paved square with a park beyond. */
const TOWER = { id: 'w1533847438', lngLat: [4.90053, 52.35892] as [number, number] };
/** Westermarkt: Westerkerk (signature GLB), the Anne Frank House museum block
 *  (large tier), canal houses (ordinary) and sheds (generic) in one view. */
const WESTERMARKT: [number, number] = [4.8840, 52.3746];
/** UvA PC Hoofthuis, Spuistraat: a large-tier landmark block (`largeBuildingTier.ts`). */
const LARGE_TIER = { id: 'NL.IMBAG.Pand.0363100012165429', lngLat: [4.889672, 52.373877] as [number, number] };
/** Oudezijds Voorburgwal 115–125: a block-face street chunk. */
const WALLEN_CHUNK = 'chunk-face-wallen-ozv-115-125';

async function serveBefore(page: Page) {
  for (const file of ['three-buildings.bundle.js', 'game-landmarks.bundle.js', 'vector-map.js']) {
    const path = `tests/e2e/.before/${file}`;
    if (!existsSync(path)) throw new Error(`BEFORE=1 needs ${path} (git show <base>:public/canal-drive/js/${file})`);
    await page.route(new RegExp(`/js/${file.replace(/\./g, '\\.')}`), route => route.fulfill({ body: readFileSync(path), contentType: 'application/javascript' }));
  }
}

async function boot(page: Page) {
  if (process.env.BEFORE) await serveBefore(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return vm._completeCityHasBuildings && vm._threeBuildings?.ready && vm._threeBuildings.chunks.size > 3;
  }, null, { timeout: 120_000 });
  await page.evaluate((cam) => {
    const w = window as any, g = w.canalRecallGame, map = g.vectorMap.map;
    // Freeze the game camera so the map stays where the test puts it.
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
    g.vectorMap._signatureLandmarks?.setSuspended?.(false);
    // Card timing: pointerup → the first frame that draws the card.
    const render = g._renderLandmarkNotice;
    g._renderLandmarkNotice = function (...a: unknown[]) {
      const r = render.apply(this, a);
      const c = w.__click;
      if (c && this._landmarkCardBounds && c.cardMs == null) {
        c.cardMs = performance.now() - c.start;
        const vm = this.vectorMap, sig = vm._signatureLandmarks;
        c.highlight = vm._threeBuildings?.highlighted?.size ? 'mesh'
          : (sig?._entries || []).some((e: any) => e.highlighted) ? 'model'
          : (vm.map.getSource('active-landmark')?._data?.features?.length ? 'dot' : 'none');
      }
      return r;
    };
    window.addEventListener('pointerup', e => { w.__click = { start: e.timeStamp }; }, true);
  }, CAM);
}

async function lookAt(page: Page, center: [number, number], zoom = 17.2, pitch = 50) {
  await page.evaluate(({ center, zoom, pitch }) => {
    const g = (window as any).canalRecallGame, map = g.vectorMap.map;
    g._clearLandmarkNotice();
    map.__jumpTo.call(map, { center, zoom, pitch, bearing: 0 });
  }, { center, zoom, pitch });
}

/** Screen point (map-canvas CSS px) of a streamed building's roof centre, from
 *  the facade layer's own projection — independent of the picking code. */
async function roofPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, tb = vm._threeBuildings, T = w.CanalRecallThree.THREE;
    const canvas = vm.map.getCanvas(), W = canvas.clientWidth, H = canvas.clientHeight;
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || !chunk.mesh) continue;
      const f = chunk.source.find((x: any) => String(x.properties.id) === id);
      if (!f || !chunk.ranges.has(id)) continue;
      const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      let lng = 0, lat = 0; for (const [a, b] of ring) { lng += a; lat += b; } lng /= ring.length; lat /= ring.length;
      const kx = 111_320 * Math.cos(52.37 * Math.PI / 180);
      const z = (Number(f.properties.height) || 10) * 0.9 + (chunk.lift?.applied?.get(id) ?? 0);
      const p = new T.Vector3((lng - 4.9) * kx, (lat - 52.37) * 110_540, z).applyMatrix4(chunk.mesh.matrixWorld).applyMatrix4(tb.camera.projectionMatrix);
      return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, W, H };
    }
    return null;
  }, id);
}

async function click(page: Page, point: { x: number; y: number }) {
  const box = await page.evaluate(() => { const r = (window as any).canalRecallGame.vectorMap.map.getCanvas().getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.click(box.x + point.x, box.y + point.y);
  await page.waitForFunction(() => (window as any).__click?.cardMs != null, null, { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => {
    const w = window as any, g = w.canalRecallGame;
    return { ...w.__click, card: g._landmarkNotice ? { id: g._landmarkNotice.id, name: g._landmarkNotice.name } : null,
      lit: [...(g.vectorMap._threeBuildings?.highlighted ?? [])] };
  });
}

/** Wait until the facade layer holds `id` and the view has settled. */
async function resident(page: Page, id: string) {
  await expect.poll(() => page.evaluate((id) => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
    return [...tb.chunks.values()].some((c: any) => c.mesh && c.ranges.has(id));
  }, id), { timeout: 90_000 }).toBe(true);
  await page.waitForTimeout(1500);
}

/** A loaded building of this kind near the view centre. */
async function featureOfKind(page: Page, kind: 'ordinary' | 'generic') {
  return page.evaluate((kind) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map, tb = vm._threeBuildings;
    const c = map.getCenter();
    // Not a landmark's own building: those open the landmark card instead.
    const owned = new Set(g.landmarks.flatMap((l: any) => l.buildingIds ?? []).map(String));
    let best: { id: string; lngLat: [number, number]; d: number } | null = null;
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || key.startsWith('coarse:') || !chunk.mesh) continue;
      for (const f of chunk.source) {
        const p = f.properties || {};
        const k = p.largeTier ? 'largeTier' : p.kitWall ? 'kit' : typeof p.facade === 'string' ? 'ordinary' : 'generic';
        if (k !== kind || owned.has(String(p.id)) || !chunk.ranges.has(String(p.id)) || !/Polygon/.test(f.geometry?.type)) continue;
        const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        const [lng, lat] = ring[0];
        const d = Math.hypot(lng - c.lng, lat - c.lat);
        if (!best || d < best.d) best = { id: String(p.id), lngLat: [lng, lat], d };
      }
    }
    return best;
  }, kind);
}

test('a clicked building opens its card and lights up within budget, every kind', async ({ page }, info) => {
  test.setTimeout(600_000);
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const budget = BUDGET_MS[info.project.name] ?? 150;
  const results: Record<string, unknown> = {};

  const measure = async (label: string, id: string) => {
    await resident(page, id);
    const point = await roofPoint(page, id);
    expect(point, `${label} ${id} projects on screen`).not.toBeNull();
    if (info.project.name === 'iphone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await click(page, point!);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    results[label] = { id, ...r };
    return r;
  };

  // The reported tower: a card, its own highlight, inside the budget.
  await lookAt(page, TOWER.lngLat, 16.6, 55);
  const tower = await measure('tower', TOWER.id);
  await page.screenshot({ path: test.info().outputPath(`tower-card-${info.project.name}.png`) });

  const kinds: Record<string, any> = {};
  // A large-tier landmark block (the UvA PC Hoofthuis, Spuistraat).
  await lookAt(page, LARGE_TIER.lngLat);
  kinds.largeTier = await measure('largeTier', LARGE_TIER.id);
  (results.largeTier as any).tier = await page.evaluate((id) => {
    for (const c of (window as any).canalRecallGame.vectorMap._threeBuildings.chunks.values()) {
      const f = c.source.find((x: any) => String(x.properties.id) === id);
      if (f) return f.properties.largeTier ?? null;
    }
    return null;
  }, LARGE_TIER.id);
  await lookAt(page, WESTERMARKT);
  await page.waitForTimeout(4000);
  for (const kind of ['ordinary', 'generic'] as const) {
    const f = await featureOfKind(page, kind);
    if (!f) { results[kind] = 'none loaded'; continue; }
    await lookAt(page, f.lngLat);
    kinds[kind] = await measure(kind, f.id);
  }

  // Signature landmark and block-face chunk: GLB picking.
  for (const [label, match] of [['landmark', (s: any) => /Westerkerk/i.test(s.name || '')], ['streetChunk', WALLEN_CHUNK]] as const) {
    const spec = await page.evaluate((m) => {
      const sig = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      const specs = sig?.specs ?? sig?._specs ?? sig?.models ?? [];
      const found = (Array.isArray(specs) ? specs : []).find((s: any) => typeof m === 'string' ? s.id === m : new RegExp('Westerkerk', 'i').test(s.name || ''));
      return found ? { id: found.id, anchor: found.footprint?.centre ?? found.surveyed?.anchor } : null;
    }, typeof match === 'string' ? match : null);
    const anchor = spec?.anchor ?? (label === 'landmark' ? [4.88406, 52.37448] : [4.8975709552643085, 52.37297156134601]);
    await lookAt(page, anchor as [number, number], 17.4, 45);
    await expect.poll(() => page.evaluate(() => {
      const w = window as any, vm = w.canalRecallGame.vectorMap, sig = vm._signatureLandmarks, map = vm.map;
      const c = map.getCanvas();
      return !!sig?.inspectAtScreen(c.clientWidth / 2, c.clientHeight / 2, c.clientWidth, c.clientHeight);
    }), { timeout: 120_000 }).toBe(true);
    const point = await page.evaluate(() => { const c = (window as any).canalRecallGame.vectorMap.map.getCanvas(); return { x: c.clientWidth / 2, y: c.clientHeight / 2 }; });
    if (info.project.name === 'iphone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await click(page, point);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    results[label] = r;
    kinds[label] = r;
  }
  console.log(JSON.stringify({ project: info.project.name, before: !!process.env.BEFORE, results }, null, 1));
  if (process.env.BEFORE) return;

  expect(tower.card, 'the tower opens a card').not.toBeNull();
  expect(tower.lit, 'the tower itself lights up').toContain(TOWER.id);
  for (const [label, r] of Object.entries({ tower, ...kinds })) {
    expect(r.card, `${label}: card`).not.toBeNull();
    expect(r.cardMs, `${label}: card latency`).toBeLessThan(budget);
    expect(r.highlight, `${label}: highlight in the card's first frame`).not.toBe('none');
  }
});

// Every drawn building answers a click: sample the buildings on screen by kind
// (streamed ordinary/generic/large-tier/landmark-kit walls, signature GLBs and
// block-face chunks), click each through the game's own handler, and require
// a card. Occlusion may hand the click to a nearer building — that still has
// to open a card; a pick that lands behind the building aimed at is wrong.
test('every kind of drawn building opens a card when clicked', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one project samples the city');
  test.setTimeout(600_000);
  await boot(page);
  const summary: Record<string, { n: number; card: number; own: number; occluded: number; misses: string[] }> = {};
  for (const [label, centre] of [['westermarkt', WESTERMARKT], ['wallen', [4.8976, 52.3730]], ['tower', TOWER.lngLat]] as const) {
    await lookAt(page, centre as [number, number], 16.9, 50);
    await page.waitForTimeout(8000);
    const r = await page.evaluate(() => {
      const w = window as any, g = w.canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, sig = vm._signatureLandmarks, T = w.CanalRecallThree.THREE;
      const canvas = vm.map.getCanvas(), rect = g.canvas.getBoundingClientRect(), W = canvas.clientWidth, H = canvas.clientHeight;
      const kx = 111_320 * Math.cos(52.37 * Math.PI / 180);
      const samples: { kind: string; id: string; x: number; y: number; z: number; own: (hit: any) => boolean }[] = [];
      const onScreen = (x: number, y: number) => x > 30 && y > 60 && x < W - 30 && y < H * 0.6;
      const perKind: Record<string, number> = {};
      for (const [key, chunk] of tb.chunks) {
        if (key.startsWith('extras:') || !chunk.mesh) continue;
        const attr = chunk.mesh.geometry.getAttribute('hidden');
        for (const f of chunk.source) {
          const p = f.properties || {}, id = String(p.id), range = chunk.ranges.get(id);
          if (!range || !/Polygon/.test(f.geometry?.type)) continue;
          const hidden = attr?.getX(range.start);
          if (hidden > 0.5 && hidden < 1.5) continue;
          const kind = p.largeTier ? 'largeTier' : p.kitWall ? 'kit' : typeof p.facade === 'string' ? 'ordinary' : 'generic';
          if ((perKind[kind] = (perKind[kind] || 0)) >= 25) continue;
          const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
          let lng = 0, lat = 0; for (const [a, b] of ring) { lng += a; lat += b; } lng /= ring.length; lat /= ring.length;
          const z = (Number(p.height) || 10) * 0.9 + (chunk.lift?.applied?.get(id) ?? 0);
          const v = new T.Vector3((lng - 4.9) * kx, (lat - 52.37) * 110_540, z).applyMatrix4(chunk.mesh.matrixWorld).applyMatrix4(tb.camera.projectionMatrix);
          const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
          if (v.z < -1 || v.z > 1 || !onScreen(x, y)) continue;
          perKind[kind]++;
          samples.push({ kind, id, x, y, z: v.z, own: hit => String(hit.id) === id });
        }
      }
      for (const e of sig?._entries || []) {
        if (!e.pickProjection || !sig.canShowModel(e.spec) || !sig._nearby(e.spec, e.placement.anchor)) continue;
        // Buildings only: a memorial flush with the pavement (the Homomonument) is
        // reached through its POI label, not its mesh.
        if (e.spec.assetKind === 'memorial') continue;
        // A bounding-box centre can be open air (an L-shaped church, a flat
        // monument): aim at the first of a 3×3 grid of mid-height points that
        // lands on the model itself, as a player would.
        const box = new T.Box3().setFromObject(e.group), own = (hit: any) => hit && hit.lngLat === e.placement.anchor;
        let aim: { x: number; y: number; z: number } | null = null, first: typeof aim = null;
        for (const fx of [0.5, 0.3, 0.7]) for (const fy of [0.5, 0.3, 0.7]) {
          if (aim) break;
          const v = new T.Vector3(box.min.x + (box.max.x - box.min.x) * fx, box.min.y + (box.max.y - box.min.y) * fy, (box.min.z + box.max.z) / 2).applyMatrix4(e.pickProjection);
          const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
          if (v.z < -1 || v.z > 1 || !onScreen(x, y)) continue;
          first ??= { x, y, z: v.z };
          if (own(sig.inspectAtScreen(x, y, W, H))) aim = { x, y, z: v.z };
        }
        if (!(aim ?? first)) continue;
        samples.push({ kind: e.spec.chunkPands ? 'streetChunk' : e.spec.landmarkId ? 'landmarkModel' : 'houseModel', id: e.spec.id, ...(aim ?? first)!, own });
      }
      const out: Record<string, { n: number; card: number; own: number; occluded: number; misses: string[] }> = {};
      for (const s of samples) {
        g._clearLandmarkNotice();
        const hit = vm.inspectBuilding(s.x, s.y, { width: W, height: H });
        g._inspectBuildingAt(rect.left + s.x * rect.width / W, rect.top + s.y * rect.height / H);
        const o = out[s.kind] ??= { n: 0, card: 0, own: 0, occluded: 0, misses: [] };
        o.n++;
        if (g._landmarkNotice) o.card++; else if (o.misses.length < 5) o.misses.push(`no card ${s.id}→${hit ? hit.id : 'no hit'}`);
        // Picking another building is right only when it stands in front.
        if (hit && s.own(hit)) o.own++;
        else if (hit && hit.depth != null && hit.depth <= s.z + 1e-6) o.occluded++;
        else if (o.misses.length < 5) o.misses.push(`wrong ${s.id}→${hit ? hit.id : 'no hit'}`);
      }
      g._clearLandmarkNotice();
      return out;
    });
    for (const [kind, o] of Object.entries(r)) {
      const s = summary[kind] ??= { n: 0, card: 0, own: 0, occluded: 0, misses: [] };
      s.n += o.n; s.card += o.card; s.own += o.own; s.occluded += o.occluded; s.misses.push(...o.misses.map(m => `${label}:${m}`));
    }
  }
  console.log(JSON.stringify(summary, null, 1));
  for (const kind of ['ordinary', 'generic', 'kit', 'landmarkModel', 'streetChunk']) expect(summary[kind]?.n ?? 0, `${kind} sampled`).toBeGreaterThan(0);
  for (const [kind, s] of Object.entries(summary)) {
    expect(s.card / s.n, `${kind}: clicks that open a card ${JSON.stringify(s)}`).toBeGreaterThanOrEqual(0.95);
    expect((s.own + s.occluded) / s.n, `${kind}: clicks resolving to the building aimed at, or one in front of it ${JSON.stringify(s)}`).toBeGreaterThanOrEqual(0.95);
  }
});
