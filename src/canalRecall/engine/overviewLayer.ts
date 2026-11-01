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
import { fillMaterial, lineMaterial, handover } from '../ownMap/layers';
import { overviewRecipes, railGroups, type BuiltOverviewGeometry, type GeometryArrays } from '../ownMap/overviewArrays';
import { overviewText } from '../ownMap/overviewPool';
import type { CellTile } from '../ownGround/cellTiles';
import { interpolateStops, LANDUSE_STYLE, MIN_LINE_PX, PALETTE, PIER_STYLE, RAIL_STYLE, RAIL_TUNNEL_STYLE, STREET_STYLE, type Stops } from '../ownMap/style';
import { LANDUSE_CLASSES } from '../ownMap/overviewFormat';
import { overviewColours } from './themePalette';
import { KX, KY, ORIGIN, toLocal, type Vec2 } from '../ownMap/frame';
import { metresPerPixel } from '../ownMap/mapCamera';
import { WaterIndex } from './waterIndex';
import { cutMesh, growTileSpheres } from '../rendererShared/tiledGeometry';
import type { FrameContext, FrameParticipant } from '../rendererShared/sharedFrame';

export async function fetchOverview(extractRoot: string): Promise<OverviewData> {
  const r = await fetch(`${extractRoot}/own-map-v1/overview.json.gz`);
  if (!r.ok) throw new Error(`own-map overview: ${r.status}`);
  return decodeOverviewBytes(new Uint8Array(await r.arrayBuffer()));
}

/** The overview file's bytes (fetchOverviewBytes), decoded. */
export async function decodeOverviewBytes(b: Uint8Array): Promise<OverviewData> {
  return decodeOverview(JSON.parse(await overviewText(b)) as OverviewFile);
}

/** overview.json.gz as fetched (the engine hands a copy to the worker pool, overviewPool.ts). */
export async function fetchOverviewBytes(extractRoot: string): Promise<Uint8Array> {
  const r = await fetch(`${extractRoot}/own-map-v1/overview.json.gz`);
  if (!r.ok) throw new Error(`own-map overview: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** A geometry over these arrays (overviewArrays.ts): the attributes, index and bounding sphere polygonGeometry / lineGeometry make. */
export function geometryOf(a: GeometryArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.attributes.position, 3));
  if (a.attributes.aDir) g.setAttribute('aDir', new THREE.BufferAttribute(a.attributes.aDir, 2));
  if (a.attributes.aCorner) g.setAttribute('aCorner', new THREE.BufferAttribute(a.attributes.aCorner, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  const [x, y, z, r] = a.sphere;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), r);
  return g;
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
/** v2 overview lines with their own width stops (rail by kind, pier walkways). */
type ExtraLine = { mesh: THREE.Mesh; width: Stops; scale: number; opacity: number };

export class OverviewLayer implements FrameParticipant {
  readonly root = new THREE.Group();
  readonly water: WaterIndex;
  private readonly lines: Lines[] = [];
  private readonly extraLines: ExtraLine[] = [];
  private readonly land: THREE.Mesh;
  private readonly parks: THREE.Mesh;
  private readonly waterMesh: THREE.Mesh;
  private centreLat: number = ORIGIN.lat;
  /** How to build each geometry again (a lost context): the CPU copies are freed once uploaded (heap gate, #130). */
  private readonly rebuild = new Map<THREE.BufferGeometry, () => THREE.BufferGeometry>();
  /** Each overview geometry's recipe by id (overviewArrays.ts), and what the pool built (constructor `prebuilt`). */
  private readonly recipes = new Map<string, () => GeometryArrays>();
  private readonly prebuilt = new Map<string, BuiltOverviewGeometry>();
  /** Span tiles cut in the pool worker, per geometry (cutSpans: undefined means cut here). */
  private readonly preTiles = new Map<THREE.BufferGeometry, CellTile[] | null>();
  /**
   * The geometry `id` (overviewArrays.ts overviewRecipes), freeing its CPU arrays after upload, with the recipe to make
   * it again. Wraps the pool's arrays when it built them (the same arrays and sphere as the recipe: overviewArrays.test).
   */
  private built(id: string): THREE.BufferGeometry {
    const recipe = this.recipes.get(id)!, make = () => geometryOf(recipe());
    const pre = this.prebuilt.get(id);
    this.prebuilt.delete(id);
    const g = pre ? geometryOf(pre) : make();
    if (pre) this.preTiles.set(g, pre.tiles);
    return this.track(g, make);
  }
  private track(g: THREE.BufferGeometry, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    for (const a of [...Object.values(g.attributes), g.index]) (a as THREE.BufferAttribute | null)?.onUpload(releaseArray);
    this.rebuild.set(g, make);
    return g;
  }

  /**
   * The overview's own near-field uniforms (not ownMap/layers.ts's shared `handover`, which the engine's overlay
   * lines also read): fragments inside the radius the own ground fully covers round the rider are discarded.
   */
  private readonly near = { uRider: { value: new THREE.Vector2() }, uNearR: { value: 600 }, uNear: { value: 0 } };
  private coverCheckAt = -Infinity;
  /** The inputs of the last cover check (rider metre, zoom, ground residency revision). */
  private coverKey = '';
  private coveredR = 0;
  /** Span-culled geometries (cutSpans): the mesh that owns the spans and every mesh drawing that geometry. */
  private readonly spanned: { owner: THREE.Mesh; meshes: THREE.Mesh[]; line: boolean }[] = [];
  private spansOn = true;

  constructor(readonly data: OverviewData, private readonly view: {
    center(): { lng: number; lat: number }; zoom(): number; rider?(): [number, number] | null;
    /** The own ground (gameGround.ts coversRect), when there is one. */
    ground?(): { coversRect(x0: number, y0: number, x1: number, y1: number): boolean; coverRevision?: number } | null;
    /** Ask the host for a frame (a cover check due later than this frame). */
    repaint?(): void;
  }, prebuilt?: readonly BuiltOverviewGeometry[] | null) {
    this.root.name = 'engine-overview';
    this.water = new WaterIndex(data.water);
    for (const r of overviewRecipes(data)) this.recipes.set(r.id, r.make);
    for (const g of prebuilt ?? []) if (this.recipes.has(g.id)) this.prebuilt.set(g.id, g);
    this.land = new THREE.Mesh(this.built('land'), fillMaterial(PALETTE.land, OVERVIEW_Z));
    this.land.renderOrder = -1;
    const water = new THREE.Mesh(this.built('water'), fillMaterial(PALETTE.water, OVERVIEW_Z)); water.renderOrder = 2;
    const parks = new THREE.Mesh(this.built('parks'), fillMaterial(PALETTE.park, OVERVIEW_Z)); parks.renderOrder = 1;
    this.parks = parks; this.waterMesh = water;
    for (const m of [this.land, parks, water]) m.frustumCulled = false;
    this.root.add(this.land, parks, water);
    this.addV2Layers(data);
    const ordered = [...STREET_CLASSES].sort((a, b) => STREET_STYLE[a].order - STREET_STYLE[b].order);
    for (const cls of ordered) {
      const geo = this.built(`street:${cls}`);
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
    this.cutSpans();
  }

  /**
   * Each heavy geometry drawn over only the span of its index on screen (tiledGeometry.ts drawAsSpans): the overview
   * covers the whole region, ~0.7 M triangles plus casings, every one transformed and set up each frame though most
   * are off screen; that is what a CPU rasteriser and a weak GPU are bound by (hand-back on #129, 2026-11-01). One
   * draw call per mesh, as before. The index is reordered by tile; every mesh is one colour with no depth write, so
   * the order inside a mesh changes no pixel. A fill and its casing share a geometry: the casing reuses the fill's
   * spans. `?overviewSpans=0` keeps the whole index.
   */
  private cutSpans(): void {
    if (new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get('overviewSpans') === '0') return;
    const byGeo = new Map<THREE.BufferGeometry, THREE.Mesh[]>();
    this.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.index) byGeo.set(m.geometry, [...(byGeo.get(m.geometry) ?? []), m]);
    });
    for (const [geo, meshes] of byGeo) {
      const owner = meshes[0];
      if (!cutMesh(THREE, owner, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES, { draw: 'spans', tiles: this.preTiles.has(geo) ? this.preTiles.get(geo) : undefined })) continue;
      const cull = owner.onBeforeRender;
      const whole = () => { geo.drawRange.start = 0; geo.drawRange.count = Infinity; };
      for (const m of meshes) {
        m.onBeforeRender = (...a) => { if (this.spansOn) cull.apply(owner, a); else whole(); };
        m.onAfterRender = whole;
      }
      this.spanned.push({ owner, meshes, line: !!geo.getAttribute('aDir') });
    }
  }

  /** The A/B for span culling (the census, specs): off draws every geometry whole. */
  setSpans(on: boolean): void { this.spansOn = on; }

  /**
   * v2 overview layers (scripts/own-map/fetch-osm-extras.ts), absent from a v1 file: landuse under the parks, piers
   * over the water, rail over the streets' casings. Footways arrive as `path` street lines and need nothing here.
   * All of them reuse the flat fill/line programs (one colour uniform each), so they add draws, not programs.
   */
  private addV2Layers(data: OverviewData): void {
    const add = (m: THREE.Mesh, order: number) => { m.renderOrder = order; m.frustumCulled = false; this.root.add(m); return m; };
    for (const cls of LANDUSE_CLASSES) {
      if (!this.recipes.has(`landuse:${cls}`)) continue;
      // Between the land (-1) and the parks (1), in the style's order.
      add(new THREE.Mesh(this.built(`landuse:${cls}`), fillMaterial(LANDUSE_STYLE[cls].fill, OVERVIEW_Z)), LANDUSE_STYLE[cls].order / 10);
    }
    if (data.piers.length) add(new THREE.Mesh(this.built('piers'), fillMaterial(PIER_STYLE.fill, OVERVIEW_Z)), 3);
    if (data.pierLines.length) {
      const mesh = add(new THREE.Mesh(this.built('pierLines'), lineMaterial(PIER_STYLE.fill, OVERVIEW_Z)), 4);
      this.extraLines.push({ mesh, width: PIER_STYLE.width, scale: 1, opacity: 1 });
    }
    for (const g of railGroups(data)) {
      const st = RAIL_STYLE[g.kind as keyof typeof RAIL_STYLE];
      // Tunnels under the streets, faint; surface track over the street fills.
      const mesh = add(new THREE.Mesh(this.built(`rail:${g.key}`), lineMaterial(st.fill, OVERVIEW_Z)), g.tunnel ? 9 : 30);
      this.extraLines.push({ mesh, width: st.width, scale: g.service ? 0.6 : 1, opacity: g.tunnel ? RAIL_TUNNEL_STYLE.opacity : 1 });
    }
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

  /** A new renderer after a context loss: the freed CPU copies are built again from the overview data. */
  onContextRestored(): void {
    const fresh = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    this.root.traverse(o => {
      const m = o as THREE.Mesh, old = m.geometry as THREE.BufferGeometry | undefined;
      if (!old) return;
      let g = fresh.get(old); // a casing shares its fill's geometry
      if (!g) {
        const make = this.rebuild.get(old);
        if (!make) return;
        g = this.track(make(), make); fresh.set(old, g); this.rebuild.delete(old); old.dispose();
      }
      m.geometry = g;
    });
  }

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
    for (const l of this.extraLines) {
      const px = interpolateStops(l.width, zoom) * l.scale;
      l.mesh.visible = px >= MIN_LINE_PX;
      const m = l.mesh.material as THREE.ShaderMaterial;
      m.uniforms.uHalf.value = px / 2 * mpp;
      m.uniforms.uOpacity.value = l.opacity * Math.min(1, px / 0.9);
    }
    // The spans' spheres were built round the stored (z = 0, centreline) vertices: grow them by the draw depth and,
    // for lines, the corner extrusion (uHalf × √2) of the widest mesh drawing that geometry.
    for (const sp of this.spanned) {
      let half = 0;
      if (sp.line) for (const m of sp.meshes) half = Math.max(half, (m.material as THREE.ShaderMaterial).uniforms.uHalf.value as number);
      growTileSpheres(sp.owner, half * Math.SQRT2 + Math.abs(OVERVIEW_Z) + 1);
    }
    // Inside the radius the own ground fully covers round the rider the flat fills and lines would only be overdraw:
    // discard them there (checked twice a second; the ground's ring changes a cell at a time).
    const rider = this.view.rider?.();
    const ground = this.view.ground?.();
    if (rider && ground) {
      const [x, y] = toLocal(rider[0], rider[1]);
      this.near.uRider.value.set(x, y);
      const now = performance.now();
      // The radius only changes with the rider's spot, the zoom or the ground's residency. Throttled while those
      // change, a check skipped here asks for the frame that runs it: otherwise a rider who stops (or a cell that
      // finishes dissolving) within 500 ms of the last check kept the old radius on screen until some unrelated
      // repaint, and a still frame differed from a redraw at the far road edges (#129 render on change, iPhone).
      const key = `${Math.round(x)},${Math.round(y)},${this.view.zoom().toFixed(2)},${ground.coverRevision ?? ''}`;
      if (key !== this.coverKey) {
        if (now - this.coverCheckAt > 500) { this.coverCheckAt = now; this.coverKey = key; this.coveredR = coveredRadius(ground, x, y); }
        else this.view.repaint?.();
      }
    } else { this.coveredR = 0; this.coverKey = ''; }
    this.near.uNearR.value = this.coveredR;
    this.near.uNear.value = this.coveredR > 0 ? 1 : 0;
    void handover;
    return true;
  }
}

/** Span grid per side over each overview geometry's extent, and the smallest geometry worth cutting. */
export const OVERVIEW_TILES = 8;
export const OVERVIEW_TILE_MIN_TRIANGLES = 2000;
/** three's `onUpload` callback (`this` is the attribute): drop the CPU copy. */
function releaseArray(this: { array: unknown }): void { this.array = null; }

/** Candidate radii (m) for the covered disc round the rider, largest first. */
const COVER_RADII = [1200, 900, 600, 400, 250] as const;

/** The largest candidate radius whose bounding square the own ground fully covers round (x, y); 0 if none. */
export function coveredRadius(ground: { coversRect(x0: number, y0: number, x1: number, y1: number): boolean }, x: number, y: number): number {
  for (const r of COVER_RADII) if (ground.coversRect(x - r, y - r, x + r, y + r)) return r;
  return 0;
}
