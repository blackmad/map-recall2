import type { TransitNetwork } from '../transit/network';
import type { RoadGraph, RoadGraphNode } from '../routing/roadGraph';

export type Point = { x: number; y: number };
export type Terminal = Point & { id: string; name: string; land: Point };
export type FerryLink = { id: string; ref: string; from: Terminal; to: Terminal; points: Point[] };
/**
 * Ferry and terminal-access segments carry an empty `name`: a name on a
 * segment makes it a street question, a distractor, a novelty target for the
 * learning router and a spoiler candidate. `label` is for display only.
 */
export type Segment = { points: Point[]; width: number; type: string; name: string; label?: string; ferryLink?: FerryLink; ferryTerminal?: Terminal };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function nearestOnLand(point: Point, segments: readonly Segment[]): Point & { distance: number } {
  let best = { ...point, distance: Infinity };
  for (const segment of segments) {
    if (segment.type === 'ferry') continue;
    for (let i = 1; i < segment.points.length; i++) {
      const a = segment.points[i - 1], b = segment.points[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const candidate = { x: a.x + t * dx, y: a.y + t * dy };
      const d = distance(point, candidate);
      if (d < best.distance) best = { ...candidate, distance: d };
    }
  }
  return best;
}

/** GTFS stop identities refer to physical piers; parent stations would merge
 * the separate Centraal departures and wrongly allow switching services. */
export function ferrySegments(network: TransitNetwork, land: readonly Segment[], project: (lat: number, lng: number) => Point): Segment[] {
  const terminals = new Map<string, Terminal>();
  const terminal = (id: string): Terminal | undefined => {
    if (terminals.has(id)) return terminals.get(id);
    const stop = network.stops[id];
    if (!stop?.center || !stop.inAmsterdamBbox) return;
    const point = project(...stop.center);
    const nearest = nearestOnLand(point, land);
    // Do not invent long cross-building approaches to missing street data.
    if (nearest.distance > 240) return;
    const result = { ...point, id, name: stop.name.replace(/^Amsterdam, /, ''), land: { x: nearest.x, y: nearest.y } };
    terminals.set(id, result);
    return result;
  };
  const links: Segment[] = [];
  for (const line of network.lines) {
    if (line.mode !== 'ferry' || !line.path?.length) continue;
    for (let i = 1; i < line.stopIds.length; i++) {
      const from = terminal(line.stopIds[i - 1]), to = terminal(line.stopIds[i]);
      if (!from || !to || from.id === to.id) continue;
      const shape = line.path.map(([lat, lng]) => project(lat, lng));
      // The extract currently has two-stop lines. Avoid assigning the whole
      // shape to every leg if future feeds include intermediate stops.
      const nearestIndex = (p: Point) => shape.reduce((best, q, index) => distance(p, q) < distance(p, shape[best]) ? index : best, 0);
      const a = nearestIndex(from), b = nearestIndex(to);
      const middle = shape.slice(Math.min(a, b), Math.max(a, b) + 1);
      if (a > b) middle.reverse();
      const points = [from, ...middle, to];
      const ferryLink = { id: `${line.ref}:${from.id}:${to.id}`, ref: line.ref, from, to, points };
      links.push({ points, type: 'ferry', width: 45, name: '', label: `${line.ref} · ${from.name} – ${to.name}`, ferryLink });
    }
  }
  const used = new Map(links.flatMap(s => [s.ferryLink!.from, s.ferryLink!.to]).map(t => [t.id, t]));
  const accesses: Segment[] = [...used.values()].map(t => ({ points: [t.land, t], type: 'ferry-access', width: 18, ferryTerminal: t, name: '', label: `${t.name} ferry terminal` }));
  return [...accesses, ...links];
}

/** Add sea links after street junction construction. Crossing ferry shapes
 * are never stitched to one another or to a shoreline midway through a trip. */
export function connectFerryGraph<T>(graph: RoadGraph<T>, segments: readonly Segment[]): RoadGraph<T> {
  const nodes = new Map(graph.nodes), allNodes = [...graph.allNodes];
  segments.forEach((segment, segmentIndex) => {
    if (!segment.ferryLink) return;
    const endpoints = [segment.points[0], segment.points[segment.points.length - 1]];
    const ends = endpoints.map(point => graph.allNodes.reduce<RoadGraphNode<T> | undefined>((best, n) => !best || distance(point, n) < distance(point, best) ? n : best, undefined));
    if (!ends[0] || !ends[1] || ends.some((n, i) => distance(n!, endpoints[i]) > 24)) return;
    const chain = [ends[0], ...segment.points.slice(1, -1).map((p, i) => {
      const node: RoadGraphNode<T> = { ...p, key: `ferry:${segmentIndex}:${i}`, edges: [] };
      nodes.set(node.key, node); allNodes.push(node); return node;
    }), ends[1]];
    const metadata = { segmentIndex, name: '', ferryId: segment.ferryLink.id } as T;
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1]!, b = chain[i]!;
      if (a === b) continue;
      const edge = { distance: distance(a, b), kind: 'centreline' as const, segmentIndexes: [segmentIndex], segmentMetadata: [metadata] };
      a.edges.push({ ...edge, node: b }); b.edges.push({ ...edge, node: a });
    }
  });
  return { ...graph, nodes, allNodes };
}

export function connectedTerminals(origin: string, links: readonly FerryLink[]): Terminal[] {
  const found = new Map<string, Terminal>();
  for (const link of links) {
    if (link.from.id === origin) found.set(link.to.id, link.to);
    if (link.to.id === origin) found.set(link.from.id, link.from);
  }
  return [...found.values()];
}
