// Ground v2 phase 1: the cell's surface sources as partition groups and features (lane G2a #372).
// Design docs/handoffs/ground-v2-design-20261110.md, "Partition classes and precedence". The classes, materials and
// levels are the worker's (roadSurfaces surfaceLayer / PAVEMENT_LEVEL / RoadIndex's runtime overrides, parks
// SURFACE_LAYER, courtyards, open ground, OSM area fills): only the clipping is new (design Risk 9, reuse).
//
// Phase 1 bakes the surface only (judgement ruling 1): decks (roads-v1 h ≥ 1), the rail bed, paint, tram, quays and
// deck bodies stay worker-built overlays; no constraint providers yet (G2c).

import type { CellInput, GroundLayer } from './groundCell.js';
import { GROUND_LAYERS, COURTYARD_ROAD_M } from './groundCell.js';
import type { GroundSource } from './sourceTrace.js';
import type { PartitionFeature, PartitionGroup, Vec2 } from './groundPartition.js';
import { decodeRoadLine, type RoadClass } from './roadCells.js';
import { PAVEMENT_LEVEL, RoadIndex, ROAD_LIFT, SIDEWALK_TOP, surfaceLayer, KERB_LINE_M } from './roadSurfaces.js';
import { decodeLine, SURFACE_LAYER } from './parks.js';
import { COURTYARD_SURFACES } from './courtyards.js';
import { OPEN_GROUND_COVERS, OPEN_GROUND_LAYER } from './groundSurface.js';
import { pavedAreaSurface } from './osmGround.js';
import { crossingStripPoints, SURVEY_MARKINGS } from './surveyMarkings.js';
import { prepareWays, resolvePriorSidewalks, LIFT } from './streets.js';

/** Precedence ranks (design table). Rail bed (5) stays an overlay in phase 1. */
export const RANK = { water: 0, carriage: 1, cycle: 2, kerb: 3, foot: 4, rail: 5, parking: 6, courtyard: 7, park: 8, open: 9, osm: 10, land: 11 } as const;

/** Level lifts over the relief: 0 the carriageway (LIFT.carriageway, where paint and rails are laid), 1 the sidewalk top. */
export const V2_LEVEL_Z: readonly number[] = [LIFT.carriageway, SIDEWALK_TOP];

/** Flat land materials: the looser Steiner tolerance applies (ruling 3's 7.5 cm mitigation; roads keep 5 cm). */
export const FLAT_LAYERS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'park', 'wood', 'garden', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'bare', 'pond', 'parkGravel']);

const BGT_SOURCE: Record<RoadClass, GroundSource> = { carriage: 'bgtCarriage', parking: 'bgtParking', foot: 'bgtFoot', pedestrian: 'bgtPedestrian', cycle: 'bgtCycle', driveway: 'bgtDriveway', island: 'bgtIsland', berm: 'bgtBerm', verge: 'bgtVerge', square: 'bgtSquare' };

export interface PartitionSources { groups: PartitionGroup[]; features: PartitionFeature[]; restGroup: number; levelZ: readonly number[]; counts: Record<string, number> }

export interface SourceOptions {
  /** The kerb band (rank 3, roads-v1 kerb lines buffered KERB_LINE_M into the high side); default on. */
  kerbBand?: boolean;
  /** Levels: false puts every class at the carriageway level (LOD 1). */
  levels?: boolean;
}

/** The cell's surface sources from the same CellInput the worker builds from (GroundStore.cellInput). */
export function partitionSources(input: CellInput, o: SourceOptions = {}): PartitionSources {
  const [x0, y0, x1, y1] = input.rect;
  const levels = o.levels !== false;
  const groupKey = new Map<string, number>(); const groups: PartitionGroup[] = [];
  const raw: { rank: number; layer: GroundLayer | null; level: number; source: GroundSource; id: string; rings: Vec2[][] }[] = [];
  const counts: Record<string, number> = {};
  /** A feature id from its geometry, so two neighbours sort the same polygon the same way whatever their 3×3 holds. */
  const sig = (rings: readonly Vec2[][]): string => { const r = rings[0]; let sx = 0, sy = 0; for (const p of r) { sx += p[0]; sy += p[1]; } return `${Math.round(sx / r.length * 1000)},${Math.round(sy / r.length * 1000)},${r.length},${rings.length}`; };
  const push = (rank: number, layer: GroundLayer | null, level: number, source: GroundSource, id: string, rings: Vec2[][]) => {
    if (!rings.length || rings[0].length < 3) return;
    raw.push({ rank, layer, level: levels ? level : 0, source, id: `${id[0]}${sig(rings)}`, rings }); counts[source] = (counts[source] ?? 0) + 1;
  };
  const near = (rings: readonly Vec2[][], pad = 2) => {
    const r = rings[0]; if (!r?.length) return false;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
    return c >= x0 - pad && a <= x1 + pad && d >= y0 - pad && b <= y1 + pad;
  };

  // Water: a hole (rank 0), the 3×3's polygons.
  let wi = 0;
  for (const g of input.waterAround) for (const poly of g.polygons) { if (near(poly)) push(RANK.water, null, 0, 'water', `w${wi}`, poly.map(r => r.map(p => [p[0], p[1]] as Vec2))); wi++; }

  // Roads (roads-v1), with the worker's runtime overrides (RoadIndex: parking islands, grey fietsstraat, crossing strips).
  // Deduplicated (the cell's own roads are also in roadsAround): a 5×5 bake input holds up to 25 road cells.
  const roadsCells = [...new Set([input.roads, ...(input.roadsAround ?? [])])];
  const index = input.lod === 0 && roadsCells.some(c => c?.surfaces.length) ? new RoadIndex(roadsCells) : null;
  if (index) {
    index.parkingIslands();
    if (input.evidence) index.greyFietsstraat(input.evidence.greyFiets);
    if (SURVEY_MARKINGS) {
      const seen = new Set<number>(); const all = [];
      for (const extract of [input.osm, ...input.osmAround]) if (extract) for (const w of prepareWays(extract.ways, input.project)) { if (seen.has(w.id)) continue; seen.add(w.id); all.push(w); }
      index.crossingStrips(crossingStripPoints(resolvePriorSidewalks(all), input.marks ?? []));
    }
    for (let k = 0; k < index.records.length; k++) {
      const r = index.records[k];
      if (r.h !== 0) continue; // decks stay overlays (phase 1)
      const rings = index.ringsOf(k) as Vec2[][];
      if (!near(rings)) continue;
      const cls = index.drawClass(k), mesh = index.mesh(k), layer = surfaceLayer(cls, mesh) as GroundLayer;
      const level = ROAD_LIFT[cls] >= SIDEWALK_TOP ? 1 : 0;
      const rank = layer === 'lawn' ? RANK.park : cls === 'carriage' ? (layer === 'cycle' ? RANK.carriage : RANK.carriage) : cls === 'cycle' ? RANK.cycle : cls === 'parking' ? RANK.parking : PAVEMENT_LEVEL.has(cls) ? RANK.foot : RANK.foot;
      push(rank, layer, level, BGT_SOURCE[cls], `r${k}`, rings);
    }
    // The kerb band: every kerb line, buffered KERB_LINE_M either side; the low side is already taken by the carriageway
    // (ranks 1–2 come first), so what remains is the band on the high side.
    if (o.kerbBand !== false && levels) {
      const seen = new Set<string>(); let ki = 0;
      for (const c of roadsCells) if (c) for (const e of c.kerbs) {
        const line = decodeRoadLine(e); const sig = `${line[0]}|${line[line.length - 1]}|${line.length}`;
        if (seen.has(sig)) continue; seen.add(sig);
        // One band polygon per run: the line offset KERB_LINE_M either side (mitred, the mitre capped at 2×), so the
        // union sees one simple ring per run instead of a quad per segment (polygon-clipping failed on those overlaps).
        const pts = line.filter((p, i) => i === 0 || Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) >= 0.05);
        if (pts.length < 2) { ki++; continue; }
        const left: Vec2[] = [], right: Vec2[] = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], c = pts[i];
          const d1 = i > 0 ? [c[0] - a[0], c[1] - a[1]] : [b[0] - c[0], b[1] - c[1]], d2 = i < pts.length - 1 ? [b[0] - c[0], b[1] - c[1]] : d1;
          const l1 = Math.hypot(d1[0], d1[1]) || 1, l2 = Math.hypot(d2[0], d2[1]) || 1;
          const n1 = [-d1[1] / l1, d1[0] / l1], n2 = [-d2[1] / l2, d2[0] / l2];
          let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
          const scale = KERB_LINE_M / Math.max(0.5, mx * n1[0] + my * n1[1]);
          left.push([c[0] + mx * scale, c[1] + my * scale]); right.push([c[0] - mx * scale, c[1] - my * scale]);
        }
        const ring = [...left, ...right.reverse()];
        if (near([ring])) push(RANK.kerb, 'kerb', 1, 'bgtKerb', `k${ki}`, [ring]);
        ki++;
      }
    }
  }

  // Parks (parks-v1): cycle → rank 2, path / paving → rank 4 at the carriageway level (park paths have no kerb), the rest rank 8.
  const parkCells = [input.parks, ...(input.parksAround ?? [])].filter((c, i, a) => !!c && a.indexOf(c) === i);
  let pi = 0;
  for (const c of parkCells) for (const s of c!.surfaces) {
    const rings = s.r.map(decodeLine); const id = `p${pi++}`;
    if (!near(rings)) continue;
    const layer = SURFACE_LAYER[s.k] as GroundLayer;
    const rank = s.k === 'cycle' ? RANK.cycle : s.k === 'path' || s.k === 'paving' ? RANK.foot : RANK.park;
    push(rank, layer, 0, 'park', id, rings);
  }
  // Courtyards (courtyards-v1): their grass is the muted garden, as buildCell draws it.
  const yardCells = [input.courtyards, ...(input.courtyardsAround ?? [])].filter((c, i, a) => !!c && a.indexOf(c) === i);
  for (const c of yardCells) for (const a of c!.areas) {
    if (!COURTYARD_SURFACES.includes(a.k)) continue;
    const rings = a.r.map(decodeLine); if (!near(rings)) continue;
    const l = SURFACE_LAYER[a.k] as GroundLayer;
    push(RANK.courtyard, l === 'lawn' ? 'garden' : l, 0, 'park', `y${a.id}`, rings);
  }
  // Open ground (open-ground-v1).
  const openCells = [input.openGround, ...(input.openGroundAround ?? [])].filter((c, i, a) => !!c && a.indexOf(c) === i);
  for (const c of openCells) for (const a of c!.areas) {
    if (!OPEN_GROUND_COVERS.includes(a.k)) continue;
    const rings = a.r.map(decodeLine); if (!near(rings)) continue;
    push(RANK.open, OPEN_GROUND_LAYER[a.k], 0, 'park', `o${a.id}`, rings);
  }
  // OSM area fills (own-ground-osm-v1, the 3×3: an area is drawn whole by one cell today, clipped per cell here).
  const areaLayer: Record<string, GroundLayer> = { park: 'park', grass: 'park', wood: 'wood', square: 'square', paved: 'square', parking: 'parking' };
  // Exact containment, no prepareFast raster: the 5×5 can exceed the raster's 16-bit ids, and an exact test cannot
  // differ between two neighbours' bakes (seam determinism).
  const isCourtyard = (rings: Vec2[][]): boolean => {
    if (!index) return false;
    const d = COURTYARD_ROAD_M;
    for (const pts of rings) for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(len / 2));
      for (let k = 0; k < n; k++) {
        const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n;
        if (index.find(x, y) >= 0 || index.find(x + d, y) >= 0 || index.find(x - d, y) >= 0 || index.find(x, y + d) >= 0 || index.find(x, y - d) >= 0) return false;
      }
    }
    return true;
  };
  const seenAreas = new Set<string>();
  for (const ex of [input.osm, ...input.osmAround]) if (ex) for (const a of ex.areas) {
    if (seenAreas.has(a.id)) continue; seenAreas.add(a.id);
    let layer = a.kind === 'paved' ? (pavedAreaSurface(a) as GroundLayer) : areaLayer[a.kind];
    if (!layer) continue;
    const rings = a.rings.map(r => r.map(p => input.project(p) as Vec2));
    if (!near(rings)) continue;
    if ((layer === 'park' || layer === 'wood') && isCourtyard(rings)) layer = 'garden';
    push(layer === 'parking' ? RANK.parking : RANK.osm, layer, 0, 'osmArea', `a${a.id}`, rings);
  }

  // Groups: unique (rank, layer, level), ordered by rank, then layer id, then level; the land group last.
  raw.push({ rank: RANK.land, layer: 'land', level: 0, source: 'land', id: 'land', rings: [] });
  const order = [...new Set(raw.map(r => `${r.rank}|${r.layer === null ? -1 : GROUND_LAYERS.indexOf(r.layer)}|${r.level}`))]
    .map(k => k.split('|').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const [rank, li, level] of order) {
    const layer = li < 0 ? null : GROUND_LAYERS[li];
    const src = raw.find(r => r.rank === rank && r.layer === layer && r.level === level)!.source;
    groupKey.set(`${rank}|${li}|${level}`, groups.length);
    groups.push({ name: `${rank}:${layer ?? 'hole'}${level ? '+' + level : ''}`, rank, layer, level, flat: layer !== null && FLAT_LAYERS.has(layer), source: src });
  }
  const features: PartitionFeature[] = [];
  for (const r of raw) { if (!r.rings.length) continue; features.push({ group: groupKey.get(`${r.rank}|${r.layer === null ? -1 : GROUND_LAYERS.indexOf(r.layer)}|${r.level}`)!, id: r.id, rings: r.rings }); }
  return { groups, features, restGroup: groupKey.get(`${RANK.land}|${GROUND_LAYERS.indexOf('land')}|0`)!, levelZ: levels ? V2_LEVEL_Z : [LIFT.carriageway], counts };
}
