import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

// Diagnostic capture for lane E3 (#216; the pinned check is sky-flicker.spec.ts): 20 s of composited frames (CDP screencast, i.e. what the compositor
// presents, not the drawing buffer) at a sky-heavy pose. Env:
//   SKY_ENGINE=own|maplibre  SKY_QUERY='&renderOnChange=0'  SKY_POSE=chase|overview  SKY_RIDE=1  SKY_SECONDS=20
//   SKY_OUT=<dir> (frames + frames.json)
const ENGINE = process.env.SKY_ENGINE ?? 'own';
const OUT = process.env.SKY_OUT ?? '';
const SECONDS = Number(process.env.SKY_SECONDS ?? 20);
const POSE = process.env.SKY_POSE ?? 'chase';
const RIDE = process.env.SKY_RIDE === '1';

async function screencast(page: Page, seconds: number): Promise<Array<{ t: number; data: Buffer }>> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const frames: Array<{ t: number; data: Buffer }> = [];
  cdp.on('Page.screencastFrame', (f: any) => {
    frames.push({ t: f.metadata.timestamp, data: Buffer.from(f.data, 'base64') });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 1440, maxHeight: 900 });
  await page.waitForTimeout(seconds * 1000);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  return frames;
}

test('sky capture', async ({ page }) => {
  test.skip(!process.env.SKY_OUT, 'diagnostic: set SKY_OUT to capture');
  test.setTimeout(600_000);
  const query = `?engine=${ENGINE}&chasePitch=75${process.env.SKY_QUERY ?? ''}`;
  await openRoute(page, { query, viewMode: 'chase' });
  await page.evaluate(() => { const p = (window as any).canalRecallGame.player; Object.assign(p, { speed: 0, vx: 0, vy: 0 }); });
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.pendingWork?.().length ?? 0; }), { timeout: 120_000, intervals: [500] }).toBe(0);
  if (POSE === 'overview') {
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map ?? vm.cameraMap;
      g.state = 1; // not racing: the follow camera lets go
      map.jumpTo({ zoom: 14, pitch: 75, bearing: 30 });
    });
    await page.waitForTimeout(8000);
  } else {
    await page.waitForTimeout(3000);
  }
  // HUD off: only the map's canvas changes the sky.
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas.engine-canvas, canvas.maplibregl-canvas, .engine-canvas *, .maplibregl-canvas-container, .maplibregl-canvas-container * { visibility: visible !important; }' });
  if (RIDE) await page.keyboard.down('ArrowUp');
  const statsBefore = await page.evaluate(() => { const h = (window as any).canalRecallGame.vectorMap.host; return h ? { ...h.stats } : null; });
  const frames = await screencast(page, SECONDS);
  const statsAfter = await page.evaluate(() => { const h = (window as any).canalRecallGame.vectorMap.host; return h ? { ...h.stats, pr: h.getPixelRatio() } : null; });
  if (RIDE) await page.keyboard.up('ArrowUp');
  mkdirSync(OUT, { recursive: true });
  frames.forEach((f, i) => writeFileSync(join(OUT, `f${String(i).padStart(4, '0')}.png`), f.data));
  writeFileSync(join(OUT, 'frames.json'), JSON.stringify({ query, pose: POSE, ride: RIDE, statsBefore, statsAfter, t: frames.map(f => f.t) }, null, 1));
  console.log(`captured ${frames.length} frames to ${OUT}`, JSON.stringify({ statsBefore, statsAfter }));
});

// SKY_PROBE=1: GL-level probe. Counts host colour clears of the default framebuffer made under a colour write mask
// with a channel off (gl.clear honours the mask), and names the last draw before each such clear.
test('sky probe', async ({ page }) => {
  test.skip(process.env.SKY_PROBE !== '1');
  test.setTimeout(600_000);
  await openRoute(page, { query: `?engine=own&chasePitch=75${process.env.SKY_QUERY ?? ''}`, viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork?.().length ?? 0), { timeout: 120_000, intervals: [500] }).toBe(0);
  await page.evaluate(() => {
    const w = window as any, host = w.canalRecallGame.vectorMap.host, renderer = host.renderer, gl = renderer.getContext();
    const out = w.__skyProbe = { clears: 0, masked: 0, alphaLow: 0, lastDraws: {} as Record<string, number>, draws: 0 };
    let last = '';
    const rbd = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera: any, scene: any, geometry: any, material: any, object: any, group: any) => {
      last = `${object.name || object.type}|${material.name || material.type}|cw=${material.colorWrite}`;
      out.draws++;
      return rbd(camera, scene, geometry, material, object, group);
    };
    const clear = gl.clear.bind(gl);
    gl.clear = (bits: number) => {
      if ((bits & gl.COLOR_BUFFER_BIT) && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null) {
        out.clears++;
        const mask = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];
        const cc = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
        if (mask.some(m => !m)) { out.masked++; out.lastDraws[last] = (out.lastDraws[last] ?? 0) + 1; }
        if (cc[3] < 1) out.alphaLow++;
      }
      return clear(bits);
    };
  });
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(20_000);
  await page.keyboard.up('ArrowUp');
  const probe = await page.evaluate(() => (window as any).__skyProbe);
  console.log('SKYPROBE', JSON.stringify(probe));
});
