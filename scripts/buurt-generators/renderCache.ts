/**
 * The sheet's per-member render cache (centrum-looks round 3, 2026-11-16). sheet.ts used to reuse any
 * renders/<band>/<pand>/front.png it found, so a sheet drawn after a regeneration silently showed the previous staged
 * row-front (centrum looks round 2: the first re-judge sheets carried round-1 walls). Each band's renders now live under
 * a key: the md5 of every input file the band reads (the staged row-front.json for `after`, the published one for
 * `before`) plus the render options. A changed input is a new directory; old keys are left for the sweep.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

/** A short key over the named files' bytes (a missing file hashes as "missing") and any extra strings. */
export function renderCacheKey(files: readonly string[], extra: readonly string[] = []): string {
  const h = crypto.createHash('md5');
  for (const f of files) { h.update(f + '\0'); h.update(fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from('missing')); h.update('\0'); }
  for (const e of extra) h.update(e + '\0');
  return h.digest('hex').slice(0, 12);
}
