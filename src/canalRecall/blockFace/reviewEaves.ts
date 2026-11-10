/**
 * Reviewer eaves pins for auto-placement (Landlust-Zuid 2026-11-10).
 *
 * A row with one eaves line in the photo can still place a lone pand a few decimetres off: 3DBAG reads a dormer or a
 * roof edge as the eaves (Gerard Callenburgstraat 27 and 31 at 10.15 m beside 10.65 m, Jan den Haenstraat 19 at 10.94
 * m beside 10.1 m). A reviewer who has looked at the strip pins the pand's eaves in
 * `scripts/block-face/buurten/<buurt>-review-eaves.json`; the run face carries it as `continuity.measuredEaves` (a strip
 * row), and a line under 3DBAG's eaves re-pitches the front roof. A pin replaces the auto-placed entry of its pand. Pure.
 */
export interface EavesPin {
  pandId: string;
  /** The front eaves line in metres above the strip foot's ground (the strip's own vertical scale). */
  eavesM: number;
  /** What on the strip shows the line. */
  reason: string;
}

export function eavesPinProblems(pins: EavesPin[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `eaves pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (!(typeof pin.eavesM === 'number' && pin.eavesM >= 3 && pin.eavesM <= 30)) p.push(`${at}: eavesM 3..30`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the line)`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

export interface MeasuredEaves { pand: string; stripRow: number; frontRoof?: Record<string, never>; evidence: string }

/**
 * The measuredEaves list with the pins applied: a pin replaces its pand's entry (or adds one) at the strip row of
 * `eavesM`; `frontRoof` is set when the pinned line is under the pand's 3DBAG eaves. Pands of no pin are untouched, and
 * no pin for the run returns the list as it came (byte-identical when absent).
 */
export function applyEavesPins(measured: MeasuredEaves[] | undefined, pins: EavesPin[], runPands: string[], bagEaves: (pandId: string) => number | undefined, strip: {height: number; pixelsPerMetre: number}): MeasuredEaves[] | undefined {
  const mine = pins.filter(x => runPands.includes(x.pandId));
  if (!mine.length) return measured;
  const out = (measured ?? []).filter(m => !mine.some(x => x.pandId === m.pand));
  for (const pin of mine) {
    const bag = bagEaves(pin.pandId);
    out.push({pand: pin.pandId, stripRow: Math.round(strip.height - pin.eavesM * strip.pixelsPerMetre), ...(bag !== undefined && pin.eavesM < bag ? {frontRoof: {}} : {}), evidence: `review pin: ${pin.reason}`});
  }
  return out;
}
