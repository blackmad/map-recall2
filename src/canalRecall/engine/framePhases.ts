// `?framePhases=1` (#129): where the own engine's animation-frame callback spends its time, phase by phase: the
// simulation steps, the game's frame, the shared frame's participants (beforeRender), the three.js submits (main,
// overlay), the labels and the `render` listeners. Off by default; when off every call site pays one null check.
// Read from `window.__canalRecallFramePhases`: totals per phase and the slowest frames with their phases.

export type FramePhaseReport = { frames: number; totalMs: number; totals: Record<string, number>; worst: { ms: number; phases: Record<string, number> }[] };

export class FramePhases {
  frames = 0;
  totalMs = 0;
  readonly totals: Record<string, number> = {};
  readonly worst: { ms: number; phases: Record<string, number> }[] = [];
  private current: Record<string, number> = {};
  constructor(private readonly keepWorst = 12) {}

  add(phase: string, ms: number): void {
    this.current[phase] = (this.current[phase] ?? 0) + ms;
    this.totals[phase] = (this.totals[phase] ?? 0) + ms;
  }
  /** Close the frame that took `ms` in all. */
  end(ms: number): void {
    this.frames++;
    this.totalMs += ms;
    const phases = this.current;
    this.current = {};
    if (this.worst.length < this.keepWorst || ms > this.worst[this.worst.length - 1].ms) {
      this.worst.push({ ms, phases });
      this.worst.sort((a, b) => b.ms - a.ms);
      if (this.worst.length > this.keepWorst) this.worst.length = this.keepWorst;
    }
  }
  report(): FramePhaseReport {
    const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 10) / 10]));
    return { frames: this.frames, totalMs: Math.round(this.totalMs), totals: round(this.totals), worst: this.worst.map(w => ({ ms: Math.round(w.ms * 10) / 10, phases: round(w.phases) })) };
  }
}

/** The page's recorder under `?framePhases=1` (shared by the engine's modules through `globalThis`), else null. */
export function framePhases(): FramePhases | null {
  const g = globalThis as { __canalRecallFramePhaseRecorder?: FramePhases | null; location?: { search?: string }; __canalRecallFramePhases?: () => FramePhaseReport };
  if (g.__canalRecallFramePhaseRecorder !== undefined) return g.__canalRecallFramePhaseRecorder;
  const on = /[?&]framePhases=1\b/.test(g.location?.search ?? '');
  const rec = on ? new FramePhases() : null;
  g.__canalRecallFramePhaseRecorder = rec;
  if (rec) g.__canalRecallFramePhases = () => rec.report();
  return rec;
}
