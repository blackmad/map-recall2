// One material on a covered deck (pure; lane fb-bridges-20261119, feedback 935a6807 "bridge looks slightly weird", the
// Oost-Indische Huisbrug BRU0223 over the Kloveniersburgwal).
//
// Where the survey's deck polygons (h ≥ 1) cover a measured deck (groundCell `roadsOnDeck`), they are the visible deck
// and the kit's deck top lies just under them, filling to the parapet. The kit top is the pale vertex-coloured deck
// grey (decks.ts DECK_TOP). BRU0223 crosses the canal on the skew: its asphalt deck polygon runs diagonally to the kit's
// axis, so on the west half a wedge of the pale top showed between the asphalt and the parapet, the "two-toned deck"
// (the 8 cm orthophoto shows asphalt from parapet to parapet). The top now takes the material the survey draws at the
// deck's edges, when the survey agrees on one, and when the top stays inside the deck's footprint (the street mask
// never cuts a road layer there; a wider top keeps the deck grey, which no mask cuts).

/** What coveredTopLayer reads of the road index (RoadIndex). */
export interface DeckLevelIndex {
  findAtLevel(x: number, y: number, bridge?: boolean): number;
  records: readonly { h: number }[];
  drawClass(k: number): string;
  mesh(k: number): string;
}

/** The deck's stations and widths coveredTopLayer reads (DeckSurface.profile). */
export interface CoveredDeckProfile {
  s: Float64Array; x: Float64Array; y: Float64Array; halfWidth: Float64Array; deck: readonly [number, number];
  edges?: { left: Float64Array; right: Float64Array };
}

/** Stations along the span, metres apart. */
export const COVERED_TOP_STATION_M = 2;
/** Scan step inward from the top's edge for the first deck polygon, metres. */
export const COVERED_TOP_SCAN_M = 0.25;
/** Share of the edge samples that must agree on one layer. */
export const COVERED_TOP_AGREE = 0.6;
/** Fewest edge samples for a verdict. */
export const COVERED_TOP_MIN_SAMPLES = 4;
/**
 * Layers the top may take: the road layers on the lowest road polygon offset (gameGround.ts OFFSET: asphalt, klinker
 * and brick 2; paving, cycle and gravel 3). The top lies under the deck polygons by depth; a top in a layer drawn with a
 * higher offset than a polygon over it wins the depth test anyway (a paving top on BRU0108 hid the asphalt carriageway
 * on the deck, frame 2026-11-19), so a paving, cycle or gravel verdict keeps the deck grey.
 */
export const COVERED_TOP_LAYERS: ReadonlySet<string> = new Set(['asphalt', 'klinker', 'brick']);
/** Scan step across the whole top for the other low-offset layers on the deck, metres. */
export const COVERED_TOP_ACROSS_M = 0.5;

/**
 * The road layer a covered deck's top is drawn in, or null (keep the deck grey). `widths`: the top's left/right widths
 * per station (groundCell's covered widths); `layerOf`: the survey's class + mesh to its drawn layer (surfaceLayer).
 */
export function coveredTopLayer(p: CoveredDeckProfile, widths: { left: Float64Array; right: Float64Array }, index: DeckLevelIndex, layerOf: (cls: string, mesh: string) => string): string | null {
  const n = p.s.length, votes = new Map<string, number>();
  let samples = 0, next = -Infinity;
  for (let i = 0; i < n; i++) {
    const hw = p.halfWidth[i];
    // The top beyond the footprint (GroundSurface.footprint: the half-width, or the survey edges when wider) would be cut by the street mask over water.
    if (widths.left[i] > Math.max(hw, p.edges?.left[i] ?? 0) + 0.05 || widths.right[i] > Math.max(hw, p.edges?.right[i] ?? 0) + 0.05) return null;
    if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1] || p.s[i] < next) continue;
    next = p.s[i] + COVERED_TOP_STATION_M;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (const [sg, w] of [[1, widths.left[i]], [-1, widths.right[i]]] as const) {
      for (let t = w - COVERED_TOP_SCAN_M / 2; t >= 0; t -= COVERED_TOP_SCAN_M) {
        const k = index.findAtLevel(p.x[i] + nx * sg * t, p.y[i] + ny * sg * t, true);
        if (k < 0 || index.records[k].h < 1) continue;
        const layer = layerOf(index.drawClass(k), index.mesh(k));
        votes.set(layer, (votes.get(layer) ?? 0) + 1);
        samples++;
        break;
      }
    }
  }
  if (samples < COVERED_TOP_MIN_SAMPLES) return null;
  let best: string | null = null, most = 0;
  for (const [layer, v] of votes) if (v > most) { best = layer; most = v; }
  if (!best || most < COVERED_TOP_AGREE * samples || !COVERED_TOP_LAYERS.has(best)) return null;
  // Another low-offset layer anywhere on the top (klinker over an asphalt top's edge) would z-fight it: keep the grey.
  next = -Infinity;
  for (let i = 0; i < n; i++) {
    if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1] || p.s[i] < next) continue;
    next = p.s[i] + COVERED_TOP_STATION_M;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (let t = -widths.right[i]; t <= widths.left[i]; t += COVERED_TOP_ACROSS_M) {
      const k = index.findAtLevel(p.x[i] + nx * t, p.y[i] + ny * t, true);
      if (k < 0 || index.records[k].h < 1) continue;
      const layer = layerOf(index.drawClass(k), index.mesh(k));
      if (layer !== best && COVERED_TOP_LAYERS.has(layer)) return null;
    }
  }
  return best;
}
