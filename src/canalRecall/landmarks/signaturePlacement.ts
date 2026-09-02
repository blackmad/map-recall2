// Where a signature landmark model stands, and how big it is.
//
// The city-wide building layer is OSM footprints extruded to an OSM height. It
// is honest about *where* a building is and vague about what it looks like. A
// signature model is the opposite: it knows exactly what the Royal Palace looks
// like and nothing at all about where the Dam is. This module is the join.
//
// Everything here is arithmetic on a footprint ring and a model bounding box,
// so the alignment can be asserted against measured metres instead of eyeballed
// against a screenshot. The runtime layer (`signature-landmarks-source.js`)
// only consumes the transform this produces.

/** `[latitude, longitude]`, the order the Amsterdam extracts use. */
export type LatLng = readonly [number, number];

/** `[longitude, latitude]`, the order MapLibre and GeoJSON use. */
export type LngLat = readonly [number, number];

/** Metres per degree of latitude. Constant enough over one city. */
const METRES_PER_DEGREE_LATITUDE = 111_320;

/** A rectangle fitted to a building footprint: where its centre is, which way
 *  its long side points, and how big it is on the ground. */
export interface OrientedFootprint {
  /** Centre of the fitted rectangle, not the centroid of the ring. For a
   *  U-shaped or courtyard building those differ by metres. */
  readonly centre: LngLat;
  /** Compass bearing of the long side, degrees clockwise from north, folded
   *  into `[0, 180)` — a rectangle's long axis has no front or back. */
  readonly headingDegrees: number;
  /** Length of the long side, metres. */
  readonly lengthMetres: number;
  /** Length of the short side, metres. */
  readonly widthMetres: number;
}

/** The axis-aligned extent of a model in its own coordinates, as glTF reports
 *  it: Y up, metres, after the node transforms have been baked in. */
export interface ModelBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/**
 * A model that arrives already georeferenced and life-size, so it is placed by
 * its own published anchor rather than fitted to a footprint.
 */
export interface SurveyedAnchor {
  /** The publisher's own `[lng, lat]` for the model's origin. */
  readonly anchor: LngLat;
  /** Correction, in degrees clockwise, if a model is not actually north-up.
   *  Normally zero — geo-located SketchUp models are north-up by construction. */
  readonly northOffsetDegrees: number;
  /** Where the anchor came from, so a wrong building can be traced back. */
  readonly source: string;
}

/** A curated model, everything needed to fetch it, place it, credit it, and
 *  know which extruded footprint it is standing in for. */
export interface SignatureModelSpec {
  /** Set when the model is life-size and georeferenced. Its presence switches
   *  placement from "fit to the footprint" to "trust the survey", and tells
   *  the renderer to leave the mesh on its own origin instead of centring it. */
  readonly surveyed?: SurveyedAnchor;
  /** Stable id for this placement, used in the manifest and in tests. */
  readonly id: string;
  /** Human name, shown in the attribution panel. */
  readonly name: string;
  /** The landmark extract entry this model represents, so the existing card,
   *  highlight and camera behaviour keep working unchanged. */
  readonly landmarkId: string;
  /** Runtime GLB, relative to the Canal Recall page. */
  readonly modelUrl: string;
  /** OSM ways whose extrusion must be hidden once the model is drawn. Hiding
   *  is keyed on the way id rather than on a spatial test so that a partly
   *  loaded tile can never leave both geometries visible. */
  readonly suppressOsmIds: readonly number[];
  /** The footprint the model is fitted to. Required for a fitted model; for a
   *  surveyed one it is only ever reported, and several municipal models cover
   *  landmarks the extract holds as a point with no ring. */
  readonly footprint?: OrientedFootprint;
  /** Real-world height in metres of the highest point of the building — for
   *  the Palace, the tip of the cupola weathervane, not the roof ridge. The
   *  model is fitted to its footprint width, so this is the cross-check on
   *  that fit rather than an input to it. */
  readonly heightMetres?: number;
  /** How far the fitted height may fall from `heightMetres` before the model
   *  is treated as the wrong shape for this footprint. */
  readonly heightToleranceMetres?: number;
  /** Ground elevation in metres above the ellipsoid at the anchor. Amsterdam
   *  is flat and close to NAP zero, but MapLibre wants an altitude and the
   *  wrong one sinks or floats the model visibly at low camera angles. */
  readonly groundAltitudeMetres: number;
  /** Extra rotation, degrees clockwise, applied after the footprint heading.
   *  A fitted rectangle cannot tell a facade from its back wall; this is where
   *  a human says which way round the model goes. */
  readonly facingOffsetDegrees: number;
  readonly attribution: SignatureModelAttribution;
}

/** Licence provenance. Kept beside the placement rather than in a README so
 *  that a model can never ship without the credit it requires. */
export interface SignatureModelAttribution {
  readonly title: string;
  readonly author: string;
  readonly sourceUrl: string;
  readonly licence: string;
  readonly licenceUrl: string;
  /** What was changed, if anything. CC BY and CC BY-SA both require modified
   *  copies to say so; ND models are only ever format-converted. */
  readonly modifications: string;
}

/** The transform the runtime applies: where to put the model, how much to turn
 *  it, and how much to scale it so it fills its measured footprint. */
export interface SignaturePlacement {
  readonly anchor: LngLat;
  readonly altitudeMetres: number;
  /**
   * How far to rotate the mesh about the vertical axis, degrees clockwise, so
   * that its wide side lies along the footprint's long side. This is what the
   * renderer applies.
   */
  readonly modelRotationDegrees: number;
  /**
   * The compass bearing the front of the building ends up facing. Not used by
   * the renderer — it is the human-checkable half of the rotation, because
   * "the Palace faces east onto the Dam" is a fact someone can verify and
   * "rotate the mesh 1.4°" is not.
   */
  readonly facadeBearingDegrees: number;
  /** Single uniform factor. Non-uniform scaling would stretch a facade's
   *  windows and is never correct for a real building. */
  readonly scale: number;
}

/** Metres per degree of longitude at a latitude. */
export function metresPerDegreeLongitude(latitude: number): number {
  return METRES_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);
}

/** Great-circle-ish distance in metres between two `[lat, lng]` points. Local
 *  flat-earth is accurate to well under a centimetre over a building. */
export function metresBetween(a: LatLng, b: LatLng): number {
  const midLatitude = (a[0] + b[0]) / 2;
  const dy = (b[0] - a[0]) * METRES_PER_DEGREE_LATITUDE;
  const dx = (b[1] - a[1]) * metresPerDegreeLongitude(midLatitude);
  return Math.hypot(dx, dy);
}

/**
 * Fits the smallest-area rectangle to a footprint ring.
 *
 * Rotating callipers on the convex hull would be the textbook answer; for a
 * 15-point building ring, testing every hull edge as a candidate axis is the
 * same result for less code. The minimum-area rectangle is the right fit
 * rather than an axis-aligned box because Amsterdam's grid is not aligned to
 * north — the Palace sits about 13° off, and an axis-aligned box would
 * over-report its footprint by a fifth and place the model too large.
 */
export function fitOrientedFootprint(ring: readonly LatLng[]): OrientedFootprint {
  const points = dedupeRing(ring);
  if (points.length < 3) {
    throw new Error(`A footprint needs at least three distinct points, got ${points.length}`);
  }
  const originLatitude = points[0][0];
  const metresPerLongitude = metresPerDegreeLongitude(originLatitude);
  // Work in local metres so that "area" and "length" mean what they say.
  const planar = points.map(([lat, lng]) => [
    (lng - points[0][1]) * metresPerLongitude,
    (lat - points[0][0]) * METRES_PER_DEGREE_LATITUDE,
  ] as const);

  const hull = convexHull(planar);
  let best: { area: number; angle: number; cx: number; cy: number; length: number; width: number } | null = null;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * cos - y * sin;
      const v = x * sin + y * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const extentU = maxU - minU;
    const extentV = maxV - minV;
    const area = extentU * extentV;
    if (best && area >= best.area) continue;
    // Rectangle centre, rotated back into local metres.
    const midU = (minU + maxU) / 2;
    const midV = (minV + maxV) / 2;
    best = {
      area,
      angle,
      cx: midU * Math.cos(angle) - midV * Math.sin(angle),
      cy: midU * Math.sin(angle) + midV * Math.cos(angle),
      length: Math.max(extentU, extentV),
      width: Math.min(extentU, extentV),
    };
    // `angle` describes the U axis; if V is the longer side the long axis is
    // perpendicular to it.
    if (extentV > extentU) best.angle = angle + Math.PI / 2;
  }
  const fitted = best as NonNullable<typeof best>;
  return {
    centre: [
      points[0][1] + fitted.cx / metresPerLongitude,
      points[0][0] + fitted.cy / METRES_PER_DEGREE_LATITUDE,
    ],
    headingDegrees: bearingFromPlanarAngle(fitted.angle),
    lengthMetres: fitted.length,
    widthMetres: fitted.width,
  };
}

/** Converts a maths angle (radians, counter-clockwise from +x/east) into a
 *  compass bearing folded into `[0, 180)`. */
function bearingFromPlanarAngle(angle: number): number {
  const degrees = 90 - (angle * 180) / Math.PI;
  const folded = ((degrees % 180) + 180) % 180;
  // Fold 180 back to 0 so the range is genuinely half-open.
  return folded === 180 ? 0 : folded;
}

/** Drops consecutive duplicates and the repeated closing vertex. */
function dedupeRing(ring: readonly LatLng[]): LatLng[] {
  const points: LatLng[] = [];
  for (const point of ring) {
    const last = points[points.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    points.push(point);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points;
}

/** Andrew's monotone chain. Returns counter-clockwise hull points. */
function convexHull(points: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (sorted.length < 3) return sorted;
  const cross = (
    o: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number],
  ): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (input: (readonly [number, number])[]): (readonly [number, number])[] => {
    const chain: (readonly [number, number])[] = [];
    for (const point of input) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
        chain.pop();
      }
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/** The three axis extents of a model, in its own units. */
export function modelExtent(bounds: ModelBounds): { width: number; height: number; depth: number } {
  const x = bounds.max[0] - bounds.min[0];
  const y = bounds.max[1] - bounds.min[1];
  const z = bounds.max[2] - bounds.min[2];
  // glTF is Y-up. Of the two ground axes the longer one is the facade: a
  // building's street frontage is its long side, which is also the axis the
  // fitted footprint rectangle calls its length.
  return { width: Math.max(x, z), height: y, depth: Math.min(x, z) };
}

/**
 * The scale that makes a model as wide as its surveyed footprint.
 *
 * Facade width is the dimension to fit, for a reason specific to how these
 * assets are built. Photo-derived and AI-generated reconstructions see a
 * building's front honestly — that is what the photographs show — and guess at
 * its depth, usually badly. Height is a second-hand number: the Royal Palace's
 * own encyclopedia entry claims 90 m for a building a little over 50 m tall.
 * The footprint, by contrast, is surveyed, is already in this repository, and
 * is the thing the model has to sit inside without gaps at either end of the
 * street frontage.
 *
 * Fitting width also cross-checks the height: scaled this way the Palace's
 * cupola lands at 53.6 m, which agrees with the real building and refutes the
 * published 90 m.
 */
export function scaleToFootprintWidth(bounds: ModelBounds, footprint: OrientedFootprint): number {
  const { width } = modelExtent(bounds);
  if (!(width > 0)) throw new Error(`Model has no horizontal extent: ${width}`);
  return footprint.lengthMetres / width;
}

/** The scale that would instead make a model as tall as a given height. Kept as
 *  the cross-check on a fitted width, not as the primary fit. */
export function scaleToHeight(bounds: ModelBounds, heightMetres: number): number {
  const { height } = modelExtent(bounds);
  if (!(height > 0)) throw new Error(`Model has no vertical extent: ${height}`);
  return heightMetres / height;
}

/** What a scaled model actually measures on the ground and in the air. */
export interface ScaledExtent {
  readonly widthMetres: number;
  readonly heightMetres: number;
  readonly depthMetres: number;
  /** Scaled depth over the footprint's depth. Below 1 the model does not reach
   *  the back of its own footprint and will leave a notch in the block; above
   *  1 it overhangs its neighbours. Either way it is a review signal. */
  readonly depthCoverage: number;
}

export function scaledExtent(
  bounds: ModelBounds,
  scale: number,
  footprint: OrientedFootprint,
): ScaledExtent {
  const extent = modelExtent(bounds);
  const depthMetres = extent.depth * scale;
  return {
    widthMetres: extent.width * scale,
    heightMetres: extent.height * scale,
    depthMetres,
    depthCoverage: depthMetres / footprint.widthMetres,
  };
}

/**
 * Resolves a spec into the transform the runtime layer applies.
 *
 * The anchor is not the footprint's centre when the model is shallower than
 * its footprint. A model that does not reach the back of the plot has to give
 * up its gap somewhere, and the right place to give it up is behind: the front
 * facade is the recognisable face and the one that has to line up with the
 * square it stands on. So the model is pushed forward until its front plane
 * meets the front edge of the footprint, and the shortfall is left at the rear
 * where it faces a side street.
 */
export function placementFor(spec: SignatureModelSpec, bounds: ModelBounds): SignaturePlacement {
  // A surveyed model is not fitted to anything: it already knows where it is.
  if (spec.surveyed) return surveyedPlacement(spec, spec.surveyed);
  if (!spec.footprint) {
    throw new Error(`"${spec.id}" is neither surveyed nor given a footprint to fit to.`);
  }
  const scale = scaleToFootprintWidth(bounds, spec.footprint);
  const extent = scaledExtent(bounds, scale, spec.footprint);
  // Which way the front ends up pointing: a quarter turn off the long axis,
  // to whichever side the spec says the street is on.
  const facadeBearingDegrees = normaliseBearing(
    spec.footprint.headingDegrees + spec.facingOffsetDegrees,
  );
  // The mesh's wide side has to end up along the footprint's long side, which
  // is a quarter turn back from the facing direction. Deriving it this way
  // rather than from the footprint heading directly means that flipping a
  // backwards model (facingOffset −90 instead of +90) turns the mesh with it.
  const modelRotationDegrees = normaliseBearing(facadeBearingDegrees - 90);
  // Half the depth shortfall, moved along the facing direction.
  const forwardMetres = Math.max(0, (spec.footprint.widthMetres - extent.depthMetres) / 2);
  return {
    anchor: offsetByMetres(spec.footprint.centre, facadeBearingDegrees, forwardMetres),
    altitudeMetres: spec.groundAltitudeMetres,
    modelRotationDegrees,
    facadeBearingDegrees,
    scale,
  };
}

/**
 * Placement for a model that was surveyed rather than sculpted.
 *
 * The City of Amsterdam's models arrive already solved: life-size in metres,
 * with their own origin at a published latitude and longitude, and — like
 * every geo-located SketchUp model — with the model's +Y axis on true north.
 * Fitting one to a footprint would be throwing away better information than
 * the fit could ever recover, and would actively make it worse: the Palace's
 * bounding box is 85.1 × 73.1 m against a 80.98 × 65.49 m OSM ring, because
 * the survey includes the entrance steps and the roof overhang that the wall
 * line does not. Fitting the box to the ring would shrink the whole building
 * by about 6% to make its overhangs fit inside its walls.
 *
 * So scale is exactly 1 and the anchor is the published point. The rotation is
 * 90° because that is this codebase's way of saying "the mesh's +X axis points
 * east": SketchUp's north-up +Y becomes glTF's −Z, which leaves +X on east
 * with no turn applied at all.
 */
function surveyedPlacement(
  spec: SignatureModelSpec,
  surveyed: SurveyedAnchor,
): SignaturePlacement {
  return {
    anchor: surveyed.anchor,
    altitudeMetres: spec.groundAltitudeMetres,
    modelRotationDegrees: normaliseBearing(90 + surveyed.northOffsetDegrees),
    facadeBearingDegrees: spec.footprint
      ? normaliseBearing(spec.footprint.headingDegrees + spec.facingOffsetDegrees)
      : normaliseBearing(spec.facingOffsetDegrees),
    scale: 1,
  };
}

/** Moves a `[lng, lat]` point a distance along a compass bearing. */
export function offsetByMetres(point: LngLat, bearingDegrees: number, metres: number): LngLat {
  if (metres === 0) return point;
  const radians = (bearingDegrees * Math.PI) / 180;
  const northMetres = Math.cos(radians) * metres;
  const eastMetres = Math.sin(radians) * metres;
  return [
    point[0] + eastMetres / metresPerDegreeLongitude(point[1]),
    point[1] + northMetres / METRES_PER_DEGREE_LATITUDE,
  ];
}

/** Folds a bearing into `[0, 360)`. */
export function normaliseBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Ray-casting point-in-ring test on `[lng, lat]` pairs. Degrees are not
 *  metres, but a ring crossing test only cares about topology, so working in
 *  degrees directly is exact here. */
export function pointInRing(point: LngLat, ring: readonly LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

/** The fitted rectangle as a closed GeoJSON ring, corners clockwise from the
 *  back-left. The pad is small and positive: a basemap footprint is
 *  generalised and can sit a metre or two outside the surveyed OSM ring, and a
 *  sliver of grey box left standing along one wall is as bad as the whole box. */
export function footprintPolygon(footprint: OrientedFootprint, padMetres = 0): LngLat[] {
  const halfLength = footprint.lengthMetres / 2 + padMetres;
  const halfWidth = footprint.widthMetres / 2 + padMetres;
  const alongAxis = footprint.headingDegrees;
  const acrossAxis = footprint.headingDegrees + 90;
  const corners: LngLat[] = [];
  for (const [along, across] of [
    [+halfLength, -halfWidth],
    [+halfLength, +halfWidth],
    [-halfLength, +halfWidth],
    [-halfLength, -halfWidth],
  ] as const) {
    corners.push(
      offsetByMetres(offsetByMetres(footprint.centre, alongAxis, along), acrossAxis, across),
    );
  }
  corners.push(corners[0]);
  return corners;
}

/** The GeoJSON polygon feature a MapLibre `clip` layer needs to cut a
 *  signature model's footprint out of the extruded basemap. */
export function footprintClipFeature(footprints: readonly OrientedFootprint[], padMetres = 2): unknown {
  return {
    type: 'FeatureCollection',
    features: footprints.map(footprint => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [footprintPolygon(footprint, padMetres).map(point => [point[0], point[1]])],
      },
    })),
  };
}
