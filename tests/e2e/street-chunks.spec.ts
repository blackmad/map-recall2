import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Street chunks (one mesh per block face, the default) vs ?streetChunks=0 (per-house models), same camera.
//   node --import tsx scripts/street-chunks/build.ts --install     (stages + installs the chunks)
//   PW_PORT=4403 npx playwright test street-chunks --project=desktop --project=iphone
// Each mode (off = ?streetChunks=0, per-house models; on = the default) screenshots the same free-camera views and
// records what the layer holds: entries, meshes, triangles, requests, suppression, hover resolution, frame times.
// SHARED_FRAME=1 repeats the run with ?sharedFrame=1 (one three.js frame for the page).
const OUT = process.env.SHARED_FRAME ? 'artifacts/street-chunks/in-game-shared' : 'artifacts/street-chunks/in-game';
const manifest = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8'));
// The largest per-house chunk (build.ts, `chunk-bilder-*`): authored block faces (`chunk-face-*`) have their own spec, block-face.spec.ts.
const chunk = manifest.chunks.filter((c: any) => c.id.startsWith('chunk-bilder-')).sort((a: any, b: any) => b.pands.length - a.pands.length)[0];

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number) => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};
const bearing = 90 + chunk.instance.northOffsetDegrees, outward = (bearing + 90) % 360;

async function parkAt(page: Page, at: number[], face: number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

for (const mode of ['off', 'on'] as const) {
  test(`street chunks ${mode}: ${chunk.name}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    const requests: string[] = [];
    page.on('request', r => { if (/\.glb/.test(r.url()) && /recipe-bilder|chunk-/.test(r.url())) requests.push(r.url().split('?')[0].split('/').pop()!); });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: [mode === 'off' ? 'streetChunks=0' : '', process.env.SHARED_FRAME ? 'sharedFrame=1' : ''].filter(Boolean).map((q, i, a) => (i ? '&' : '?') + q).join('') });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    const at = ahead(ahead(chunk.instance.anchor, bearing, -12), outward, 9);
    await parkAt(page, at, ahead(at, bearing, 40));
    const want = mode === 'on' ? [chunk.id] : chunk.replaces;
    await page.waitForFunction(({ want }) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
      const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
      return l && want.every((id: string) => l.shown.has(id));
    }, { want }, { timeout: 150_000, polling: 1000 });
    await parkAt(page, at, ahead(at, bearing, 40));
    await page.waitForTimeout(4000);

    // Rider (and its bike) well away from the shots; the layer keeps what the free camera sees.
    await parkAt(page, ahead(at, outward, 120), ahead(at, outward, 160));
    const views: [string, number, number, number][] = [['street', 30, 0, 9], ['oblique', 30, 55, 9], ['near', 14, 0, 6]];
    for (const [name, back, turn, height] of views) {
      const eye = ahead(ahead(chunk.instance.anchor, outward, back), bearing, turn ? -back * 1.1 : 0), target = ahead(chunk.instance.anchor, outward, -1);
      await page.evaluate(({ eye, target, height }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85);
        map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, height, { lng: target[0], lat: target[1] }, height));
      }, { eye, target, height });
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${OUT}/${mode}-${info.project.name}-${name}.png` });
    }

    // Layer contents (what the loader holds) for the chunk's pands.
    const layer = await page.evaluate(({ replaces, chunkId }) => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      const ids = new Set<string>([...replaces, chunkId]);
      const entries = l._entries.filter((e: any) => ids.has(e.spec.id));
      let meshes = 0, triangles = 0;
      for (const e of entries) e.group.traverse((o: any) => { if (o.isMesh) { meshes++; const g = o.geometry; triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3; } });
      return { entries: entries.length, meshes, triangles, houseShown: replaces.filter((id: string) => l.shown.has(id)).length, chunkShown: l.shown.has(chunkId),
        suppressed: l.shownSuppressOsmIds().length, sharedAssets: l._sharedAssets.size };
    }, { replaces: chunk.replaces, chunkId: chunk.id });

    // Hover: every pand of the chunk must resolve to its own BAG id from the street view.
    await page.evaluate(({ eye, target }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, 9, { lng: target[0], lat: target[1] }, 9));
    }, { eye: ahead(chunk.instance.anchor, outward, 60), target: ahead(chunk.instance.anchor, outward, -1) });
    await page.waitForTimeout(3000);
    const hover = await page.evaluate(({ pands, chunkId, replaces }) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks, THREE = (window as any).CanalRecallThree.THREE;
      const canvas = vm.map.getCanvas(), w = canvas.clientWidth, h = canvas.clientHeight;
      const results: any[] = [];
      for (const p of pands) {
        // Facade point of this pand in the chunk frame (mid-frontage, 5 m up), through the entry's own transform.
        const entry = l._entries.find((e: any) => e.spec.id === chunkId) ?? l._entries.find((e: any) => e.spec.id === `ordinary-${p.pandId}`);
        if (!entry || !entry.pickProjection) { results.push({ pand: p.buildingId, error: 'no entry' }); continue; }
        const isChunk = entry.spec.id === chunkId;
        const x = isChunk ? (p.frontage.x0 + p.frontage.x1) / 2 : 0;
        const v = new THREE.Vector3(x, 5, 0.05).applyMatrix4(entry.group.matrixWorld).applyMatrix4(entry.pickProjection);
        const px = (v.x + 1) / 2 * w, py = (1 - v.y) / 2 * h;
        if (px < 0 || py < 0 || px > w || py > h) { results.push({ pand: p.buildingId, offscreen: true }); continue; }
        const hit = l.inspectAtScreen(px, py, w, h);
        results.push({ pand: p.buildingId, hit: hit?.id ?? null, name: hit?.name ?? null, ok: hit?.id === p.buildingId });
      }
      return results;
    }, { pands: chunk.pands, chunkId: chunk.id, replaces: chunk.replaces });

    // Frame times with the camera at rest (the layer re-renders on every repaint).
    // Layer render cost: the custom layer's own render(), CPU submit time and with a GPU sync (gl.finish).
    const layerCost = await page.evaluate(async () => {
      const vm = (window as any).canalRecallGame.vectorMap, layer = vm._signatureLandmarks.layer, map = vm.map;
      if (!layer || vm._signatureLandmarks.sharedFrame) return null; // ?sharedFrame=1: no own custom layer to time
      const original = layer.render, submit: number[] = [], synced: number[] = [];
      layer.render = function (gl: WebGLRenderingContext, args: unknown) {
        const t0 = performance.now(); original.call(this, gl, args); const t1 = performance.now(); gl.finish(); const t2 = performance.now();
        submit.push(t1 - t0); synced.push(t2 - t0);
      };
      await new Promise<void>(resolve => { let n = 0; const tick = () => { map.triggerRepaint(); if (++n < 150) requestAnimationFrame(tick); else resolve(); }; tick(); });
      layer.render = original;
      const q = (v: number[], f: number) => { if (!v.length) return 0; const a = [...v].sort((x, y) => x - y); return +a[Math.floor(a.length * f)].toFixed(3); };
      const mean = (v: number[]) => +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3);
      return { frames: submit.length, submitMeanMs: mean(submit), syncedMeanMs: mean(synced), submitMedianMs: q(submit, 0.5), submitP95Ms: q(submit, 0.95), syncedMedianMs: q(synced, 0.5), syncedP95Ms: q(synced, 0.95) };
    });
    const frames = await page.evaluate(async () => {
      const map = (window as any).canalRecallGame.vectorMap.map, times: number[] = [];
      let last = performance.now();
      await new Promise<void>(resolve => {
        const tick = () => { const now = performance.now(); times.push(now - last); last = now; if (times.length < 90) { map.triggerRepaint(); requestAnimationFrame(tick); } else resolve(); };
        map.triggerRepaint(); requestAnimationFrame(tick);
      });
      times.shift(); times.sort((a, b) => a - b);
      return { medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * 0.95)], meanMs: times.reduce((s, t) => s + t, 0) / times.length };
    });
    const result = { mode, project: info.project.name, chunk: chunk.name, pands: chunk.pands.length, ...layer, glbRequests: requests.length, distinctGlb: new Set(requests).size, hover, frames, layerCost };
    console.log('street-chunks', JSON.stringify({ ...result, hover: hover.map((h: any) => (h.ok ? 'ok' : JSON.stringify(h))) }));
    writeFileSync(`${OUT}/${mode}-${info.project.name}.json`, JSON.stringify(result, null, 1));
    if (mode === 'on') {
      expect(result.chunkShown).toBe(true);
      expect(result.houseShown).toBe(0);
      expect(result.entries).toBe(1);
      expect(hover.filter((h: any) => h.ok).length).toBeGreaterThanOrEqual(Math.max(1, hover.filter((h: any) => !h.offscreen).length - 1));
    } else {
      expect(result.houseShown).toBe(chunk.replaces.length);
      expect(result.chunkShown).toBe(false);
    }
  });
}
