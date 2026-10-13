/**
 * The ground ring and the beacon of the highlight candidates (`?highlight=a|b|c`, look/highlight.ts): one object for
 * the page, whichever pipeline draws the building.
 *
 *  - ring: a soft band on the ground hugging each footprint (offset 0.4–4.4 m outward, alpha 0.85 → 0), or a circle
 *    when no footprint is known (a GLB landmark without building ids); footprints missing from the focus are read from
 *    the fallback extrusions' source (`HULL_SOURCE`);
 *  - beacon (style a): a thin camera-facing column from just above the roof, ~3 px wide at any distance, fading
 *    upward and with distance (full to 150 m, 30 % beyond 900 m);
 *  - small targets (style a): each frame the footprint's on-screen share (`footprintShare`) sets the page's boost
 *    (`smallTargetBoost`, `HIGHLIGHT_BOOST_GLOBAL`): the roof-wash passes read it, and the beacon rises by
 *    `BEACON_RAISE` × weight × (1 + shortfall) / 2 of its height;
 *  - hull (style a, `focus.hull`): when no pipeline outlines the building (MapLibre's fallback extrusions), the
 *    outline pass round an invisible prism of the footprint, so the fallback reads like every other pipeline.
 *
 * Local space: metres east/north/up about the focus (the footprint centroid). In the shared frame it is a
 * participant (`mercatorFromLocal`); in the default frame it is its own MapLibre custom layer under the labels.
 * Style b also keeps the map redrawing while shown (the rim's pulse).
 */
import {
  HIGHLIGHT_BOOST_GLOBAL, HIGHLIGHT_RECIPES, HULL_SOURCE, footprintShare, smallTargetBoost, attachHighlightPasses, detachHighlightPasses, footprintCentroid, highlightAccent, highlightStyle, mPerDegLng,
  type HighlightFocus, type HighlightStyle, type LngLat,
} from './highlight.ts';
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
/** At full small-target boost and full shortfall the beacon is (1 + BEACON_RAISE) × its height. */
export const BEACON_RAISE = 2;
/** Beacon width at full small-target boost (CSS px). */
export const BEACON_BOOST_PX = 4;

/** Beacon height factor for a small-target boost (1 with none). */
export const beaconRaise = (boost: { weight: number; shortfall: number }) => 1 + BEACON_RAISE * boost.weight * (1 + boost.shortfall) / 2;

/** Area (m²) of local rings (shoelace; either winding), outer rings only. */
export function ringsArea(rings: readonly (readonly [number, number][])[]): number {
  let total = 0;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0; i < ring.length; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]; a += x0 * y1 - x1 * y0; }
    total += Math.abs(a) / 2;
  }
  return total;
}

/**
 * On-screen radius (CSS px) of a footprint's equivalent circle of `radiusM` at `centre` (local metres), given the
 * local → clip matrix (column-major) and the CSS viewport: the largest screen offset of the four points `radiusM`
 * east/west/north/south of the centre (the one across the view is not foreshortened). 0 behind the camera.
 */
export function footprintRadiusPx(mvp: ArrayLike<number>, centre: readonly [number, number, number], radiusM: number, cssWidth: number, cssHeight: number): number {
  const screen = (x: number, y: number, z: number): [number, number] | null => {
    const m = mvp, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return w > 1e-9 ? [(cx / w) * cssWidth / 2, (cy / w) * cssHeight / 2] : null;
  };
  const c = screen(centre[0], centre[1], centre[2]);
  if (!c || !(radiusM > 0)) return 0;
  let best = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const p = screen(centre[0] + dx * radiusM, centre[1] + dy * radiusM, centre[2]);
    if (p) best = Math.max(best, Math.hypot(p[0] - c[0], p[1] - c[1]));
  }
  return best;
}

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

/**
 * Where the default-frame marker layer belongs: right after the last 3D layer (custom or fill-extrusion), so every
 * building is drawn (and has written depth) before the ring and beacon. Returns the index of the layer to insert
 * before, `layers.length` (the top), or -1 (no 3D layer yet: leave it).
 */
export function markerSlot(layers: readonly { id: string; type?: string }[], ownId: string): number {
  let last = -1;
  layers.forEach((l, i) => { if (l.id !== ownId && (l.type === 'custom' || l.type === 'fill-extrusion')) last = i; });
  if (last < 0) return -1;
  for (let i = last + 1; i < layers.length; i++) if (layers[i].id !== ownId) return i;
  return layers.length;
}

/**
 * A closed prism (walls, roof and floor) over local rings, as flat triangles: positions (x, y, z) in metres. The
 * outline pass draws its back faces, so only the silhouette matters; caps are fan/ear triangulated by `triangulate`.
 */
export function prismPositions(rings: readonly (readonly [number, number][])[], baseM: number, topM: number,
  triangulate: (ring: [number, number][]) => number[][]): number[] {
  const out: number[] = [];
  for (const raw of rings) {
    const ring = raw.length > 1 && raw[0][0] === raw[raw.length - 1][0] && raw[0][1] === raw[raw.length - 1][1] ? raw.slice(0, -1) : raw.slice();
    if (ring.length < 3) continue;
    // Counter-clockwise, so every face points outward (the pass draws back faces: a wrong winding paints the walls).
    let area = 0;
    for (let i = 0; i < ring.length; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]; area += x0 * y1 - x1 * y0; }
    if (area < 0) ring.reverse();
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
      out.push(ax, ay, baseM, bx, by, baseM, bx, by, topM, ax, ay, baseM, bx, by, topM, ax, ay, topM);
    }
    for (let [a, b, c] of triangulate(ring as [number, number][])) {
      const [ax, ay] = ring[a], [bx, by] = ring[b], [cx, cy] = ring[c];
      if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) [b, c] = [c, b];
      out.push(ring[a][0], ring[a][1], topM, ring[b][0], ring[b][1], topM, ring[c][0], ring[c][1], topM);
      out.push(ring[a][0], ring[a][1], baseM, ring[c][0], ring[c][1], baseM, ring[b][0], ring[b][1], baseM);
    }
  }
  return out;
}

/** Footprints and height of buildings in a GeoJSON source (MapLibre `querySourceFeatures`), by feature id. */
export function footprintFromFeatures(features: readonly any[], ids: readonly string[]): { polygons: LngLat[][][]; heightM: number; baseM: number } | null {
  const want = new Set(ids.map(String)), polygons: LngLat[][][] = [];
  let heightM = 0, baseM = Infinity;
  for (const f of features) {
    if (!want.has(String(f?.id ?? f?.properties?.id))) continue;
    const g = f.geometry;
    if (g?.type === 'Polygon') polygons.push(g.coordinates);
    else if (g?.type === 'MultiPolygon') polygons.push(...g.coordinates);
    else continue;
    heightM = Math.max(heightM, Number(f.properties?.height) || 0);
    baseM = Math.min(baseM, Number(f.properties?.minHeight) || 0);
  }
  return polygons.length ? { polygons, heightM: heightM || 10, baseM: Number.isFinite(baseM) ? baseM : 0 } : null;
}

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
uniform float baseM;
uniform float raise;
varying float vUp;
void main() {
  // Screen-space width: offset across the projected column, widthPx wide at any distance. Raised (small targets) by
  // stretching the column above its base.
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec3 q = vec3(position.xy, baseM + (position.z - baseM) * raise);
  vec4 c0 = mvp * vec4(q, 1.0), c1 = mvp * vec4(q + vec3(0.0, 0.0, 1.0), 1.0);
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
  private hull: any = null;
  private focus: HighlightFocus | null = null;
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
  /** Equivalent-circle radius (m) of the focus footprint (0: none known, no small-target boost). */
  private radiusM = 0;
  /** Last frame's small-target boost (footprint share of the frame, weight, shortfall). */
  lastBoost = { share: 0, weight: 0, shortfall: 0 };

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
    if (this.hull) detachHighlightPasses(this.hull);
    for (const child of [...this.root.children]) { this.root.remove(child); child.geometry?.dispose(); child.material?.dispose(); }
    this.ring = this.beacon = this.hull = null;
    this.anchor = null;
    this.radiusM = 0;
    this.publishBoost({ share: 0, weight: 0, shortfall: 0 });
    cancelAnimationFrame(this.raf);
    if (!focus || (!this.recipe.ring && !this.recipe.beacon)) { this.focus = null; this.map.triggerRepaint?.(); return; }
    const asked = focus;
    this.focus = asked;
    if (!focus.polygons?.length && focus.ids?.length) {
      // No pipeline knew the footprint (MapLibre's fallback extrusions, a landmark model there): read it from the
      // building source's data, for the ring and the hull (querySourceFeatures and queryRenderedFeatures missed the
      // Oud-West house on screen; GeoJSONSource.getData() serves the promoted-id map, < 1 ms for 10k features).
      // Shown with a circle meanwhile; the answer re-enters set() with the footprint.
      const source = this.map.getSource?.(HULL_SOURCE);
      source?.getData?.().then((data: any) => {
        const found = this.focus === asked ? footprintFromFeatures(data?.features ?? [], asked.ids ?? []) : null;
        if (found) this.set({ ...asked, polygons: found.polygons, heightM: asked.heightM ?? found.heightM, baseM: found.baseM });
      }, () => { /* no source */ });
    }
    const baseM = focus.baseM ?? 0;
    const anchor = footprintCentroid(focus.polygons) ?? focus.lngLat;
    this.anchor = anchor;
    this.altitude = Number(this.options.heightAt?.(anchor)) || 0;
    this.local = mercatorFromLocal(anchor, this.altitude);
    // Only a real footprint gets the small-target boost (the 12 m circle stands for "unknown").
    if (focus.polygons?.length) this.radiusM = Math.sqrt(ringsArea(focus.polygons.map(p => localRing(p[0] ?? [], anchor))) / Math.PI);
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
    if (focus.hull && this.recipe.outline && focus.polygons?.length) {
      const rings = focus.polygons.map(p => localRing(p[0] ?? [], anchor));
      const positions = prismPositions(rings, baseM, focus.heightM ?? 10, ring => THREE.ShapeUtils.triangulateShape(ring.map(([x, y]) => new THREE.Vector2(x, y)), []));
      if (positions.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.computeVertexNormals();
        g.computeBoundingBox();
        // The prism itself is never drawn (MapLibre draws the building); only its outline pass, a child of it.
        const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
        m.visible = false;
        this.hull = new THREE.Mesh(g, m);
        this.hull.name = 'highlight-marker/hull';
        this.hull.frustumCulled = false;
        this.root.add(this.hull);
        attachHighlightPasses(THREE, this.hull, { style: this.style });
      }
    }
    if (this.recipe.beacon) {
      const base = (focus.heightM ?? 20) + BEACON_LIFT_M, top = base + BEACON_HEIGHT_M;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, base, 0, 0, base, 0, 0, top, 0, 0, top], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1));
      g.setIndex([0, 1, 2, 2, 1, 3]);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, (base + top) / 2), BEACON_HEIGHT_M);
      const m = new THREE.ShaderMaterial({ uniforms: { accent: { value: this.accent }, opacity: { value: 1 }, viewport: { value: new THREE.Vector2(1, 1) }, widthPx: { value: BEACON_PX },
        baseM: { value: base }, raise: { value: 1 } },
        vertexShader: BEACON_VERTEX, fragmentShader: BEACON_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m), inv = new THREE.Matrix4(), eye = new THREE.Vector4(), size = new THREE.Vector2();
      const roofM = focus.heightM ?? 20;
      mesh.name = 'highlight-marker/beacon';
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      mesh.onBeforeRender = (renderer: any, _scene: any, camera: any) => {
        renderer.getDrawingBufferSize(size);
        inv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
        const dpr = size.x / (renderer.domElement?.clientWidth || size.x);
        const boost = this.radiusM > 0 ? smallTargetBoost(footprintShare(footprintRadiusPx(inv.elements, [0, 0, roofM], this.radiusM, size.x / dpr, size.y / dpr), size.x / dpr, size.y / dpr)) : smallTargetBoost(0);
        this.publishBoost(boost);
        m.uniforms.raise.value = beaconRaise(boost);
        inv.invert();
        eye.set(0, 0, 1, 0).applyMatrix4(inv);
        const d = Math.abs(eye.w) > 1e-12 ? Math.hypot(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w - base) : 500;
        this.lastDistanceM = d;
        m.uniforms.viewport.value.copy(size);
        m.uniforms.widthPx.value = (BEACON_PX + (BEACON_BOOST_PX - BEACON_PX) * boost.weight) * dpr;
        m.uniforms.opacity.value = beaconAlpha(d);
        m.uniformsNeedUpdate = true;
      };
      this.beacon = mesh;
      this.root.add(mesh);
    }
    this.raise();
    if (this.recipe.animated) {
      const tick = () => { this.map.triggerRepaint?.(); this.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    }
    this.map.triggerRepaint?.();
  }

  /** What is shown, for tests and the readout. */
  status(): { style: HighlightStyle; anchor: LngLat | null; ring: boolean; beacon: boolean; hull: boolean; distanceM: number;
    boost: { share: number; weight: number; shortfall: number; radiusM: number } } {
    const b = this.lastBoost, r = (v: number, d = 4) => +v.toFixed(d);
    return { style: this.style, anchor: this.anchor, ring: !!this.ring, beacon: !!this.beacon, hull: !!this.hull, distanceM: this.lastDistanceM,
      boost: { share: r(b.share, 5), weight: r(b.weight, 3), shortfall: r(b.shortfall, 3), radiusM: r(this.radiusM, 2) } };
  }

  /**
   * The page's small-target boost for the roof-wash passes (`HIGHLIGHT_BOOST_GLOBAL`). The passes of a pipeline drawn
   * before the marker read last frame's value, so a change asks for one more frame.
   */
  private publishBoost(boost: { share: number; weight: number; shortfall: number }): void {
    const changed = Math.abs(boost.weight - this.lastBoost.weight) > 0.01;
    this.lastBoost = boost;
    if (!this.recipe.wash) return;
    (globalThis as any)[HIGHLIGHT_BOOST_GLOBAL] = boost.weight;
    if (changed) this.map.triggerRepaint?.();
  }

  /**
   * Default frame: draw after every building layer (just under the labels). The ring and beacon do not write depth,
   * so a building layer added after the marker (the three.js city streams in later) painted over them wherever a
   * building stood behind: at the Oud-West terrace (chase, 213 m) only 830 px of ring and a stub of beacon survived.
   */
  private raise(): void {
    const id = this.layerId;
    if (!id || !this.map.getLayer?.(id) || !this.map.moveLayer || !this.map.getLayersOrder) return;
    const order: string[] = this.map.getLayersOrder();
    const slot = markerSlot(order.map(l => ({ id: l, type: this.map.getLayer(l)?.type })), id);
    try { if (slot >= 0 && order[slot - 1] !== id) this.map.moveLayer(id, order[slot]); } catch { /* style mid-reload: the next set() retries */ }
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
