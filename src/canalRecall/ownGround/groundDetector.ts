// Broken-ground detector (feedback c57c04, 2026-11-19: "can we have an automated detector (and fixer?) to look for where
// the ground looks broken like this?"). Pure: merges the three existing city-wide measures into one ranked list of places
// with coordinates, so a lane can walk the worst first.
//
//   audit        groundAudit.ts per 125 m tile (scripts/own-ground/audit-ground.ts --cells / --city): holes in the ground
//                (void: a gap wider than 6 m under no layer; crack: narrower), a lower layer poking > 5 cm through a
//                higher one, natural ground floating > 30 cm over the DTM, torn thin slivers.
//   holeJunction probe-hole-junctions.ts: road vertices sunk under a way deck's end over a hole (the jagged junctions).
//   railJoin     check-rail-joins.ts: a rail bed that gaps, steps or ramps where it meets a bridge, or a free bridge end.
//
// The weights put the defects a rider sees from the chase camera first (a hole shows sky or water through the street; a
// step in a rail bed shows its side), and the area measures last (z-fight and plain slivers are left out: G0 found them
// everywhere and mostly invisible). One place keeps its worst hit; hits within DETECTOR_MERGE_M of it are folded in.

export type DetectorSource = 'audit' | 'holeJunction' | 'railJoin';

export interface DetectorHit {
  source: DetectorSource;
  /** What is broken: the dominant defect for an audit tile, the failure class otherwise. */
  kind: string;
  lng: number; lat: number;
  score: number;
  detail: string;
  /** Other hits folded into this place (rankHits). */
  also?: string[];
}

/** Score per unit: per m² for the audit areas, per sunk vertex, per rail-join failure (scaled by its own excess). */
export const DETECTOR_WEIGHTS = { void: 0.02, crack: 4, pokeSevere: 3, floatSevere: 2, thin: 0.05, holeVertex: 25, railJoin: 120 } as const;
/** Hits closer than this (metres) are one place. */
export const DETECTOR_MERGE_M = 80;

/** The audit's per-tile tally (groundAudit.ts Defects, as audit-ground writes it). */
export interface AuditTile { cell: string; tile: string; x: number; y: number; tally: { voidM2: number; crackM2: number; pokeSevereM2: number; floatSevereM2: number; thinM2: number } }

export function auditTileHits(tiles: readonly AuditTile[], toLngLat: (x: number, y: number) => [number, number]): DetectorHit[] {
  const W = DETECTOR_WEIGHTS;
  return tiles.map(t => {
    const d = t.tally, parts: [string, number][] = [['void', d.voidM2 * W.void], ['crack', d.crackM2 * W.crack], ['poke>5cm', d.pokeSevereM2 * W.pokeSevere], ['float>30cm', d.floatSevereM2 * W.floatSevere], ['thin', d.thinM2 * W.thin]];
    const score = parts.reduce((s, p) => s + p[1], 0), [kind] = [...parts].sort((a, b) => b[1] - a[1])[0];
    const [lng, lat] = toLngLat(t.x, t.y);
    return { source: 'audit' as const, kind, lng, lat, score, detail: `cell ${t.cell} tile ${t.tile}: void ${d.voidM2.toFixed(0)} m², crack ${d.crackM2.toFixed(0)}, poke>5cm ${d.pokeSevereM2.toFixed(0)}, float>30cm ${d.floatSevereM2.toFixed(0)}, thin ${d.thinM2.toFixed(0)}` };
  }).filter(h => h.score > 0);
}

/** probe-hole-junctions.ts --list rows: `at` "lng,lat", `after` the sunk vertices with the defaults. */
export function holeJunctionHits(rows: readonly { id: string; name?: string; at: string; after?: number }[]): DetectorHit[] {
  return rows.filter(r => (r.after ?? 0) > 0).map(r => {
    const [lng, lat] = r.at.split(',').map(Number);
    return { source: 'holeJunction' as const, kind: 'sunk junction', lng, lat, score: (r.after as number) * DETECTOR_WEIGHTS.holeVertex, detail: `deck ${r.id}${r.name ? ` (${r.name})` : ''}: ${r.after} road vertices sunk under the deck end` };
  });
}

/** check-rail-joins.ts --json failures (detail.lngLat "lng,lat"). */
export function railJoinHits(failures: readonly { id: string; cls: string; kind: string; reasons: string[]; score: number; detail?: Record<string, number | string> }[]): DetectorHit[] {
  return failures.filter(f => typeof f.detail?.lngLat === 'string').map(f => {
    const [lng, lat] = String(f.detail!.lngLat).split(',').map(Number);
    return { source: 'railJoin' as const, kind: `rail ${f.cls}`, lng, lat, score: DETECTOR_WEIGHTS.railJoin * (1 + Math.min(4, f.score)), detail: `${f.id} ${f.kind}: ${f.reasons.join('; ')}` };
  });
}

/** Worst first, one hit per place (DETECTOR_MERGE_M). */
export function rankHits(hits: readonly DetectorHit[], mergeM = DETECTOR_MERGE_M): DetectorHit[] {
  const KX = 111320 * Math.cos(52.37 * Math.PI / 180), KY = 110540;
  const out: DetectorHit[] = [];
  for (const h of [...hits].sort((a, b) => b.score - a.score)) {
    const near = out.find(o => Math.hypot((o.lng - h.lng) * KX, (o.lat - h.lat) * KY) < mergeM);
    if (near) (near.also ??= []).push(`${h.source} ${h.kind} ${h.score.toFixed(0)}`);
    else out.push({ ...h });
  }
  return out;
}
