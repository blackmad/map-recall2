/**
 * Buurt generator round 18 (lane R): a series' window axes from the street panoramas instead of one per `axisM` of front
 * width. The blind test on round 17 (De Wallen) named the bays: "4 instead of 2-3". The width rule cannot see a front
 * whose windows stand wide apart, nor a pair of lights read as one axis.
 *
 * A member's read is the pixel writer's count (houseSpec/writers/pixel.ts): the measured front's window columns on a
 * rhythmic front (punched or columns) whose pitch resolves (PIXEL_BAYS.minPitchScore) and where `columns` and
 * `windowColumns` agree (on the AB07 hand pands that gate took the count from 11/22 to 9/11 right). Several captures of
 * one member must agree; a series takes its members' count when enough of them read and agree, else the width rule
 * stands. Pure: no fs.
 */
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';
import { PIXEL_BAYS } from '../houseSpec/writers/pixel.ts';

/** A series takes the read when at least `minMembers` members, and at least `cover` of all its members, read, and
 *  `share` of them agree on one count. `cover`: Parnassusweg 131928 (14 members) took 2 from two members of one capture
 *  where the photo shows about 4 window groups a front. */
export const BAYS_READ = { minMembers: 2, cover: 0.25, share: 0.6, maxBays: 8 } as const;

export interface BaysCapture { pano: string; date: string; cols: number | null; why?: string }
/** One member's reads (measured/<district>.json `bays`): `bays` its count when its captures agree, else null. */
export interface MemberBays { bays: number | null; reads: BaysCapture[] }

/** The bay count a measured crop states, when the pixel writer's gate passes; else null. */
export function baysOfMeasure(m: Pick<FacadeMeasurement, 'frontClass' | 'columns' | 'windowColumns' | 'pitchScore' | 'usableFraction'>): number | null {
  if (m.usableFraction < 0.5 || (m.frontClass !== 'punched' && m.frontClass !== 'columns')) return null;
  const cols = m.windowColumns ?? m.columns;
  if (cols === null || cols === undefined || !Number.isInteger(cols) || cols < 1 || cols > BAYS_READ.maxBays) return null;
  return m.columns === m.windowColumns && m.pitchScore >= PIXEL_BAYS.minPitchScore ? cols : null;
}

/** A member's count from its captures: the one count they all state (null reads aside); null when none or they differ. */
export function memberBaysOf(reads: readonly BaysCapture[]): number | null {
  const got = [...new Set(reads.flatMap(r => r.cols === null ? [] : [r.cols]))];
  return got.length === 1 ? got[0] : null;
}

/** A series' count from its members' counts (null: unread): the most common when at least `minMembers` (and `cover`
 *  of the members) read and `share` of the read ones agree; else null (the width rule stands). Ties: the smaller count. */
export function seriesBaysOf(members: ReadonlyArray<number | null | undefined>): { bays: number; read: number; agree: number } | null {
  const read = members.filter((b): b is number => typeof b === 'number');
  if (read.length < Math.max(BAYS_READ.minMembers, Math.ceil(members.length * BAYS_READ.cover))) return null;
  const n = new Map<number, number>();
  for (const b of read) n.set(b, (n.get(b) ?? 0) + 1);
  const [bays, agree] = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return agree / read.length >= BAYS_READ.share ? { bays, read: read.length, agree } : null;
}
