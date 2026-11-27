// Lane popin-colour (2026-11-27): does the city look's swap variant (citySwapUnder, SWAP_SLOTS vec4/4) compile and link
// on a phone-class WebGL? Loads ?engine=own in WebKit (Safari's engine, ANGLE on Metal like iOS) or Chromium with the
// iPhone 13 device, rides nowhere, and reports the GL limits, the programs three.js built, the swap uniform's length
// and any shader compile/link error.
//   PORT=4306 node scripts/swap-shader-check.mjs [webkit|chromium] [extra query]
import { webkit, chromium, devices } from 'playwright';
const which = process.argv[2] || 'webkit', extra = process.argv[3] || '';
const browser = await (which === 'webkit' ? webkit : chromium).launch();
const context = await browser.newContext({ ...devices['iPhone 13'], ...(which === 'webkit' ? {} : {}) });
const page = await context.newPage();
const errors = [];
page.on('console', m => { const t = m.text(); if (/Shader Error|Program Info Log|shader|GL_INVALID|link/i.test(t) && /error|fail/i.test(t)) errors.push(t.slice(0, 400)); });
page.on('pageerror', e => errors.push(`pageerror ${e.message.slice(0, 300)}`));
await page.goto(`http://127.0.0.1:${process.env.PORT || 4306}/canal-drive/?engine=own${extra ? `&${extra}` : ''}`);
await page.waitForFunction(() => !!window.canalRecallGame?.vectorMap?._sharedFrame?.renderer, null, { timeout: 240_000, polling: 500 });
// Chunks stream once the view settles; give them up to 120 s, then report whatever compiled.
await page.waitForFunction(() => { const tb = window.canalRecallGame.vectorMap._threeBuildings; return !!tb?.material && (tb.chunks?.size ?? 0) > 0; }, null, { timeout: 120_000, polling: 1000 }).catch(() => {});
await page.waitForTimeout(8000);
const r = await page.evaluate(() => {
  const vm = canalRecallGame.vectorMap, sf = vm._sharedFrame, renderer = sf.renderer, gl = renderer.getContext(), tb = vm._threeBuildings;
  // The swap variant compiles when a facade chunk first draws; force it here if none drew yet.
  const before = (renderer.info.programs ?? []).length;
  if (tb?.material && sf.camera) {
    try { const T = sf.THREE, sc = new T.Scene(); sc.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), tb.material)); renderer.compile(sc, sf.camera); } catch (e) { window.__compileErr = String(e); }
  }
  window.__forced = (renderer.info.programs ?? []).length - before;
  const programs = renderer.info.programs ?? [];
  const swapPrograms = programs.filter(p => /CITY_SWAP/.test(p.cacheKey ?? ''));
  const bad = programs.filter(p => { try { return !gl.getProgramParameter(p.program, gl.LINK_STATUS); } catch { return false; } }).length;
  return {
    ua: navigator.userAgent.slice(0, 80), webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    programs: programs.length, swapPrograms: swapPrograms.length, unlinked: bad,
    compileErr: window.__compileErr ?? null, forcedNewPrograms: window.__forced, swapLinked: programs.filter(p => /CITY_SWAP/.test(gl.getShaderSource?.(gl.getAttachedShaders(p.program)?.[0]) ?? '')).map(p => gl.getProgramParameter(p.program, gl.LINK_STATUS)), swapUniformLength: tb?.material?.uniforms?.citySwapUnder?.value?.length ?? null, complement: tb?.complement, chunks: tb?.chunks?.size, material: !!tb?.material, defines: Object.keys(tb?.material?.defines ?? {}).join(' '), cacheKeys: [...new Set(programs.map(p => String(p.name ?? '') ))].slice(0, 30),
  };
});
console.log(JSON.stringify({ which, ...r, errors }, null, 1));
await browser.close();
