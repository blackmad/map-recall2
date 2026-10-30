/**
 * Roads that run through a building at street level (OSM `tunnel=building_passage`
 * or `covered=yes`): the building is drawn as parts, the outline minus the road
 * strip standing on the ground and a deck over the strip from the clearance up.
 * A solid outline would stand in the road: Jan van Zutphenstraat runs under four
 * towers, Berchvliet and the Motorwal under shops and flats (2026-10-30).
 *
 * Pure geometry; scripts/cut-building-passages.ts finds the ways and the tile
 * features they cross and writes the parts. Tunnels (`tunnel=yes`, layer < 0)
 * are not passages: the ground layer cuts them and the building stays whole.
 */
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';

type LngLat = [number, number];

/** OSM tags of a road that passes through a building at street level. */
export const isPassageRoad = (tags: Record<string, unknown>): boolean =>
  tags.tunnel === 'building_passage' || tags.covered === 'yes';

/** Highways the game routes on (streets-routing.json); footways, steps and corridors are not ridden. */
export const RIDDEN_HIGHWAYS: ReadonlySet<string> = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
  'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'busway', 'cycleway', 'pedestrian',
]);
const CAR_HIGHWAYS: ReadonlySet<string> = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
  'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'busway',
]);

/** Strip width when OSM has no `width`: a poort for a service lane or path, a carriageway for a street. */
export function passageWidthM(tags: Record<string, unknown>): number {
  const tagged = Number.parseFloat(String(tags.width ?? tags.est_width ?? ''));
  if (Number.isFinite(tagged) && tagged >= 2 && tagged <= 20) return tagged;
  const h = String(tags.highway ?? '');
  if (h === 'service' || h === 'cycleway' || h === 'pedestrian') return 3.5;
  if (h === 'living_street') return 4.5;
  if (h === 'residential' || h === 'unclassified') return 5.5;
  return 7;
}

/** Headroom under the deck: a lorry's under a street, a doorway's under a poort. */
export const PASSAGE_CLEARANCE_M = { car: 4.5, other: 3.5 } as const;
export const passageClearanceM = (tags: Record<string, unknown>): number =>
  CAR_HIGHWAYS.has(String(tags.highway ?? '')) ? PASSAGE_CLEARANCE_M.car : PASSAGE_CLEARANCE_M.other;

/** A deck thinner than this over its clearance is not worth drawing; the strip stays open. */
export const MIN_DECK_M = 1.5;
/** Ground pieces smaller than this (slivers along the strip) are dropped. */
export const MIN_PIECE_M2 = 2;

const M_PER_DEG = 111_320;

/** The strip a way's centreline sweeps at `widthM`: one rectangle per segment, ends run on by half a width. */
export function roadStrip(line: readonly LngLat[], widthM: number): MultiPolygon {
  const half = widthM / 2, pieces: Polygon[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const kx = M_PER_DEG * Math.cos((a[1] * Math.PI) / 180);
    const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * M_PER_DEG, len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const at = (p: LngLat, along: number, side: number): [number, number] =>
      [p[0] + (ux * along + nx * side) / kx, p[1] + (uy * along + ny * side) / M_PER_DEG];
    pieces.push([[at(a, -half, -half), at(b, half, -half), at(b, half, half), at(a, -half, half), at(a, -half, -half)]]);
  }
  return pieces.length ? polygonClipping.union(pieces[0], ...pieces.slice(1)) : [];
}

export function multiPolygonAreaM2(mp: MultiPolygon): number {
  let total = 0;
  for (const poly of mp) poly.forEach((ring, k) => {
    const kx = M_PER_DEG * Math.cos(((ring[0]?.[1] ?? 52) * Math.PI) / 180);
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * kx * ring[i][1] * M_PER_DEG - ring[i][0] * kx * ring[j][1] * M_PER_DEG;
    total += (k === 0 ? 1 : -1) * Math.abs(a) / 2;
  });
  return total;
}

export interface PassageStrip { strip: MultiPolygon; clearanceM: number }
export interface PassagePiece { polygon: Polygon; minHeight: number; deck: boolean }

/**
 * Split a footprint (MultiPolygon coordinates) of `heightM` by the passage strips
 * through it. Ground pieces = footprint minus every strip; each strip's share of
 * the footprint is a deck from its clearance to the top, or open when the
 * building is too low to bridge it (top < clearance + MIN_DECK_M). Where two
 * strips overlap the higher clearance wins.
 */
export function passagePieces(footprint: MultiPolygon, heightM: number, strips: readonly PassageStrip[]): PassagePiece[] {
  if (!strips.length) return footprint.map(polygon => ({ polygon, minHeight: 0, deck: false }));
  const all = strips.map(s => s.strip);
  const ground = polygonClipping.difference(footprint, ...all);
  const out: PassagePiece[] = ground.filter(p => multiPolygonAreaM2([p]) >= MIN_PIECE_M2).map(polygon => ({ polygon, minHeight: 0, deck: false }));
  const byClearance = [...strips].sort((a, b) => b.clearanceM - a.clearanceM);
  let taken: MultiPolygon = [];
  for (const s of byClearance) {
    let under = polygonClipping.intersection(footprint, s.strip);
    if (taken.length) under = polygonClipping.difference(under, taken);
    taken = taken.length ? polygonClipping.union(taken, s.strip) : s.strip;
    if (heightM < s.clearanceM + MIN_DECK_M) continue;
    for (const polygon of under) if (multiPolygonAreaM2([polygon]) >= MIN_PIECE_M2) out.push({ polygon, minHeight: s.clearanceM, deck: true });
  }
  return out;
}
