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
  assert.ok(layout.texts.filter(t => t.role === 'destination').length <= 3, 'a long name takes at most three lines');
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
  assert.ok(canvas.drawn.includes('RIDE') && !canvas.drawn.includes('DESTINATION'), 'the eyebrow says RIDE, not DESTINATION');
});

test('a withheld destination shows RIDE over its buurt', () => {
  const hiddenNames = ['Jonas Daniël Meijerplein'];
  const { canvas } = renderShareCard({ ...base, destination: 'Jonas Daniël Meijerplein', area: 'Nieuwmarkt/Lastage', hiddenNames }, fakeCanvas);
  assert.deepEqual(canvas.drawn.slice(0, 2), ['RIDE', 'Nieuwmarkt/Lastage']);
  assert.ok(!canvas.drawn.some(text => containsHidden(text, hiddenNames)));
  // A buurt that is itself hidden falls back to the city.
  const city = renderShareCard({ ...base, destination: 'Westermarkt', area: 'Westermarkt', hiddenNames: ['Westermarkt'] }, fakeCanvas).canvas.drawn;
  assert.deepEqual(city.slice(0, 2), ['RIDE', 'Amsterdam']);
  // A named destination keeps DESTINATION even when the buurt is known.
  assert.equal(renderShareCard({ ...base, area: 'Jordaan' }, fakeCanvas).canvas.drawn[0], 'DESTINATION');
});

test('a long name takes three lines at 48 px before any ellipsis', () => {
  const layout = layoutShareCard({ ...base, destination: 'Stedelijk Museum Amsterdam aan het Museumplein' });
  const lines = layout.texts.filter(t => t.role === 'destination');
  assert.equal(lines.length, 3, lines.map(l => l.text).join(' / '));
  assert.ok(lines.every(l => !l.text.endsWith('…') && l.sizePx >= SHARE_CARD_PRIMARY_FONT_PX));
  assert.equal(lines.map(l => l.text).join(' '), 'Stedelijk Museum Amsterdam aan het Museumplein');
  const huge = layoutShareCard({ ...base, destination: 'Het Rijksmuseum en de Nachtwacht van Rembrandt van Rijn aan de Museumstraat in Amsterdam Zuid bij de Singelgracht' });
  const hugeLines = huge.texts.filter(t => t.role === 'destination').map(t => t.text);
  assert.equal(hugeLines.length, 3);
  assert.match(hugeLines[2], /\S…$/, 'cut after a whole word');
  const words = new Set('Het Rijksmuseum en de Nachtwacht van Rembrandt van Rijn aan de Museumstraat in Amsterdam Zuid bij de Singelgracht'.split(' '));
  assert.ok(hugeLines.join(' ').replace('…', '').split(' ').every(w => words.has(w)), 'no word is split');
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
  for (const destination of ['Westerkerk', 'Portugese Synagoge', 'Stedelijk Museum Amsterdam aan het Museumplein', 'Het Rijksmuseum en de Nachtwacht van Rembrandt van Rijn aan de Museumstraat in Amsterdam']) {
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

// --- The run's share picture (#295): runShareCard.ts, the same paper and type as the card above. ---
import {
  layoutRunShareCard, renderRunShareCard, runLegs, runPlace, runShareFileName, worldToLatLng, RUN_SHARE_LABELS_EN,
  type RunShareInput, type RunShareStop,
} from './runShareCard.ts';
import { projectToWorld } from './osm/roadProjection.ts';

/** Six stops round the centre, each leg a dog-leg of three points. */
function runStops(count: number): RunShareStop[] {
  const places: Array<[string, number, number]> = [
    ['Westerkerk', 52.3746, 4.8840], ['Rijksmuseum', 52.3600, 4.8852], ['Heineken Experience', 52.3579, 4.8918],
    ['Hortus Botanicus', 52.3667, 4.9080], ['Scheepvaartmuseum', 52.3717, 4.9152], ['Centraal Station', 52.3791, 4.9003],
  ];
  let prev: [number, number] = [52.3780, 4.8830];
  return places.slice(0, count).map(([name, lat, lng], i) => {
    const path: Array<[number, number]> = [prev, [prev[0], lng], [lat, lng]];
    prev = [lat, lng];
    return { number: i + 1, name, lat, lng, area: 'Centrum', path };
  });
}
const runInput = (count: number, extra: Partial<RunShareInput> = {}): RunShareInput => ({
  stops: runStops(count), summary: `${count} stops  ·  ${count + 2} names  ·  ${count * 210} points`, city: 'Amsterdam', ...extra,
});
const boxesOf = (texts: Array<{ text: string; font: string; sizePx: number; x: number; y: number; align: string; role: string }>, measure = (s: string, f: string, px: number) => s.length * px * (/Condensed|Narrow/.test(f) ? 0.46 : 0.6)) =>
  texts.map(t => {
    const w = measure(t.text, t.font, t.sizePx);
    const x0 = t.align === 'right' ? t.x - w : t.align === 'center' ? t.x - w / 2 : t.x;
    return { t, x0, x1: x0 + w, y0: t.y - t.sizePx * 0.78, y1: t.y + t.sizePx * 0.12 };
  });

test('run share: 1200×630, RUN over the shared buurt, the run line, every stop numbered, the site', () => {
  const { canvas, layout } = renderRunShareCard(runInput(3), fakeCanvas);
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 630);
  assert.deepEqual(canvas.drawn, layout.texts.map(t => t.text));
  assert.ok(canvas.drawn.some(text => text.replace(/\s+/g, ' ') === '3 stops · 5 names · 630 points'), 'the run line, on one line');
  for (const want of ['RUN', 'Centrum', 'Westerkerk', 'Rijksmuseum', 'Heineken Experience', 'rideamsterdam.nl']) {
    assert.ok(canvas.drawn.includes(want), `${want} is on the card`);
  }
  assert.deepEqual(layout.dots.map(d => d.number), [1, 2, 3]);
  assert.deepEqual(layout.dots.map(d => d.last), [false, false, true]);
  assert.equal(layout.legs.length, 3);
  assert.ok(layout.start, 'the run start is ringed');
  for (const dot of layout.dots) {
    assert.ok(dot.x - dot.r >= layout.panel.x && dot.x + dot.r <= layout.panel.x + layout.panel.w, 'dots stay on the plate');
    assert.ok(dot.y - dot.r >= layout.panel.y && dot.y + dot.r <= layout.panel.y + layout.panel.h, 'dots stay on the plate');
  }
  assert.ok(layout.texts.every(t => t.sizePx >= SHARE_CARD_MIN_FONT_PX), 'legible at 25 %');
});

test('run share: stops in different buurten read the city; a withheld buurt reads the city', () => {
  const mixed = runStops(3).map((s, i) => ({ ...s, area: ['Jordaan', 'Museumkwartier', 'De Pijp'][i] }));
  assert.equal(runPlace({ ...runInput(3), stops: mixed }, RUN_SHARE_LABELS_EN), 'Amsterdam');
  assert.equal(runPlace(runInput(3, { hiddenNames: ['Centrum'] }), RUN_SHARE_LABELS_EN), 'Amsterdam');
  assert.equal(runPlace(runInput(3, { city: null, hiddenNames: ['Centrum'] }), RUN_SHARE_LABELS_EN), 'Amsterdam');
});

test('run share: a withheld stop name reads "Stop N" and is drawn nowhere', () => {
  const { canvas } = renderRunShareCard(runInput(3, { hiddenNames: ['Rijksmuseum', null, ''] }), fakeCanvas);
  assert.ok(canvas.drawn.includes('Stop 2'));
  assert.ok(canvas.drawn.every(text => !/rijksmuseum/i.test(text)), canvas.drawn.join(' | '));
});

test('run share: 1, 3, 6 and 12 stops and a long buurt never overlap and stay inside the border', () => {
  const long = 'Burgwallen-Oude Zijde en de Nieuwmarkt rond de Waag';
  for (const [count, area] of [[1, 'Centrum'], [3, 'Centrum'], [6, 'Centrum'], [6, long], [12, long]] as Array<[number, string]>) {
    const stops = Array.from({ length: count }, (_, i) => ({ ...runStops(6)[i % 6], number: i + 1, area, name: i === 2 ? 'Stedelijk Museum Amsterdam aan het Museumplein' : runStops(6)[i % 6].name }));
    const layout = layoutRunShareCard({ ...runInput(count), stops });
    const boxes = boxesOf(layout.texts).filter(b => b.t.role !== 'dot');
    const hit = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
      if (a.t.role === 'stopNumber' || b.t.role === 'stopNumber') return; // numbers sit inside their discs
      assert.ok(!hit(a, b), `${count}/${area}: "${a.t.text}" overlaps "${b.t.text}"`);
    }));
    assert.ok(boxes.every(b => b.x1 <= SHARE_CARD_W - 40 && b.y1 <= SHARE_CARD_H - 30), `${count}: inside the border`);
    const rows = layout.texts.filter(t => t.role === 'stop').length;
    const earlier = layout.texts.find(t => t.role === 'earlier');
    assert.equal(rows + (earlier ? Number(/\d+/.exec(earlier.text)![0]) : 0), count, `${count}: every stop listed or counted`);
    if (count <= 6 && area === 'Centrum') assert.equal(earlier, undefined, `${count} stops all listed`);
    assert.equal(layout.dots.length, count);
    assert.ok(layout.texts.every(t => t.sizePx >= SHARE_CARD_MIN_FONT_PX));
  }
});

test('run share: legs fall back to straight lines from the previous stop, then from the start', () => {
  const stops = runStops(3).map(({ path: _path, ...s }) => s);
  const legs = runLegs({ stops, start: { lat: 52.378, lng: 4.883 } });
  assert.equal(legs.length, 3);
  assert.deepEqual(legs[0], [[52.378, 4.883], [52.3746, 4.884]]);
  assert.deepEqual(legs[1][0], [52.3746, 4.884]);
  // An old run saved before #295 (no geometry at all) still draws its numbered list.
  const layout = layoutRunShareCard({ ...runInput(2), stops: runStops(2).map(({ number, name }) => ({ number, name })) });
  assert.equal(layout.legs.length, 0);
  assert.equal(layout.texts.filter(t => t.role === 'stop').length, 2);
});

test('run share: worldToLatLng inverts the road projection with its offset', () => {
  const centre = { lat: 52.37, lon: 4.89 };
  const p = projectToWorld({ lat: 52.3746, lon: 4.884 }, centre);
  const [lat, lng] = worldToLatLng({ x: p.x + 120, y: p.y - 40 }, { centerLat: 52.37, centerLng: 4.89, offsetX: 120, offsetY: -40 })!;
  assert.ok(Math.abs(lat - 52.3746) < 1e-9 && Math.abs(lng - 4.884) < 1e-9);
  assert.equal(worldToLatLng({ x: 1, y: 1 }, { centerLat: NaN, centerLng: 4.9 }), null);
});

test('run share: file name', () => {
  assert.equal(runShareFileName(3, 'De Pijp'), 'ride-amsterdam-run-3-stops-de-pijp.png');
});
