/**
 * Proves scripts/world/browserMath.ts gives Chrome's Math.cos / Math.sin: replays a seeded sample (Amsterdam
 * latitudes in radians, angles over [-2pi, 2pi], small and odd values) in headless Chrome and counts the bits
 * that differ. Run under the browser lock:  /tmp/canal-pw.sh node --import tsx scripts/world/check-browser-math.ts
 * Exits 1 on any difference (the compiler's output would then not be the browser's).
 */
import { chromium } from 'playwright';
import { correctlyRoundedCos, correctlyRoundedSin, nativeMath } from './browserMath.js';

let seed = 0x5eed1234;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const xs: number[] = [0, -0, 1e-9, -1e-300, Math.PI, -Math.PI, Math.PI / 2, 0.5, 1, 2, 3, 6, 7, 12.5];
for (let i = 0; i < 120_000; i++) xs.push(0.9 + rand() * 0.03);                 // cos(lat): 51.6..53.3 degrees
for (let i = 0; i < 80_000; i++) xs.push((rand() * 2 - 1) * 2 * Math.PI);       // bearings, ring angles
const executablePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage();
  const got = await page.evaluate(xs => ({ ua: navigator.userAgent, cos: xs.map(Math.cos), sin: xs.map(Math.sin) }), xs);
  const row = (name: string, ours: (x: number) => number, theirs: number[]) => {
    let diff = 0, nativeDiff = 0; const sample: string[] = [];
    xs.forEach((x, i) => { if (!Object.is(ours(x), theirs[i])) { diff++; if (sample.length < 3) sample.push(`${name}(${x}) ours=${ours(x)} chrome=${theirs[i]}`); } if (!Object.is((nativeMath as any)[name](x), theirs[i])) nativeDiff++; });
    return { name, inputs: xs.length, differ: diff, nodeNativeDiffers: nativeDiff, sample };
  };
  const rows = [row('cos', correctlyRoundedCos, got.cos), row('sin', correctlyRoundedSin, got.sin)];
  console.log(JSON.stringify({ chrome: got.ua.match(/Chrome\/[\d.]+/)?.[0], node: process.versions.v8, rows }, null, 2));
  if (rows.some(r => r.differ)) process.exitCode = 1;
} finally { await browser.close(); }
