// The own overview's building footprints, in the city's roof tone (overviewTransition/basemapOverview.ts
// `footprintTone`), from the streamed buildings the client already holds (the world-v1 cells' FOOT stream, as
// GeoJSON from BuildingTileStreamer). MapLibre's basemap draws its `building` footprints in that tone until the
// 3D city is complete and fades them out after (overviewBasemapPatches); without them the own overview showed
// bare land where roofs and gardens then appeared, the last 1.8 points of overview-transition:101 under
// ?engine=own (6.8 % of the view at 14.4 -> 14.5 against MapLibre's 3.7 %, #129 hand-back 18).
//
// One flat mesh per z14 tile, built only while the camera is zoomed out far enough to see them (below
// FOOTPRINT_MAX_ZOOM; the ride's play zoom never builds one) and at most one tile per frame. A tile is rebuilt
// when its set of buildings changes; tiles that leave the resident set are dropped.

import * as THREE from 'three';
import { fillMaterial, polygonGeometry } from '../ownMap/layers';
import { toLocal, type Vec2 } from '../ownMap/frame';
import { BLEND_END_ZOOM } from '../overviewTransition/blend';
import { FOOTPRINT_FADE_ZOOM, footprintTone } from '../overviewTransition/basemapOverview';

/** MapLibre's footprint layer range (overviewBasemapPatches: minzoom 13, maxzoom BLEND_END + FOOTPRINT_FADE). */
export const FOOTPRINT_MIN_ZOOM = 13;
export const FOOTPRINT_MAX_ZOOM = BLEND_END_ZOOM + FOOTPRINT_FADE_ZOOM;
const TILE_ZOOM = 14;
/** The overview root's group order (overviewLayer.ts): first of every transparent draw. */
export const OVERVIEW_GROUP_ORDER = -100;

/** The footprints' opacity at a zoom, as MapLibre's: full until BLEND_END, linear to 0 over FOOTPRINT_FADE_ZOOM. */
export function footprintOpacity(zoom: number): number {
  if (zoom < FOOTPRINT_MIN_ZOOM || zoom >= FOOTPRINT_MAX_ZOOM) return 0;
  return zoom <= BLEND_END_ZOOM ? 1 : 1 - (zoom - BLEND_END_ZOOM) / FOOTPRINT_FADE_ZOOM;
}

export interface FootprintFeatureLike {
  geometry?: { type: string; coordinates: unknown } | null;
  properties?: { id?: unknown } | null;
}

/** The z14 tile a footprint belongs to (by its first vertex), or null for a feature without polygon rings. */
export function footprintTile(f: FootprintFeatureLike): string | null {
  const g = f.geometry;
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
  const first = (g.type === 'Polygon' ? (g.coordinates as number[][][])[0]?.[0] : (g.coordinates as number[][][][])[0]?.[0]?.[0]);
  if (!first) return null;
  const n = 2 ** TILE_ZOOM, [lng, lat] = first;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * n);
  return `${x}/${y}`;
}

/** Local-metre rings of a footprint (ownMap/frame.ts toLocal). */
export function footprintRings(f: FootprintFeatureLike): Vec2[][][] {
  const g = f.geometry!;
  const polys = g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.coordinates as number[][][][];
  return polys.map(rings => rings.map(ring => ring.map(([lng, lat]) => toLocal(lng, lat) as Vec2)));
}

type Tile = { sig: string; features: FootprintFeatureLike[]; mesh: THREE.Mesh | null; built: string };

export class OverviewFootprints {
  readonly root = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly tiles = new Map<string, Tile>();
  /** Built tiles' triangles (stats). */
  triangles = 0;

  constructor(z: number, near: Record<string, { value: unknown }>, renderOrder: number) {
    this.root.name = 'engine-overview-footprints';
    // three takes a draw's group order from its innermost Group: this one must carry the overview's (first).
    this.root.renderOrder = OVERVIEW_GROUP_ORDER;
    this.material = fillMaterial(`rgb(${footprintTone().join(',')})`, z);
    Object.assign(this.material.uniforms, near);
    this.renderOrder = renderOrder;
  }
  private readonly renderOrder: number;

  /** The resident buildings (all of them, as the streamer hands them over). */
  setFeatures(features: readonly FootprintFeatureLike[]): void {
    const byTile = new Map<string, FootprintFeatureLike[]>();
    for (const f of features) {
      const key = footprintTile(f);
      if (!key) continue;
      let list = byTile.get(key);
      if (!list) byTile.set(key, list = []);
      list.push(f);
    }
    for (const [key, t] of this.tiles) if (!byTile.has(key)) { this.drop(t); this.tiles.delete(key); }
    for (const [key, list] of byTile) {
      const sig = `${list.length}|${String(list[0].properties?.id)}|${String(list[list.length - 1].properties?.id)}`;
      const t = this.tiles.get(key);
      if (t) { t.features = list; t.sig = sig; } else this.tiles.set(key, { sig, features: list, mesh: null, built: '' });
    }
  }

  /**
   * The frame's opacity, and at most one tile built (only when the footprints can show). Returns true while
   * tiles are still waiting to be built, so the host asks for another frame.
   */
  update(zoom: number): boolean {
    const opacity = footprintOpacity(zoom);
    this.root.visible = opacity > 0;
    this.material.uniforms.uOpacity.value = opacity;
    if (opacity <= 0) return false;
    let waiting = false, builtOne = false;
    for (const t of this.tiles.values()) {
      if (t.built === t.sig) continue;
      if (builtOne) { waiting = true; break; }
      this.build(t);
      builtOne = true;
    }
    return waiting;
  }

  private build(t: Tile): void {
    this.drop(t);
    const polygons: Vec2[][][] = [];
    for (const f of t.features) for (const poly of footprintRings(f)) polygons.push(poly);
    const geometry = polygonGeometry(polygons);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.renderOrder = this.renderOrder;
    mesh.frustumCulled = true;
    mesh.castShadow = mesh.receiveShadow = false;
    this.root.add(mesh);
    t.mesh = mesh;
    t.built = t.sig;
    this.triangles += (geometry.index?.count ?? 0) / 3;
  }

  private drop(t: Tile): void {
    if (!t.mesh) return;
    this.triangles -= (t.mesh.geometry.index?.count ?? 0) / 3;
    this.root.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
    t.built = '';
  }

  /** A new renderer after a context loss: rebuild every tile on demand. */
  onContextRestored(): void { for (const t of this.tiles.values()) this.drop(t); }

  stats(): { tiles: number; built: number; triangles: number } {
    let built = 0;
    for (const t of this.tiles.values()) if (t.mesh) built++;
    return { tiles: this.tiles.size, built, triangles: this.triangles };
  }
}
