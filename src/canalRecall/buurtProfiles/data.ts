/**
 * The published buurt profiles (buurt-profiles.json, written by scripts/buurt-profiles/derive.ts --publish), bundled
 * into the building layer and its chunk worker. `?buurtProfiles=0` (or `globalThis.__canalRecallBuurtProfiles = false`
 * before load) is the A/B: every building then takes the city default.
 */
import SET from './buurt-profiles.json';
import { BuurtProfileIndex, validateProfileSet, type BuurtProfile, type BuurtProfileSet } from './profiles.js';

let index: BuurtProfileIndex | null | undefined;
function enabled(): boolean {
  const g = globalThis as { __canalRecallBuurtProfiles?: boolean; location?: { search?: string } };
  if (g.__canalRecallBuurtProfiles === false) return false;
  try { return new URLSearchParams(g.location?.search ?? '').get('buurtProfiles') !== '0'; } catch { return true; }
}
/** The profile at a point (lng, lat), or null outside every profiled buurt or with the flag off. */
export function buurtProfileAt(lng: number, lat: number): BuurtProfile | null {
  if (index === undefined) index = enabled() ? new BuurtProfileIndex(validateProfileSet(SET as unknown as BuurtProfileSet)) : null;
  return index ? index.at(lng, lat) : null;
}
/** Tests and tools: replace the set (null: profiles off). */
export function setBuurtProfiles(set: BuurtProfileSet | null): void { index = set ? new BuurtProfileIndex(validateProfileSet(set)) : null; }
