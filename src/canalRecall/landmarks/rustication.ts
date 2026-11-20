/**
 * Rusticated masonry: the block layout of a rusticated base (proud ashlar blocks parted by V-joints), in running bond,
 * cut round the openings it frames.
 *
 * Why: the granite basement of the Hoofdpostkantoor / Magna Plaza (1895-99) is rock-faced rustication, blocks a few cm
 * proud with deep joints, and it is what the eye reads at pavement level. The kit drew it as one flat slab with grey
 * stripes. Every rusticated plinth of the 19th-century public buildings (Rijksmuseum, Centraal Station, the banks on
 * the Herengracht and Vijzelstraat) has the same layout problem: blocks in courses, joints staggered, blocks cut short
 * against a window and never bridging one.
 *
 * Pure layout, no three.js: (t, y) in the wall plane, t along the wall (viewer's left to right), y up; the builder adapter
 * (scripts/landmarks/gothic-tower-kit.ts `rusticatedBase`) extrudes each block as a frustum whose back face is the full
 * block and whose front face is inset by the joint, which is the V. Nothing changes for models that do not call it.
 */
export interface RusticBlock {t0: number; t1: number; y0: number; y1: number}

export interface RusticationOptions {
  t0: number; t1: number; y0: number; y1: number;
  /** Course height and nominal block length (m). */
  course: number; block: number;
  /** Rectangles the rustication stops round (openings with their surround), [t0, y0, t1, y1]. */
  holes?: [number, number, number, number][];
  /** Shortest block kept (m); a shorter offcut is merged into its neighbour or dropped beside a hole. */
  minBlock?: number;
}

/**
 * Courses from y0 up (the top course is cut to y1), blocks of `block` length in running bond (odd courses offset by half
 * a block), each block clipped to the free runs of its course between holes. Blocks never overlap one another or a hole.
 */
export function rusticationLayout(o: RusticationOptions): RusticBlock[] {
  if (!(o.t1 > o.t0) || !(o.y1 > o.y0)) throw Error('rusticationLayout: empty area');
  if (!(o.course > 0 && o.block > 0)) throw Error('rusticationLayout: course and block must be positive');
  const min = o.minBlock ?? o.block * 0.3, out: RusticBlock[] = [];
  const nc = Math.max(1, Math.round((o.y1 - o.y0) / o.course)), ch = (o.y1 - o.y0) / nc;
  for (let c = 0; c < nc; c++) {
    const y0 = o.y0 + c * ch, y1 = y0 + ch;
    // free runs of this course between the holes it crosses
    const cuts = (o.holes ?? []).filter(h => h[1] < y1 - 1e-6 && h[3] > y0 + 1e-6).map(h => [Math.max(o.t0, h[0]), Math.min(o.t1, h[2])]).filter(h => h[1] > h[0]).sort((a, b) => a[0] - b[0]);
    const runs: [number, number][] = [];
    let at = o.t0;
    for (const [a, b] of cuts) { if (a > at) runs.push([at, a]); at = Math.max(at, b); }
    if (o.t1 > at) runs.push([at, o.t1]);
    const phase = c % 2 ? o.block / 2 : 0;
    for (const [r0, r1] of runs) {
      if (r1 - r0 < min) continue;
      // joints on the course grid (o.t0 - phase + k * block), clipped to the run
      const edges = [r0];
      for (let j = Math.ceil((r0 - o.t0 + phase) / o.block) * o.block + o.t0 - phase; j < r1; j += o.block) if (j > r0 + 1e-9) edges.push(j);
      edges.push(r1);
      // merge offcuts shorter than min into their neighbour
      for (let i = 1; i < edges.length - 1;) {
        const left = edges[i] - edges[i - 1], right = edges[i + 1] - edges[i];
        if (left < min && i === 1 || right < min && i === edges.length - 2) edges.splice(i, 1); else i++;
      }
      for (let i = 0; i + 1 < edges.length; i++) out.push({t0: edges[i], t1: edges[i + 1], y0, y1});
    }
  }
  return out;
}
