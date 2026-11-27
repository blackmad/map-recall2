/**
 * Jettied (oversailing) timber front for landmark builders: each storey stands further out over the street than the one
 * below, the step either a square jetty or a sloped boarded apron (the "overstek" of a timber house). Added for In 't Aepjen,
 * Zeedijk 1 (lane landmarks-r19-e, 2026-11-27), whose first attempt drew the storeys as slabs 0.15-0.42 m apart: from the
 * street the photo is all overhang and sloping undersides, the render read as a flat front (blind judge 2026-11-21).
 *
 * Pure geometry in a wall-section frame: `out` metres in front of the wall plane (positive towards the street), `y` up.
 * The caller extrudes the polygons along the wall (scripts/landmarks/wallen-more-kit.ts jettyFront).
 */
export type SectionPoint = [number, number];   // [out, y]

export interface JettyStorey {
  /** Bottom and top of the storey's front (m). Storeys are listed bottom up and must touch: y0 equals the previous y1. */
  y0: number; y1: number;
  /** Where the storey's front stands (m in front of the wall plane). Never less than the storey below: jetties only step out. */
  out: number;
  /** Height of a sloped boarded apron at the storey's foot, rising from the face below to this face (0 or absent: a square step). */
  apron?: number;
}

function check(storeys: JettyStorey[]) {
  if (!storeys.length) throw new Error('jettyProfile: at least one storey');
  storeys.forEach((s, i) => {
    if (!(s.y1 > s.y0)) throw new Error(`jettyProfile: storey ${i} has y1 <= y0`);
    if ((s.apron ?? 0) < 0 || (s.apron ?? 0) >= s.y1 - s.y0) throw new Error(`jettyProfile: storey ${i} apron outside [0, height)`);
    if (i > 0) {
      const p = storeys[i - 1];
      if (Math.abs(s.y0 - p.y1) > 1e-6) throw new Error(`jettyProfile: storey ${i} does not start where storey ${i - 1} ends`);
      if (s.out < p.out) throw new Error(`jettyProfile: storey ${i} stands behind the one below (jetties only step out)`);
    }
  });
}

/**
 * The closed section of the whole front: from (back, bottom) along the street face, every square step or sloped apron, to
 * (back, top). Counter-clockwise in (out, y), no repeated points, so it extrudes as one solid. `back` (default -0.1) is the
 * section's back line, behind the wall plane.
 */
export function jettyProfile(storeys: JettyStorey[], back = -0.1): SectionPoint[] {
  check(storeys);
  if (!(back < storeys[0].out)) throw new Error('jettyProfile: back must lie behind the lowest face');
  const pts: SectionPoint[] = [[back, storeys[0].y0]];
  const push = (p: SectionPoint) => { const q = pts[pts.length - 1]; if (Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) pts.push(p); };
  storeys.forEach((s, i) => {
    const below = i === 0 ? s.out : storeys[i - 1].out;
    if (s.apron && s.out > below) { push([below, s.y0]); push([s.out, s.y0 + s.apron]); }
    else { push([below, s.y0]); push([s.out, s.y0]); }
    push([s.out, s.y1]);
  });
  push([back, storeys[storeys.length - 1].y1]);
  return pts;
}

/** The face line of the front at height y (m in front of the wall plane): on a storey face, or interpolated up an apron. */
export function faceAt(storeys: JettyStorey[], y: number): number {
  check(storeys);
  for (let i = 0; i < storeys.length; i++) {
    const s = storeys[i];
    if (y < s.y0 - 1e-9 || y > s.y1 + 1e-9) continue;
    const below = i === 0 ? s.out : storeys[i - 1].out, a = s.apron ?? 0;
    if (a > 0 && y < s.y0 + a) return below + (s.out - below) * (y - s.y0) / a;
    return s.out;
  }
  throw new Error(`faceAt: ${y} outside the front`);
}

/**
 * Lap (clap) boards over a flat face at `out` from y0 to y1: each board a thin wedge, flush with the face at its top and kicked
 * `lap` out at its foot, so the boards cast the stepped shadow lines of weatherboarding from street level. The wedge's back
 * sits `embed` behind the face and each board stops `gap` short of the next, so no wedge face lies on another face.
 */
export function clapboards(out: number, y0: number, y1: number, o: {board: number; lap: number; embed?: number; gap?: number}): SectionPoint[][] {
  const embed = o.embed ?? 0.02, gap = o.gap ?? 0.01;
  if (!(o.board > gap) || !(o.lap > 0) || !(y1 > y0)) throw new Error('clapboards: board > gap, lap > 0, y1 > y0');
  const n = Math.max(1, Math.round((y1 - y0) / o.board)), h = (y1 - y0) / n;
  const res: SectionPoint[][] = [];
  for (let i = 0; i < n; i++) {
    const a = y0 + i * h, b = a + h - gap;
    res.push([[out - embed, a], [out + o.lap, a], [out, b], [out - embed, b]]);
  }
  return res;
}

/**
 * The same section cut per storey (one closed counter-clockwise polygon each, bottom up), so a builder can colour each
 * storey's boarding on its own: storey i runs from (back, y0) along its apron or step to its face and back at y1. The
 * polygons tile jettyProfile's section exactly.
 */
export function jettySections(storeys: JettyStorey[], back = -0.1): SectionPoint[][] {
  check(storeys);
  if (!(back < storeys[0].out)) throw new Error('jettySections: back must lie behind the lowest face');
  return storeys.map((s, i) => {
    const below = i === 0 ? s.out : storeys[i - 1].out, a = s.apron ?? 0;
    const foot: SectionPoint[] = a > 0 && s.out > below ? [[below, s.y0], [s.out, s.y0 + a]] : s.out > below ? [[below, s.y0], [s.out, s.y0]] : [[s.out, s.y0]];
    return [[back, s.y0], ...foot, [s.out, s.y1], [back, s.y1]] as SectionPoint[];
  });
}
