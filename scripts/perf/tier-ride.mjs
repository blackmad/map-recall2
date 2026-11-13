// Tier + ride frame rate (lane LS, 2026-11-13): boot the ride (either engine) at a given window size and pixel ratio,
// optionally with N CPU burners running until the ride starts (a busy machine at boot), then report the quality tier
// the own engine chose (probe, reasons, settings), the governor's steps, and the rAF intervals of a steady ride on rails
// (ping-pong along the race route, Geldersekade <-> Nieuwmarkt). The machine's load average goes with every number.
//
//   node scripts/perf/tier-ride.mjs <out.json> [--origin https://rideamsterdam.nl] [--engine own|maplibre]
//     [--w 1440] [--h 900] [--dpr 2] [--burn 0] [--burn-secs 0 (0 = until the ride starts)] [--warm 10] [--ride 30]
//     [--qs 'a=1'] [--headed] [--throttle 1 (CDP CPU throttle during boot only)]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const argv = process.argv.slice(2);
const out = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes(`--${k}`);
const origin = opt('origin', 'https://rideamsterdam.nl');
const engine = opt('engine', 'own');
const W = Number(opt('w', '1440')), H = Number(opt('h', '900')), DPR = Number(opt('dpr', '2'));
const burn = Number(opt('burn', '0')), burnSecs = Number(opt('burn-secs', '0'));
const warm = Number(opt('warm', '10')), ride = Number(opt('ride', '30'));
const throttle = Number(opt('throttle', '1'));
// --gpu-burn N: N extra pages in a second browser drawing a heavy full-screen shader every frame until the ride
// starts (other lanes' captures sharing the GPU).
const gpuBurn = Number(opt('gpu-burn', '0'));
const GPU_PAGE = `<canvas id=c style="width:100vw;height:100vh;display:block"></canvas><script>
const c=document.getElementById('c');c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;
const g=c.getContext('webgl2');const sh=(t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);return o};
const p=g.createProgram();g.attachShader(p,sh(g.VERTEX_SHADER,'#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}'));
g.attachShader(p,sh(g.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform float t;out vec4 o;void main(){vec2 q=gl_FragCoord.xy*.01;float v=0.;for(int i=0;i<200;i++){v+=sin(q.x*float(i)*.1+t)*cos(q.y+v);}o=vec4(v*.01);}'));
g.linkProgram(p);g.useProgram(p);const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);const u=g.getUniformLocation(p,'t');
const f=n=>{g.uniform1f(u,n*.001);for(let k=0;k<4;k++)g.drawArrays(g.TRIANGLES,0,3);requestAnimationFrame(f)};requestAnimationFrame(f);<\/script>`;
const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const hash = `#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;
const qs = `?travel=car${engine === 'own' ? '&engine=own' : ''}${opt('qs', '') ? `&${opt('qs', '')}` : ''}`;
const la = () => os.loadavg().map(v => +v.toFixed(1));
const log = { engineBundle: opt('engine-bundle', null), gpuBurn: Number(opt('gpu-burn', '0')), origin, engine, viewport: [W, H], dpr: DPR, burn, throttle, qs, loadAtStart: la() };

const burners = [];
const stopBurn = () => { while (burners.length) burners.pop().kill('SIGKILL'); };
process.on('exit', stopBurn);
for (let i = 0; i < burn; i++) burners.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
if (burn && burnSecs) setTimeout(stopBurn, burnSecs * 1000);

const browser = await chromium.launch({
  headless: !has('headed'),
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
});
let gpuBrowser = null;
if (gpuBurn) {
  gpuBrowser = await chromium.launch({ headless: !has('headed'), executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const gctx = await gpuBrowser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  for (let i = 0; i < gpuBurn; i++) { const gp = await gctx.newPage(); await gp.setContent(GPU_PAGE); }
}
const stopGpu = async () => { if (gpuBrowser) { const b = gpuBrowser; gpuBrowser = null; await b.close().catch(() => {}); } };
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.route(/ingest\.(us\.)?sentry\.io|google-analytics|googletagmanager/, r => r.fulfill({ status: 200, body: '{}' }));
// --engine-bundle <file>: serve this engine.bundle.js instead of the deployed one (a source change on the live site).
if (opt('engine-bundle', '')) await context.route(/\/canal-drive\/js\/engine\.bundle\.js(\?.*)?$/, r => r.fulfill({ path: opt('engine-bundle', ''), contentType: 'application/javascript' }));
const page = await context.newPage();
const tierLines = [];
page.on('console', m => { const t = m.text(); if (/quality tier|tier re-probe|retier/i.test(t)) tierLines.push(t); });
const cdp = await context.newCDPSession(page);
if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
const t0 = Date.now();
await page.goto(`${origin}/ride${qs}${hash}`, { waitUntil: 'commit' });
await page.waitForFunction(() => { const g = window.canalRecallGame; return g && g.state === 4 && (!g.camera || !g.camera.introOverview); }, null, { timeout: 180_000, polling: 500 });
log.rideStartS = (Date.now() - t0) / 1000;
log.loadAtRideStart = la();
if (!burnSecs) stopBurn();
await stopGpu();
if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const state = () => page.evaluate(() => {
  const w = window, vm = w.canalRecallGame?.vectorMap, p = w.__canalPerf ?? {};
  const gov = vm?._renderGovernor ?? vm?._ownView?._renderGovernor ?? null;
  let ratio = null; try { ratio = vm?.map?.getPixelRatio?.() ?? vm?.host?.getPixelRatio?.() ?? null; } catch (_) {}
  const probe = p.tierProbe ? { frameMs: p.tierProbe.frameMs, gpu: p.tierProbe.gpu, w: p.tierProbe.fill?.width, h: p.tierProbe.fill?.height } : null;
  return { tier: p.tier ?? null, reasons: p.tierReasons ?? null, settings: p.tierSettings ?? null, probe, tierHistory: p.tierHistory ?? null,
    pixelRatio: ratio, governorSteps: gov?.steps ?? null, canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })() };
});
log.atRideStart = await state();
// Rails: ping-pong along the race route at a steady speed; input ignored, questions do not hold the ride.
log.railPx = await page.evaluate((fin) => {
  const g = window.canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
  g._quizFreezesRide = () => false; p.handleInput = () => {};
  const world = (lat, lng) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
  const a = { x: p.x, y: p.y };
  let path = g.track.findRoute(a, world(fin[0], fin[1]));
  if (!path || path.length < 2) path = [a, { x: a.x + 3000, y: a.y }];
  const loop = [...path, ...path.slice(0, -1).reverse()];
  const cum = [0]; for (let k = 1; k < loop.length; k++) cum.push(cum[k - 1] + Math.hypot(loop[k].x - loop[k - 1].x, loop[k].y - loop[k - 1].y));
  const total = cum[cum.length - 1]; let at = 0, seg = 1; const v = 120;
  p.update = function (dt) {
    at += v * dt; if (at >= total) { at -= total; seg = 1; }
    while (seg < loop.length - 1 && cum[seg] < at) seg++;
    const s = loop[seg - 1], e = loop[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
    let d = Math.atan2(e.y - s.y, e.x - s.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.x = s.x + (e.x - s.x) * f; this.y = s.y + (e.y - s.y) * f; this.angle += d * Math.min(1, dt * 6);
    this.speed = v; this.vx = Math.cos(this.angle) * v; this.vy = Math.sin(this.angle) * v;
  };
  return Math.round(total);
}, FINISH);
await page.waitForTimeout(warm * 1000);
log.loadAtMeasure = la();
await page.evaluate(() => { const w = window; w.__lsFrames = []; let last = performance.now(); const tick = n => { w.__lsFrames.push(n - last); last = n; if (!w.__lsStop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.waitForTimeout(ride * 1000);
const frames = (await page.evaluate(() => { window.__lsStop = true; return window.__lsFrames.slice(1); }));
const s = [...frames].sort((x, y) => x - y), q = f => +(s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0).toFixed(1);
log.frames = { n: frames.length, fps: +(frames.length / (frames.reduce((x, y) => x + y, 0) / 1000)).toFixed(1), p50: q(0.5), p75: q(0.75), p95: q(0.95), p99: q(0.99), over33: frames.filter(f => f > 33.4).length, over50: frames.filter(f => f > 50).length, over100: frames.filter(f => f > 100).length, longest: +Math.max(0, ...frames).toFixed(1) };
// Per 5 s of riding: frames, p75 (does a slow stretch recover?).
{ const b = []; let acc = 0, cur = []; for (const f of frames) { cur.push(f); acc += f; if (acc >= 5000) { const c = [...cur].sort((x, y) => x - y); b.push({ n: cur.length, p75: +c[Math.floor(c.length * 0.75)].toFixed(1) }); cur = []; acc = 0; } } log.frameBuckets = b; }
log.hostStats = await page.evaluate(() => { const h = window.canalRecallGame?.vectorMap?.host; return h ? { ...h.stats, minFrameMs: h.minFrameMs } : null; }).catch(() => null);
log.loadAtEnd = la();
log.atEnd = await state();
log.tierLines = tierLines;
fs.writeFileSync(out, JSON.stringify(log, null, 1));
console.log(JSON.stringify({ engine, dpr: DPR, vp: [W, H], burn, gpuBurn, tier: log.atEnd.tier, probe: log.atRideStart.probe?.frameMs, ratioStart: log.atRideStart.pixelRatio, ratioEnd: log.atEnd.pixelRatio, steps: log.atEnd.governorSteps?.length, frames: log.frames, load: [log.loadAtStart[0], log.loadAtRideStart[0], log.loadAtEnd[0]], buckets: log.frameBuckets.map(x => x.p75).join(' '), renderMs: log.hostStats?.renderMs }));
await browser.close();
stopBurn();
