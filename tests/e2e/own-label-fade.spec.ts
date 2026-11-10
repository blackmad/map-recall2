import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// #288 — the own engine's labels fade in and out (ownMap/labelFade.ts) instead
// of popping. A label the landmark question withholds must leave like any
// other label: a pop is a tell of the question's answer.
//
// The rider stands still under `?engine=own` (ENGINE=own, or forced here); a
// drawn POI or street name is put into `landmarkApproachWithheld` (what the
// approach does, #281) and later released. Every animation frame samples the
// label layer's `placed` alpha and a pixel probe of the label canvas over the
// label's last box, so the alpha ramp is read off the pixels too.
// FADE_SHOTS=<dir> writes the 6-frame strips (100 ms apart) as jpg.

const SHOTS = process.env.FADE_SHOTS || '';

interface Sample { t: number; layer: number; pixel: number }

async function sampleAround(page: Page, name: string, change: 'withhold' | 'release'): Promise<{ samples: Sample[]; strip: string }> {
  return page.evaluate(async ({ name, change }) => {
    const g = (window as any).canalRecallGame;
    const layer = g.vectorMap._labels;
    const canvas: HTMLCanvasElement = layer.canvas;
    const ctx = canvas.getContext('2d')!;
    const ratio = canvas.width / canvas.clientWidth || 1;
    let box: [number, number, number, number] | null = null;
    const boxOf = (l: any): [number, number, number, number] => {
      const pts = l.glyphs ? l.glyphs.map((q: any) => [q.x, q.y]) : [[l.x - l.text.length * l.size * 0.3, l.y], [l.x + l.text.length * l.size * 0.3, l.y]];
      const xs = pts.map((p: number[]) => p[0]), ys = pts.map((p: number[]) => p[1]);
      return [Math.min(...xs) - l.size, Math.min(...ys) - l.size, Math.max(...xs) + l.size, Math.max(...ys) + l.size];
    };
    // `drawn` (with alpha) since #288; before it only the winners, at full strength.
    const find = () => ((layer.drawn ?? layer.placed) as any[]).find(l => l.text === name);
    const first = find();
    if (first) box = boxOf(first);
    const pixel = () => {
      if (!box) return 0;
      const x0 = Math.max(0, Math.floor(box[0] * ratio)), y0 = Math.max(0, Math.floor(box[1] * ratio));
      const w = Math.min(canvas.width - x0, Math.ceil((box[2] - box[0]) * ratio)), h = Math.min(canvas.height - y0, Math.ceil((box[3] - box[1]) * ratio));
      if (w <= 0 || h <= 0) return 0;
      const d = ctx.getImageData(x0, y0, w, h).data;
      let max = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i];
      return max / 255;
    };
    // The strip: 6 crops 100 ms apart, the first just before the change.
    const cw = 260, ch = 70, strip = document.createElement('canvas');
    strip.width = cw * 6; strip.height = ch;
    const sctx = strip.getContext('2d')!;
    sctx.fillStyle = '#e9e4d8'; sctx.fillRect(0, 0, strip.width, ch);
    const grab = (k: number) => {
      if (!box) return;
      const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
      sctx.drawImage(canvas, (cx - cw / 2) * ratio, (cy - ch / 2) * ratio, cw * ratio, ch * ratio, k * cw, 0, cw, ch);
      sctx.fillStyle = '#555'; sctx.font = '11px sans-serif'; sctx.fillText(k === 0 ? `before ${change}` : `+${k * 100} ms`, k * cw + 4, ch - 4);
      sctx.strokeStyle = '#bbb'; sctx.strokeRect(k * cw + 0.5, 0.5, cw - 1, ch - 1);
    };
    const samples: { t: number; layer: number; pixel: number }[] = [];
    const t0 = performance.now();
    let changedAt = 0, nextShot = 0;
    await new Promise<void>(resolve => {
      const tick = () => {
        const now = performance.now();
        const l = find();
        if (l) box = boxOf(l);
        samples.push({ t: Math.round(now - t0), layer: l ? Math.round((l.alpha ?? 1) * 1000) / 1000 : 0, pixel: Math.round(pixel() * 1000) / 1000 });
        if (!changedAt && now - t0 > 150) {
          grab(0); nextShot = 1;
          changedAt = now;
          g.landmarkApproachWithheld = change === 'withhold' ? [name] : [];
        } else if (changedAt && nextShot < 6 && now - changedAt >= nextShot * 100 - 8) grab(nextShot++);
        if (changedAt && now - changedAt > 900) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { samples: samples.map(s => ({ ...s, t: s.t - Math.round(changedAt - t0) })), strip: strip.toDataURL('image/jpeg', 0.82) };
  }, { name, change });
}

test('own engine: a withheld label fades out and back in over several frames', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one engine path; the phone draws the same canvas');
  test.setTimeout(180_000);
  if (process.env.ENGINE !== 'own') await page.addInitScript(() => { (window as any).__canalRecallEngine = 'own'; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?landmarkQuestions=0' });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine)).toBe('own');
  // Stand still; wait for labels (a POI preferably: point labels are what the approach withholds).
  // With the questions off the runtime releases any approach every tick: hold the list this probe sets.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._releaseLandmarkApproach = () => {};
    const p = g.player; p.speed = 0; p.vx = 0; p.vy = 0;
  });
  const name = await expect.poll(() => page.evaluate(() => {
    const placed = (window as any).canalRecallGame.vectorMap._labels.placed as any[];
    return (placed.find(l => l.kind === 'poi') ?? placed.find(l => l.kind === 'street') ?? placed[0])?.text ?? '';
  }), { timeout: 60_000 }).not.toBe('').then(() => page.evaluate(() => {
    const placed = (window as any).canalRecallGame.vectorMap._labels.placed as any[];
    return (placed.find(l => l.kind === 'poi') ?? placed.find(l => l.kind === 'street') ?? placed[0]).text as string;
  }));
  await page.waitForTimeout(1000);
  const out = await sampleAround(page, name, 'withhold');
  await page.waitForTimeout(500);
  const back = await sampleAround(page, name, 'release');
  const after = (s: Sample[]) => s.filter(x => x.t >= 0 && x.t <= 600);
  const report = { name, out: after(out.samples), in: after(back.samples) };
  info.annotations.push({ type: 'fade', description: JSON.stringify(report) });
  console.log(JSON.stringify(report));
  writeFileSync(info.outputPath('fade.json'), JSON.stringify(report));
  if (SHOTS) {
    writeFileSync(`${SHOTS}/fade.json`, JSON.stringify(report));
    writeFileSync(`${SHOTS}/fade-out.jpg`, Buffer.from(out.strip.split(',')[1], 'base64'));
    writeFileSync(`${SHOTS}/fade-in.jpg`, Buffer.from(back.strip.split(',')[1], 'base64'));
  }
  // Acceptance (#288): a monotone ramp over at least 3 frames each way, read off the pixels.
  const ramp = (s: Sample[], dir: 1 | -1) => {
    const mid = s.filter(x => x.pixel > 0.03 && x.pixel < 0.85 * Math.max(...s.map(y => y.pixel), 0.01));
    const mono = s.every((x, i) => i === 0 || dir * (x.layer - s[i - 1].layer) >= -1e-6);
    return { mid: mid.length, mono };
  };
  const o = ramp(report.out, -1), i = ramp(report.in, 1);
  expect(o.mid, `fade out: ${JSON.stringify(report.out)}`).toBeGreaterThanOrEqual(3);
  expect(o.mono, 'fade out is monotone').toBe(true);
  expect(i.mid, `fade in: ${JSON.stringify(report.in)}`).toBeGreaterThanOrEqual(3);
  expect(i.mono, 'fade in is monotone').toBe(true);
  // The ledger counts a fading-out label as drawn until its alpha is 0.
});
