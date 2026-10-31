/**
 * POI labels hidden behind buildings under `?engine=own` (#129, user report 2026-10-31: "Anmol", "Hotel Blyss",
 * "Snackbar Miriam" floating over the roofs of buildings between the camera and the place, Eerste Constantijn
 * Huygensstraat looking north from the Overtoom).
 *
 * The test walks the sightline from the label's anchor up to the camera eye through the resident building
 * footprints. Each footprint is extruded to its eaves, so it is the same model the camera-clearance guard uses
 * (cameraClearance.ts).
 * - A place inside a building is seen through its frontage: the host footprint's edge nearest the place (any edge
 *   within FRONTAGE_TIE_M of the nearest, so a corner shop has two). A frontage that faces away from the camera
 *   hides the label (the shop on the far side of the block whose roof the label would float over).
 * - The sightline starts just outside that frontage, half way up the facade (the host's eaves × 0.5), or at the
 *   place itself 3 m up with no host. The host never blocks its own frontage.
 * - A label is hidden when a nearer building rises above the line by more than a margin. The margin swaps sign
 *   with the label's last state (hysteresis), so a label at the occlusion edge does not flicker.
 * - Only POI point labels are tested. Streets, water, neighbourhoods and the game's own points (the answered
 *   street, ferry landings, the destination) are exempt by the caller.
 *
 * Cost: a grid over the residents within INDEX_RADIUS_M of the eye, rebuilt when the resident set changes or the
 * eye moves REINDEX_M. Each test is a few dozen 2 m steps, stopping as
 * soon as the line is above the tallest resident.
 */
import { footprintContains, type FootprintFeature } from '../coveredPassage';
import { featureBox } from './cameraClearance';

type LngLat = readonly [number, number];
const CELL_LNG = 0.0006, CELL_LAT = 0.0004; // ~40 × 45 m
const key = (x: number, y: number) => x * 1_000_003 + y; // cell indices are < 20,000 in the city's lng/lat
const STEP_M = 2;
export const OCCLUSION_MARGIN_M = 1.5;
export const ANCHOR_FACADE_SHARE = 0.5;
export const ANCHOR_DEFAULT_M = 3;
/** Edges this close to the nearest one also count as the place's frontage (corner shops). */
export const FRONTAGE_TIE_M = 3;
/** Metres the eye must sit in front of (or behind) the frontage's plane to flip its facing state (hysteresis). */
export const FACING_MARGIN_M = 2;
const OUT_M = 0.5;
/** Footprints indexed around the eye; a sightline is never longer than the labels' draw depth at street zooms. */
export const INDEX_RADIUS_M = 900;
const REINDEX_M = 250;

type Ring = ReadonlyArray<readonly number[]>;
const outerRings = (f: FootprintFeature): Ring[] => {
  const g = f.geometry as { type?: string; coordinates?: unknown } | null | undefined;
  if (g?.type === 'Polygon') return [(g.coordinates as Ring[])[0]].filter(Boolean);
  if (g?.type === 'MultiPolygon') return (g.coordinates as Ring[][]).map(p => p[0]).filter(Boolean);
  return [];
};

const topOf = (f: FootprintFeature): number => {
  const p = (f.properties || {}) as Record<string, unknown>;
  const top = Number(p.roofEavesHeightM ?? p.height ?? 5);
  return Number.isFinite(top) ? top : 5;
};

export class LabelOcclusion<F extends FootprintFeature = FootprintFeature> {
  private grid = new Map<number, F[]>();
  /** The tallest top in each cell: a sightline above it skips the footprint tests. */
  private cellTop = new Map<number, number>();
  private indexed: readonly F[] | null = null;
  private tallest = 0;
  /** Ids hidden at the last test (the hysteresis state). */
  private readonly hidden = new Set<string>();
  /** Read by the perf probe: sightline tests, grid rebuilds and their total ms. */
  readonly stats = { tests: 0, indexes: 0, indexMs: 0 };

  private centre: LngLat | null = null;

  /**
   * (Re)index the residents within INDEX_RADIUS_M of `centre` (the camera eye). Rebuilt only when the resident list
   * object changes (the tile source caches it) or the eye has moved REINDEX_M from the last centre.
   */
  index(features: readonly F[], centre: LngLat): void {
    const mLng = 111320 * Math.cos(centre[1] * Math.PI / 180);
    if (features === this.indexed && this.centre
      && Math.hypot((centre[0] - this.centre[0]) * mLng, (centre[1] - this.centre[1]) * 111320) < REINDEX_M) return;
    const t0 = performance.now();
    this.indexed = features;
    this.centre = centre;
    this.grid.clear();
    this.cellTop.clear();
    this.tallest = 0;
    const rLng = INDEX_RADIUS_M / mLng, rLat = INDEX_RADIUS_M / 111320;
    for (const f of features) {
      const b = featureBox(f);
      if (!b || b[2] < centre[0] - rLng || b[0] > centre[0] + rLng || b[3] < centre[1] - rLat || b[1] > centre[1] + rLat) continue;
      const top = topOf(f);
      this.tallest = Math.max(this.tallest, top);
      for (let x = Math.floor(b[0] / CELL_LNG); x <= Math.floor(b[2] / CELL_LNG); x++)
        for (let y = Math.floor(b[1] / CELL_LAT); y <= Math.floor(b[3] / CELL_LAT); y++) {
          const k = key(x, y); const l = this.grid.get(k);
          if (l) l.push(f); else this.grid.set(k, [f]);
          if (top > (this.cellTop.get(k) ?? 0)) this.cellTop.set(k, top);
        }
    }
    this.stats.indexes++; this.stats.indexMs += performance.now() - t0;
  }

  /** The resident footprint containing `p`, if any (first match), among those taller than `above`. */
  at(p: LngLat, skip?: F | null, above = -Infinity): F | null {
    const k = key(Math.floor(p[0] / CELL_LNG), Math.floor(p[1] / CELL_LAT));
    if ((this.cellTop.get(k) ?? -Infinity) <= above) return null;
    for (const f of this.grid.get(k) ?? []) {
      if (f === skip || topOf(f) <= above) continue;
      const b = featureBox(f)!;
      if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
      if (footprintContains(f.geometry, p)) return f;
    }
    return null;
  }

  /** Whether a nearer building hides the place `id` at `anchor` from the camera eye. Updates the hysteresis state. */
  occluded(id: string, anchor: LngLat, eye: { lng: number; lat: number; altitudeM: number }): boolean {
    this.stats.tests++;
    const host = this.at(anchor);
    const wasHidden = this.hidden.has(id);
    const mLat = 111320, mLng = 111320 * Math.cos(anchor[1] * Math.PI / 180);
    // Local metres about the anchor.
    const ex = (eye.lng - anchor[0]) * mLng, ey = (eye.lat - anchor[1]) * mLat;
    let starts: Array<readonly [number, number]> = [[0, 0]];
    if (host) {
      // The frontage edges, and whether each faces the eye (hysteresis on the eye's distance in front of the plane).
      const facingMin = wasHidden ? FACING_MARGIN_M : -FACING_MARGIN_M;
      const edges: Array<{ d: number; px: number; py: number; nx: number; ny: number }> = [];
      for (const ring of outerRings(host)) {
        const pts = ring.map(c => [(c[0] - anchor[0]) * mLng, (c[1] - anchor[1]) * mLat] as const);
        let area = 0;
        for (let i = 0; i + 1 < pts.length; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
        const sign = area >= 0 ? 1 : -1; // counter-clockwise: the outward normal is (dy, -dx)
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
          if (len < 0.5) continue;
          const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (len * len)));
          const px = ax + dx * t, py = ay + dy * t;
          edges.push({ d: Math.hypot(px, py), px, py, nx: sign * dy / len, ny: -sign * dx / len });
        }
      }
      const near = edges.length ? Math.min(...edges.map(e => e.d)) : 0;
      starts = edges
        .filter(e => e.d <= near + FRONTAGE_TIE_M && (ex - e.px) * e.nx + (ey - e.py) * e.ny > facingMin)
        .map(e => [e.px + e.nx * OUT_M, e.py + e.ny * OUT_M] as const);
    }
    const anchorAlt = host ? topOf(host) * ANCHOR_FACADE_SHARE : ANCHOR_DEFAULT_M;
    // Hidden stays hidden until the line clears by the margin; shown stays shown until it is blocked by the margin.
    const margin = wasHidden ? -OCCLUSION_MARGIN_M : OCCLUSION_MARGIN_M;
    // Visible when any frontage facing the eye has a clear sightline.
    const blocked = !starts.some(([sx, sy]) => {
      const east = ex - sx, north = ey - sy, dist = Math.hypot(east, north);
      for (let s = STEP_M; s < dist; s += STEP_M) {
        const t = s / dist;
        const lineAlt = anchorAlt + (eye.altitudeM - anchorAlt) * t;
        if (lineAlt + margin >= this.tallest) break; // nothing resident can rise above the line from here on
        if (this.at([anchor[0] + (sx + east * t) / mLng, anchor[1] + (sy + north * t) / mLat], host, lineAlt + margin)) return false;
      }
      return true;
    });
    if (blocked) this.hidden.add(id); else this.hidden.delete(id);
    return blocked;
  }
}
