// The canvas used to be a fixed 1280×720 logical surface, letterboxed into
// whatever window it was given. On a landscape desktop that is invisible. On a
// portrait phone it is the whole bug: a 390×844 window gets a 390×219 canvas
// pinned to the middle of the screen, the 2D HUD draws into that strip, and the
// MapLibre container underneath keeps its own size — so the two layers show
// different parts of Amsterdam and most of the HUD lands off screen.
//
// This module decides one thing: given a physical window, what logical
// coordinate space should the canvas use. Desktop keeps the proven 16:9 space
// so no existing layout moves. Touch-sized viewports switch to a logical space
// that *is* the CSS viewport, which makes the canvas fill the screen, keeps the
// map and the HUD in the same coordinate system, and renders a 13 px label at
// 13 CSS px instead of 4.
//
// Everything downstream reads `width`/`height` rather than a constant, so the
// HUD layout, the camera centre and the touch controls all follow from here.

/** `desktop` keeps the fixed 16:9 space; `compact` fills a phone-sized screen. */
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

/** The proven desktop coordinate space. Portrait/compact no longer uses it. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

// Below this shorter-edge size a touch device is treated as a phone/small
// tablet and gets the compact, screen-filling layout. A touch laptop or a large
// landscape tablet stays on the desktop layout, which it has the room for.
export const COMPACT_MAX_SHORT_EDGE = 820;

// A logical space narrower than this makes the HUD cards collide no matter how
// they are laid out; a wider one stops being a phone. Clamping keeps the layout
// module's job finite.
const MIN_COMPACT_WIDTH = 300;
const MAX_COMPACT_WIDTH = 900;
const MIN_COMPACT_HEIGHT = 380;
const MAX_COMPACT_HEIGHT = 1400;

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
    // Fill the window. Logical units are CSS pixels, so text keeps the size it
    // was written at and the map container can simply be the whole screen.
    const width = clamp(Math.round(winW), MIN_COMPACT_WIDTH, MAX_COMPACT_WIDTH);
    const height = clamp(Math.round(winH), MIN_COMPACT_HEIGHT, MAX_COMPACT_HEIGHT);
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

  // Desktop: the historic letterbox, unchanged.
  const ratio = DESIGN_WIDTH / DESIGN_HEIGHT;
  let cssWidth = winW;
  let cssHeight = winH;
  if (cssWidth / cssHeight > ratio) cssWidth = cssHeight * ratio;
  else cssHeight = cssWidth / ratio;
  return {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    cssWidth,
    cssHeight,
    scale: cssWidth / DESIGN_WIDTH,
    backingScale: clamp(devicePixelRatio * (cssWidth / DESIGN_WIDTH), 1, MAX_BACKING_SCALE),
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
