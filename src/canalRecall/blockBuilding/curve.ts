/**
 * Curved fronts: 3DBAG LoD2.2 keeps a curved wall as a chain of narrow planar facets. Each facet is its own block-kit
 * panel, so a per-panel bay grid restarts on every facet (one bay per facet, or none on facets under 0.6 pitch) and
 * the window rhythm breaks round the curve. Here the chain is one run: panels linked end to end by the run links
 * (`Panel.prev`/`next`, turn under 50 degrees per joint), measured along its arc length, and one bay rhythm is laid
 * along the whole run. Each bay axis lands on the facet holding it and is nudged inside that facet just far enough
 * for its window to fit one planar face (a window never bends over a facet joint); a facet too narrow for a window
 * stays plain wall. The result feeds compose's explicit bay axes (`System.bays.centres`).
 */
import type {Panel} from './panels.ts';

export interface PanelRun {
  /** panel indices left to right (viewer outside) */
  panels: number[];
  /** arc length (m) of each panel's left end from the run start */
  offsets: number[];
  lengthM: number;
  /** signed sum of the joint turns (deg; positive turns to the viewer's right) */
  turnDeg: number;
}

/** Chains of linked panels that all pass `keep`, left to right; single panels are runs of one. */
export function panelRuns(panels: Panel[], keep: (p: Panel) => boolean): PanelRun[] {
  const runs: PanelRun[] = [], seen = new Set<number>();
  const inRun = (i: number) => i >= 0 && keep(panels[i]);
  for (const p of panels) {
    if (!keep(p) || seen.has(p.index) || inRun(p.prev)) continue;
    const list: number[] = [];
    for (let q: Panel | undefined = p; q && !seen.has(q.index); q = inRun(q.next) ? panels[q.next] : undefined) { list.push(q.index); seen.add(q.index); }
    runs.push(measure(panels, list));
  }
  // closed loops (a round tower): every member has an in-run predecessor; start at the lowest index
  for (const p of panels) {
    if (!keep(p) || seen.has(p.index)) continue;
    const list: number[] = [];
    for (let q: Panel | undefined = p; q && !seen.has(q.index); q = inRun(q.next) ? panels[q.next] : undefined) { list.push(q.index); seen.add(q.index); }
    runs.push(measure(panels, list));
  }
  return runs;
}

function measure(panels: Panel[], list: number[]): PanelRun {
  const offsets: number[] = [];
  let s = 0, turn = 0;
  list.forEach((pi, k) => {
    const p = panels[pi];
    offsets.push(s); s += p.uMax - p.uMin;
    if (k > 0) {
      const a = panels[list[k - 1]].n, b = p.n;
      // n x n' (y component) is positive when the wall turns to the viewer's right (convex corner seen from outside)
      turn += Math.atan2(a[2] * b[0] - a[0] * b[2], a[0] * b[0] + a[2] * b[2]) * 180 / Math.PI;
    }
  });
  return {panels: list, offsets, lengthM: s, turnDeg: turn};
}

/**
 * Bay axes (u from each panel's `uMin`) for one rhythm of `bays` along the run: axis k at arc length (k + 0.5) x
 * pitch + a phase shift, on the facet that holds it, nudged so `halfWin` + `margin` fits inside the facet. The phase
 * (20 steps across one pitch) is the one that needs the least nudging, each dropped axis counting a full pitch, so the
 * rhythm lines up with the facets where 3DBAG cut them at the window piers. Returns a map panel index -> axes; facets
 * narrower than a window get none.
 */
export function runBayAxes(panels: Panel[], run: PanelRun, bays: number, halfWin: number, margin = 0.05): Map<number, number[]> {
  const pitch = run.lengthM / Math.max(1, bays), width = (i: number) => panels[run.panels[i]].uMax - panels[run.panels[i]].uMin;
  const layout = (phase: number) => {
    const out = new Map<number, number[]>(run.panels.map(pi => [pi, [] as number[]]));
    let cost = 0;
    for (let k = 0; k < bays; k++) {
      const s = (k + 0.5) * pitch + phase;
      if (s < 0 || s > run.lengthM) { cost += pitch; continue; }
      let j = run.offsets.findIndex((o, i) => s >= o && s < o + width(i));
      if (j < 0) j = run.panels.length - 1;
      const W = width(j), lo = halfWin + margin, hi = W - halfWin - margin;
      if (hi < lo) { cost += pitch; continue; }
      const u = Math.min(hi, Math.max(lo, s - run.offsets[j]));
      cost += Math.abs(u - (s - run.offsets[j]));
      out.get(run.panels[j])!.push(Math.round(u * 1000) / 1000);
    }
    return {out, cost};
  };
  let best = layout(0);
  for (let i = 1; i < 20; i++) for (const phase of [i * pitch / 40, -i * pitch / 40]) { const l = layout(phase); if (l.cost < best.cost - 1e-6) best = l; }
  return best.out;
}
