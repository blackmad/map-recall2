// The toon look (#161, `?look=toon`): a game-y, low-fi, high-colour mode on the existing geometry and textures.
// Step 1: the existing Cartoon buildings look plus one full-frame palette pass at the end of the frame (ToonPost):
// OKLab chroma pushed in proportion to the chroma already there (hue held), then OKLab L posterised to bin centres. It runs after everything the
// frame drew, so measured tints and caps (the #179 roof luma cap) are its input and it only remaps them: bin centres
// never round a capped white up to 255. Off (the default), nothing is created and the
// frame is untouched.

/** `?look=toon` (or `window.__canalRecallLook = 'toon'` before load). */
export function toonLookFlag(): boolean {
  const g = globalThis as { __canalRecallLook?: string; location?: { search?: string } };
  const asked = g.__canalRecallLook ?? new URLSearchParams(g.location?.search ?? '').get('look');
  return asked === 'toon';
}

/**
 * The colour push (#161 step 2, look review): OKLab chroma times 1 + TOON_CHROMA_GAIN, faded in by the pixel's own
 * chroma (smoothstep TOON_CHROMA_FROM → TOON_CHROMA_FULL), so greys and whites stay near-grey and brick, paint and
 * tiles get the full push; hue is held (a and b scale together). Step 1's ×1.45 about sRGB luma turned grey blocks
 * lavender and teal.
 */
export const TOON_CHROMA_GAIN = 0.45;
export const TOON_CHROMA_FROM = 0.04;
export const TOON_CHROMA_FULL = 0.15;
/** OKLab L posterise: bins (`?toonBands=6|8|10`, default 8) and how far L moves to its bin centre. */
export const TOON_BAND_CHOICES = [6, 8, 10] as const;
export const TOON_POSTERISE = 0.7;

export function toonBandsFlag(): number {
  const g = globalThis as { __canalRecallToonBands?: number; location?: { search?: string } };
  const asked = Number(g.__canalRecallToonBands ?? new URLSearchParams(g.location?.search ?? '').get('toonBands') ?? NaN);
  return (TOON_BAND_CHOICES as readonly number[]).includes(asked) ? asked : 8;
}

type V3 = [number, number, number];
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function oklab([r, g, b]: V3): V3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function linearOf([L, a, b]: V3): V3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The remap on one sRGB colour (0..1), the CPU twin of the shader (tests, swatches). */
export function toonRemap(rgb: readonly [number, number, number], bands = 8): V3 {
  const [L, a, b] = oklab(rgb.map(toLinear) as V3);
  const gain = 1 + TOON_CHROMA_GAIN * smooth(TOON_CHROMA_FROM, TOON_CHROMA_FULL, Math.hypot(a, b));
  const bin = (Math.min(bands - 1, Math.floor(L * bands)) + 0.5) / bands;
  const lin = linearOf([L + (bin - L) * TOON_POSTERISE, a * gain, b * gain]);
  return lin.map(v => Math.max(0, Math.min(1, toSrgb(Math.max(0, v))))) as V3;
}

const f = (v: number) => v.toFixed(10);
const fragment = (bands: number) => /* glsl */ `
uniform sampler2D frame;
varying vec2 vUv;
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
void main() {
  vec3 c = toLin(texture2D(frame, vUv).rgb);
  vec3 lms = pow(vec3(${f(0.4122214708)} * c.r + ${f(0.5363325363)} * c.g + ${f(0.0514459929)} * c.b,
                      ${f(0.2119034982)} * c.r + ${f(0.6806995451)} * c.g + ${f(0.1073969566)} * c.b,
                      ${f(0.0883024619)} * c.r + ${f(0.2817188376)} * c.g + ${f(0.6299787005)} * c.b), vec3(1.0 / 3.0));
  float L = ${f(0.2104542553)} * lms.x + ${f(0.7936177850)} * lms.y - ${f(0.0040720468)} * lms.z;
  vec2 ab = vec2(${f(1.9779984951)} * lms.x - ${f(2.4285922050)} * lms.y + ${f(0.4505937099)} * lms.z,
                 ${f(0.0259040371)} * lms.x + ${f(0.7827717662)} * lms.y - ${f(0.8086757660)} * lms.z);
  ab *= 1.0 + ${f(TOON_CHROMA_GAIN)} * smoothstep(${f(TOON_CHROMA_FROM)}, ${f(TOON_CHROMA_FULL)}, length(ab));
  float bin = (min(${(bands - 1).toFixed(1)}, floor(L * ${bands.toFixed(1)})) + 0.5) / ${bands.toFixed(1)};
  L += (bin - L) * ${f(TOON_POSTERISE)};
  vec3 q = vec3(L + ${f(0.3963377774)} * ab.x + ${f(0.2158037573)} * ab.y, L - ${f(0.1055613458)} * ab.x - ${f(0.0638541728)} * ab.y, L - ${f(0.0894841775)} * ab.x - ${f(1.2914855480)} * ab.y);
  q = q * q * q;
  vec3 lin = vec3(${f(4.0767416621)} * q.x - ${f(3.3077115913)} * q.y + ${f(0.2309699292)} * q.z,
                  ${f(-1.2684380046)} * q.x + ${f(2.6097574011)} * q.y - ${f(0.3413193965)} * q.z,
                  ${f(-0.0041960863)} * q.x - ${f(0.7034186147)} * q.y + ${f(1.7076147010)} * q.z);
  gl_FragColor = vec4(clamp(toSrgb(max(lin, 0.0)), 0.0, 1.0), 1.0);
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
    this.material = new THREE.ShaderMaterial({ uniforms: { frame: { value: null } }, vertexShader: VERTEX, fragmentShader: fragment(toonBandsFlag()), depthTest: false, depthWrite: false });
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
