/**
 * What's New screenshots open in an in-page lightbox instead of a new tab
 * (user, 2026-11-22). whats-new.html is legacy inline JS; it calls the small
 * browser adapter at the bottom (window.CanalWhatsNewLightbox) and keeps a
 * plain same-tab link as the no-JS fallback.
 *
 * The state logic (index, wrap, swipe, keys) is pure and unit-tested; the DOM
 * part is a thin dialog: caption, counter, previous/next, close, focus trap,
 * focus restored to the thumbnail that opened it. No third-party library.
 */

export interface LightboxImage { src: string; alt?: string; caption?: string }

export interface LightboxState { images: readonly LightboxImage[]; index: number; open: boolean }

export type LightboxAction =
  | { type: 'open'; images: readonly LightboxImage[]; index: number }
  | { type: 'close' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'go'; index: number };

export const CLOSED: LightboxState = { images: [], index: 0, open: false };

const clampIndex = (i: number, n: number): number => (n <= 0 ? 0 : Math.min(n - 1, Math.max(0, Math.trunc(Number.isFinite(i) ? i : 0))));

/** Previous/next wrap around, so a two-image before/after pair flips back and forth. */
export function lightboxReducer(state: LightboxState, action: LightboxAction): LightboxState {
  switch (action.type) {
    case 'open': {
      const images = action.images.filter(i => i && typeof i.src === 'string' && i.src.length > 0);
      if (!images.length) return CLOSED;
      return { images, index: clampIndex(action.index, images.length), open: true };
    }
    case 'close':
      return state.open ? { ...state, open: false } : state;
    case 'next':
    case 'prev': {
      const n = state.images.length;
      if (!state.open || n < 2) return state;
      return { ...state, index: (state.index + (action.type === 'next' ? 1 : -1) + n) % n };
    }
    case 'go':
      return state.open ? { ...state, index: clampIndex(action.index, state.images.length) } : state;
    default:
      return state;
  }
}

/** Keys the open lightbox handles; anything else (Tab is trapped separately) passes through. */
export function keyAction(key: string): LightboxAction | null {
  switch (key) {
    case 'Escape': case 'Esc': return { type: 'close' };
    case 'ArrowRight': case 'Right': return { type: 'next' };
    case 'ArrowLeft': case 'Left': return { type: 'prev' };
    default: return null;
  }
}

/**
 * A horizontal swipe: at least 40 px and mostly sideways (|dx| > 1.5 |dy|),
 * so a vertical scroll or a tap does not change the image. Swiping left shows
 * the next image, as in a phone photo viewer.
 */
export const SWIPE_MIN_PX = 40;
export function swipeAction(dx: number, dy: number): LightboxAction | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= 1.5 * Math.abs(dy)) return null;
  return dx < 0 ? { type: 'next' } : { type: 'prev' };
}

/** "2 of 3" for a multi-image note, empty for one image. */
export function counterLabel(state: LightboxState): string {
  return state.images.length > 1 ? `${state.index + 1} of ${state.images.length}` : '';
}

/** Tab cycling inside the dialog: returns the index to focus, or null to let the browser move. */
export function trapFocusIndex(current: number, count: number, shift: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return null;
}

const STYLE_ID = 'wn-lightbox-style';
const CSS = `
.wn-lb{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
  background:rgba(12,14,16,.88);color:#f1ede3;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:pan-y;overscroll-behavior:contain}
.wn-lb[hidden]{display:none}
.wn-lb figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(1400px,100%);min-height:0}
.wn-lb img{display:block;max-width:100%;max-height:calc(100dvh - 120px);width:auto;height:auto;object-fit:contain;border-radius:6px;background:#222;box-shadow:0 8px 32px rgba(0,0,0,.45);user-select:none;-webkit-user-drag:none}
.wn-lb figcaption{max-width:70ch;text-align:center;font-size:14px;color:#e6e3da}
.wn-lb figcaption:empty{display:none}
.wn-lb .wn-lb-count{font-size:12px;color:#b9b5aa;font-variant-numeric:tabular-nums}
.wn-lb .wn-lb-count:empty{display:none}
.wn-lb button{position:absolute;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font:600 22px/1 system-ui,sans-serif;cursor:pointer}
.wn-lb button:hover{background:rgba(255,255,255,.26)}
.wn-lb button:focus-visible{outline:2px solid #e08a5c;outline-offset:2px}
.wn-lb .wn-lb-close{top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}
.wn-lb .wn-lb-prev{left:max(10px,env(safe-area-inset-left));top:50%;transform:translateY(-50%)}
.wn-lb .wn-lb-next{right:max(10px,env(safe-area-inset-right));top:50%;transform:translateY(-50%)}
.wn-lb .wn-lb-prev[hidden],.wn-lb .wn-lb-next[hidden]{display:none}
@media (max-width:560px){.wn-lb{padding-left:4px;padding-right:4px}.wn-lb img{max-height:calc(100dvh - 150px);border-radius:4px}
  .wn-lb .wn-lb-prev,.wn-lb .wn-lb-next{top:auto;bottom:max(10px,env(safe-area-inset-bottom));transform:none}}
`;

export interface LightboxController {
  open(images: readonly LightboxImage[], index: number, opener?: HTMLElement | null): void;
  close(): void;
  readonly state: LightboxState;
  readonly element: HTMLElement;
  destroy(): void;
}

/** Mounts one hidden dialog in `doc.body`; call `open` from a thumbnail's click handler. */
export function mountLightbox(doc: Document = document): LightboxController {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; doc.head.append(style);
  }
  const root = doc.createElement('div');
  root.className = 'wn-lb'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Screenshot');
  const fig = doc.createElement('figure');
  const img = doc.createElement('img'); img.decoding = 'async';
  const cap = doc.createElement('figcaption'); cap.id = 'wn-lb-caption';
  const count = doc.createElement('div'); count.className = 'wn-lb-count'; count.setAttribute('aria-live', 'polite');
  fig.append(img, cap, count);
  const button = (cls: string, label: string, text: string): HTMLButtonElement => {
    const b = doc.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label); b.textContent = text; return b;
  };
  const prev = button('wn-lb-prev', 'Previous image', '‹');
  const next = button('wn-lb-next', 'Next image', '›');
  const close = button('wn-lb-close', 'Close', '×');
  root.append(fig, prev, next, close);
  img.setAttribute('aria-describedby', cap.id);
  doc.body.append(root);

  let state: LightboxState = CLOSED;
  let opener: HTMLElement | null = null;
  let prevOverflow = '';

  const render = (): void => {
    root.hidden = !state.open;
    if (!state.open) return;
    const cur = state.images[state.index];
    if (img.getAttribute('src') !== cur.src) img.src = cur.src;
    img.alt = cur.alt || cur.caption || '';
    cap.textContent = cur.caption || '';
    count.textContent = counterLabel(state);
    const multi = state.images.length > 1;
    prev.hidden = !multi; next.hidden = !multi;
  };
  const dispatch = (action: LightboxAction): void => {
    const was = state.open;
    state = lightboxReducer(state, action);
    render();
    if (was && !state.open) {
      doc.body.style.overflow = prevOverflow;
      const back = opener; opener = null;
      if (back && back.isConnected) back.focus();
    }
  };
  const focusables = (): HTMLElement[] => [prev, next, close].filter(b => !b.hidden);

  const onKey = (e: KeyboardEvent): void => {
    if (!state.open) return;
    if (e.key === 'Tab') {
      const list = focusables();
      const to = trapFocusIndex(list.indexOf(doc.activeElement as HTMLElement), list.length, e.shiftKey);
      if (to !== null) { e.preventDefault(); list[to].focus(); }
      return;
    }
    const action = keyAction(e.key);
    if (action) { e.preventDefault(); dispatch(action); }
  };
  doc.addEventListener('keydown', onKey);
  // Backdrop: a click on the dark area (not the image, caption or buttons) closes.
  root.addEventListener('click', e => { if (e.target === root || e.target === fig) dispatch({ type: 'close' }); });
  close.addEventListener('click', () => dispatch({ type: 'close' }));
  prev.addEventListener('click', () => dispatch({ type: 'prev' }));
  next.addEventListener('click', () => dispatch({ type: 'next' }));
  let start: { x: number; y: number } | null = null;
  root.addEventListener('touchstart', e => { const t = e.touches[0]; start = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  root.addEventListener('touchend', e => {
    const t = e.changedTouches[0]; if (!start || !t) return;
    const action = swipeAction(t.clientX - start.x, t.clientY - start.y); start = null;
    if (action) dispatch(action);
  });

  return {
    open(images, index, from) {
      const was = state.open;
      state = lightboxReducer(state, { type: 'open', images, index });
      if (!state.open) return;
      if (!was) { opener = from ?? (doc.activeElement as HTMLElement | null); prevOverflow = doc.body.style.overflow; doc.body.style.overflow = 'hidden'; }
      render();
      close.focus();
    },
    close() { dispatch({ type: 'close' }); },
    get state() { return state; },
    element: root,
    destroy() { doc.removeEventListener('keydown', onKey); if (state.open) doc.body.style.overflow = prevOverflow; root.remove(); },
  };
}

// Browser adapter for whats-new.html (legacy inline script).
declare global { interface Window { CanalWhatsNewLightbox?: { open: LightboxController['open'] } } }
if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.CanalWhatsNewLightbox) {
  let ctl: LightboxController | null = null;
  window.CanalWhatsNewLightbox = { open: (images, index, from) => { ctl ??= mountLightbox(document); ctl.open(images, index, from); } };
}
