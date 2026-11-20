/**
 * Belt review render worker (plan R2): a long-lived child process holding one house-preview session (tiles, neighbours,
 * atlas stay warm). It runs out of the server process because house preview patches globals (scripts/world/useBrowserMath
 * swaps Math.cos/sin, nodeDom installs `document` and `Image`), which must not leak into the web server.
 *
 * Protocol (process IPC): in  {id, pandId, design, ppm, out}
 *                         out {id, ok: true, file, measure, ms, timings} | {id, ok: false, error}
 */
import path from 'node:path';
import { PreviewSession, parseArgs, renderGeneric } from '../../house-preview/preview.ts';

type Job = { id: number; pandId: string; design: Record<string, unknown>; ppm: number; out: string };
const session = new PreviewSession('photo');
let chain: Promise<unknown> = Promise.resolve();

process.on('message', (job: Job) => {
  chain = chain.then(async () => {
    const t0 = performance.now();
    try {
      const args = { ...parseArgs([]), ppm: job.ppm, out: job.out, route: 'spec' as const };
      const r = await renderGeneric(session, job.pandId, args, { source: 'belt-review', pandId: job.pandId, design: job.design }, 'spec', 'belt review: description + edits');
      const m = r.measure as Record<string, any>;
      process.send!({
        id: job.id, ok: true, file: path.join(job.out, 'front.png'), ms: Math.round(performance.now() - t0), timings: r.timings,
        measure: { heights: m.heights, layout: m.layout, wall: m.wall, overrides: m.overrides, render: m.render },
      });
    } catch (e) {
      process.send!({ id: job.id, ok: false, error: String((e as Error)?.stack ?? e).slice(0, 2000), ms: Math.round(performance.now() - t0) });
    }
  });
});
process.send!({ ready: true });
