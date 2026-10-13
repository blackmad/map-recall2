// A three.js Gaussian-splat object for the shared frame, THREE injected.
//
// Splat data lives in float/byte data textures; one instanced quad per splat
// reads its splat through a per-instance index that the CPU sorter rewrites
// back-to-front. The 2D footprint comes from projecting the 3D covariance
// with the Jacobian of the *whole* clip ← local transform, so it works with
// the shared frame's identity view matrix and MapLibre's projection without
// knowing a focal length. Blending is premultiplied over; depth is tested
// (buildings hide the statue) but not written.

import { covariances, type SplatCloud } from './splatFormat.js';
import { SplatSorter } from './splatSort.js';

const VERT = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D centers;
uniform sampler2D covA;
uniform sampler2D covB;
uniform sampler2D colors;
uniform int texWidth;
uniform vec2 viewport;
uniform float opacityScale;
in float splatIndex;
out vec4 vColor;
out vec2 vPos;
void main() {
  int i = int(splatIndex + 0.5);
  ivec2 uv = ivec2(i % texWidth, i / texWidth);
  vec3 c = texelFetch(centers, uv, 0).xyz;
  mat4 M = projectionMatrix * modelViewMatrix;
  vec4 clip = M * vec4(c, 1.0);
  if (clip.w <= 0.01) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float iw = 1.0 / clip.w;
  vec3 rx = vec3(M[0][0], M[1][0], M[2][0]);
  vec3 ry = vec3(M[0][1], M[1][1], M[2][1]);
  vec3 rw = vec3(M[0][3], M[1][3], M[2][3]);
  // d(ndc)/d(local), then to pixels.
  vec3 jx = (rx - clip.x * iw * rw) * iw * 0.5 * viewport.x;
  vec3 jy = (ry - clip.y * iw * rw) * iw * 0.5 * viewport.y;
  vec4 a = texelFetch(covA, uv, 0);
  vec2 b = texelFetch(covB, uv, 0).xy;
  mat3 S = mat3(a.x, a.y, a.z, a.y, a.w, b.x, a.z, b.x, b.y);
  vec3 sjx = S * jx, sjy = S * jy;
  // +0.3 px²: the usual low-pass so sub-pixel splats do not alias.
  float sxx = dot(jx, sjx) + 0.3, sxy = dot(jx, sjy), syy = dot(jy, sjy) + 0.3;
  float mid = 0.5 * (sxx + syy);
  float rad = length(vec2(0.5 * (sxx - syy), sxy));
  float l1 = mid + rad, l2 = max(mid - rad, 0.1);
  vec2 v1 = abs(sxy) < 1e-7 ? (sxx >= syy ? vec2(1.0, 0.0) : vec2(0.0, 1.0)) : normalize(vec2(sxy, l1 - sxx));
  vec2 v2 = vec2(-v1.y, v1.x);
  vec2 ax1 = min(sqrt(2.0 * l1), 512.0) * v1;
  vec2 ax2 = min(sqrt(2.0 * l2), 512.0) * v2;
  vPos = position.xy;
  vec2 offset = (position.x * ax1 + position.y * ax2) / (0.5 * viewport);
  gl_Position = vec4(clip.xy * iw + offset, clip.z * iw, 1.0);
  vColor = texelFetch(colors, uv, 0);
  vColor.a *= opacityScale;
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec4 vColor;
in vec2 vPos;
out vec4 fragColor;
void main() {
  float A = -dot(vPos, vPos);
  if (A < -4.0) discard;
  float B = exp(A) * vColor.a;
  if (B < 1.0 / 255.0) discard;
  fragColor = vec4(vColor.rgb * B, B);
}`;

export type SplatObject = {
  /** The THREE.Mesh to add to a scene. */
  mesh: any;
  sorter: SplatSorter;
  count: number;
  /** Re-sort for this clip ← local matrix if the view changed enough; returns whether it sorted. */
  update(clipFromLocal: ArrayLike<number>, viewport: [number, number]): boolean;
  dispose(): void;
};

function dataTexture(THREE: any, data: Float32Array | Uint8Array, width: number, height: number, float: boolean): any {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, float ? THREE.FloatType : THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createSplatObject(THREE: any, cloud: SplatCloud): SplatObject {
  const n = cloud.count;
  const width = Math.min(4096, Math.max(1, Math.ceil(Math.sqrt(n))));
  const height = Math.max(1, Math.ceil(n / width));
  const texels = width * height;
  const centers = new Float32Array(texels * 4), covA = new Float32Array(texels * 4), covB = new Float32Array(texels * 4);
  const colors = new Uint8Array(texels * 4);
  const cov = covariances(cloud);
  for (let i = 0; i < n; i++) {
    centers.set(cloud.positions.subarray(i * 3, i * 3 + 3), i * 4);
    covA[i * 4] = cov[i * 6]; covA[i * 4 + 1] = cov[i * 6 + 1]; covA[i * 4 + 2] = cov[i * 6 + 2]; covA[i * 4 + 3] = cov[i * 6 + 3];
    covB[i * 4] = cov[i * 6 + 4]; covB[i * 4 + 1] = cov[i * 6 + 5];
  }
  colors.set(cloud.colors.subarray(0, n * 4));
  const textures = [
    dataTexture(THREE, centers, width, height, true),
    dataTexture(THREE, covA, width, height, true),
    dataTexture(THREE, covB, width, height, true),
    dataTexture(THREE, colors, width, height, false),
  ];
  textures[3].colorSpace = THREE.NoColorSpace;

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const indexArray = new Float32Array(n);
  for (let i = 0; i < n; i++) indexArray[i] = i;
  const indexAttr = new THREE.InstancedBufferAttribute(indexArray, 1);
  indexAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('splatIndex', indexAttr);
  geometry.instanceCount = n;
  // Bounds for three's frustum culling: the splat centres plus a margin for their extent.
  let r = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += cloud.positions[i * 3]; cy += cloud.positions[i * 3 + 1]; cz += cloud.positions[i * 3 + 2]; }
  if (n) { cx /= n; cy /= n; cz /= n; }
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(cloud.positions[i * 3] - cx, cloud.positions[i * 3 + 1] - cy, cloud.positions[i * 3 + 2] - cz));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r + 0.5);

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      centers: { value: textures[0] }, covA: { value: textures[1] }, covB: { value: textures[2] }, colors: { value: textures[3] },
      texWidth: { value: width }, viewport: { value: new THREE.Vector2(1, 1) }, opacityScale: { value: 1 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sculpture-splat';
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const sorter = new SplatSorter(cloud.positions, n);
  const inv = new Float64Array(16);
  return {
    mesh, sorter, count: n,
    update(clipFromLocal, viewport) {
      material.uniforms.viewport.value.set(viewport[0], viewport[1]);
      // Re-sort only when the eye (local space, recovered from the clip
      // matrix) moved or the view direction (the w row: depth gradient) turned.
      const m = clipFromLocal;
      const dir = [m[3], m[7], m[11]];
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      dir[0] /= len; dir[1] /= len; dir[2] /= len;
      eyeOf(m, inv);
      if (!sorter.needsSort([inv[0], inv[1], inv[2]], dir)) return false;
      const order = sorter.sort(clipFromLocal);
      for (let i = 0; i < n; i++) indexArray[i] = order[i];
      indexAttr.needsUpdate = true;
      return true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

/** Eye (camera centre) of a column-major perspective clip matrix, into out[0..2]. */
export function eyeOf(m: ArrayLike<number>, out: Float64Array | number[]): void {
  // Solve rows x, y, w = 0 for the point that projects to clip (0,0,*,0):
  // the camera centre is the null vector of the 3×4 matrix [row0; row1; row3].
  const r0 = [m[0], m[4], m[8], m[12]], r1 = [m[1], m[5], m[9], m[13]], r3 = [m[3], m[7], m[11], m[15]];
  const det3 = (a: number[], b: number[], c: number[]) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const col = (k: number) => [r0[k], r1[k], r3[k]];
  const c0 = col(0), c1 = col(1), c2 = col(2), c3 = col(3);
  const x = det3(c1, c2, c3), y = -det3(c0, c2, c3), z = det3(c0, c1, c3), w = -det3(c0, c1, c2);
  out[0] = x / w; out[1] = y / w; out[2] = z / w;
}
