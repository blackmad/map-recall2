// Register-pui monuments (lane retail-fit-20261120, item 4): pands whose monument register names the shopfront (pui /
// winkelpui) and whose generated front still draws a template fascia box. Staged per pand in retail-fits.json `puis`;
// a published pand draws its template WITHOUT the projecting board and cap: the name goes on the pui's own flush sign
// band, painted in the pui's frame colour (retailFront.ts `host: 'historic-pui'`). Same modes as the model fits: the
// default draws published pands, `?retailFit=1` adds staged ones, `?retailFit=0` none.
import staged from './historic-puis.json';
import { retailFitMode, type RetailFitMode } from './flag.js';

export type StagedPui = { status: 'published' | 'staged'; review: string; template: string; word?: string; monument: string; row: string; source: string };
export const STAGED_PUIS: Readonly<Record<string, StagedPui>> = ((staged as unknown as { puis?: Record<string, StagedPui> }).puis) ?? {};

const key = (id: string) => (id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id);
/** Does the pand `id` (BAG id, with or without the NL.IMBAG.Pand. prefix) draw as a historic pui in `mode`? */
export function historicPuiHost(id: string, mode: RetailFitMode = retailFitMode()): boolean {
  const p = STAGED_PUIS[key(id)];
  return !!p && mode !== 'off' && (mode === 'all' || p.status === 'published');
}
