// 1200x630 share cards (og:image / twitter:image) for the landing page and the ride.
//   node scripts/landing/render-share-images.mjs <ride-frame.png> [landing-frame.png]
// Writes public/canal-drive/assets/landing/share-landing.jpg and share-ride.jpg:
// a real ride frame under the enamel title plaque, in the ride's own palette.
// CARDS=ride|landing renders one card only, so a fresh ride frame does not
// overwrite the landing card that was built from a different frame.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [frame, landingFrame = frame] = process.argv.slice(2);
if (!frame) throw new Error('usage: render-share-images.mjs <ride-frame.png> [landing-frame.png]');
const only = process.env.CARDS;
const out = 'public/canal-drive/assets/landing';
const enamel = fs.readFileSync('public/canal-drive/css/enamel.css', 'utf8');
const dataUri = (path) => `data:image/png;base64,${fs.readFileSync(path).toString('base64')}`;
const shots = { landing: dataUri(landingFrame), ride: dataUri(frame) };
const card = (title, line, shot) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&display=block" rel="stylesheet">
<style>${enamel}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:var(--day-paper)}
.bg{position:absolute;inset:0;background:url(${shot}) center/cover}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(244,239,229,1) 0%,rgba(244,239,229,1) 42%,rgba(244,239,229,0) 66%)}
.copy{position:absolute;left:64px;top:0;bottom:0;width:540px;display:flex;flex-direction:column;justify-content:center;gap:26px}
/* The trailing letter-space would push the ink left of centre; indent by half
   of it, and give the cap line symmetric padding (18/16 sat 2.5px high). */
.plaque{align-self:flex-start;padding:15px 30px 18px;font:800 46px/1 var(--font-plaque);letter-spacing:.08em;text-indent:.04em;text-transform:uppercase}
h1{margin:0;font:800 84px/.9 var(--font-plaque);text-transform:uppercase;color:var(--day-ink)}
h1 em{font-style:normal;color:var(--enamel)}
p{margin:0;font:600 30px/1.2 var(--font-plaque);color:var(--day-ink-muted);letter-spacing:.02em}
.url{position:absolute;right:28px;bottom:22px;padding:8px 14px;border-radius:6px;background:rgba(251,248,242,.92);font:700 24px/1 var(--font-plaque);letter-spacing:.06em;color:var(--day-accent-ink)}
</style></head><body><div class="bg"></div><div class="fade"></div>
<div class="copy"><div class="plaque enamel-plaque enamel-framed">Ride Amsterdam</div><h1>${title}</h1><p>${line}</p></div>
<div class="url">rideamsterdam.nl</div></body></html>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, title, line] of [
  ['share-landing', 'Learn Amsterdam <em>by name</em>', 'Ride the real canals and streets in 3D. Name each one before the map does.'],
  ['share-ride', 'Ride the real <em>canals</em>', 'Name each one before the map does.'],
]) {
  if (only && only !== name.replace('share-', '')) continue;
  const kind = name.replace('share-', '');
  await page.setContent(card(title, line, shots[kind]), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 });
  console.log(`${out}/${name}.jpg`, fs.statSync(`${out}/${name}.jpg`).size, 'bytes');
}
await browser.close();
