#!/usr/bin/env node
// Capture raw gameplay clips for the teaser and the landing-page loops.
//
//   PW_PORT=4472 bash /tmp/canal-pw.sh node scripts/teaser/capture.mjs [shot …]
//
// Shots (default: all): ride, boat, herengracht, quiz, explore, phone.
// Each writes artifacts/teaser/raw/<shot>.mp4 (+ .json with event marks: when
// a question appeared, when it was answered, when a card showed). Nothing is
// staged or faked: the rider is the game's own physics, steered along the
// game's own planned route, and every answer is a key press or a tap.
import { mkdirSync, writeFileSync } from 'node:fs';
import * as T from './lib.mjs';

const RAW = process.env.TEASER_RAW || 'artifacts/teaser/raw';
mkdirSync(RAW, { recursive: true });

/** Poll the game for events worth cutting on; answers questions as they come. */
function watchRide(page, rec, { answer = true, readMs = 1700, wrongEvery = 0, tap = false } = {}) {
  let stop = false, answered = 0, last = '';
  const seen = { landmark: '', hood: '', arrived: false };
  const loop = (async () => {
    while (!stop) {
      let s;
      try {
        s = await page.evaluate(() => {
          const g = window.canalRecallGame;
          const prompt = document.getElementById('canal-prompt');
          const input = document.getElementById('canal-answer');
          return {
            q: g.quizPromptName || '', kind: g.quizPromptKind || '',
            visible: !!prompt && getComputedStyle(prompt).display !== 'none',
            choices: g._choiceOrder || [],
            typing: !!input && getComputedStyle(input).display !== 'none',
            landmark: g._landmarkNotice?.name || '',
            hood: g._neighborhoodNoticeTimer > 0 ? (g._neighborhoodNotice?.name || '') : '',
            state: g.state,
          };
        });
      } catch { break; }
      if (s.landmark && s.landmark !== seen.landmark) rec.mark(`landmark:${s.landmark}`);
      if (s.hood && s.hood !== seen.hood) rec.mark(`hood:${s.hood}`);
      seen.landmark = s.landmark; seen.hood = s.hood;
      if (s.state === 5 && !seen.arrived) { seen.arrived = true; rec.mark('arrived'); }
      if (answer && s.q && s.visible && s.q !== last) {
        last = s.q;
        rec.mark(`question:${s.kind}:${s.q}`);
        await T.sleep(readMs);
        const wrong = wrongEvery > 0 && (answered % wrongEvery) === wrongEvery - 1;
        try {
          if (s.typing) {
            await page.locator('#canal-answer').focus();
            await page.keyboard.type(wrong ? 'Kalverstraat' : s.q, { delay: 60 });
            await page.keyboard.press('Enter');
          } else {
            const idx = wrong ? s.choices.findIndex(c => c !== s.q) : s.choices.indexOf(s.q);
            const button = page.locator('#canal-choices .canal-choice').filter({ hasText: s.choices[idx] }).first();
            if (tap && idx >= 0 && await button.count()) await button.tap();
            else if (idx >= 0) await page.keyboard.press(`Digit${idx + 1}`);
          }
          rec.mark(`answered:${s.q}`);
          answered++;
        } catch {}
      }
      if (!s.q) last = '';
      await T.sleep(150);
    }
  })();
  return { async stop() { stop = true; await loop; } };
}

async function rideShot(name, { start, finish, travel = 'car', intro = false, seconds = 60, cruise = 150, mobile = false, viewport, query = '', beforeRide, duringRide, settleMs = 5000, scale = 1, zoomIn = 0 }) {
  const browser = await T.launch();
  const page = await T.newPage(browser, viewport ? { ...viewport, mobile, dpr: scale } : {});
  try {
    await T.bootRide(page, { start, finish, travel, intro, waitIntro: false, query });
    let rec;
    if (intro) {
      // The flight starts the moment the route is ready: record from boot.
      rec = await T.startRecording(page, `${RAW}/${name}-frames`, { scale });
      rec.mark('boot');
      await page.waitForFunction(() => !!window.canalRecallGame._intro, null, { timeout: 60_000, polling: 'raf' }).catch(() => {});
      rec.mark('intro');
      await T.waitRacing(page);
      rec.mark('racing');
    } else {
      await T.waitRacing(page);
      await T.settle(page, settleMs);
      if (zoomIn) { const vp = page.viewportSize(); await page.mouse.move(vp.width / 2, vp.height / 2); await page.keyboard.down('Control'); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -zoomIn / 6); await T.sleep(60); } await page.keyboard.up('Control'); await T.sleep(1500); }
      if (beforeRide) await beforeRide(page);
      rec = await T.startRecording(page, `${RAW}/${name}-frames`, { scale });
      rec.mark('racing');
    }
    await T.startAutopilot(page, { cruise });
    const watcher = watchRide(page, rec, { tap: mobile });
    if (duringRide) await duringRide(page, rec);
    else await T.sleep(seconds * 1000);
    await watcher.stop();
    await rec.stop(`${RAW}/${name}.mp4`);
  } finally {
    await browser.close();
  }
}


async function quizShot(name, { viewport, mobile = false, scale = 1 } = {}) {
  const browser = await T.launch();
  const page = await T.newPage(browser, viewport ? { ...viewport, mobile, dpr: scale } : {});
  const base = process.env.TEASER_QUIZ_URL || 'https://rideamsterdam.nl/quiz/';
  await page.goto(`${base}?city=amsterdam&mode=guess_name&category=water&radius=4500&rounds=5`);
  await page.waitForSelector('text=Which canal', { timeout: 30_000 }).catch(() => {});
  await T.sleep(4000);
  const rec = await T.startRecording(page, `${RAW}/${name}-frames`, { scale });
  for (let round = 0; round < 3; round++) {
    await T.sleep(2200);
    // The right answer, read from the overlay's own props (React fiber).
    const answer = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /^\d\s*\S/.test(b.textContent.trim()));
      if (!btn) return null;
      let f = btn[Object.keys(btn).find(k => k.startsWith('__reactFiber$'))];
      while (f) { if (f.memoizedProps?.currentFeature?.name) return f.memoizedProps.currentFeature.name; f = f.return; }
      return null;
    });
    console.log('quiz answer', answer);
    rec.mark(`quiz-question:${answer}`);
    const choice = page.locator('button', { hasText: answer || '\u0000' }).first();
    if (answer && await choice.count()) {
      if (mobile) await choice.tap();
      else {
        const box = await choice.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
        await T.sleep(300);
        await choice.click();
      }
    }
    rec.mark(`quiz-answered:${answer}`);
    await T.sleep(3200);
    const next = page.locator('button', { hasText: /Next|Continue|See results/i }).first();
    if (await next.count()) await (mobile ? next.tap() : next.click()).catch(() => {});
    await T.sleep(800);
  }
  await rec.stop(`${RAW}/${name}.mp4`);
  await browser.close();
}

async function exploreShot(name, { viewport, mobile = false, scale = 1 } = {}) {
  const browser = await T.launch();
  const page = await T.newPage(browser, viewport ? { ...viewport, mobile, dpr: scale } : {});
  await page.goto(`${T.BASE}/canal-drive/explore.html?buurt=Grachtengordel`);
  await page.locator('body[data-map-ready="1"]').waitFor({ state: 'attached', timeout: 30_000 });
  await T.sleep(4000);
  const rec = await T.startRecording(page, `${RAW}/${name}-frames`, { scale });
  await T.sleep(1500);
  const search = page.locator('#search');
  if (await search.isVisible()) {
    if (mobile) await search.tap(); else await search.click();
    await page.keyboard.type('wester', { delay: 120 });
    await T.sleep(1200);
    const row = page.locator('#results .row').first();
    if (mobile) await row.tap(); else await row.click();
  } else {
    await page.goto(`${T.BASE}/canal-drive/explore.html?buurt=Grachtengordel&model=westerkerk`);
  }
  rec.mark('opened');
  await page.locator('#stage[data-state="ready"]').waitFor({ timeout: 30_000 }).catch(() => {});
  rec.mark('ready');
  // Turn the model by dragging the stage.
  const stage = await page.locator('#stage canvas').boundingBox().catch(() => null);
  if (stage) {
    const cx = stage.x + stage.width / 2, cy = stage.y + stage.height / 2;
    const step = stage.width / 100;
    await page.mouse.move(cx + step * 20, cy);
    await page.mouse.down();
    for (let i = 0; i <= 90; i++) { await page.mouse.move(cx + step * 20 - i * step, cy - Math.sin(i / 30) * 10); await T.sleep(30); }
    await page.mouse.up();
  }
  await T.sleep(2500);
  await rec.stop(`${RAW}/${name}.mp4`);
  await browser.close();
}

// The vertical cut is filmed in a phone-shaped viewport that fills its window exactly.
const VERTICAL = { viewport: { width: 397, height: 632 }, mobile: true, scale: 2.5 };

const SHOTS = {
  // Bike down the Prinsengracht from the Westerkerk towards the Rijksmuseum,
  // opening on the real start-of-ride overview flight.
  ride: () => rideShot('ride', { start: [52.37660, 4.88445], finish: [52.36000, 4.88520], intro: true, seconds: 70 }),
  // Boat up the Amstel under the Magere Brug.
  boat: () => rideShot('boat', { start: [52.36760, 4.90020], finish: [52.35870, 4.90430], travel: 'boat', seconds: 30, cruise: 170, zoomIn: 250 }),
  // Boat along the Herengracht: canal houses both sides.
  herengracht: () => rideShot('herengracht', { start: [52.38000, 4.88950], finish: [52.36560, 4.89150], travel: 'boat', seconds: 70, cruise: 170, zoomIn: 250 }),
  // The Map Quest quiz, from the live site (its basemap needs the production key).
  quiz: () => quizShot('quiz'),
  // The explorer: pick the Westerkerk and turn it in 3D.
  explore: () => exploreShot('explore'),
  // The phone layout: a short bike ride, questions answered by tapping.
  vride: () => rideShot('vride', { start: [52.37660, 4.88445], finish: [52.36000, 4.88520], intro: true, seconds: 70, ...VERTICAL }),
  vboat: () => rideShot('vboat', { start: [52.36760, 4.90020], finish: [52.35870, 4.90430], travel: 'boat', seconds: 22, cruise: 170, settleMs: 9000, ...VERTICAL }),
  vquiz: () => quizShot('vquiz', VERTICAL),
  vexplore: () => exploreShot('vexplore', VERTICAL),
  // Landing-page loops, filmed at the hero image's 16:10 so the HUD lays itself out for it.
  lride: () => rideShot('lride', { start: [52.37660, 4.88445], finish: [52.36000, 4.88520], intro: true, seconds: 30, viewport: { width: 1280, height: 800 } }),
  lboat: () => rideShot('lboat', { start: [52.36760, 4.90020], finish: [52.35870, 4.90430], travel: 'boat', seconds: 16, cruise: 170, viewport: { width: 1280, height: 800 } }),
  phone: () => rideShot('phone', { start: [52.37200, 4.88510], finish: [52.36500, 4.88800], seconds: 40, viewport: { width: 390, height: 844 }, mobile: true, cruise: 140, scale: 2, settleMs: 9000 }),
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
for (const name of wanted) {
  if (!SHOTS[name]) { console.error(`unknown shot ${name}`); process.exitCode = 1; continue; }
  const t0 = Date.now();
  console.log(`== ${name}`);
  try { await SHOTS[name](); } catch (e) { console.error(`shot ${name} failed:`, e); process.exitCode = 1; }
  console.log(`== ${name} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(`${RAW}/.captured`, new Date().toISOString());
