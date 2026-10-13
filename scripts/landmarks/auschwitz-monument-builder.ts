import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Auschwitzmonument, Wertheimpark (Jan Wolkers, 1993): a tall pane of clear glass standing on a gravel bed, the words NOOIT MEER AUSCHWITZ cut into it in
 * outline capitals, with two tempered mirror plates shattered into shards laid flat in steel frames in front of it.
 * Original low-poly reconstruction from the Commons photographs (FaceMePLS CC BY 2.0, Gus Maussen CC BY-SA 3.0 nl) and Gemeente Amsterdam
 * panoramas of the park fence (recording_2025-06-19_04-38-42_01175, CC BY 4.0; the monument itself is hidden by the planting from the street).
 * Pane and plate sizes are estimates from the photographs. Local frame: +z is the lettered face; FACING is a visual estimate.
 */
const FACING = 160;

export function buildAuschwitzMonument(_w: number, _d: number, b: BuildingTools) {
  const {box, lettering} = memorialFrame(b, FACING);
  // ---- gravel bed (6.6 x 4.2) and a pale kerb round it
  box(0, 0, 0, 6.6, 0.05, 4.2, 'concrete');
  // ---- the pane: 3.3 x 1.85 m, 5 cm, set in two steel shoes at the foot
  const PZ = -1.1, PY = 0.05;
  box(0, PY, PZ, 3.3, 1.85, 0.05, 'glass');
  for (const x of [-1.0, 1.0]) box(x, PY, PZ, 0.3, 0.12, 0.14, 'frame');
  const face = PZ + 0.025;
  lettering('NOOIT MEER', 0.34, 2.7, 0, PY + 1.28, face, 'front', 'white', 0.02);
  lettering('AUSCHWITZ', 0.34, 2.9, 0, PY + 0.74, face, 'front', 'white', 0.02);
  // ---- two shattered mirror plates in steel trays laid in the gravel in front of the pane
  for (const x of [-1.65, 1.65]) {
    box(x, 0.05, 0.9, 3.1, 0.02, 1.45, 'frame');                                   // tray floor under the glass
    box(x, 0.07, 0.9, 2.94, 0.1, 1.29, 'glass');                                   // plate, 10 cm clear of the tray floor
    for (const sz of [-1, 1]) box(x, 0.07, 0.9 + sz * 0.7, 3.1, 0.1, 0.06, 'frame');   // tray edges round the plate
    for (const sx of [-1, 1]) box(x + sx * 1.52, 0.07, 0.9, 0.06, 0.1, 1.45 - 0.12, 'frame');
    // crack lines: thin dark shards radiating from an impact point, long boxes at fixed angles
    const cx = x + ((x > 0 ? -1 : 1) * 0.35), cz = 0.9 + 0.1;
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2 + 0.3 * (k % 3), len = 0.5 + ((k * 7) % 5) * 0.2;
      box(cx + Math.cos(a) * len / 2, 0.17, cz + Math.sin(a) * len / 2 * 0.6, len, 0.012, 0.012, 'dark', -a * 1.0);
    }
  }
}
