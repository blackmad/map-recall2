// Usage: PORT=4397 node scripts/landmarks/worship-shots.mjs <id> <outDir> [az,az,...] [el]
// Renders an orbit of the installed GLB through the throwaway page public/canal-drive/_wl-render.html.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const [id, out, azs = '0,90,180,270', el = '22'] = process.argv.slice(2);
const port = process.env.PORT || 4397;
fs.mkdirSync(out, {recursive: true});
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const pg = await br.newPage({viewport: {width: 600, height: 450}});
for (const az of azs.split(',')) {
  await pg.goto(`http://localhost:${port}/canal-drive/_wl-render.html?id=${id}&az=${az}&el=${el}`);
  await pg.waitForFunction(() => /^(done|error)/.test(document.title), null, {timeout: 60000});
  await pg.waitForTimeout(600);console.log(az, (await pg.title()).slice(0,12));
  await pg.locator('canvas').screenshot({path: `${out}/${id}-az${az}.png`});
}
await br.close();
