/**
 * "Locate on map" hints that point at things a player knows: the district,
 * the river, the neighbouring area, the museum inside it. They go from broad
 * to specific; compass bearings from the search centre are only the fallback
 * when the extract has nothing nearby worth naming (user request 2026-10-02).
 *
 * A hint never names the answer, nor any place whose name contains it:
 * "next to Weesperplein" would give Weesperbuurt away.
 */
import { flatName, inArea } from './trivia';

type LatLon = [number, number];

export interface HintReference {
  name: string;
  kind: 'water' | 'landmark' | 'square' | 'park' | 'area';
  /** How well known: Wikidata sitelinks for places, a fixed rank for areas. */
  fame: number;
  center: LatLon;
  lines?: LatLon[][];
  polygons?: LatLon[][][];
  /** Boundary kind for areas: suburb, quarter, neighbourhood. */
  areaKind?: string;
}

export interface HintTarget {
  name: string;
  type: string;
  center: LatLon;
  path?: LatLon[];
  paths?: LatLon[][];
  areaGeometry?: LatLon[][][];
}

export type LocateHintKind = 'district' | 'water' | 'part-of' | 'borders' | 'near' | 'inside';
export interface LocateHint { kind: LocateHintKind; text: string; reference: string }

interface ExtractPlace {
  name?: string;
  type?: string;
  center?: LatLon;
  path?: LatLon[];
  paths?: LatLon[][];
  wikidata?: string;
  wikidataSitelinks?: number;
}
interface ExtractArea { name?: string; kind?: string; geometry?: LatLon[][][] }

// Measured on the Amsterdam extract: these keep the Amstel, the IJ and the
// grachten, Rijksmuseum to Montelbaanstoren, Dam and Leidseplein, and drop the
// hundreds of places nobody navigates by.
const MIN_FAME = { water: 3, landmark: 8, square: 3, park: 4 } as const;
/** Water this well known is worth naming from a distance ("west of the Amstel"). */
const FAR_WATER_FAME = 10;
/**
 * Sitelinks were never fetched for about a third of the linked waters, among
 * them Prinsengracht and Keizersgracht; a Wikidata item alone counts as this.
 */
const LINKED_WATER_FAME = 3;
const LANDMARK_TYPES = new Set(['landmark', 'museum', 'music venue', 'cinema']);
const AREA_FAME: Record<string, number> = { suburb: 10, quarter: 8, neighbourhood: 6, neighborhood: 6 };
const LINE_TYPES = new Set(['street', 'avenue', 'boulevard', 'canal', 'water']);
/** Names that read wrong with "the" in front. */
const NO_ARTICLE = new Set(['artis', 'nemo', 'micropia', 'madametussaudsamsterdam']);

/** The well-known places, waters and areas of an extract city, as hint references. */
export function hintReferencesFrom(files: {
  water?: readonly ExtractPlace[] | null;
  landmarks?: readonly ExtractPlace[] | null;
  squares?: readonly ExtractPlace[] | null;
  parks?: readonly ExtractPlace[] | null;
  areas?: readonly ExtractArea[] | null;
}): HintReference[] {
  const byName = new Map<string, HintReference>();
  const add = (reference: HintReference) => {
    const key = flatName(reference.name);
    const existing = byName.get(key);
    if (!existing || existing.fame < reference.fame) byName.set(key, reference);
  };
  const place = (kind: 'water' | 'landmark' | 'square' | 'park', item: ExtractPlace) => {
    const fame = item.wikidataSitelinks ?? (kind === 'water' && item.wikidata ? LINKED_WATER_FAME : 0);
    if (!item.name || !item.center || fame < MIN_FAME[kind]) return;
    // Locks, culverts and pumping stations are points on the water, not water to steer by.
    if (kind === 'water' && /(sluis|sluizen|duiker|gemaal|tunnel|fontein)$/i.test(item.name)) return;
    // "Red Light District" and "Canal Ring Area" are regions; "AFC" is a club.
    if (/\b(area|district|quarter|neighbou?rhood)\b/i.test(item.name) || flatName(item.name).length < 4 && kind !== 'water') return;
    if (kind === 'landmark' && !LANDMARK_TYPES.has(item.type || 'landmark')) return;
    const lines = item.paths?.length ? item.paths : item.path?.length ? [item.path] : undefined;
    add({ name: item.name, kind, fame, center: item.center, lines: kind === 'water' ? lines : undefined });
  };
  for (const item of files.water || []) place('water', item);
  for (const item of files.landmarks || []) place('landmark', item);
  for (const item of files.squares || []) place('square', item);
  for (const item of files.parks || []) place('park', item);
  for (const area of files.areas || []) {
    const fame = AREA_FAME[area.kind || ''];
    if (!area.name || !area.geometry?.length || !fame) continue;
    const ring = area.geometry.flat(1).flat(1);
    const center: LatLon = [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
    // Areas keep their own names; a quarter and a neighbourhood may share one.
    byName.set(`area:${flatName(area.name)}:${area.kind}`, { name: area.name, kind: 'area', fame, center, polygons: area.geometry, areaKind: area.kind });
  }
  return [...byName.values()];
}

/** Stems of the answer's name that no hint may contain. */
function forbiddenStems(name: string): string[] {
  return name.replace(/\s+e\.o\.$/i, '').split('/').map((part) => {
    const flat = flatName(part);
    const stem = flat.replace(/(buurt|eiland|kwartier|park|wijk|gracht|straat|plein|kade|weg|laan|dijk|markt)$/, '');
    return stem.length >= 4 ? stem : flat;
  }).filter(Boolean);
}

// Words two names can share without one giving the other away.
const GENERIC_WORDS = new Set(['nieuwe', 'oude', 'noord', 'zuid', 'oost', 'west', 'oostelijke', 'westelijke', 'oostelijk', 'westelijk',
  'buurt', 'park', 'eiland', 'plein', 'straat', 'gracht', 'kade', 'markt', 'museum', 'church', 'kerk', 'square', 'house', 'amsterdam']);
const words = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/)
  .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word));

/** Would naming this reference give the answer away? */
export function revealsAnswer(referenceName: string, answerName: string): boolean {
  const reference = flatName(referenceName);
  const answer = flatName(answerName);
  if (!reference) return true;
  if (reference === answer) return true;
  if (forbiddenStems(answerName).some((stem) => stem.length >= 4 ? reference.includes(stem) : reference === stem)) return true;
  // "De Pijp" names half of "Nieuwe Pijp".
  const answerWords = new Set(words(answerName));
  if (words(referenceName).some((word) => answerWords.has(word))) return true;
  // "Amstel" inside "Amstelveenseweg" is half the answer.
  return reference.length >= 4 && answer.includes(reference);
}

// --- local metric geometry -------------------------------------------------

type XY = [number, number];
const toXY = (origin: LatLon) => {
  const cos = Math.cos((origin[0] * Math.PI) / 180);
  return ([lat, lon]: LatLon): XY => [(lon - origin[1]) * 111_320 * cos, (lat - origin[0]) * 111_320];
};

function pointSegment(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Shortest distance from a point to any of the polylines. */
function pointLines(p: XY, lines: XY[][]): number {
  let best = Infinity;
  for (const line of lines) {
    if (line.length === 1) best = Math.min(best, Math.hypot(p[0] - line[0][0], p[1] - line[0][1]));
    for (let i = 1; i < line.length; i++) best = Math.min(best, pointSegment(p, line[i - 1], line[i]));
  }
  return best;
}

/** Shortest distance between two sets of polylines (vertices against segments, both ways). */
function linesLines(a: XY[][], b: XY[][]): number {
  let best = Infinity;
  for (const line of a) for (const p of line) best = Math.min(best, pointLines(p, b));
  for (const line of b) for (const p of line) best = Math.min(best, pointLines(p, a));
  return best;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
/** Compass word for the bearing from `from` to `to`. */
const bearing = (from: XY, to: XY) => COMPASS[Math.round(((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI + 360) % 360 / 45) % 8];

/** "the Amstel", "the Rijksmuseum", "Dam Square", "Plantage". */
export function referenceLabel(reference: Pick<HintReference, 'name' | 'kind'>): string {
  const { name, kind } = reference;
  if (kind !== 'water' && kind !== 'landmark') return name;
  if (/^the\s/i.test(name)) return `the ${name.slice(4)}`;
  if (/^(de|het)\s/i.test(name) || NO_ARTICLE.has(flatName(name))) return name;
  return `the ${name}`;
}
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const roundedMeters = (meters: number) => meters < 1000 ? `${Math.max(50, Math.round(meters / 50) * 50)} m` : `${(meters / 1000).toFixed(1)} km`;

/**
 * Up to `limit` hints, broadest first: district, waterway, part-of quarter,
 * a bordering area or well-known place outside, then what lies inside.
 */
export function buildLocateHints(target: HintTarget, references: readonly HintReference[], limit = 4): LocateHint[] {
  const project = toXY(target.center);
  const polygons = target.areaGeometry?.length ? target.areaGeometry : undefined;
  // A museum's outline is a building, not a line to follow: places are their centre.
  const lines: LatLon[][] = polygons
    ? polygons.flat(1)
    : !LINE_TYPES.has(target.type) ? [[target.center]]
    : target.paths?.length ? target.paths : target.path?.length ? [target.path] : [[target.center]];
  const targetXY = lines.map((line) => line.map(project));
  const vertices = targetXY.flat(1);
  const centroid: XY = [vertices.reduce((s, p) => s + p[0], 0) / vertices.length, vertices.reduce((s, p) => s + p[1], 0) / vertices.length];
  const radius = Math.max(...vertices.map((p) => Math.hypot(p[0] - centroid[0], p[1] - centroid[1])));
  const isArea = Boolean(polygons);
  const isPoint = !polygons && !LINE_TYPES.has(target.type);
  const latLonVertices = lines.flat(1);
  const insideTarget = (point: LatLon) => Boolean(polygons && inArea(point, polygons));
  const targetEdges = targetXY;
  // Boundaries share vertices, and a vertex on the shared edge may test either way.
  const withinArea = (point: LatLon, area: HintReference, edges: XY[][]) => inArea(point, area.polygons!) || pointLines(project(point), edges) <= 25;

  const usable = references.filter((reference) => !revealsAnswer(reference.name, target.name));
  const hints: LocateHint[] = [];
  const named = new Set<string>();
  const fresh = (reference: HintReference) => !named.has(reference.name);
  const push = (kind: LocateHintKind, reference: HintReference, text: string) => {
    hints.push({ kind, text, reference: reference.name });
    named.add(reference.name);
  };

  // Areas the answer lies within: the largest is the district, the smallest the quarter.
  const containers = usable.filter((reference) => {
    if (reference.kind !== 'area' || !reference.polygons) return false;
    const edges = reference.polygons.flat(1).map((line) => line.map(project));
    const inside = latLonVertices.filter((point) => withinArea(point, reference, edges)).length;
    return inside >= latLonVertices.length * 0.9;
  }).sort((a, b) => b.fame - a.fame);
  const district = containers.find((area) => area.areaKind === 'suburb');
  if (district) push('district', district, `It's in the ${district.name} district.`);

  // Water: the river or canal it shares most edge with, else the nearest famous one.
  const reach = 1500;
  const waters = usable.filter((reference) => reference.kind === 'water' && reference.lines).map((reference) => {
    const refLines = reference.lines!.map((line) => line.map(project))
      .filter((line) => line.some((p) => Math.hypot(p[0] - centroid[0], p[1] - centroid[1]) < radius + reach + 2000));
    const distance = refLines.length ? linesLines(targetXY, refLines) : Infinity;
    // Through: a stretch well inside the area, not one tracing its edge.
    const through = isArea && reference.lines!.some((line) => line.some((point) =>
      insideTarget(point) && pointLines(project(point), targetEdges) > 40));
    const along = distance <= 120 ? vertices.filter((p) => pointLines(p, refLines) <= 60).length : 0;
    return { reference, refLines, distance, through, along };
  }).filter((water) => water.distance <= reach);
  // Fame outweighs edge length: the Amstel through Weesperbuurt beats the Singelgracht along its rim.
  const touchScore = (water: typeof waters[number]) => Math.sqrt(water.reference.fame) * (1 + water.along + (water.through ? 10 : 0));
  const touching = waters.filter((water) => water.distance <= 120).sort((a, b) => touchScore(b) - touchScore(a));
  const water = touching[0] || waters.filter((candidate) => candidate.reference.fame >= FAR_WATER_FAME)
    .sort((a, b) => b.reference.fame / (1 + b.distance / 250) - a.reference.fame / (1 + a.distance / 250))[0];
  if (water) {
    const label = referenceLabel(water.reference);
    if (touching[0]) {
      const through = water.through;
      const alongShare = water.along / vertices.length;
      const text = through ? `${capitalised(label)} runs through it.`
        : isArea ? `It lies along ${label}.`
        : isPoint ? `It stands beside ${label}.`
        : alongShare >= 0.5 ? `It runs along ${label}.` : `It crosses or meets ${label}.`;
      push('water', water.reference, text);
    } else {
      // Bearing from the nearest stretch of water to the answer.
      let nearest: XY = centroid;
      let best = Infinity;
      for (const line of water.refLines) for (const p of line) {
        const d = Math.hypot(p[0] - centroid[0], p[1] - centroid[1]);
        if (d < best) { best = d; nearest = p; }
      }
      push('water', water.reference, `It's ${bearing(nearest, centroid)} of ${label}, about ${roundedMeters(water.distance)} from it.`);
    }
  }

  const quarter = containers.filter((area) => area.areaKind !== 'suburb' && area !== district && fresh(area)).sort((a, b) => a.fame - b.fame)[0];
  if (quarter) push('part-of', quarter, `It's part of ${quarter.name}.`);

  // A bordering area, judged by how much of the answer's edge runs next to it.
  if (isArea) {
    const ownParts = (reference: HintReference) => {
      const points = reference.polygons!.flat(2);
      return points.filter((point) => inArea(point, polygons!) || pointLines(project(point), targetEdges) <= 25).length >= points.length * 0.9;
    };
    const neighbours = usable.filter((reference) => reference.kind === 'area' && reference.areaKind !== 'suburb' && !containers.includes(reference)
      && reference.polygons && fresh(reference) && !ownParts(reference))
      .map((reference) => {
        const ring = reference.polygons!.flat(1).map((line) => line.map(project));
        const shared = vertices.filter((p) => pointLines(p, ring) <= 40).length;
        return { reference, shared, center: project(reference.center) };
      })
      .filter((neighbour) => neighbour.shared >= 3)
      .sort((a, b) => b.shared * b.reference.fame - a.shared * a.reference.fame);
    const neighbour = neighbours[0];
    if (neighbour) push('borders', neighbour.reference, `It borders ${neighbour.reference.name}, just ${bearing(neighbour.center, centroid)} of it.`);
  }

  // Well-known places: inside an area, beside a street, near a point.
  const places = usable.filter((reference) => (reference.kind === 'landmark' || reference.kind === 'square' || reference.kind === 'park') && fresh(reference))
    .map((reference) => {
      const p = project(reference.center);
      return { reference, p, inside: insideTarget(reference.center), distance: isPoint ? Math.hypot(p[0] - centroid[0], p[1] - centroid[1]) : pointLines(p, targetXY) };
    });
  const inside = places.filter((place) => isArea ? place.inside : !isPoint && place.distance <= 50)
    .sort((a, b) => b.reference.fame - a.reference.fame).slice(0, 2);
  const outside = places.filter((place) => !place.inside && !inside.includes(place) && place.distance > 15 && place.distance <= (isPoint ? 600 : 350))
    .sort((a, b) => b.reference.fame / (1 + b.distance / 150) - a.reference.fame / (1 + a.distance / 150))[0];
  if (outside) {
    const label = referenceLabel(outside.reference);
    const direction = bearing(outside.p, centroid);
    push('near', outside.reference, isPoint
      ? `About ${roundedMeters(outside.distance)} ${direction} of ${label}.`
      : isArea ? `It's just ${direction} of ${label}.` : `It passes within ${roundedMeters(outside.distance)} of ${label}.`);
  }
  if (inside.length) {
    const labels = inside.map((place) => referenceLabel(place.reference));
    const list = labels.length === 2 ? `${labels[0]} and ${labels[1]}` : labels[0];
    hints.push({
      kind: 'inside',
      text: isArea ? `${capitalised(list)} ${labels.length === 2 ? 'are' : 'is'} inside it.` : `It runs right past ${list}.`,
      reference: inside.map((place) => place.reference.name).join(' + '),
    });
  }

  // Too many: the quarter repeats what the district and border say, then the extra place.
  const dropOrder: LocateHintKind[] = ['part-of', 'near', 'district'];
  while (hints.length > limit) {
    const kind = dropOrder.find((candidate) => hints.some((hint) => hint.kind === candidate));
    if (!kind) break;
    hints.splice(hints.findIndex((hint) => hint.kind === kind), 1);
  }
  return hints.slice(0, limit);
}
