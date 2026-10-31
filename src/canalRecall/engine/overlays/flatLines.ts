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
import { mercatorFromOwnLocal } from '../overviewLayer';
import type { FrameParticipant } from '../../rendererShared/sharedFrame';

export type LngLatLine = readonly (readonly [number, number])[];
export interface LineStyleSpec { color: string; width: Stops; casing?: { color: string; extraPx: number }; minZoom?: number; opacity?: number; z?: number }

/** Lines as one geometry per colour; `set` replaces them. */
export class FlatLines implements FrameParticipant {
  readonly root = new THREE.Group();
  visible = true;
  private meshes: { fill: THREE.Mesh; casing: THREE.Mesh | null; style: LineStyleSpec }[] = [];
  private centreLat: number = ORIGIN.lat;

  constructor(readonly id: string, private readonly view: { center(): { lng: number; lat: number }; zoom(): number }) { this.root.name = `engine-${id}`; }

  /** Replace the lines: groups of lng/lat polylines, each with its style. */
  set(groups: readonly { lines: readonly LngLatLine[]; style: LineStyleSpec }[]): void {
    for (const m of this.meshes) { this.root.remove(m.fill); m.fill.geometry.dispose(); (m.fill.material as THREE.Material).dispose(); if (m.casing) { this.root.remove(m.casing); (m.casing.material as THREE.Material).dispose(); } }
    this.meshes = [];
    for (const { lines, style } of groups) {
      const local: Vec2[][] = lines.filter(l => l.length > 1).map(l => l.map(([lng, lat]) => toLocal(lng, lat)));
      if (!local.length) continue;
      const geo = lineGeometry(local);
      const z = style.z ?? 0.15;
      const fill = new THREE.Mesh(geo, lineMaterial(style.color, z)); fill.frustumCulled = false; fill.renderOrder = 51;
      let casing: THREE.Mesh | null = null;
      if (style.casing) { casing = new THREE.Mesh(geo, lineMaterial(style.casing.color, z)); casing.frustumCulled = false; casing.renderOrder = 50; this.root.add(casing); }
      for (const m of [fill, casing]) if (m) { (m.material as THREE.ShaderMaterial).depthTest = true; (m.material as THREE.ShaderMaterial).uniforms.uNear = { value: 0 }; }
      this.root.add(fill);
      this.meshes.push({ fill, casing, style });
    }
  }

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
      if (m.casing) (m.casing.material as THREE.ShaderMaterial).uniforms.uHalf.value = (px + m.style.casing!.extraPx) / 2 * mpp;
    }
    return any;
  }
}
