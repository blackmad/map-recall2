// Road number shields, one per ref per visible stretch (user 2026-11-08, issue #259: along the A10 / A5 at Sloterdijk
// "A10" was drawn 8 times, "A5" 7 and "S101" 8, about every 200 screen pixels: the basemap's line-placed shield layer
// repeats every `symbol-spacing` 200 tile pixels in every tile and every way piece). Pure placement on screen anchors
// sampled along the ref's lines (labels/roadShields.ts samples them from the map; any engine can):
//   - a shield keeps at least `minSpacingPx` from every other shield of the same ref, so the way pieces, the two
//     carriageways and the tiles of one road name it once per stretch;
//   - of a stretch the anchor nearest the screen centre wins;
//   - last plan's shields that are still on screen and still on their road are kept where they are (hysteresis: no
//     jump or flicker under a pan), before new ones are chosen;
//   - a second ref on the same road (A10 and A5 concurrent) is shown once too, at least `otherRefGapPx` from any
//     other shield so the two sit side by side instead of one hiding the other.

export interface ShieldAnchor { ref: string; x: number; y: number }

export interface ShieldPlacementOptions {
  width: number;
  height: number;
  /** Least screen distance between two shields of one ref, CSS px. */
  minSpacingPx?: number;
  /** Shields keep this far inside the screen edge, CSS px. */
  marginPx?: number;
  /** A last-plan shield is kept while an anchor of its ref lies this close (it is still on its road), CSS px. */
  stickyPx?: number;
  /** Least distance between shields of different refs, CSS px. */
  otherRefGapPx?: number;
}

export const SHIELD_MIN_SPACING_PX = 1000;
export const SHIELD_MARGIN_PX = 24;
export const SHIELD_STICKY_PX = 40;
export const SHIELD_OTHER_REF_GAP_PX = 44;

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * The shields to draw. `anchors`: points along every ref's lines on screen (any spacing, duplicates welcome);
 * `previous`: last plan's winners re-projected to this frame. Returns winners (from `previous` when kept, else from
 * `anchors`), at most one per ref per `minSpacingPx`.
 */
export function placeRoadShields<T extends ShieldAnchor>(anchors: readonly T[], previous: readonly T[], opts: ShieldPlacementOptions): T[] {
  const { width, height } = opts;
  const spacing2 = (opts.minSpacingPx ?? SHIELD_MIN_SPACING_PX) ** 2;
  const margin = opts.marginPx ?? SHIELD_MARGIN_PX;
  const sticky2 = (opts.stickyPx ?? SHIELD_STICKY_PX) ** 2;
  const gap2 = (opts.otherRefGapPx ?? SHIELD_OTHER_REF_GAP_PX) ** 2;
  const inView = (a: ShieldAnchor) => Number.isFinite(a.x) && Number.isFinite(a.y)
    && a.x >= margin && a.x <= width - margin && a.y >= margin && a.y <= height - margin;
  const centre = { x: width / 2, y: height / 2 };
  const byRef = new Map<string, T[]>();
  for (const a of anchors) {
    if (!a.ref || !inView(a)) continue;
    const list = byRef.get(a.ref);
    if (list) list.push(a); else byRef.set(a.ref, [a]);
  }
  const placed: T[] = [];
  const accept = (a: T): boolean => {
    for (const p of placed) {
      const dd = d2(p, a);
      if (p.ref === a.ref ? dd < spacing2 : dd < gap2) return false;
    }
    placed.push(a);
    return true;
  };
  // Kept first: last plan's shields still on screen and on their road.
  for (const p of previous) {
    if (!inView(p)) continue;
    const road = byRef.get(p.ref);
    if (road?.some(a => d2(a, p) <= sticky2)) accept(p);
  }
  // Then each ref's anchors nearest the centre first; refs in order of their nearest anchor (ties by name).
  const refs = [...byRef.entries()].map(([ref, list]) => {
    const sorted = list.map(a => ({ a, d: d2(a, centre) })).sort((p, q) => p.d - q.d || p.a.x - q.a.x || p.a.y - q.a.y);
    return { ref, sorted };
  }).sort((p, q) => p.sorted[0].d - q.sorted[0].d || (p.ref < q.ref ? -1 : p.ref > q.ref ? 1 : 0));
  for (const { sorted } of refs) for (const { a } of sorted) accept(a);
  return placed;
}

/** Points every `stepPx` along a screen polyline (its ends included), for `placeRoadShields`' anchors. */
export function sampleScreenLine(points: ReadonlyArray<{ x: number; y: number }>, stepPx: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  if (!points.length) return out;
  out.push({ x: points[0].x, y: points[0].y });
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!Number.isFinite(len) || len === 0) continue;
    let t = stepPx - carry;
    while (t <= len) { out.push({ x: a.x + (b.x - a.x) * t / len, y: a.y + (b.y - a.y) * t / len }); t += stepPx; }
    carry = len - (t - stepPx);
  }
  const last = points[points.length - 1];
  if (points.length > 1) out.push({ x: last.x, y: last.y });
  return out;
}
