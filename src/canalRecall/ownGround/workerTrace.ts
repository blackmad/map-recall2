// Where a ground cell's time goes inside its worker (lane R5-A #260 step 1, measurement only; pure, no DOM).
//
// The worker keeps a short log of the jobs it ran and the extract files it fetched. For each cell it reports, beside
// its own data-in and build: what ran ahead of it on the same worker while it waited (other cells' data-in and build,
// far blocks, the worker's own init), and how its data-in split between the network (fetch wall time, the part spent
// queued for a connection) and the CPU (gunzip, parse, relief and deck planning).

export interface FetchRecord { path: string; start: number; fetched: number; end: number; bytes: number; stallMs: number;
  /** Lane R5-A #260 step 3 (groundShare.ts): served by the share host without a new fetch; the host's fetch + gunzip it saved; the host's gunzip of a file it fetched for this worker. */
  shared?: boolean; savedMs?: number; hostGunzipMs?: number }
export interface JobRecord { kind: 'cell' | 'far'; key: string; start: number; inputEnd: number; end: number }

export interface AheadSplit {
  /** Cells this worker ran (in part) while the cell waited, and the waited time each phase took. */
  cells: number; cellInputMs: number; cellBuildMs: number;
  far: number; farMs: number;
  /** Waited before the worker's store was ready (the `init` fetches). */
  initMs: number;
  /** Waited with the worker idle (should be 0: the queue runs as soon as a job is there). */
  idleMs: number;
}

export interface FetchSplit {
  /** Files this job fetched, kB after gunzip. */
  files: number; kB: number;
  /** Time with at least one fetch in flight (request → body), ms. */
  netMs: number;
  /** Longest time one file waited for a connection before its request went out (resource timing), ms. */
  stallMaxMs: number;
  /** Gunzip of the files, summed, ms. */
  gunzipMs: number;
  /** Per extract (the path's first segment): [files, kB]. */
  byDir: Record<string, [number, number]>;
  /** The paths fetched (for counting the same file fetched by several workers). */
  paths: string[];
  /** Lane R5-A #260 step 3, with the share host: files served without a new fetch, their kB, the host's fetch + gunzip they saved (ms), the host's gunzip of the rest (ms). */
  shared: number; sharedKB: number; savedMs: number; hostGunzipMs: number;
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Total length of the union of intervals. */
export function unionMs(spans: readonly (readonly [number, number])[]): number {
  const s = [...spans].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, cur0 = -Infinity, cur1 = -Infinity;
  for (const [a, b] of s) {
    if (a > cur1) { if (cur1 > cur0) total += cur1 - cur0; cur0 = a; cur1 = b; } else cur1 = Math.max(cur1, b);
  }
  if (cur1 > cur0) total += cur1 - cur0;
  return total;
}

export class WorkerTrace {
  readonly jobs: JobRecord[] = [];
  readonly fetches: FetchRecord[] = [];
  readyAt = Infinity;
  constructor(readonly initAt = 0, private readonly keep = 400) {}

  job(rec: JobRecord): void { this.jobs.push(rec); if (this.jobs.length > this.keep) this.jobs.shift(); }
  fetch(rec: FetchRecord): void { this.fetches.push(rec); if (this.fetches.length > this.keep) this.fetches.shift(); }

  /** What occupied this worker between a cell's request (`asked`) and its start. */
  ahead(asked: number, start: number): AheadSplit {
    const out: AheadSplit = { cells: 0, cellInputMs: 0, cellBuildMs: 0, far: 0, farMs: 0, initMs: 0, idleMs: 0 };
    if (!(start > asked)) return out;
    out.initMs = overlap(asked, start, this.initAt, this.readyAt);
    for (const j of this.jobs) {
      const total = overlap(asked, start, j.start, j.end);
      if (!total) continue;
      if (j.kind === 'far') { out.far++; out.farMs += total; continue; }
      out.cells++;
      out.cellInputMs += overlap(asked, start, j.start, j.inputEnd);
      out.cellBuildMs += overlap(asked, start, j.inputEnd, j.end);
    }
    out.idleMs = Math.max(0, start - asked - out.initMs - out.farMs - out.cellInputMs - out.cellBuildMs);
    for (const k of Object.keys(out) as (keyof AheadSplit)[]) out[k] = Math.round(out[k]);
    return out;
  }

  /** The fetches that started in [t0, t1) (one job's data-in: the worker runs one job at a time). */
  fetchSplit(t0: number, t1: number): FetchSplit {
    const mine = this.fetches.filter(f => f.start >= t0 && f.start < t1);
    return {
      files: mine.length,
      kB: Math.round(mine.reduce((n, f) => n + f.bytes, 0) / 1024),
      netMs: Math.round(unionMs(mine.map(f => [f.start, f.fetched] as const))),
      stallMaxMs: Math.round(mine.reduce((m, f) => Math.max(m, f.stallMs), 0)),
      gunzipMs: Math.round(mine.reduce((n, f) => n + (f.end - f.fetched), 0)),
      byDir: mine.reduce((o, f) => { const d = f.path.split('/')[0], e = (o[d] ??= [0, 0]); e[0]++; e[1] += Math.round(f.bytes / 1024); return o; }, {} as Record<string, [number, number]>),
      paths: mine.map(f => f.path),
      shared: mine.filter(f => f.shared).length,
      sharedKB: Math.round(mine.reduce((n, f) => n + (f.shared ? f.bytes : 0), 0) / 1024),
      savedMs: Math.round(mine.reduce((n, f) => n + (f.savedMs ?? 0), 0)),
      hostGunzipMs: Math.round(mine.reduce((n, f) => n + (f.hostGunzipMs ?? 0), 0)),
    };
  }
}

/** Lane R5-A #260 step 4: one data-in phase the store timed (GroundStore.phaseHook): phase, key (cell, relief tile or deck id), CPU ms. */
export type PhaseEvent = [phase: string, key: string, ms: number];

export interface PhaseSplit {
  /** Data-in CPU per phase, summed over this job, ms (parse:<extract>, relief:*, decks:*, waydecks, cuts:*, water:openings, assemble). */
  input: Record<string, number>;
  /** The build's own phases (groundCell.ts stats.phases), ms. */
  build: Record<string, number>;
  /** Every keyed event over 1 ms, `phase|key|ms`: the probe counts the same plan computed on more than one worker. */
  events: string[];
}

/** One job's phase events, summed per phase, plus the build's phases. */
export function phaseSplit(events: readonly PhaseEvent[], build?: Record<string, number>): PhaseSplit {
  const input: Record<string, number> = {};
  for (const [phase, , ms] of events) input[phase] = (input[phase] ?? 0) + ms;
  for (const k of Object.keys(input)) input[k] = Math.round(input[k]);
  return { input, build: { ...(build ?? {}) }, events: events.filter(e => e[2] >= 1).map(([p, k, ms]) => `${p}|${k}|${Math.round(ms)}`) };
}
