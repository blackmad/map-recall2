// Calls into the MapLibre-shaped CameraMap shim (engine/cameraMap.ts, P5 step B6) under ?engine=own, per calling bundle
// and function, over a ride: the count each participant move off the shim onto WorldCamera should take to zero.
//   PORT=4523 node scripts/camera-shim-calls.mjs [out.json] [--measure 20] [--qs '&x=1']
// BUNDLES_DIR=<dir> serves *.bundle.js from a local build. The rider is held forward (ArrowUp) in chase view.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/camera-shim/calls.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const measure = Number(opt('measure', '20'));
const port = process.env.PORT || 4523;

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
const errors = [];
page.on('pageerror', e => errors.push(String(e.message || e)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${port}/canal-drive/?engine=own${opt('qs', '')}`);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length > 2 && window.canalRecallGame.vectorMap?.cameraMap, null, { timeout: 120_000 });
// Count from boot on: wrap every method of the shim's prototype (and the `transform` getter) on the instance.
await page.evaluate(() => {
  const cm = canalRecallGame.vectorMap.cameraMap, C = window.__shimCalls = { on: true, calls: {} };
  const caller = () => {
    // The first frame outside this wrapper (evaluate-injected frames are the wrapper's own).
    const line = (new Error().stack || '').split('\n').slice(1).find(l => !l.includes('eval at evaluate')) || '';
    const m = /at (?:(\S+) )?\(?(?:.*\/)?([\w.-]+\.(?:js|ts))(?:\?[^:]*)?:\d+:\d+\)?/.exec(line);
    return m ? `${m[2]} ${m[1] || '<anon>'}` : line.trim();
  };
  const count = name => { if (!C.on) return; const k = `${name} <- ${caller()}`; C.calls[k] = (C.calls[k] || 0) + 1; };
  const proto = Object.getPrototypeOf(cm);
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const d = Object.getOwnPropertyDescriptor(proto, name);
    if (typeof d.value === 'function') { const f = d.value; cm[name] = function (...a) { count(name); return f.apply(this, a); }; }
    else if (d.get) Object.defineProperty(cm, name, { get() { count(name); return d.get.call(this); }, configurable: true });
  }
  C.calls = {};
});
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4, null, { timeout: 150_000, polling: 100 });
await page.evaluate(() => { window.__shimCalls.calls = {}; });
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(measure * 1000);
await page.keyboard.up('ArrowUp');
const calls = await page.evaluate(() => { window.__shimCalls.on = false; return window.__shimCalls.calls; });
await browser.close();
const byBundle = {}, byMethod = {};
for (const [k, n] of Object.entries(calls)) {
  const [method, from] = k.split(' <- '), bundle = from.split(' ')[0];
  byBundle[bundle] = (byBundle[bundle] || 0) + n;
  ((byMethod[bundle] ||= {})[method] = (byMethod[bundle][method] || 0) + n);
}
const perS = n => +(n / measure).toFixed(1);
console.log(`CameraMap shim calls over ${measure} s of riding (per second):`);
for (const [b, n] of Object.entries(byBundle).sort((a, b) => b[1] - a[1])) console.log(`  ${b.padEnd(36)} ${String(perS(n)).padStart(8)}/s  ${Object.entries(byMethod[b]).sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m} ${perS(c)}`).join(', ')}`);
for (const [k, n] of Object.entries(calls).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`    ${String(perS(n)).padStart(8)}/s  ${k}`);
if (errors.length) console.log('errors', errors.slice(0, 5));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), measure, byBundle, byMethod, calls, errors }, null, 1));
console.log('wrote', out);
