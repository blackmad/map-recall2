// Deterministic roof-street screenshots (no city streaming): bundles
// scripts/roof-street-view.ts and shoots each scene with Playwright's Chromium.
//   npx tsx scripts/roof-street-shots.ts <outDir> [scene[:view] ...]   scenes: canal c19 mixed; views: front side
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'artifacts/roof-street');
const scenes = process.argv.slice(3).length ? process.argv.slice(3) : ['canal', 'c19', 'mixed', 'mixed:side'];
mkdirSync(out, { recursive: true });
const bundle = await build({ entryPoints: ['scripts/roof-street-view.ts'], bundle: true, format: 'iife', write: false, minify: true });
writeFileSync(join(out, 'roof-street.js'), bundle.outputFiles[0].text);
writeFileSync(join(out, 'roof-street.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="roof-street.js"></script>');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
for (const s of scenes) {
  const [scene, view = 'front'] = s.split(':');
  await page.goto(`file://${join(out, 'roof-street.html')}?scene=${scene}&view=${view}`);
  await page.waitForFunction(() => (window as any).__done, null, { timeout: 60_000 });
  const file = join(out, `${scene}-${view}.png`);
  await page.screenshot({ path: file });
  console.log(file, (await page.evaluate(() => (window as any).__kinds)).join(' '));
}
await browser.close();
