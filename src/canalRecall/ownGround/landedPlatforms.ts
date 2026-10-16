/**
 * Landed platforms: stone that steps from the quay down into the water and brings its own side walls, so the municipal
 * quay wall (water.ts quayWallMesh) must not run through it, as it skips the shores under bridge decks (decks.ts underDeck).
 * The Homomonument's stepped triangle (scripts/landmarks/memorial-builders.ts, 2026-10-16): the quay crossed its treads
 * and platform as a brick wall. The ring is the stone's outline padded 0.8 m outward (homomonumentQuayPlatformRing); the
 * test in ownGround.test.ts pins it to the builder.
 */
import { pointInRing } from './decks.js';
import type { Vec2 } from './surface.js';

export interface LandedPlatform { id: string; ring: readonly [number, number][] }

export const LANDED_PLATFORMS: readonly LandedPlatform[] = [
  { id: 'homomonument-steps', ring: [[4.8850096, 52.3743881], [4.8848305, 52.3743537], [4.8848751, 52.374468]] },
];

/** The platforms' rings in the game frame (`toLocal`: groundStore's lng/lat → game frame). */
export function landedPlatformRings(toLocal: (lng: number, lat: number) => Vec2): Vec2[][] {
  return LANDED_PLATFORMS.map(p => p.ring.map(([lng, lat]) => toLocal(lng, lat)));
}

/** Point test over the given rings (game frame), for the quay wall's `skip`. */
export function inLandedPlatform(rings: readonly (readonly Vec2[])[]): (x: number, y: number) => boolean {
  if (!rings.length) return () => false;
  const boxes = rings.map(r => r.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]));
  return (x, y) => {
    for (let k = 0; k < rings.length; k++) {
      const b = boxes[k];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (pointInRing(rings[k], x, y)) return true;
    }
    return false;
  };
}
