/**
 * The ground ring and the beacon of the highlight candidates (`?highlight=a|b|c`, look/highlight.ts): one object for
 * the page, whichever pipeline draws the building.
 *
 *  - ring: a soft band on the ground hugging each footprint (offset 0.4–4.4 m outward, alpha 0.85 → 0), or a circle
 *    when no footprint is known (a GLB landmark without building ids);
 *  - beacon (style a): a thin camera-facing column from just above the roof, ~3 px wide at any distance, fading
 *    upward and with distance (full to 150 m, 30 % beyond 900 m).
 *
 * Local space: metres east/north/up about the focus (the footprint centroid). In the shared frame it is a
 * participant (`mercatorFromLocal`); in the default frame it is its own MapLibre custom layer under the labels.
 * Style b also keeps the map redrawing while shown (the rim's pulse).
 */
import { HIGHLIGHT_RECIPES, footprintCentroid, highlightAccent, highlightStyle, mPerDegLng, type HighlightFocus, type HighlightStyle, type LngLat } from './highlight.ts';
import { hexToRgb } from './palette.ts';

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
const M_PER_DEG_LAT = 110_540;
export const RING_INNER_M = 0.4;
export const RING_WIDTH_M = 4;
export const RING_ALPHA = 0.85;
export const CIRCLE_RADIUS_M = 12;
export const BEACON_LIFT_M = 2;
export const BEACON_HEIGHT_M = 45;
export const BEACON_PX = 3;
export const BEACON_FADE_M: readonly [number, number] = [150, 900];
export const BEACON_FAR_ALPHA = 0.3;

/** Mercator [x, y] (0..1) of a point, as maplibregl.MercatorCoordinate.fromLngLat. */
export function mercatorOf(lng: number, lat: number): [number, number] {
  return [(180 + lng) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360];
}

/** Column-major local (east/north/up metres about `anchor`) → Mercator. */
export function mercatorFromLocal(anchor: LngLat, altitudeM = 0): number[] {
  const [x, y] = mercatorOf(anchor[0], anchor[1]), u = 1 / EARTH_CIRCUMFERENCE / Math.cos((anchor[1] * Math.PI) / 180);
  return [u, 0, 0, 0, 0, -u, 0, 0, 0, 0, u, 0, x, y, altitudeM * u, 1];
}

/** A lng/lat ring in metres about `anchor`. */
export const localRing = (ring: readonly LngLat[], anchor: LngLat): [number, number][] =>
  ring.map(([lng, lat]) => [(lng - anchor[0]) * mPerDegLng(anchor[1]), (lat - anchor[1]) * M_PER_DEG_LAT]);

/**
 * Band outside a closed ring: positions (x, y, 0) and alphas, two vertices per ring vertex (inner, outer), with
 * mitred offsets clamped at sharp corners. Rings of either winding go outward.
 */
export function ringBand(ring: readonly [number, number][], innerM = RING_INNER_M, widthM = RING_WIDTH_M): { positions: number[]; alphas: number[]; index: number[] } {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  const n = pts.length, positions: number[] = [], alphas: number[] = [], index: number[] = [];
  if (n < 3) return { positions, alphas, index };
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const out = area > 0 ? 1 : -1; // counter-clockwise: outward is the right-hand normal of each edge
  const normal = (a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [out * dy / l, -out * dx / l]; };
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n], cur = pts[i], next = pts[(i + 1) % n];
    const a = normal(prev, cur), b = normal(cur, next);
    let mx = a[0] + b[0], my = a[1] + b[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml; my /= ml;
    const miter = Math.min(2.5, 1 / Math.max(0.2, mx * b[0] + my * b[1]));
    positions.push(cur[0] + mx * innerM * miter, cur[1] + my * innerM * miter, 0, cur[0] + mx * (innerM + widthM) * miter, cur[1] + my * (innerM + widthM) * miter, 0);
    alphas.push(RING_ALPHA, 0);
    const j = (i + 1) % n;
    index.push(i * 2, i * 2 + 1, j * 2, j * 2, i * 2 + 1, j * 2 + 1);
  }
  return { positions, alphas, index };
}

/**
 * The ring's outlines: each footprint's outer ring (a complex such as the Rijksmuseum keeps its separate buildings;
 * bands between touching parts lie under the buildings and are hidden by them), or a circle without a footprint.
 */
export function ringOutlines(polygons: readonly (readonly (readonly LngLat[])[])[] | undefined, anchor: LngLat): [number, number][][] {
  const rings = (polygons ?? []).map(p => localRing(p[0] ?? [], anchor)).filter(r => r.length >= 3);
  return rings.length ? rings : [circleRing()];
}

/** A circle of `segments` points, radius `r` metres (the ring when no footprint is known). */
export const circleRing = (r = CIRCLE_RADIUS_M, segments = 40): [number, number][] =>
  Array.from({ length: segments }, (_, i) => [Math.cos((i / segments) * Math.PI * 2) * r, Math.sin((i / segments) * Math.PI * 2) * r]);

/** Beacon opacity at a camera distance (metres). */
export function beaconAlpha(distanceM: number): number {
  const [near, far] = BEACON_FADE_M, t = Math.min(1, Math.max(0, (distanceM - near) / (far - near)));
  return 1 - (1 - BEACON_FAR_ALPHA) * t * t * (3 - 2 * t);
}

const RING_VERTEX = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAGMENT = /* glsl */ `
uniform vec3 accent;
uniform float opacity;
varying float vAlpha;
void main() { gl_FragColor = vec4(accent, vAlpha * opacity); }`;
const BEACON_VERTEX = /* glsl */ `
attribute float aSide;
uniform vec2 viewport;
uniform float widthPx;
varying float vUp;
void main() {
  // Screen-space width: offset across the projected column, widthPx wide at any distance.
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c0 = mvp * vec4(position, 1.0), c1 = mvp * vec4(position + vec3(0.0, 0.0, 1.0), 1.0);
  vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * viewport;
  d = dot(d, d) > 1e-8 ? normalize(d) : vec2(0.0, 1.0);
  c0.xy += vec2(-d.y, d.x) * aSide * widthPx / viewport * c0.w;
  vUp = uv.y;
  gl_Position = c0;
}`;
const BEACON_FRAGMENT = /* glsl */ `
uniform vec3 accent;
uniform float opacity;
varying float vUp;
void main() { gl_FragColor = vec4(accent, opacity * (1.0 - vUp) * (1.0 - vUp) * smoothstep(0.0, 0.04, vUp)); }`;

export interface HighlightMarkerOptions {
  /** The shared frame (`?sharedFrame=1`); otherwise a custom layer is added to `map`. */
  sharedFrame?: any;
  style?: HighlightStyle;
  /** Ground height (own ground relief) at a point, metres. */
  heightAt?: (lngLat: LngLat) => number | undefined | null;
}

export class HighlightMarker {
  readonly root: any;
  readonly style: HighlightStyle;
  private readonly recipe;
  private ring: any = null;
  private beacon: any = null;
  private anchor: LngLat | null = null;
  private altitude = 0;
  private local: number[] | null = null;
  private unregister: (() => void) | null = null;
  private layerId: string | null = null;
  private renderer: any = null;
  private camera: any = null;
  private scene: any = null;
  private raf = 0;
  private readonly accent: any;
  /** Last frame's camera distance (m) to the beacon base, for tests. */
  lastDistanceM = NaN;

  constructor(private readonly THREE: any, private readonly map: any, private readonly options: HighlightMarkerOptions = {}) {
    this.style = options.style ?? highlightStyle();
    this.recipe = HIGHLIGHT_RECIPES[this.style];
    this.root = new THREE.Group();
    this.root.name = 'highlight-marker';
    const [r, g, b] = hexToRgb(highlightAccent(this.style));
    this.accent = new THREE.Vector3(r / 255, g / 255, b / 255);
    if (!this.recipe.ring && !this.recipe.beacon) return;
    if (options.sharedFrame) {
      this.unregister = options.sharedFrame.register('highlight-marker', {
        root: this.root,
        mercatorFromLocal: () => this.local,
        beforeRender: () => !!this.anchor && !!this.root.children.length,
      }, { order: 25 });
    } else this.addLayer();
  }

  /** Show the ring (and beacon) at a footprint, or hide with null. */
  set(focus: HighlightFocus | null | undefined): void {
    const THREE = this.THREE;
    for (const child of [...this.root.children]) { this.root.remove(child); child.geometry?.dispose(); child.material?.dispose(); }
    this.ring = this.beacon = null;
    this.anchor = null;
    cancelAnimationFrame(this.raf);
    if (!focus || (!this.recipe.ring && !this.recipe.beacon)) { this.map.triggerRepaint?.(); return; }
    const anchor = footprintCentroid(focus.polygons) ?? focus.lngLat;
    this.anchor = anchor;
    this.altitude = Number(this.options.heightAt?.(anchor)) || 0;
    this.local = mercatorFromLocal(anchor, this.altitude);
    if (this.recipe.ring) {
      const positions: number[] = [], alphas: number[] = [], index: number[] = [];
      for (const ring of ringOutlines(focus.polygons, anchor)) {
        const band = ringBand(ring), base = positions.length / 3;
        positions.push(...band.positions); alphas.push(...band.alphas); index.push(...band.index.map(i => i + base));
      }
      for (let i = 2; i < positions.length; i += 3) positions[i] = 0.3;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
      g.setIndex(index);
      g.computeBoundingSphere();
      const m = new THREE.ShaderMaterial({ uniforms: { accent: { value: this.accent }, opacity: { value: 1 } }, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
        transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.ring = new THREE.Mesh(g, m);
      this.ring.name = 'highlight-marker/ring';
      this.ring.renderOrder = 5;
      this.root.add(this.ring);
    }
    if (this.recipe.beacon) {
      const base = (focus.heightM ?? 20) + BEACON_LIFT_M, top = base + BEACON_HEIGHT_M;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, base, 0, 0, base, 0, 0, top, 0, 0, top], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1));
      g.setIndex([0, 1, 2, 2, 1, 3]);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, (base + top) / 2), BEACON_HEIGHT_M);
      const m = new THREE.ShaderMaterial({ uniforms: { accent: { value: this.accent }, opacity: { value: 1 }, viewport: { value: new THREE.Vector2(1, 1) }, widthPx: { value: BEACON_PX } },
        vertexShader: BEACON_VERTEX, fragmentShader: BEACON_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m), inv = new THREE.Matrix4(), eye = new THREE.Vector4(), size = new THREE.Vector2();
      mesh.name = 'highlight-marker/beacon';
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      mesh.onBeforeRender = (renderer: any, _scene: any, camera: any) => {
        renderer.getDrawingBufferSize(size);
        inv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld).invert();
        eye.set(0, 0, 1, 0).applyMatrix4(inv);
        const d = Math.abs(eye.w) > 1e-12 ? Math.hypot(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w - base) : 500;
        this.lastDistanceM = d;
        m.uniforms.viewport.value.copy(size);
        m.uniforms.widthPx.value = BEACON_PX * (size.x / (renderer.domElement?.clientWidth || size.x));
        m.uniforms.opacity.value = beaconAlpha(d);
        m.uniformsNeedUpdate = true;
      };
      this.beacon = mesh;
      this.root.add(mesh);
    }
    if (this.recipe.animated) {
      const tick = () => { this.map.triggerRepaint?.(); this.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    }
    this.map.triggerRepaint?.();
  }

  /** What is shown, for tests and the readout. */
  status(): { style: HighlightStyle; anchor: LngLat | null; ring: boolean; beacon: boolean; distanceM: number } {
    return { style: this.style, anchor: this.anchor, ring: !!this.ring, beacon: !!this.beacon, distanceM: this.lastDistanceM };
  }

  private addLayer(): void {
    const owner = this, THREE = this.THREE;
    const id = this.layerId = 'highlight-marker';
    const layer = {
      id, type: 'custom', renderingMode: '3d',
      onAdd(map: any, gl: any) {
        owner.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        owner.renderer.autoClear = false;
        owner.camera = new THREE.Camera();
        owner.scene = new THREE.Scene();
        owner.scene.add(owner.root);
      },
      render(_gl: any, args: any) {
        if (!owner.anchor || !owner.local || !owner.root.children.length) return;
        const main = args?.defaultProjectionData?.mainMatrix ?? args;
        owner.camera.projectionMatrix.fromArray(main).multiply(new THREE.Matrix4().fromArray(owner.local));
        owner.renderer.resetState();
        owner.renderer.render(owner.scene, owner.camera);
      },
    };
    const add = () => {
      if (this.map.getLayer?.(id)) return;
      const symbol = this.map.getStyle?.()?.layers?.find((l: any) => l.type === 'symbol')?.id;
      this.map.addLayer(layer, symbol);
    };
    if (this.map.isStyleLoaded?.() === false) this.map.once?.('idle', add); else add();
  }

  dispose(): void {
    this.set(null);
    this.unregister?.();
    if (this.layerId && this.map.getLayer?.(this.layerId)) this.map.removeLayer(this.layerId);
  }
}
