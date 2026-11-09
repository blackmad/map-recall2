import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Lane M1 (#312, needs-david #296 item 1): "the default ride draws no POI labels: not 'by design' until measured".
// A normal surprise ride (fresh profile, default start, no seeded random, no aborted tiles) for RIDE_SECONDS
// (default 90), sampling the label layers every 500 ms. Measures only; nothing here changes the game.
//
//   PROD=1 POI_TARGET=prod  [POI_ENGINE=own] PW_PORT=4729 /tmp/canal-pw.sh npx playwright test poi-labels-production --project=desktop
//   PROD=1 POI_TARGET=local [POI_ENGINE=own] ...   (the dev server on PW_PORT; playwright.config starts it)
// Output: artifacts/poi-labels/<target>-<engine>-<project>.json and .jpg (a frame mid-ride).
const OUT = process.env.POI_OUT || 'artifacts/poi-labels';
const PROD_BASE = process.env.POI_PROD_BASE || 'https://rideamsterdam.nl';
const SECONDS = Number(process.env.RIDE_SECONDS || 90);

test('poi labels on a normal surprise ride', async ({ page, baseURL }, info) => {
  test.skip(!process.env.PROD, 'set PROD=1 to measure (POI_TARGET=prod|local, POI_ENGINE=own|maplibre)');
  test.setTimeout(SECONDS * 1000 + 360_000);
  const target = process.env.POI_TARGET === 'local' ? 'local' : 'prod';
  const engine = process.env.POI_ENGINE === 'own' ? 'own' : 'default';
  const query = engine === 'own' ? '?engine=own' : '';
  const url = target === 'prod' ? `${PROD_BASE}/ride${query}` : `${baseURL}/canal-drive/${query}`;
  const consoleErrors: string[] = [];
  page.on('pageerror', e => consoleErrors.push(String(e.message).slice(0, 200)));

  let deployed: unknown = null;
  if (target === 'prod') deployed = await (await page.request.get(`${PROD_BASE}/deployment.json`)).json().catch(() => null);

  await page.goto(url);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame)), { timeout: 120_000 }).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible({ timeout: 120_000 });
  const setup = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const sel = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? null;
    return { engine: g.vectorMap?.engine ?? 'maplibre', travel: sel('travel-mode'), view: sel('view-mode'), url: location.href,
      activeChoices: [...document.querySelectorAll('[data-choice].active')].map(e => (e as HTMLElement).dataset.choice) };
  });
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 240_000, polling: 500 });
  await page.waitForTimeout(4000);

  // Probe: what each label layer has drawn right now, POI apart from street/water/hood.
  const probe = () => page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    const out: any = { engine: vm?.engine ?? 'maplibre', poi: 0, poiNames: [] as string[], street: 0, hood: 0, candidates: 0, inView: 0, planDrawn: 0, budget: 0 };
    const overlay = vm?._labelOverlay;
    if (overlay) {
      const els = [...overlay.root.querySelectorAll('.l')].filter((el: any) => el.style.opacity && el.style.opacity !== '0');
      out.poi = els.length; out.poiNames = els.map((el: any) => el.dataset.mapLabel);
      Object.assign(out, { candidates: overlay.stats.candidates, inView: overlay.stats.inView, planDrawn: overlay.stats.drawn, budget: overlay.stats.budget });
      out.street = (g.track?.lastDrawnLabels || []).length;
    }
    const layer = vm?._labels;
    if (layer?.drawn) {
      const by = (k: string) => layer.drawn.filter((l: any) => l.kind === k && (l.alpha ?? 1) > 0.05);
      out.poi = by('poi').length; out.poiNames = by('poi').map((l: any) => l.text);
      out.street = by('street').length + by('water').length; out.hood = by('hood').length;
      out.candidates = layer.stats.candidates;
    }
    out.state = g.state; out.speed = g.player?.speed; out.pos = [Math.round(g.player?.x), Math.round(g.player?.y)];
    out.labelsOff = vm?._labelsVisible === false; out.quizQuiet = !!vm?._quizQuietMap;
    out.hiddenName = g.quizPromptName || g.quizCandidateName || ''; out.approach = (g.landmarkApproachWithheld || []).length;
    return out;
  });

  const samples: any[] = [];
  const start = Date.now();
  let shot = false;
  await page.keyboard.down('ArrowUp');
  while (Date.now() - start < SECONDS * 1000) {
    await page.waitForTimeout(500);
    const s = await probe();
    s.t = Math.round((Date.now() - start) / 100) / 10;
    samples.push(s);
    // Stuck on a wall or a quiz card: nudge left.
    if (samples.length % 10 === 0 && (s.speed ?? 0) < 1) { await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft'); }
    if (!shot && s.t > SECONDS / 2) {
      shot = true;
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/${target}-${engine}-${info.project.name}.jpg`, type: 'jpeg', quality: 78 });
    }
  }
  await page.keyboard.up('ArrowUp');

  const max = (f: (s: any) => number) => Math.max(0, ...samples.map(f));
  const summary = {
    target, engine, project: info.project.name, deployed, setup, seconds: SECONDS, samples: samples.length,
    poiMaxPerFrame: max(s => s.poi), poiSamplesWithAtLeast1: samples.filter(s => s.poi >= 1).length,
    streetMax: max(s => s.street), streetSamplesWithAtLeast1: samples.filter(s => s.street >= 1).length,
    hoodMax: max(s => s.hood), candidatesMax: max(s => s.candidates), inViewMax: max(s => s.inView), planDrawnMax: max(s => s.planDrawn),
    budgetMax: max(s => s.budget),
    poiNames: [...new Set(samples.flatMap(s => s.poiNames))].slice(0, 40),
    flags: { labelsOffAny: samples.some(s => s.labelsOff), quizQuietAny: samples.some(s => s.quizQuiet), approachAny: samples.some(s => s.approach > 0), hiddenNames: [...new Set(samples.map(s => s.hiddenName).filter(Boolean))] },
    travelledPx: Math.round(Math.hypot(samples[samples.length - 1].pos[0] - samples[0].pos[0], samples[samples.length - 1].pos[1] - samples[0].pos[1])),
    consoleErrors: consoleErrors.slice(0, 5),
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${target}-${engine}-${info.project.name}.json`, JSON.stringify({ summary, samples }, null, 1));
  console.log('POI_LABELS ' + JSON.stringify(summary));
});
