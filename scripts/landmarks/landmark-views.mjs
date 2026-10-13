// Usage: PORT=4445 node scripts/landmarks/landmark-views.mjs <id> <views.json> <outDir>
// Renders every view in views.json ([{name, light?, kind, ...}], see landmark-views.ts) of the installed GLB into
// <outDir>/<name>.png through a throwaway page public/canal-drive/_lv.html. Default views when views.json is '-':
// the gallery card (orbit theta .55, phi 1.02, gallery light), the same in game shading, and four game-shaded 3/4 orbits.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const [id, viewsFile, outDir] = process.argv.slice(2);
const port = process.env.PORT || 4445;
execFileSync('npx', ['esbuild', 'scripts/landmarks/landmark-views.ts', '--bundle', '--format=iife', '--log-level=warning', '--outfile=public/canal-drive/_lv.bundle.js'], {stdio: 'inherit'});
fs.writeFileSync('public/canal-drive/_lv.html', '<!doctype html><meta charset=utf-8><body><script src="_lv.bundle.js"></script>');
const views = viewsFile === '-' ? [
  {name: 'gallery-card', light: 'gallery', kind: 'orbit', theta: .55, phi: 1.02},
  {name: 'game-card', kind: 'orbit', theta: .55, phi: 1.02},
  ...[1, 2, 3].map(k => ({name: `game-orbit-${k}`, kind: 'orbit', theta: .55 + k * Math.PI / 2, phi: 1.15})),
] : JSON.parse(fs.readFileSync(viewsFile, 'utf8'));
fs.mkdirSync(outDir, {recursive: true});
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
for (const v of views) {
  const {name, light = 'game', w = 1200, hgt = 800, ...view} = v;
  const pg = await br.newPage({viewport: {width: w, height: hgt}});
  await pg.goto(`http://localhost:${port}/canal-drive/_lv.html?id=${id}&light=${light}&w=${w}&hgt=${hgt}&view=${encodeURIComponent(JSON.stringify(view))}`);
  await pg.waitForFunction(() => /^(done|error)/.test(document.title), null, {timeout: 60000});
  const title = await pg.title();
  if (title !== 'done') console.log(name, title);
  await pg.locator('canvas').screenshot({path: `${outDir}/${name}.png`});
  await pg.close();
  console.log(`${outDir}/${name}.png`);
}
await br.close();
