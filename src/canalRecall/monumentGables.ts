// Gable types named in the national monuments register's descriptions.
//
// A rijksmonument description names the front in Dutch: "Pand met trapgevel", "lijstgevel
// met kroonlijst", "verhoogde halsgevel met beeldhouwwerk", "klokgevel". The first gable
// word in the text is the street front far more often than not (later sentences describe
// rear gables and side walls), so the first match wins. Pure, so the extract builder and
// the checks share it.

import type { GableShape } from './roofMesh.js';

// Longer phrases first, so "verhoogde halsgevel" is not read as a plain neck gable.
const WORDS: Array<[RegExp, GableShape]> = [
  [/verhoogde\s+halsgevel/i, 'raisedNeck'],
  [/trapgevel|trappengevel|trapgeveltje/i, 'step'],
  [/halsgevel/i, 'neck'],
  [/klokgevel/i, 'bell'],
  [/tuitgevel/i, 'spout'],
  [/lijstgevel|rechte\s+(?:kroon)?lijst|kroonlijst|attiek|rechte\s+daklijst/i, 'cornice'],
  [/puntgevel|topgevel/i, 'plain'],
];

/** The gable shape a register description names first, or null. */
export function classifyGable(text: string): GableShape | null {
  let best: { at: number; shape: GableShape } | null = null;
  for (const [re, shape] of WORDS) {
    const m = re.exec(text);
    // Ties (one phrase inside another) go to the earlier, longer entry in WORDS.
    if (m && (!best || m.index < best.at)) best = { at: m.index, shape };
  }
  return best ? best.shape : null;
}

/** The register's gables by building id (the `monument-gables.json` extract). */
export type MonumentGables = ReadonlyMap<string, GableShape>;

/**
 * Tile decorator step: a listed building whose register description names its gable carries
 * it as `monumentGable`, which the roof planner draws instead of a period-weighted guess.
 */
export function withMonumentGable<T extends { properties: Record<string, unknown> }>(feature: T, gables: MonumentGables): T {
  const shape = gables.get(String(feature.properties.id ?? ''));
  return shape && feature.properties.monumentGable !== shape ? { ...feature, properties: { ...feature.properties, monumentGable: shape } } : feature;
}
