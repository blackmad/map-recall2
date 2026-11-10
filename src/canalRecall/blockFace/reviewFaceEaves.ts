/**
 * Reviewer eaves pins for auto-placement (Nieuwendammerdijk, 2026-11-10).
 *
 * Auto-placement measures a pand's evidence (body band, balconies, palette) against `facts.fronts[0].eavesM`, the 3DBAG
 * eaves over the strip's bottom row. On a dike front the strip's bottom row is the road, the house stands on the raised
 * dike side and the 3DBAG roof carries the dormers, so a one-storey cottage reads 7 m eaves for a gutter at 4 m and the
 * body band covers the roof and the window head: every cottage reads "balconies". A reviewer who has measured the gutter
 * on the strip pins it per face in `scripts/block-face/buurten/<buurt>-review-face-eaves.json`
 * ({"pins": [{"face", "eavesM", "reason"}]}). A face without a pin is read as before (byte-identical). Pure.
 */
export interface EavesPin { face: string; eavesM: number; reason: string }

export function eavesPinProblems(pins: EavesPin[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `eaves pin ${k}`;
    if (!pin.face) p.push(`${at}: face required`);
    if (!(pin.eavesM >= 2 && pin.eavesM <= 12)) p.push(`${at}: eavesM must be 2..12 m`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the gutter)`);
  });
  return p;
}

/** The pinned gutter height of a face's pands, or null when the face has no pin. */
export function pinnedEaves(pins: EavesPin[], face: string): number | null {
  return pins.find(x => x.face === face)?.eavesM ?? null;
}
