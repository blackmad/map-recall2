// The canvas used to be a fixed 1280×720 logical surface, letterboxed into
// whatever window it was given. On a landscape desktop near 16:9 that was
// almost invisible. On a tall desktop window or a portrait phone it was the
// whole bug: a 390×844 phone got a 390×219 strip floating in white space, and
// a tall browser window got the same landscape band with empty paper above
// and below — the MapLibre layer underneath kept its own size, so the HUD and
// the map showed different parts of Amsterdam.
//
// This module decides one thing: given a physical window, what logical
// coordinate space should the canvas use. Both desktop and compact now fill
// the CSS viewport. Compact uses CSS pixels as logical units (so 13 px type
// stays 13 CSS px on a phone). Desktop keeps the proven 1280×720 density on
// the constrained axis and *expands* the other axis to match the window
// aspect, so a tall window grows logical height instead of letterboxing, and
// a true 16:9 window still lands on the historic 1280×720 space.
//
// Everything downstream reads `width`/`height` rather than a constant, so the
// HUD layout, the camera centre and the touch controls all follow from here.

/** `desktop` uses design-density logical units; `compact` uses CSS pixels. */
export type LayoutMode = 'desktop' | 'compact';
export type Orientation = 'landscape' | 'portrait';

export type Viewport = {
  /** Logical canvas units — what every draw call and hit test works in. */
  width: number;
  height: number;
  /** The CSS box the canvas element occupies. */
  cssWidth: number;
  cssHeight: number;
  /** CSS pixels per logical unit. 1 in compact mode. */
  scale: number;
  /** Device pixels backing each logical unit, capped for memory. */
  backingScale: number;
  mode: LayoutMode;
  orientation: Orientation;
  /** True when the pointer is coarse: drives the on-screen controls. */
  touch: boolean;
  safeTop: number;
  safeBottom: number;
};

/** The proven desktop density. Exact 16:9 windows still resolve to this size. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

// Below this shorter-edge size a touch device is treated as a phone/small
// tablet and gets the compact, screen-filling layout. A touch laptop or a large
// landscape tablet stays on the desktop layout, which it has the room for.
export const COMPACT_MAX_SHORT_EDGE = 820;

// Floor only — never clamp the *max* logical size below the CSS box. Doing that
// and then pinning the canvas to `width: 100%` CSS-stretched a 900-wide layout
// across an ultrawide window, so every card looked blown sideways. Wide
// compact/desktop windows keep a 1:1 logical↔CSS mapping; `hudBand` in
// hudLayout.ts is what keeps the chrome from pinning to the far edges.
const MIN_COMPACT_WIDTH = 300;
const MIN_COMPACT_HEIGHT = 380;

/** Max width the HUD chrome occupies; wider windows centre this band. */
export const HUD_MAX_WIDTH_DESKTOP = DESIGN_WIDTH;
export const HUD_MAX_WIDTH_COMPACT = 900;

const MAX_BACKING_SCALE = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveViewport({
  windowWidth,
  windowHeight,
  devicePixelRatio = 1,
  touch = false,
  safeTop = 0,
  safeBottom = 0,
}: {
  windowWidth: number;
  windowHeight: number;
  devicePixelRatio?: number;
  touch?: boolean;
  safeTop?: number;
  safeBottom?: number;
}): Viewport {
  // A zero-sized window happens during startup and orientation changes; fall
  // back to the design space rather than dividing by zero downstream.
  const winW = windowWidth > 0 ? windowWidth : DESIGN_WIDTH;
  const winH = windowHeight > 0 ? windowHeight : DESIGN_HEIGHT;
  const orientation: Orientation = winH > winW ? 'portrait' : 'landscape';
  const shortEdge = Math.min(winW, winH);
  // A touch device in portrait is a phone or tablet being held upright, and the
  // 16:9 layout has nothing to offer it however wide it reports itself to be.
  // Width alone was not enough: a page that overflows horizontally makes the
  // browser widen the layout viewport, which briefly read as a desktop and
  // latched the wrong layout for the rest of the session.
  const mode: LayoutMode = touch && (shortEdge <= COMPACT_MAX_SHORT_EDGE || orientation === 'portrait')
    ? 'compact'
    : 'desktop';

  if (mode === 'compact') {
    // Fill the window 1:1. Logical units are CSS pixels, so text keeps the size
    // it was written at and the map container is simply the whole screen.
    const width = Math.max(MIN_COMPACT_WIDTH, Math.round(winW));
    const height = Math.max(MIN_COMPACT_HEIGHT, Math.round(winH));
    return {
      width,
      height,
      cssWidth: winW,
      cssHeight: winH,
      scale: winW / width,
      backingScale: clamp(devicePixelRatio, 1, MAX_BACKING_SCALE),
      mode,
      orientation,
      touch,
      safeTop,
      safeBottom,
    };
  }

  // Desktop: fill the window. Keep the historic density on the constrained
  // axis and grow the other so the logical aspect matches the CSS box —
  // letterboxing used to leave a tall browser as a 16:9 strip in white paper.
  const designRatio = DESIGN_WIDTH / DESIGN_HEIGHT;
  const windowRatio = winW / winH;
  let width: number;
  let height: number;
  if (windowRatio >= designRatio) {
    // Wider than 16:9 (ultrawide): keep design height, expand width.
    height = DESIGN_HEIGHT;
    width = Math.max(DESIGN_WIDTH, Math.round(DESIGN_HEIGHT * windowRatio));
  } else {
    // Taller than 16:9 (including a maximised tall window): keep design
    // width, expand height. A true 16:9 window lands exactly on 1280×720.
    width = DESIGN_WIDTH;
    height = Math.max(DESIGN_HEIGHT, Math.round(DESIGN_WIDTH / windowRatio));
  }
  return {
    width,
    height,
    cssWidth: winW,
    cssHeight: winH,
    scale: winW / width,
    backingScale: clamp(devicePixelRatio * (winW / width), 1, MAX_BACKING_SCALE),
    mode,
    orientation,
    touch,
    safeTop,
    safeBottom,
  };
}

/** Read the viewport from the live browser. Kept apart from `resolveViewport`
 *  so the decision stays testable without a DOM. */
export function readWindowViewport(win: Window = window): Viewport {
  const styles = typeof getComputedStyle === 'function' && win.document?.documentElement
    ? getComputedStyle(win.document.documentElement)
    : null;
  const readInset = (property: string): number => {
    const raw = styles?.getPropertyValue(property).trim();
    const parsed = raw ? Number.parseFloat(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  // Three signals, because no one of them is reliable: `pointer: coarse` is
  // false in some Chromium emulation and in a few Android webviews,
  // `maxTouchPoints` is 0 on others, and `ontouchstart` is missing on desktop
  // Safari. `input.js` already trusts the last two, so agreeing with it keeps
  // the pad and the layout from disagreeing about whether this is a phone.
  const coarse = typeof win.matchMedia === 'function'
    && win.matchMedia('(pointer: coarse)').matches;
  // Storybook and Playwright drive a pointer device but need the phone layout
  // deterministically. An explicit override beats sniffing, and it is the only
  // way to get a d-pad on screen in the workbench.
  const override = (win as Window & { canalRecallForceTouch?: boolean }).canalRecallForceTouch;
  const touch = typeof override === 'boolean'
    ? override
    : coarse || 'ontouchstart' in win || (win.navigator?.maxTouchPoints ?? 0) > 0;
  return resolveViewport({
    windowWidth: win.innerWidth,
    windowHeight: win.innerHeight,
    devicePixelRatio: win.devicePixelRatio || 1,
    touch,
    safeTop: readInset('--safe-top'),
    safeBottom: readInset('--safe-bottom'),
  });
}
