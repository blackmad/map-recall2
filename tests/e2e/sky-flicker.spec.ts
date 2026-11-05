import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { openRoute } from './helpers';

// The sky must not flicker (#216, lane E3). Under ?engine=own the frame host clears the canvas with three's
// `renderer.clear()`, which uses whatever gl.clearColor the context holds; between frames a precompile
// (SharedFrame.compile/compileAsync) ends in `renderer.resetState()`, which leaves gl.clearColor(0, 0, 0, 0). The next
// frame then cleared the sky to transparent and the page's cream background (#f4efe5) showed through: measured on this
// Mac in headed Chrome, 212 of 612 composited frames over a 20 s ride had a cream sky (240 blue/cream toggles).
// FrameHost re-asserts the sky clear colour (alpha 1) and the colour mask before each clear; `?skyClear=0` restores the
// old behaviour for A/B.
//
// Named pose: chase camera at its lowest (chasePitch=75, the most sky the chase shows), riding from the default
// route's start for 20 s, desktop. MapLibre is the reference.
//
//   PW_PORT=4622 npx playwright test sky-flicker --project=desktop          (add --headed to see the compositor)

const sharp = createRequire(import.meta.url)('sharp');
const RIDE_MS = 20_000;
/** The sky band: the top rows of the frame, sky in every frame of the named pose. */
const BAND_ROWS = 8;

/** Composited frames (CDP screencast: what the compositor presents, not the drawing buffer). */
async function screencast(page: Page, ms: number): Promise<Buffer[]> {
  const cdp = await page.context().newCDPSession(page);
  const frames: Buffer[] = [];
  cdp.on('Page.screencastFrame', (f: any) => {
    frames.push(Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await page.waitForTimeout(ms);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  return frames;
}

/** Per frame, the sky band's pixels that are not sky blue (the page background showing through a transparent sky). */
async function nonSkyBandPixels(frames: Buffer[]): Promise<number[]> {
  const out: number[] = [];
  for (const png of frames) {
    const meta = await sharp(png).metadata();
    const { data } = await sharp(png).extract({ left: 0, top: 0, width: meta.width, height: BAND_ROWS }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < data.length; i += 3) if (!(data[i + 2] > 180 && data[i + 2] - data[i] > 25)) n++;
    out.push(n);
  }
  return out;
}

/** Counts colour clears of the canvas made with a clear alpha below 1 or a colour channel masked off. */
async function watchClears(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any, renderer = w.canalRecallGame.vectorMap.host.renderer, gl = renderer.getContext();
    const out = w.__skyClears = { clears: 0, transparent: 0, masked: 0 };
    const clear = gl.clear.bind(gl);
    gl.clear = (bits: number) => {
      if ((bits & gl.COLOR_BUFFER_BIT) && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null) {
        out.clears++;
        if ((gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array)[3] < 1) out.transparent++;
        if ((gl.getParameter(gl.COLOR_WRITEMASK) as boolean[]).some(m => !m)) out.masked++;
      }
      return clear(bits);
    };
  });
}

async function hideHud(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas.engine-canvas, .maplibregl-canvas-container, .maplibregl-canvas-container * { visibility: visible !important; }' });
}

for (const engine of ['own', 'maplibre'] as const) {
  test(`sky: no flicker riding 20 s at the lowest chase pitch (${engine})`, async ({ page }) => {
    test.setTimeout(300_000);
    await openRoute(page, { query: `?engine=${engine}&chasePitch=75`, viewMode: 'chase' });
    await page.evaluate(() => { const p = (window as any).canalRecallGame.player; Object.assign(p, { speed: 0, vx: 0, vy: 0 }); });
    await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork?.().length ?? 0), { timeout: 120_000, intervals: [500] }).toBe(0);
    await hideHud(page);
    if (engine === 'own') await watchClears(page);

    // Standing still: the sky band is pixel-identical frame to frame.
    const still = await nonSkyBandPixels(await screencast(page, 3000));
    expect(Math.max(...still), 'standing still: the sky band is all sky').toBe(0);

    await page.keyboard.down('ArrowUp');
    const frames = await screencast(page, RIDE_MS);
    await page.keyboard.up('ArrowUp');
    const bad = await nonSkyBandPixels(frames);
    const badFrames = bad.filter(n => n > 0).length;
    const clears = engine === 'own' ? await page.evaluate(() => (window as any).__skyClears) : null;
    console.log(`[sky-flicker] ${engine}: ${frames.length} frames, ${badFrames} with a non-sky band (max ${Math.max(0, ...bad)} px)`, clears ? JSON.stringify(clears) : '');
    expect(frames.length, 'the screencast saw the ride').toBeGreaterThan(60);
    if (clears) {
      expect(clears.clears, 'the host cleared the canvas').toBeGreaterThan(60);
      expect(clears, 'every canvas clear is opaque sky with a full colour mask').toMatchObject({ transparent: 0, masked: 0 });
    }
    expect(badFrames, 'riding: the sky band is sky in every composited frame').toBe(0);
  });
}
