// The own map's overview (ownMap/layers.ts meshes over own-map-v1/overview.json.gz:
// land, water, parks, streets by class) as a shared-frame participant: the far
// field and the start flight's city view under `?engine=own`, where there is no
// basemap. Flat, depth-write off, drawn first, so the own ground and the
// buildings draw over it; it also feeds `isWater` (engine/waterIndex.ts).
//
// Geometry is in the own map's local frame (ownMap/frame.ts). Mercator x is
// linear in it; Mercator y is linearised at the view centre every frame
// (≤ ~2.5 m at 5 km from the centre, beyond the own ground's ring).

import * as THREE from 'three';
import { decodeOverview, STREET_CLASSES, type OverviewData, type OverviewFile, type StreetClass } from '../ownMap/overviewFormat';
import { fillMaterial, lineGeometry, lineMaterial, polygonGeometry, handover } from '../ownMap/layers';
import { interpolateStops, MIN_LINE_PX, PALETTE, STREET_STYLE } from '../ownMap/style';
import { overviewColours } from './themePalette';
import { KX, KY, ORIGIN, toLocal } from '../ownMap/frame';
import { metresPerPixel } from '../ownMap/mapCamera';
import { WaterIndex } from './waterIndex';
import type { FrameContext, FrameParticipant } from '../rendererShared/sharedFrame';

export async function fetchOverview(extractRoot: string): Promise<OverviewData> {
  const r = await fetch(`${extractRoot}/own-map-v1/overview.json.gz`);
  if (!r.ok) throw new Error(`own-map overview: ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  const text = b[0] === 0x1f && b[1] === 0x8b
    ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b);
  return decodeOverview(JSON.parse(text) as OverviewFile);
}

/** Mercator ← own-map local metres, linearised in y at `lat` (column-major). */
export function mercatorFromOwnLocal(lat: number): number[] {
  const cos = Math.cos(lat * Math.PI / 180);
  const yc = (lat - ORIGIN.lat) * KY;
  const Yc = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
  const sY = -1 / (360 * cos * KY);
  const u = 1 / (2 * Math.PI * 6371008.8 * cos);
  return [1 / (360 * KX), 0, 0, 0, 0, sY, 0, 0, 0, 0, u, 0, (ORIGIN.lng + 180) / 360, Yc - yc * sY, 0, 1];
}

/**
 * Metres below z = 0: under the own ground's sunken water, so wherever the ground is resident it wins the depth test
 * (the flat layers do not write depth and keep their order by renderOrder).
 */
export const OVERVIEW_Z = -3;

type Lines = { cls: StreetClass; fill: THREE.Mesh; casing: THREE.Mesh | null };

export class OverviewLayer implements FrameParticipant {
  readonly root = new THREE.Group();
  readonly water: WaterIndex;
  private readonly lines: Lines[] = [];
  private readonly land: THREE.Mesh;
  private readonly parks: THREE.Mesh;
  private readonly waterMesh: THREE.Mesh;
  private centreLat: number = ORIGIN.lat;

  /**
   * The overview's own near-field uniforms (not ownMap/layers.ts's shared `handover`, which the engine's overlay
   * lines also read): fragments inside the radius the own ground fully covers round the rider are discarded.
   */
  private readonly near = { uRider: { value: new THREE.Vector2() }, uNearR: { value: 600 }, uNear: { value: 0 } };
  private coverCheckAt = -Infinity;
  private coveredR = 0;

  constructor(readonly data: OverviewData, private readonly view: {
    center(): { lng: number; lat: number }; zoom(): number; rider?(): [number, number] | null;
    /** The own ground (gameGround.ts coversRect), when there is one. */
    ground?(): { coversRect(x0: number, y0: number, x1: number, y1: number): boolean } | null;
  }) {
    this.root.name = 'engine-overview';
    this.water = new WaterIndex(data.water);
    const [x0, y0, x1, y1] = data.bounds;
    const pad = 20_000;
    this.land = new THREE.Mesh(polygonGeometry([[[[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]]]]), fillMaterial(PALETTE.land, OVERVIEW_Z));
    this.land.renderOrder = -1;
    const water = new THREE.Mesh(polygonGeometry(data.water), fillMaterial(PALETTE.water, OVERVIEW_Z)); water.renderOrder = 2;
    const parks = new THREE.Mesh(polygonGeometry(data.parks.flatMap(p => p.rings.map(r => [r]))), fillMaterial(PALETTE.park, OVERVIEW_Z)); parks.renderOrder = 1;
    this.parks = parks; this.waterMesh = water;
    for (const m of [this.land, parks, water]) m.frustumCulled = false;
    this.root.add(this.land, parks, water);
    const ordered = [...STREET_CLASSES].sort((a, b) => STREET_STYLE[a].order - STREET_STYLE[b].order);
    for (const cls of ordered) {
      const geo = lineGeometry(data.streets.filter(s => s.cls === cls).map(s => s.points));
      const st = STREET_STYLE[cls];
      const fill = new THREE.Mesh(geo, lineMaterial(st.fill, OVERVIEW_Z)); fill.renderOrder = 20 + st.order; fill.frustumCulled = false;
      let casing: THREE.Mesh | null = null;
      if (st.casing) { casing = new THREE.Mesh(geo, lineMaterial(st.casing, OVERVIEW_Z)); casing.renderOrder = 10 + st.order; casing.frustumCulled = false; this.root.add(casing); }
      this.root.add(fill);
      this.lines.push({ cls, fill, casing });
    }
    // The overview sits under everything; nothing casts.
    this.root.traverse(o => {
      const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
      if (u?.uNear) { u.uRider = this.near.uRider; u.uNearR = this.near.uNearR; u.uNear = this.near.uNear; }
    });
    this.root.traverse(o => { (o as THREE.Mesh).castShadow = false; (o as THREE.Mesh).receiveShadow = false; });
  }

  /** A palette theme (themePalette.ts) as the flat materials' colours; 'clean' restores the own map's. */
  setTheme(theme: string): void {
    const t = overviewColours(theme);
    const set = (m: THREE.Mesh, c: string) => { ((m.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).setStyle(c, THREE.LinearSRGBColorSpace); };
    set(this.land, t ? t.land : PALETTE.land);
    set(this.parks, t ? t.park : PALETTE.park);
    set(this.waterMesh, t ? t.water : PALETTE.water);
    for (const l of this.lines) {
      const st = STREET_STYLE[l.cls];
      set(l.fill, t ? t.streetFill : st.fill);
      if (l.casing && st.casing) set(l.casing, t ? t.streetCasing : st.casing);
    }
  }

  isWater(lng: number, lat: number): boolean { return this.water.isWater(lng, lat); }

  mercatorFromLocal(): number[] { return mercatorFromOwnLocal(this.centreLat); }

  beforeRender(_ctx: FrameContext): boolean {
    const c = this.view.center();
    this.centreLat = c.lat;
    const zoom = this.view.zoom();
    const mpp = metresPerPixel(zoom, c.lat);
    for (const l of this.lines) {
      const st = STREET_STYLE[l.cls];
      const px = interpolateStops(st.width, zoom);
      const visible = px >= MIN_LINE_PX;
      l.fill.visible = visible;
      const fm = l.fill.material as THREE.ShaderMaterial;
      fm.uniforms.uHalf.value = px / 2 * mpp;
      fm.uniforms.uOpacity.value = Math.min(1, px / 0.9);
      if (l.casing) {
        l.casing.visible = visible && px > 1.2;
        (l.casing.material as THREE.ShaderMaterial).uniforms.uHalf.value = (px + st.casingExtra) / 2 * mpp;
      }
    }
    // Inside the radius the own ground fully covers round the rider the flat fills and lines would only be overdraw:
    // discard them there (checked twice a second; the ground's ring changes a cell at a time).
    const rider = this.view.rider?.();
    const ground = this.view.ground?.();
    if (rider && ground) {
      const [x, y] = toLocal(rider[0], rider[1]);
      this.near.uRider.value.set(x, y);
      const now = performance.now();
      if (now - this.coverCheckAt > 500) { this.coverCheckAt = now; this.coveredR = coveredRadius(ground, x, y); }
    } else this.coveredR = 0;
    this.near.uNearR.value = this.coveredR;
    this.near.uNear.value = this.coveredR > 0 ? 1 : 0;
    void handover;
    return true;
  }
}

/** Candidate radii (m) for the covered disc round the rider, largest first. */
const COVER_RADII = [1200, 900, 600, 400, 250] as const;

/** The largest candidate radius whose bounding square the own ground fully covers round (x, y); 0 if none. */
export function coveredRadius(ground: { coversRect(x0: number, y0: number, x1: number, y1: number): boolean }, x: number, y: number): number {
  for (const r of COVER_RADII) if (ground.coversRect(x - r, y - r, x + r, y + r)) return r;
  return 0;
}
