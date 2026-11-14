/**
 * What a large house's unlisted walls (the wall surfaces no `walls[]` group lists) draw as (lane blank-walls-20261114).
 *
 * Feedback 21dc1e32 "why this wall so washed out?" (Buitenzagerij 45), 174d2455 "no windows, really?" (Kromhout,
 * Gedempt Hamerkanaal 209) on build 2cd2fb7: every wall a recipe author had no panorama for was left `otherWalls: 'blank'`
 * (the draft factory's default, and the hand-written "no panorama within 35 m, left blank" of 135 intents), so a
 * gallery-flat spine of 194 homes and a works hall drew as one windowless plane in the house brick. Blank was the
 * absence of evidence, never evidence of a blank wall.
 *
 * The rule: an unlisted wall takes the city look's shader window grid (`window-grid`: blank geometry, no triangles,
 * the wall material flagged `windowGrid`) unless the intent cites the photo that shows those walls blank
 * (`blankWalls.source`, an id in `sources`), or names a real system for them. `otherWalls: 'blank'` without that
 * citation now reads as "not photographed".
 */
import {LARGE_SYSTEMS, type LargeSystemName} from '../blockBuilding/systems.ts';
import {OTHER_WINDOW_GRID, type LargeBuildingIntent} from './intent.ts';

export type OtherWallsResolved = {system: LargeSystemName; windowGrid: boolean; why: 'stated-system' | 'stated-grid' | 'photo-blank' | 'unphotographed'};

export function resolveOtherWalls(intent: Pick<LargeBuildingIntent, 'otherWalls' | 'blankWalls' | 'sources'>): OtherWallsResolved {
  const o = intent.otherWalls;
  if (o === OTHER_WINDOW_GRID) return {system: 'blank', windowGrid: true, why: 'stated-grid'};
  if (o && o !== 'blank' && (LARGE_SYSTEMS as readonly string[]).includes(o)) return {system: o as LargeSystemName, windowGrid: false, why: 'stated-system'};
  if (intent.blankWalls && intent.sources?.some(s => s.id === intent.blankWalls!.source)) return {system: 'blank', windowGrid: false, why: 'photo-blank'};
  return {system: 'blank', windowGrid: true, why: 'unphotographed'};
}

/**
 * A panel a neighbouring building touches (panels.ts `partyH`, more than PARTY_MIN_M of it) is a party wall: blind in
 * Amsterdam even where it rises above a lower neighbour, so the window grid never paints it (the large compile keeps
 * it on the plain `wall` slot).
 */
export const PARTY_MIN_M = 0.5;
export function isPartyPanel(p: {partyH: number}): boolean {
  return p.partyH > PARTY_MIN_M;
}

/** Validation problems of `blankWalls` (the cited source must be one of the intent's own). */
export function blankWallsProblems(intent: Pick<LargeBuildingIntent, 'blankWalls' | 'sources'>): string[] {
  const b = intent.blankWalls as unknown;
  if (b === undefined) return [];
  if (!b || typeof b !== 'object' || Array.isArray(b)) return ['blankWalls: object {source, note?}'];
  const {source, note, ...rest} = b as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof source !== 'string' || !intent.sources?.some(s => s.id === source)) problems.push('blankWalls.source: the id of one of the intent\'s sources (the photo that shows the unlisted walls blank)');
  if (note !== undefined && typeof note !== 'string') problems.push('blankWalls.note: string');
  for (const k of Object.keys(rest)) problems.push(`blankWalls.${k}: unknown field (source, note)`);
  return problems;
}
