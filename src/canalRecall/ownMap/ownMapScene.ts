// The own map's flat cartography as one three.js group: landuse, parks,
// water, piers, streets by class (incl. footways), rail, neighbourhood
// boundaries, ferry lines, the transit corridor overlay, the route and the
// answered-street lettering. Owns no renderer and no camera: the proof page
// renders it with its own camera, and the game can add `group` to its shared
// three.js frame. Call `update(zoom, mpp)` once per frame (pixel widths →
// metres, zoom-gated visibility).

import * as THREE from 'three';
import type { Vec2 } from './frame';
import { STREET_CLASSES, type OverviewData, type RailKind } from './overviewFormat';
import { fillMaterial, groundTextMesh, lineGeometry, lineMaterial, polygonGeometry } from './layers';
import { HOOD_BOUNDARY_STYLE, LANDUSE_STYLE, MIN_LINE_PX, PALETTE, PIER_STYLE, RAIL_STYLE, RAIL_TUNNEL_STYLE, ROUTE_WIDTH, STREET_STYLE, interpolateStops, type Stops } from './style';
import { FERRY_LINE_SPEC, ANSWERED_PAINT, answeredLetterHeightMetres, interpolateLinear, type AnsweredPlacement, type OverlayLineSet } from './overlays';

interface LineLayer {
  id: string;
  mesh: THREE.Mesh;
  width: Stops;
  linear?: boolean;
  /** Multiplier on the width (service rail). */
  scale?: number;
  /** px added to the width (casings). */
  extra?: number;
  opacity: number;
  dash: [number, number] | null;
  minZoom: number;
  /** A casing: hidden while its line is under 1.2 px. */
  casingOf?: LineLayer;
}

const uniforms = (m: THREE.Mesh) => (m.material as THREE.ShaderMaterial).uniforms;

// Render order (flat layers are in three's transparent list, sorted by this):
// 0–9 landuse, 1x parks/water/piers, 2x casings, 3x street fills, 4x rail and
// overlays, 5x route, 60+ above-building callouts.
const ORDER = { landuse: 0, park: 10, water: 12, pier: 13, hood: 14, casing: 20, fill: 30, rail: 40, ferry: 42, transit: 44, answered: 48, route: 50, above: 60 };

export class OwnMapScene {
  readonly group = new THREE.Group();
  readonly stats: Record<string, number> = {};
  private layers: LineLayer[] = [];
  private transit: LineLayer[] = [];
  private route: LineLayer[] = [];
  private answered: THREE.Mesh | null = null;

  constructor(readonly data: OverviewData) {
    this.group.name = 'own-map-flat';
    // Landuse, one mesh per class, under parks.
    // One draw call for every class: per-vertex colour, drawn in class order.
    const landuse = [...data.landuse].sort((a, b) => LANDUSE_STYLE[a.cls].order - LANDUSE_STYLE[b.cls].order);
    if (landuse.length) this.fill(polygonGeometry(landuse.map(l => l.rings), landuse.map(l => LANDUSE_STYLE[l.cls].fill)), '#ffffff', ORDER.landuse, true);
    this.fill(polygonGeometry(data.parks.flatMap(p => p.rings.map(r => [r]))), PALETTE.park, ORDER.park);
    this.fill(polygonGeometry(data.water), PALETTE.water, ORDER.water);
    if (data.piers.length) this.fill(polygonGeometry(data.piers.map(r => [r])), PIER_STYLE.fill, ORDER.pier);
    if (data.pierLines.length) this.lines('piers', data.pierLines, PIER_STYLE.fill, ORDER.pier, { width: PIER_STYLE.width, opacity: 1, dash: null, minZoom: 13 });
    // Neighbourhood boundaries (dashed), under the streets as in the game (`before` building-3d, after the basemap).
    if (data.hoodRings.length) this.lines('hood-boundaries', data.hoodRings, HOOD_BOUNDARY_STYLE.color, ORDER.hood, { width: HOOD_BOUNDARY_STYLE.width, linear: true, opacity: HOOD_BOUNDARY_STYLE.opacity, dash: HOOD_BOUNDARY_STYLE.dash, minZoom: HOOD_BOUNDARY_STYLE.minZoom, blend: true });
    // Streets by class, casings under fills.
    const ordered = [...STREET_CLASSES].sort((a, b) => STREET_STYLE[a].order - STREET_STYLE[b].order);
    for (const cls of ordered) {
      const st = STREET_STYLE[cls];
      const lines = data.streets.filter(s => s.cls === cls).map(s => s.points);
      this.stats[`street:${cls}`] = lines.length;
      const geo = lineGeometry(lines);
      const fill = this.lines(`street-${cls}`, geo, st.fill, ORDER.fill + st.order, { width: st.width, opacity: 1, dash: null, minZoom: 0 });
      if (st.casing) this.lines(`street-${cls}-casing`, geo, st.casing, ORDER.casing + st.order, { width: st.width, extra: st.casingExtra, opacity: 1, dash: null, minZoom: 0, casingOf: fill });
    }
    // Rail in three draw calls: trains (rail-like kinds, per-line width scale
    // relative to `rail` at z18; service tracks 60 %), trams (own zoom stops),
    // and every tunnel (faint, dashed).
    const scaleOf = (kind: RailKind, service: boolean) => (RAIL_STYLE[kind].width.find(([z]) => z === 18)?.[1] ?? 3) / 3 * (service ? 0.6 : 1);
    const groups: Array<{ id: string; pick: (r: OverviewData['rail'][number]) => boolean; style: RailKind; tunnel: boolean }> = [
      { id: 'rail', pick: r => !r.tunnel && r.kind !== 'tram', style: 'rail', tunnel: false },
      { id: 'rail-tram', pick: r => !r.tunnel && r.kind === 'tram', style: 'tram', tunnel: false },
      { id: 'rail-tunnel', pick: r => r.tunnel, style: 'rail', tunnel: true },
    ];
    for (const g of groups) {
      const rails = data.rail.filter(g.pick);
      if (!rails.length) continue;
      const scales = rails.map(r => (g.style === 'tram' ? (r.service ? 0.6 : 1) : scaleOf(r.kind, r.service)));
      this.lines(g.id, lineGeometry(rails.map(r => r.points), undefined, scales), RAIL_STYLE[g.style].fill, ORDER.rail + (g.tunnel ? 0 : 1), {
        width: RAIL_STYLE[g.style].width, opacity: g.tunnel ? RAIL_TUNNEL_STYLE.opacity : 1, dash: g.tunnel ? RAIL_TUNNEL_STYLE.dash : null, minZoom: 0, blend: g.tunnel, perLineScale: true,
      });
      for (const r of rails) this.stats[`rail:${r.kind}`] = (this.stats[`rail:${r.kind}`] ?? 0) + 1;
    }
  }

  private fill(geo: THREE.BufferGeometry, color: string, order: number, vertexColor = false): THREE.Mesh {
    const m = new THREE.Mesh(geo, fillMaterial(color, 0, { vertexColor }));
    m.renderOrder = order; m.frustumCulled = false;
    this.group.add(m);
    return m;
  }

  private lines(id: string, src: THREE.BufferGeometry | readonly (readonly Vec2[])[], color: string, order: number, o: Omit<LineLayer, 'id' | 'mesh'> & { colors?: string[]; z?: number; above?: boolean; blend?: boolean; perLineScale?: boolean }, into: LineLayer[] = this.layers): LineLayer {
    const geo = src instanceof THREE.BufferGeometry ? src : lineGeometry(src, o.colors);
    const mesh = new THREE.Mesh(geo, lineMaterial(color, o.z ?? 0, { dash: !!o.dash, vertexColor: !!o.colors, blend: o.blend, scale: o.perLineScale }));
    mesh.renderOrder = order; mesh.frustumCulled = false;
    if (o.above) (mesh.material as THREE.ShaderMaterial).depthTest = false;
    this.group.add(mesh);
    const layer: LineLayer = { id, mesh, width: o.width, linear: o.linear, scale: o.scale, extra: o.extra, opacity: o.opacity, dash: o.dash, minZoom: o.minZoom, casingOf: o.casingOf };
    into.push(layer);
    return layer;
  }

  private drop(list: LineLayer[]): void {
    for (const l of list) { this.group.remove(l.mesh); l.mesh.geometry.dispose(); (l.mesh.material as THREE.Material).dispose(); }
    list.length = 0;
  }

  /** Ferry crossings, dashed (the basemap draws GVB ferries this way). */
  setFerryLines(lines: Vec2[][]): void {
    this.lines('ferry-lines', lines, FERRY_LINE_SPEC.color!, ORDER.ferry, { width: FERRY_LINE_SPEC.width, linear: true, opacity: FERRY_LINE_SPEC.opacity, dash: FERRY_LINE_SPEC.dash, minZoom: 10, blend: true });
    this.stats.ferryLines = lines.length;
  }

  /** The transit corridor overlay (vector-map.js setTransitNetwork); null hides it. */
  setTransit(sets: OverlayLineSet[] | null): void {
    this.drop(this.transit);
    if (!sets) return;
    sets.forEach((set, i) => {
      if (!set.lines.length) return;
      this.lines(set.spec.id, set.lines.map(l => l.points), set.spec.color ?? '#E11D48', (set.spec.above ? ORDER.above : ORDER.transit) + i * 0.1, {
        width: set.spec.width, linear: set.spec.linear, opacity: set.spec.opacity, dash: set.spec.dash, minZoom: 0, above: set.spec.above, blend: true,
        colors: set.lines.map(l => l.color),
      }, this.transit);
    });
    this.stats.transitLines = sets.reduce((s, x) => s + x.lines.length, 0);
  }

  /** The route line with its casing (vector-map.js navigation-route-*: casing rgba(3,18,28,.75), line #38BDF8). */
  setRoute(path: Vec2[] | null): void {
    this.drop(this.route);
    if (!path || path.length < 2) return;
    const geo = lineGeometry([path]);
    // Above the flat map and the near-field bands (≤ 0.07 m), under buildings: the game's route sits under building-3d.
    this.lines('route-casing', geo, '#03121c', ORDER.route, { width: ROUTE_WIDTH, extra: 4, opacity: 0.75, dash: null, minZoom: 0, z: 0.3 }, this.route);
    this.lines('route-line', geo, PALETTE.route, ORDER.route + 1, { width: ROUTE_WIDTH, opacity: 1, dash: null, minZoom: 0, z: 0.32 }, this.route);
    // The route stays drawn inside the near field.
    for (const l of this.route) uniforms(l.mesh).uNear = { value: 0 };
  }

  /** The just-answered street's name on the road (null clears). */
  setAnswered(name: string | null, placements: AnsweredPlacement[], correct: boolean, lat = 52.37): void {
    if (this.answered) { this.group.remove(this.answered); this.answered.geometry.dispose(); ((this.answered.material as THREE.MeshBasicMaterial).map)?.dispose(); this.answered = null; }
    const p = placements[0];
    if (!name || !p) return;
    this.answered = groundTextMesh(name.toUpperCase(), {
      heightM: answeredLetterHeightMetres(lat), bearing: p.bearing, at: p.at,
      fill: ANSWERED_PAINT.fill, halo: correct ? ANSWERED_PAINT.correct : ANSWERED_PAINT.wrong, opacity: ANSWERED_PAINT.opacity, letterSpacingEm: ANSWERED_PAINT.letterSpacingEm,
    });
    this.answered.renderOrder = ORDER.answered;
    this.group.add(this.answered);
  }

  /** Per frame: MapLibre-style pixel widths → metres at the centre, zoom gates. */
  update(zoom: number, mpp: number): void {
    for (const list of [this.layers, this.transit, this.route]) for (const l of list) {
      const raw = l.linear ? interpolateLinear(l.width, zoom) : interpolateStops(l.width, zoom);
      const px = raw * (l.scale ?? 1);
      const visible = zoom >= l.minZoom && px >= MIN_LINE_PX && (!l.casingOf || px > 1.2);
      l.mesh.visible = visible;
      if (!visible) continue;
      const u = uniforms(l.mesh);
      const w = px + (l.extra ?? 0);
      u.uHalf.value = w / 2 * mpp;
      u.uOpacity.value = l.opacity * Math.min(1, px / 0.9);
      // MapLibre dash lengths are in line widths.
      if (l.dash) u.uDash.value.set(l.dash[0] * Math.max(1, w) * mpp, l.dash[1] * Math.max(1, w) * mpp);
    }
  }
}
