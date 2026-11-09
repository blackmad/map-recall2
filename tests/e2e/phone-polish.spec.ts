import { expect, type Page, test } from '@playwright/test';
import { openRoute } from './helpers';

// Phone polish round 2 (#292). Measured on the iphone project, 1 canvas unit = 1 CSS px:
//  1. a drive-by card with a photo keeps clear of the bike at 390x664 and 414x896;
//  2. the arrival card's footer line (personal best · difficulty · profile · view) is never cut mid-list, en and nl;
//  3. the STAMPED seal never overlaps the buurt name on the stamp postcard, for the longest names in the pool.
// Set PHONE_POLISH_SHOTS=<dir> to save frames.

const SHOTS = process.env.PHONE_POLISH_SHOTS || '';
const SIZES = [{ width: 414, height: 896 }, { width: 390, height: 664 }];
const LONG_NAMES = ['Prinses Irenebuurt e.o.', 'Oostelijk Havengebied', 'Marineterrein', 'Weesperbuurt'];

async function setLanguage(page: Page, language: string) {
  await page.addInitScript((lang: string) => {
    try { if (!sessionStorage.getItem('l292')) { sessionStorage.setItem('l292', '1'); localStorage.setItem('canalRecall.language.v1', lang); } } catch { /* */ }
  }, language);
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('drive-by photo card clears the bike', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
      test.setTimeout(180_000);
      await openRoute(page, { travelMode: 'car', query: '?landmarkQuestions=1', controlMode: 'street' });
      await page.evaluate(() => {
        const g = (window as any).canalRecallGame;
        const landmark = g.landmarks.find((l: any) => l.name === 'Concertgebouw') ?? g.landmarks.find((l: any) => l.name === 'Westerkerk');
        g._landmarkSightingsCache = {};
        try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); } catch { /* */ }
        g.quizFeedback = ''; g.maxAsksPerMinute = 0;
        g.input._showTouchHint = true; g.input._touchHintTimer = 60;
        g._showLandmarkNotice(landmark, { kind: 'sticky' }, 'drive-by');
        g._landmarkNoticeAlpha = 1; g._landmarkNoticeState.elapsed = 1;
      });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const g = (window as any).canalRecallGame;
        const rect = g.canvas.getBoundingClientRect();
        const k = rect.height / g.viewport.height;
        const v = g.camera.worldToScreen(g.player.x, g.player.y);
        const c = g._landmarkCardBounds;
        return { cardTop: rect.top + c.y * k, cardBottom: rect.top + (c.y + (c.h ?? c.height)) * k, bikeY: rect.top + v.y * k, photo: !!g._landmarkNoticeImage || !!g._landmarkNotice?.image, vh: window.innerHeight };
      });
      console.log('L292 driveby', size.width, size.height, JSON.stringify(m));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/driveby-${size.width}x${size.height}.png` });
      expect(m.cardTop, 'the card starts below the bike (bike y + 20)').toBeGreaterThan(m.bikeY + 20);
    });

    test('postcard: the STAMPED seal clears the longest buurt names', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
      test.setTimeout(180_000);
      await page.goto('/canal-drive/?ride=free');
      await page.waitForFunction(() => !!(window as any).CanalRecallCards && !!(window as any).CanalRecallUi);
      const rows = await page.evaluate((names) => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        const measure = (t: string, f: string) => { ctx.font = f; return ctx.measureText(t).width; };
        const W = (window as any).CanalRecallUi.postcardWidth({ mode: 'compact', orientation: 'portrait', width: window.innerWidth, height: window.innerHeight, safeBottom: 0, safeTop: 0, safeLeft: 0, safeRight: 0 });
        const out: any[] = [];
        for (const hasImage of [true, false]) for (const name of names) {
          const card = (window as any).CanalRecallCards.measurePostcard({ name, hasImage, stamped: true, compact: true, checklist: '3 of 9 places' }, measure, W);
          // The seal as landmarkRuntime draws it: centre (width-46, h/2), radius 34.
          const seal = card.seal ?? { x: card.width - 46, y: card.height / 2, r: 34 };
          const font = `800 ${card.nameFontSize}px system-ui, sans-serif`;
          const nameRight = card.textLeft + measure(card.name.toUpperCase(), font);
          const nameTop = (card.nameBaseline ?? 58) - card.nameFontSize * 0.75;
          // Boxes: the seal disc against the name's line. Disjoint in y, or in x.
          const clearY = nameTop - (seal.y + seal.r);
          const clearX = (seal.x - seal.r) - nameRight;
          out.push({ name, hasImage, cardW: card.width, font: card.nameFontSize, nameRight: Math.round(nameRight), inCard: nameRight <= card.width - 18 + 0.5, gap: Math.round(Math.max(clearX, clearY)) });
        }
        return out;
      }, LONG_NAMES);
      for (const r of rows) console.log('L292 postcard', size.width, JSON.stringify(r));
      for (const r of rows) { expect(r.gap, `${r.name} (image ${r.hasImage}) clears the seal`).toBeGreaterThanOrEqual(0); expect(r.inCard, `${r.name} fits the card`).toBe(true); }
    });

    for (const language of ['en', 'nl']) {
      test(`arrival footer fits without a mid-list cut (${language})`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
        test.setTimeout(180_000);
        await setLanguage(page, language);
        await page.addInitScript(() => {
          const d: string[] = ((window as any).__footers = []);
          const fillText = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: any[]) {
            if ((/\s·\s/.test(String(text)) || /★/.test(String(text))) && d.length < 400) d.push(JSON.stringify({ text: String(text), w: this.measureText(String(text)).width }));
            return (fillText as any).call(this, text, ...rest);
          };
        });
        await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
        // The leaderboard key is set at the end of route loading, after the player
        // exists; writing the stored best before it was null (one 390×664 run drew no ★ line).
        await page.waitForFunction(() => typeof (window as any).canalRecallGame._raceKey === 'string', null, { timeout: 30_000 });
        await page.evaluate(() => {
          const g = (window as any).canalRecallGame;
          if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
          Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 200, quizBestStreak: 2 });
          g._rideNamedNames = [`Street ${g.routeTo.id}`];
          // A stored best slower than this ride, so every case draws the personal-best item.
          try { localStorage.setItem('satb_bestTimes', JSON.stringify({ [g._raceKey]: { time: 999999, date: '2026-01-01', distance: 1 } })); } catch { /* */ }
          g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
        });
        await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
        await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
        await page.waitForTimeout(800);
        const footers = await page.evaluate(() => ((window as any).__footers as string[]).slice(-12).map(s => JSON.parse(s)));
        console.log('L292 footer', language, size.width, size.height, JSON.stringify(footers));
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrival-${language}-${size.width}x${size.height}.png` });
        const best = footers.filter((x: any) => /★|Personal best|Persoonlijk record/.test(x.text));
        expect(best.length, 'a personal-best line was drawn').toBeGreaterThan(0);
        const f = footers.filter((x: any) => /(Medium|Gemiddeld).*·|★.*·/.test(x.text)).at(-1);
        expect(f, 'the footer line was drawn').toBeTruthy();
        expect(f.text.includes('…'), `footer cut: ${f.text}`).toBe(false);
        expect(/[·\s]$/.test(f.text), `footer ends mid-list: ${f.text}`).toBe(false);
        expect(f.w, 'footer inside the card').toBeLessThanOrEqual(size.width - 40);
      });
    }
  });
}

// Desktop unchanged: the stamped/inline layouts are gated on compact and height < 800.
test('desktop: postcard and landmark card layouts equal the pre-#292 ones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop numbers');
  test.setTimeout(120_000);
  await page.goto('/canal-drive/?ride=free');
  await page.waitForFunction(() => !!(window as any).CanalRecallCards);
  const r = await page.evaluate((names) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const measure = (t: string, f: string) => { ctx.font = f; return ctx.measureText(t).width; };
    const C = (window as any).CanalRecallCards;
    const out: any[] = [];
    for (const hasImage of [true, false]) for (const stamped of [true, false]) for (const name of names) {
      const card = C.measurePostcard({ name, hasImage, stamped }, measure, 390);
      // The pre-#292 fit: the name measured as typed, floor 16.
      const available = Math.max(60, 390 - (hasImage ? 162 : 22) - 18);
      let size = 24;
      while (size > 16 && measure(name, `800 ${size}px system-ui, sans-serif`) > available) size -= 1;
      out.push({ name, hasImage, stamped, font: card.nameFontSize, oldFont: size, nameBaseline: card.nameBaseline, captionBaseline: card.captionBaseline, seal: card.seal ?? null });
    }
    const props = { name: 'Concertgebouw', body: 'A concert hall opened in 1888.', category: 'MUSEUM', hasImage: true, action: 'Noticed', actionHeight: 26 };
    const a = JSON.stringify(C.measureLandmarkCard(props, measure, 480));
    const b = JSON.stringify(C.measureLandmarkCard({ ...props, inlineAction: false }, measure, 480));
    return { out, same: a === b, h: JSON.parse(a).height };
  }, LONG_NAMES);
  console.log('L292 desktop', JSON.stringify(r));
  for (const row of r.out) {
    expect(row.font, `${row.name} font`).toBe(row.oldFont);
    expect(row.nameBaseline).toBe(58);
    expect(row.captionBaseline).toBe(80);
    expect(row.seal).toBeNull();
  }
  expect(r.same, 'landmark card layout unchanged').toBe(true);
});

// R2-5 / R2-6 (#304): measured fit. R2C_BEFORE=1 serves the pre-lane hud.js and game-presentation bundle
// (from R2C_ORIG, default /tmp/r2c-orig) so the same spec prints the before numbers.
async function serveOriginals(page: Page) {
  if (!process.env.R2C_BEFORE) return;
  const dir = process.env.R2C_ORIG || '/tmp/r2c-orig';
  const { readFileSync } = await import('node:fs');
  await page.route(/\/js\/hud\.js/, route => route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${dir}/hud.js`) }));
  await page.route(/\/js\/game-presentation\.bundle\.js/, route => route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${dir}/game-presentation.bundle.js`) }));
}
const recordText = () => {
  const rec: Array<{ t: string; f: string; w: number }> = ((window as any).__r2 = []);
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: any[]) {
    if (rec.length > 4000) rec.splice(0, 2000);
    rec.push({ t: String(text), f: this.font, w: this.measureText(String(text)).width });
    return (fillText as any).call(this, text, ...rest);
  };
};

test.describe('R2-5 phone 390x664, Dutch run arrival and plaque', () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test('end-run button keeps padding, stamp line and plaque are never cut mid-word', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
    test.setTimeout(240_000);
    await setLanguage(page, 'nl');
    await serveOriginals(page);
    await page.addInitScript(recordText);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
    await page.waitForFunction(() => typeof (window as any).canalRecallGame._raceKey === 'string', null, { timeout: 30_000 });
    // The plaque: a long destination and a buurt, in the HUD's second row.
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      g.routeTo = { ...g.routeTo, name: 'Pathé Tuschinski Cinema', reviewStop: undefined };
      g.currentNeighborhood = 'Centrum';
    });
    await page.waitForTimeout(1500);
    const plaque = await page.evaluate(() => ((window as any).__r2 as any[]).filter(x => /^naar |Pathé|Centrum/.test(x.t) && !/·\s*$/.test(x.t) || /Centrum ·/.test(x.t)).slice(-6));
    console.log('R2-5 plaque', JSON.stringify(plaque));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/r2-5-plaque-${process.env.R2C_BEFORE ? 'before' : 'after'}.png` });
    expect(plaque.some((x: any) => /\S…/.test(x.t)), 'no word cut by an ellipsis on the plaque').toBe(false);
    // The arrival, in a run.
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 200, quizBestStreak: 2 });
      g._rideNamedNames = [`Street ${g.routeTo.id}`];
      g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
    });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
    await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
    await page.evaluate(() => { (window as any).canalRecallGame._finishStamp = { kind: 'poi', name: 'Pathé Tuschinski Cinema', isNew: true, earned: 24, total: 120 }; (window as any).__r2.length = 0; });
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      const texts = (window as any).__r2 as Array<{ t: string; f: string; w: number }>;
      const end = (g._finishButtonBounds as any[]).find(b => b.id === 'end');
      const cap = texts.filter(x => /^(Reeks|Stop reeks|End run)/.test(x.t)).at(-1);
      const stamp = texts.filter(x => /Tuschinski/.test(x.t)).at(-1);
      return { end: end ? { w: end.w, h: end.h } : null, cap, pad: end && cap ? (end.w - cap.w) / 2 : null, stamp, runLine: g._runArrivalLine?.() ?? null };
    });
    console.log('R2-5 arrival', JSON.stringify(m));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/r2-5-arrival-${process.env.R2C_BEFORE ? 'before' : 'after'}.png` });
    expect(m.end, 'the run arrival draws an end-run button').toBeTruthy();
    expect(m.pad, 'end-run caption keeps at least 8 px each side').toBeGreaterThanOrEqual(8);
    expect(m.stamp, 'the stamp line was drawn').toBeTruthy();
    expect(/\S…/.test(m.stamp!.t), `stamp line cut: ${m.stamp?.t}`).toBe(false);
  });
});

test.describe('R2-6 desktop pause card', () => {
  for (const language of ['en', 'nl']) {
    test(`keycap rows fit the card (${language})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'desktop keycap rows');
      test.setTimeout(180_000);
      await setLanguage(page, language);
      await serveOriginals(page);
      await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
      await page.waitForFunction(() => typeof (window as any).canalRecallGame._raceKey === 'string', null, { timeout: 30_000 });
      await page.evaluate(() => { (window as any).canalRecallGame._shareUrl = 'https://example.invalid/r'; });
      await page.keyboard.press('KeyP');
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const g = (window as any).canalRecallGame;
        const b = g._pauseButtonBounds as Array<{ id: string; x: number; y: number; w: number }>;
        const left = Math.min(...b.map(x => x.x)), right = Math.max(...b.map(x => x.x + x.w));
        const cardW = Math.min(400, g.viewport.width - 24);
        const cx = g.viewport.width / 2;
        return { state: g.state, buttons: b.map(x => ({ id: x.id, x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.w) })), rowLeft: left, rowRight: right, cardLeft: cx - cardW / 2 + 28, cardRight: cx + cardW / 2 - 28, cardW };
      });
      console.log('R2-6 pause', language, JSON.stringify(m));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/r2-6-pause-${language}-${process.env.R2C_BEFORE ? 'before' : 'after'}.png` });
      expect(m.buttons.length, 'the pause card drew its actions').toBe(3);
      expect(m.rowRight, 'every keycap action ends inside the card padding').toBeLessThanOrEqual(m.cardRight + 0.5);
      expect(m.rowLeft).toBeGreaterThanOrEqual(m.cardLeft - 0.5);
    });
  }
});

// R3-B (#308, R2-12): on a short phone the question card keeps the vehicle visible. Measured in CSS px
// on the iphone project: card top >= vehicle y + 24 and every choice >= 44 px tall, landmark and street cards.
for (const size of [{ width: 390, height: 664 }, { width: 390, height: 844 }, { width: 414, height: 896 }]) {
  for (const kind of ['landmark', 'street'] as const) {
    test.describe(`R3-B ${kind} question ${size.width}x${size.height}`, () => {
      test.use({ viewport: size });
      test('question card clears the vehicle and keeps 44 px choices', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
        test.setTimeout(180_000);
        await openRoute(page, { travelMode: 'car', query: '?landmarkQuestions=1', controlMode: 'street' });
        await page.evaluate((k) => {
          const g = (window as any).canalRecallGame;
          g.routeOptions.answerMode = 'multiple';
          g.quizFeedback = ''; g.quizCandidateName = ''; g._silentPass = null;
          g._questionBudget = { asks: [] }; g._landmarkAsked = new Set(); g._seenLandmarks = new Set(); g._landmarkSightingsCache = {};
          g._landmarkReviewsCache = undefined;
          try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); localStorage.removeItem('canalRecall.landmarkReview.v1'); } catch { /* */ }
          g._clearLandmarkNotice();
          if (k === 'landmark') {
            const landmark = g.landmarks.find((l: any) => l.name === 'Westerkerk');
            g.routePath = null; g.routeTo = { id: 'lm-elsewhere', name: 'Elsewhere' };
            g.quizPromptName = ''; g.quizPromptKind = 'route';
            Object.assign(g.player, { x: landmark.x - 110 * 3, y: landmark.y, angle: 0, speed: 0, vx: 0, vy: 0 });
            g._updateLandmarks(1 / 60);
          }
        }, kind);
        if (kind === 'street') {
          // Open the street card the way the game does: a multiple-choice prompt with four names.
          await page.evaluate(() => {
            const g = (window as any).canalRecallGame;
            const names = ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Singel'];
            g.quizPromptName = 'Prinsengracht'; g.quizPromptSubject = 'water'; g.quizPromptKind = 'route';
            const card = document.getElementById('canal-choices')!;
            card.innerHTML = '';
            for (const n of names) { const b = document.createElement('button'); b.type = 'button'; b.className = 'canal-choice'; b.dataset.name = n; b.textContent = n; card.appendChild(b); }
            card.style.display = 'grid';
            (document.getElementById('canal-answer') as HTMLElement).style.display = 'none';
            (document.getElementById('canal-submit') as HTMLElement).style.display = 'none'; // as recallRuntime does in multiple-choice mode
            g._prompt.style.display = 'flex';
          });
        }
        await page.waitForTimeout(800);
        const m = await page.evaluate(() => {
          const g = (window as any).canalRecallGame;
          const rect = g.canvas.getBoundingClientRect();
          const k = rect.height / g.viewport.height;
          const v = g.camera.worldToScreen(g.player.x, g.player.y);
          const card = document.getElementById('canal-card')!.getBoundingClientRect();
          const choices = [...document.querySelectorAll('#canal-choices button')].map(b => Math.round((b as HTMLElement).getBoundingClientRect().height * 10) / 10);
          return { kind: g.quizPromptKind, cardTop: Math.round(card.top * 10) / 10, cardH: Math.round(card.height), vehicleY: Math.round((rect.top + v.y * k) * 10) / 10, choices, vh: window.innerHeight };
        });
        console.log('R3B', kind, size.width, size.height, JSON.stringify(m));
        if (process.env.PHONE_POLISH_SHOTS) await page.screenshot({ path: `${process.env.PHONE_POLISH_SHOTS}/question-${kind}-${size.width}x${size.height}.png` });
        expect(m.choices.length).toBe(4);
        for (const h of m.choices) expect(h, 'every choice is a 44 px target').toBeGreaterThanOrEqual(44);
        expect(m.cardTop, 'the card leaves the vehicle 24 px clear').toBeGreaterThanOrEqual(m.vehicleY + 24);
      });
    });
  }
}
