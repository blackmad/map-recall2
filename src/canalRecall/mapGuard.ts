/**
 * Keep a MapLibre 5 map alive when the device's GPU process dies mid-shader.
 *
 * MapLibre 5 (we pin 5.24.0, the last 5.x) reads `COMPILE_STATUS` straight after
 * `gl.compileShader` and throws `Could not compile fragment shader: ` when the
 * driver answers false. A dead GPU process answers every query with 0/false and
 * an empty info log, while `isContextLost()` flips only a moment later — so the
 * `Program` constructor throws from the render loop before `webglcontextlost`
 * arrives. `Painter.useProgram` caches programs only on success, so the same
 * program is rebuilt and thrown on every animation frame: the map never
 * recovers and the page turns into a loop of uncaught errors (Sentry
 * CANAL-RECALL-1: 94 console errors in 20 s on Android, 5 per second).
 *
 * Upstream fixed this in maplibre-gl 6.13.0 (issue #8607, PR #8633) by treating
 * a failed link with no attached shaders as a context loss. Until the ride moves
 * to 6.x — or drops MapLibre altogether (`docs/research/drop-maplibre-20261010.md`)
 * — this module applies the same rule around `_render`: swallow only the
 * empty-log compile/link errors, stop drawing for a moment so the context-loss
 * event can arrive, retry once, and report one diagnostic instead of thousands.
 * An error carrying a real GLSL log is never swallowed.
 */

/** Empty-log shader compile/link failures, i.e. the GPU never answered. */
export const DEAD_GPU_SHADER_ERROR = /^(?:Could not compile (?:fragment|vertex) shader|Program failed to link):\s*(?:null)?$/;

export interface GraphicsFailure {
  event: 'dead-gpu-shader' | 'webgl-context-lost' | 'webgl-unavailable';
  /** How long drawing was paused after a shader failure (0 for a plain context loss). */
  holdMs: number;
  contextLost: boolean | null;
  renderer: string | null;
  vendor: string | null;
  version: string | null;
  userAgent: string;
  /** Chrome-only `performance.memory`; null on Firefox and Safari. */
  heapMB: number | null;
  /** Chrome-only `navigator.deviceMemory`, in GB. */
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  canvas: { width: number; height: number; cssWidth: number; cssHeight: number; dpr: number } | null;
  drawingBuffer: { width: number; height: number } | null;
  /** The browser's refusal, for `webgl-unavailable` (MapLibre's JSON-encoded creation error). */
  message?: string;
}

export interface GuardableMap {
  _render?: (...args: unknown[]) => unknown;
  on?: (event: string, listener: () => void) => unknown;
  triggerRepaint?: () => unknown;
  getCanvas?: () => HTMLCanvasElement | null;
  getContainer?: () => HTMLElement | null;
}

export interface MapGuardOptions {
  /** Pause drawing this long after a dead-GPU failure so the loss event lands. */
  holdMs?: number;
  /** Show the reload notice when failures persist this long. */
  noticeAfterMs?: number;
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  report?: (failure: GraphicsFailure) => void;
  onNotice?: (visible: boolean) => void;
}

export function isDeadGpuShaderError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && DEAD_GPU_SHADER_ERROR.test(message.trim());
}

const guarded = new WeakSet<object>();

/** Wrap one map's render loop. Returns false when the map cannot be guarded. */
export function guardMapRender(map: GuardableMap | null | undefined, options: MapGuardOptions = {}): boolean {
  if (!map || typeof map._render !== 'function' || guarded.has(map)) return false;
  guarded.add(map);

  const holdMs = options.holdMs ?? 2000;
  const noticeAfterMs = options.noticeAfterMs ?? 8000;
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const cancel = options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const report = options.report ?? defaultReport;
  const render = map._render;

  let holdUntil = 0;
  let holdTimer: unknown = null;
  let noticeTimer: unknown = null;
  const reported = new Set<GraphicsFailure['event']>();
  let noticeShown = false;

  const reportOnce = (event: GraphicsFailure['event'], hold: number) => {
    if (reported.has(event)) return;
    reported.add(event);
    report(describeGraphics(map, event, hold));
  };

  const showNotice = () => {
    noticeTimer = null;
    if (noticeShown) return;
    noticeShown = true;
    options.onNotice?.(true);
    mountNotice(map);
  };

  const retry = () => {
    holdTimer = null;
    try {
      map.triggerRepaint?.();
    } catch {
      // The context may be gone; the restore handler will repaint.
    }
  };

  map._render = function guardedRender(this: unknown, ...args: unknown[]): unknown {
    if (now() < holdUntil) return undefined;
    try {
      return render.apply(this, args);
    } catch (error) {
      if (!isDeadGpuShaderError(error)) throw error;

      holdUntil = now() + holdMs;
      if (!reported.has('dead-gpu-shader')) {
        reportOnce('dead-gpu-shader', holdMs);
        noticeTimer = schedule(showNotice, noticeAfterMs);
      }
      holdTimer ??= schedule(retry, holdMs);
      return undefined;
    }
  };

  map.on?.('webglcontextlost', () => {
    // The missing half of the evidence: a context loss with no shader throw is
    // the GPU process dying (or being killed for memory) before we tried to
    // compile anything, and it is what a "crash after N seconds" looks like
    // from inside the page.
    reportOnce('webgl-context-lost', 0);
    if (!noticeShown && noticeTimer == null) noticeTimer = schedule(showNotice, noticeAfterMs);
  });
  map.on?.('webglcontextrestored', () => {
    if (noticeTimer != null) cancel(noticeTimer);
    noticeTimer = null;
    holdUntil = 0;
    if (noticeShown) {
      noticeShown = false;
      options.onNotice?.(false);
      hideNotice(map);
    }
  });

  return true;
}

function describeGraphics(map: GuardableMap, event: GraphicsFailure['event'], holdMs: number): GraphicsFailure {
  const canvas = map.getCanvas?.() ?? null;
  const memory = typeof performance === 'undefined' ? undefined : (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  const failure: GraphicsFailure = {
    event,
    holdMs,
    contextLost: null,
    renderer: null,
    vendor: null,
    version: null,
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    heapMB: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    deviceMemoryGB: typeof navigator === 'undefined' ? null : Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) || null,
    hardwareConcurrency: typeof navigator === 'undefined' ? null : navigator.hardwareConcurrency || null,
    canvas: canvas
      ? {
          width: canvas.width,
          height: canvas.height,
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
          dpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
        }
      : null,
    drawingBuffer: null,
  };
  try {
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    if (!gl) return failure;
    failure.contextLost = gl.isContextLost();
    failure.version = String(gl.getParameter(gl.VERSION));
    failure.drawingBuffer = { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    failure.renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    failure.vendor = String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR));
  } catch {
    // Diagnostics must never mask the failure being reported.
  }
  return failure;
}

/**
 * Failures reported before `monitoring.bundle.js` arrived (it loads async, off the critical path, and
 * a WebGL refusal happens at the page's `load`). The monitoring bundle drains this queue on start.
 */
export const PENDING_GRAPHICS_FAILURES = '__canalRecallPendingGraphicsFailures';

function defaultReport(failure: GraphicsFailure): void {
  const root = globalThis as {
    canalRecallMonitoring?: { reportGraphicsFailure?: (detail: GraphicsFailure) => void };
    [PENDING_GRAPHICS_FAILURES]?: GraphicsFailure[];
  };
  const hook = root.canalRecallMonitoring;
  if (typeof hook?.reportGraphicsFailure === 'function') {
    hook.reportGraphicsFailure(failure);
    return;
  }
  (root[PENDING_GRAPHICS_FAILURES] ??= []).push(failure);
  if (typeof console !== 'undefined') console.warn('[canal-recall:monitoring] graphics failure', failure);
}

/**
 * The browser refused to create a WebGL context at all (Sentry CANAL-RECALL-C: Chrome answers
 * "Web page caused context loss and was blocked" once a page has lost its context too often, and
 * keeps refusing until the browser restarts). `new maplibregl.Map` throws from the constructor, which
 * used to take the whole game down at `load`. The caller keeps going without a map; this reports the
 * refusal once and tells the rider what to do.
 */
export function reportWebglUnavailable(
  container: HTMLElement | null | undefined,
  error: unknown,
  report: (failure: GraphicsFailure) => void = defaultReport,
): GraphicsFailure {
  const raw = error instanceof Error ? error.message : String(error);
  const failure = describeGraphics({ getContainer: () => container ?? null }, 'webgl-unavailable', 0);
  failure.message = raw.slice(0, 600);
  report(failure);
  mountNoticeIn(container, 'This browser has switched off 3D graphics for this page. Close and reopen the browser, then reload.');
  return failure;
}

const NOTICE_ID = 'canal-graphics-restarted';

function mountNotice(map: GuardableMap): void {
  mountNoticeIn(map.getContainer?.(), 'The 3D map stopped responding after the device restarted its graphics. Reload to carry on.');
}

function mountNoticeIn(container: HTMLElement | null | undefined, message: string): void {
  const doc = container?.ownerDocument;
  if (!container || !doc || doc.getElementById(NOTICE_ID)) return;

  const notice = doc.createElement('div');
  notice.id = NOTICE_ID;
  notice.setAttribute('role', 'status');
  notice.style.cssText =
    'position:absolute;left:12px;right:12px;bottom:12px;z-index:30;display:flex;gap:12px;align-items:center;' +
    'padding:10px 12px;border-radius:8px;background:#1d1b17;color:#fbf8f2;' +
    'font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28)';

  const text = doc.createElement('span');
  text.textContent = message;
  const reload = doc.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.style.cssText =
    'margin-left:auto;flex:none;padding:6px 10px;border:0;border-radius:6px;background:#e8a33d;' +
    'color:#1d1b17;font:inherit;font-weight:600;cursor:pointer';
  reload.addEventListener('click', () => doc.defaultView?.location.reload());

  notice.append(text, reload);
  container.append(notice);
}

function hideNotice(map: GuardableMap): void {
  map.getContainer?.()?.ownerDocument?.getElementById(NOTICE_ID)?.remove();
}
