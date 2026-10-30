// OSM ground extract types and street cross-sections (pure).
//
// A street becomes parallel bands — carriageway, painted cycle lanes, raised
// cycle tracks, raised sidewalks — from its OSM tags. Where a tag is missing
// we use Amsterdam priors and say so (`source: 'prior'`), because a confident
// drawing of a guessed width teaches the wrong thing just as well as a right one.

export type LngLat = [number, number];

/**
 * `bw`: widths measured on BGT road surfaces at build time (bgtWidth.ts), in
 * decimetres: [own surface, footpath per side, cycle path per side], 0 = none found.
 */
export type BgtWidthDm = [number, number, number];
export interface OsmWay { id: number; tags: Record<string, string>; g: LngLat[]; bw?: BgtWidthDm }
export type AreaKind = 'park' | 'grass' | 'wood' | 'square' | 'paved' | 'parking';
/** `hw`: the `area:highway` value (or `highway` of an `area=yes` way) of a `paved` area; `surface`: its OSM surface tag. */
export interface OsmArea { id: string; kind: AreaKind; name?: string; rings: LngLat[][]; hw?: string; surface?: string }
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
export const KEPT_TAGS = ['highway', 'name', 'width', 'est_width', 'lanes', 'sidewalk', 'cycleway', 'surface', 'bridge', 'layer', 'tunnel', 'oneway', 'footway', 'area', 'service', 'bicycle', 'segregated', 'railway', 'embedded_rails', 'crossing', 'covered', 'level', 'cyclestreet', 'bicycle_road'];

export function areaKind(tags: Record<string, string>): AreaKind | null {
  if (tags['area:highway']) return 'paved';
  if (tags.place === 'square') return 'square';
  if (tags.highway && tags.area === 'yes') return tags.highway === 'pedestrian' ? 'square' : 'paved';
  if (tags.amenity === 'parking') return 'parking';
  if (['park', 'garden', 'common', 'playground'].includes(tags.leisure)) return 'park';
  if (tags.leisure === 'pitch') return 'grass';
  if (['grass', 'meadow', 'village_green', 'flowerbed', 'recreation_ground'].includes(tags.landuse)) return 'grass';
  if (tags.landuse === 'cemetery' || tags.landuse === 'allotments') return 'park';
  // Zoos and petting farms (ride review 2026-10-14: Artis read as a sand plaza): green ground under their own paths.
  if (tags.tourism === 'zoo') return 'park';
  if (tags.natural === 'grass') return 'grass';
  if (tags.natural === 'scrub' || tags.natural === 'wood') return 'wood';
  return null;
}

/**
 * The ground surface of a `paved` area by what OSM says it is: a carriageway area
 * (`area:highway=residential`, `tertiary`, ...) is asphalt (klinker when its surface
 * is brick or sett), a cycleway area is red cycle asphalt, platforms, traffic islands,
 * footways and steps are pavement tiles, a verge is grass, a parking space is parking,
 * and an area with no `hw` (or an unknown one) is square paving.
 */
export function pavedAreaSurface(a: Pick<OsmArea, 'hw' | 'surface'>): 'asphalt' | 'klinker' | 'cycle' | 'paving' | 'park' | 'parking' | 'square' {
  const hw = a.hw ?? '';
  if (hw === 'cycleway') return 'cycle';
  if (['footway', 'path', 'steps', 'platform', 'traffic_island', 'central_island', 'elevator'].includes(hw)) return 'paving';
  if (hw === 'verge') return 'park';
  if (hw === 'parking_space') return 'parking';
  const base = hw.replace(/_link$/, '');
  if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'busway', 'road', 'driveway', 'crossing', 'bus_bay', 'bus_stop', 'marking', 'emergency', 'prohibited'].includes(base)) {
    return a.surface && ['paving_stones', 'sett', 'bricks', 'brick', 'cobblestone', 'unhewn_cobblestone'].includes(a.surface) ? 'klinker' : 'asphalt';
  }
  return 'square';
}

export type Surface = 'asphalt' | 'klinker' | 'cycle' | 'paving' | 'gravel';

/**
 * The surface classes the own ground draws, and what puts a band in each
 * (user 2026-10-14, Houtmankade: "why road on one side and red on the other
 * side?"). Five meshes (`Surface`), six classes: a fietsstraat is a
 * carriageway in the red asphalt mesh, drawn as a road (edge lines, no
 * centre line), never as a cycle path beside one.
 *
 *   asphalt     grey asphalt carriageway: `surface=asphalt` or the class prior
 *               of tertiary and up (BGT rijbaan, gesloten verharding)
 *   cycle       red asphalt cycle path, lane or track: `highway=cycleway`,
 *               `cycleway*=lane|track`, `path` + `bicycle=designated`
 *   fietsstraat red asphalt carriageway: `cyclestreet=yes`, `bicycle_road=yes`
 *               or `surface:colour=red` on a road whose surface is asphalt or
 *               untagged; mesh `cycle`, band kind carriageway
 *   brick       klinker carriageway (gebakken klinkers, herringbone, mixed
 *               tones): `surface=paving_stones|sett|bricks|cobblestone`, or the
 *               prior of residential / unclassified / living_street / service
 *               (BGT rijbaan lokale weg, open verharding); mesh `klinker`
 *   concrete    paving tiles: sidewalks, footways, concrete; mesh `paving`
 *   gravel      unpaved: `gravel|compacted|dirt|ground|...`; mesh `gravel`
 */
export type SurfaceClass = 'asphalt' | 'cycle' | 'fietsstraat' | 'brick' | 'concrete' | 'gravel';
export const SURFACE_LEGEND: Record<SurfaceClass, { mesh: Surface; road: boolean; what: string }> = {
  asphalt: { mesh: 'asphalt', road: true, what: 'grey asphalt carriageway' },
  cycle: { mesh: 'cycle', road: false, what: 'red asphalt cycle path, lane or track' },
  fietsstraat: { mesh: 'cycle', road: true, what: 'red asphalt carriageway (fietsstraat): edge lines, no centre line' },
  brick: { mesh: 'klinker', road: true, what: 'klinker (brick) carriageway, herringbone' },
  concrete: { mesh: 'paving', road: false, what: 'paving tiles: sidewalks, footways, concrete' },
  gravel: { mesh: 'gravel', road: false, what: 'unpaved: gravel, compacted, dirt' },
};

/** Is this carriageway a fietsstraat (red asphalt road)? A brick one stays brick. */
export function isFietsstraat(tags: Record<string, string>): boolean {
  const flagged = tags.cyclestreet === 'yes' || tags.bicycle_road === 'yes' || tags['surface:colour'] === 'red';
  return flagged && (!tags.surface || tags.surface === 'asphalt');
}

/** The legend class of a carriageway's own surface. */
export function carriagewayClass(tags: Record<string, string>, prior: Surface): SurfaceClass {
  if (isFietsstraat(tags)) return 'fietsstraat';
  const s = surfaceOf(tags.surface, prior, false);
  return s === 'klinker' ? 'brick' : s === 'paving' ? 'concrete' : s === 'gravel' ? 'gravel' : s === 'cycle' ? 'cycle' : 'asphalt';
}
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

/** `mapped`: the way itself is mapped as the marked crossing (crossing / crossing:markings tags); every other line is
 *  a class prior (centre and edge lines, lane and track edges) and draws only with GUESSED_PAINT (roadMarkings.ts). */
export interface PaintLine { offset: number; width: number; dash: [number, number] | null; mapped?: true }

export interface CrossSection {
  bands: Band[];
  paint: PaintLine[];
  /** Tram track centre offsets (OSM `embedded_rails=tram`); each track is two rails at standard gauge. */
  rails: number[];
  /** Half the carriageway (or the path itself) — junction discs and trims use it. */
  coreHalfWidth: number;
  /** Outermost extent either side. */
  halfWidth: number;
  source: { width: 'bgt' | 'tag' | 'lanes' | 'prior'; sidewalk: 'bgt' | 'tag' | 'prior'; cycleway: 'bgt' | 'tag' | 'prior'; /** Which sides carry a sidewalk: from tags, or the class prior (then a mapped neighbour may veto one). */ sidewalkSides?: 'tag' | 'prior' };
}

const KERB_M = 0.11;
/**
 * Longitudinal road lines (centre dashes, edge lines, cycle-lane edges), metres. Painted 0.10–0.15 m;
 * drawn at the top of that range: from the chase camera (~150 m) a pixel is ~0.2 m, and 0.10–0.12 m
 * lines aliased into broken specks (user 2026-10-14, "road painting in ownground still not there").
 */
export const PAINT_LINE_M = 0.15;
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
export function crossSection(tags: Record<string, string>, bw?: BgtWidthDm): CrossSection | null {
  const hw = tags.highway;
  if (!hw || SKIPPED_HIGHWAYS.has(hw) || tags.area === 'yes') return null;
  if (tags.tunnel && tags.tunnel !== 'no' && tags.tunnel !== 'building_passage') return null;
  if (Number(tags.layer) < 0 && !tags.bridge) return null;
  if (tags.level && Number(tags.level) !== 0 && !tags.bridge) return null;
  const tagWidth = parseMetres(tags.width) ?? parseMetres(tags.est_width);
  // Measured BGT widths win over tags and priors (survey polygons, not guesses).
  let bgtWidth = bw && bw[0] >= 8 ? bw[0] / 10 : null;
  const bgtSidewalk = bw && bw[1] >= 5 ? Math.min(bw[1] / 10, 6) : null;
  const bgtCycle = bw && bw[2] >= 10 ? Math.max(1.2, Math.min(bw[2] / 10, 4)) : null;
  const path = PATHS[hw];
  // A BGT width read inside a junction measures the junction (De Clercqstraat: a 30 m tertiary stub at
  // 21.3 m, a cycleway at 14.2 m): cap it at what the way's class and lanes can hold, or a tagged width.
  if (bgtWidth) {
    const cap = path ? (hw === 'pedestrian' ? 30 : hw === 'cycleway' || (hw === 'path' && tags.bicycle === 'designated') ? 4.5 : 6)
      : ((Number(tags.lanes) > 0 ? Number(tags.lanes) : tags.oneway === 'yes' ? 1 : 2) * 3.75 + 1.5);
    if (path && tagWidth && bgtWidth > tagWidth * 1.8) bgtWidth = null;
    else if (bgtWidth > cap) bgtWidth = cap;
  }
  if (path) {
    let kind = path.kind, surface = path.surface;
    // A path the city signs for bikes looks like a cycle path; a mapped sidewalk is raised.
    if (hw === 'path' && tags.bicycle === 'designated') { kind = 'cycleway'; surface = 'cycle'; }
    const sidewalk = hw === 'footway' && tags.footway === 'sidewalk';
    const crossing = tags.footway === 'crossing' || tags.cycleway === 'crossing';
    surface = surfaceOf(tags.surface, surface, sidewalk);
    if (kind === 'cycleway' && tags.surface && tags.surface !== 'asphalt' && surface !== 'gravel') surface = 'cycle';
    const width = bgtWidth ? Math.min(bgtWidth, 30) : tagWidth ?? (hw === 'cycleway' && tags.oneway === 'yes' ? 2.1 : path.width);
    const band: Band = { kind: sidewalk ? 'sidewalk' : kind, surface, offset: 0, width, raised: sidewalk ? KERB_M : 0, kerb: sidewalk ? 'both' : 'none' };
    const marked = ['zebra', 'marked', 'uncontrolled'].includes(tags.crossing) || (!!tags['crossing:markings'] && tags['crossing:markings'] !== 'no');
    const paint: PaintLine[] = crossing && marked && !sidewalk && kind === 'footway' ? [{ offset: 0, width: Math.min(width, 3), dash: [0.5, 0.5], mapped: true }] : [];
    // A cycle crossing is red only where OSM says so; otherwise the road shows through between
    // the white block markings (blokmarkering) along both edges.
    if (tags.cycleway === 'crossing' && tags['surface:colour'] !== 'red') {
      const e = Math.max(0.6, Math.min(width, 4) / 2 - 0.2);
      paint.push({ offset: e, width: 0.4, dash: [0.4, 0.4], mapped: true }, { offset: -e, width: 0.4, dash: [0.4, 0.4], mapped: true });
    }
    // A separated cycle path: a clean white edge line either side (not on crossings or narrow paths).
    if (kind === 'cycleway' && !crossing && width >= 1.5) paint.push({ offset: width / 2 - 0.15, width: 0.08, dash: null }, { offset: -(width / 2 - 0.15), width: 0.08, dash: null });
    return { bands: [band], paint, rails: [], coreHalfWidth: width / 2, halfWidth: width / 2, source: { width: bgtWidth ? 'bgt' : tagWidth ? 'tag' : 'prior', sidewalk: 'prior', cycleway: 'prior' } };
  }
  const style = CARRIAGEWAY[hw];
  if (!style) return null;
  const oneway = tags.oneway === 'yes' || tags.junction === 'roundabout';
  const lanes = Number(tags.lanes);
  const cyc = cyclewaySides(tags);
  // BGT's rijbaan includes painted cycle lanes (they are markings, not polygons): take them off.
  const laneSides = (cyc.left === 'lane' ? 1 : 0) + (cyc.right === 'lane' ? 1 : 0);
  const widthSource: CrossSection['source']['width'] = bgtWidth ? 'bgt' : tagWidth ? 'tag' : lanes > 0 ? 'lanes' : 'prior';
  let carriage = bgtWidth ? bgtWidth - laneSides * LANE_M : tagWidth ?? (lanes > 0 ? lanes * style.laneM : oneway ? style.oneway : style.width);
  if (!bgtWidth && (tags.service === 'alley' || tags.service === 'driveway')) carriage = Math.min(carriage, 3);
  carriage = Math.max(2.4, Math.min(30, carriage));
  const cls = carriagewayClass(tags, style.surface);
  const bands: Band[] = [{ kind: 'carriageway', surface: SURFACE_LEGEND[cls].mesh, offset: 0, width: carriage, raised: 0, kerb: 'none' }];
  const paint: PaintLine[] = [];
  const half = carriage / 2;
  const edge = { left: half, right: half };
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? 1 : -1, kind = cyc[side];
    if (kind === 'lane') {
      bands.push({ kind: 'cycle_lane', surface: 'cycle', offset: s * (edge[side] + LANE_M / 2), width: LANE_M, raised: 0, kerb: 'none' });
      paint.push({ offset: s * edge[side], width: PAINT_LINE_M, dash: [1, 1] });
      edge[side] += LANE_M;
    } else if (kind === 'track') {
      const track = bgtCycle ?? TRACK_M;
      bands.push({ kind: 'cycle_track', surface: 'cycle', offset: s * (edge[side] + 0.4 + track / 2), width: track + 0.8, raised: 0.04, kerb: side });
      const mid = s * (edge[side] + 0.4 + track / 2);
      paint.push({ offset: mid + track / 2 - 0.1, width: 0.08, dash: null }, { offset: mid - track / 2 + 0.1, width: 0.08, dash: null });
      edge[side] += track + 0.8;
    }
  }
  const sw = sidewalkSides(tags, style.sidewalks);
  for (const side of sw.sides) {
    const s = side === 'left' ? 1 : -1;
    const w = bgtSidewalk ?? parseMetres(tags[`sidewalk:${side}:width`]) ?? parseMetres(tags['sidewalk:both:width']) ?? parseMetres(tags['sidewalk:width']) ?? SIDEWALK_M;
    bands.push({ kind: 'sidewalk', surface: 'paving', offset: s * (edge[side] + w / 2), width: w, raised: KERB_M, kerb: side });
    edge[side] += w;
  }
  // No centre line on a one-way street or a fietsstraat (cyclestreet / bicycle_road): it is one lane.
  const cycleStreet = tags.cyclestreet === 'yes' || tags.bicycle_road === 'yes' || cls === 'fietsstraat';
  const centre = !cycleStreet && ((lanes >= 2 && !oneway) || (style.centre && !oneway && !lanes));
  if (centre) paint.push({ offset: 0, width: PAINT_LINE_M, dash: [3, 5] });
  if (hw.startsWith('primary') || hw.startsWith('secondary') || hw.startsWith('trunk') || cls === 'fietsstraat') {
    paint.push({ offset: half - 0.3, width: PAINT_LINE_M, dash: null }, { offset: -(half - 0.3), width: PAINT_LINE_M, dash: null });
  }
  // Tram tracks in the street: two-way (or two-way for buses and trams) streets carry a track each way, 3 m apart.
  const rails: number[] = [];
  if ((tags.embedded_rails ?? '').split(';').includes('tram')) {
    // Measured track offsets (patch-osm-trams.ts from BGT spoor, lane road-look-continuity 2026-10-29): the tracks
    // where they lie, left of the way positive, a few metres off the centreline on streets with a median track bed.
    const measured = (tags['embedded_rails:offsets'] ?? '').split(';').map(Number).filter(v => tags['embedded_rails:offsets'] && Number.isFinite(v) && Math.abs(v) <= 12);
    const both = !oneway || tags['oneway:bus'] === 'no' || tags['oneway:psv'] === 'no';
    if (measured.length) rails.push(...measured);
    else if (both && carriage >= 5.5) rails.push(1.5, -1.5); else rails.push(0);
  }
  return { bands, paint, rails, coreHalfWidth: half, halfWidth: Math.max(edge.left, edge.right), source: { width: widthSource, sidewalk: bgtSidewalk && sw.sides.length ? 'bgt' : sw.source, cycleway: bgtCycle && (cyc.left === 'track' || cyc.right === 'track') ? 'bgt' : cyc.source, sidewalkSides: sw.source } };
}
