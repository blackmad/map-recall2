// OSM ground extract types and street cross-sections (pure).
//
// A street becomes parallel bands — carriageway, painted cycle lanes, raised
// cycle tracks, raised sidewalks — from its OSM tags. Where a tag is missing
// we use Amsterdam priors and say so (`source: 'prior'`), because a confident
// drawing of a guessed width teaches the wrong thing just as well as a right one.

export type LngLat = [number, number];

export interface OsmWay { id: number; tags: Record<string, string>; g: LngLat[] }
export type AreaKind = 'park' | 'grass' | 'wood' | 'square' | 'paved' | 'parking';
export interface OsmArea { id: string; kind: AreaKind; name?: string; rings: LngLat[][] }
export interface OsmGroundExtract {
  version: 1;
  box: string;
  centre: LngLat;
  fetched: string;
  attribution: string;
  ways: OsmWay[];
  areas: OsmArea[];
}

/** Tags (and their `:` sub-keys) the extract keeps; everything else is dropped at build time. */
export const KEPT_TAGS = ['highway', 'name', 'width', 'est_width', 'lanes', 'sidewalk', 'cycleway', 'surface', 'bridge', 'layer', 'tunnel', 'oneway', 'footway', 'area', 'service', 'bicycle', 'segregated', 'railway', 'embedded_rails', 'crossing', 'covered', 'level'];

export function areaKind(tags: Record<string, string>): AreaKind | null {
  if (tags['area:highway']) return 'paved';
  if (tags.place === 'square') return 'square';
  if (tags.highway && tags.area === 'yes') return tags.highway === 'pedestrian' ? 'square' : 'paved';
  if (tags.amenity === 'parking') return 'parking';
  if (['park', 'garden', 'common', 'playground'].includes(tags.leisure)) return 'park';
  if (tags.leisure === 'pitch') return 'grass';
  if (['grass', 'meadow', 'village_green', 'flowerbed', 'recreation_ground'].includes(tags.landuse)) return 'grass';
  if (tags.landuse === 'cemetery') return 'park';
  if (tags.natural === 'grass') return 'grass';
  if (tags.natural === 'scrub' || tags.natural === 'wood') return 'wood';
  return null;
}

export type Surface = 'asphalt' | 'klinker' | 'cycle' | 'paving' | 'gravel';
export type BandKind = 'carriageway' | 'cycle_lane' | 'cycle_track' | 'sidewalk' | 'footway' | 'cycleway' | 'path';

export interface Band {
  kind: BandKind;
  surface: Surface;
  /** Centre offset from the way's centreline, metres, positive = left of travel. */
  offset: number;
  width: number;
  /** Kerb height above the carriageway (raised sidewalks and tracks), metres. */
  raised: number;
  /** Which edges get a kerb face: the side toward the carriageway. */
  kerb: 'left' | 'right' | 'both' | 'none';
}

export interface PaintLine { offset: number; width: number; dash: [number, number] | null }

export interface CrossSection {
  bands: Band[];
  paint: PaintLine[];
  /** Half the carriageway (or the path itself) — junction discs and trims use it. */
  coreHalfWidth: number;
  /** Outermost extent either side. */
  halfWidth: number;
  source: { width: 'tag' | 'lanes' | 'prior'; sidewalk: 'tag' | 'prior'; cycleway: 'tag' | 'prior' };
}

const KERB_M = 0.11;
const SIDEWALK_M = 1.8;
const TRACK_M = 2.1;
const LANE_M = 1.6;

/** Carriageway priors per class (two-way, untagged), Amsterdam-typical. */
const CARRIAGEWAY: Record<string, { width: number; oneway: number; laneM: number; surface: Surface; sidewalks: boolean; centre: boolean }> = {
  motorway: { width: 11, oneway: 7.5, laneM: 3.5, surface: 'asphalt', sidewalks: false, centre: true },
  trunk: { width: 10, oneway: 7, laneM: 3.3, surface: 'asphalt', sidewalks: false, centre: true },
  primary: { width: 7, oneway: 6.5, laneM: 3.2, surface: 'asphalt', sidewalks: false, centre: true },
  secondary: { width: 6.5, oneway: 6, laneM: 3.1, surface: 'asphalt', sidewalks: false, centre: true },
  tertiary: { width: 6, oneway: 3.6, laneM: 3, surface: 'asphalt', sidewalks: true, centre: true },
  unclassified: { width: 5.5, oneway: 3.6, laneM: 2.8, surface: 'klinker', sidewalks: true, centre: false },
  residential: { width: 5.2, oneway: 4, laneM: 2.75, surface: 'klinker', sidewalks: true, centre: false },
  living_street: { width: 4.6, oneway: 4, laneM: 2.6, surface: 'klinker', sidewalks: false, centre: false },
  service: { width: 3.6, oneway: 3.2, laneM: 3, surface: 'klinker', sidewalks: false, centre: false },
  busway: { width: 6, oneway: 3.5, laneM: 3.2, surface: 'asphalt', sidewalks: false, centre: false },
  road: { width: 5, oneway: 3.6, laneM: 3, surface: 'asphalt', sidewalks: false, centre: false },
};
for (const k of ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']) CARRIAGEWAY[`${k}_link`] = CARRIAGEWAY[k];

/** Stand-alone paths: default width and look. */
const PATHS: Record<string, { width: number; kind: BandKind; surface: Surface }> = {
  cycleway: { width: 2.5, kind: 'cycleway', surface: 'cycle' },
  footway: { width: 2, kind: 'footway', surface: 'paving' },
  pedestrian: { width: 6, kind: 'footway', surface: 'paving' },
  path: { width: 2, kind: 'path', surface: 'paving' },
  steps: { width: 2, kind: 'footway', surface: 'paving' },
  track: { width: 3, kind: 'path', surface: 'gravel' },
  bridleway: { width: 2, kind: 'path', surface: 'gravel' },
};

export const SKIPPED_HIGHWAYS = new Set(['proposed', 'construction', 'platform', 'corridor', 'elevator', 'bus_stop', 'raceway', 'abandoned', 'disused', 'razed']);

export function parseMetres(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metres?)?\s*$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0.3 && n < 60 ? n : null;
}

function surfaceOf(tag: string | undefined, fallback: Surface, raised: boolean): Surface {
  if (!tag) return fallback;
  if (tag === 'asphalt') return fallback === 'cycle' ? 'cycle' : 'asphalt';
  if (['paving_stones', 'sett', 'bricks', 'brick', 'cobblestone', 'unhewn_cobblestone', 'paving_stones:30'].includes(tag)) return fallback === 'cycle' ? 'cycle' : raised || fallback === 'paving' ? 'paving' : 'klinker';
  if (tag === 'concrete' || tag.startsWith('concrete:')) return fallback === 'cycle' ? 'cycle' : 'paving';
  if (['unpaved', 'gravel', 'fine_gravel', 'compacted', 'dirt', 'ground', 'sand', 'earth', 'woodchips', 'pebblestone'].includes(tag)) return 'gravel';
  return fallback;
}

type Side = 'left' | 'right';
const sidesOf = (v: string | undefined): Side[] | null => {
  if (v === undefined) return null;
  if (v === 'both') return ['left', 'right'];
  if (v === 'left' || v === 'right') return [v];
  return [];
};

/** Per side: does this way carry a sidewalk / which cycle infrastructure (tags first, priors second). */
function sidewalkSides(tags: Record<string, string>, prior: boolean): { sides: Side[]; source: 'tag' | 'prior' } {
  const plain = sidesOf(tags.sidewalk);
  if (plain) return { sides: plain, source: 'tag' };
  const both = tags['sidewalk:both'];
  if (both !== undefined) return { sides: both === 'yes' ? ['left', 'right'] : [], source: 'tag' };
  const l = tags['sidewalk:left'], r = tags['sidewalk:right'];
  if (l !== undefined || r !== undefined) return { sides: [...(l === 'yes' ? ['left' as const] : []), ...(r === 'yes' ? ['right' as const] : [])], source: 'tag' };
  return { sides: prior ? ['left', 'right'] : [], source: 'prior' };
}

function cyclewaySides(tags: Record<string, string>): { left: string | null; right: string | null; source: 'tag' | 'prior' } {
  const norm = (v: string | undefined) => (v === 'lane' || v === 'opposite_lane' ? 'lane' : v === 'track' || v === 'opposite_track' ? 'track' : null);
  const all = tags.cycleway ?? tags['cycleway:both'];
  if (all !== undefined) {
    const k = norm(all);
    // A one-way street's plain `cycleway=lane` is usually on the right only; `both` means both.
    const oneway = tags.oneway === 'yes' && tags['cycleway:both'] === undefined && all !== 'opposite_lane';
    return { left: oneway ? null : k, right: k, source: 'tag' };
  }
  const l = tags['cycleway:left'], r = tags['cycleway:right'];
  if (l !== undefined || r !== undefined) return { left: norm(l), right: norm(r), source: 'tag' };
  return { left: null, right: null, source: 'prior' };
}

/** The bands of one way, or null when it should not be drawn on the ground (tunnels, platforms, areas). */
export function crossSection(tags: Record<string, string>): CrossSection | null {
  const hw = tags.highway;
  if (!hw || SKIPPED_HIGHWAYS.has(hw) || tags.area === 'yes') return null;
  if (tags.tunnel && tags.tunnel !== 'no' && tags.tunnel !== 'building_passage') return null;
  if (Number(tags.layer) < 0 && !tags.bridge) return null;
  if (tags.level && Number(tags.level) !== 0 && !tags.bridge) return null;
  const tagWidth = parseMetres(tags.width) ?? parseMetres(tags.est_width);
  const path = PATHS[hw];
  if (path) {
    let kind = path.kind, surface = path.surface;
    // A path the city signs for bikes looks like a cycle path; a mapped sidewalk is raised.
    if (hw === 'path' && tags.bicycle === 'designated') { kind = 'cycleway'; surface = 'cycle'; }
    const sidewalk = hw === 'footway' && tags.footway === 'sidewalk';
    const crossing = tags.footway === 'crossing' || tags.cycleway === 'crossing';
    surface = surfaceOf(tags.surface, surface, sidewalk);
    if (kind === 'cycleway' && tags.surface && tags.surface !== 'asphalt' && surface !== 'gravel') surface = 'cycle';
    const width = tagWidth ?? (hw === 'cycleway' && tags.oneway === 'yes' ? 2.1 : path.width);
    const band: Band = { kind: sidewalk ? 'sidewalk' : kind, surface, offset: 0, width, raised: sidewalk ? KERB_M : 0, kerb: sidewalk ? 'both' : 'none' };
    const marked = ['zebra', 'marked', 'uncontrolled'].includes(tags.crossing) || (!!tags['crossing:markings'] && tags['crossing:markings'] !== 'no');
    const paint: PaintLine[] = crossing && marked && !sidewalk && kind === 'footway' ? [{ offset: 0, width: Math.min(width, 3), dash: [0.5, 0.5] }] : [];
    return { bands: [band], paint, coreHalfWidth: width / 2, halfWidth: width / 2, source: { width: tagWidth ? 'tag' : 'prior', sidewalk: 'prior', cycleway: 'prior' } };
  }
  const style = CARRIAGEWAY[hw];
  if (!style) return null;
  const oneway = tags.oneway === 'yes' || tags.junction === 'roundabout';
  const lanes = Number(tags.lanes);
  const widthSource: CrossSection['source']['width'] = tagWidth ? 'tag' : lanes > 0 ? 'lanes' : 'prior';
  let carriage = tagWidth ?? (lanes > 0 ? lanes * style.laneM : oneway ? style.oneway : style.width);
  if (tags.service === 'alley' || tags.service === 'driveway') carriage = Math.min(carriage, 3);
  carriage = Math.max(2.4, Math.min(30, carriage));
  const bands: Band[] = [{ kind: 'carriageway', surface: surfaceOf(tags.surface, style.surface, false), offset: 0, width: carriage, raised: 0, kerb: 'none' }];
  const paint: PaintLine[] = [];
  const half = carriage / 2;
  const edge = { left: half, right: half };
  const cyc = cyclewaySides(tags);
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? 1 : -1, kind = cyc[side];
    if (kind === 'lane') {
      bands.push({ kind: 'cycle_lane', surface: 'cycle', offset: s * (edge[side] + LANE_M / 2), width: LANE_M, raised: 0, kerb: 'none' });
      paint.push({ offset: s * edge[side], width: 0.1, dash: [1, 1] });
      edge[side] += LANE_M;
    } else if (kind === 'track') {
      bands.push({ kind: 'cycle_track', surface: 'cycle', offset: s * (edge[side] + 0.4 + TRACK_M / 2), width: TRACK_M + 0.8, raised: 0.04, kerb: side });
      edge[side] += TRACK_M + 0.8;
    }
  }
  const sw = sidewalkSides(tags, style.sidewalks);
  for (const side of sw.sides) {
    const s = side === 'left' ? 1 : -1;
    const w = parseMetres(tags[`sidewalk:${side}:width`]) ?? parseMetres(tags['sidewalk:both:width']) ?? parseMetres(tags['sidewalk:width']) ?? SIDEWALK_M;
    bands.push({ kind: 'sidewalk', surface: 'paving', offset: s * (edge[side] + w / 2), width: w, raised: KERB_M, kerb: side });
    edge[side] += w;
  }
  const centre = (lanes >= 2 && !oneway) || (style.centre && !oneway && !lanes);
  if (centre) paint.push({ offset: 0, width: 0.12, dash: [3, 5] });
  if (hw.startsWith('primary') || hw.startsWith('secondary') || hw.startsWith('trunk')) {
    paint.push({ offset: half - 0.3, width: 0.12, dash: null }, { offset: -(half - 0.3), width: 0.12, dash: null });
  }
  return { bands, paint, coreHalfWidth: half, halfWidth: Math.max(edge.left, edge.right), source: { width: widthSource, sidewalk: sw.source, cycleway: cyc.source } };
}
