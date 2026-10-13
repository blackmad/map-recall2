// Which street-name anchors the HUD's street-name pass needs to look at.
//
// `RoadNetwork.drawLabels` (public/canal-drive/js/road-network.js) used to walk
// every label anchor in the city (28,931 in Amsterdam) every frame, and run the
// knowledge test on the ~4,000 within reach of a pitched camera, to draw none
// for a guest (0.4-1.3 ms a desktop frame, docs/performance/desktop-20261014.md).
//
// A label can only pass the game's knowledge test,
//   `_mapLabelNames.has(text) || _isPlaceKnown(text, x, y)`,
// if its name is in `_mapLabelNames` or has an entry in `_knownPlaces`. So:
//  - when both are empty (a guest, a fresh player), nothing can draw and the
//    walk is skipped outright;
//  - otherwise the candidates are the anchors of those names that lie within
//    reach of the camera's cell, kept in the original anchor order (the draw
//    order decides which of two overlapping labels wins), and cached until the
//    camera changes cell, the reach outgrows its bucket, or a name is learned.
// The result is a superset of what the per-frame reach test admits, in the same
// order, so `drawLabels` still applies every one of its own tests unchanged and
// draws exactly what it drew before.

export interface StreetLabelAnchor {
  text: string;
  x: number;
  y: number;
}

/** The two collections the game's knowledge test reads. Both only ever grow or
 *  are replaced (recallRuntime `_revealName`, `_refreshMasteredLabels`,
 *  `_rememberKnownPlace`), so identity plus size identifies their name set. */
export interface LabelKnowledge {
  mapLabelNames: ReadonlySet<string>;
  knownPlaces: ReadonlyMap<string, unknown>;
}

/** World units per camera cell. */
export const LABEL_CELL_SIZE = 256;
/** Reach is cached in geometric buckets so a zoom wobble does not rebuild. */
const REACH_BUCKET_STEP = 1.25;

const EMPTY: readonly never[] = Object.freeze([]);

export class StreetLabelCandidates<T extends StreetLabelAnchor> {
  private labels: readonly T[] | null = null;
  private labelCount = -1;
  /** Name -> ascending anchor indices, built once per anchor array. */
  private byName = new Map<string, number[]>();

  private names: { set: ReadonlySet<string> | null; setSize: number; places: ReadonlyMap<string, unknown> | null; placesSize: number } =
    { set: null, setSize: -1, places: null, placesSize: -1 };
  /** Ascending indices of every anchor whose name could pass the knowledge test. */
  private named: Int32Array = new Int32Array(0);
  private namedVersion = 0;

  private cellKey = '';
  private cell: readonly T[] = EMPTY;

  /** Rebuilds of the per-cell list, for tests and the profiler. */
  rebuilds = 0;

  constructor(private readonly cellSize = LABEL_CELL_SIZE) {}

  /**
   * The anchors `drawLabels` must test this frame: every anchor that could pass
   * both `|x - cx| <= reach && |y - cy| <= reach` and the knowledge test, in
   * the order of `labels`.
   */
  candidates(labels: readonly T[] | null | undefined, knowledge: LabelKnowledge, cx: number, cy: number, reach: number): readonly T[] {
    if (!labels || !labels.length) return EMPTY;
    const { mapLabelNames, knownPlaces } = knowledge;
    if (!mapLabelNames.size && !knownPlaces.size) return EMPTY;
    if (labels !== this.labels || labels.length !== this.labelCount) this.indexLabels(labels);
    this.refreshNamed(mapLabelNames, knownPlaces);
    if (!this.named.length) return EMPTY;

    const size = this.cellSize;
    const ix = Math.floor(cx / size), iy = Math.floor(cy / size);
    const bucket = reachBucket(reach);
    const key = `${this.namedVersion}:${ix}:${iy}:${bucket}`;
    if (key !== this.cellKey) {
      this.cellKey = key;
      this.cell = this.collect(ix, iy, bucket);
      this.rebuilds++;
    }
    return this.cell;
  }

  private indexLabels(labels: readonly T[]): void {
    this.labels = labels;
    this.labelCount = labels.length;
    this.byName = new Map();
    for (let i = 0; i < labels.length; i++) {
      const text = labels[i].text;
      const list = this.byName.get(text);
      if (list) list.push(i); else this.byName.set(text, [i]);
    }
    this.names = { set: null, setSize: -1, places: null, placesSize: -1 };
    this.cellKey = '';
  }

  private refreshNamed(set: ReadonlySet<string>, places: ReadonlyMap<string, unknown>): void {
    const n = this.names;
    if (n.set === set && n.setSize === set.size && n.places === places && n.placesSize === places.size) return;
    this.names = { set, setSize: set.size, places, placesSize: places.size };
    const picked: number[] = [];
    for (const name of set) {
      const list = this.byName.get(name);
      if (list) for (const i of list) picked.push(i);
    }
    for (const name of places.keys()) {
      if (set.has(name)) continue;
      const list = this.byName.get(name);
      if (list) for (const i of list) picked.push(i);
    }
    this.named = Int32Array.from(picked).sort();
    this.namedVersion++;
    this.cellKey = '';
  }

  private collect(ix: number, iy: number, reach: number): readonly T[] {
    const labels = this.labels!;
    const half = this.cellSize / 2;
    const mx = (ix + 0.5) * this.cellSize, my = (iy + 0.5) * this.cellSize;
    // Any camera inside the cell is within `half` of its centre on each axis.
    const r = reach + half;
    const out: T[] = [];
    for (const i of this.named) {
      const label = labels[i];
      if (Math.abs(label.x - mx) <= r && Math.abs(label.y - my) <= r) out.push(label);
    }
    return out;
  }
}

/** The smallest bucket edge at or above `reach`. */
export function reachBucket(reach: number): number {
  if (!(reach > 0)) return 0;
  const b = REACH_BUCKET_STEP ** Math.ceil(Math.log(reach) / Math.log(REACH_BUCKET_STEP));
  return b >= reach ? b : b * REACH_BUCKET_STEP;
}
