import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsHidden, formatShareDistance, formatShareTime, layoutShareCard, renderShareCard, shareCardFileName,
  SHARE_CARD_H, SHARE_CARD_MIN_FONT_PX, SHARE_CARD_PRIMARY_FONT_PX, SHARE_CARD_W, type ShareCardInput,
} from './shareCard.ts';

const route = [{ x: 0, y: 0 }, { x: 300, y: 40 }, { x: 320, y: 400 }, { x: 900, y: 420 }];
const base: ShareCardInput = {
  route,
  destination: 'Westerkerk',
  distanceM: 2410,
  timeS: 372,
  ribbon: { label: 'SILVER RIBBON', color: '#4f5864', dim: 'rgba(79,88,100,.12)' },
  modeLabel: 'By bike',
};

/** A canvas that records every fillText call. */
function fakeCanvas(w: number, h: number) {
  const drawn: string[] = [];
  const gradient = { addColorStop() {} } as unknown as CanvasGradient;
  const ctx: Record<string, unknown> = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
    save() {}, restore() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {},
    fillText(text: string) { drawn.push(text); },
    createLinearGradient: () => gradient,
  };
  return { width: w, height: h, drawn, getContext: () => ctx };
}

test('the card is 1200×630 and draws destination, numbers, ribbon and the site', () => {
  const { canvas, layout } = renderShareCard(base, fakeCanvas);
  assert.equal(canvas.width, SHARE_CARD_W);
  assert.equal(canvas.height, SHARE_CARD_H);
  assert.equal(SHARE_CARD_W, 1200);
  assert.equal(SHARE_CARD_H, 630);
  assert.deepEqual(canvas.drawn, layout.texts.map(t => t.text));
  for (const want of ['Westerkerk', '2.41 km', '6:12', 'SILVER RIBBON', 'rideamsterdam.nl']) {
    assert.ok(canvas.drawn.includes(want), `${want} is on the card`);
  }
  assert.ok(layout.route.length >= 2, 'the silhouette is drawn');
});

test('every line is legible at 25 % scale', () => {
  const layout = layoutShareCard({ ...base, destination: 'Stedelijk Museum Amsterdam aan het Museumplein' });
  for (const t of layout.texts) {
    assert.ok(t.sizePx >= SHARE_CARD_MIN_FONT_PX, `${t.role} "${t.text}" is ${t.sizePx}px`);
    if (['destination', 'value', 'ribbon'].includes(t.role)) assert.ok(t.sizePx >= SHARE_CARD_PRIMARY_FONT_PX, `${t.role} is primary size`);
    assert.ok(t.x >= 0 && t.x <= SHARE_CARD_W && t.y > 0 && t.y < SHARE_CARD_H, `${t.role} sits on the card`);
  }
  assert.ok(layout.texts.filter(t => t.role === 'destination').length <= 2, 'a long name takes at most two lines');
});

test('the silhouette stays inside its panel', () => {
  const { route: pts, panel } = layoutShareCard(base);
  for (const [x, y] of pts) {
    assert.ok(x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h);
  }
});

test('a hidden name is never drawn, not even inside the destination', () => {
  const hiddenNames = ['Prinsengracht'];
  const { canvas } = renderShareCard({ ...base, destination: 'Prinsengracht 263', hiddenNames }, fakeCanvas);
  assert.ok(!canvas.drawn.some(text => containsHidden(text, hiddenNames)), canvas.drawn.join(' | '));
  assert.ok(!canvas.drawn.join(' ').toLowerCase().includes('prinsengracht'));
  assert.ok(canvas.drawn.includes('Amsterdam'), 'a neutral place stands in');
});

test('hidden matching ignores case and accents but needs whole words', () => {
  assert.ok(containsHidden('Café Brouwersgracht', ['brouwersgracht']));
  assert.ok(containsHidden('Prins Héndrikkade', ['Prins Hendrikkade']));
  assert.ok(!containsHidden('Westerkerk', ['Wester']));
  assert.ok(!containsHidden('Westerkerk', ['', null, undefined]));
});

test('numbers and file names', () => {
  assert.equal(formatShareDistance(640), '640 m');
  assert.equal(formatShareDistance(12_345), '12.3 km');
  assert.equal(formatShareTime(3725), '1:02:05');
  assert.equal(shareCardFileName('Café de Jaren!'), 'ride-amsterdam-cafe-de-jaren.png');
});

test('a route with fewer than two points draws no silhouette', () => {
  assert.deepEqual(layoutShareCard({ ...base, route: [{ x: 1, y: 1 }] }).route, []);
});

test('the trail samples a step at a time and restarts for a new ride', async () => {
  const { extendShareTrail, SHARE_TRAIL_STEP_PX } = await import('./shareCard.ts');
  const car = {};
  let trail = extendShareTrail(null, car, { x: 0, y: 0 }, 0);
  trail = extendShareTrail(trail, car, { x: 10, y: 0 }, 10);
  assert.equal(trail.points.length, 1, 'less than a step is not sampled');
  trail = extendShareTrail(trail, car, { x: SHARE_TRAIL_STEP_PX + 1, y: 0 }, 50);
  assert.equal(trail.points.length, 2);
  trail = extendShareTrail(trail, {}, { x: 500, y: 500 }, 0);
  assert.deepEqual(trail.points, [{ x: 500, y: 500 }], 'a new vehicle starts a new trail');
});

test('no two lines overlap, nor a line and the ribbon', async () => {
  const { approximateMeasure } = await import('./shareCard.ts');
  for (const destination of ['Westerkerk', 'Portugese Synagoge', 'Stedelijk Museum Amsterdam aan het Museumplein']) {
    const layout = layoutShareCard({ ...base, destination });
    const boxes = layout.texts.map(t => {
      const w = approximateMeasure(t.text, t.font, t.sizePx);
      const x0 = t.align === 'right' ? t.x - w : t.x;
      return { t, x0, x1: x0 + w, y0: t.y - t.sizePx * 0.78, y1: t.y + t.sizePx * 0.12 };
    });
    const hit = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => assert.ok(!hit(a, b), `${destination}: "${a.t.text}" overlaps "${b.t.text}"`)));
    const r = layout.ribbon!;
    const site = boxes.find(b => b.t.role === 'site')!;
    assert.ok(!hit(site, { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }), 'the site clears the ribbon');
    assert.ok(boxes.every(b => b.x1 <= SHARE_CARD_W - 40), `${destination}: every line stays inside the border`);
  }
});
