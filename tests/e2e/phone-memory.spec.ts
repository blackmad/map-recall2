import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Phone memory over a ride (2026-10-23, "crashing their phones"). Opt-in:
//   PERF_PHONE_MEMORY=1 PW_PORT=4391 npx playwright test phone-memory --project=iphone
// Samples every 5 s: JS heap, resident WebGL buffer and texture bytes (tracked
// by wrapping the WebGL2 upload/delete calls; estimates, 4 bytes/texel unless
// the format says otherwise) and the live object counts. With PHONE_HEAP=1 a
// sampling heap profile attributes the live heap at the end to allocation sites.
// RIDE_S=60 sets the ride length; PHONE_QUERY='?tileBudget=6' adds a query.
test.skip(!process.env.PERF_PHONE_MEMORY, 'set PERF_PHONE_MEMORY=1 to measure');

const GL_TRACKER = () => {
  const w = window as any;
  const sizes = new Map<object, number>();
  const bound = new WeakMap<object, Map<number, object | null>>();
  const tally = { buffers: 0, textures: 0, renderbuffers: 0, nBuffers: 0, nTextures: 0 };
  w.__glTally = tally;
  const bpp = (format: number, type: number) => {
    // RGBA8 default; half/float and depth formats are bigger, luminance smaller.
    if (type === 0x140b /* HALF_FLOAT */) return format === 0x1908 ? 8 : 4;
    if (type === 0x1406 /* FLOAT */) return format === 0x1908 ? 16 : 4;
    if (format === 0x1907 /* RGB */) return 3;
    if (format === 0x1903 || format === 0x1909 /* RED, LUMINANCE */) return 1;
    return 4;
  };
  const kinds: Array<[string, 'buffers' | 'textures']> = [];
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    const bindBuffer = proto.bindBuffer, bufferData = proto.bufferData, deleteBuffer = proto.deleteBuffer;
    const bindTexture = proto.bindTexture, texImage2D = proto.texImage2D as any, texStorage2D = (proto as any).texStorage2D, deleteTexture = proto.deleteTexture;
    const slot = (gl: object) => { let m = bound.get(gl); if (!m) bound.set(gl, m = new Map()); return m; };
    const set = (obj: object | null | undefined, bytes: number, kind: 'buffers' | 'textures', add = false) => {
      if (!obj) return;
      const before = sizes.get(obj);
      const next = add ? (before ?? 0) + bytes : bytes;
      if (before === undefined) tally[kind === 'buffers' ? 'nBuffers' : 'nTextures']++;
      tally[kind] += next - (before ?? 0);
      sizes.set(obj, next);
    };
    proto.bindBuffer = function (target: number, buffer: WebGLBuffer | null) { slot(this).set(target, buffer); return bindBuffer.call(this, target, buffer); };
    proto.bufferData = function (target: number, data: any, ...rest: any[]) {
      const bytes = typeof data === 'number' ? data : data?.byteLength ?? 0;
      set(slot(this).get(target), bytes, 'buffers');
      return (bufferData as any).call(this, target, data, ...rest);
    };
    proto.deleteBuffer = function (buffer: WebGLBuffer | null) {
      if (buffer && sizes.has(buffer)) { tally.buffers -= sizes.get(buffer)!; tally.nBuffers--; sizes.delete(buffer); }
      return deleteBuffer.call(this, buffer);
    };
    proto.bindTexture = function (target: number, texture: WebGLTexture | null) { slot(this).set(target, texture); return bindTexture.call(this, target, texture); };
    proto.texImage2D = function (this: any, ...args: any[]) {
      const [target, level] = args;
      let width = 0, height = 0, format = 0x1908, type = 0x1401;
      if (args.length >= 8) { width = args[3]; height = args[4]; format = args[6]; type = args[7]; }
      else { const src = args[5]; width = src?.width ?? src?.videoWidth ?? 0; height = src?.height ?? src?.videoHeight ?? 0; format = args[3]; type = args[4]; }
      const t = target >= 0x8515 && target <= 0x851a ? 0x8513 : target; // cube faces
      const bytes = width * height * bpp(format, type) * (level === 0 ? 1 : 0);
      if (bytes) set(slot(this).get(t), bytes, 'textures', t === 0x8513);
      return texImage2D.apply(this, args);
    };
    if (texStorage2D) (proto as any).texStorage2D = function (this: any, target: number, levels: number, _fmt: number, width: number, height: number) {
      set(slot(this).get(target), width * height * 4 * (levels > 1 ? 1.33 : 1), 'textures');
      return texStorage2D.apply(this, arguments as any);
    };
    proto.deleteTexture = function (texture: WebGLTexture | null) {
      if (texture && sizes.has(texture)) { tally.textures -= sizes.get(texture)!; tally.nTextures--; sizes.delete(texture); }
      return deleteTexture.call(this, texture);
    };
  }
  void kinds;
};

test('phone memory over a ride', async ({ page }, info) => {
  const rideS = Number(process.env.RIDE_S ?? 60);
  test.setTimeout(240_000 + rideS * 1000);
  await page.addInitScript(GL_TRACKER);
  // PHONE_KEEP_ARRAYS=1: the own ground keeps its vertex arrays (the pre-2026-10-23 behaviour).
  if (process.env.PHONE_KEEP_ARRAYS) await page.addInitScript(() => { (window as any).__canalRecallKeepGroundArrays = true; });
  const cdp = await page.context().newCDPSession(page);
  const heapProfile = !!process.env.PHONE_HEAP;
  if (heapProfile) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 65536 }); }
  await cdp.send('Performance.enable');
  // Live heap, not garbage: V8 on a desktop runner grows lazily, a phone does not.
  await cdp.send('HeapProfiler.enable');
  const sample = async (label: string) => {
    await cdp.send('HeapProfiler.collectGarbage');
    // ArrayBuffer backing stores (typed vertex arrays) are outside the JS heap figure.
    const usage = await cdp.send('Runtime.getHeapUsage') as { backingStorageSize?: number };
    const metrics = Object.fromEntries(((await cdp.send('Performance.getMetrics')) as any).metrics.map((m: any) => [m.name, m.value]));
    const gl = await page.evaluate(() => {
      const w = window as any, t = w.__glTally, vm = w.canalRecallGame?.vectorMap;
      // Geometry bytes held by drawn landmark models (shared geometry counted once).
      const seen = new Set<object>();
      let landmarkGeom = 0;
      for (const entry of vm?._signatureLandmarks?._entries ?? []) entry.group?.traverse?.((o: any) => {
        const g = o.geometry; if (!g || seen.has(g)) return; seen.add(g);
        for (const a of Object.values(g.attributes ?? {}) as any[]) landmarkGeom += a.array?.byteLength ?? 0;
        landmarkGeom += g.index?.array?.byteLength ?? 0;
      });
      return { ...t, tiles: vm?._buildingTiles?.status?.()?.tiles ?? null, landmarks: vm?._signatureLandmarks?.shown?.size ?? null, evicted: vm?._signatureLandmarks?.evictions ?? null, pixelRatio: vm?.map?.getPixelRatio?.() ?? null, landmarkGeomMB: Math.round(landmarkGeom / 1048576), ground: (() => { const g = vm?._ownGround?.status?.(); return g ? { radiusM: g.radiusM, cells: Object.keys(g.cells).length, lod0: Object.values(g.cells).filter((l: any) => l === 0).length, geometryMB: g.geometryMB, far: g.far.geometryMB, farRadiusM: g.far.radiusM } : null; })(), state: w.canalRecallGame?.state, player: w.canalRecallGame?.player ? [Math.round(w.canalRecallGame.player.x), Math.round(w.canalRecallGame.player.y)] : null };
    });
    const mb = (n: number) => Math.round(n / 1048576);
    const row = { label, heapMB: mb(metrics.JSHeapUsedSize), arrayBuffersMB: usage.backingStorageSize == null ? null : mb(usage.backingStorageSize), heapTotalMB: mb(metrics.JSHeapTotalSize), texturesMB: mb(gl.textures), buffersMB: mb(gl.buffers), nTextures: gl.nTextures, nBuffers: gl.nBuffers, nodes: metrics.Nodes, tiles: gl.tiles, landmarks: gl.landmarks, evicted: gl.evicted, pixelRatio: gl.pixelRatio, landmarkGeomMB: gl.landmarkGeomMB, ground: gl.ground, state: gl.state, player: gl.player };
    console.log(JSON.stringify(row));
    return row;
  };
  await page.goto(`/canal-drive/${process.env.PHONE_QUERY ?? ''}`);
  await page.waitForFunction(() => Boolean((window as any).canalRecallGame), null, { timeout: 90_000 });
  await page.waitForTimeout(3000);
  const rows = [await sample('setup')];
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.PHONE_QUERY ?? '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  rows.push(await sample('ride start'));
  await page.keyboard.down('ArrowUp');
  for (let s = 5; s <= rideS; s += 5) {
    await page.waitForTimeout(5000);
    rows.push(await sample(`ride ${s}s`));
  }
  await page.keyboard.up('ArrowUp');
  // PHONE_SHOT=<file.png>: what the rider sees at the end, to judge a budget's visual cost.
  if (process.env.PHONE_SHOT) await page.screenshot({ path: process.env.PHONE_SHOT });
  let sites: Array<{ site: string; liveMB: number }> = [];
  if (heapProfile) {
    const { profile } = await cdp.send('HeapProfiler.stopSampling') as any;
    const bySite = new Map<string, number>();
    const walk = (node: any) => {
      const f = node.callFrame;
      const key = `${f.functionName || '(anon)'} ${String(f.url).split('/').pop()}:${f.lineNumber}`;
      bySite.set(key, (bySite.get(key) ?? 0) + node.selfSize);
      for (const child of node.children ?? []) walk(child);
    };
    walk(profile.head);
    sites = [...bySite].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([site, bytes]) => ({ site, liveMB: +(bytes / 1048576).toFixed(1) }));
    for (const s of sites) console.log(`${String(s.liveMB).padStart(7)} MB  ${s.site}`);
  }
  mkdirSync('artifacts/perf', { recursive: true });
  writeFileSync(`artifacts/perf/phone-memory-${info.project.name}.json`, JSON.stringify({ query: process.env.PHONE_QUERY ?? '', rows, sites }, null, 2));
});
