import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pop-in budget (2026-10-16, docs/perf-pop-in-20261016.md). Opt-in measurement, desktop only:
//   PERF_POPIN=1 PW_PORT=4562 npx playwright test pop-in --project=desktop
// Rides the motion-stutter route (Noorderkerk -> Westermoskee) at a fast steady 200 px/s with a 60 ms /
// 40 Mbit/s network, so streaming has to keep up, and counts what appears on screen that the camera's motion
// does not explain (scripts/pop-in.mjs: homography-compensated dE76 > 20 blobs of at least 8x8 screen px,
// attributed to the streaming step that changed). Runs scripts/pop-in.mjs against the Playwright web server,
// in its own headless Chrome; the JSON and the worst frames' strips land in artifacts/perf/pop-in/.
// `POPIN_FLAGS=LookAhead=false,HoldBasemap=false` measures the pre-fix streaming (the budget should fail).
test.skip(!process.env.PERF_POPIN, 'set PERF_POPIN=1 to measure');

/**
 * Pop-in px per second of riding, attributable kinds only (unexplained residue is mostly parallax of tall
 * towers the plane model cannot cancel; it is reported, not budgeted), and the own-ground cell latency.
 * 2026-10-16 after the fixes, main 565f0ec5a, load under 20: attributed 479-493 px/s (fixes off 360-449),
 * cell latency median 752-887 ms (off 757-1110; 7.9 s on a loaded machine before the ground queue).
 * The steady ride at light load had little pop-in left either way; the budget is about 2x today's, a guard
 * against the stalls the fixes removed (a whole district at once is 100k-300k px in one frame, 2-5k px/s
 * over the minute). See the doc for the per-source tables.
 */
const POPIN_BUDGET = { attributedPxPerS: 1000, groundLatencyMedianMs: 1500 };

test('pop-in: fast steady ride through the Jordaan stays inside the budget', async ({ browserName }, info) => {
  test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'desktop budget');
  test.setTimeout(900_000);
  const port = process.env.PW_PORT ?? '4388';
  const dir = join('artifacts', 'perf', 'pop-in');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'car-steady.json');
  const args = ['scripts/pop-in.mjs', out, '--route', 'car', '--speed', '200', '--net', '60,40', '--warmup', '10', '--measure', '60', '--frames', join(dir, 'frames')];
  if (process.env.POPIN_FLAGS) args.push('--flags', process.env.POPIN_FLAGS);
  execFileSync(process.execPath, args, { env: { ...process.env, PORT: port }, stdio: 'inherit', timeout: 880_000 });
  const run = JSON.parse(readFileSync(out, 'utf8')).results[0];
  const attributed = Object.entries(run.sources as Record<string, { pxPerS: number }>)
    .filter(([kind]) => kind !== 'unexplained').reduce((sum, [, s]) => sum + s.pxPerS, 0);
  console.log(`pop-in ${run.popPxPerS} px/s (attributed ${attributed}), ground latency median ${run.ground?.latencyMsMedian} ms, heap ${run.heapMB.start}->${run.heapMB.end} MB`);
  expect(run.errors, 'page errors').toEqual([]);
  expect(attributed, 'attributed pop-in px/s').toBeLessThanOrEqual(POPIN_BUDGET.attributedPxPerS);
  if (run.ground) expect(run.ground.latencyMsMedian, 'own-ground cell latency median').toBeLessThanOrEqual(POPIN_BUDGET.groundLatencyMedianMs);
});
