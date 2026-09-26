/**
 * Transfer graph for Phase E — walk connections between GVB stops.
 *
 * Prefer GTFS `transfers.txt` when the builder has the zip; otherwise derive
 * from parent stations and short walking proximity so the published extract
 * still teaches hub changes without a live download.
 */
import type { TransitLine, TransitNetwork, TransitStop } from './network.ts';
import { lineDisplayName, type TransitLineFeature, type TransitPlayLoad } from './segments.ts';
import type { TransitMode } from './network.ts';

export type TransitTransferSource = 'gtfs' | 'parent' | 'proximity' | 'same-platform';

export interface TransitTransferEdge {
  fromStopId: string;
  toStopId: string;
  /** GTFS min_transfer_time when known; otherwise a walk estimate. */
  minTransferTimeS: number | null;
  source: TransitTransferSource;
}

export interface TransitTransfers {
  cityId: 'amsterdam';
  source: string;
  generatedNote: string;
  counts: {
    transfers: number;
    bySource: Record<TransitTransferSource, number>;
  };
  transfers: TransitTransferEdge[];
}

export interface TransitLeg {
  lineName: string;
  lineRef: string;
  mode: TransitMode;
  fromStopId: string;
  toStopId: string;
}

export interface TransitConnectionPlan {
  legs: TransitLeg[];
  /** Stop where the player changes lines (second leg boards here). */
  transferStopId: string | null;
  /** Display name of the line after the change. */
  nextLineName: string | null;
}

/** Active leg for corridor lock / destination stop scope. */
export function currentTransitLeg(
  plan: TransitConnectionPlan | null | undefined,
  legIndex: number,
): TransitLeg | null {
  if (!plan?.legs?.length) return null;
  const index = Math.max(0, Math.min(legIndex, plan.legs.length - 1));
  return plan.legs[index] || null;
}

/** True when a two-leg plan still has a second ride to board. */
export function canAdvanceTransitLeg(
  plan: TransitConnectionPlan | null | undefined,
  legIndex: number,
): boolean {
  return !!plan && plan.legs.length >= 2 && legIndex === 0 && !!plan.transferStopId && !!plan.nextLineName;
}

/**
 * Arrive at the transfer hub: move to leg 1 and return the next corridor name.
 * Returns null when there is nothing to advance.
 */
export function advanceTransitLeg(
  plan: TransitConnectionPlan,
  legIndex: number,
): { legIndex: number; lineName: string } | null {
  if (!canAdvanceTransitLeg(plan, legIndex) || !plan.nextLineName) return null;
  return { legIndex: 1, lineName: plan.nextLineName };
}

const EARTH_M = 6371000;

function haversineM(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function emptySourceCounts(): Record<TransitTransferSource, number> {
  return { gtfs: 0, parent: 0, proximity: 0, 'same-platform': 0 };
}

function pushUnique(
  edges: TransitTransferEdge[],
  seen: Set<string>,
  edge: TransitTransferEdge,
): void {
  if (edge.fromStopId === edge.toStopId) return;
  const key = `${edge.fromStopId}\0${edge.toStopId}`;
  const rev = `${edge.toStopId}\0${edge.fromStopId}`;
  if (seen.has(key) || seen.has(rev)) return;
  seen.add(key);
  edges.push(edge);
}

/** Walk estimate: ~1.3 m/s urban + 30 s platform buffer. */
function walkSeconds(metres: number): number {
  return Math.round(metres / 1.3) + 30;
}

/**
 * Derive undirected transfer edges from the published network.
 * Used when GTFS `transfers.txt` is not available at publish time.
 */
export function deriveTransfersFromNetwork(
  network: TransitNetwork,
  options: { proximityM?: number; modes?: readonly TransitMode[] } = {},
): TransitTransfers {
  const proximityM = options.proximityM ?? 90;
  const modeFilter = options.modes?.length ? new Set(options.modes) : null;
  const lines = modeFilter
    ? network.lines.filter((line) => modeFilter.has(line.mode))
    : network.lines;
  const playableStopIds = new Set<string>();
  for (const line of lines) {
    for (const id of line.stopIds) playableStopIds.add(id);
  }

  const stops = Object.values(network.stops).filter(
    (stop): stop is TransitStop & { center: [number, number] } =>
      !!stop.center && playableStopIds.has(stop.stopId),
  );

  const edges: TransitTransferEdge[] = [];
  const seen = new Set<string>();

  // Same GTFS stop id is already one platform; multi-line is not an edge.
  // Parent station: sibling platforms are a walk transfer.
  const byParent = new Map<string, string[]>();
  for (const stop of stops) {
    if (!stop.parentStation) continue;
    const list = byParent.get(stop.parentStation) || [];
    list.push(stop.stopId);
    byParent.set(stop.parentStation, list);
  }
  for (const group of byParent.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = network.stops[group[i]!];
        const b = network.stops[group[j]!];
        const metres = a?.center && b?.center
          ? haversineM(a.center, b.center)
          : 40;
        pushUnique(edges, seen, {
          fromStopId: group[i]!,
          toStopId: group[j]!,
          minTransferTimeS: walkSeconds(metres),
          source: 'parent',
        });
      }
    }
  }

  // Short walks between different parents that serve different lines.
  for (let i = 0; i < stops.length; i += 1) {
    for (let j = i + 1; j < stops.length; j += 1) {
      const a = stops[i]!;
      const b = stops[j]!;
      if (a.parentStation && a.parentStation === b.parentStation) continue;
      const metres = haversineM(a.center, b.center);
      if (metres > proximityM) continue;
      pushUnique(edges, seen, {
        fromStopId: a.stopId,
        toStopId: b.stopId,
        minTransferTimeS: walkSeconds(metres),
        source: 'proximity',
      });
    }
  }

  const bySource = emptySourceCounts();
  for (const edge of edges) bySource[edge.source] += 1;

  return {
    cityId: 'amsterdam',
    source: 'derived from transit-network.json (parent stations + proximity)',
    generatedNote: `proximity ≤ ${proximityM} m; tram/metro playable stops`,
    counts: { transfers: edges.length, bySource },
    transfers: edges,
  };
}

/** Merge GTFS transfer rows that touch known network stops. */
export function transfersFromGtfsRows(
  rows: Iterable<{ from_stop_id?: string; to_stop_id?: string; min_transfer_time?: string }>,
  knownStopIds: ReadonlySet<string>,
): TransitTransferEdge[] {
  const edges: TransitTransferEdge[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const from = row.from_stop_id;
    const to = row.to_stop_id;
    if (!from || !to || !knownStopIds.has(from) || !knownStopIds.has(to)) continue;
    const secs = row.min_transfer_time ? Number(row.min_transfer_time) : null;
    pushUnique(edges, seen, {
      fromStopId: from,
      toStopId: to,
      minTransferTimeS: Number.isFinite(secs) ? secs : null,
      source: 'gtfs',
    });
  }
  return edges;
}

export function summarizeTransferEdges(edges: readonly TransitTransferEdge[]): TransitTransfers['counts'] {
  const bySource = emptySourceCounts();
  for (const edge of edges) bySource[edge.source] += 1;
  return { transfers: edges.length, bySource };
}

/** Line that contains both anchors, else the named active corridor, else null. */
export function resolveActiveLine(
  lines: readonly TransitLineFeature[],
  activeLineName: string | null | undefined,
  fromStopId: string | null | undefined,
  toStopId: string | null | undefined,
): TransitLineFeature | null {
  if (activeLineName) {
    const named = lines.find((line) => line.name === activeLineName);
    if (named) return named;
  }
  if (fromStopId && toStopId) {
    const covering = lines.find(
      (line) => line.stopIds.includes(fromStopId) && line.stopIds.includes(toStopId),
    );
    if (covering) return covering;
  }
  if (fromStopId) {
    const fromLine = lines.find((line) => line.stopIds.includes(fromStopId));
    if (fromLine) return fromLine;
  }
  return null;
}

/** Other driveable lines that share this stop (wrong-line / transfer pool). */
export function otherLinesAtStop(
  load: TransitPlayLoad,
  stopId: string,
  currentLineName: string,
): string[] {
  const names = new Set<string>();
  for (const line of load.lines) {
    if (line.name === currentLineName) continue;
    if (line.stopIds.includes(stopId)) names.add(line.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Lines that share at least one stop with `lineName` — preferred distractors
 * so line quizzes teach "which corridor am I on" rather than random refs.
 */
export function siblingLineNames(load: TransitPlayLoad, lineName: string): string[] {
  const line = load.lines.find((entry) => entry.name === lineName);
  if (!line) {
    return load.lineDistractors.filter((name) => name !== lineName);
  }
  const stopSet = new Set(line.stopIds);
  const siblings = new Set<string>();
  for (const other of load.lines) {
    if (other.name === lineName) continue;
    if (other.stopIds.some((id) => stopSet.has(id))) siblings.add(other.name);
  }
  return [...siblings].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Prefer sibling corridors as distractors; fill from the full pool.
 * Returns alternatives only (not including the answer).
 */
export function preferSiblingDistractors(
  answer: string,
  siblings: readonly string[],
  pool: readonly string[],
  count: number,
  shuffle: <T>(items: T[]) => T[],
): string[] {
  const picked: string[] = [];
  const used = new Set<string>([answer]);
  for (const name of shuffle([...siblings])) {
    if (used.has(name)) continue;
    picked.push(name);
    used.add(name);
    if (picked.length >= count) return picked;
  }
  for (const name of shuffle(pool.filter((entry) => entry !== answer))) {
    if (used.has(name)) continue;
    picked.push(name);
    used.add(name);
    if (picked.length >= count) break;
  }
  return picked;
}

function lineForStop(lines: readonly TransitLineFeature[], stopId: string): TransitLineFeature[] {
  return lines.filter((line) => line.stopIds.includes(stopId));
}

/**
 * Single- or two-leg connection between stop anchors.
 * Caps at two rides: origin line → transfer hub → destination line.
 */
export function planTransitConnection(
  load: TransitPlayLoad,
  transfers: TransitTransfers | null,
  fromStopId: string,
  toStopId: string,
): TransitConnectionPlan | null {
  if (fromStopId === toStopId) return null;

  const direct = load.lines.find(
    (line) => line.stopIds.includes(fromStopId) && line.stopIds.includes(toStopId),
  );
  if (direct) {
    return {
      legs: [{
        lineName: direct.name,
        lineRef: direct.ref,
        mode: direct.mode,
        fromStopId,
        toStopId,
      }],
      transferStopId: null,
      nextLineName: null,
    };
  }

  const fromLines = lineForStop(load.lines, fromStopId);
  const toLines = lineForStop(load.lines, toStopId);
  if (!fromLines.length || !toLines.length) return null;

  // Build adjacency: stop → stops reachable by walk transfer (undirected).
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const edge of transfers?.transfers || []) {
    link(edge.fromStopId, edge.toStopId);
  }

  type Candidate = {
    hub: string;
    fromLine: TransitLineFeature;
    toLine: TransitLineFeature;
  };
  const candidates: Candidate[] = [];

  for (const fromLine of fromLines) {
    for (const hubId of fromLine.stopIds) {
      for (const toLine of toLines) {
        if (toLine.name === fromLine.name) continue;
        // Shared stop, or walk-transfer to a stop on the destination line.
        if (toLine.stopIds.includes(hubId)) {
          candidates.push({ hub: hubId, fromLine, toLine });
          continue;
        }
        const neighbours = adj.get(hubId);
        if (!neighbours) continue;
        for (const near of neighbours) {
          if (toLine.stopIds.includes(near)) {
            candidates.push({ hub: hubId, fromLine, toLine });
            break;
          }
        }
      }
    }
  }

  if (!candidates.length) return null;

  // Prefer hubs closer to the middle of the first leg (teach a real change).
  const scored = candidates.map((c) => {
    const idx = c.fromLine.stopIds.indexOf(c.hub);
    const mid = (c.fromLine.stopIds.length - 1) / 2;
    return { c, score: Math.abs(idx - mid) };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0]!.c;

  return {
    legs: [
      {
        lineName: best.fromLine.name,
        lineRef: best.fromLine.ref,
        mode: best.fromLine.mode,
        fromStopId,
        toStopId: best.hub,
      },
      {
        lineName: best.toLine.name,
        lineRef: best.toLine.ref,
        mode: best.toLine.mode,
        fromStopId: best.hub,
        toStopId,
      },
    ],
    transferStopId: best.hub,
    nextLineName: best.toLine.name,
  };
}

/** Display names of lines that serve any stop in a transfer cluster. */
export function transferTargetLines(
  load: TransitPlayLoad,
  transfers: TransitTransfers | null,
  stopId: string,
  currentLineName: string,
): string[] {
  const names = new Set(otherLinesAtStop(load, stopId, currentLineName));
  for (const edge of transfers?.transfers || []) {
    const other = edge.fromStopId === stopId
      ? edge.toStopId
      : edge.toStopId === stopId
        ? edge.fromStopId
        : null;
    if (!other) continue;
    for (const line of otherLinesAtStop(load, other, currentLineName)) names.add(line);
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Helper for builders: line display name from a network line. */
export function networkLineName(line: TransitLine): string {
  return lineDisplayName(line.mode, line.ref);
}

export type TransitAnchor = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type ChooseIndex = (count: number) => number;

const randomIndex: ChooseIndex = (count) => Math.floor(Math.random() * count);

function stopIdFromAnchor(anchor: TransitAnchor): string | null {
  if (anchor.id.startsWith('stop-')) return anchor.id.slice('stop-'.length);
  return null;
}

/**
 * Surprise pairing for transit: prefer hops that teach a change of line.
 *
 * `preferTransfer` is the chance of returning a two-leg plan when any exist
 * among sampled pairs; otherwise a single-leg (or any) pair is used so play
 * never stalls.
 */
export function pickTeachableTransitPair(
  load: TransitPlayLoad,
  transfers: TransitTransfers | null,
  anchors: readonly TransitAnchor[],
  options: {
    preferTransfer?: number;
    chooseIndex?: ChooseIndex;
    /** 0..1 roll; injectable for tests. */
    transferRoll?: () => number;
    maxAttempts?: number;
  } = {},
): { from: TransitAnchor; to: TransitAnchor; plan: TransitConnectionPlan } | null {
  if (anchors.length < 2) return null;
  const preferTransfer = options.preferTransfer ?? 0.65;
  const chooseIndex = options.chooseIndex ?? randomIndex;
  const transferRoll = options.transferRoll ?? Math.random;
  const maxAttempts = options.maxAttempts ?? Math.min(80, anchors.length * 4);

  const twoLeg: Array<{ from: TransitAnchor; to: TransitAnchor; plan: TransitConnectionPlan }> = [];
  const oneLeg: Array<{ from: TransitAnchor; to: TransitAnchor; plan: TransitConnectionPlan }> = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const from = anchors[chooseIndex(anchors.length)]!;
    let to = anchors[chooseIndex(anchors.length)]!;
    if (to.id === from.id) {
      to = anchors[(anchors.indexOf(from) + 1) % anchors.length]!;
    }
    if (to.id === from.id) continue;
    const fromId = stopIdFromAnchor(from);
    const toId = stopIdFromAnchor(to);
    if (!fromId || !toId) continue;
    const plan = planTransitConnection(load, transfers, fromId, toId);
    if (!plan) continue;
    const entry = { from, to, plan };
    if (plan.legs.length >= 2) twoLeg.push(entry);
    else oneLeg.push(entry);
    if (twoLeg.length >= 8 && oneLeg.length >= 4) break;
  }

  if (twoLeg.length && (oneLeg.length === 0 || transferRoll() < preferTransfer)) {
    return twoLeg[chooseIndex(twoLeg.length)]!;
  }
  if (oneLeg.length) return oneLeg[chooseIndex(oneLeg.length)]!;
  if (twoLeg.length) return twoLeg[chooseIndex(twoLeg.length)]!;
  return null;
}

/**
 * Line-quiz distractors that teach hub discrimination: prefer other lines that
 * actually stop here (or transfer-adjacent), then fill from the citywide pool.
 */
export function lineQuizDistractorsAtHub(
  load: TransitPlayLoad,
  transfers: TransitTransfers | null,
  answer: string,
  nearStopId: string | null,
  count: number,
  shuffle: <T>(items: T[]) => T[],
): string[] {
  const hubLines = nearStopId
    ? transferTargetLines(load, transfers, nearStopId, answer)
    : siblingLineNames(load, answer);
  return preferSiblingDistractors(answer, hubLines, load.lineDistractors, count, shuffle);
}
