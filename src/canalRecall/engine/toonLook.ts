// The toon look (#161, `?look=toon`): a game-y, low-fi, high-colour mode on the existing geometry and textures.
// Step 1: the existing Cartoon buildings look plus one full-frame palette pass at the end of the frame (ToonPost):
// chroma boosted about each pixel's luma, then the luma posterised to bin centres. It runs after everything the
// frame drew, so measured tints and caps (the #179 roof luma cap) are its input and it only remaps them: bin centres
// never round a capped white up to 255 (the top bin is 15/16 = 239). Off (the default), nothing is created and the
// frame is untouched.

/** `?look=toon` (or `window.__canalRecallLook = 'toon'` before load). */
export function toonLookFlag(): boolean {
  const g = globalThis as { __canalRecallLook?: string; location?: { search?: string } };
  const asked = g.__canalRecallLook ?? new URLSearchParams(g.location?.search ?? '').get('look');
  return asked === 'toon';
}

/** Chroma gain about luma, and the luma posterise bins. */
export const TOON_CHROMA = 1.45;
export const TOON_LUMA_BINS = 8;
/** How far the luma moves to its bin centre (1: flat bands; less keeps some of the texture inside a band). */
export const TOON_POSTERISE = 0.7;

/** The remap on one sRGB colour (0..1), the CPU twin of the shader (tests, swatches). */
export function toonRemap([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const bin = (Math.min(TOON_LUMA_BINS - 1, Math.floor(y * TOON_LUMA_BINS)) + 0.5) / TOON_LUMA_BINS;
  const y2 = y + (bin - y) * TOON_POSTERISE;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [clamp(y2 + (r - y) * TOON_CHROMA), clamp(y2 + (g - y) * TOON_CHROMA), clamp(y2 + (b - y) * TOON_CHROMA)];
}

const FRAGMENT = /* glsl */ `
uniform sampler2D frame;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(frame, vUv).rgb;
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float bin = (min(${(TOON_LUMA_BINS - 1).toFixed(1)}, floor(y * ${TOON_LUMA_BINS.toFixed(1)})) + 0.5) / ${TOON_LUMA_BINS.toFixed(1)};
  float y2 = y + (bin - y) * ${TOON_POSTERISE.toFixed(3)};
  gl_FragColor = vec4(clamp(vec3(y2) + (c - vec3(y)) * ${TOON_CHROMA.toFixed(3)}, 0.0, 1.0), 1.0);
}`;
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * The palette pass: copies the drawn frame into a texture (one framebuffer copy) and draws it back through the remap
 * as one full-screen triangle pair. Created only under the flag.
 */
export class ToonPost {
  private texture: any = null;
  private readonly scene: any;
  private readonly camera: any;
  private readonly material: any;
  private width = 0;
  private height = 0;

  constructor(private readonly THREE: any) {
    this.material = new THREE.ShaderMaterial({ uniforms: { frame: { value: null } }, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** After the frame: remap what the default framebuffer holds, in place. */
  apply(renderer: any, width: number, height: number): void {
    if (!width || !height) return;
    if (!this.texture || width !== this.width || height !== this.height) {
      this.texture?.dispose();
      this.texture = new this.THREE.FramebufferTexture(width, height);
      this.width = width; this.height = height;
      this.material.uniforms.frame.value = this.texture;
    }
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width, height);
    renderer.copyFramebufferToTexture(this.texture, null);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void { this.texture?.dispose(); this.material.dispose(); }
}
