/**
 * Metres from the rider to the nearest point of a facade chunk key's tile (threeBuildingsBrowser.ts keys): 0 for the
 * detail block (`near:` / `extras:`) and the kits, which the settle hold always waits for; the z14 tile for `coarse:`
 * and `boats:` keys. Pure, for ThreeBuildings.loadingWithin and its test.
 */
export const COARSE_KEY_PREFIX = 'coarse:';
export const BOATS_KEY_PREFIX = 'boats:';
const ALWAYS = ['near:', 'extras:', '__kit'];

export function chunkKeyDistanceM(key: string, rider: readonly [number, number] | null, zoom = 14): number {
  if (!rider || ALWAYS.some(p => key.startsWith(p))) return 0;
  const tile = key.startsWith(COARSE_KEY_PREFIX) ? key.slice(COARSE_KEY_PREFIX.length) : key.startsWith(BOATS_KEY_PREFIX) ? key.slice(BOATS_KEY_PREFIX.length) : null;
  const [x, y] = (tile ?? '').split('/').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const n = 2 ** zoom, latOf = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180, north = latOf(y), south = latOf(y + 1);
  const dx = (Math.max(west, Math.min(east, rider[0])) - rider[0]) * 111320 * Math.cos(rider[1] * Math.PI / 180);
  const dy = (Math.max(south, Math.min(north, rider[1])) - rider[1]) * 110574;
  return Math.hypot(dx, dy);
}
