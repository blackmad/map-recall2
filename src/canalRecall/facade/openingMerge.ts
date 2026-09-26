/**
 * Union several models' opening predictions into one proposal set.
 *
 * Decision D1 (FACADE_MODEL_DECISIONS.md): the openings for a wall come from
 * both photo models together, and where a window overlaps a door the **door
 * wins**. Two models that fail differently cover more than either alone; the
 * class-priority rule settles the one place they disagree by design.
 *
 * This is a proposal source, not an accepted observation. It inherits both
 * models' precision problems, so the measured gold set remains the arbiter.
 */

export interface WallRect {
  along: number;
  up: number;
  width: number;
  height: number;
}

export type OpeningKind = 'window' | 'door' | 'other';

export interface MergeBox extends WallRect {
  kind: OpeningKind;
  score?: number;
}

export interface LanePredictions {
  /** Lane name, recorded on each surviving box. */
  name: string;
  boxes: readonly MergeBox[];
}

export interface MergeOptions {
  /** A window this overlapped by a door is dropped — the door wins. */
  doorDominatesIou?: number;
  /** …or a door covering this fraction of the window's area wins. */
  doorDominatesContainment?: number;
  /** Two boxes of the same kind this overlapping are the same opening. */
  dedupeIou?: number;
}

export interface MergedBox extends MergeBox {
  sources: string[];
}

const intersection = (a: WallRect, b: WallRect) => {
  const left = Math.max(a.along, b.along);
  const right = Math.min(a.along + a.width, b.along + b.width);
  const bottom = Math.max(a.up, b.up);
  const top = Math.min(a.up + a.height, b.up + b.height);
  if (right <= left || top <= bottom) return 0;
  return (right - left) * (top - bottom);
};

const iou = (a: WallRect, b: WallRect) => {
  const overlap = intersection(a, b);
  const union = a.width * a.height + b.width * b.height - overlap;
  return union > 0 ? overlap / union : 0;
};

const area = (box: WallRect) => box.width * box.height;

/**
 * Merge lanes into one proposal set:
 *  1. every door is kept;
 *  2. a window a door overlaps (or mostly covers) is dropped — a window inside a
 *     door is a glazed panel of that door, not a separate opening;
 *  3. the remaining windows are de-duplicated across lanes by IoU, keeping the
 *     higher-scoring box;
 *  4. doors are de-duplicated the same way.
 * `other` boxes are passed through untouched.
 */
export function mergeOpenings(lanes: readonly LanePredictions[], options: MergeOptions = {}): MergedBox[] {
  const doorDominatesIou = options.doorDominatesIou ?? 0.3;
  const doorDominatesContainment = options.doorDominatesContainment ?? 0.6;
  const dedupeIou = options.dedupeIou ?? 0.5;

  const tagged: Array<MergeBox & { lane: string }> = [];
  for (const lane of lanes) for (const box of lane.boxes) tagged.push({ ...box, lane: lane.name });

  const doors = tagged.filter((box) => box.kind === 'door');
  const windows = tagged.filter((box) => box.kind === 'window');
  const others = tagged.filter((box) => box.kind === 'other');

  const windowSurvives = (window: MergeBox) => !doors.some((door) =>
    iou(window, door) >= doorDominatesIou
    || (area(window) > 0 && intersection(window, door) / area(window) >= doorDominatesContainment));

  const dedupe = (boxes: Array<MergeBox & { lane: string }>): MergedBox[] => {
    const ordered = [...boxes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const kept: MergedBox[] = [];
    for (const box of ordered) {
      const twin = kept.find((existing) => existing.kind === box.kind && iou(existing, box) >= dedupeIou);
      if (twin) { twin.sources.push(box.lane); continue; }
      kept.push({ along: box.along, up: box.up, width: box.width, height: box.height, kind: box.kind, score: box.score, sources: [box.lane] });
    }
    return kept;
  };

  return [
    ...dedupe(doors),
    ...dedupe(windows.filter(windowSurvives)),
    ...others.map((box) => ({ along: box.along, up: box.up, width: box.width, height: box.height, kind: box.kind, score: box.score, sources: [box.lane] })),
  ];
}
