// #279 measurement: does anything print the start street's name in the first
// 10 s of a ride that starts on a named street? Here mode starts wherever the
// rider is; the geolocation is put on Van Boetzelaerstraat (Staatsliedenbuurt).
// Records every canvas fillText/strokeText, every plaque routeName handed to
// hud.drawPlaque, the DOM text, and the first question asked.
import { expect, test, type Page } from '@playwright/test';

const AT = { latitude: 52.382378, longitude: 4.872655 };
const shots = process.env.G2_SHOTS || 'artifacts/daily-pool';

/** Strings are recorded until the first question opens: the question's own choices name the answer by design. */
type Probe = { texts: string[]; plaques: string[]; prompts: string[]; dom: string[]; open?: boolean };

export async function installProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { texts: [] as string[], plaques: [] as string[], prompts: [] as string[], dom: [] as string[], open: false };
    (window as unknown as { __namedStartProbe: typeof probe }).__namedStartProbe = probe;
    for (const method of ['fillText', 'strokeText'] as const) {
      for (const proto of [CanvasRenderingContext2D.prototype, (globalThis as { OffscreenCanvasRenderingContext2D?: { prototype: CanvasRenderingContext2D } }).OffscreenCanvasRenderingContext2D?.prototype]) {
        if (!proto) continue;
        const original = proto[method];
        proto[method] = function (this: CanvasRenderingContext2D, text: string, ...rest: number[]) {
          if (!probe.open && probe.texts.length < 200000) probe.texts.push(String(text));
          return (original as (...a: unknown[]) => void).call(this, text, ...rest);
        } as typeof original;
      }
    }
  });
}

export async function watchRide(page: Page, seconds: number): Promise<{ street: string; probe: Probe }> {
  // Wait for the ride to be under way, then wrap the plaque and sample for `seconds`.
  await expect.poll(() => page.evaluate(() => (window as unknown as { canalRecallGame?: { state: number } }).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
  const street = await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: { track: { getRoadName(x: number, y: number, a: number): string }; player: { x: number; y: number; angle: number }; hud: { drawPlaque: (ctx: unknown, o: { routeName: string }) => void } } }).canalRecallGame;
    const probe = (window as unknown as { __namedStartProbe: Probe }).__namedStartProbe;
    probe.texts.length = 0;
    const draw = g.hud.drawPlaque.bind(g.hud);
    g.hud.drawPlaque = (ctx, o) => { if (!probe.open) probe.plaques.push(o.routeName); return draw(ctx, o); };
    return g.track.getRoadName(g.player.x, g.player.y, g.player.angle);
  });
  await page.screenshot({ path: `${shots}/named-start-0s-${test.info().project.name}.png` });
  // Ride forward along the road for the window, sampling the DOM and the open question.
  await page.keyboard.down('ArrowUp');
  for (let t = 0; t < seconds * 4; t++) {
    await page.waitForTimeout(250);
    if (t === 4) await page.screenshot({ path: `${shots}/named-start-1s-${test.info().project.name}.png` });
    await page.evaluate(() => {
      const g = (window as unknown as { canalRecallGame: { quizPromptName?: string } }).canalRecallGame;
      const probe = (window as unknown as { __namedStartProbe: Probe }).__namedStartProbe;
      if (g.quizPromptName) { probe.prompts.push(g.quizPromptName); probe.open = true; }
      if (!probe.open) probe.dom.push(document.body.innerText);
    });
  }
  await page.keyboard.up('ArrowUp');
  const probe = await page.evaluate(() => (window as unknown as { __namedStartProbe: Probe }).__namedStartProbe);
  return { street, probe };
}

export function report(label: string, street: string, probe: Probe) {
  const hit = (s: string) => !!street && s.toLowerCase().includes(street.toLowerCase());
  const canvasHits = [...new Set(probe.texts.filter(hit))];
  const domHits = probe.dom.some(hit);
  const plaques = [...new Set(probe.plaques)];
  console.log(`[${label}] plaque frames naming the street: ${probe.plaques.filter(hit).length} of ${probe.plaques.length} before the first question`);
  const firstQuestion = probe.prompts[0] || '';
  console.log(`[${label}] start street: ${street}`);
  console.log(`[${label}] plaque texts in 10 s: ${JSON.stringify(plaques)}`);
  console.log(`[${label}] canvas strings containing the street: ${JSON.stringify(canvasHits)}; DOM contains it: ${domHits}`);
  console.log(`[${label}] first question: ${firstQuestion || '(none in 10 s)'} (${probe.prompts.length} samples with a question open)`);
  return { canvasHits, domHits, plaques, firstQuestion };
}

test('here mode on a named street prints nothing of it in the first 10 s', async ({ browser }, info) => {
  // Measured 2026-11-09 (#279): it does. Parked at the start, the plaque reads VAN BOETZELAERSTRAAT
  // (roadName === quizCurrentName at spawn, so hudWithholdsRouteName lets it through) until the first
  // question opens; desktop and iphone alike. Expected to fail until the start street is withheld;
  // when it passes, named daily starts become possible (#279 option 4).
  test.fail(true, 'the start street is printed on the plaque at spawn (#279 measurement)');
  test.setTimeout(240_000);
  const context = await browser.newContext({ ...info.project.use, geolocation: AT, permissions: ['geolocation'] });
  const page = await context.newPage();
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await installProbe(page);
  await page.addInitScript(() => {
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ travelMode: 'car', routePattern: 'here', cityId: 'amsterdam', difficulty: 'medium' }));
    localStorage.setItem('canalRecall.returningPlayer.v1', '1');
  });
  await page.goto('/canal-drive/index.html');
  await page.getByRole('button', { name: /start route/i }).click();
  const { street, probe } = await watchRide(page, 10);
  await page.screenshot({ path: `${shots}/named-start-here-${info.project.name}.png` });
  const r = report(`here ${info.project.name}`, street, probe);
  expect(street, 'the ride starts on a named street').not.toBe('');
  expect(r.plaques.filter(p => p && p.toLowerCase() === street.toLowerCase()), 'plaque printed the start street').toEqual([]);
  expect(r.canvasHits, 'a canvas string printed the start street').toEqual([]);
  expect(r.domHits, 'the DOM printed the start street').toBe(false);
  await context.close();
});
