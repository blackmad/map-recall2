/**
 * Fit a facade to its wall: a whole number of bays across and a whole number of
 * storeys up, so windows and doors line up with the building instead of being
 * cut by a texture that repeats at a fixed size. Pure, so it is tested.
 */

export const TARGET_BAY_M = 5.2;
export const TARGET_STOREY_M = 3.1;
export const GROUND_FLOOR_M = 3.4;
/** A wall shorter than this is a side or return wall: no door, one plain bay. */
export const MIN_FACADE_WALL_M = 3.2;

export interface WallPlan {
  bays: number;
  bayWidthM: number;
  /** Storeys above the ground floor. */
  storeys: number;
  storeyHeightM: number;
  groundHeightM: number;
  /** Bay indices (left to right along the wall) that carry a front door. */
  doorBays: number[];
  /** True when the wall is too short or too low to read as a facade. */
  plain: boolean;
}

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function planWall(lengthM: number, heightM: number, minHeightM: number, seed: string): WallPlan {
  const rise = Math.max(0, heightM - minHeightM);
  const plain = !(lengthM >= MIN_FACADE_WALL_M) || rise < GROUND_FLOOR_M;
  const bays = Math.max(1, Math.round(lengthM / TARGET_BAY_M));
  const groundHeightM = Math.min(GROUND_FLOOR_M, rise);
  const storeys = plain ? 0 : Math.max(0, Math.round((rise - groundHeightM) / TARGET_STOREY_M));
  // Absorb the rounding so storeys exactly fill the wall.
  const storeyHeightM = storeys > 0 ? (rise - groundHeightM) / storeys : 0;
  const hash = hashSeed(seed);
  const doorBays: number[] = [];
  if (!plain) {
    // A terrace is several houses: a door in every second or third bay.
    const spacing = bays >= 4 ? 2 + (hash % 2) : bays;
    for (let bay = hash % Math.min(spacing, bays); bay < bays; bay += spacing) doorBays.push(bay);
  }
  return { bays, bayWidthM: lengthM / bays, storeys, storeyHeightM, groundHeightM, doorBays, plain };
}
