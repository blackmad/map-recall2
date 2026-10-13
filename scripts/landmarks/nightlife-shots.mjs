// Usage: PORT=4406 node scripts/landmarks/nightlife-shots.mjs <id> <outDir> [az,az,...] [el] [zoom]
// Renders an orbit of the installed GLB through the throwaway page public/canal-drive/_nl-render.html.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const [id, out, azs = '0,90,180,270', el = '22', zoom = '1', extra = ''] = process.argv.slice(2);
const port = process.env.PORT || 4406;
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync('public/canal-drive/_nl-render.html', '<!doctype html><meta charset=utf-8><body><script src="_nl-render.bundle.js"></script>');
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const pg = await br.newPage({viewport: {width: 600, height: 450}});
for (const az of azs.split(',')) {
  await pg.goto(`http://localhost:${port}/canal-drive/_nl-render.html?id=${id}&az=${az}&el=${el}&zoom=${zoom}${extra}`);
  await pg.waitForFunction(() => /^(done|error)/.test(document.title), null, {timeout: 60000});
  await pg.waitForTimeout(300); console.log(az, (await pg.title()).slice(0, 40));
  await pg.locator('canvas').screenshot({path: `${out}/${id}-az${az}.png`});
}
await br.close();
