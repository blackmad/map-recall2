import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOGS } from '../../i18n/index.ts';
import { keycapActionWidth, measureKeycapAction } from './keycapAction.ts';
import { fitLine, formatPauseTime, PAUSE_DESKTOP, PAUSE_PHONE, pauseCardLayout, pauseStatsText, type PauseAction, type PauseCardLayout, type PauseCardStrings } from './pauseCard.ts';

// #319: the user's "ugly and uncentered" pause card. A fixed-width measure
// (0.55 em a character) stands in for the canvas.
const measure = (text: string, font: string) => text.length * Number(/(\d+)px/.exec(font)?.[1] ?? 12) * 0.55;
const FONTS = { plaque: 'Barlow Condensed', ui: 'system-ui', mono: 'JetBrains Mono' };
const DESKTOP = { width: 1280, height: 800, compact: false };
const DESKTOP_SMALL = { width: 1280, height: 720, compact: false };
const PHONE = { width: 390, height: 844, compact: true };
const PHONE_SHORT = { width: 390, height: 664, compact: true };

function strings(lang: 'en' | 'nl', opts: { share?: boolean; subtitle?: string; stats?: string } = {}): PauseCardStrings {
  const c = CATALOGS[lang];
  const actions: PauseAction[] = [
    { id: 'resume', key: 'P / ESC', caption: c['ride.resume'] },
    { id: 'route', key: 'M', caption: c['ride.routeSetup'] },
  ];
  if (opts.share !== false) actions.push({ id: 'copy', key: 'C', caption: c['ride.shareRoute'] });
  return { title: c['ride.paused'], subtitle: opts.subtitle ?? c['hud.toDestination'].replace('{name}', 'Westerkerk'), stats: opts.stats ?? '11:33  ·  16 km', actions };
}

function assertCentred(layout: PauseCardLayout, label: string): void {
  const { card, inner, cx } = layout;
  const vw = layout.compact ? 390 : 1280;
  assert.ok(Math.abs(card.x + card.w / 2 - vw / 2) <= 1, `${label}: card centred on the viewport`);
  assert.ok(Math.abs(cx - (card.x + card.w / 2)) < 0.01, `${label}: cx is the card's centre`);
  const lines = [layout.title, layout.subtitle, layout.stats].filter(Boolean);
  for (const line of lines) {
    const left = line!.x - line!.width / 2 - inner.left, right = inner.right - (line!.x + line!.width / 2);
    assert.ok(Math.abs(left - right) <= 4, `${label}: "${line!.text}" margins ${left}/${right}`);
    assert.ok(left >= -0.01 && right >= -0.01, `${label}: "${line!.text}" stays within the inner edge`);
  }
  for (const row of layout.rows) {
    const left = row.x - inner.left, right = inner.right - (row.x + row.w);
    assert.ok(Math.abs(left - right) <= 4, `${label}: row margins ${left}/${right}`);
    assert.ok(left >= -0.01 && right >= -0.01, `${label}: row within the inner edge`);
    const last = row.items[row.items.length - 1];
    assert.ok(Math.abs(last.x + last.w - (row.x + row.w)) < 0.01, `${label}: the row's items fill its box`);
  }
}

for (const lang of ['en', 'nl'] as const) {
  for (const [name, viewport] of [['desktop 1280×800', DESKTOP], ['desktop 1280×720', DESKTOP_SMALL], ['phone 390×844', PHONE], ['phone 390×664', PHONE_SHORT]] as const) {
    test(`${lang} ${name}: every line and row is centred and inside the card`, () => {
      assertCentred(pauseCardLayout(measure, strings(lang), viewport, FONTS), `${lang} ${name}`);
      assertCentred(pauseCardLayout(measure, strings(lang, { share: false, subtitle: '' }), viewport, FONTS), `${lang} ${name} no share`);
    });
  }
}

test('the card hugs its content: no empty band under the stats line', () => {
  const layout = pauseCardLayout(measure, strings('en'), DESKTOP, FONTS);
  const bottom = layout.card.y + layout.card.h;
  const statsBottom = layout.stats!.baseline + 3;
  assert.ok(bottom - statsBottom <= PAUSE_DESKTOP.padBottom + 4, `band ${bottom - statsBottom}`);
  const width = Math.max(layout.title.width, layout.subtitle!.width, layout.stats!.width, ...layout.rows.map(r => r.w), PAUSE_DESKTOP.minInnerW);
  assert.equal(layout.card.w, Math.ceil(width + PAUSE_DESKTOP.padX * 2));
});

test('desktop: the three keycaps sit on one row when they fit, and wrap in a narrow window', () => {
  const wide = pauseCardLayout(measure, strings('nl'), DESKTOP, FONTS);
  assert.equal(wide.rows.length, 1);
  assert.deepEqual(wide.rows[0].items.map(i => i.index), [0, 1, 2]);
  const narrow = pauseCardLayout(measure, strings('nl'), { width: 360, height: 700, compact: false }, FONTS);
  assert.ok(narrow.rows.length >= 2);
  assertCentredLoose(narrow);
});
function assertCentredLoose(layout: PauseCardLayout): void {
  for (const row of layout.rows) assert.ok(row.x >= layout.inner.left - 0.01 && row.x + row.w <= layout.inner.right + 0.01);
}

test('phone: one full-width 44 px button per action, no keycaps', () => {
  const layout = pauseCardLayout(measure, strings('en'), PHONE, FONTS);
  assert.equal(layout.rows.length, 3);
  for (const row of layout.rows) {
    assert.equal(row.h, PAUSE_PHONE.buttonH);
    assert.equal(row.items.length, 1);
    assert.equal(row.w, layout.inner.right - layout.inner.left);
  }
  assert.ok(layout.card.w <= 390 - 24);
});

test('a long destination is cut with an ellipsis rather than widening past the card', () => {
  const long = 'to Stedelijk Museum Amsterdam aan het Museumplein en de Van Baerlestraat';
  const layout = pauseCardLayout(measure, strings('en', { subtitle: long }), PHONE, FONTS);
  assert.ok(layout.subtitle!.text.endsWith('…'));
  assert.ok(layout.subtitle!.width <= layout.inner.right - layout.inner.left);
  assertCentred(layout, 'long subtitle');
  assert.equal(fitLine(measure, 'short', '12px x', 500), 'short');
});

const tr = (key: 'ride.pauseSummary' | 'ride.pauseStats', vars: Record<string, string | number>) =>
  CATALOGS.en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));

test('stats: time and distance always; the tally only on a quiz ride with attempts', () => {
  assert.equal(pauseStatsText(tr, { timeS: 693.386, km: 15.97, correct: 0, attempts: 0, freeRide: true }), '11:33  ·  16 km');
  assert.equal(pauseStatsText(tr, { timeS: 693, km: 15.97, correct: 3, attempts: 5, freeRide: true }), '11:33  ·  16 km');
  assert.equal(pauseStatsText(tr, { timeS: 61, km: 1.234, correct: 0, attempts: 0, freeRide: false }), '01:01  ·  1.2 km');
  assert.equal(pauseStatsText(tr, { timeS: 61, km: 1.234, correct: 2, attempts: 3, freeRide: false }), '01:01  ·  1.2 km  ·  2 of 3 named');
});

test('pause time drops milliseconds and gains hours past the hour', () => {
  assert.equal(formatPauseTime(0), '00:00');
  assert.equal(formatPauseTime(693.999), '11:33');
  assert.equal(formatPauseTime(3725), '1:02:05');
  assert.equal(formatPauseTime(Number.NaN), '00:00');
});

test('keycapActionWidth matches measureKeycapAction', () => {
  const ctx = { font: '', measureText(text: string) { return { width: measure(text, ctx.font) }; } } as unknown as CanvasRenderingContext2D;
  const action = { key: 'P / ESC', caption: 'Resume' };
  assert.equal(keycapActionWidth(measure, action, 'mono'), measureKeycapAction(ctx, action, 'mono'));
});
