/**
 * Install gate on likeness (install-large.ts): a large model is installed only when every street-facing wall group
 * that the photos can judge looks like its photo.
 *
 * Street-facing: the groups with `street` set; when no group sets one, every group whose system is not `blank`.
 * Refused: a street-facing group whose verdict is FAIL, NO EVIDENCE (the photo cannot judge it: foliage, obliquity,
 * washed out) or NO PHOTO (no archived crop matches its main panel), unless the installer names it in
 * `--allow-inferred=<group>:<note>`. Each allowed group must carry a note; the entry then gets
 * `reviewState: 'large-recipe-likeness-inferred'` and a `limitations` line per group saying what was inferred and why.
 * WARN passes (mask IoU under 0.45 is report-only) and is listed in the limitations.
 *
 * Houses with no archived crops (no likeness at all) keep the old state, `large-recipe-gates-pass`, with the
 * limitation that the facade is rule-fitted, not measured; the gate is enforced as soon as crops exist.
 */
export type GroupVerdict = 'PASS' | 'WARN' | 'FAIL' | 'NO EVIDENCE' | 'NO PHOTO';
export interface GateGroup {group: number; system: string; street?: string; verdict: GroupVerdict; reasons?: string[]}
export interface LikenessGateResult {
  ok: boolean;
  reviewState: 'large-recipe-likeness-pass' | 'large-recipe-likeness-inferred' | 'large-recipe-gates-pass';
  /** why the install is refused (empty when ok) */
  refused: string[];
  limitations: string[];
}

export const RULE_FITTED_LIMITATION = 'Facade systems are rule-fitted to the 3DBAG eaves and the counted storeys/bays, not rectified from the photographs.';

export function streetFacing(groups: Pick<GateGroup, 'group' | 'system' | 'street'>[]): number[] {
  const named = groups.filter(g => g.street);
  return (named.length ? named : groups.filter(g => g.system !== 'blank')).map(g => g.group);
}

/** Parse `--allow-inferred=<group>:<note>[;<group>:<note>...]`; a group without a note is an error. */
export function parseAllowInferred(arg: string | undefined): Map<number, string> {
  const out = new Map<number, string>();
  if (!arg) return out;
  for (const part of arg.split(';').map(s => s.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*:\s*(.+)$/.exec(part);
    if (!m || m[2].trim().length < 8) throw Error(`--allow-inferred: "${part}" needs <group>:<note> (a note of at least 8 characters saying what was inferred from what)`);
    out.set(+m[1], m[2].trim());
  }
  return out;
}

export function likenessGate(groups: GateGroup[] | null, allow: Map<number, string> = new Map()): LikenessGateResult {
  if (!groups) return {ok: true, reviewState: 'large-recipe-gates-pass', refused: [], limitations: [RULE_FITTED_LIMITATION]};
  const facing = new Set(streetFacing(groups)), refused: string[] = [], limitations: string[] = [];
  let inferred = false;
  for (const g of groups) {
    if (!facing.has(g.group)) continue;
    const why = g.reasons?.length ? ` (${g.reasons.join('; ')})` : '';
    if (g.verdict === 'PASS') continue;
    if (g.verdict === 'WARN') { limitations.push(`walls[${g.group}] likeness WARN${why}.`); continue; }
    const note = allow.get(g.group);
    if (note) { inferred = true; limitations.push(`walls[${g.group}] not confirmed by the photo (${g.verdict}${why}); inferred: ${note}`); continue; }
    refused.push(`walls[${g.group}] ${g.verdict}${why}`);
  }
  for (const gi of allow.keys()) if (!groups.some(g => g.group === gi)) refused.push(`--allow-inferred names walls[${gi}], which the house does not have`);
  return {ok: refused.length === 0, reviewState: inferred ? 'large-recipe-likeness-inferred' : 'large-recipe-likeness-pass', refused, limitations};
}
