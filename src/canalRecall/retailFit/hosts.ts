// Host-opening taxonomy and the rule for which tenant expressions each host takes (lane retail-fit-20261120,
// docs/reports/retail-fit-20261120.md). The rule: where the building's ground storey is designed (its own arches or
// bays, a monument's historic pui, a modelled landmark), a tenant shows only INSIDE those openings; a fascia box or a
// lightbox over the piers is for plain modern fronts (and photo-read fascias) only.

/** What the host's ground storey is. */
export const HOST_KINDS = [
  /** A stone or brick arcade of arches, each an opening (Hirschgebouw, Nieuw Engeland's arch). */
  'landmark-arcade',
  /** A modelled landmark or block whose ground storey has its own flat-headed bays (Damrak 70-79, Kinkerstraat 89). */
  'landmark-bays',
  /** A monument whose register names its pui (winkelpui) or a canal house's ground windows over a stoep. */
  'historic-pui',
  /** A warehouse's loading doors and hatches (pakhuis). */
  'warehouse-doors',
  /** A post-war or modern curtain-wall / full-glass ground floor. */
  'modern-glass',
  /** A generated wall with no designed ground storey: today's template front. */
  'plain-modern',
] as const;
export type HostKind = (typeof HOST_KINDS)[number];

/** Brand expressions, least to most intrusive. */
export const EXPRESSIONS = [
  'interior', 'goods', 'door-colour', 'glass-letters', 'vinyl-band', 'full-vinyl', 'head-letters', 'panel-in-opening', 'blade', 'awning', 'wall-letters', 'fascia-box', 'lightbox',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const IN_OPENING: readonly Expression[] = ['interior', 'goods', 'door-colour', 'glass-letters', 'vinyl-band', 'full-vinyl', 'head-letters', 'panel-in-opening'];
export const HOST_RULES: Readonly<Record<HostKind, { allowed: readonly Expression[]; why: string }>> = {
  'landmark-arcade': { allowed: [...IN_OPENING, 'blade'], why: 'every arch is an opening; letters go in the glass or the arch head (AH Leidseplein), never over the archivolt' },
  'landmark-bays': { allowed: [...IN_OPENING, 'blade', 'awning'], why: 'the bays are the building\'s; a tenant fills them and may hang a blade or awning inside a bay' },
  'historic-pui': { allowed: [...IN_OPENING, 'blade', 'awning', 'wall-letters'], why: 'the pui is the monument; letters on the glass or the pui\'s own sign band (wall-letters), a blade; no added box' },
  'warehouse-doors': { allowed: [...IN_OPENING, 'blade', 'wall-letters'], why: 'the doors are the front; glass behind them, a painted name on the wall' },
  'modern-glass': { allowed: [...IN_OPENING, 'blade', 'wall-letters', 'lightbox'], why: 'a glass front takes full vinyl, letters and a lightbox on the canopy edge' },
  'plain-modern': { allowed: [...EXPRESSIONS], why: 'no designed ground storey: the template front with its fascia (the photo read still wins)' },
};
export const expressionAllowed = (host: HostKind, e: Expression): boolean => HOST_RULES[host].allowed.includes(e);

/** The host kind from what the game knows of a pand: the model over it (census host), the heads of its openings, its
 *  register facts, a stated ground-floor record. Photo reads outrank this (a photo-read fascia on a monument stays). */
export function hostKindOf(p: { model?: 'bespoke-landmark' | 'block-face' | 'recipe-house' | 'building-type'; heads?: readonly string[]; monumentPui?: boolean; monument?: boolean; warehouse?: boolean; glassShare?: number }): HostKind {
  if (p.model) return p.heads?.length && p.heads.filter(h => h !== 'flat').length * 2 >= p.heads.length ? 'landmark-arcade' : 'landmark-bays';
  if (p.warehouse) return 'warehouse-doors';
  if (p.monumentPui) return 'historic-pui';
  if ((p.glassShare ?? 0) > 0.8) return 'modern-glass';
  if (p.monument) return 'historic-pui';
  return 'plain-modern';
}
