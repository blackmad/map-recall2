/**
 * Stable mastery keys for transit lines and stops.
 *
 * Stops key on extract centres so ask-point drift does not fragment SRS.
 * Lines key on mode + ref + city — not the ask point.
 */
import type { TransitMode } from './network.ts';

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48);

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

export interface TransitLineIdentity {
  cityId: string;
  mode: TransitMode;
  ref: string;
  /** Display name used in the feature snapshot (e.g. "Tram 2"). */
  name: string;
  /** Stable extract centroid — not the ask point. */
  center: [number, number];
}

export interface TransitStopIdentity {
  cityId: string;
  name: string;
  /** Stable extract centre. */
  center: [number, number];
  stopId?: string;
}

/** Line mastery is independent of where along the corridor the question fired. */
export function getTransitLineKey(line: TransitLineIdentity): string {
  const canonical = [
    line.cityId,
    'line',
    line.mode,
    normalize(line.ref),
  ].join('|');
  return `v1_${normalize(line.cityId)}_line-${normalize(line.mode)}-${normalize(line.ref)}_${hash(canonical)}`;
}

/** Stop mastery uses the extract centre so nearby ask points share one key. */
export function getTransitStopKey(stop: TransitStopIdentity): string {
  const canonical = [
    stop.cityId,
    'stop',
    normalize(stop.name),
    stop.center[0].toFixed(4),
    stop.center[1].toFixed(4),
  ].join('|');
  return `v1_${normalize(stop.cityId)}_${normalize(stop.name)}_${hash(canonical)}`;
}

export function asLineRecallFeature(line: TransitLineIdentity) {
  return {
    name: line.name,
    type: 'line' as const,
    cityId: line.cityId,
    center: line.center,
  };
}

export function asStopRecallFeature(stop: TransitStopIdentity) {
  return {
    name: stop.name,
    type: 'stop' as const,
    cityId: stop.cityId,
    center: stop.center,
  };
}
