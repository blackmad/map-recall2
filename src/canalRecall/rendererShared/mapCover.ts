/**
 * Is the map hidden behind an opaque card? Then the shared three.js frame need not draw (#109, the #106
 * follow-up). Sentry CANAL-RECALL-7 / -J / -N: a Firefox Android GPU process died behind the guest briefing,
 * while the frame drew 46 k tree triangles and warmed up ~21 ground programs nobody could see.
 *
 * "Covers" is measured from the layout, never assumed from the game state: the briefing's rail plus its photo
 * vista cover the whole canvas on every layout measured 2026-10-29 (desktop 1440x900, laptop, tablet, phone,
 * both orientations), but a layout that shows the map beside a card must keep drawing. A card counts only while
 * it is displayed, fully opaque (itself and every ancestor) and has an opaque background colour.
 *
 * Touch devices only by default (`coverPauseFlag`). Pure geometry (`uncoveredArea`, `mapCovered`) plus a small
 * browser adapter (`MapCoverWatch`).
 */

export type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * Opaque surfaces that can hide the map: the route briefing's rail and its photo vista, and the knowledge review
 * page. The help/settings panels sit on a translucent scrim and never qualify.
 */
export const MAP_COVER_SELECTORS: readonly string[] = ['#route-setup .enamel-setup-rail', '#route-setup .enamel-setup-vista', '.knowledge-review'];

/** Edge slack, CSS px: a sub-pixel seam (rounded widths, a 1 px box-shadow line) does not count as the map showing. */
export const MAP_COVER_EDGE_PX = 1;

/** Area of `target` that no rect in `covers` hides (union, not sum), in px². */
export function uncoveredArea(target: Rect, covers: readonly Rect[]): number {
  const clipped: Rect[] = [];
  for (const c of covers) {
    const r = { left: Math.max(c.left, target.left), top: Math.max(c.top, target.top), right: Math.min(c.right, target.right), bottom: Math.min(c.bottom, target.bottom) };
    if (r.right > r.left && r.bottom > r.top) clipped.push(r);
  }
  const width = Math.max(0, target.right - target.left), height = Math.max(0, target.bottom - target.top);
  const total = width * height;
  if (!clipped.length || !total) return total;
  // Coordinate compression over a handful of rects: exact union area.
  const xs = [...new Set([target.left, target.right, ...clipped.flatMap(r => [r.left, r.right])])].sort((a, b) => a - b);
  const ys = [...new Set([target.top, target.bottom, ...clipped.flatMap(r => [r.top, r.bottom])])].sort((a, b) => a - b);
  let covered = 0;
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (clipped.some(r => cx > r.left && cx < r.right && cy > r.top && cy < r.bottom)) covered += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
  }
  return Math.max(0, total - covered);
}

/** True when the cards hide all of the map, up to `edgePx` of slack at its edges and between cards. An empty map rect is not "covered". */
export function mapCovered(map: Rect, covers: readonly Rect[], edgePx = MAP_COVER_EDGE_PX): boolean {
  const inner = { left: map.left + edgePx, top: map.top + edgePx, right: map.right - edgePx, bottom: map.bottom - edgePx };
  if (inner.right <= inner.left || inner.bottom <= inner.top) return false;
  // Half the slack on each side of every card closes a seam up to `edgePx` wide between two cards.
  const h = edgePx / 2;
  return uncoveredArea(inner, covers.map(c => ({ left: c.left - h, top: c.top - h, right: c.right + h, bottom: c.bottom + h }))) <= 0;
}

/** `rgb(…)`/`rgba(…)`/`transparent` → alpha. Anything unparsed counts as not opaque. */
export function cssAlpha(colour: string | null | undefined): number {
  if (!colour || colour === 'transparent') return 0;
  const m = /^rgba?\(([^)]*)\)$/.exec(colour.trim());
  if (!m) return 0;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 4) return 1;
  const a = parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3]);
  return Number.isFinite(a) ? a : 0;
}

type StyleLike = { display: string; visibility: string; opacity: string; backgroundColor: string };
type ElementLike = { parentElement: ElementLike | null; getBoundingClientRect(): Rect };

/** An element that hides what lies under its box: displayed, visible, opaque all the way up, with an opaque fill. */
export function opaqueCoverRect(element: ElementLike, style: (e: ElementLike) => StyleLike): Rect | null {
  const own = style(element);
  if (own.visibility !== 'visible') return null;
  // A background image may have transparent pixels, so only an opaque colour (under it or alone) counts.
  if (cssAlpha(own.backgroundColor) < 1) return null;
  for (let e: ElementLike | null = element; e; e = e.parentElement) {
    const s = e === element ? own : style(e);
    if (s.display === 'none' || Number(s.opacity) < 1) return null;
  }
  const r = element.getBoundingClientRect();
  return r.right > r.left && r.bottom > r.top ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
}

/**
 * Where the pause applies. Default: touch devices (`pointer: coarse`), where the warm-up is spread anyway
 * (compileBudget.ts) and the GPU processes died. A desktop keeps drawing and warming up behind the card, as before:
 * paused, its one-call warm-up (~21 links) and the tree and shadow uploads (~32 MB) moved into the first 100 ms
 * after Start (measured 2026-10-29, 24 links in 100 ms; scripts/gpu-startup-timeline.mjs START_AT=8000), and the
 * desktop start matters most. `?coverPause=1` pauses on any device, `?coverPause=0` nowhere;
 * `window.__canalRecallCoverPause` overrides both.
 */
export function coverPauseFlag(env: { coarse?: boolean; asked?: unknown } = coverPauseEnv()): boolean {
  const asked = env.asked;
  if (asked === true || asked === 1 || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === 0 || asked === '0' || asked === 'false' || asked === 'off') return false;
  return !!env.coarse;
}

function coverPauseEnv(): { coarse?: boolean; asked?: unknown } {
  const g = globalThis as { __canalRecallCoverPause?: unknown; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  let asked: unknown = g.__canalRecallCoverPause;
  if (asked == null && g.location?.search) { try { asked = new URLSearchParams(g.location.search).get('coverPause'); } catch { asked = null; } }
  return { coarse: !!g.matchMedia?.('(pointer: coarse)')?.matches, asked };
}

/** After the map shows again: deferred precompiles (the vehicles) start after this, ms, one per warm-up step. */
export const RESUME_DEFERRED_COMPILE_MS = 100;
/** …and the ground's warm-up after this, once the first draw's own links and the vehicles' are done. */
export const RESUME_WARMUP_HOLD_MS = 300;

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Re-measure at most this often while the map draws (a card arriving late costs at most this much drawing). */
export const MAP_COVER_RECHECK_MS = 250;

/**
 * Watches the layout and says whether the map is covered. Event-driven: DOM attribute/child changes, resizes and
 * the end of CSS animations/transitions mark it dirty. While covered, a change is re-measured at once, so the
 * frame resumes in the same task the card goes away (before the next paint); while drawing, a change is measured at
 * most every MAP_COVER_RECHECK_MS (from the frame, `check(now)`, or a timer), so riding forces no layout per frame.
 */
export class MapCoverWatch {
  covered = false;
  /** Measurements made (diagnostics). */
  checks = 0;
  private dirty = true;
  private lastCheck = -Infinity;
  private timer: ReturnType<typeof setTimeout> | number | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly canvas: { getBoundingClientRect(): Rect }, private readonly onChange: (covered: boolean) => void, private readonly doc: Document = document, private readonly selectors: readonly string[] = MAP_COVER_SELECTORS) {
    const view = doc.defaultView;
    const mark = () => {
      this.dirty = true;
      // Covered: re-measure now, so the 3D comes back in the frame the card leaves.
      if (this.covered) { this.measure(nowMs()); return; }
      // Drawing: the frame re-checks (`check`); a page that does not repaint is measured once the interval is up.
      if (this.timer == null && view) {
        this.timer = view.setTimeout(() => { this.timer = null; if (this.dirty) this.measure(nowMs()); }, Math.max(0, this.lastCheck + MAP_COVER_RECHECK_MS - nowMs()));
      }
    };
    this.cleanups.push(() => { if (this.timer != null) view?.clearTimeout(this.timer); this.timer = null; });
    if (view && typeof view.MutationObserver === 'function' && doc.body) {
      const observer = new view.MutationObserver(mark);
      observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      this.cleanups.push(() => observer.disconnect());
    }
    for (const [target, event] of [[view, 'resize'], [doc, 'animationend'], [doc, 'transitionend']] as const) {
      if (!target) continue;
      target.addEventListener(event, mark, true);
      this.cleanups.push(() => target.removeEventListener(event, mark, true));
    }
  }

  /** From the frame: re-measure if something changed and the last measurement is old enough. Returns `covered`. */
  check(now: number): boolean {
    if (this.dirty && now - this.lastCheck >= MAP_COVER_RECHECK_MS) this.measure(now);
    return this.covered;
  }

  /** Measure now. */
  measure(now: number): boolean {
    this.dirty = false;
    this.lastCheck = now;
    this.checks++;
    const view = this.doc.defaultView;
    let covered = false;
    if (view) {
      const style = (e: ElementLike) => view.getComputedStyle(e as unknown as Element) as unknown as StyleLike;
      const covers: Rect[] = [];
      for (const selector of this.selectors) for (const element of Array.from(this.doc.querySelectorAll(selector))) {
        const rect = opaqueCoverRect(element as unknown as ElementLike, style);
        if (rect) covers.push(rect);
      }
      covered = covers.length > 0 && mapCovered(this.canvas.getBoundingClientRect(), covers);
    }
    if (covered !== this.covered) { this.covered = covered; this.onChange(covered); }
    return covered;
  }

  dispose(): void { for (const c of this.cleanups.splice(0)) c(); }
}
