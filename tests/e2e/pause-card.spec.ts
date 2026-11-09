import { expect, type Page, test } from '@playwright/test';
import { openRoute } from './helpers';

// #319: the pause card, "ugly and uncentered" (user 2026-11-09). Measured from what the
// canvas actually drew (fillText calls and the action click boxes), not from the layout:
//  - every text line and every action row is centred on the card's inner box within 4 px;
//  - nothing passes the inner edge;
//  - Free Ride (and a quiz ride before its first question) shows no "0 of 0 named" tally.
// Desktop 1440×900 and 1280×720, iphone 390×844 and 390×664, en and nl, Free Ride and a quiz ride.
// PAUSE_SHOTS=<dir> saves frames; PAUSE_BEFORE=<dir with hud.js + game-presentation.bundle.js>
// serves the pre-#319 bundles for the strip's "before" frames (assertions are then report-only).

const SHOTS = process.env.PAUSE_SHOTS || '';
const BEFORE = process.env.PAUSE_BEFORE || '';
const SIZES = {
  desktop: [{ width: 1440, height: 900 }, { width: 1280, height: 720 }],
  iphone: [{ width: 390, height: 844 }, { width: 390, height: 664 }],
} as const;

async function prepare(page: Page, language: string) {
  await page.addInitScript((lang: string) => {
    try { if (!sessionStorage.getItem('p319')) { sessionStorage.setItem('p319', '1'); localStorage.setItem('canalRecall.language.v1', lang); } } catch { /* */ }
    const rec: Array<{ t: string; f: string; x: number; y: number; w: number; align: string }> = ((window as any).__p319 = []);
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, ...rest: any[]) {
      if (rec.length > 4000) rec.splice(0, 2000);
      rec.push({ t: String(text), f: this.font, x, y, w: this.measureText(String(text)).width, align: this.textAlign });
      return (fillText as any).call(this, text, x, y, ...rest);
    };
  }, language);
  if (BEFORE) {
    const { readFileSync } = await import('node:fs');
    await page.route(/\/js\/hud\.js/, route => route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${BEFORE}/hud.js`) }));
    await page.route(/\/js\/game-presentation\.bundle\.js/, route => route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${BEFORE}/game-presentation.bundle.js`) }));
  }
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
}

async function measurePause(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._shareUrl = g._shareUrl || 'https://example.invalid/r';
    g.hud.hoverPoint = null;
    g.state = 6;
    (window as any).__p319.length = 0;
  });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._pauseButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const vw = g.viewport.width, vh = g.viewport.height;
    const L = g._pauseCardLayout;
    // Pre-#319 bundles have no layout: the old fixed card.
    const compact = g.viewport.mode === 'compact';
    const oldW = Math.min(400, vw - 24), oldPad = compact ? 18 : 28;
    const card = L ? L.card : { x: vw / 2 - oldW / 2, w: oldW, y: NaN, h: NaN };
    const inner = L ? L.inner : { left: card.x + oldPad, right: card.x + card.w - oldPad };
    const buttons = g._pauseButtonBounds as Array<{ id: string; x: number; y: number; w: number; h: number }>;
    const rowsByY = new Map<number, { left: number; right: number }>();
    for (const b of buttons) {
      const key = Math.round(b.y);
      const row = rowsByY.get(key) || { left: Infinity, right: -Infinity };
      row.left = Math.min(row.left, b.x); row.right = Math.max(row.right, b.x + b.w);
      rowsByY.set(key, row);
    }
    // The last frame's centred texts inside the card (title, subtitle, stats).
    const rec = (window as any).__p319 as Array<{ t: string; f: string; x: number; y: number; w: number; align: string }>;
    const seen = new Map<string, { t: string; left: number; right: number; y: number }>();
    for (const r of rec) {
      if (r.align !== 'center' || r.x < card.x || r.x > card.x + card.w) continue;
      if (L && (r.y < L.card.y || r.y > L.card.y + L.card.h)) continue;
      seen.set(r.t, { t: r.t, left: r.x - r.w / 2, right: r.x + r.w / 2, y: r.y });
    }
    const lines = [...seen.values()].filter(l => !buttons.some(b => l.y > b.y && l.y < b.y + b.h));
    const margins = (left: number, right: number) => ({ l: +(left - inner.left).toFixed(1), r: +(inner.right - right).toFixed(1) });
    return {
      viewport: [vw, vh], mode: g.viewport.mode, state: g.state,
      card: { x: Math.round(card.x), y: Math.round(card.y), w: Math.round(card.w), h: Math.round(card.h) },
      cardCentreOffset: +(card.x + card.w / 2 - vw / 2).toFixed(1),
      cardMiddleOffset: Number.isFinite(card.y) ? +(card.y + card.h / 2 - vh / 2).toFixed(1) : null,
      lines: lines.map(l => ({ t: l.t, ...margins(l.left, l.right) })),
      rows: [...rowsByY.values()].map(r => margins(r.left, r.right)),
      bandBelow: L?.stats ? +(L.card.y + L.card.h - L.stats.baseline).toFixed(1) : null,
      titlePx: L ? Number(/(\d+)px/.exec(L.title.font)?.[1]) : null,
      buttonHeights: buttons.map(b => Math.round(b.h)),
    };
  });
}

for (const project of ['desktop', 'iphone'] as const) {
  for (const size of SIZES[project]) {
    test.describe(`${project} ${size.width}x${size.height}`, () => {
      test.use({ viewport: size });
      for (const language of ['en', 'nl']) {
        for (const ride of ['quiz', 'free'] as const) {
          test(`pause card centred (${language}, ${ride})`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== project, `${project} sizes`);
            test.setTimeout(240_000);
            await prepare(page, language);
            if (ride === 'free') {
              await page.goto('/canal-drive/?ride=free');
              await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
            } else {
              await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
            }
            const m = await measurePause(page);
            console.log('P1 pause', project, `${size.width}x${size.height}`, language, ride, JSON.stringify(m));
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/pause-${project}-${size.width}x${size.height}-${language}-${ride}-${BEFORE ? 'before' : 'after'}.png` });
            if (BEFORE) return;
            expect(m.rows.length, 'the card drew its actions').toBeGreaterThan(0);
            expect(Math.abs(m.cardCentreOffset), 'card centred on the viewport').toBeLessThanOrEqual(1);
            for (const item of [...m.lines, ...m.rows]) {
              expect(Math.abs(item.l - item.r), `centred within 4 px: ${JSON.stringify(item)}`).toBeLessThanOrEqual(4);
              expect(Math.min(item.l, item.r), `inside the inner edge: ${JSON.stringify(item)}`).toBeGreaterThanOrEqual(-0.5);
            }
            const stats = m.lines.find(l => /km/.test(l.t));
            expect(stats, 'the stats line was drawn').toBeTruthy();
            if (ride === 'free') expect(stats!.t, 'Free Ride shows no quiz tally').not.toMatch(/named|benoemd/);
            expect(m.bandBelow!, 'no empty band under the stats').toBeLessThanOrEqual(26);
            if (project === 'iphone') for (const h of m.buttonHeights) expect(h, 'phone actions stay 44 px').toBeGreaterThanOrEqual(44);
          });
        }
      }
    });
  }
}
