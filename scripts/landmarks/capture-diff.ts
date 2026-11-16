/**
 * Share of pixels that differ between two same-size screenshots (2026-11-15, pools lane).
 *
 * ingame-capture.ts --underlay hid the model by `holder.visible = false`, which the landmark layer's beforeRender set back
 * to true on the next frame: every "underlay" shot was the model shot again, and before/after aerial pairs of the pools
 * lane were identical. The capture now checks its pair with this and fails when the hidden-model shot did not change.
 */
import sharp from 'sharp';

/** Pixels whose largest channel difference exceeds `tol` (0..255), over all pixels. Pure, on raw RGB(A) buffers. */
export function changedShare(a: Uint8Array, b: Uint8Array, channels: number, tol = 12): number {
  if (a.length !== b.length) throw new Error(`changedShare: sizes differ (${a.length} vs ${b.length})`);
  const n = a.length / channels;
  let changed = 0;
  for (let i = 0; i < a.length; i += channels) {
    let d = 0;
    for (let c = 0; c < Math.min(3, channels); c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    if (d > tol) changed++;
  }
  return n ? changed / n : 0;
}

/** changedShare of two image files (decoded to RGB). */
export async function changedShareOfFiles(fileA: string, fileB: string, tol = 12): Promise<number> {
  const [A, B] = await Promise.all([fileA, fileB].map(f => sharp(f).removeAlpha().raw().toBuffer({resolveWithObject: true})));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return 1;
  return changedShare(A.data, B.data, 3, tol);
}
