/**
 * Thin-fade focal length (lane TF, 2026-11-13). look/thinFade.ts dithers out facade parts under 2 px across, measuring
 * px = thin_m * thinFocalPx / distance with one module-level uniform written before every facade draw from the drawing
 * camera and the pass height. Lane WG logged it at 48.9 in a house:frames pose where the main camera gives 293: the
 * height came from three's getDrawingBufferSize, which only setSize updates, and engine/frameHost.ts sizes the canvas
 * itself, so three kept the fresh canvas' 300 x 150 for life (0.652 x 150 / 2 = 48.9). Every thin part faded 6x
 * nearer than it should at 900 px, 12x at dpr 2: 14 cm speklagen went at ~20 m in first person.
 *
 * The probe wraps WebGL2 in the page (an init script; nothing in src/ changes): for each draw whose program has a
 * `thinFocalPx` uniform it reads the value the GPU will use, the program's projection (P11 = |row 1|, also for the
 * shared frame's P*V) and the viewport, so "uploaded" is what the draw sees, not what a material object holds.
 *
 *   PW_PORT=4669 npx playwright test tests/e2e/thin-focal.spec.ts --project=desktop
 *   TF_OUT=<dir> also writes the samples and frames; TF_LUMA=1 runs the Weteringschans luma measurement (not a gate).
 */
import { test, expect, devices, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { openRoute, settleWorld, useBundlesDir } from './helpers';

const FIXTURE = JSON.parse(readFileSync(resolve('tests/e2e/thin-focal.fixture.json'), 'utf8'));
const OUT = process.env.TF_OUT ?? '';
const CHASE_FOV = 36.86989764584402, FPS_FOV = 72;

type Sample = { kind: string; v: number; p11: number | null; vpH: number; vpW: number; fb: 'screen' | 'target'; dbH: number; prog: number };
type Probe = { on: boolean; samples: Sample[]; targetDraws: number; screenDraws: number };

/** The WebGL2 probe (an init script, so it sees every program three links). */
function installProbe(): void {
  const P = WebGL2RenderingContext.prototype as any;
  const st: any = { on: false, samples: [], max: 4000, targetDraws: 0, screenDraws: 0, progs: new WeakMap(), ids: new WeakMap(), next: 0, cur: null };
  (window as any).__tfProbe = st;
  const gul = P.getUniformLocation;
  P.getUniformLocation = function (prog: any, name: string) {
    const loc = gul.call(this, prog, name);
    if (loc && (name === 'thinFocalPx' || name === 'projectionMatrix')) {
      let e = st.progs.get(prog);
      if (!e) { st.progs.set(prog, e = {}); st.ids.set(prog, st.next++); }
      e[name] = loc;
    }
    return loc;
  };
  const up = P.useProgram;
  P.useProgram = function (prog: any) { st.cur = prog; return up.call(this, prog); };
  // look/thinFade.ts projectionFocal11: row 1 off its forward part, over |row 3| (MapLibre's homogeneous factor).
  const focal11 = (e: ArrayLike<number>) => {
    const w = Math.hypot(e[3], e[7], e[11]);
    if (!(w > 1e-12)) return Math.hypot(e[1], e[5], e[9]);
    const along = (e[1] * e[3] + e[5] * e[7] + e[9] * e[11]) / w;
    return Math.sqrt(Math.max(0, e[1] ** 2 + e[5] ** 2 + e[9] ** 2 - along * along)) / w;
  };
  const sample = (gl: WebGL2RenderingContext, kind: string) => {
    if (!st.on) return;
    const fb = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) ? 'target' : 'screen';
    if (fb === 'target') st.targetDraws++; else st.screenDraws++;
    const e = st.cur && st.progs.get(st.cur);
    if (!e?.thinFocalPx || st.samples.length >= st.max) return;
    const m = e.projectionMatrix ? gl.getUniform(st.cur, e.projectionMatrix) : null, vp = gl.getParameter(gl.VIEWPORT);
    st.samples.push({ kind, v: gl.getUniform(st.cur, e.thinFocalPx), p11: m ? focal11(m) : null, vpH: vp[3], vpW: vp[2], fb, dbH: gl.drawingBufferHeight, prog: st.ids.get(st.cur) });
  };
  for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
    const f = P[k]; if (!f) continue;
    P[k] = function (this: WebGL2RenderingContext, ...a: unknown[]) { sample(this, k); return f.apply(this, a); };
  }
  const ge = P.getExtension;
  P.getExtension = function (this: WebGL2RenderingContext, name: string) {
    const ext = ge.call(this, name);
    if (ext && name === 'WEBGL_multi_draw' && !ext.__tf) {
      ext.__tf = true;
      for (const k of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) {
        const f = ext[k]; if (f) ext[k] = (...a: unknown[]) => { sample(this, k); return f.apply(ext, a); };
      }
    }
    return ext;
  };
}

type Case = { name: string; camera: 'fps' | 'chase'; engine: 'own' | 'maplibre'; dpr: number; query?: string; context?: BrowserContextOptions };

async function openCase(browser: Browser, c: Case): Promise<Page> {
  const context = await browser.newContext(c.context ?? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: c.dpr });
  const page = await context.newPage();
  await page.addInitScript(installProbe);
  await useBundlesDir(page);
  const q = [c.engine === 'own' ? 'engine=own' : '', c.camera === 'fps' ? 'cam=fps' : '', c.query ?? ''].filter(Boolean).join('&');
  // 'relative' steering: the default 'street' mode turns a parked rider onto the street it stands on (a rider placed
  // near a junction faced Vijzelgracht, not the row); the camera is still the default chase.
  await openRoute(page, { travelMode: 'car', query: q ? `?${q}` : '', abortHeavyTiles: true, controlMode: c.camera === 'chase' ? 'relative' : undefined });
  await page.evaluate((fps) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    g.player.handleInput = () => {};
    if (fps) {
      if (!vm.fpsCameraOn()) vm.setFpsCamera(true);
      vm.solveFps = function (this: any) { const p = (window as any).__tfPose; this._lastFps = { pose: p, backM: 0, stuckId: null, elevation: 0 }; return p; };
    }
  }, c.camera === 'fps');
  await page.addStyleTag({ content: 'body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }' });
  return page;
}

async function place(page: Page, lngLat: [number, number], headingDeg: number, fps: unknown): Promise<void> {
  await page.evaluate(({ lngLat, headingDeg, fps }) => {
    const w = window as any, g = w.canalRecallGame, l = g.osmLoader;
    const mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180), ppm = 3;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * mLng * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = (headingDeg - 90) * Math.PI / 180;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    w.__tfPose = fps;
    g.state = 4;
  }, { lngLat, headingDeg, fps });
}

async function settle(page: Page, c: Case, lngLat: [number, number], headingDeg: number, fps: unknown, where: string): Promise<void> {
  await place(page, lngLat, headingDeg, fps);
  await page.waitForTimeout(1500);
  await place(page, lngLat, headingDeg, fps);
  if (c.engine === 'own') await settleWorld(page, where, 60_000);
  else await page.waitForTimeout(8000); // MapLibre: the chase camera eases in and the tiles stream; no worldSettled()
  await place(page, lngLat, headingDeg, fps);
  await page.waitForTimeout(800);
}

/** Record ~0.6 s of frames. */
async function record(page: Page): Promise<Probe> {
  await page.evaluate(() => { const st = (window as any).__tfProbe; st.samples = []; st.targetDraws = 0; st.screenDraws = 0; st.on = true; });
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; vm.host?.triggerRepaint?.(); vm.map?.triggerRepaint?.(); vm.settleTick?.(); });
    await page.waitForTimeout(100);
  }
  return page.evaluate(() => { const st = (window as any).__tfProbe; st.on = false; return { on: false, samples: st.samples, targetDraws: st.targetDraws, screenDraws: st.screenDraws }; });
}

const fovOf = (p11: number) => 2 * Math.atan(1 / p11) * 180 / Math.PI;

const CASES: Case[] = [
  { name: 'first-person own dpr1', camera: 'fps', engine: 'own', dpr: 1 },
  { name: 'first-person own dpr2', camera: 'fps', engine: 'own', dpr: 2 },
  { name: 'chase maplibre dpr1', camera: 'chase', engine: 'maplibre', dpr: 1 },
  { name: 'chase maplibre dpr2', camera: 'chase', engine: 'maplibre', dpr: 2 },
  { name: 'chase own dpr1', camera: 'chase', engine: 'own', dpr: 1 },
];

test.describe('thin-fade focal (lane TF)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('main-pass facade draws upload the main camera focal at the pass height (first person and chase, dpr 1 and 2)', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project only');
    test.setTimeout(CASES.length * 150_000);
    const report: Record<string, unknown>[] = [];
    for (const c of CASES) {
      const page = await openCase(browser, c);
      const fp = FIXTURE.fps171218At20m;
      const at: [number, number] = c.camera === 'fps' ? fp.lngLat : FIXTURE.chase.lngLat, heading = c.camera === 'fps' ? fp.headingDeg : FIXTURE.chase.headingDeg;
      await settle(page, c, at, heading, fp.fps, c.name);
      const probe = await record(page);
      const world = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings;
        return { baked: tb?.bakedEntries?.size ?? null, chunks: tb?.chunks?.size ?? null, worldCells: !!vm._completeCity?.usingWorldCells };
      }).catch(() => null);
      await page.context().close();
      const main = probe.samples.filter(s => s.fb === 'screen' && s.vpH === s.dbH && s.p11);
      const ratios = main.map(s => s.v / (s.p11! * s.vpH / 2));
      const fovs = [...new Set(main.map(s => +fovOf(s.p11!).toFixed(2)))];
      const kinds = [...new Set(main.map(s => s.kind))];
      const row = { case: c.name, samples: probe.samples.length, main: main.length, programs: new Set(main.map(s => s.prog)).size, kinds, vpH: [...new Set(main.map(s => s.vpH))], fovs, value: [...new Set(main.map(s => +s.v.toFixed(1)))].slice(0, 6), ratioMin: Math.min(...ratios), ratioMax: Math.max(...ratios), targetDraws: probe.targetDraws, screenDraws: probe.screenDraws, world };
      report.push(row);
      console.log(`thin-focal ${JSON.stringify(row)}`);
    }
    if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'focal-probe.json'), JSON.stringify(report, null, 1)); }
    for (const [i, row] of report.entries()) {
      const c = CASES[i], r = row as any;
      expect(r.main, `${c.name}: facade draws on the main pass`).toBeGreaterThan(0);
      expect(r.vpH, `${c.name}: one pass height`).toEqual([900 * c.dpr]);
      for (const f of r.fovs) expect(Math.abs(f - (c.camera === 'fps' ? FPS_FOV : CHASE_FOV)), `${c.name}: the main camera's lens (${f} deg)`).toBeLessThan(0.6);
      expect(r.ratioMin, `${c.name}: thinFocalPx / (P11 x pass height / 2), lowest`).toBeGreaterThan(0.99);
      expect(r.ratioMax, `${c.name}: highest`).toBeLessThan(1.01);
    }
  });

  test('171218 speklagen hold at 20 m in first person 72 deg (thinFade on == off on the wall)', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project only');
    test.setTimeout(600_000);
    const fp = FIXTURE.fps171218At20m, shots: Record<string, Buffer> = {};
    for (const fade of ['0', '1']) {
      const c: Case = { name: `171218 fps thinFade=${fade}`, camera: 'fps', engine: 'own', dpr: 1, query: `thinFade=${fade}` };
      const page = await openCase(browser, c);
      await settle(page, c, fp.lngLat, fp.headingDeg, fp.fps, c.name);
      shots[fade] = await page.screenshot({ type: 'png' });
      await page.context().close();
    }
    const raw = async (b: Buffer) => (await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
    const [off, on] = [await raw(shots['0']), await raw(shots['1'])];
    const W = off.info.width, b = fp.wallBoxCss, x0 = Math.round(b.x0), x1 = Math.round(b.x1), y0 = Math.round(b.y0), y1 = Math.round(b.y1);
    let n = 0, changed = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 3; n++;
      if (Math.max(Math.abs(off.data[i] - on.data[i]), Math.abs(off.data[i + 1] - on.data[i + 1]), Math.abs(off.data[i + 2] - on.data[i + 2])) > 24) changed++;
    }
    const pct = 100 * changed / Math.max(1, n);
    console.log(`thin-focal 171218 at 20 m: ${pct.toFixed(2)} % of ${n} wall px change with the fade (> 24 levels)`);
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, '171218-thinFade0.png'), shots['0']); writeFileSync(join(OUT, '171218-thinFade1.png'), shots['1']);
      writeFileSync(join(OUT, '171218.json'), JSON.stringify({ pct, n, changed, box: b }, null, 1));
    }
    // At 20 m a 14 cm speklaag is 4.3 px across at 619 px/m: solid. Before the fix the fade read 75 px/m (0.5 px): gone.
    expect(pct, 'thin parts of the 171218 front dissolve at 20 m (the focal is short)').toBeLessThan(0.5);
  });

  test('Weteringschans luma: eight fronts, chase, thinFade 0 vs default (measurement, TF_LUMA=1)', async ({ browser }, info) => {
    test.skip(!process.env.TF_LUMA, 'measurement: TF_LUMA=1');
    test.skip(info.project.name !== 'desktop', 'one run covers the phone context too');
    test.setTimeout(900_000);
    const variants: Array<{ name: string; context: BrowserContextOptions }> = [
      { name: 'desktop dpr1', context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
      { name: 'desktop dpr2', context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
      { name: 'phone (iPhone 13)', context: { ...devices['iPhone 13'] } },
    ];
    const fronts: string[] = FIXTURE.fronts, out: Record<string, unknown> = {};
    for (const v of variants) {
      const shots: Record<string, { png: Buffer; cells: Array<{ x: number; y: number; id: string }>; css: { w: number; h: number; dpr: number } }> = {};
      for (const fade of ['0', '1']) {
        const c: Case = { name: `${v.name} thinFade=${fade}`, camera: 'chase', engine: 'maplibre', dpr: Number(v.context.deviceScaleFactor ?? 1), query: `thinFade=${fade}`, context: v.context };
        const page = await openCase(browser, c);
        await settle(page, c, FIXTURE.chase.lngLat, FIXTURE.chase.headingDeg, null, c.name);
        const png = await page.screenshot({ type: 'png' });
        // Which front owns each 6 css px cell: the generic and tile pickers (vector-map.js inspectBuilding's surfaces),
        // walls only (the hit point under its building's height less 0.5 m; roofs read separately).
        const picked = await page.evaluate(({ ids, step }) => {
          const vm = (window as any).canalRecallGame.vectorMap, canvas = vm.map.getCanvas(), w = canvas.clientWidth, h = canvas.clientHeight;
          const want = new Set(ids.flatMap((id: string) => [id, `NL.IMBAG.Pand.${id}`]));
          const layers = [vm._threeBuildings, vm._tileBuildings].filter(Boolean);
          const cam = vm._threeBuildings?.camera, inv = cam ? cam.projectionMatrix.clone().invert() : null, V = (window as any).CanalRecallThree?.Vector3;
          const cells: Array<{ x: number; y: number; id: string }> = [];
          for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
            let best: any = null;
            for (const l of layers) { const hit = l.inspectAtScreen?.(x, y, w, h); if (hit && (!best || hit.depth < best.depth)) best = hit; }
            if (!best || !want.has(String(best.id))) continue;
            if (inv && V && best.height) {
              const p = new V(x / w * 2 - 1, 1 - y / h * 2, best.depth).applyMatrix4(inv);
              if (p.z > best.height - 0.5) continue;
            }
            cells.push({ x, y, id: String(best.id).replace('NL.IMBAG.Pand.', '') });
          }
          return { cells, css: { w, h, dpr: devicePixelRatio } };
        }, { ids: fronts, step: 6 });
        shots[fade] = { png, ...picked };
        await page.context().close();
      }
      // Mean OKLab L per front over the cells the default run picks as that front's wall (same pose both runs).
      const oklabL = (r: number, g: number, b: number) => {
        const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const R = lin(r), G = lin(g), B = lin(b);
        const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
        return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      };
      const meanL = async (png: Buffer, cells: Array<{ x: number; y: number; id: string }>, dpr: number) => {
        const { data, info: im } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const acc = new Map<string, { s: number; n: number; cells: number }>(), half = 3 * dpr;
        for (const c of cells) {
          const a = acc.get(c.id) ?? { s: 0, n: 0, cells: 0 }; a.cells++;
          for (let y = Math.round(c.y * dpr - half); y < Math.round(c.y * dpr + half); y++) for (let x = Math.round(c.x * dpr - half); x < Math.round(c.x * dpr + half); x++) {
            if (x < 0 || y < 0 || x >= im.width || y >= im.height) continue;
            const i = (y * im.width + x) * 3; a.s += oklabL(data[i], data[i + 1], data[i + 2]); a.n++;
          }
          acc.set(c.id, a);
        }
        return acc;
      };
      const dpr = shots['1'].css.dpr, cells = shots['1'].cells;
      const [l0, l1] = [await meanL(shots['0'].png, cells, dpr), await meanL(shots['1'].png, cells, dpr)];
      out[v.name] = fronts.map(id => {
        const short = id.replace(/^0363100012/, ''), a = l0.get(id), b = l1.get(id);
        return { pand: short, cells: a?.cells ?? 0, L_off: a ? +(a.s / a.n).toFixed(4) : null, L_on: b ? +(b.s / b.n).toFixed(4) : null, dL: a && b ? +((b.s / b.n) - (a.s / a.n)).toFixed(4) : null };
      });
      console.log(`thin-luma ${v.name} ${JSON.stringify(out[v.name])}`);
      if (OUT) { mkdirSync(OUT, { recursive: true }); for (const f of ['0', '1']) writeFileSync(join(OUT, `luma-${v.name.replace(/\W+/g, '-')}-thinFade${f}.png`), shots[f].png); }
    }
    if (OUT) writeFileSync(join(OUT, 'luma.json'), JSON.stringify(out, null, 1));
  });
});
