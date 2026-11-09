// Corridor emphasis (#161 lever 7, `?corridorFocus=1`, default off): outside a soft band around the rider's street the
// frame is darkened and desaturated by up to CORRIDOR_DIM / CORRIDOR_DESAT (12 %), so the corridor is the subject.
// The band is pure screen geometry, a wedge that is wide at the bottom of the frame (where the rider is) and narrows
// toward the horizon (where the street meets the skyline): it reads nothing from the world, so it cannot reveal the
// street under question or any answer. One extra full-frame pass, like the toon palette (engine/toonLook.ts).

export const CORRIDOR_DIM = 0.12;
export const CORRIDOR_DESAT = 0.12;
/** Half-width of the band as a share of the frame width: at the bottom edge (v = 0) and at the top edge (v = 1). */
export const CORRIDOR_HALF_BOTTOM = 0.5;
export const CORRIDOR_HALF_TOP = 0.18;
/** The effect ramps in between 1x and CORRIDOR_RAMP x the half-width. */
export const CORRIDOR_RAMP = 1.9;

export function corridorFocusFlag(): boolean {
  const g = globalThis as { __canalRecallCorridorFocus?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallCorridorFocus ?? new URLSearchParams(g.location?.search ?? '').get('corridorFocus');
  return asked === true || asked === '1' || asked === 'true' || asked === 'on';
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0 inside the corridor, 1 well outside it; u across (0 left), v up (0 bottom). The CPU twin of the shader. */
export function corridorWeight(u: number, v: number): number {
  const half = CORRIDOR_HALF_BOTTOM + (CORRIDOR_HALF_TOP - CORRIDOR_HALF_BOTTOM) * v;
  return smooth(1, CORRIDOR_RAMP, Math.abs(u - 0.5) / half);
}

const f = (x: number) => x.toFixed(6);
const FRAGMENT = /* glsl */ `
uniform sampler2D frame;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(frame, vUv).rgb;
  float half = ${f(CORRIDOR_HALF_BOTTOM)} + (${f(CORRIDOR_HALF_TOP - CORRIDOR_HALF_BOTTOM)}) * vUv.y;
  float w = smoothstep(1.0, ${f(CORRIDOR_RAMP)}, abs(vUv.x - 0.5) / half);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(luma), ${f(CORRIDOR_DESAT)} * w);
  gl_FragColor = vec4(c * (1.0 - ${f(CORRIDOR_DIM)} * w), 1.0);
}`;
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** The corridor pass: one framebuffer copy and one full-screen draw, created only under the flag. */
export class CorridorPost {
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
