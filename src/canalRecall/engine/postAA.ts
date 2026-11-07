// Post anti-aliasing spike (lane R3-A, #230, `?smaa=1`, off by default): SMAA 1x over the resolved MSAA frame.
//
// The pattern is the toon look's ToonPost (engine/toonLook.ts): after the frame, copy the default framebuffer into a
// FramebufferTexture (one copy) and draw the result back to the screen. SMAA's three passes (edges, blend weights,
// neighbourhood blend; three's examples/jsm/postprocessing/SMAAPass.js, bundled into the engine and resolving `three`
// through the page's shim) read that copy as their colour input. The three programs are linked once on creation
// (`renderer.compile`), and the edge and weight targets follow the drawing buffer's size, so a resize relinks nothing.
//
// Measured on the user's S3 pose and three more spots (swap-zfight aliasPx, GPU ms): see #230. The recommendation
// is in the hand-back; the flag stays off by default.
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/** `?smaa=1` (or `window.__canalRecallSmaa = true`). Off unless asked. */
export function smaaFlag(): boolean {
  const g = globalThis as { __canalRecallSmaa?: unknown; location?: { search?: string } };
  let asked: unknown = g.__canalRecallSmaa;
  if (asked === undefined) {
    try { asked = new URLSearchParams(g.location?.search ?? '').get('smaa'); } catch { asked = null; }
  }
  return asked === true || asked === '1' || asked === 'true' || asked === 'on';
}

/** SMAA after the frame. Created only under the flag; `apply` is FrameHost's `post` hook. */
export class SmaaPost {
  private texture: any = null;
  private width = 0;
  private height = 0;
  private readonly pass: any;
  private readonly read: { texture: any } = { texture: null };
  private compiled = false;

  constructor(private readonly THREE: any) {
    this.pass = new SMAAPass();
    this.pass.renderToScreen = true;
  }

  /** The pass's three programs, for a warm-up compile (no link inside a ride frame). */
  materials(): any[] { return [this.pass._materialEdges, this.pass._materialWeights, this.pass._materialBlend]; }

  private compile(renderer: any): void {
    this.compiled = true;
    const scene = new this.THREE.Scene(), camera = new this.THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), geometry = new this.THREE.PlaneGeometry(2, 2);
    for (const m of this.materials()) { const q = new this.THREE.Mesh(geometry, m); q.frustumCulled = false; scene.add(q); }
    try { renderer.compile(scene, camera); } finally { geometry.dispose(); }
  }

  /** After the frame: anti-alias what the default framebuffer holds, in place. */
  apply(renderer: any, width: number, height: number): void {
    if (!width || !height) return;
    if (!this.compiled) this.compile(renderer);
    if (!this.texture || width !== this.width || height !== this.height) {
      this.texture?.dispose();
      this.texture = new this.THREE.FramebufferTexture(width, height);
      this.texture.minFilter = this.texture.magFilter = this.THREE.LinearFilter;
      this.width = width; this.height = height;
      this.read.texture = this.texture;
      this.pass.setSize(width, height);
    }
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width, height);
    renderer.copyFramebufferToTexture(this.texture, null);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { this.pass.render(renderer, null, this.read); } finally { renderer.autoClear = autoClear; renderer.setRenderTarget(null); renderer.setViewport(0, 0, width, height); }
  }

  dispose(): void { this.texture?.dispose(); this.pass.dispose(); }
}
