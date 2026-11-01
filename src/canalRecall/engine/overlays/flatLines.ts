// Flat map lines under `?engine=own` (engine programme P1 step 4): cycle
// tracks, transit corridors, neighbourhood boundaries — the MapLibre line
// layers vector-map.js styles, as one shared-frame participant per overlay.
// ownMap/layers.ts line meshes (pixel widths by zoom, screen-door opacity),
// drawn just above the own ground (z a little over 0, depth-tested, so the
// buildings and the relief still hide them). The route and the question
// street are not here: the own ground drapes those (routeRibbon).

import * as THREE from 'three';
import { lineGeometry, lineMaterial } from '../../ownMap/layers';
import { interpolateStops, type Stops } from '../../ownMap/style';
import { toLocal, ORIGIN, type Vec2 } from '../../ownMap/frame';
import { metresPerPixel } from '../../ownMap/mapCamera';
import { mercatorFromOwnLocal, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES } from '../overviewLayer';
import { cutMesh, growTileSpheres } from '../../rendererShared/tiledGeometry';
import type { FrameParticipant } from '../../rendererShared/sharedFrame';

export type LngLatLine = readonly (readonly [number, number])[];
export interface LineStyleSpec { color: string; width: Stops; casing?: { color: string; extraPx: number }; minZoom?: number; opacity?: number; z?: number }

/** Lines as one geometry per colour; `set` replaces them. */
export class FlatLines implements FrameParticipant {
  readonly root = new THREE.Group();
  visible = true;
  private meshes: { fill: THREE.Mesh; casing: THREE.Mesh | null; style: LineStyleSpec; spans: boolean }[] = [];
  private centreLat: number = ORIGIN.lat;
  /** The last `set`, to build the geometry again after a context loss (its CPU arrays are freed once uploaded, #130). */
  private groups: readonly { lines: readonly LngLatLine[]; style: LineStyleSpec }[] = [];

  constructor(readonly id: string, private readonly view: { center(): { lng: number; lat: number }; zoom(): number }) { this.root.name = `engine-${id}`; }

  /** Replace the lines: groups of lng/lat polylines, each with its style. */
  set(groups: readonly { lines: readonly LngLatLine[]; style: LineStyleSpec }[]): void {
    for (const m of this.meshes) { this.root.remove(m.fill); m.fill.geometry.dispose(); (m.fill.material as THREE.Material).dispose(); if (m.casing) { this.root.remove(m.casing); (m.casing.material as THREE.Material).dispose(); } }
    this.meshes = [];
    this.groups = groups;
    for (const { lines, style } of groups) {
      const local: Vec2[][] = lines.filter(l => l.length > 1).map(l => l.map(([lng, lat]) => toLocal(lng, lat)));
      if (!local.length) continue;
      const geo = lineGeometry(local);
      for (const a of [...Object.values(geo.attributes), geo.index]) (a as THREE.BufferAttribute | null)?.onUpload(releaseArray);
      const z = style.z ?? 0.15;
      const fill = new THREE.Mesh(geo, lineMaterial(style.color, z)); fill.frustumCulled = false; fill.renderOrder = 51;
      let casing: THREE.Mesh | null = null;
      if (style.casing) { casing = new THREE.Mesh(geo, lineMaterial(style.casing.color, z)); casing.frustumCulled = false; casing.renderOrder = 50; this.root.add(casing); }
      for (const m of [fill, casing]) if (m) { (m.material as THREE.ShaderMaterial).depthTest = true; (m.material as THREE.ShaderMaterial).uniforms.uNear = { value: 0 }; }
      this.root.add(fill);
      this.meshes.push({ fill, casing, style, spans: this.cut(fill, casing) });
    }
  }

  /**
   * Draw the lines over only the span of their index on screen (tiledGeometry.ts drawAsSpans, as the overview): the
   * cycle tracks cover the whole region (~108 k triangles) and were drawn whole every frame, though a chase view sees
   * a few hundred metres of them (#129). One draw call, as before; one colour per mesh with no depth write, so the
   * reordered index changes no pixel. The casing shares the fill's geometry and its spans. `?lineCull=0` (or
   * `__canalRecallLineCull = false`) keeps the whole index.
   */
  private cut(fill: THREE.Mesh, casing: THREE.Mesh | null): boolean {
    if (!lineCullFlag() || !cutMesh(THREE, fill, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES, { draw: 'spans' })) return false;
    if (casing) {
      const cull = fill.onBeforeRender, geo = fill.geometry;
      casing.onBeforeRender = (...a) => cull.apply(fill, a);
      casing.onAfterRender = () => { geo.drawRange.start = 0; geo.drawRange.count = Infinity; };
    }
    return true;
  }

  /** A new renderer after a context loss: the freed CPU copies are built again from the last `set`. */
  onContextRestored(): void { if (this.groups.length) this.set(this.groups); }

  get lineCount(): number { return this.meshes.length; }
  mercatorFromLocal(): number[] { return mercatorFromOwnLocal(this.centreLat); }

  beforeRender(): boolean {
    if (!this.visible || !this.meshes.length) return false;
    const c = this.view.center(), zoom = this.view.zoom();
    this.centreLat = c.lat;
    const mpp = metresPerPixel(zoom, c.lat);
    let any = false;
    for (const m of this.meshes) {
      const on = zoom >= (m.style.minZoom ?? 0);
      m.fill.visible = on; if (m.casing) m.casing.visible = on;
      if (!on) continue;
      any = true;
      const px = interpolateStops(m.style.width, zoom);
      const u = (m.fill.material as THREE.ShaderMaterial).uniforms;
      u.uHalf.value = px / 2 * mpp; u.uOpacity.value = m.style.opacity ?? 1;
      const casingHalf = m.casing ? (px + m.style.casing!.extraPx) / 2 * mpp : 0;
      if (m.casing) (m.casing.material as THREE.ShaderMaterial).uniforms.uHalf.value = casingHalf;
      // The spans' spheres hold the stored centrelines at z = 0: grow them by the corner extrusion and the draw height.
      if (m.spans) growTileSpheres(m.fill, Math.max(u.uHalf.value as number, casingHalf) * Math.SQRT2 + Math.abs(m.style.z ?? 0.15) + 1);
    }
    return any;
  }
}

/** Span culling for the flat lines: on unless `?lineCull=0` / `__canalRecallLineCull = false`. */
export function lineCullFlag(): boolean {
  const g = globalThis as { __canalRecallLineCull?: boolean; location?: { search?: string } };
  if (g.__canalRecallLineCull === false) return false;
  return new URLSearchParams(g.location?.search ?? '').get('lineCull') !== '0';
}

/** three's `onUpload` callback (`this` is the attribute): drop the CPU copy. */
function releaseArray(this: { array: unknown }): void { this.array = null; }
