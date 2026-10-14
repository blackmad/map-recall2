/**
 * Hash of a compiled `kind: large` mesh (position arrays per child, sorted by name). Shared by
 * `large-mesh-hashes.ts` (the golden) and `install-large.ts` (which records it on the catalogue
 * entry as `meshHash`), so `stale-installs.ts` can compare an install with the golden exactly.
 */
import {createHash} from 'node:crypto';

export function meshHashOf(group: {children: unknown[]}): string {
  const h = createHash('sha256');
  const kids = [...group.children] as {name: string; geometry: {getAttribute(n: string): {array: ArrayLike<number>}}}[];
  for (const m of kids.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const pos = m.geometry.getAttribute('position').array;
    h.update(m.name); h.update(Buffer.from(new Float32Array(Array.from(pos)).buffer));
  }
  return h.digest('hex').slice(0, 16);
}
