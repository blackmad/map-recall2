// Startup probe for the quality tier (renderGovernor.ts chooseTier): what one fill-heavy frame costs this
// GPU at the size the frame draws, plus what the browser says about the machine.
//
// Weak machines are fill-bound (pixel ratio, MSAA, shadow map; "fine on my M4, too slow on their
// computers", 2026-10-23), so the probe draws OVERDRAW full-screen layers of a shader with some ALU into an
// offscreen target of the drawing-buffer size, and times each frame through a 1-pixel readPixels (which
// waits for the GPU; gl.finish does not in Chrome). One warm-up frame compiles the program; the median of
// the rest is the number. It stops at `budgetMs` (SwiftShader at 1.5x takes ~100 ms a frame). The
// program, target and geometry are freed afterwards, so the probe leaves no resident program behind.

import type { TierProbe } from '../renderGovernor';

const OVERDRAW = 6;

const VERTEX = `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAGMENT = `
precision highp float;
out vec4 colour;
void main() {
  vec2 p = gl_FragCoord.xy * 0.013;
  float v = sin(p.x) * cos(p.y) + sin(p.x * 1.7 + p.y * 0.3) * 0.5;
  colour = vec4(vec3(0.5 + 0.5 * v), 0.25);
}`;

export interface FillProbe { frameMs: number | null; frames: number; width: number; height: number }

/** Time fill-heavy frames at the renderer's drawing-buffer size. Never throws; null ms when it cannot run. */
export function probeFill(THREE: any, renderer: any, options: { frames?: number; budgetMs?: number; now?: () => number; width?: number; height?: number } = {}): FillProbe {
  const now = options.now ?? (() => performance.now());
  const frames = options.frames ?? 7, budgetMs = options.budgetMs ?? 1000;
  let width = 0, height = 0;
  const disposables: any[] = [];
  try {
    // The size the frame will draw at: the caller's (the window at the native pixel ratio; at boot the canvas
    // may not be laid out yet), else the drawing buffer.
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    width = Math.max(1, Math.round(options.width ?? size.x)); height = Math.max(1, Math.round(options.height ?? size.y));
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthTest: false, depthWrite: false,
    });
    disposables.push(target, geometry, material);
    const scene = new THREE.Scene();
    for (let i = 0; i < OVERDRAW; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    const camera = new THREE.Camera();
    const gl: WebGL2RenderingContext = renderer.getContext();
    const pixel = new Uint8Array(4);
    const previous = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.autoClear = true;
    const times: number[] = [];
    const start = now();
    try {
      renderer.setRenderTarget(target);
      for (let i = 0; i < frames + 1 && now() - start < budgetMs; i++) {
        const t0 = now();
        renderer.render(scene, camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        if (i > 0) times.push(now() - t0); // frame 0 compiles the program
      }
    } finally {
      renderer.setRenderTarget(previous);
      renderer.autoClear = autoClear;
    }
    times.sort((a, b) => a - b);
    const frameMs = times.length ? Math.round(times[Math.floor(times.length / 2)] * 100) / 100 : null;
    return { frameMs, frames: times.length, width, height };
  } catch (error) {
    console.warn('tier probe: could not run', error);
    return { frameMs: null, frames: 0, width, height };
  } finally {
    for (const d of disposables) d.dispose?.();
  }
}

/** The GPU's renderer string (unmasked where the browser allows). */
export function gpuString(gl: WebGL2RenderingContext | null): string {
  if (!gl) return '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch { return ''; }
}

/** Everything chooseTier reads. */
export function tierProbe(THREE: any, renderer: any, env: { deviceMemory?: unknown; hardwareConcurrency?: unknown; dpr: number; coarse: boolean }, options?: Parameters<typeof probeFill>[2]): TierProbe & { fill: FillProbe } {
  const fill = probeFill(THREE, renderer, options);
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return {
    frameMs: fill.frameMs, gpu: gpuString(renderer?.getContext?.() ?? null),
    deviceMemory: n(env.deviceMemory), hardwareConcurrency: n(env.hardwareConcurrency), dpr: env.dpr, coarse: env.coarse, fill,
  };
}
