// The street-name pass's occlusion test, per frame (presentationRuntime.ts →
// road-network.js `drawLabels(…, hiddenBy)`). Wraps `SightlineIndex` with the
// map's camera and the game's world frame, and holds each label's verdict for
// a couple of frames so a name on the edge of a roofline does not blink.

import { SightlineIndex, type FootprintFeature } from './sightlineOcclusion';

/** Street names sit on the road; the text's middle is about this high. */
export const STREET_LABEL_ALT_M = 1;
/** Consecutive tests that must agree before a label changes state (hysteresis). */
const HOLD_FRAMES = 2;
/**
 * A label still in view is re-tested every RETEST_FRAMES frames, staggered.
 * Measured 2026-10-25 at the Oude Doelenstraat chase view: 88 labels tested
 * every frame cost 2.7 ms (about 30 us each); staggered over 8 frames, about a
 * ninth of that. A label going behind a roof is hidden within ~130 ms.
 */
const RETEST_FRAMES = 8;
/** Index build budget per frame while the resident set changes. */
const BUILD_BUDGET_MS = 2;

type AnyMap = any;
interface VectorMapLike {
  map?: AnyMap;
  _completeCity?: { sampleFeatures?: (limit?: number) => readonly FootprintFeature[] } | null;
  worldToLngLat?(x: number, y: number, loader: unknown): [number, number] | { lng: number; lat: number };
}
interface LabelAnchor { x: number; y: number }

export class StreetLabelOcclusion {
  readonly index = new SightlineIndex();
  private readonly verdicts = new WeakMap<object, { hidden: boolean; votes: number; frame: number; slot: number }>();
  private slots = 0;
  private frameNo = 0;
  /** Last frame's counts, for the e2e and profiling. */
  stats = { tested: 0, hidden: 0, ms: 0, features: 0, buildMs: 0 };
  /** Labels drawn / hidden by occlusion last frame (text only), for the e2e. */
  lastHidden: string[] = [];

  /**
   * The per-label test for this frame, or null when there is nothing to test
   * against (top-down view, no resident buildings yet, no camera).
   */
  frame(host: unknown, loader: unknown, pitched: boolean): ((label: LabelAnchor & { text?: string }) => boolean) | null {
    this.frameNo++;
    this.stats.tested = 0; this.stats.hidden = 0; this.stats.ms = 0;
    this.lastHidden = [];
    const vm = host as VectorMapLike | null | undefined;
    if (!pitched || !vm?.map || !vm.worldToLngLat || !loader) return null;
    const toLngLat = vm.worldToLngLat.bind(vm);
    const features = vm._completeCity?.sampleFeatures?.(1_000_000);
    this.index.refresh(features, BUILD_BUDGET_MS);
    this.stats.features = this.index.stats.features;
    this.stats.buildMs = this.index.stats.buildMs;
    if (!this.index.ready) return null;
    const t = vm.map.transform;
    const at = t?.getCameraLngLat?.(), altM = t?.getCameraAltitude?.();
    if (!at || !Number.isFinite(altM)) return null;
    const camera = { lng: at.lng, lat: at.lat, altM };
    return (label) => {
      const t0 = performance.now();
      let v = this.verdicts.get(label);
      const fresh = !v || v.frame !== this.frameNo - 1;
      // In view last frame and not its turn: keep the verdict.
      if (v && !fresh && (this.frameNo + v.slot) % RETEST_FRAMES !== 0) {
        v.frame = this.frameNo;
        if (v.hidden) { this.stats.hidden++; if (label.text) this.lastHidden.push(label.text); }
        this.stats.ms += performance.now() - t0;
        return v.hidden;
      }
      const ll = toLngLat(label.x, label.y, loader);
      const [lng, lat] = Array.isArray(ll) ? ll : [ll.lng, ll.lat];
      const now = this.index.blocked(camera, { lng, lat, altM: STREET_LABEL_ALT_M });
      // New, or not drawn-tested last frame (off screen, crowded out): take the fresh verdict.
      if (!v || fresh) { v = { hidden: now, votes: HOLD_FRAMES, frame: 0, slot: v?.slot ?? this.slots++ }; this.verdicts.set(label, v); }
      v.frame = this.frameNo;
      if (now === v.hidden) v.votes = HOLD_FRAMES;
      else if (--v.votes <= 0) { v.hidden = now; v.votes = HOLD_FRAMES; }
      this.stats.tested++;
      if (v.hidden) { this.stats.hidden++; if (label.text) this.lastHidden.push(label.text); }
      this.stats.ms += performance.now() - t0;
      return v.hidden;
    };
  }
}
