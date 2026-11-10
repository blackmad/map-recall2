/**
 * Reviewer roof pins for auto-placement (Den Texbuurt 2026-11-10).
 *
 * 3DBAG's roof of a pand can stand 2-3 m over the cornice the strip shows (Den Texstraat 9, 18, 24: ridge 16.2-16.7 m
 * over a 13.5 m cornice; the recipe attic rises to the 3DBAG p95 and draws a slate slab where the photo shows sky). A
 * reviewer who has looked at the strip pins the roof top per pand in `scripts/block-face/buurten/<buurt>-review-roofs.json`
 * ({"pins": [{"pandId", "ridgeM" | "flatBehindCornice": true, "eavesM"?, "reason"}]}). `ridgeM` is the photographed roof top in
 * metres over the strip's ground; `flatBehindCornice` draws no roof rise behind the cornice. The pin becomes the
 * `continuity.measuredEaves[].frontRoof.topRow` of the pand (the existing front-roof cap: blockFace/compile.ts
 * `hintsFor`), so no new compile path exists. A run without pins is byte-identical. Pure.
 */
export interface RoofPin {
  pandId: string;
  /** The roof top in m over the strip's ground (the photo). */
  ridgeM?: number;
  /** No attic rise behind the cornice (a flat roof or a roof the photo cannot see). */
  flatBehindCornice?: boolean;
  /** The photographed cornice (m): replaces the cornice row of the pand's measured-eaves entry (a row clamp: Den Texstraat 11 to 13.2 m, 27 to 13.7 m), or creates the entry. */
  eavesM?: number;
  reason: string;
}

export interface MeasuredEavesEntry {pand: string; stripRow: number; frontRoof?: {topRow?: number; pitchDeg?: number}; evidence: string; front?: string}

export function roofPinProblems(pins: RoofPin[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `roof pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (pin.ridgeM !== undefined && pin.flatBehindCornice === true) p.push(`${at}: ridgeM and flatBehindCornice are exclusive`);
    if (pin.ridgeM === undefined && pin.flatBehindCornice !== true && pin.eavesM === undefined) p.push(`${at}: one of ridgeM, flatBehindCornice, eavesM`);
    if (pin.ridgeM !== undefined && !(pin.ridgeM >= 4 && pin.ridgeM <= 40)) p.push(`${at}: ridgeM must be 4..40 m`);
    if (pin.eavesM !== undefined && !(pin.eavesM >= 3 && pin.eavesM <= 40)) p.push(`${at}: eavesM must be 3..40 m`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the roof top)`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** The top row of a pin on a strip of `height` rows at `ppm`, strictly above `stripRow`. */
export function pinTopRow(pin: RoofPin, stripRow: number, strip: {height: number; pixelsPerMetre: number}): number {
  const row = pin.flatBehindCornice ? stripRow - 1 : Math.round(strip.height - pin.ridgeM! * strip.pixelsPerMetre);
  return Math.max(0, Math.min(stripRow - 1, row));
}

/** The entries with the pins applied; no pin leaves the very same array (byte-identical). */
export function applyRoofPins(entries: MeasuredEavesEntry[], pins: RoofPin[], pandIds: string[], strip: {height: number; pixelsPerMetre: number}): MeasuredEavesEntry[] {
  if (!pins.length) return entries;
  const out = entries.map(e => ({...e}));
  for (const pin of pins) {
    if (!pandIds.includes(pin.pandId)) continue;
    const what = [pin.eavesM !== undefined ? `cornice ${pin.eavesM} m` : '', pin.flatBehindCornice ? 'no rise behind the cornice' : pin.ridgeM !== undefined ? `roof top ${pin.ridgeM} m` : ''].filter(Boolean).join(', ');
    const note = `reviewer roof pin: ${what} (${pin.reason})`, roof = pin.flatBehindCornice === true || pin.ridgeM !== undefined;
    const e = out.find(x => x.pand === pin.pandId);
    if (e) {
      if (pin.eavesM !== undefined) e.stripRow = Math.round(strip.height - pin.eavesM * strip.pixelsPerMetre);
      if (roof) e.frontRoof = {...(e.frontRoof ?? {}), topRow: pinTopRow(pin, e.stripRow, strip)};
      e.evidence += `; ${note}`; continue;
    }
    if (pin.eavesM === undefined) continue;
    const stripRow = Math.round(strip.height - pin.eavesM * strip.pixelsPerMetre);
    out.push({pand: pin.pandId, stripRow, ...(roof ? {frontRoof: {topRow: pinTopRow(pin, stripRow, strip)}} : {}), evidence: note});
  }
  return out;
}
