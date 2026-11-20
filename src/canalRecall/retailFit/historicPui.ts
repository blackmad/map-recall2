// Register-pui monuments (lane retail-fit-20261120, item 4): pands whose monument register names the shopfront (pui /
// winkelpui) and whose generated front still draws a template fascia box. Staged per pand in historic-puis.json with
// the sign its square-on photo shows (round 4): 'band' (the name painted on the pui's own flush band), 'glass' (lettered
// on the window, the band plain), 'board' (a real projecting board or awning: the template stays) or 'unread' (no
// usable crop: the template stays). A band or glass pand draws its template WITHOUT the projecting board and cap
// (retailFront.ts `host`). Same modes as the model fits: the default draws published pands, `?retailFit=1` adds staged
// ones, `?retailFit=0` none.
import staged from './historic-puis.json';
import { retailFitMode, type RetailFitMode } from './flag.js';

export type PuiSign = 'band' | 'glass' | 'board' | 'unread';
export type StagedPui = { status: 'published' | 'staged'; review: string; template: string; word?: string; monument: string; sign: PuiSign; signSource?: string; source: string };
export const STAGED_PUIS: Readonly<Record<string, StagedPui>> = ((staged as unknown as { puis?: Record<string, StagedPui> }).puis) ?? {};
export type PuiHost = 'historic-pui' | 'historic-pui-glass';

const key = (id: string) => (id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id);
/** The retailFront host the pand `id` (BAG id, with or without the NL.IMBAG.Pand. prefix) draws with in `mode`, if any. */
export function historicPuiHost(id: string, mode: RetailFitMode = retailFitMode()): PuiHost | undefined {
  const p = STAGED_PUIS[key(id)];
  if (!p || mode === 'off' || (mode !== 'all' && p.status !== 'published')) return undefined;
  return p.sign === 'band' ? 'historic-pui' : p.sign === 'glass' ? 'historic-pui-glass' : undefined;
}
/** The spread for a RetailFrontInput: `{ host }` for a historic pui, else nothing. */
export function historicPuiInput(id: string): { host?: PuiHost } {
  const host = historicPuiHost(id);
  return host ? { host } : {};
}
