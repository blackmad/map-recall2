/** Canonical surfaces retain their source datum. Convert only at boundaries. */
export const LEGACY_BLOCK_DATUM = 'legacy-block-NAP-minus-0.65m';
export function sourceHeightOffset(datum: string): number {
  if (datum === LEGACY_BLOCK_DATUM) return .65;
  if (datum === 'NAP') return 0;
  throw new Error(`Unsupported appearance height datum: ${datum}`);
}
export function sourceToRenderHeight(y: number, datum: string, targetOffsetNAP = 0): number {
  return y + sourceHeightOffset(datum) - targetOffsetNAP;
}
export function napToSourceHeight(nap: number, datum: string): number {
  return nap - sourceHeightOffset(datum);
}
