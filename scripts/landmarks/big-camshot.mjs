// Usage: PORT=4454 node scripts/landmarks/big-camshot.mjs <id> <out.png> <x> <z> <heading> <fov> [eye=2.5] [pitch=0] [w=1600] [h=889]
// Camera-matched render of an installed GLB through the throwaway page public/canal-drive/_nl-cam.html (see big-camrender.ts).
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const [id, out, x, z, h, fov, eye = '2.5', pitch = '0', w = '1600', hg = '889'] = process.argv.slice(2);
const port = process.env.PORT || 4454;
fs.writeFileSync('public/canal-drive/_nl-cam.html', '<!doctype html><meta charset=utf-8><body><script src="_nl-cam.bundle.js"></script>');
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const pg = await br.newPage({viewport: {width: +w, height: +hg}});
await pg.goto(`http://localhost:${port}/canal-drive/_nl-cam.html?id=${id}&x=${x}&z=${z}&h=${h}&fov=${fov}&eye=${eye}&pitch=${pitch}&w=${w}&hgt=${hg}`);
await pg.waitForFunction(() => /^(done|error)/.test(document.title), null, {timeout: 60000});
console.log(await pg.title());
await pg.locator('canvas').screenshot({path: out});
await br.close();
