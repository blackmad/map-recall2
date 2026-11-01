import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { routeFreshSignatureBundle } from '../../scripts/landmarks/fresh-signature-bundle';

// Bespoke bridge models (lane landmarks-bridges-20261101, #175): ride across the Blauwbrug (BRU0236) and the Magere
// Brug (BRU0242) in both directions on three lines along each bridge and check the rider stays on the model's deck:
// the bike's height (the game's riderPose on the own ground) never sits below the model's deck slab top (no sinking
// into the bridge) nor more than 25 cm above it (no float), and steps by under 15 cm per frame. The model's base is the
// one the runtime stood it on (its signature entry's groundBase), so a misplaced model fails here too.
//   PW_PORT=4824 npx playwright test bespoke-bridges --project=desktop --workers=1
// Needs the own-ground worker bundle that skips the kit body for bespoke bridges (bespokeBridges.ts).

const OUT = 'artifacts/bespoke-bridges';
type Footprints = { id: string; anchor: [number, number]; bearingDegrees: number; landmarkBase: number; rideProfile: [number, number][] };
const BRIDGES: { id: string; deck: string; halfLength: number; lines: number[] }[] = [
  { id: 'blauwbrug', deck: 'BRU0236', halfLength: 24.4, lines: [-5.5, 0, 4.5] },
  { id: 'magere-brug', deck: 'BRU0242', halfLength: 36.9, lines: [-1.5, 0, 1.5] },
];
const SLAB_BELOW_RIDE_M = 0.06;

test.beforeEach(({ page }) => page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; (window as any).__canalRecallKeepGroundArrays = true; }));

const at = (fp: Footprints, along: number, right: number): [number, number] => {
  const t = fp.bearingDegrees * Math.PI / 180, ue = Math.sin(t), un = Math.cos(t);
  const east = ue * along + un * right, north = un * along - ue * right;
  return [fp.anchor[0] + east / (111320 * Math.cos(fp.anchor[1] * Math.PI / 180)), fp.anchor[1] + north / 111320];
};
const profileZ = (p: [number, number][], a: number) => {
  if (a <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (a <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (a - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
  return p[p.length - 1][1];
};

async function teleport(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
}

test('ride across the bespoke bridges: on the deck, no step, no float', async ({ page }, info) => {
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await routeFreshSignatureBundle(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const report: Record<string, unknown> = {};
  for (const b of BRIDGES) {
    const fp = JSON.parse(readFileSync(`scripts/landmarks/${b.id}-footprints.json`, 'utf8')) as Footprints;
    const runs: Record<string, unknown>[] = [];
    for (const right of b.lines) for (const dir of [1, -1]) {
      const start = at(fp, -dir * (b.halfLength + 25), right), bearing = (fp.bearingDegrees + (dir > 0 ? 0 : 180)) % 360;
      await teleport(page, start[0], start[1], bearing);
      // The ground, the cell and the model streamed in and stood on the relief.
      await page.waitForFunction(id => {
        const vm = (window as any).canalRecallGame.vectorMap, s = vm.ownGroundStatus?.(), sig = vm._signatureLandmarks;
        const e = (sig?._entries || []).find((x: any) => x.spec.id === id);
        return s?.ready && !s.queued && sig?.shown?.has(id) && e && e.groundBase !== 0;
      }, b.id, { timeout: 180_000 });
      const samples: { a: number; h: number; base: number }[] = await page.evaluate(({ fp, right, dir, half, id }) => new Promise(resolve => {
        const g = (window as any).canalRecallGame, vm = g.vectorMap, ground = vm._ownGround, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
        const entry = vm._signatureLandmarks._entries.find((x: any) => x.spec.id === id);
        const t = fp.bearingDegrees * Math.PI / 180, ue = Math.sin(t), un = Math.cos(t), mLng = 111320 * Math.cos(fp.anchor[1] * Math.PI / 180);
        const ll = (a: number): [number, number] => [fp.anchor[0] + (ue * a + un * right) / mLng, fp.anchor[1] + (un * a - ue * right) / 111320];
        const total = 2 * (half + 25), t0 = performance.now(), out: { a: number; h: number; base: number }[] = [];
        const angle = Math.atan2(-Math.cos(t + (dir > 0 ? 0 : Math.PI)), Math.sin(t + (dir > 0 ? 0 : Math.PI)));
        const step = (now: number) => {
          const d = Math.min(total, (now - t0) / 1000 * 5.5), a = dir * (-(half + 25) + d), [lng, lat] = ll(a);
          g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
          g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
          Object.assign(g.player, { speed: 0, vx: 0, vy: 0, angle });
          out.push({ a, h: ground.riderPose([lng, lat], angle).heightM, base: entry.groundBase });
          if (d < total) requestAnimationFrame(step); else resolve(out);
        };
        requestAnimationFrame(step);
      }), { fp, right, dir, half: b.halfLength, id: b.id });
      // Shot mid-crossing (chase view), first run only.
      if (!runs.length) {
        await teleport(page, ...at(fp, 0, right), fp.bearingDegrees);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${OUT}/${info.project.name}-${b.id}-crossing.png` });
      }
      const base = samples[samples.length - 1].base, shift = base - fp.landmarkBase;
      let below = 0, above = 0, step = 0, n = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (Math.abs(s.a) > b.halfLength - 1.5) continue;
        n++;
        const deck = profileZ(fp.rideProfile, s.a) - SLAB_BELOW_RIDE_M + shift, gap = s.h - deck;
        below = Math.max(below, -gap); above = Math.max(above, gap);
        if (i && Math.abs(samples[i - 1].a) <= b.halfLength - 1.5) step = Math.max(step, Math.abs(s.h - samples[i - 1].h));
      }
      runs.push({ right, dir, samples: n, base: +base.toFixed(3), baseShift: +shift.toFixed(3), sinksBelowDeckM: +below.toFixed(3), floatsAboveDeckM: +above.toFixed(3), largestFrameStepM: +step.toFixed(3) });
      expect(n, `${b.id} line ${right} dir ${dir}: frames on the deck`).toBeGreaterThan(20);
      expect(Math.abs(shift), `${b.id}: the runtime stood the model on base ${base} (built for ${fp.landmarkBase})`).toBeLessThan(0.05);
      expect(below, `${b.id} line ${right} dir ${dir}: the rider sinks below the model's deck`).toBeLessThanOrEqual(0.0);
      expect(above, `${b.id} line ${right} dir ${dir}: the rider floats above the model's deck`).toBeLessThan(0.25);
      expect(step, `${b.id} line ${right} dir ${dir}: a step on the deck`).toBeLessThan(0.15);
    }
    report[b.id] = runs;
  }
  writeFileSync(`${OUT}/${info.project.name}-report.json`, JSON.stringify(report, null, 1));
  expect(errors).toEqual([]);
});
