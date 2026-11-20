// Register-pui monuments (lane retail-fit-20261120): pands whose monument register names the shopfront (pui /
// winkelpui) and whose generated front draws a shop template. Staged per pand in historic-puis.json with the sign its
// square-on photo shows (round 4): 'band' (the name painted on the pui's frieze), 'glass' (lettered on the window),
// 'neon' (a lit script tube over the pui), 'board' (a real projecting board or awning: the template stays) or 'unread'
// (no usable crop: the template stays), and (round 5) the pui's measured `front`. A band, glass or neon pand draws, in
// the template's place, its kit pui (generic pand) or only its name (a pand with its own front: recipe or house spec):
// retailFit/historicPuiFront.ts. Same modes as the model fits: the default draws published pands, `?retailFit=1` adds
// staged ones, `?retailFit=0` none.
import staged from './historic-puis.json';
import { retailFitMode, type RetailFitMode } from './flag.js';
import type { HistoricPuiHost, PuiFrontSpec } from './historicPuiFront.js';

export type PuiSign = 'band' | 'glass' | 'neon' | 'board' | 'unread';
export type StagedPui = { status: 'published' | 'staged'; review: string; template: string; word?: string; monument: string; sign: PuiSign; signSource?: string; front?: PuiFrontSpec; frontSource?: string; source: string };
export const STAGED_PUIS: Readonly<Record<string, StagedPui>> = ((staged as unknown as { puis?: Record<string, StagedPui> }).puis) ?? {};

const key = (id: string) => (id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id);
/** The host the pand `id` (BAG id, with or without the NL.IMBAG.Pand. prefix) draws with in `mode`, if any: only a pand
 *  whose sign was read as band, glass or neon and whose front was measured. `own`: the pand draws its own front. */
export function historicPuiHost(id: string, own = false, mode: RetailFitMode = retailFitMode()): HistoricPuiHost | undefined {
  const p = STAGED_PUIS[key(id)];
  if (!p || !p.front || mode === 'off' || (mode !== 'all' && p.status !== 'published')) return undefined;
  if (p.sign !== 'band' && p.sign !== 'glass' && p.sign !== 'neon') return undefined;
  return { mode: own ? 'sign' : 'kit', front: p.front };
}
/** The spread for a RetailFrontInput: `{ host }` for a historic pui, else nothing. */
export function historicPuiInput(id: string, own = false): { host?: HistoricPuiHost } {
  const host = historicPuiHost(id, own);
  return host ? { host } : {};
}
