// F3 hand set for the white-accent detectors: the J2 labels (scripts/jev/j2/labels.mjs, set A = the first 48 AB07 'good' crops by pand id,
// white bands / white surrounds / white cornice y/n) joined to the archived crops (source-data pand-crops/<id>/front.jpg), plus the
// J1 gable truth (.cache/jev-facades/set.json) and H5h hand-set-v1 gables.
import fs from 'node:fs';
import { A } from '../../jev/j2/labels.mjs';
export const ARCHIVE = process.env.HOUSE_CROPS_ARCHIVE ?? '/Users/blackmad/Code/map-recall2-source-data-h5h';
export function accentSet() {
  const labels = JSON.parse(fs.readFileSync('scripts/house-crops/labels/AB07.json', 'utf8'));
  const ids = Object.keys(labels).filter(p => labels[p].label === 'good').sort().slice(0, A.length);
  return ids.map((id, i) => ({ id, file: `${ARCHIVE}/pand-crops/${id}/front.jpg`, bands: A[i].bands, surround: A[i].surround, cornice: A[i].cornice }));
}
