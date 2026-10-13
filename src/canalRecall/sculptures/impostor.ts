// Multi-view photo impostor for a sculpture, THREE injected.
//
// The atlas holds one tile per camera azimuth (scripts/sculptures/
// build_impostor.py): the figure cut out of a real photo taken from that side,
// feet at a fixed row, scaled to the figure's height. At runtime a single
// vertical quad turns about the statue's vertical axis to face the eye
// (cylindrical billboard) and shows the tile for the eye's azimuth around
// the statue. Neighbouring tiles cross-fade only in a narrow band around the
// midpoint between them: a wide linear blend of two photos of a figure from
// 45° apart draws two ghost figures (the 2026-10-09 pilot's complaint).
// Alpha-tested, depth-written: it sorts with everything else like a mesh.

export type ImpostorView = { azimuthDeg: number; tile: number; photo?: string };
export type ImpostorMeta = {
  version: number;
  id: string;
  cols: number;
  rows: number;
  tilePx: [number, number];
  figureHeightM: number;
  tileHeightM: number;
  tileWidthM: number;
  feetFromBottom: number;
  views: ImpostorView[];
};

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * The two tiles to show for a camera azimuth θ (degrees about the statue, 0 =
 * in front, positive toward the figure's left) and the weight of the second.
 * `band` is the half-width of the cross-fade as a fraction of the gap (0.5 =
 * plain linear blend, 0 = hard switch).
 */
export function pickViews(views: ImpostorView[], azimuthDeg: number, band = 0.12): { a: number; b: number; t: number } {
  if (!views.length) return { a: 0, b: 0, t: 0 };
  if (views.length === 1) return { a: views[0].tile, b: views[0].tile, t: 0 };
  const sorted = [...views].sort((x, y) => wrap180(x.azimuthDeg) - wrap180(y.azimuthDeg));
  const th = wrap180(azimuthDeg);
  for (let i = 0; i < sorted.length; i++) {
    const lo = sorted[i], hi = sorted[(i + 1) % sorted.length];
    const a0 = wrap180(lo.azimuthDeg);
    let gap = wrap180(hi.azimuthDeg) - a0;
    if (gap <= 0) gap += 360;
    let d = th - a0;
    if (d < 0) d += 360;
    if (d <= gap) {
      const f = d / gap;
      const t = band <= 0 ? (f < 0.5 ? 0 : 1) : smoothstep(0.5 - band, 0.5 + band, f);
      return { a: lo.tile, b: hi.tile, t };
    }
  }
  return { a: sorted[0].tile, b: sorted[0].tile, t: 0 };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Camera azimuth about the statue (degrees, 0 = in front, + toward the figure's
 * left) from the eye in the sculpture's local ENU frame and the facing heading
 * (compass degrees, clockwise from north).
 */
export function cameraAzimuthDeg(eyeEast: number, eyeNorth: number, facingDeg: number): number {
  const h = facingDeg * Math.PI / 180;
  const fx = Math.sin(h), fy = Math.cos(h);
  const cross = fx * eyeNorth - fy * eyeEast, dot = fx * eyeEast + fy * eyeNorth;
  return Math.atan2(cross, dot) * 180 / Math.PI;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D atlas;
uniform vec2 grid;
uniform float tileA;
uniform float tileB;
uniform float mixB;
uniform float brightness;
varying vec2 vUv;
vec4 tile(float i, vec2 uv) {
  float c = mod(i, grid.x);
  float r = floor(i / grid.x);
  vec2 o = vec2(c, grid.y - 1.0 - r);
  return texture2D(atlas, (o + clamp(uv, 0.003, 0.997)) / grid);
}
void main() {
  vec4 a = tile(tileA, vUv);
  vec4 b = tile(tileB, vUv);
  vec4 c = mix(a, b, mixB);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * brightness, 1.0);
  #include <colorspace_fragment>
}`;

export type ImpostorObject = {
  mesh: any;
  meta: ImpostorMeta;
  /** Turn to face the eye (local ENU metres) and pick tiles; returns the camera azimuth used. */
  update(eyeLocal: ArrayLike<number>): number;
  dispose(): void;
};

/**
 * `texture` is the loaded atlas (THREE.Texture). The quad stands with its
 * figure's feet at local z = `baseZ` (the plinth top), centred on x = y = 0.
 */
export function createImpostorObject(THREE: any, meta: ImpostorMeta, texture: any, options: { facingDeg: number; baseZ: number; band?: number; brightness?: number }): ImpostorObject {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const w = meta.tileWidthM, h = meta.tileHeightM;
  // Quad in the x/z plane (facing −y before rotation), bottom edge below the feet.
  const geometry = new THREE.PlaneGeometry(w, h);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, h / 2 - meta.feetFromBottom * h);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      atlas: { value: texture },
      grid: { value: new THREE.Vector2(meta.cols, meta.rows) },
      tileA: { value: 0 }, tileB: { value: 0 }, mixB: { value: 0 },
      brightness: { value: options.brightness ?? 1 },
    },
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sculpture-impostor';
  mesh.position.set(0, 0, options.baseZ);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh, meta,
    update(eye) {
      // Face the eye: the quad's normal (−y) rotated to point at the eye horizontally.
      const yaw = Math.atan2(eye[1], eye[0]); // angle of the eye from +x
      mesh.rotation.z = yaw + Math.PI / 2; // −y → toward the eye
      const az = cameraAzimuthDeg(eye[0], eye[1], options.facingDeg);
      const pick = pickViews(meta.views, az, options.band);
      material.uniforms.tileA.value = pick.a;
      material.uniforms.tileB.value = pick.b;
      material.uniforms.mixB.value = pick.t;
      return az;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
